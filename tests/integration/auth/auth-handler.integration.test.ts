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

import { createAuthService } from '../../../src/domains/auth/service.js';
import { authRepository } from '../../../src/domains/auth/repository.js';
import { usersRepository } from '../../../src/domains/users/repository.js';
import { handleAuthRequest } from '../../../src/lambdas/auth/handler.js';
import {
  createRefreshToken,
  getRefreshTokenExpiresAt,
  signAccessToken,
  verifyAccessToken,
} from '../../../src/shared/auth/token.js';
import { getPool } from '../../../src/shared/db/pool.js';
import {
  closeIntegrationDatabase,
  getIntegrationSkipReason,
  prepareIntegrationDatabase,
  queryRows,
  resetIntegrationDatabase,
} from '../helpers/database.js';

const integrationSkipReason = getIntegrationSkipReason();

interface ProviderRow extends RowDataPacket {
  provider: string;
  provider_user_id: string;
  user_id: number;
}

interface RefreshTokenRow extends RowDataPacket {
  refresh_token: string;
  user_id: number;
}

function createEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    body: undefined,
    cookies: [],
    headers: {},
    isBase64Encoded: false,
    pathParameters: undefined,
    queryStringParameters: undefined,
    rawPath: '/v1/auth/kakao',
    rawQueryString: '',
    requestContext: {
      accountId: 'account-id',
      apiId: 'api-id',
      domainName: 'example.com',
      domainPrefix: 'example',
      http: {
        method: 'POST',
        path: '/v1/auth/kakao',
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

// 카카오 로그인 handler는 사용자, 인증 제공자, refresh token row를 실제 DB에 생성해야 한다.
test('auth handler creates user and auth records for POST /v1/auth/kakao', { skip: integrationSkipReason }, async () => {
  const service = createAuthService({
    appleProvider: {
      async getIdentity() {
        throw new Error('not used');
      },
    },
    authRepository,
    kakaoProvider: {
      async getIdentity() {
        return {
          provider: 'kakao',
          providerUserId: 'kakao-user-1',
        };
      },
    },
    usersRepository,
  });

  const response = await handleAuthRequest(
    createEvent({
      body: JSON.stringify({
        accessToken: 'kakao-access-token',
      }),
      headers: {
        'content-type': 'application/json',
      },
    }),
    {} as never,
    service,
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body as string) as {
    data: {
      onboardingCompleted: boolean;
      refreshToken: string;
      token: string;
      user: {
        id: number;
        language: string;
        nickname: string | null;
      };
    };
  };

  assert.equal(body.data.onboardingCompleted, false);
  assert.equal(body.data.user.language, 'ko');
  assert.equal(body.data.user.nickname, '');

  const claims = verifyAccessToken(body.data.token);
  assert.equal(claims.sub, body.data.user.id);

  const providerRows = await queryRows<ProviderRow>(
    `SELECT user_id, provider, provider_user_id
      FROM user_auth_providers
      WHERE user_id = ?`,
    [body.data.user.id],
  );
  const refreshTokenRows = await queryRows<RefreshTokenRow>(
    `SELECT user_id, refresh_token
      FROM user_refresh_tokens
      WHERE user_id = ?`,
    [body.data.user.id],
  );

  assert.equal(providerRows.length, 1);
  assert.deepEqual(providerRows[0], {
    provider: 'KAKAO',
    provider_user_id: 'kakao-user-1',
    user_id: body.data.user.id,
  });

  assert.equal(refreshTokenRows.length, 1);
  assert.equal(refreshTokenRows[0]?.user_id, body.data.user.id);
  assert.equal(refreshTokenRows[0]?.refresh_token, body.data.refreshToken);
});

// refresh handler는 저장된 refresh token으로 새 access token을 발급해야 한다.
test('auth handler refreshes access token with persisted refresh token', { skip: integrationSkipReason }, async () => {
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
  const refreshToken = createRefreshToken();

  await getPool().execute(
    `INSERT INTO user_refresh_tokens (
        user_id,
        refresh_token,
        expires_at,
        revoked_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, NULL, ?, ?)`,
    [
      insertResult.insertId,
      refreshToken,
      getRefreshTokenExpiresAt(now),
      now,
      now,
    ],
  );

  const response = await handleAuthRequest(
    createEvent({
      body: JSON.stringify({
        refreshToken,
      }),
      headers: {
        'content-type': 'application/json',
      },
      rawPath: '/v1/auth/refresh',
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          path: '/v1/auth/refresh',
        },
      },
    }),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body as string) as {
    data: {
      token: string;
    };
  };
  const claims = verifyAccessToken(body.data.token);

  assert.equal(claims.sub, insertResult.insertId);
});

// auth/me는 유효한 access token으로 현재 세션과 사용자 프로필을 반환해야 한다.
test('auth handler returns session response for GET /v1/auth/me', { skip: integrationSkipReason }, async () => {
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

  const response = await handleAuthRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/auth/me',
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          method: 'GET',
          path: '/v1/auth/me',
        },
      },
    }),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body as string) as {
    data: {
      authenticated: boolean;
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
    authenticated: true,
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
