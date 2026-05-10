import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';

import { AppError, serializeErrorForLog, toAppError } from '../../shared/api/errors.js';
import { createHttpRequest } from '../../shared/api/route.js';
import { fail, ok, preflight } from '../../shared/api/response.js';
import { requireAuth } from '../../shared/auth/guard.js';
import { createLoggerFromRequest } from '../../shared/logger/logger.js';
import { parseInput } from '../../shared/validation/parse.js';
import {
  courseCheckinBodySchema,
  courseIdParamSchema,
  courseListQuerySchema,
  createCourseBodySchema,
  updateCourseBodySchema,
} from '../../domains/courses/schemas.js';
import { createCoursesService, type CoursesService } from '../../domains/courses/service.js';
import { coursesRepository } from '../../domains/courses/repository.js';

const coursesService = createCoursesService({
  coursesRepository,
});

function assertMethod(actualMethod: string, allowedMethods: string[]): void {
  if (!allowedMethods.includes(actualMethod)) {
    throw new AppError('METHOD_NOT_ALLOWED', {
      details: {
        allowedMethods,
        method: actualMethod,
      },
      message: `Method ${actualMethod} is not allowed`,
    });
  }
}

export async function handleCoursesRequest(
  event: APIGatewayProxyEventV2,
  context: Context,
  service: CoursesService = coursesService,
): Promise<APIGatewayProxyStructuredResultV2> {
  const request = createHttpRequest(event, context);
  const logger = createLoggerFromRequest(event, context, {
    domain: 'courses',
  });

  if (request.method === 'OPTIONS') {
    return preflight();
  }

  try {
    const auth = requireAuth(event, context);

    // 홈/코스 탭에서 공식 코스 카드 목록을 페이지네이션으로 내려주는 추천 코스 조회 API.
    if (request.path === '/v1/courses/recommended') {
      assertMethod(request.method, ['GET']);
      const input = parseInput({
        schema: courseListQuerySchema,
        input: {
          page: request.getQuery('page'),
          size: request.getQuery('size'),
        },
        message: 'Course list query is invalid',
      });
      const result = await service.listRecommendedCourses(input, auth.userId);

      return ok(result, {
        requestId: request.requestId ?? null,
      });
    }

    // 사용자가 직접 만든 코스 카드 목록을 무한 스크롤에 맞춰 내려주는 내 코스 조회 API.
    if (request.path === '/v1/courses/mine') {
      assertMethod(request.method, ['GET']);
      const input = parseInput({
        schema: courseListQuerySchema,
        input: {
          page: request.getQuery('page'),
          size: request.getQuery('size'),
        },
        message: 'Course list query is invalid',
      });
      const result = await service.listMyCourses(input, auth.userId);

      return ok(result, {
        requestId: request.requestId ?? null,
      });
    }

    // 코스 작성 화면에서 새 사용자 코스를 저장할 때 호출하는 코스 생성 API.
    if (request.path === '/v1/courses') {
      assertMethod(request.method, ['POST']);
      const input = parseInput({
        schema: createCourseBodySchema,
        input: request.parseJsonBody(),
        message: 'Course payload is invalid',
      });
      const result = await service.createCourse(input, auth.userId);

      return ok(result, {
        requestId: request.requestId ?? null,
      });
    }

    // 코스 카드/상세에서 좋아요 상태를 명시적으로 추가하거나 취소하는 코스 좋아요 API.
    if (request.routePath === '/v1/courses/{courseId}/like') {
      assertMethod(request.method, ['POST', 'DELETE']);
      const input = parseInput({
        schema: courseIdParamSchema,
        input: {
          courseId: request.pathParams.courseId,
        },
        message: 'Course id is invalid',
      });

      const result = request.method === 'POST'
        ? await service.likeCourse(input.courseId, auth.userId)
        : await service.unlikeCourse(input.courseId, auth.userId);

      return ok(result, {
        requestId: request.requestId ?? null,
      });
    }

    // 공식 코스 진행 중 특정 코스 아이템 방문을 기록하고 최신 스탬프 진행률을 반환하는 체크인 API.
    if (request.routePath === '/v1/courses/{courseId}/checkins') {
      assertMethod(request.method, ['POST']);
      const params = parseInput({
        schema: courseIdParamSchema,
        input: {
          courseId: request.pathParams.courseId,
        },
        message: 'Course id is invalid',
      });
      const input = parseInput({
        schema: courseCheckinBodySchema,
        input: request.parseJsonBody(),
        message: 'Course check-in payload is invalid',
      });
      const result = await service.checkInCourse(params.courseId, input, auth.userId);

      return ok(result, {
        requestId: request.requestId ?? null,
      });
    }

    // 코스 상세 조회와 사용자 코스 수정이 같은 상세 경로를 공유하는 코스 상세 API.
    if (request.routePath === '/v1/courses/{courseId}') {
      const params = parseInput({
        schema: courseIdParamSchema,
        input: {
          courseId: request.pathParams.courseId,
        },
        message: 'Course id is invalid',
      });

      // 코스 상세 화면에서 메타 정보와 아이템 목록, checkedIn 상태를 내려주는 상세 조회 API.
      if (request.method === 'GET') {
        const result = await service.getCourseDetail(params.courseId, auth.userId);

        return ok(result, {
          requestId: request.requestId ?? null,
        });
      }

      // 사용자가 직접 만든 코스의 제목/설명/아이템 순서를 다시 저장하는 코스 수정 API.
      if (request.method === 'PATCH') {
        const input = parseInput({
          schema: updateCourseBodySchema,
          input: request.parseJsonBody(),
          message: 'Course payload is invalid',
        });
        const result = await service.updateCourse(params.courseId, input, auth.userId);

        return ok(result, {
          requestId: request.requestId ?? null,
        });
      }

      assertMethod(request.method, ['GET', 'PATCH']);
    }

    throw new AppError('NOT_FOUND', {
      message: 'Courses route not found',
    });
  } catch (error) {
    const appError = toAppError(error);

    logger.error('Courses handler failed', {
      appMessage: appError.message,
      code: appError.code,
      details: appError.details ?? null,
      error: serializeErrorForLog(error),
      statusCode: appError.statusCode,
    });

    return fail(appError, {
      method: request.method,
      path: request.path,
      requestId: request.requestId ?? null,
    });
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event, context) =>
  handleCoursesRequest(event, context, coursesService);
