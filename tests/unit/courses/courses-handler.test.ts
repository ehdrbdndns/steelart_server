import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

import type { CoursesService } from '../../../src/domains/courses/service.js';
import { handleCoursesRequest } from '../../../src/lambdas/courses/handler.js';
import { signAccessToken } from '../../../src/shared/auth/token.js';
import { resetEnvForTests } from '../../../src/shared/env/server.js';

function createRequestContext(
  path = '/v1/courses/recommended',
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
    rawPath: '/v1/courses/recommended',
    rawQueryString: '',
    requestContext: createRequestContext(),
    routeKey: 'GET /v1/courses/recommended',
    stageVariables: undefined,
    version: '2.0',
    ...overrides,
  };
}

function createCoursesServiceStub(overrides: Partial<CoursesService> = {}): CoursesService {
  return {
    async checkInCourse(courseId, input) {
      return {
        checkedIn: true,
        courseId,
        courseItemId: input.course_item_id,
        stampProgress: {
          checkedInCount: 2,
          totalCount: 5,
        },
      };
    },
    async createCourse() {
      return {
        description_en: 'desc',
        description_ko: '설명',
        editable: true,
        id: 12,
        is_official: false,
        items: [],
        liked: false,
        stampProgress: null,
        title_en: 'Course',
        title_ko: '코스',
      };
    },
    async deleteCourse(courseId) {
      return {
        courseId,
        deleted: true,
      };
    },
    async getCourseDetail(courseId) {
      return {
        description_en: 'desc',
        description_ko: '설명',
        editable: true,
        id: courseId,
        is_official: false,
        items: [
          {
            artwork_id: 11,
            artist_name_en: 'Artist',
            artist_name_ko: '작가',
            checkedIn: false,
            id: 31,
            lat: 36.058,
            lng: 129.378,
            place_name_en: 'Yeongildae',
            place_name_ko: '영일대',
            seq: 1,
            thumbnail_image_height: 800,
            thumbnail_image_url: 'https://example.com/item.jpg',
            thumbnail_image_width: 1200,
            title_en: 'Space Walk',
            title_ko: '스페이스워크',
          },
        ],
        liked: true,
        stampProgress: null,
        title_en: 'Course',
        title_ko: '코스',
      };
    },
    async getCourseRoute() {
      return {
        vertexes: [
          { lat: 36.01, lng: 129.11 },
          { lat: 36.02, lng: 129.12 },
        ],
      };
    },
    async likeCourse(courseId) {
      return {
        courseId,
        liked: true,
      };
    },
    async listMyCourses(_input) {
      return {
        courses: [
          {
            description_en: 'My route',
            description_ko: '내 코스',
            end_place_name_en: 'Space Walk',
            end_place_name_ko: '스페이스워크',
            creator_nickname: 'course-owner',
            id: 2,
            is_official: false,
            liked: false,
            stampProgress: null,
            start_place_name_en: 'Yeongildae',
            start_place_name_ko: '영일대',
            thumbnail_image_height: 800,
            thumbnail_image_url: 'https://example.com/my-course.jpg',
            thumbnail_image_width: 1200,
            title_en: 'My Course',
            title_ko: '내 코스',
          },
        ],
        page: 1,
        size: 20,
        total: 1,
      };
    },
    async listFavoriteCourses() {
      return {
        communityCourses: [
          {
            description_en: 'My route',
            description_ko: '내 코스',
            end_place_name_en: 'Space Walk',
            end_place_name_ko: '스페이스워크',
            creator_nickname: 'course-owner',
            id: 2,
            is_official: false,
            liked: true,
            stampProgress: null,
            start_place_name_en: 'Yeongildae',
            start_place_name_ko: '영일대',
            thumbnail_image_height: 800,
            thumbnail_image_url: 'https://example.com/my-course.jpg',
            thumbnail_image_width: 1200,
            title_en: 'My Course',
            title_ko: '내 코스',
          },
        ],
        officialCourses: [],
      };
    },
    async listRecommendedCourses(_input) {
      return {
        courses: [
          {
            description_en: 'Seaside route',
            description_ko: '바닷길 코스',
            end_place_name_en: 'Space Walk',
            end_place_name_ko: '스페이스워크',
            creator_nickname: null,
            id: 1,
            is_official: true,
            liked: true,
            stampProgress: {
              checkedInCount: 1,
              totalCount: 2,
            },
            start_place_name_en: 'Yeongildae',
            start_place_name_ko: '영일대',
            thumbnail_image_height: 800,
            thumbnail_image_url: 'https://example.com/course.jpg',
            thumbnail_image_width: 1200,
            title_en: 'Seaside Course',
            title_ko: '바닷길 코스',
          },
        ],
        page: 1,
        size: 20,
        total: 1,
      };
    },
    async listRecentCommunityCourses(_input) {
      return {
        courses: [
          {
            description_en: 'Community route',
            description_ko: '시민 코스',
            end_place_name_en: 'Space Walk',
            end_place_name_ko: '스페이스워크',
            creator_nickname: 'community-owner',
            id: 3,
            is_official: false,
            liked: false,
            stampProgress: null,
            start_place_name_en: 'Yeongildae',
            start_place_name_ko: '영일대',
            thumbnail_image_height: 800,
            thumbnail_image_url: 'https://example.com/community-course.jpg',
            thumbnail_image_width: 1200,
            title_en: 'Community Course',
            title_ko: '시민 코스',
          },
        ],
        page: 1,
        size: 10,
        total: 1,
      };
    },
    async unlikeCourse(courseId) {
      return {
        courseId,
        liked: false,
      };
    },
    async updateCourse(courseId) {
      return {
        description_en: 'updated',
        description_ko: '수정',
        editable: true,
        id: courseId,
        is_official: false,
        items: [],
        liked: false,
        stampProgress: null,
        title_en: 'Updated Course',
        title_ko: '수정 코스',
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

test('courses handler returns recommended list response for GET /v1/courses/recommended', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, { secret: 'test-secret' });

  const response = await handleCoursesRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawQueryString: 'page=1&size=20',
    }),
    {} as never,
    createCoursesServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body as string);
  assert.equal(body.data.courses[0].liked, true);
  assert.equal(body.data.courses[0].creator_nickname, null);
  assert.deepEqual(body.data.courses[0].stampProgress, {
    checkedInCount: 1,
    totalCount: 2,
  });
  assert.equal('stamped' in body.data.courses[0], false);
});

test('courses handler returns my list response for GET /v1/courses/mine', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, { secret: 'test-secret' });

  const response = await handleCoursesRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/courses/mine',
      requestContext: createRequestContext('/v1/courses/mine'),
      routeKey: 'GET /v1/courses/mine',
    }),
    {} as never,
    createCoursesServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body as string);
  assert.equal(body.data.courses[0].is_official, false);
  assert.equal(body.data.courses[0].creator_nickname, 'course-owner');
  assert.equal(body.data.courses[0].stampProgress, null);
  assert.equal('stamped' in body.data.courses[0], false);
});

test('courses handler returns detail response for GET /v1/courses/{courseId}', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, { secret: 'test-secret' });

  const response = await handleCoursesRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/courses/12',
      pathParameters: {
        courseId: '12',
      },
      requestContext: createRequestContext('/v1/courses/12', 'GET', '/v1/courses/{courseId}'),
      routeKey: 'GET /v1/courses/{courseId}',
    }),
    {} as never,
    createCoursesServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body as string);
  assert.equal(body.data.id, 12);
  assert.equal(body.data.stampProgress, null);
  assert.equal('stamped' in body.data, false);
});

test('courses handler returns detail response for POST /v1/courses', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, { secret: 'test-secret' });

  const response = await handleCoursesRequest(
    createEvent({
      body: JSON.stringify({
        description_en: 'Seaside route',
        description_ko: '바닷길 코스',
        items: [{ artwork_id: 11, seq: 1 }],
        title_en: 'Seaside Course',
        title_ko: '바닷길 코스',
      }),
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/courses',
      requestContext: createRequestContext('/v1/courses', 'POST'),
      routeKey: 'POST /v1/courses',
    }),
    {} as never,
    createCoursesServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body as string).data.id, 12);
});

test('courses handler returns updated detail for PATCH /v1/courses/{courseId}', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, { secret: 'test-secret' });

  const response = await handleCoursesRequest(
    createEvent({
      body: JSON.stringify({
        description_en: 'Updated route',
        description_ko: '수정 코스',
        items: [{ artwork_id: 11, seq: 1 }],
        title_en: 'Updated Course',
        title_ko: '수정 코스',
      }),
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/courses/12',
      pathParameters: {
        courseId: '12',
      },
      requestContext: createRequestContext('/v1/courses/12', 'PATCH', '/v1/courses/{courseId}'),
      routeKey: 'PATCH /v1/courses/{courseId}',
    }),
    {} as never,
    createCoursesServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body as string).data.title_ko, '수정 코스');
});

test('courses handler returns liked=true for POST /v1/courses/{courseId}/like', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, { secret: 'test-secret' });

  const response = await handleCoursesRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/courses/12/like',
      pathParameters: {
        courseId: '12',
      },
      requestContext: createRequestContext('/v1/courses/12/like', 'POST', '/v1/courses/{courseId}/like'),
      routeKey: 'POST /v1/courses/{courseId}/like',
    }),
    {} as never,
    createCoursesServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body as string).data, {
    courseId: 12,
    liked: true,
  });
});

test('courses handler returns liked=false for DELETE /v1/courses/{courseId}/like', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, { secret: 'test-secret' });

  const response = await handleCoursesRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/courses/12/like',
      pathParameters: {
        courseId: '12',
      },
      requestContext: createRequestContext('/v1/courses/12/like', 'DELETE', '/v1/courses/{courseId}/like'),
      routeKey: 'DELETE /v1/courses/{courseId}/like',
    }),
    {} as never,
    createCoursesServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body as string).data, {
    courseId: 12,
    liked: false,
  });
});

test('courses handler returns check-in response for POST /v1/courses/{courseId}/checkins', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, { secret: 'test-secret' });

  const response = await handleCoursesRequest(
    createEvent({
      body: JSON.stringify({
        course_item_id: 31,
        lat: 36.058,
        lng: 129.378,
      }),
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/courses/12/checkins',
      pathParameters: {
        courseId: '12',
      },
      requestContext: createRequestContext('/v1/courses/12/checkins', 'POST', '/v1/courses/{courseId}/checkins'),
      routeKey: 'POST /v1/courses/{courseId}/checkins',
    }),
    {} as never,
    createCoursesServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body as string).data, {
    checkedIn: true,
    courseId: 12,
    courseItemId: 31,
    stampProgress: {
      checkedInCount: 2,
      totalCount: 5,
    },
  });
});

test('courses handler returns route vertexes for POST /v1/courses/route', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, { secret: 'test-secret' });

  const response = await handleCoursesRequest(
    createEvent({
      body: JSON.stringify({
        items: [
          { artwork_id: 11, seq: 1 },
          { artwork_id: 22, seq: 2 },
        ],
      }),
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/courses/route',
      requestContext: createRequestContext('/v1/courses/route', 'POST'),
      routeKey: 'POST /v1/courses/route',
    }),
    {} as never,
    createCoursesServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body as string);
  assert.equal(body.error, null);
  assert.deepEqual(body.data.vertexes, [
    { lat: 36.01, lng: 129.11 },
    { lat: 36.02, lng: 129.12 },
  ]);
});

test('courses handler rejects POST /v1/courses/route with fewer than two items', async () => {
  applyServerTestEnv();
  const token = signAccessToken(1, { secret: 'test-secret' });

  const response = await handleCoursesRequest(
    createEvent({
      body: JSON.stringify({
        items: [{ artwork_id: 11, seq: 1 }],
      }),
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/courses/route',
      requestContext: createRequestContext('/v1/courses/route', 'POST'),
      routeKey: 'POST /v1/courses/route',
    }),
    {} as never,
    createCoursesServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 400);
  assert.equal(JSON.parse(response.body as string).error.code, 'BAD_REQUEST');
});

test('courses handler returns UNAUTHORIZED without bearer token', async () => {
  applyServerTestEnv();

  const response = await handleCoursesRequest(
    createEvent(),
    {} as never,
    createCoursesServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 401);
  assert.equal(JSON.parse(response.body as string).error.code, 'UNAUTHORIZED');
});
