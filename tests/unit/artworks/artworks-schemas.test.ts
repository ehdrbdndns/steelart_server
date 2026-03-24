import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/shared/api/errors.js';
import { parseInput } from '../../../src/shared/validation/parse.js';
import { artworksListQuerySchema } from '../../../src/domains/artworks/schemas.js';

// 작품 목록 스키마는 반복 query를 배열로 받아 기본 pagination과 정렬을 채워야 한다.
test('artworks schema parses multi filters and defaults', () => {
  assert.deepEqual(parseInput({
    schema: artworksListQuerySchema,
    input: {
      artistType: ['COMPANY'],
      festivalYear: ['2024', '2023'],
      placeId: ['1', '2'],
      sort: 'oldest',
    },
  }), {
    artistType: ['COMPANY'],
    festivalYear: ['2024', '2023'],
    page: 1,
    placeId: [1, 2],
    size: 24,
    sort: 'oldest',
  });
});

// 작품 목록 스키마는 허용되지 않은 artistType 값을 거부해야 한다.
test('artworks schema rejects invalid artistType values', () => {
  assert.throws(
    () => parseInput({
      schema: artworksListQuerySchema,
      input: {
        artistType: ['WRONG'],
      },
    }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );
});
