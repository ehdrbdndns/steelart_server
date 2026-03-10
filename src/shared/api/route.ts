import type {
  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventV2,
  Context,
} from 'aws-lambda';

import { AppError } from './errors.js';

export interface HttpRequest {
  getHeader(name: string): string | undefined;
  getQuery(name: string): string | undefined;
  getQueryList(name: string): string[];
  headers: Record<string, string>;
  method: string;
  parseJsonBody<TValue>(): TValue | undefined;
  path: string;
  query: URLSearchParams;
  requestId?: string;
  segments: string[];
}

export function normalizeHeaders(
  headers: APIGatewayProxyEventHeaders | Record<string, string | undefined> | undefined,
): Record<string, string> {
  const normalized: Record<string, string> = {};

  if (!headers) {
    return normalized;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string' && value.length > 0) {
      normalized[key.toLowerCase()] = value;
    }
  }

  return normalized;
}

export function getHeader(
  headers: APIGatewayProxyEventHeaders | Record<string, string | undefined> | undefined,
  name: string,
): string | undefined {
  return normalizeHeaders(headers)[name.toLowerCase()];
}

export function getMethod(event: APIGatewayProxyEventV2): string {
  return event.requestContext.http.method.toUpperCase();
}

export function getPath(event: APIGatewayProxyEventV2): string {
  return event.rawPath;
}

export function getPathSegments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

export function getRequestId(event: APIGatewayProxyEventV2, context?: Context): string | undefined {
  return event.requestContext.requestId ?? context?.awsRequestId;
}

export function getQueryParams(event: APIGatewayProxyEventV2): URLSearchParams {
  if (event.rawQueryString.length > 0) {
    return new URLSearchParams(event.rawQueryString);
  }

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(event.queryStringParameters ?? {})) {
    if (typeof value === 'string' && value.length > 0) {
      params.set(key, value);
    }
  }

  return params;
}

export function getQuery(event: APIGatewayProxyEventV2, key: string): string | undefined {
  const values = getQueryList(event, key);
  return values[0];
}

export function getQueryList(event: APIGatewayProxyEventV2, key: string): string[] {
  const params = getQueryParams(event);
  const values = params.getAll(key);

  return values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function parseJsonBody<TValue>(event: APIGatewayProxyEventV2): TValue | undefined {
  if (!event.body) {
    return undefined;
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  try {
    return JSON.parse(rawBody) as TValue;
  } catch (error) {
    throw new AppError('BAD_REQUEST', {
      cause: error,
      message: 'Request body must be valid JSON',
    });
  }
}

export function assertAllowedMethod(
  event: APIGatewayProxyEventV2,
  allowedMethods: string[],
): string {
  const method = getMethod(event);

  if (!allowedMethods.includes(method)) {
    throw new AppError('METHOD_NOT_ALLOWED', {
      details: {
        allowedMethods,
        method,
      },
      message: `Method ${method} is not allowed`,
    });
  }

  return method;
}

export function createHttpRequest(event: APIGatewayProxyEventV2, context?: Context): HttpRequest {
  const headers = normalizeHeaders(event.headers);
  const method = getMethod(event);
  const path = getPath(event);
  const query = getQueryParams(event);

  return {
    getHeader(name) {
      return headers[name.toLowerCase()];
    },
    getQuery(name) {
      return getQuery(event, name);
    },
    getQueryList(name) {
      return getQueryList(event, name);
    },
    headers,
    method,
    parseJsonBody<TValue>() {
      return parseJsonBody<TValue>(event);
    },
    path,
    query,
    requestId: getRequestId(event, context),
    segments: getPathSegments(path),
  };
}
