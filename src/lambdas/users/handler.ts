import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

import { AppError, toAppError } from '../../shared/api/errors.js';
import { createHttpRequest } from '../../shared/api/route.js';
import { fail, ok } from '../../shared/api/response.js';
import { requireAuth } from '../../shared/auth/guard.js';
import { createLoggerFromRequest } from '../../shared/logger/logger.js';
import { parseOrThrow } from '../../shared/validation/parse.js';
import {
  languageUpdateSchema,
  notificationsUpdateSchema,
  onboardingUpdateSchema,
  profileUpdateSchema,
} from '../../domains/users/schemas.js';
import {
  createUsersService,
  type UsersService,
} from '../../domains/users/service.js';
import { mysqlUsersRepository } from '../../domains/users/repository.js';

const usersService = createUsersService({
  usersRepository: mysqlUsersRepository,
});

function getMeta(requestId?: string) {
  return {
    requestId: requestId ?? null,
  };
}

function assertMethod(actualMethod: string, allowedMethod: string): void {
  if (actualMethod !== allowedMethod) {
    throw new AppError('METHOD_NOT_ALLOWED', {
      details: {
        allowedMethods: [allowedMethod],
        method: actualMethod,
      },
      message: `Method ${actualMethod} is not allowed`,
    });
  }
}

export function createUsersHandler(service: UsersService = usersService): APIGatewayProxyHandlerV2 {
  return async (event, context) => {
    const request = createHttpRequest(event, context);
    const logger = createLoggerFromRequest(event, context, {
      domain: 'users',
    });

    try {
      const auth = requireAuth(event, context);

      if (request.path === '/v1/users/me/onboarding') {
        assertMethod(request.method, 'PATCH');
        const input = parseOrThrow(onboardingUpdateSchema, request.parseJsonBody(), {
          message: 'Onboarding payload is invalid',
        });
        const result = await service.updateOnboarding(auth.userId, input);

        return ok(result, getMeta(request.requestId));
      }

      if (request.path === '/v1/users/me') {
        if (request.method === 'GET') {
          return ok(await service.getProfile(auth.userId), getMeta(request.requestId));
        }

        if (request.method === 'PATCH') {
          const input = parseOrThrow(profileUpdateSchema, request.parseJsonBody(), {
            message: 'Profile payload is invalid',
          });
          const result = await service.updateProfile(auth.userId, input);

          return ok(result, getMeta(request.requestId));
        }

        throw new AppError('METHOD_NOT_ALLOWED', {
          details: {
            allowedMethods: ['GET', 'PATCH'],
            method: request.method,
          },
          message: `Method ${request.method} is not allowed`,
        });
      }

      if (request.path === '/v1/me/notifications') {
        assertMethod(request.method, 'PATCH');
        const input = parseOrThrow(notificationsUpdateSchema, request.parseJsonBody(), {
          message: 'Notifications payload is invalid',
        });
        const result = await service.updateNotifications(auth.userId, input);

        return ok(result, getMeta(request.requestId));
      }

      if (request.path === '/v1/me/language') {
        assertMethod(request.method, 'PATCH');
        const input = parseOrThrow(languageUpdateSchema, request.parseJsonBody(), {
          message: 'Language payload is invalid',
        });
        const result = await service.updateLanguage(auth.userId, input);

        return ok(result, getMeta(request.requestId));
      }

      throw new AppError('NOT_FOUND', {
        message: 'Users route not found',
      });
    } catch (error) {
      const appError = toAppError(error);

      logger.error('Users handler failed', {
        code: appError.code,
        statusCode: appError.statusCode,
      });

      return fail(appError, {
        method: request.method,
        path: request.path,
        requestId: request.requestId ?? null,
      });
    }
  };
}

export const handler = createUsersHandler();
