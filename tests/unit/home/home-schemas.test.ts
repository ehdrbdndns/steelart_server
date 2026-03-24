import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/shared/api/errors.js';
import { parseInput } from '../../../src/shared/validation/parse.js';
import { homeArtworksQuerySchema } from '../../../src/domains/home/schemas.js';

// 홈 존 전환 query는 양의 정수 zoneId를 받아야 한다.
test('home schema accepts positive zoneId and rejects zero', () => {
  assert.deepEqual(parseInput({
    schema: homeArtworksQuerySchema,
    input: {
      zoneId: '4',
    },
  }), {
    zoneId: 4,
  });

  assert.throws(
    () => parseInput({
      schema: homeArtworksQuerySchema,
      input: {
        zoneId: '0',
      },
    }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );
});
