import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';

import { getRequestId } from '../api/route.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerContext {
  domain?: string;
  method?: string;
  path?: string;
  requestId?: string;
}

export interface Logger {
  debug(message: string, extra?: Record<string, unknown>): void;
  error(message: string, extra?: Record<string, unknown>): void;
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function getCurrentLogLevel(): LogLevel {
  const rawValue = process.env.LOG_LEVEL?.toLowerCase();

  if (rawValue === 'debug' || rawValue === 'info' || rawValue === 'warn' || rawValue === 'error') {
    return rawValue;
  }

  return 'info';
}

function shouldLog(level: LogLevel, currentLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLevel];
}

function log(level: LogLevel, context: LoggerContext, message: string, extra?: Record<string, unknown>): void {
  const payload = {
    ...context,
    extra: extra ?? null,
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function createLogger(context: LoggerContext): Logger {
  const currentLevel = getCurrentLogLevel();

  return {
    debug(message, extra) {
      if (shouldLog('debug', currentLevel)) {
        log('debug', context, message, extra);
      }
    },
    error(message, extra) {
      if (shouldLog('error', currentLevel)) {
        log('error', context, message, extra);
      }
    },
    info(message, extra) {
      if (shouldLog('info', currentLevel)) {
        log('info', context, message, extra);
      }
    },
    warn(message, extra) {
      if (shouldLog('warn', currentLevel)) {
        log('warn', context, message, extra);
      }
    },
  };
}

export function createLoggerFromRequest(
  event: APIGatewayProxyEventV2,
  context?: Context,
  extraContext: Omit<LoggerContext, 'method' | 'path' | 'requestId'> = {},
): Logger {
  return createLogger({
    ...extraContext,
    method: event.requestContext.http.method,
    path: event.rawPath,
    requestId: getRequestId(event, context),
  });
}
