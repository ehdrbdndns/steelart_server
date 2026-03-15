import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';

import { AppError, toAppError } from '../../shared/api/errors.js';
import { createHttpRequest } from '../../shared/api/route.js';
import { fail, ok } from '../../shared/api/response.js';
import { requireAuth } from '../../shared/auth/guard.js';
import { createLoggerFromRequest } from '../../shared/logger/logger.js';
import { parseInput } from '../../shared/validation/parse.js';
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

export async function handleUsersRequest(
  event: APIGatewayProxyEventV2,
  context: Context,
  service: UsersService = usersService,
): Promise<APIGatewayProxyStructuredResultV2> {
  const request = createHttpRequest(event, context);
  const logger = createLoggerFromRequest(event, context, {
    domain: 'users',
  });

  try {
    const auth = requireAuth(event, context);

    if (request.path === '/v1/users/me/onboarding') {
      assertMethod(request.method, ['PATCH']);
      const input = parseInput({
        input: request.parseJsonBody(),
        message: 'Onboarding payload is invalid',
        schema: onboardingUpdateSchema,
      });
      const result = await service.updateOnboarding(auth.userId, input);

      return ok(result, {
        requestId: request.requestId ?? null,
      });
    }

    if (request.path === '/v1/users/me') {
      assertMethod(request.method, ['GET', 'PATCH']);

      if (request.method === 'GET') {
        return ok(await service.getProfile(auth.userId), {
          requestId: request.requestId ?? null,
        });
      }

      if (request.method === 'PATCH') {
        const input = parseInput({
          input: request.parseJsonBody(),
          message: 'Profile payload is invalid',
          schema: profileUpdateSchema,
        });
        const result = await service.updateProfile(auth.userId, input);

        return ok(result, {
          requestId: request.requestId ?? null,
        });
      }
    }

    if (request.path === '/v1/me/notifications') {
      assertMethod(request.method, ['PATCH']);
      const input = parseInput({
        input: request.parseJsonBody(),
        message: 'Notifications payload is invalid',
        schema: notificationsUpdateSchema,
      });
      const result = await service.updateNotifications(auth.userId, input);

      return ok(result, {
        requestId: request.requestId ?? null,
      });
    }

    if (request.path === '/v1/me/language') {
      assertMethod(request.method, ['PATCH']);
      const input = parseInput({
        input: request.parseJsonBody(),
        message: 'Language payload is invalid',
        schema: languageUpdateSchema,
      });
      const result = await service.updateLanguage(auth.userId, input);

      return ok(result, {
        requestId: request.requestId ?? null,
      });
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
}

export const handler: APIGatewayProxyHandlerV2 = async (event, context) =>
  handleUsersRequest(event, context, usersService);
