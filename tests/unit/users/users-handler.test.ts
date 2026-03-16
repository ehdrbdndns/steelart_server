import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

import { handleUsersRequest } from '../../../src/lambdas/users/handler.js';
import { signAccessToken } from '../../../src/shared/auth/token.js';
import { resetEnvForTests } from '../../../src/shared/env/server.js';
import type { UsersService } from '../../../src/domains/users/service.js';

function createEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    body: undefined,
    cookies: [],
    headers: {},
    isBase64Encoded: false,
    pathParameters: undefined,
    queryStringParameters: undefined,
    rawPath: '/v1/me/language',
    rawQueryString: '',
    requestContext: {
      accountId: 'account-id',
      apiId: 'api-id',
      domainName: 'example.com',
      domainPrefix: 'example',
      http: {
        method: 'PATCH',
        path: '/v1/me/language',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'request-id',
      routeKey: '$default',
      stage: '$default',
      time: '10/Mar/2026:00:00:00 +0000',
      timeEpoch: 1,
    },
    routeKey: '$default',
    stageVariables: undefined,
    version: '2.0',
    ...overrides,
  };
}

function createUsersServiceStub(): UsersService {
  return {
    async getProfile() {
      throw new Error('not used');
    },
    async updateLanguage(userId, input) {
      return {
        onboardingCompleted: true,
        user: {
          age_group: '30S',
          id: userId,
          language: input.language,
          nickname: 'steelwalker',
          notifications_enabled: true,
          residency: 'POHANG',
        },
      };
    },
    async updateNotifications() {
      throw new Error('not used');
    },
    async updateOnboarding() {
      throw new Error('not used');
    },
    async updateProfile() {
      throw new Error('not used');
    },
  };
}

function applyServerTestEnv(): void {
  process.env.APP_ENV = 'test';
  process.env.AWS_REGION = 'ap-northeast-2';
  process.env.DB_HOST = 'localhost';
  process.env.DB_NAME = 'steelart';
  process.env.DB_PASSWORD = 'password';
  process.env.DB_PORT = '3306';
  process.env.DB_USER = 'steelart';
  process.env.JWT_SECRET = 'test-secret';
  process.env.LOG_LEVEL = 'error';
  resetEnvForTests();
}

// 인증된 사용자가 언어를 변경하면 200 응답과 최신 사용자 정보를 반환해야 한다.
test('users handler updates language with authenticated request', async () => {
  applyServerTestEnv();
  const issuedAt = new Date();

  const token = signAccessToken(5, {
    now: issuedAt,
    secret: 'test-secret',
  });
  const response = await handleUsersRequest(
    createEvent({
      body: JSON.stringify({
        language: 'en',
      }),
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
    }),
    {} as never,
    createUsersServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body as string), {
    data: {
      onboardingCompleted: true,
      user: {
        age_group: '30S',
        id: 5,
        language: 'en',
        nickname: 'steelwalker',
        notifications_enabled: true,
        residency: 'POHANG',
      },
    },
    error: null,
    meta: {
      requestId: 'request-id',
    },
  });
});
