import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

import type { SearchService } from '../../../src/domains/search/service.js';
import { handleSearchRequest } from '../../../src/lambdas/search/handler.js';
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
    rawPath: '/v1/search/artworks',
    rawQueryString: '',
    requestContext: {
      accountId: 'account-id',
      apiId: 'api-id',
      domainName: 'example.com',
      domainPrefix: 'example',
      http: {
        method: 'GET',
        path: '/v1/search/artworks',
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

function createSearchServiceStub(): SearchService {
  return {
    async autocomplete(_userId, input) {
      return {
        suggestions: [
          {
            text_en: 'Space Walk',
            text_ko: input.q,
            type: 'ARTWORK_TITLE',
          },
        ],
      };
    },
    async searchArtworks(_userId, input) {
      return {
        artworks: [
          {
            artist_name_en: 'Artist One',
            artist_name_ko: '작가 하나',
            id: 1,
            lat: 36.01,
            liked: false,
            lng: 129.37,
            place_name_en: 'Yeongildae',
            place_name_ko: '영일대',
            thumbnail_image_height: 800,
            thumbnail_image_url: null,
            thumbnail_image_width: 1200,
            title_en: input.q,
            title_ko: '검색 결과',
            zone_id: 1,
          },
        ],
        last: input.page * input.size >= 2,
        page: input.page,
        size: input.size,
        totalElements: 2,
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

// 검색 핸들러는 q, sort, page, size query를 읽어 작품 카드 목록과 페이지 메타를 반환해야 한다.
test('search handler returns artwork matches for GET /v1/search/artworks', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, {
    secret: 'test-secret',
  });

  const response = await handleSearchRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawQueryString: 'q=Steel&sort=oldest&page=2&size=1',
    }),
    {} as never,
    createSearchServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.artworks[0].title_en, 'Steel');
  assert.equal(body.data.artworks[0].thumbnail_image_width, 1200);
  assert.equal(body.data.artworks[0].thumbnail_image_height, 800);
  assert.equal(body.data.page, 2);
  assert.equal(body.data.size, 1);
  assert.equal(body.data.totalElements, 2);
  assert.equal(body.data.last, true);
});

// 검색 query가 비어 있으면 validation error로 거부해야 한다.
test('search handler rejects blank q query', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, {
    secret: 'test-secret',
  });

  const response = await handleSearchRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawQueryString: 'q=',
    }),
    {} as never,
    createSearchServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 422);
  assert.equal(JSON.parse(response.body as string).error.code, 'VALIDATION_ERROR');
});

// 자동완성 핸들러는 q, lang, size query를 읽어 추천 목록을 반환해야 한다.
test('search handler returns autocomplete suggestions for GET /v1/search/autocomplete', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, {
    secret: 'test-secret',
  });

  const response = await handleSearchRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/search/autocomplete',
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          path: '/v1/search/autocomplete',
        },
      },
      rawQueryString: 'q=스페이스&lang=en&size=5',
    }),
    {} as never,
    createSearchServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.suggestions.length, 1);
  assert.equal(body.data.suggestions[0].text_ko, '스페이스');
  assert.equal(body.data.suggestions[0].type, 'ARTWORK_TITLE');
});

// 검색 정렬값이 없으면 latest 기본값으로 처리해야 한다.
test('search handler applies default pagination and sort values', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, {
    secret: 'test-secret',
  });

  const response = await handleSearchRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawQueryString: 'q=포항',
    }),
    {} as never,
    createSearchServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.page, 1);
  assert.equal(body.data.size, 20);
  assert.equal(body.data.last, true);
});
