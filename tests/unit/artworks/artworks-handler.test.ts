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
      time: '19/Mar/2026:00:00:00 +0000',
      timeEpoch: 1,
    },
    routeKey: '$default',
    stageVariables: undefined,
    version: '2.0',
    ...overrides,
  };
}

function createArtworksServiceStub(): ArtworksService {
  return {
    async getArtworkDetail(artworkId) {
      return {
        address: '경북 포항시',
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
        place_name_en: 'Space Walk',
        place_name_ko: '스페이스워크',
        production_year: 2024,
        size_text_en: null,
        size_text_ko: null,
        title_en: 'Space Walk',
        title_ko: '스페이스워크',
        zone_id: 1,
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
    async listArtworks(_input) {
      return {
        artworks: [
          {
            address: '경북 포항시 영일대',
            artist_name_en: 'Artist One',
            artist_name_ko: '작가 하나',
            id: 1,
            liked: false,
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
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          path: '/v1/artworks/12',
        },
      },
    }),
    {} as never,
    createArtworksServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body as string).data.id, 12);
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
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          path: '/v1/artworks/filters',
        },
      },
    }),
    {} as never,
    createArtworksServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body as string).data.zones[0].places[0].id, 1);
});
