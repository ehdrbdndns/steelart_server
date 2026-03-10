import type {
  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventV2,
  Context,
} from 'aws-lambda';

import { AppError } from '../api/errors.js';
import { getHeader, getRequestId } from '../api/route.js';

export interface AuthContext {
  requestId?: string;
  scheme: 'Bearer';
  token: string;
}

export function getBearerToken(
  headers: APIGatewayProxyEventHeaders | Record<string, string | undefined> | undefined,
): string | null {
  const authorization = getHeader(headers, 'authorization');

  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return null;
  }

  const token = match[1]?.trim();
  return token && token.length > 0 ? token : null;
}

export function requireAuth(event: APIGatewayProxyEventV2, context?: Context): AuthContext {
  const token = getBearerToken(event.headers);

  if (!token) {
    throw new AppError('UNAUTHORIZED', {
      message: 'Authorization bearer token is required',
    });
  }

  return {
    requestId: getRequestId(event, context),
    scheme: 'Bearer',
    token,
  };
}

export function optionalAuth(event: APIGatewayProxyEventV2, context?: Context): AuthContext | null {
  const token = getBearerToken(event.headers);

  if (!token) {
    return null;
  }

  return {
    requestId: getRequestId(event, context),
    scheme: 'Bearer',
    token,
  };
}
