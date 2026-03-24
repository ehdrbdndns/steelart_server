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
import { artworksListQuerySchema, artworkIdParamSchema } from '../../domains/artworks/schemas.js';
import { createArtworksService, type ArtworksService } from '../../domains/artworks/service.js';
import { artworksRepository } from '../../domains/artworks/repository.js';

const artworksService = createArtworksService({
  artworksRepository,
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

export async function handleArtworksRequest(
  event: APIGatewayProxyEventV2,
  context: Context,
  service: ArtworksService = artworksService,
): Promise<APIGatewayProxyStructuredResultV2> {
  const request = createHttpRequest(event, context);
  const logger = createLoggerFromRequest(event, context, {
    domain: 'artworks',
  });

  try {
    const auth = requireAuth(event, context);

    if (request.path === '/v1/artworks') {
      assertMethod(request.method, ['GET']);
      const input = parseInput({
        schema: artworksListQuerySchema,
        input: {
          artistType: request.getQueryList('artistType'),
          festivalYear: request.getQueryList('festivalYear'),
          page: request.getQuery('page'),
          placeId: request.getQueryList('placeId'),
          size: request.getQuery('size'),
          sort: request.getQuery('sort'),
        },
        message: 'Artworks query is invalid',
      });
      const result = await service.listArtworks({
        artistTypes: input.artistType,
        festivalYears: input.festivalYear,
        page: input.page,
        placeIds: input.placeId,
        size: input.size,
        sort: input.sort,
      }, auth.userId);

      return ok(result, {
        requestId: request.requestId ?? null,
      });
    }

    if (request.path === '/v1/artworks/filters') {
      assertMethod(request.method, ['GET']);
      const result = await service.getArtworkFilters();

      return ok(result, {
        requestId: request.requestId ?? null,
      });
    }

    if (request.segments.length === 3 && request.segments[0] === 'v1' && request.segments[1] === 'artworks') {
      assertMethod(request.method, ['GET']);
      const input = parseInput({
        schema: artworkIdParamSchema,
        input: {
          artworkId: request.segments[2],
        },
        message: 'Artwork id is invalid',
      });
      const result = await service.getArtworkDetail(input.artworkId, auth.userId);

      return ok(result, {
        requestId: request.requestId ?? null,
      });
    }

    throw new AppError('NOT_FOUND', {
      message: 'Artworks route not found',
    });
  } catch (error) {
    const appError = toAppError(error);

    logger.error('Artworks handler failed', {
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
  handleArtworksRequest(event, context, artworksService);
