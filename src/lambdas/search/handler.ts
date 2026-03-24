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
import {
  searchArtworksQuerySchema,
  searchAutocompleteQuerySchema,
} from '../../domains/search/schemas.js';
import { createSearchService, type SearchService } from '../../domains/search/service.js';
import { createSearchRepository } from '../../domains/search/repository.js';

const searchService = createSearchService({
  searchRepository: createSearchRepository(),
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

export async function handleSearchRequest(
  event: APIGatewayProxyEventV2,
  context: Context,
  service: SearchService = searchService,
): Promise<APIGatewayProxyStructuredResultV2> {
  const request = createHttpRequest(event, context);
  const logger = createLoggerFromRequest(event, context, {
    domain: 'search',
  });

  try {
    const auth = requireAuth(event, context);

    if (request.path === '/v1/search/autocomplete') {
      assertMethod(request.method, ['GET']);
      const input = parseInput({
        schema: searchAutocompleteQuerySchema,
        input: {
          lang: request.getQuery('lang'),
          q: request.getQuery('q'),
          size: request.getQuery('size'),
        },
        message: 'Search autocomplete query is invalid',
      });
      const result = await service.autocomplete(auth.userId, input);

      return ok(result, {
        requestId: request.requestId ?? null,
      });
    }

    if (request.path === '/v1/search/artworks') {
      assertMethod(request.method, ['GET']);
      const input = parseInput({
        schema: searchArtworksQuerySchema,
        input: {
          page: request.getQuery('page'),
          q: request.getQuery('q'),
          size: request.getQuery('size'),
          sort: request.getQuery('sort'),
        },
        message: 'Search query is invalid',
      });
      const result = await service.searchArtworks(auth.userId, input);

      return ok(result, {
        requestId: request.requestId ?? null,
      });
    }

    throw new AppError('NOT_FOUND', {
      message: 'Search route not found',
    });
  } catch (error) {
    const appError = toAppError(error);

    logger.error('Search handler failed', {
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
  handleSearchRequest(event, context, searchService);
