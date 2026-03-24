import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';

import { AppError, serializeErrorForLog, toAppError } from '../../shared/api/errors.js';
import { createHttpRequest } from '../../shared/api/route.js';
import { fail, ok } from '../../shared/api/response.js';
import { requireAuth } from '../../shared/auth/guard.js';
import { createLoggerFromRequest } from '../../shared/logger/logger.js';
import { parseInput } from '../../shared/validation/parse.js';
import { mapArtworksQuerySchema } from '../../domains/map/schemas.js';
import { createMapService, type MapService } from '../../domains/map/service.js';
import { createMapRepository } from '../../domains/map/repository.js';

const mapService = createMapService({
  mapRepository: createMapRepository(),
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

export async function handleMapRequest(
  event: APIGatewayProxyEventV2,
  context: Context,
  service: MapService = mapService,
): Promise<APIGatewayProxyStructuredResultV2> {
  const request = createHttpRequest(event, context);
  const logger = createLoggerFromRequest(event, context, {
    domain: 'map',
  });

  try {
    const auth = requireAuth(event, context);

    if (request.path === '/v1/map/artworks') {
      assertMethod(request.method, ['GET']);
      const input = parseInput({
        schema: mapArtworksQuerySchema,
        input: {
          lat: request.getQuery('lat'),
          lng: request.getQuery('lng'),
          radiusMeters: request.getQuery('radiusMeters'),
        },
        code: 'BAD_REQUEST',
        message: 'Map query is invalid',
      });
      const result = await service.getMapArtworks(auth.userId, input);

      return ok(result, {
        requestId: request.requestId ?? null,
      });
    }

    throw new AppError('NOT_FOUND', {
      message: 'Map route not found',
    });
  } catch (error) {
    const appError = toAppError(error);

    logger.error('Map handler failed', {
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
  handleMapRequest(event, context, mapService);
