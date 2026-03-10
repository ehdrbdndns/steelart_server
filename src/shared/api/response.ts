import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { serializeAppError, toAppError } from './errors.js';

export type ApiMeta = Record<string, unknown> | null;

export interface ApiErrorEnvelope {
  data: null;
  error: ReturnType<typeof serializeAppError>;
  meta: ApiMeta;
}

export interface ApiSuccessEnvelope<TData> {
  data: TData;
  error: null;
  meta: ApiMeta;
}

export interface ResponseInit {
  headers?: Record<string, string>;
  statusCode?: number;
}

const DEFAULT_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};

function jsonResponse(
  statusCode: number,
  payload: ApiErrorEnvelope | ApiSuccessEnvelope<unknown>,
  init: ResponseInit = {},
): APIGatewayProxyStructuredResultV2 {
  return {
    body: JSON.stringify(payload),
    headers: {
      ...DEFAULT_HEADERS,
      ...init.headers,
    },
    statusCode,
  };
}

export function ok<TData>(
  data: TData,
  meta: ApiMeta = null,
  init: ResponseInit = {},
): APIGatewayProxyStructuredResultV2 {
  return jsonResponse(init.statusCode ?? 200, {
    data,
    error: null,
    meta,
  }, init);
}

export function fail(
  error: unknown,
  meta: ApiMeta = null,
  init: ResponseInit = {},
): APIGatewayProxyStructuredResultV2 {
  const appError = toAppError(error);

  return jsonResponse(init.statusCode ?? appError.statusCode, {
    data: null,
    error: serializeAppError(appError),
    meta,
  }, init);
}
