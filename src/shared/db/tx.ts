import type { PoolConnection } from 'mysql2/promise';

import { getPool } from './pool.js';

export async function withTransaction<TValue>(
  run: (connection: PoolConnection) => Promise<TValue>,
): Promise<TValue> {
  const connection = await getPool().getConnection();
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const result = await run(connection);
    await connection.commit();
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch {
        // Preserve the original failure when rollback itself fails.
      }
    }

    throw error;
  } finally {
    connection.release();
  }
}
