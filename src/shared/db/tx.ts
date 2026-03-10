import type { PoolConnection } from 'mysql2/promise';

import { getPool } from './pool.js';

export type TransactionConnection = Pick<
  PoolConnection,
  'beginTransaction' | 'commit' | 'release' | 'rollback'
>;

export async function runTransaction<TConnection extends TransactionConnection, TValue>(
  connection: TConnection,
  run: (connection: TConnection) => Promise<TValue>,
): Promise<TValue> {
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
      } catch (rollbackError) {
        console.error('Transaction rollback failed', {
          originalError: error,
          rollbackError,
        });
      }
    }

    throw error;
  } finally {
    connection.release();
  }
}

export async function withTransaction<TValue>(
  run: (connection: PoolConnection) => Promise<TValue>,
): Promise<TValue> {
  const connection = await getPool().getConnection();
  return runTransaction(connection, run);
}
