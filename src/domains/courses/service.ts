import { AppError, type AppErrorCode } from '../../shared/api/errors.js';
import { isWithinRadiusMeters } from '../../shared/geo/distance.js';
import {
  CHECKIN_ALLOWED_RADIUS_METERS,
  COURSE_ROUTE_MAX_WAYPOINTS,
  COURSE_ROUTE_MIN_ITEMS,
  type ArtworkCoordinate,
  type CourseCheckinInput,
  type CourseCheckinResponse,
  type CourseRouteInput,
  type CourseRouteProvider,
  type CourseRouteResponse,
  type DeleteCourseResponse,
  type FavoriteCoursesResponse,
  type CourseDetail,
  type CourseLikeResponse,
  type CourseListInput,
  type CourseListResponse,
  type CreateCourseInput,
  type RecentCommunityCourseListInput,
  type RouteVertex,
  type UpdateCourseInput,
} from './types.js';
import {
  mapCourseCheckinResponse,
  mapCourseDetail,
  mapCourseLikeResponse,
  mapCourseListResponse,
  mapCourseRouteResponse,
  mapDeleteCourseResponse,
  mapFavoriteCoursesResponse,
} from './mapper.js';
import type { CoursesRepository } from './repository.js';

export interface CoursesService {
  checkInCourse(courseId: number, input: CourseCheckinInput, userId: number): Promise<CourseCheckinResponse>;
  createCourse(input: CreateCourseInput, userId: number): Promise<CourseDetail>;
  deleteCourse(courseId: number, userId: number): Promise<DeleteCourseResponse>;
  getCourseDetail(courseId: number, userId: number): Promise<CourseDetail>;
  getCourseRoute(input: CourseRouteInput): Promise<CourseRouteResponse>;
  likeCourse(courseId: number, userId: number): Promise<CourseLikeResponse>;
  listFavoriteCourses(userId: number): Promise<FavoriteCoursesResponse>;
  listMyCourses(input: CourseListInput, userId: number): Promise<CourseListResponse>;
  listRecentCommunityCourses(input: RecentCommunityCourseListInput, userId: number): Promise<CourseListResponse>;
  listRecommendedCourses(input: CourseListInput, userId: number): Promise<CourseListResponse>;
  unlikeCourse(courseId: number, userId: number): Promise<CourseLikeResponse>;
  updateCourse(courseId: number, input: UpdateCourseInput, userId: number): Promise<CourseDetail>;
}

export interface CoursesServiceDependencies {
  coursesRepository: CoursesRepository;
  courseRouteProvider?: CourseRouteProvider;
}

function assertContiguousItems(
  items: Array<{ artwork_id: number; seq: number }>,
  code: AppErrorCode = 'VALIDATION_ERROR',
): void {
  const artworkIds = new Set<number>();
  const orderedSeq = [...items].map((item) => item.seq).sort((left, right) => left - right);

  for (const item of items) {
    if (artworkIds.has(item.artwork_id)) {
      throw new AppError(code, {
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
      throw new AppError(code, {
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

  async function assertCourseDeletable(courseId: number, userId: number): Promise<void> {
    const course = await dependencies.coursesRepository.findCourseRecord(courseId);

    if (!course) {
      throw new AppError('NOT_FOUND', {
        message: 'Course not found',
      });
    }

    if (course.is_official) {
      throw new AppError('FORBIDDEN', {
        message: 'Official course cannot be deleted',
      });
    }

    if (course.created_by_user_id !== userId) {
      throw new AppError('FORBIDDEN', {
        message: 'You can only delete your own course',
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

    async deleteCourse(courseId, userId) {
      await assertCourseDeletable(courseId, userId);
      await dependencies.coursesRepository.softDeleteCourse(courseId);

      return mapDeleteCourseResponse(courseId);
    },

    async getCourseDetail(courseId, userId) {
      return loadCourseDetail(courseId, userId);
    },

    async getCourseRoute(input) {
      const provider = dependencies.courseRouteProvider;

      if (!provider) {
        throw new AppError('ROUTE_UNAVAILABLE', {
          message: 'Route provider is not configured',
          statusCode: 502,
        });
      }

      if (input.items.length > COURSE_ROUTE_MAX_WAYPOINTS) {
        throw new AppError('TOO_MANY_WAYPOINTS', {
          details: {
            maxWaypoints: COURSE_ROUTE_MAX_WAYPOINTS,
            received: input.items.length,
          },
          message: 'Too many waypoints',
        });
      }

      assertContiguousItems(input.items, 'BAD_REQUEST');

      const orderedArtworkIds = [...input.items]
        .sort((left, right) => left.seq - right.seq)
        .map((item) => item.artwork_id);
      const coordinates = await dependencies.coursesRepository.listArtworkCoordinates(orderedArtworkIds);
      const coordinateByArtworkId = new Map<number, ArtworkCoordinate>(
        coordinates.map((coordinate) => [coordinate.artwork_id, coordinate]),
      );

      // 좌표가 없는(활성 place가 조인되지 않는) 작품은 조용히 제외한다.
      const orderedCoordinates: RouteVertex[] = orderedArtworkIds
        .map((artworkId) => coordinateByArtworkId.get(artworkId))
        .filter((coordinate): coordinate is ArtworkCoordinate => Boolean(coordinate))
        .map((coordinate) => ({
          lat: coordinate.lat,
          lng: coordinate.lng,
        }));

      // 같은 장소(동일 좌표)가 연속되면 1개로 압축한다(불필요한 카카오 실패 예방).
      const dedupedCoordinates = orderedCoordinates.filter((coordinate, index) => {
        if (index === 0) {
          return true;
        }

        const previous = orderedCoordinates[index - 1];
        return coordinate.lat !== previous.lat || coordinate.lng !== previous.lng;
      });

      if (dedupedCoordinates.length < COURSE_ROUTE_MIN_ITEMS) {
        throw new AppError('ROUTE_UNAVAILABLE', {
          details: {
            validCoordinateCount: dedupedCoordinates.length,
          },
          message: 'Not enough valid coordinates to build a route',
          statusCode: 422,
        });
      }

      const vertexes = await provider.fetchRoute(dedupedCoordinates);

      return mapCourseRouteResponse(vertexes);
    },

    async likeCourse(courseId, userId) {
      await assertCourseExists(courseId);
      await dependencies.coursesRepository.createCourseLike(userId, courseId);

      return mapCourseLikeResponse(courseId, true);
    },

    async listFavoriteCourses(userId) {
      const result = await dependencies.coursesRepository.listFavoriteCourses(userId);
      return mapFavoriteCoursesResponse(result.officialCourses, result.communityCourses);
    },

    async listMyCourses(input, userId) {
      const result = await dependencies.coursesRepository.listMyCourses(input, userId);
      return mapCourseListResponse(result.courses, input.page, input.size, result.total);
    },

    async listRecentCommunityCourses(input, userId) {
      const result = await dependencies.coursesRepository.listRecentCommunityCourses(input, userId);
      return mapCourseListResponse(result.courses, 1, input.size, result.total);
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
