import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/shared/api/errors.js';
import { parseInput } from '../../../src/shared/validation/parse.js';
import {
  searchArtworksQuerySchema,
  searchAutocompleteQuerySchema,
} from '../../../src/domains/search/schemas.js';

// 검색 스키마는 q를 trim하고 sort/page/size 기본값을 채워야 한다.
test('search schema trims q and applies pagination defaults', () => {
  assert.deepEqual(parseInput({
    schema: searchArtworksQuerySchema,
    input: {
      q: '  포항  ',
    },
  }), {
    page: 1,
    q: '포항',
    size: 20,
    sort: 'latest',
  });
});

// 검색 스키마는 빈 query와 허용되지 않은 sort 값을 거부해야 한다.
test('search schema rejects blank query and invalid sort', () => {
  assert.throws(
    () => parseInput({
      schema: searchArtworksQuerySchema,
      input: {
        q: '   ',
      },
    }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );

  assert.throws(
    () => parseInput({
      schema: searchArtworksQuerySchema,
      input: {
        q: '포항',
        sort: 'popular',
      },
    }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );
});

// 자동완성 스키마는 q를 trim하고 lang, size 기본값을 채워야 한다.
test('search autocomplete schema trims q and applies size default', () => {
  assert.deepEqual(parseInput({
    schema: searchAutocompleteQuerySchema,
    input: {
      q: '  영일  ',
    },
  }), {
    lang: 'ko',
    q: '영일',
    size: 10,
  });
});

// 자동완성 스키마는 허용된 lang 값을 그대로 통과시켜야 한다.
test('search autocomplete schema accepts supported lang values', () => {
  assert.deepEqual(parseInput({
    schema: searchAutocompleteQuerySchema,
    input: {
      lang: 'en',
      q: 'Space',
    },
  }), {
    lang: 'en',
    q: 'Space',
    size: 10,
  });
});

// 자동완성 스키마는 빈 query, 허용되지 않은 lang, 너무 큰 size를 거부해야 한다.
test('search autocomplete schema rejects blank query and oversize limit', () => {
  assert.throws(
    () => parseInput({
      schema: searchAutocompleteQuerySchema,
      input: {
        q: '  ',
      },
    }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );

  assert.throws(
    () => parseInput({
      schema: searchAutocompleteQuerySchema,
      input: {
        lang: 'jp',
        q: '포항',
      },
    }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );

  assert.throws(
    () => parseInput({
      schema: searchAutocompleteQuerySchema,
      input: {
        q: '포항',
        size: 50,
      },
    }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );
});
