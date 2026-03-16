import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import type {
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';

import { handleUsersRequest } from '../../../src/lambdas/users/handler.js';
import { signAccessToken } from '../../../src/shared/auth/token.js';
import { getPool } from '../../../src/shared/db/pool.js';
import {
  closeIntegrationDatabase,
  getIntegrationSkipReason,
  prepareIntegrationDatabase,
  queryRows,
  resetIntegrationDatabase,
} from '../helpers/database.js';

const integrationSkipReason = getIntegrationSkipReason();

interface UserRow extends RowDataPacket {
  age_group: string | null;
  id: number;
  nickname: string | null;
  residency: string | null;
}

function createEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    body: undefined,
    cookies: [],
    headers: {},
    isBase64Encoded: false,
    pathParameters: undefined,
    queryStringParameters: undefined,
    rawPath: '/v1/users/me/onboarding',
    rawQueryString: '',
    requestContext: {
      accountId: 'account-id',
      apiId: 'api-id',
      domainName: 'example.com',
      domainPrefix: 'example',
      http: {
        method: 'PATCH',
        path: '/v1/users/me/onboarding',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'integration-test',
      },
      requestId: 'integration-request-id',
      routeKey: '$default',
      stage: '$default',
      time: '16/Mar/2026:00:00:00 +0000',
      timeEpoch: 1,
    },
    routeKey: '$default',
    stageVariables: undefined,
    version: '2.0',
    ...overrides,
  };
}

before(async () => {
  if (integrationSkipReason) {
    return;
  }

  await prepareIntegrationDatabase();
});

beforeEach(async () => {
  if (integrationSkipReason) {
    return;
  }

  await resetIntegrationDatabase();
});

after(async () => {
  if (integrationSkipReason) {
    return;
  }

  await closeIntegrationDatabase();
});

// 온보딩 handler는 실제 users row를 수정하고 최신 사용자 응답을 반환해야 한다.
test('users handler updates onboarding fields and persists them', { skip: integrationSkipReason }, async () => {
  const now = new Date();
  const [insertResult] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO users (
        nickname,
        residency,
        age_group,
        language,
        notifications_enabled,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['seed-user', 'POHANG', '20S', 'ko', 1, now, now],
  );
  const token = signAccessToken(insertResult.insertId);

  const response = await handleUsersRequest(
    createEvent({
      body: JSON.stringify({
        age_group: '30S',
        nickname: 'steelwalker',
        residency: 'POHANG',
      }),
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
    }),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body as string) as {
    data: {
      onboardingCompleted: boolean;
      user: {
        age_group: string | null;
        id: number;
        language: string;
        nickname: string | null;
        notifications_enabled: boolean;
        residency: string | null;
      };
    };
  };

  assert.equal(body.data.onboardingCompleted, true);
  assert.deepEqual(body.data.user, {
    age_group: '30S',
    id: insertResult.insertId,
    language: 'ko',
    nickname: 'steelwalker',
    notifications_enabled: true,
    residency: 'POHANG',
  });

  const persistedRows = await queryRows<UserRow>(
    `SELECT id, nickname, residency, age_group
      FROM users
      WHERE id = ?`,
    [insertResult.insertId],
  );

  assert.equal(persistedRows.length, 1);
  assert.deepEqual(persistedRows[0], {
    age_group: '30S',
    id: insertResult.insertId,
    nickname: 'steelwalker',
    residency: 'POHANG',
  });
});

// users/me는 인증된 사용자의 현재 프로필과 온보딩 상태를 반환해야 한다.
test('users handler returns current profile for GET /v1/users/me', { skip: integrationSkipReason }, async () => {
  const now = new Date();
  const [insertResult] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO users (
        nickname,
        residency,
        age_group,
        language,
        notifications_enabled,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['steelwalker', 'POHANG', '30S', 'ko', 1, now, now],
  );
  const token = signAccessToken(insertResult.insertId);

  const response = await handleUsersRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/users/me',
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          method: 'GET',
          path: '/v1/users/me',
        },
      },
    }),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body as string) as {
    data: {
      onboardingCompleted: boolean;
      user: {
        age_group: string | null;
        id: number;
        language: string;
        nickname: string | null;
        notifications_enabled: boolean;
        residency: string | null;
      };
    };
  };

  assert.deepEqual(body.data, {
    onboardingCompleted: true,
    user: {
      age_group: '30S',
      id: insertResult.insertId,
      language: 'ko',
      nickname: 'steelwalker',
      notifications_enabled: true,
      residency: 'POHANG',
    },
  });
});

// 언어 변경 handler는 users.language를 갱신하고 최신 사용자 응답을 반환해야 한다.
test('users handler updates language and persists it', { skip: integrationSkipReason }, async () => {
  const now = new Date();
  const [insertResult] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO users (
        nickname,
        residency,
        age_group,
        language,
        notifications_enabled,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['steelwalker', 'POHANG', '30S', 'ko', 1, now, now],
  );
  const token = signAccessToken(insertResult.insertId);

  const response = await handleUsersRequest(
    createEvent({
      body: JSON.stringify({
        language: 'en',
      }),
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      rawPath: '/v1/me/language',
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          path: '/v1/me/language',
        },
      },
    }),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body as string) as {
    data: {
      onboardingCompleted: boolean;
      user: {
        age_group: string | null;
        id: number;
        language: string;
        nickname: string | null;
        notifications_enabled: boolean;
        residency: string | null;
      };
    };
  };

  assert.deepEqual(body.data.user, {
    age_group: '30S',
    id: insertResult.insertId,
    language: 'en',
    nickname: 'steelwalker',
    notifications_enabled: true,
    residency: 'POHANG',
  });

  const persistedRows = await queryRows<RowDataPacket & { language: string }>(
    `SELECT language
      FROM users
      WHERE id = ?`,
    [insertResult.insertId],
  );

  assert.equal(persistedRows[0]?.language, 'en');
});

// 알림 설정 handler는 notifications_enabled 값을 갱신하고 최신 사용자 응답을 반환해야 한다.
test('users handler updates notifications and persists them', { skip: integrationSkipReason }, async () => {
  const now = new Date();
  const [insertResult] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO users (
        nickname,
        residency,
        age_group,
        language,
        notifications_enabled,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['steelwalker', 'POHANG', '30S', 'ko', 1, now, now],
  );
  const token = signAccessToken(insertResult.insertId);

  const response = await handleUsersRequest(
    createEvent({
      body: JSON.stringify({
        notifications_enabled: false,
      }),
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      rawPath: '/v1/me/notifications',
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          path: '/v1/me/notifications',
        },
      },
    }),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body as string) as {
    data: {
      onboardingCompleted: boolean;
      user: {
        age_group: string | null;
        id: number;
        language: string;
        nickname: string | null;
        notifications_enabled: boolean;
        residency: string | null;
      };
    };
  };

  assert.deepEqual(body.data.user, {
    age_group: '30S',
    id: insertResult.insertId,
    language: 'ko',
    nickname: 'steelwalker',
    notifications_enabled: false,
    residency: 'POHANG',
  });

  const persistedRows = await queryRows<RowDataPacket & { notifications_enabled: number }>(
    `SELECT notifications_enabled
      FROM users
      WHERE id = ?`,
    [insertResult.insertId],
  );

  assert.equal(persistedRows[0]?.notifications_enabled, 0);
});
