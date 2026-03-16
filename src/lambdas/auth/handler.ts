import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';

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
import { authRepository } from '../../domains/auth/repository.js';
import { usersRepository } from '../../domains/users/repository.js';
import { createHttpRequest } from '../../shared/api/route.js';
import { fail, ok } from '../../shared/api/response.js';
import { requireAuth } from '../../shared/auth/guard.js';
import { createAppleAuthProvider } from '../../shared/auth/providers/apple.js';
import { createKakaoAuthProvider } from '../../shared/auth/providers/kakao.js';
import { createLoggerFromRequest } from '../../shared/logger/logger.js';
import { parseInput } from '../../shared/validation/parse.js';

const authService = createAuthService({
  appleProvider: createAppleAuthProvider(),
  authRepository,
  kakaoProvider: createKakaoAuthProvider(),
  usersRepository,
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

export async function handleAuthRequest(
  event: APIGatewayProxyEventV2,
  context: Context,
  service: AuthService = authService,
): Promise<APIGatewayProxyStructuredResultV2> {
  const request = createHttpRequest(event, context);
  const logger = createLoggerFromRequest(event, context, {
    domain: 'auth',
  });

  try {
    if (request.path === '/v1/auth/kakao') {
      assertMethod(request.method, ['POST']);
      const input = parseInput({
        schema: kakaoLoginSchema,
        input: request.parseJsonBody(),
        message: 'Kakao login payload is invalid',
      });
      const result = await service.loginWithKakao(input);

      return ok(result, {
        requestId: request.requestId ?? null,
      });
    }

    if (request.path === '/v1/auth/apple') {
      assertMethod(request.method, ['POST']);
      const input = parseInput({
        schema: appleLoginSchema,
        input: request.parseJsonBody(),
        message: 'Apple login payload is invalid',
      });
      const result = await service.loginWithApple(input);

      return ok(result, {
        requestId: request.requestId ?? null,
      });
    }

    if (request.path === '/v1/auth/refresh') {
      assertMethod(request.method, ['POST']);
      const input = parseInput({
        schema: refreshTokenSchema,
        input: request.parseJsonBody(),
        message: 'Refresh payload is invalid',
      });
      const result = await service.refreshAccessToken(input.refreshToken);

      return ok(mapRefreshResponse(result.token), {
        requestId: request.requestId ?? null,
      });
    }

    if (request.path === '/v1/auth/me') {
      assertMethod(request.method, ['GET']);
      const auth = requireAuth(event, context);
      const result = await service.getSession(auth.userId);

      return ok(result, {
        requestId: request.requestId ?? null,
      });
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
}

export const handler: APIGatewayProxyHandlerV2 = async (event, context) =>
  handleAuthRequest(event, context, authService);
