import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

import type { MapService } from '../../../src/domains/map/service.js';
import { handleMapRequest } from '../../../src/lambdas/map/handler.js';
import { signAccessToken } from '../../../src/shared/auth/token.js';
import { resetEnvForTests } from '../../../src/shared/env/server.js';

function createEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    body: undefined,
    cookies: [],
    headers: {},
    isBase64Encoded: false,
    pathParameters: undefined,
    queryStringParameters: undefined,
    rawPath: '/v1/map/artworks',
    rawQueryString: '',
    requestContext: {
      accountId: 'account-id',
      apiId: 'api-id',
      domainName: 'example.com',
      domainPrefix: 'example',
      http: {
        method: 'GET',
        path: '/v1/map/artworks',
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

function createMapServiceStub(): MapService {
  return {
    async getMapArtworks() {
      return {
        artworks: [
          {
            id: 1,
            lat: 36.1,
            liked: true,
            lng: 129.3,
            title_en: 'Space Walk',
            title_ko: '스페이스워크',
          },
        ],
      };
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

// 지도 핸들러는 좌표와 반경이 들어오면 최소 작품 목록을 반환해야 한다.
test('map handler returns map artworks for GET /v1/map/artworks', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, {
    secret: 'test-secret',
  });

  const response = await handleMapRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawQueryString: 'lat=36.1&lng=129.3&radiusMeters=500',
    }),
    {} as never,
    createMapServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body as string).data.artworks[0].lat, 36.1);
  assert.equal(JSON.parse(response.body as string).data.artworks[0].liked, true);
});

// 지도 query는 lat/lng/radiusMeters가 모두 있어야 하며 하나라도 빠지면 bad request로 거부해야 한다.
test('map handler rejects missing coordinates', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, {
    secret: 'test-secret',
  });

  const response = await handleMapRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawQueryString: 'lat=36.1&radiusMeters=500',
    }),
    {} as never,
    createMapServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 400);
  assert.equal(JSON.parse(response.body as string).error.code, 'BAD_REQUEST');
});
