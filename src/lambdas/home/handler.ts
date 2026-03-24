import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';

import { AppError, serializeErrorForLog, toAppError } from '../../shared/api/errors.js';
import { createHomeService, type HomeService } from '../../domains/home/service.js';
import { homeArtworksQuerySchema } from '../../domains/home/schemas.js';
import { homeRepository } from '../../domains/home/repository.js';
import { artworksRepository } from '../../domains/artworks/repository.js';
import { createHttpRequest } from '../../shared/api/route.js';
import { fail, ok } from '../../shared/api/response.js';
import { requireAuth } from '../../shared/auth/guard.js';
import { createLoggerFromRequest } from '../../shared/logger/logger.js';
import { parseInput } from '../../shared/validation/parse.js';

const homeService = createHomeService({
  artworksRepository,
  homeRepository,
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

export async function handleHomeRequest(
  event: APIGatewayProxyEventV2,
  context: Context,
  service: HomeService = homeService,
): Promise<APIGatewayProxyStructuredResultV2> {
  const request = createHttpRequest(event, context);
  const logger = createLoggerFromRequest(event, context, {
    domain: 'home',
  });

  try {
    const auth = requireAuth(event, context);

    if (request.path === '/v1/home') {
      assertMethod(request.method, ['GET']);
      const result = await service.getHome(auth.userId);

      return ok(result, {
        requestId: request.requestId ?? null,
      });
    }

    if (request.path === '/v1/home/artworks') {
      assertMethod(request.method, ['GET']);
      const input = parseInput({
        schema: homeArtworksQuerySchema,
        input: {
          zoneId: request.getQuery('zoneId'),
        },
        message: 'Home artworks query is invalid',
      });
      const result = await service.getHomeArtworks(auth.userId, input);

      return ok(result, {
        requestId: request.requestId ?? null,
      });
    }

    if (request.path === '/v1/home/recommended-courses') {
      assertMethod(request.method, ['GET']);
      const result = await service.getRecommendedCourses(auth.userId);

      return ok(result, {
        requestId: request.requestId ?? null,
      });
    }

    throw new AppError('NOT_FOUND', {
      message: 'Home route not found',
    });
  } catch (error) {
    const appError = toAppError(error);

    logger.error('Home handler failed', {
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
  handleHomeRequest(event, context, homeService);
