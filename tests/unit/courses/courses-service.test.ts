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
