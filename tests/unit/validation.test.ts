import assert from 'node:assert/strict';
import test from 'node:test';

import { z } from 'zod';

import { AppError } from '../../src/shared/api/errors.js';
import { parseOrThrow } from '../../src/shared/validation/parse.js';

test('parseOrThrow returns parsed data on success', () => {
  const schema = z.object({
    nickname: z.string().min(1),
  });

  assert.deepEqual(parseOrThrow(schema, { nickname: 'steelwalker' }), {
    nickname: 'steelwalker',
  });
});

test('parseOrThrow converts zod errors into AppError', () => {
  const schema = z.object({
    nickname: z.string().min(2),
  });

  assert.throws(
    () => parseOrThrow(schema, { nickname: 'a' }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );
});
