import assert from 'node:assert/strict';
import test from 'node:test';

import type { APIGatewayProxyEventV2 } from 'aws-lambda';

import { createLogger, createLoggerFromRequest } from '../../src/shared/logger/logger.js';

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
      time: '19/Mar/2026:00:00:00 +0000',
      timeEpoch: 1,
    },
    routeKey: '$default',
    stageVariables: undefined,
    version: '2.0',
    ...overrides,
  };
}

// 로거는 payload를 JSON 문자열이 아니라 구조화 객체로 console에 넘겨야 한다.
test('createLogger writes structured payloads without stringifying', () => {
  const originalConsoleError = console.error;
  const calls: unknown[][] = [];

  console.error = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    const logger = createLogger({
      domain: 'auth',
      path: '/v1/auth/kakao',
      requestId: 'request-1',
    });

    logger.error('Auth handler failed', {
      code: 'INTERNAL_ERROR',
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [
    {
      domain: 'auth',
      extra: {
        code: 'INTERNAL_ERROR',
      },
      message: 'Auth handler failed',
      path: '/v1/auth/kakao',
      requestId: 'request-1',
    },
  ]);
});

// 요청 기반 로거는 stage prefix가 제거된 정규화 path를 로그에 남겨야 한다.
test('createLoggerFromRequest uses the normalized request path', () => {
  process.env.LOG_LEVEL = 'debug';

  const originalConsoleInfo = console.info;
  const calls: unknown[][] = [];

  console.info = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    const logger = createLoggerFromRequest(
      createEvent({
        rawPath: '/dev/v1/auth/me',
        requestContext: {
          ...createEvent().requestContext,
          http: {
            ...createEvent().requestContext.http,
            path: '/dev/v1/auth/me',
          },
          stage: 'dev',
        },
      }),
    );

    logger.info('Auth request received');
  } finally {
    console.info = originalConsoleInfo;
    delete process.env.LOG_LEVEL;
  }

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [
    {
      message: 'Auth request received',
      method: 'GET',
      path: '/v1/auth/me',
      requestId: 'request-id',
    },
  ]);
});
