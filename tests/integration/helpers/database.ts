import type { RowDataPacket } from 'mysql2/promise';

import { closePool, getPool } from '../../../src/shared/db/pool.js';
import { resetEnvForTests } from '../../../src/shared/env/server.js';

interface IntegrationDatabaseConfig {
  awsRegion: string;
  database: string;
  host: string;
  jwtSecret: string;
  password: string;
  port: string;
  sslCaPath?: string;
  user: string;
}

const REQUIRED_ENV_KEYS = [
  'INTEGRATION_DB_HOST',
  'INTEGRATION_DB_NAME',
  'INTEGRATION_DB_USER',
  'INTEGRATION_DB_PASSWORD',
] as const;

export function getIntegrationSkipReason(): string | undefined {
  const missingKeys = REQUIRED_ENV_KEYS.filter((key) => !process.env[key]?.trim());

  if (missingKeys.length === 0) {
    return undefined;
  }

  return `integration DB 설정이 없어 건너뜁니다: ${missingKeys.join(', ')}`;
}

function loadIntegrationDatabaseConfig(): IntegrationDatabaseConfig {
  return {
    awsRegion: process.env.INTEGRATION_AWS_REGION?.trim() || 'ap-northeast-2',
    database: process.env.INTEGRATION_DB_NAME!.trim(),
    host: process.env.INTEGRATION_DB_HOST!.trim(),
    jwtSecret: process.env.INTEGRATION_JWT_SECRET?.trim() || 'integration-test-secret',
    password: process.env.INTEGRATION_DB_PASSWORD!.trim(),
    port: process.env.INTEGRATION_DB_PORT?.trim() || '3306',
    sslCaPath: process.env.INTEGRATION_DB_SSL_CA_PATH?.trim() || undefined,
    user: process.env.INTEGRATION_DB_USER!.trim(),
  };
}

function applyIntegrationEnv(config: IntegrationDatabaseConfig): void {
  process.env.APP_ENV = 'integration';
  process.env.AWS_REGION = config.awsRegion;
  process.env.DB_HOST = config.host;
  process.env.DB_NAME = config.database;
  process.env.DB_PASSWORD = config.password;
  process.env.DB_PORT = config.port;
  process.env.DB_USER = config.user;
  process.env.JWT_SECRET = config.jwtSecret;
  process.env.LOG_LEVEL = 'error';

  if (config.sslCaPath) {
    process.env.DB_SSL_CA_PATH = config.sslCaPath;
  } else {
    delete process.env.DB_SSL_CA_PATH;
  }

  resetEnvForTests();
}

export async function prepareIntegrationDatabase(): Promise<void> {
  const config = loadIntegrationDatabaseConfig();

  applyIntegrationEnv(config);
  await closePool();

  await resetIntegrationDatabase();
}

export async function resetIntegrationDatabase(): Promise<void> {
  const pool = getPool();

  await pool.execute('DELETE FROM user_refresh_tokens');
  await pool.execute('DELETE FROM user_auth_providers');
  await pool.execute('DELETE FROM users');
}

export async function queryRows<TRow extends RowDataPacket>(
  sql: string,
  values: unknown[] = [],
): Promise<TRow[]> {
  const [rows] = await getPool().execute<TRow[]>(sql, values as never);
  return rows;
}

export async function closeIntegrationDatabase(): Promise<void> {
  await closePool();
}
