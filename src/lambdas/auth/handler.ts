import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

import { AppError, toAppError } from '../../shared/api/errors.js';
import { mapRefreshResponse } from '../../domains/auth/mapper.js';
import {
  appleLoginSchema,
  kakaoLoginSchema,
  refreshTokenSchema,
} from '../../domains/auth/schemas.js';
import {
  createAuthService,
  type AuthService,
} from '../../domains/auth/service.js';
import { mysqlAuthRepository } from '../../domains/auth/repository.js';
import { mysqlUsersRepository } from '../../domains/users/repository.js';
import { createHttpRequest } from '../../shared/api/route.js';
import { fail, ok } from '../../shared/api/response.js';
import { requireAuth } from '../../shared/auth/guard.js';
import { createAppleAuthProvider } from '../../shared/auth/providers/apple.js';
import { createKakaoAuthProvider } from '../../shared/auth/providers/kakao.js';
import { createLoggerFromRequest } from '../../shared/logger/logger.js';
import { parseOrThrow } from '../../shared/validation/parse.js';

const authService = createAuthService({
  appleProvider: createAppleAuthProvider(),
  authRepository: mysqlAuthRepository,
  kakaoProvider: createKakaoAuthProvider(),
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

export function createAuthHandler(service: AuthService = authService): APIGatewayProxyHandlerV2 {
  return async (event, context) => {
    const request = createHttpRequest(event, context);
    const logger = createLoggerFromRequest(event, context, {
      domain: 'auth',
    });

    try {
      if (request.path === '/v1/auth/kakao') {
        assertMethod(request.method, 'POST');
        const input = parseOrThrow(kakaoLoginSchema, request.parseJsonBody(), {
          message: 'Kakao login payload is invalid',
        });
        const result = await service.loginWithKakao(input);

        return ok(result, getMeta(request.requestId));
      }

      if (request.path === '/v1/auth/apple') {
        assertMethod(request.method, 'POST');
        const input = parseOrThrow(appleLoginSchema, request.parseJsonBody(), {
          message: 'Apple login payload is invalid',
        });
        const result = await service.loginWithApple(input);

        return ok(result, getMeta(request.requestId));
      }

      if (request.path === '/v1/auth/refresh') {
        assertMethod(request.method, 'POST');
        const input = parseOrThrow(refreshTokenSchema, request.parseJsonBody(), {
          message: 'Refresh payload is invalid',
        });
        const result = await service.refreshAccessToken(input.refreshToken);

        return ok(mapRefreshResponse(result.token), getMeta(request.requestId));
      }

      if (request.path === '/v1/auth/me') {
        assertMethod(request.method, 'GET');
        const auth = requireAuth(event, context);
        const result = await service.getSession(auth.userId);

        return ok(result, getMeta(request.requestId));
      }

      throw new AppError('NOT_FOUND', {
        message: 'Auth route not found',
      });
    } catch (error) {
      const appError = toAppError(error);

      logger.error('Auth handler failed', {
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

export const handler = createAuthHandler();
