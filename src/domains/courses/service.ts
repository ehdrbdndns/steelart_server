import { AppError } from '../../shared/api/errors.js';
import { isWithinRadiusMeters } from '../../shared/geo/distance.js';
import {
  CHECKIN_ALLOWED_RADIUS_METERS,
  type CourseCheckinInput,
  type CourseCheckinResponse,
  type CourseDetail,
  type CourseLikeResponse,
  type CourseListInput,
  type CourseListResponse,
  type CreateCourseInput,
  type UpdateCourseInput,
} from './types.js';
import {
  mapCourseCheckinResponse,
  mapCourseDetail,
  mapCourseLikeResponse,
  mapCourseListResponse,
} from './mapper.js';
import type { CoursesRepository } from './repository.js';

export interface CoursesService {
  checkInCourse(courseId: number, input: CourseCheckinInput, userId: number): Promise<CourseCheckinResponse>;
  createCourse(input: CreateCourseInput, userId: number): Promise<CourseDetail>;
  getCourseDetail(courseId: number, userId: number): Promise<CourseDetail>;
  likeCourse(courseId: number, userId: number): Promise<CourseLikeResponse>;
  listMyCourses(input: CourseListInput, userId: number): Promise<CourseListResponse>;
  listRecommendedCourses(input: CourseListInput, userId: number): Promise<CourseListResponse>;
  unlikeCourse(courseId: number, userId: number): Promise<CourseLikeResponse>;
  updateCourse(courseId: number, input: UpdateCourseInput, userId: number): Promise<CourseDetail>;
}

export interface CoursesServiceDependencies {
  coursesRepository: CoursesRepository;
}

function assertContiguousItems(
  items: Array<{ artwork_id: number; seq: number }>,
): void {
  const artworkIds = new Set<number>();
  const orderedSeq = [...items].map((item) => item.seq).sort((left, right) => left - right);

  for (const item of items) {
    if (artworkIds.has(item.artwork_id)) {
      throw new AppError('VALIDATION_ERROR', {
        details: {
          items,
        },
        message: 'Artwork ids must be unique within a course',
      });
    }

    artworkIds.add(item.artwork_id);
  }

  for (let index = 0; index < orderedSeq.length; index += 1) {
    if (orderedSeq[index] !== index + 1) {
      throw new AppError('VALIDATION_ERROR', {
        details: {
          items,
        },
        message: 'Items seq must start at 1 and remain contiguous',
      });
    }
  }
}

export function createCoursesService(
  dependencies: CoursesServiceDependencies,
): CoursesService {
  async function assertCourseExists(courseId: number) {
    const exists = await dependencies.coursesRepository.findCourseExists(courseId);

    if (!exists) {
      throw new AppError('NOT_FOUND', {
        message: 'Course not found',
      });
    }
  }

  async function assertActiveArtworksExist(artworkIds: number[]): Promise<void> {
    const ids = [...new Set(artworkIds)];

    if (ids.length === 0) {
      return;
    }

    const activeIds = await dependencies.coursesRepository.listActiveArtworkIds(ids);
    const activeIdSet = new Set(activeIds);
    const missingIds = ids.filter((artworkId) => !activeIdSet.has(artworkId));

    if (missingIds.length > 0) {
      throw new AppError('VALIDATION_ERROR', {
        details: {
          artworkIds: missingIds,
        },
        message: 'All artworks must exist and remain active',
      });
    }
  }

  async function loadCourseDetail(courseId: number, userId: number): Promise<CourseDetail> {
    const detail = await dependencies.coursesRepository.findCourseDetail(courseId, userId);

    if (!detail) {
      throw new AppError('NOT_FOUND', {
        message: 'Course not found',
      });
    }

    return mapCourseDetail(detail);
  }

  async function assertCourseEditable(courseId: number, userId: number): Promise<void> {
    const course = await dependencies.coursesRepository.findCourseRecord(courseId);

    if (!course) {
      throw new AppError('NOT_FOUND', {
        message: 'Course not found',
      });
    }

    if (course.is_official) {
      throw new AppError('FORBIDDEN', {
        message: 'Official course cannot be updated',
      });
    }

    if (course.created_by_user_id !== userId) {
      throw new AppError('FORBIDDEN', {
        message: 'You can only update your own course',
      });
    }
  }

  return {
    async checkInCourse(courseId, input, userId) {
      const course = await dependencies.coursesRepository.findCourseRecord(courseId);

      if (!course) {
        throw new AppError('NOT_FOUND', {
          message: 'Course not found',
        });
      }

      if (!course.is_official) {
        throw new AppError('FORBIDDEN', {
          message: 'Check-in is only allowed for official courses',
        });
      }

      const target = await dependencies.coursesRepository.findCourseCheckinTarget(
        courseId,
        input.course_item_id,
        userId,
      );

      if (!target) {
        throw new AppError('NOT_FOUND', {
          message: 'Course item not found',
        });
      }

      if (target.alreadyCheckedIn) {
        throw new AppError('CONFLICT', {
          message: 'Course item already checked in',
        });
      }

      const withinAllowedRadius = isWithinRadiusMeters(
        {
          lat: input.lat,
          lng: input.lng,
        },
        {
          lat: target.lat,
          lng: target.lng,
        },
        CHECKIN_ALLOWED_RADIUS_METERS,
      );

      if (!withinAllowedRadius) {
        throw new AppError('BAD_REQUEST', {
          details: {
            allowedRadiusMeters: CHECKIN_ALLOWED_RADIUS_METERS,
            courseItemId: input.course_item_id,
            targetLat: target.lat,
            targetLng: target.lng,
          },
          message: 'Current location is outside the allowed check-in radius',
        });
      }

      await dependencies.coursesRepository.createCourseCheckin(userId, courseId, input.course_item_id);
      const stampProgress = await dependencies.coursesRepository.findCourseStampProgress(courseId, userId);

      return mapCourseCheckinResponse(courseId, input.course_item_id, stampProgress);
    },

    async createCourse(input, userId) {
      assertContiguousItems(input.items);
      await assertActiveArtworksExist(input.items.map((item) => item.artwork_id));
      const courseId = await dependencies.coursesRepository.createCourse(userId, input);
      return loadCourseDetail(courseId, userId);
    },

    async getCourseDetail(courseId, userId) {
      return loadCourseDetail(courseId, userId);
    },

    async likeCourse(courseId, userId) {
      await assertCourseExists(courseId);
      await dependencies.coursesRepository.createCourseLike(userId, courseId);

      return mapCourseLikeResponse(courseId, true);
    },

    async listMyCourses(input, userId) {
      const result = await dependencies.coursesRepository.listMyCourses(input, userId);
      return mapCourseListResponse(result.courses, input.page, input.size, result.total);
    },

    async listRecommendedCourses(input, userId) {
      const result = await dependencies.coursesRepository.listRecommendedCourses(input, userId);
      return mapCourseListResponse(result.courses, input.page, input.size, result.total);
    },

    async unlikeCourse(courseId, userId) {
      await assertCourseExists(courseId);
      await dependencies.coursesRepository.deleteCourseLike(userId, courseId);

      return mapCourseLikeResponse(courseId, false);
    },

    async updateCourse(courseId, input, userId) {
      await assertCourseEditable(courseId, userId);
      assertContiguousItems(input.items);
      await assertActiveArtworksExist(input.items.map((item) => item.artwork_id));
      await dependencies.coursesRepository.updateCourse(courseId, input);
      return loadCourseDetail(courseId, userId);
    },
  };
}
