import assert from 'node:assert/strict';
import test from 'node:test';

import type { APIGatewayProxyEventV2 } from 'aws-lambda';

import { AppError } from '../../src/shared/api/errors.js';
import {
  createHttpRequest,
  getPathSegments,
  getQueryList,
  parseJsonBody,
} from '../../src/shared/api/route.js';
import { getBearerToken, requireAuth } from '../../src/shared/auth/guard.js';
import type { AccessTokenClaims } from '../../src/shared/auth/token.js';

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

test('parseJsonBody throws AppError when body is not valid JSON', () => {
  const event = createEvent({
    body: '{invalid-json}',
  });

  assert.throws(
    () => parseJsonBody(event),
    (error: unknown) => error instanceof AppError && error.code === 'BAD_REQUEST',
  );
});

test('auth guard extracts bearer tokens and rejects missing auth', () => {
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

test('auth guard can resolve authenticated user via injected verifier', () => {
  const auth = requireAuth(
    createEvent({
      headers: {
        authorization: 'Bearer token-value',
      },
    }),
    undefined,
    {
      verifyToken(token): AccessTokenClaims {
        assert.equal(token, 'token-value');

        return {
          exp: 200,
          iat: 100,
          sub: 9,
          type: 'access',
        };
      },
    },
  );

  assert.equal(auth.userId, 9);
  assert.equal(auth.tokenClaims.type, 'access');
});
