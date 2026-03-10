import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

import { AppError, toAppError } from '../../shared/api/errors.js';
import { createHttpRequest } from '../../shared/api/route.js';
import { fail } from '../../shared/api/response.js';
import { optionalAuth } from '../../shared/auth/guard.js';
import { getEnv } from '../../shared/env/server.js';
import { createLoggerFromRequest } from '../../shared/logger/logger.js';

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  const request = createHttpRequest(event, context);
  const logger = createLoggerFromRequest(event, context, {
    domain: 'auth',
  });

  try {
    const auth = optionalAuth(event, context);
    const env = getEnv();

    logger.info('Auth handler shared runtime placeholder invoked', {
      authenticated: Boolean(auth),
    });

    return fail(
      new AppError('NOT_IMPLEMENTED', {
        message: 'Auth handler shared runtime placeholder',
      }),
      {
        appEnv: env.APP_ENV,
        authenticated: Boolean(auth),
        method: request.method,
        path: request.path,
        requestId: request.requestId ?? null,
      },
    );
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
