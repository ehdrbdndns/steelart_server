import assert from 'node:assert/strict';
import test from 'node:test';

import { z } from 'zod';

import { AppError } from '../../src/shared/api/errors.js';
import { parseInput } from '../../src/shared/validation/parse.js';

// 유효한 입력은 스키마에 맞게 파싱된 결과를 그대로 반환해야 한다.
test('parseInput returns parsed data on success', () => {
  const schema = z.object({
    nickname: z.string().min(1),
  });

  assert.deepEqual(parseInput({
    schema,
    input: { nickname: 'steelwalker' },
  }), {
    nickname: 'steelwalker',
  });
});

// 스키마 검증 실패는 ZodError가 아니라 AppError로 변환되어야 한다.
test('parseInput converts zod errors into AppError', () => {
  const schema = z.object({
    nickname: z.string().min(2),
  });

  assert.throws(
    () => parseInput({
      schema,
      input: { nickname: 'a' },
    }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );
});
