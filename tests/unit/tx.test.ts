import assert from 'node:assert/strict';
import test from 'node:test';

import { runTransaction, type TransactionConnection } from '../../src/shared/db/tx.js';

function createFakeConnection(overrides: Partial<TransactionConnection> = {}) {
  const calls: string[] = [];

  const connection: TransactionConnection = {
    async beginTransaction() {
      calls.push('beginTransaction');
    },
    async commit() {
      calls.push('commit');
    },
    release() {
      calls.push('release');
    },
    async rollback() {
      calls.push('rollback');
    },
    ...overrides,
  };

  return { calls, connection };
}

// 트랜잭션이 성공하면 commit 후 connection을 release해야 한다.
test('runTransaction commits and releases on success', async () => {
  const { calls, connection } = createFakeConnection();

  const result = await runTransaction(connection, async () => {
    calls.push('run');
    return 'ok';
  });

  assert.equal(result, 'ok');
  assert.deepEqual(calls, ['beginTransaction', 'run', 'commit', 'release']);
});

// 롤백이 성공해도 원래 발생한 에러를 그대로 유지해야 한다.
test('runTransaction preserves the original error when rollback succeeds', async () => {
  const { calls, connection } = createFakeConnection();
  const originalError = new Error('original failure');

  await assert.rejects(
    () =>
      runTransaction(connection, async () => {
        calls.push('run');
        throw originalError;
      }),
    (error: unknown) => error === originalError,
  );

  assert.deepEqual(calls, ['beginTransaction', 'run', 'rollback', 'release']);
});

// 롤백 실패는 기록하되 원래 에러를 덮어쓰면 안 된다.
test('runTransaction reports rollback failure without masking the original error', async () => {
  const rollbackError = new Error('rollback failure');
  const originalError = new Error('original failure');
  const { calls, connection } = createFakeConnection({
    async rollback() {
      calls.push('rollback');
      throw rollbackError;
    },
  });
  const originalConsoleError = console.error;
  const errorLogs: unknown[][] = [];

  console.error = ((...args: unknown[]) => {
    errorLogs.push(args);
  }) as typeof console.error;

  try {
    await assert.rejects(
      () =>
        runTransaction(connection, async () => {
          calls.push('run');
          throw originalError;
        }),
      (error: unknown) => error === originalError,
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(calls, ['beginTransaction', 'run', 'rollback', 'release']);
  assert.deepEqual(errorLogs, [
    [
      'Transaction rollback failed',
      {
        originalError,
        rollbackError,
      },
    ],
  ]);
});
