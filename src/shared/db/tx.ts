import type { PoolConnection } from 'mysql2/promise';

import { getPool } from './pool.js';

export async function withTransaction<TValue>(
  run: (connection: PoolConnection) => Promise<TValue>,
): Promise<TValue> {
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const result = await run(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
