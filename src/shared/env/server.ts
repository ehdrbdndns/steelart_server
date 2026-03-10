import { z } from 'zod';

import { parseOrThrow } from '../validation/parse.js';

const serverEnvSchema = z.object({
  APP_ENV: z.string().min(1, 'APP_ENV is required'),
  APPLE_CLIENT_ID: z.string().min(1, 'APPLE_CLIENT_ID is required').optional(),
  AWS_REGION: z.string().min(1, 'AWS_REGION is required'),
  DB_HOST: z.string().min(1, 'DB_HOST is required'),
  DB_NAME: z.string().min(1, 'DB_NAME is required'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
  DB_PORT: z.coerce.number().int().positive(),
  DB_SSL_CA_PATH: z.string().min(1).optional(),
  DB_USER: z.string().min(1, 'DB_USER is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  KAKAO_CLIENT_ID: z.string().min(1, 'KAKAO_CLIENT_ID is required').optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type ServerEnv = z.output<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  return parseOrThrow(serverEnvSchema, source, {
    message: 'Server environment variables are invalid',
  });
}

export function getEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  if (source !== process.env) {
    return loadEnv(source);
  }

  cachedEnv ??= loadEnv(source);
  return cachedEnv;
}

export function resetEnvForTests(): void {
  cachedEnv = null;
}
