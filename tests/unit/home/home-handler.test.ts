import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

import type { HomeService } from '../../../src/domains/home/service.js';
import { handleHomeRequest } from '../../../src/lambdas/home/handler.js';
import { resetEnvForTests } from '../../../src/shared/env/server.js';
import { signAccessToken } from '../../../src/shared/auth/token.js';

function createEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    body: undefined,
    cookies: [],
    headers: {},
    isBase64Encoded: false,
    pathParameters: undefined,
    queryStringParameters: undefined,
    rawPath: '/v1/home',
    rawQueryString: '',
    requestContext: {
      accountId: 'account-id',
      apiId: 'api-id',
      domainName: 'example.com',
      domainPrefix: 'example',
      http: {
        method: 'GET',
        path: '/v1/home',
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

function createHomeServiceStub(): HomeService {
  return {
    async getHome() {
      return {
        artworks: [
          {
            artist_name_en: 'Artist One',
            artist_name_ko: '작가 하나',
            id: 10,
            lat: 36.01,
            liked: true,
            lng: 129.37,
            place_name_en: 'Yeongildae',
            place_name_ko: '영일대',
            thumbnail_image_url: 'https://example.com/artwork.jpg',
            title_en: 'Morning Steel',
            title_ko: '아침의 철',
            zone_id: 2,
          },
        ],
        banners: [
          {
            banner_image_url: 'https://example.com/banner.jpg',
            display_order: 1,
            id: 1,
          },
        ],
        selectedZoneId: 2,
        zones: [
          {
            code: 'YEONGIL',
            id: 2,
            name_en: 'Yeongil',
            name_ko: '영일',
            sort_order: 1,
          },
        ],
      };
    },
    async getHomeArtworks(_userId, input) {
      return {
        artworks: [],
        zoneId: input.zoneId,
      };
    },
    async getRecommendedCourses() {
      return {
        courses: [
          {
            description_en: 'Official walk',
            description_ko: '공식 산책 코스',
            id: 99,
            is_official: true,
            stamped: true,
            thumbnail_image_height: 800,
            thumbnail_image_url: 'https://example.com/course.jpg',
            thumbnail_image_width: 1200,
            title_en: 'Yeongildae Walk',
            title_ko: '영일대 산책 코스',
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

// 홈 aggregate API는 배너, 존, 선택된 존, 작품 목록을 함께 반환해야 한다.
test('home handler returns aggregate payload for GET /v1/home', async () => {
  applyServerTestEnv();
  const token = signAccessToken(7, {
    secret: 'test-secret',
  });

  const response = await handleHomeRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
    }),
    {} as never,
    createHomeServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body as string), {
    data: {
      artworks: [
        {
          artist_name_en: 'Artist One',
          artist_name_ko: '작가 하나',
          id: 10,
          lat: 36.01,
          liked: true,
          lng: 129.37,
          place_name_en: 'Yeongildae',
          place_name_ko: '영일대',
          thumbnail_image_url: 'https://example.com/artwork.jpg',
          title_en: 'Morning Steel',
          title_ko: '아침의 철',
          zone_id: 2,
        },
      ],
      banners: [
        {
          banner_image_url: 'https://example.com/banner.jpg',
          display_order: 1,
          id: 1,
        },
      ],
      selectedZoneId: 2,
      zones: [
        {
          code: 'YEONGIL',
          id: 2,
          name_en: 'Yeongil',
          name_ko: '영일',
          sort_order: 1,
        },
      ],
    },
    error: null,
    meta: {
      requestId: 'request-id',
    },
  });
});

// 홈 존 전환 API는 zoneId query를 읽어 해당 존의 작품 응답을 반환해야 한다.
test('home handler returns zone artworks for GET /v1/home/artworks', async () => {
  applyServerTestEnv();
  const token = signAccessToken(7, {
    secret: 'test-secret',
  });

  const response = await handleHomeRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/home/artworks',
      rawQueryString: 'zoneId=3',
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          path: '/v1/home/artworks',
        },
      },
    }),
    {} as never,
    createHomeServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body as string), {
    data: {
      artworks: [],
      zoneId: 3,
    },
    error: null,
    meta: {
      requestId: 'request-id',
    },
  });
});

// 홈 추천 코스 API는 썸네일 크기 필드를 포함한 코스 카드 응답을 반환해야 한다.
test('home handler returns recommended courses for GET /v1/home/recommended-courses', async () => {
  applyServerTestEnv();
  const token = signAccessToken(7, {
    secret: 'test-secret',
  });

  const response = await handleHomeRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/home/recommended-courses',
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          path: '/v1/home/recommended-courses',
        },
      },
    }),
    {} as never,
    createHomeServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body as string), {
    data: {
      courses: [
        {
          description_en: 'Official walk',
          description_ko: '공식 산책 코스',
          id: 99,
          is_official: true,
          stamped: true,
          thumbnail_image_height: 800,
          thumbnail_image_url: 'https://example.com/course.jpg',
          thumbnail_image_width: 1200,
          title_en: 'Yeongildae Walk',
          title_ko: '영일대 산책 코스',
        },
      ],
    },
    error: null,
    meta: {
      requestId: 'request-id',
    },
  });
});
