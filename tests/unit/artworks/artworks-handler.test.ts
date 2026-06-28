import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

import type { ArtworksService } from '../../../src/domains/artworks/service.js';
import { handleArtworksRequest } from '../../../src/lambdas/artworks/handler.js';
import { signAccessToken } from '../../../src/shared/auth/token.js';
import { resetEnvForTests } from '../../../src/shared/env/server.js';

function createRequestContext(
  path = '/v1/artworks',
  method = 'GET',
  routePath = path,
): APIGatewayProxyEventV2['requestContext'] {
  return {
    accountId: 'account-id',
    apiId: 'api-id',
    domainName: 'example.com',
    domainPrefix: 'example',
    http: {
      method,
      path,
      protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1',
      userAgent: 'test',
    },
    requestId: 'request-id',
    routeKey: `${method} ${routePath}`,
    stage: '$default',
    time: '19/Mar/2026:00:00:00 +0000',
    timeEpoch: 1,
  };
}

function createEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    body: undefined,
    cookies: [],
    headers: {},
    isBase64Encoded: false,
    pathParameters: {},
    queryStringParameters: undefined,
    rawPath: '/v1/artworks',
    rawQueryString: '',
    requestContext: createRequestContext(),
    routeKey: 'GET /v1/artworks',
    stageVariables: undefined,
    version: '2.0',
    ...overrides,
  };
}

function createArtworksServiceStub(overrides: Partial<ArtworksService> = {}): ArtworksService {
  return {
    async getArtworkDetail(artworkId) {
      return {
        address: '경북 포항시',
        address_en: 'Pohang-si, Gyeongbuk',
        artist_name_en: 'Artist One',
        artist_name_ko: '작가 하나',
        audio_url_en: null,
        audio_url_ko: null,
        category: 'STEEL_ART',
        description_en: 'desc',
        description_ko: '설명',
        festival_years: ['2024', '2023'],
        id: artworkId,
        images: [],
        lat: 36.1,
        liked: true,
        lng: 129.3,
        material: 'steel',
        place_name_en: 'Space Walk',
        place_name_ko: '스페이스워크',
        production_year: 2024,
        size_text_en: null,
        size_text_ko: null,
        title_en: 'Space Walk',
        title_ko: '스페이스워크',
        zone_id: 1,
        zone_name_en: 'Yeongil',
        zone_name_ko: '영일',
      };
    },
    async getArtworkFilters() {
      return {
        artistTypes: [
          {
            label_en: 'Company',
            label_ko: '단체',
            value: 'COMPANY',
          },
        ],
        festivalYears: ['2024'],
        zones: [
          {
            id: 1,
            name_en: 'Yeongil',
            name_ko: '영일',
            places: [
              {
                id: 1,
                name_en: 'Space Walk',
                name_ko: '스페이스워크',
              },
            ],
          },
        ],
      };
    },
    async getArtworkFiltersV2() {
      return {
        nameEnConflicts: [],
        response: {
          artistTypes: [
            {
              label_en: 'Company',
              label_ko: '단체',
              value: 'COMPANY',
            },
          ],
          festivalYears: ['2024'],
          zones: [
            {
              id: 1,
              name_en: 'Yeongildae Beach',
              name_ko: '영일대해수욕장',
              places: [
                {
                  name_en: 'Yeongildae Beach',
                  name_ko: '영일대해수욕장',
                  placeIds: [1, 2],
                },
              ],
            },
          ],
        },
      };
    },
    async listArtworks(_input) {
      return {
        artworks: [
          {
            address: '경북 포항시 영일대',
            address_en: 'Yeongildae, Pohang-si',
            artist_name_en: 'Artist One',
            artist_name_ko: '작가 하나',
            id: 1,
            liked: false,
            place_name_en: 'Yeongildae Beach',
            place_name_ko: '영일대해수욕장',
            thumbnail_image_height: 800,
            thumbnail_image_url: null,
            thumbnail_image_width: 1200,
            title_en: 'Space Walk',
            title_ko: '스페이스워크',
          },
        ],
        page: 1,
        size: 24,
        total: 1,
      };
    },
    async likeArtwork(artworkId) {
      return {
        artworkId,
        liked: true,
      };
    },
    async unlikeArtwork(artworkId) {
      return {
        artworkId,
        liked: false,
      };
    },
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

// 작품 목록 핸들러는 필터 query를 읽고 아카이브 응답을 반환해야 한다.
test('artworks handler returns list response for GET /v1/artworks', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, {
    secret: 'test-secret',
  });

  const response = await handleArtworksRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawQueryString: 'artistType=COMPANY&festivalYear=2024&placeId=1&page=1&size=24&sort=latest',
    }),
    {} as never,
    createArtworksServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body as string).data.total, 1);
  assert.equal(JSON.parse(response.body as string).data.artworks[0].address, '경북 포항시 영일대');
});

// 작품 목록 핸들러는 title 정렬과 lang, likedOnly 파라미터를 그대로 service에 전달해야 한다.
test('artworks handler forwards title sort, lang, and likedOnly to service', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, {
    secret: 'test-secret',
  });
  let capturedInput: unknown;

  const response = await handleArtworksRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawQueryString: 'artistType=COMPANY&festivalYear=2024&lang=en&likedOnly=true&page=1&placeId=1&size=24&sort=title',
    }),
    {} as never,
    createArtworksServiceStub({
      async listArtworks(input) {
        capturedInput = input;

        return {
          artworks: [],
          page: 1,
          size: 24,
          total: 0,
        };
      },
    }),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(capturedInput, {
    artistTypes: ['COMPANY'],
    festivalYears: ['2024'],
    lang: 'en',
    likedOnly: true,
    page: 1,
    placeIds: [1],
    size: 24,
    sort: 'title',
  });
});

// 작품 목록 핸들러는 lang 기본값과 likedOnly=false 문자열 파싱을 올바르게 적용해야 한다.
test('artworks handler applies default lang and parses likedOnly=false', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, {
    secret: 'test-secret',
  });
  let capturedInput: unknown;

  const response = await handleArtworksRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawQueryString: 'likedOnly=false&page=1&size=24&sort=title',
    }),
    {} as never,
    createArtworksServiceStub({
      async listArtworks(input) {
        capturedInput = input;

        return {
          artworks: [],
          page: 1,
          size: 24,
          total: 0,
        };
      },
    }),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(capturedInput, {
    artistTypes: [],
    festivalYears: [],
    lang: 'ko',
    likedOnly: false,
    page: 1,
    placeIds: [],
    size: 24,
    sort: 'title',
  });
});

// 작품 상세 핸들러는 path id를 읽어 상세 응답을 반환해야 한다.
test('artworks handler returns detail response for GET /v1/artworks/{id}', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, {
    secret: 'test-secret',
  });

  const response = await handleArtworksRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/artworks/12',
      pathParameters: {
        artworkId: '12',
      },
      requestContext: createRequestContext('/v1/artworks/12', 'GET', '/v1/artworks/{artworkId}'),
      routeKey: 'GET /v1/artworks/{artworkId}',
    }),
    {} as never,
    createArtworksServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body as string).data.id, 12);
  assert.equal(JSON.parse(response.body as string).data.material, 'steel');
  assert.equal(JSON.parse(response.body as string).data.zone_name_ko, '영일');
  assert.equal(JSON.parse(response.body as string).data.zone_name_en, 'Yeongil');
});

// 작품 필터 핸들러는 장소와 축제 연도 필터 목록을 반환해야 한다.
test('artworks handler returns filters response for GET /v1/artworks/filters', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, {
    secret: 'test-secret',
  });

  const response = await handleArtworksRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/artworks/filters',
      requestContext: createRequestContext('/v1/artworks/filters'),
    }),
    {} as never,
    createArtworksServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body as string).data.zones[0].places[0].id, 1);
});

// 인증된 사용자가 POST /v1/artworks/{id}/like를 호출하면 liked=true 응답을 받아야 한다.
test('artworks handler returns liked=true for POST /v1/artworks/{id}/like', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, {
    secret: 'test-secret',
  });

  const response = await handleArtworksRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/artworks/12/like',
      pathParameters: {
        artworkId: '12',
      },
      requestContext: createRequestContext('/v1/artworks/12/like', 'POST', '/v1/artworks/{artworkId}/like'),
      routeKey: 'POST /v1/artworks/{artworkId}/like',
    }),
    {} as never,
    createArtworksServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(body.data, {
    artworkId: 12,
    liked: true,
  });
});

// 인증된 사용자가 DELETE /v1/artworks/{id}/like를 호출하면 liked=false 응답을 받아야 한다.
test('artworks handler returns liked=false for DELETE /v1/artworks/{id}/like', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, {
    secret: 'test-secret',
  });

  const response = await handleArtworksRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/artworks/12/like',
      pathParameters: {
        artworkId: '12',
      },
      requestContext: createRequestContext('/v1/artworks/12/like', 'DELETE', '/v1/artworks/{artworkId}/like'),
      routeKey: 'DELETE /v1/artworks/{artworkId}/like',
    }),
    {} as never,
    createArtworksServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(body.data, {
    artworkId: 12,
    liked: false,
  });
});

// 작품 좋아요 path의 artworkId가 양수 정수가 아니면 validation error로 거부해야 한다.
test('artworks handler rejects invalid artworkId for like routes', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, {
    secret: 'test-secret',
  });

  const response = await handleArtworksRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/artworks/not-a-number/like',
      pathParameters: {
        artworkId: 'not-a-number',
      },
      requestContext: createRequestContext('/v1/artworks/not-a-number/like', 'POST', '/v1/artworks/{artworkId}/like'),
      routeKey: 'POST /v1/artworks/{artworkId}/like',
    }),
    {} as never,
    createArtworksServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 422);
  assert.equal(JSON.parse(response.body as string).error.code, 'VALIDATION_ERROR');
});

// 작품 좋아요 API는 Authorization 헤더가 없으면 UNAUTHORIZED를 반환해야 한다.
test('artworks handler requires authorization for like routes', async () => {
  applyServerTestEnv();

  const response = await handleArtworksRequest(
    createEvent({
      rawPath: '/v1/artworks/12/like',
      pathParameters: {
        artworkId: '12',
      },
      requestContext: createRequestContext('/v1/artworks/12/like', 'POST', '/v1/artworks/{artworkId}/like'),
      routeKey: 'POST /v1/artworks/{artworkId}/like',
    }),
    {} as never,
    createArtworksServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 401);
  assert.equal(JSON.parse(response.body as string).error.code, 'UNAUTHORIZED');
});

// v2 필터 핸들러는 name_ko 단위로 묶인 placeIds 응답을 반환해야 한다.
test('artworks handler returns grouped places for GET /v2/artworks/filters', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, {
    secret: 'test-secret',
  });

  const response = await handleArtworksRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v2/artworks/filters',
      requestContext: createRequestContext('/v2/artworks/filters'),
      routeKey: 'GET /v2/artworks/filters',
    }),
    {} as never,
    createArtworksServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body as string);
  assert.deepEqual(body.data.zones[0].places[0].placeIds, [1, 2]);
  assert.equal(body.data.zones[0].places[0].name_ko, '영일대해수욕장');
});
