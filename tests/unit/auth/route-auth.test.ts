import assert from 'node:assert/strict';
import test from 'node:test';

import type { APIGatewayProxyEventV2 } from 'aws-lambda';

import { AppError } from '../../../src/shared/api/errors.js';
import {
  createHttpRequest,
  getPathSegments,
  getQueryList,
  parseJsonBody,
} from '../../../src/shared/api/route.js';
import { resetEnvForTests } from '../../../src/shared/env/server.js';
import { getBearerToken, requireAuth } from '../../../src/shared/auth/guard.js';
import { signAccessToken } from '../../../src/shared/auth/token.js';

function createEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    body: undefined,
    cookies: [],
    headers: {},
    isBase64Encoded: false,
    pathParameters: undefined,
    queryStringParameters: undefined,
    rawPath: '/v1/artworks',
    rawQueryString: '',
    requestContext: {
      accountId: 'account-id',
      apiId: 'api-id',
      domainName: 'example.com',
      domainPrefix: 'example',
      http: {
        method: 'GET',
        path: '/v1/artworks',
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

// 라우트 헬퍼는 path 세그먼트와 반복 query 값을 올바르게 읽어야 한다.
test('route helper reads path segments and repeated query values', () => {
  const event = createEvent({
    queryStringParameters: {
      artistType: 'COMPANY,INDIVIDUAL',
      placeId: '1,2',
    },
    rawPath: '/v1/artworks/filters',
    rawQueryString: 'placeId=1&placeId=2&artistType=COMPANY,INDIVIDUAL',
    requestContext: {
      ...createEvent().requestContext,
      http: {
        ...createEvent().requestContext.http,
        path: '/v1/artworks/filters',
      },
    },
  });

  const request = createHttpRequest(event);

  assert.deepEqual(getPathSegments(request.path), ['v1', 'artworks', 'filters']);
  assert.deepEqual(getQueryList(event, 'placeId'), ['1', '2']);
  assert.deepEqual(request.getQueryList('artistType'), ['COMPANY', 'INDIVIDUAL']);
});

// stage가 붙은 invoke URL로 들어와도 요청 path는 stage prefix 없이 정규화되어야 한다.
test('route helper strips stage prefix from raw path', () => {
  const event = createEvent({
    rawPath: '/dev/v1/auth/me',
    requestContext: {
      ...createEvent().requestContext,
      http: {
        ...createEvent().requestContext.http,
        path: '/dev/v1/auth/me',
      },
      stage: 'dev',
    },
  });

  const request = createHttpRequest(event);

  assert.equal(request.path, '/v1/auth/me');
  assert.deepEqual(getPathSegments(request.path), ['v1', 'auth', 'me']);
});

// JSON body가 잘못되면 AppError로 변환되어야 한다.
test('parseJsonBody throws AppError when body is not valid JSON', () => {
  const event = createEvent({
    body: '{invalid-json}',
  });

  assert.throws(
    () => parseJsonBody(event),
    (error: unknown) => error instanceof AppError && error.code === 'BAD_REQUEST',
  );
});

// 인증 가드는 Bearer 토큰을 추출하고 누락된 인증은 거부해야 한다.
test('auth guard extracts bearer tokens and rejects missing auth', () => {
  applyServerTestEnv();
  assert.equal(
    getBearerToken({
      Authorization: 'Bearer token-value',
    }),
    'token-value',
  );

  assert.throws(
    () => requireAuth(createEvent()),
    (error: unknown) => error instanceof AppError && error.code === 'UNAUTHORIZED',
  );
});

// 유효한 Bearer 토큰이 있으면 인증된 사용자 정보를 복원해야 한다.
test('auth guard resolves authenticated user from bearer token', () => {
  applyServerTestEnv();
  const token = signAccessToken(9, {
    secret: 'test-secret',
  });
  const auth = requireAuth(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
    }),
    undefined,
  );

  assert.equal(auth.userId, 9);
  assert.equal(auth.tokenClaims.type, 'access');
});
