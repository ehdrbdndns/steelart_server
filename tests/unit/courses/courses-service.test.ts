import assert from 'node:assert/strict';
import test from 'node:test';

import type { CoursesRepository } from '../../../src/domains/courses/repository.js';
import { createCoursesService } from '../../../src/domains/courses/service.js';
import { AppError } from '../../../src/shared/api/errors.js';

function createCoursesRepositoryStub(
  overrides: Partial<CoursesRepository> = {},
): CoursesRepository {
  return {
    async createCourse() {
      return 1;
    },
    async createCourseCheckin() {
      throw new Error('not used');
    },
    async createCourseLike() {
      throw new Error('not used');
    },
    async deleteCourseLike() {
      throw new Error('not used');
    },
    async findCourseCheckinTarget() {
      throw new Error('not used');
    },
    async findCourseDetail(courseId) {
      return {
        description_en: 'desc',
        description_ko: '설명',
        editable: false,
        id: courseId,
        is_official: true,
        items: [],
        liked: false,
        stampProgress: { checkedInCount: 0, totalCount: 0 },
        title_en: 'Course',
        title_ko: '코스',
      };
    },
    async findCourseStampProgress() {
      return { checkedInCount: 1, totalCount: 2 };
    },
    async findCourseExists() {
      return true;
    },
    async findCourseRecord(courseId) {
      return {
        created_by_user_id: 7,
        id: courseId,
        is_official: false,
      };
    },
    async listActiveArtworkIds(artworkIds) {
      return artworkIds;
    },
    async listArtworkCoordinates(artworkIds) {
      return artworkIds.map((artworkId, index) => ({
        artwork_id: artworkId,
        lat: 36.01 + index * 0.001,
        lng: 129.11 + index * 0.001,
      }));
    },
    async listFavoriteCourses() {
      throw new Error('not used');
    },
    async listMyCourses() {
      throw new Error('not used');
    },
    async listRecentCommunityCourses() {
      throw new Error('not used');
    },
    async listRecommendedCourses() {
      throw new Error('not used');
    },
    async softDeleteCourse() {
      throw new Error('not used');
    },
    async updateCourse() {
      throw new Error('not used');
    },
    ...overrides,
  };
}

test('courses service throws NOT_FOUND when liking a missing course', async () => {
  const service = createCoursesService({
    coursesRepository: createCoursesRepositoryStub({
      async findCourseExists() {
        return false;
      },
    }),
  });

  await assert.rejects(
    () => service.likeCourse(99, 7),
    (error: unknown) => error instanceof AppError && error.code === 'NOT_FOUND',
  );
});

test('courses service keeps unlike requests idempotent', async () => {
  const calls: Array<{ args: number[]; step: string }> = [];
  const service = createCoursesService({
    coursesRepository: createCoursesRepositoryStub({
      async deleteCourseLike(userId, courseId) {
        calls.push({
          args: [userId, courseId],
          step: 'delete',
        });
      },
      async findCourseExists(courseId) {
        calls.push({
          args: [courseId],
          step: 'exists',
        });
        return true;
      },
    }),
  });

  const result = await service.unlikeCourse(12, 3);

  assert.deepEqual(result, {
    courseId: 12,
    liked: false,
  });
  assert.deepEqual(calls, [
    {
      args: [12],
      step: 'exists',
    },
    {
      args: [3, 12],
      step: 'delete',
    },
  ]);
});

test('courses service rejects update for official course', async () => {
  const service = createCoursesService({
    coursesRepository: createCoursesRepositoryStub({
      async findCourseRecord(courseId) {
        return {
          created_by_user_id: 7,
          id: courseId,
          is_official: true,
        };
      },
    }),
  });

  await assert.rejects(
    () => service.updateCourse(12, {
      description_en: 'desc',
      description_ko: '설명',
      items: [{ artwork_id: 11, seq: 1 }],
      title_en: 'Course',
      title_ko: '코스',
    }, 7),
    (error: unknown) => error instanceof AppError && error.code === 'FORBIDDEN',
  );
});

test('courses service rejects update for non-owner', async () => {
  const service = createCoursesService({
    coursesRepository: createCoursesRepositoryStub({
      async findCourseRecord(courseId) {
        return {
          created_by_user_id: 99,
          id: courseId,
          is_official: false,
        };
      },
    }),
  });

  await assert.rejects(
    () => service.updateCourse(12, {
      description_en: 'desc',
      description_ko: '설명',
      items: [{ artwork_id: 11, seq: 1 }],
      title_en: 'Course',
      title_ko: '코스',
    }, 7),
    (error: unknown) => error instanceof AppError && error.code === 'FORBIDDEN',
  );
});

test('courses service rejects create when artwork is inactive', async () => {
  const service = createCoursesService({
    coursesRepository: createCoursesRepositoryStub({
      async listActiveArtworkIds() {
        return [11];
      },
    }),
  });

  await assert.rejects(
    () => service.createCourse({
      description_en: 'desc',
      description_ko: '설명',
      items: [
        { artwork_id: 11, seq: 1 },
        { artwork_id: 22, seq: 2 },
      ],
      title_en: 'Course',
      title_ko: '코스',
    }, 7),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );
});

test('courses service rejects check-in for unofficial course', async () => {
  const calls: string[] = [];
  const service = createCoursesService({
    coursesRepository: createCoursesRepositoryStub({
      async findCourseStampProgress() {
        calls.push('progress');
        return { checkedInCount: 1, totalCount: 2 };
      },
      async findCourseRecord(courseId) {
        return {
          created_by_user_id: 7,
          id: courseId,
          is_official: false,
        };
      },
    }),
  });

  await assert.rejects(
    () => service.checkInCourse(12, {
      course_item_id: 31,
      lat: 36.058,
      lng: 129.378,
    }, 7),
    (error: unknown) => error instanceof AppError && error.code === 'FORBIDDEN',
  );
  assert.deepEqual(calls, []);
});

test('courses service rejects duplicate check-in', async () => {
  const calls: string[] = [];
  const service = createCoursesService({
    coursesRepository: createCoursesRepositoryStub({
      async findCourseStampProgress() {
        calls.push('progress');
        return { checkedInCount: 1, totalCount: 2 };
      },
      async findCourseCheckinTarget() {
        return {
          alreadyCheckedIn: true,
          lat: 36.058,
          lng: 129.378,
        };
      },
      async findCourseRecord(courseId) {
        return {
          created_by_user_id: 7,
          id: courseId,
          is_official: true,
        };
      },
    }),
  });

  await assert.rejects(
    () => service.checkInCourse(12, {
      course_item_id: 31,
      lat: 36.058,
      lng: 129.378,
    }, 7),
    (error: unknown) => error instanceof AppError && error.code === 'CONFLICT',
  );
  assert.deepEqual(calls, []);
});

test('courses service rejects check-in outside the allowed radius', async () => {
  const calls: string[] = [];
  const service = createCoursesService({
    coursesRepository: createCoursesRepositoryStub({
      async findCourseStampProgress() {
        calls.push('progress');
        return { checkedInCount: 1, totalCount: 2 };
      },
      async findCourseCheckinTarget() {
        return {
          alreadyCheckedIn: false,
          lat: 36.058,
          lng: 129.378,
        };
      },
      async findCourseRecord(courseId) {
        return {
          created_by_user_id: 7,
          id: courseId,
          is_official: true,
        };
      },
    }),
  });

  await assert.rejects(
    () => service.checkInCourse(12, {
      course_item_id: 31,
      lat: 36.06,
      lng: 129.39,
    }, 7),
    (error: unknown) => error instanceof AppError && error.code === 'BAD_REQUEST',
  );
  assert.deepEqual(calls, []);
});

test('courses service returns check-in success inside the allowed radius', async () => {
  const calls: Array<{ args: number[]; step: string }> = [];
  const service = createCoursesService({
    coursesRepository: createCoursesRepositoryStub({
      async createCourseCheckin(userId, courseId, courseItemId) {
        calls.push({
          args: [userId, courseId, courseItemId],
          step: 'insert',
        });
      },
      async findCourseStampProgress(courseId, userId) {
        calls.push({
          args: [courseId, userId],
          step: 'progress',
        });
        return {
          checkedInCount: 2,
          totalCount: 2,
        };
      },
      async findCourseCheckinTarget() {
        return {
          alreadyCheckedIn: false,
          lat: 36.058,
          lng: 129.378,
        };
      },
      async findCourseRecord(courseId) {
        return {
          created_by_user_id: 7,
          id: courseId,
          is_official: true,
        };
      },
    }),
  });

  const result = await service.checkInCourse(12, {
    course_item_id: 31,
    lat: 36.05801,
    lng: 129.37801,
  }, 7);

  assert.deepEqual(result, {
    checkedIn: true,
    courseId: 12,
    courseItemId: 31,
    stampProgress: {
      checkedInCount: 2,
      totalCount: 2,
    },
  });
  assert.deepEqual(calls, [
    {
      args: [7, 12, 31],
      step: 'insert',
    },
    {
      args: [12, 7],
      step: 'progress',
    },
  ]);
});

test('courses service returns route vertexes for a valid course', async () => {
  let receivedCoordinates: Array<{ lat: number; lng: number }> = [];
  const service = createCoursesService({
    coursesRepository: createCoursesRepositoryStub(),
    courseRouteProvider: {
      async fetchRoute(coordinates) {
        receivedCoordinates = coordinates;
        return [
          { lat: 36.0, lng: 129.0 },
          { lat: 36.5, lng: 129.5 },
        ];
      },
    },
  });

  const result = await service.getCourseRoute({
    items: [
      { artwork_id: 11, seq: 1 },
      { artwork_id: 22, seq: 2 },
      { artwork_id: 33, seq: 3 },
    ],
  });

  assert.deepEqual(result, {
    vertexes: [
      { lat: 36.0, lng: 129.0 },
      { lat: 36.5, lng: 129.5 },
    ],
  });
  assert.equal(receivedCoordinates.length, 3);
});

test('courses service rejects a route with more than thirty items', async () => {
  const items = Array.from({ length: 31 }, (_unused, index) => ({
    artwork_id: index + 1,
    seq: index + 1,
  }));
  const service = createCoursesService({
    coursesRepository: createCoursesRepositoryStub(),
    courseRouteProvider: {
      async fetchRoute() {
        throw new Error('provider should not be called');
      },
    },
  });

  await assert.rejects(
    () => service.getCourseRoute({ items }),
    (error: unknown) =>
      error instanceof AppError && error.code === 'TOO_MANY_WAYPOINTS' && error.statusCode === 400,
  );
});

test('courses service rejects a route with non-contiguous seq as bad request', async () => {
  const service = createCoursesService({
    coursesRepository: createCoursesRepositoryStub(),
    courseRouteProvider: {
      async fetchRoute() {
        throw new Error('provider should not be called');
      },
    },
  });

  await assert.rejects(
    () => service.getCourseRoute({
      items: [
        { artwork_id: 11, seq: 1 },
        { artwork_id: 22, seq: 3 },
      ],
    }),
    (error: unknown) =>
      error instanceof AppError && error.code === 'BAD_REQUEST' && error.statusCode === 400,
  );
});

test('courses service returns 422 ROUTE_UNAVAILABLE when fewer than two coordinates resolve', async () => {
  let providerCalled = false;
  const service = createCoursesService({
    coursesRepository: createCoursesRepositoryStub({
      async listArtworkCoordinates(artworkIds) {
        return [{ artwork_id: artworkIds[0], lat: 36.0, lng: 129.0 }];
      },
    }),
    courseRouteProvider: {
      async fetchRoute() {
        providerCalled = true;
        return [];
      },
    },
  });

  await assert.rejects(
    () => service.getCourseRoute({
      items: [
        { artwork_id: 11, seq: 1 },
        { artwork_id: 22, seq: 2 },
      ],
    }),
    (error: unknown) =>
      error instanceof AppError && error.code === 'ROUTE_UNAVAILABLE' && error.statusCode === 422,
  );
  assert.equal(providerCalled, false);
});

test('courses service builds a partial route when some artworks lack coordinates', async () => {
  let receivedCoordinates: Array<{ lat: number; lng: number }> = [];
  const service = createCoursesService({
    coursesRepository: createCoursesRepositoryStub({
      async listArtworkCoordinates() {
        return [
          { artwork_id: 11, lat: 36.0, lng: 129.0 },
          { artwork_id: 33, lat: 36.2, lng: 129.2 },
        ];
      },
    }),
    courseRouteProvider: {
      async fetchRoute(coordinates) {
        receivedCoordinates = coordinates;
        return coordinates;
      },
    },
  });

  await service.getCourseRoute({
    items: [
      { artwork_id: 11, seq: 1 },
      { artwork_id: 22, seq: 2 },
      { artwork_id: 33, seq: 3 },
    ],
  });

  assert.deepEqual(receivedCoordinates, [
    { lat: 36.0, lng: 129.0 },
    { lat: 36.2, lng: 129.2 },
  ]);
});

test('courses service collapses consecutive identical coordinates before routing', async () => {
  let receivedCoordinates: Array<{ lat: number; lng: number }> = [];
  const service = createCoursesService({
    coursesRepository: createCoursesRepositoryStub({
      async listArtworkCoordinates() {
        return [
          { artwork_id: 11, lat: 36.0, lng: 129.0 },
          { artwork_id: 22, lat: 36.0, lng: 129.0 },
          { artwork_id: 33, lat: 36.2, lng: 129.2 },
        ];
      },
    }),
    courseRouteProvider: {
      async fetchRoute(coordinates) {
        receivedCoordinates = coordinates;
        return coordinates;
      },
    },
  });

  await service.getCourseRoute({
    items: [
      { artwork_id: 11, seq: 1 },
      { artwork_id: 22, seq: 2 },
      { artwork_id: 33, seq: 3 },
    ],
  });

  assert.deepEqual(receivedCoordinates, [
    { lat: 36.0, lng: 129.0 },
    { lat: 36.2, lng: 129.2 },
  ]);
});

test('courses service returns 422 when dedup leaves fewer than two coordinates', async () => {
  const service = createCoursesService({
    coursesRepository: createCoursesRepositoryStub({
      async listArtworkCoordinates() {
        return [
          { artwork_id: 11, lat: 36.0, lng: 129.0 },
          { artwork_id: 22, lat: 36.0, lng: 129.0 },
        ];
      },
    }),
    courseRouteProvider: {
      async fetchRoute() {
        throw new Error('provider should not be called');
      },
    },
  });

  await assert.rejects(
    () => service.getCourseRoute({
      items: [
        { artwork_id: 11, seq: 1 },
        { artwork_id: 22, seq: 2 },
      ],
    }),
    (error: unknown) =>
      error instanceof AppError && error.code === 'ROUTE_UNAVAILABLE' && error.statusCode === 422,
  );
});

test('courses service surfaces 502 ROUTE_UNAVAILABLE when the provider fails', async () => {
  const service = createCoursesService({
    coursesRepository: createCoursesRepositoryStub(),
    courseRouteProvider: {
      async fetchRoute() {
        throw new AppError('ROUTE_UNAVAILABLE', {
          message: 'upstream failed',
          statusCode: 502,
        });
      },
    },
  });

  await assert.rejects(
    () => service.getCourseRoute({
      items: [
        { artwork_id: 11, seq: 1 },
        { artwork_id: 22, seq: 2 },
      ],
    }),
    (error: unknown) =>
      error instanceof AppError && error.code === 'ROUTE_UNAVAILABLE' && error.statusCode === 502,
  );
});

test('courses service returns 502 ROUTE_UNAVAILABLE when no route provider is configured', async () => {
  const service = createCoursesService({
    coursesRepository: createCoursesRepositoryStub(),
  });

  await assert.rejects(
    () => service.getCourseRoute({
      items: [
        { artwork_id: 11, seq: 1 },
        { artwork_id: 22, seq: 2 },
      ],
    }),
    (error: unknown) =>
      error instanceof AppError && error.code === 'ROUTE_UNAVAILABLE' && error.statusCode === 502,
  );
});
