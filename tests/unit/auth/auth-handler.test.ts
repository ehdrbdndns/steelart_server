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
    async loginForDev() {
      return {
        onboardingCompleted: true,
        refreshToken: 'refresh-token',
        token: 'access-token',
        user: {
          age_group: '30S',
          id: 99,
          language: 'ko',
          nickname: 'dev-user',
          notifications_enabled: true,
          residency: 'POHANG',
        },
      };
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

// API Gateway HTTP API의 ANY proxy route가 OPTIONS를 Lambda로 넘겨도 preflight는 성공해야 한다.
test('auth handler returns no content for CORS preflight requests', async () => {
  applyServerTestEnv();

  const response = await handleAuthRequest(
    createEvent({
      headers: {
        'access-control-request-headers': 'authorization',
        'access-control-request-method': 'GET',
        origin: 'http://localhost:8081',
      },
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          method: 'OPTIONS',
          path: '/v1/auth/me',
        },
        routeKey: 'ANY /v1/auth/{proxy+}',
      },
      routeKey: 'ANY /v1/auth/{proxy+}',
    }),
    {} as never,
    createAuthServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 204);
  assert.equal(response.body, undefined);
});

// proxy routeKey로 들어와도 auth handler는 실제 세부 경로를 인식해야 한다.
test('auth handler resolves proxied auth route path from rawPath', async () => {
  applyServerTestEnv();
  const token = signAccessToken(12, {
    secret: 'test-secret',
  });

  const response = await handleAuthRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          method: 'GET',
          path: '/v1/auth/me',
        },
        routeKey: 'ANY /v1/auth/{proxy+}',
      },
      routeKey: 'ANY /v1/auth/{proxy+}',
    }),
    {} as never,
    createAuthServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body as string).data.user.id, 12);
});

// dev 환경에서는 개발용 로그인 endpoint가 기존 로그인 응답 shape을 반환해야 한다.
test('auth handler returns real-shaped login response for POST /v1/dev/auth/login in dev env', async () => {
  applyServerTestEnv();
  process.env.APP_ENV = 'dev';
  resetEnvForTests();

  const response = await handleAuthRequest(
    createEvent({
      body: JSON.stringify({
        userId: 99,
      }),
      rawPath: '/v1/dev/auth/login',
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          method: 'POST',
          path: '/v1/dev/auth/login',
        },
      },
    }),
    {} as never,
    createAuthServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body as string).data, {
    onboardingCompleted: true,
    refreshToken: 'refresh-token',
    token: 'access-token',
    user: {
      age_group: '30S',
      id: 99,
      language: 'ko',
      nickname: 'dev-user',
      notifications_enabled: true,
      residency: 'POHANG',
    },
  });
});

// production 환경에서는 개발용 로그인 endpoint 존재를 숨겨야 한다.
test('auth handler hides POST /v1/dev/auth/login in production env', async () => {
  applyServerTestEnv();
  process.env.APP_ENV = 'production';
  resetEnvForTests();

  const response = await handleAuthRequest(
    createEvent({
      rawPath: '/v1/dev/auth/login',
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          method: 'POST',
          path: '/v1/dev/auth/login',
        },
      },
    }),
    {} as never,
    createAuthServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 404);
  assert.equal(JSON.parse(response.body as string).error.code, 'NOT_FOUND');
});
