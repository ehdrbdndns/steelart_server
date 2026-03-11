import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

import { AppError } from '../../shared/api/errors.js';
import { createHttpRequest } from '../../shared/api/route.js';
import { fail } from '../../shared/api/response.js';
import { createLoggerFromRequest } from '../../shared/logger/logger.js';

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  const request = createHttpRequest(event, context);
  const logger = createLoggerFromRequest(event, context, {
    domain: 'home',
  });

  logger.info('Home handler SAM placeholder invoked');

  return fail(
    new AppError('NOT_IMPLEMENTED', {
      message: 'Home handler SAM placeholder',
    }),
    {
      method: request.method,
      path: request.path,
      requestId: request.requestId ?? null,
    },
  );
};
