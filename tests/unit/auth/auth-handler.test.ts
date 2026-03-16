import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

import { handleAuthRequest } from '../../../src/lambdas/auth/handler.js';
import { signAccessToken } from '../../../src/shared/auth/token.js';
import { resetEnvForTests } from '../../../src/shared/env/server.js';
import type { AuthService } from '../../../src/domains/auth/service.js';

function createEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    body: undefined,
    cookies: [],
    headers: {},
    isBase64Encoded: false,
    pathParameters: undefined,
    queryStringParameters: undefined,
    rawPath: '/v1/auth/me',
    rawQueryString: '',
    requestContext: {
      accountId: 'account-id',
      apiId: 'api-id',
      domainName: 'example.com',
      domainPrefix: 'example',
      http: {
        method: 'GET',
        path: '/v1/auth/me',
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

function createAuthServiceStub(): AuthService {
  return {
    async getSession(userId) {
      return {
        authenticated: true,
        onboardingCompleted: true,
        user: {
          age_group: '30S',
          id: userId,
          language: 'ko',
          nickname: 'steelwalker',
          notifications_enabled: true,
          residency: 'POHANG',
        },
      };
    },
    async loginWithApple() {
      throw new Error('not used');
    },
    async loginWithKakao() {
      throw new Error('not used');
    },
    async refreshAccessToken() {
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

// 인증된 사용자가 /v1/auth/me를 호출하면 세션 응답을 반환해야 한다.
test('auth handler returns session response for GET /v1/auth/me', async () => {
  applyServerTestEnv();
  const issuedAt = new Date();

  const token = signAccessToken(12, {
    now: issuedAt,
    secret: 'test-secret',
  });
  const response = await handleAuthRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
    }),
    {} as never,
    createAuthServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body as string), {
    data: {
      authenticated: true,
      onboardingCompleted: true,
      user: {
        age_group: '30S',
        id: 12,
        language: 'ko',
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
