export const APP_ERROR_CODES = [
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'VALIDATION_ERROR',
  'CONFLICT',
  'INTERNAL_ERROR',
  'NOT_IMPLEMENTED',
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

const APP_ERROR_STATUS_CODES: Record<AppErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  VALIDATION_ERROR: 422,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  NOT_IMPLEMENTED: 501,
};

const APP_ERROR_MESSAGES: Record<AppErrorCode, string> = {
  BAD_REQUEST: 'Bad request',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Not found',
  METHOD_NOT_ALLOWED: 'Method not allowed',
  VALIDATION_ERROR: 'Validation failed',
  CONFLICT: 'Conflict',
  INTERNAL_ERROR: 'Internal server error',
  NOT_IMPLEMENTED: 'Not implemented',
};

export interface AppErrorOptions {
  cause?: unknown;
  details?: unknown;
  message?: string;
  statusCode?: number;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: unknown;
  readonly statusCode: number;

  constructor(code: AppErrorCode, options: AppErrorOptions = {}) {
    super(options.message ?? APP_ERROR_MESSAGES[code], { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.statusCode = options.statusCode ?? APP_ERROR_STATUS_CODES[code];
    this.details = options.details;
  }
}

export interface SerializedAppError {
  code: AppErrorCode;
  details?: unknown;
  message: string;
}

export function getAppErrorStatusCode(code: AppErrorCode): number {
  return APP_ERROR_STATUS_CODES[code];
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError('INTERNAL_ERROR', {
      cause: error,
      message: error.message || APP_ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }

  return new AppError('INTERNAL_ERROR', {
    cause: error,
    message: APP_ERROR_MESSAGES.INTERNAL_ERROR,
  });
}

export function serializeAppError(error: unknown): SerializedAppError {
  const appError = toAppError(error);

  return {
    code: appError.code,
    message: appError.message,
    ...(appError.details === undefined ? {} : { details: appError.details }),
  };
}
