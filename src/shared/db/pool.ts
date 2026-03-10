import { readFileSync } from 'node:fs';

import {
  createPool,
  type Pool,
  type PoolConnection,
  type PoolOptions,
} from 'mysql2/promise';

import { getEnv } from '../env/server.js';

let pool: Pool | null = null;

function buildPoolOptions(): PoolOptions {
  const env = getEnv();
  const options: PoolOptions = {
    database: env.DB_NAME,
    enableKeepAlive: true,
    host: env.DB_HOST,
    password: env.DB_PASSWORD,
    port: env.DB_PORT,
    queueLimit: 0,
    user: env.DB_USER,
    waitForConnections: true,
    connectionLimit: 4,
  };

  if (env.DB_SSL_CA_PATH) {
    options.ssl = {
      ca: readFileSync(env.DB_SSL_CA_PATH, 'utf8'),
    };
  }

  return options;
}

export function getPool(): Pool {
  pool ??= createPool(buildPoolOptions());
  return pool;
}

export async function withConnection<TValue>(
  run: (connection: PoolConnection) => Promise<TValue>,
): Promise<TValue> {
  const connection = await getPool().getConnection();

  try {
    return await run(connection);
  } finally {
    connection.release();
  }
}

export async function closePool(): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = null;
}
