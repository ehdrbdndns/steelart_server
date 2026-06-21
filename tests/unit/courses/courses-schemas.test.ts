import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/shared/api/errors.js';
import { parseInput } from '../../../src/shared/validation/parse.js';
import {
  courseCheckinBodySchema,
  courseIdParamSchema,
  courseListQuerySchema,
  courseRouteBodySchema,
  createCourseBodySchema,
} from '../../../src/domains/courses/schemas.js';

test('course list schema applies pagination defaults', () => {
  assert.deepEqual(parseInput({
    schema: courseListQuerySchema,
    input: {},
  }), {
    page: 1,
    size: 20,
  });
});

test('course list schema rejects oversize page size', () => {
  assert.throws(
    () => parseInput({
      schema: courseListQuerySchema,
      input: {
        size: 101,
      },
    }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );
});

test('create course schema accepts valid bilingual payload', () => {
  assert.deepEqual(parseInput({
    schema: createCourseBodySchema,
    input: {
      description_en: 'Seaside route',
      description_ko: '바닷길 코스',
      items: [
        { artwork_id: 11, seq: 1 },
        { artwork_id: 22, seq: 2 },
      ],
      title_en: 'Seaside Course',
      title_ko: '바닷길 코스',
    },
  }), {
    description_en: 'Seaside route',
    description_ko: '바닷길 코스',
    items: [
      { artwork_id: 11, seq: 1 },
      { artwork_id: 22, seq: 2 },
    ],
    title_en: 'Seaside Course',
    title_ko: '바닷길 코스',
  });
});

test('create course schema rejects missing description, duplicate artwork, and non-contiguous seq', () => {
  assert.throws(
    () => parseInput({
      schema: createCourseBodySchema,
      input: {
        description_en: '',
        description_ko: '설명',
        items: [{ artwork_id: 11, seq: 1 }],
        title_en: 'Course',
        title_ko: '코스',
      },
    }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );

  assert.throws(
    () => parseInput({
      schema: createCourseBodySchema,
      input: {
        description_en: 'desc',
        description_ko: '설명',
        items: [
          { artwork_id: 11, seq: 1 },
          { artwork_id: 11, seq: 2 },
        ],
        title_en: 'Course',
        title_ko: '코스',
      },
    }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );

  assert.throws(
    () => parseInput({
      schema: createCourseBodySchema,
      input: {
        description_en: 'desc',
        description_ko: '설명',
        items: [
          { artwork_id: 11, seq: 1 },
          { artwork_id: 22, seq: 3 },
        ],
        title_en: 'Course',
        title_ko: '코스',
      },
    }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );
});

test('course route schema accepts a payload with at least two items', () => {
  assert.deepEqual(parseInput({
    schema: courseRouteBodySchema,
    input: {
      items: [
        { artwork_id: 11, seq: 1 },
        { artwork_id: 22, seq: 2 },
      ],
    },
  }), {
    items: [
      { artwork_id: 11, seq: 1 },
      { artwork_id: 22, seq: 2 },
    ],
  });
});

test('course route schema rejects fewer than two items', () => {
  assert.throws(
    () => parseInput({
      schema: courseRouteBodySchema,
      input: {
        items: [{ artwork_id: 11, seq: 1 }],
      },
    }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );
});

test('course route schema rejects non-positive artwork ids and unknown keys', () => {
  assert.throws(
    () => parseInput({
      schema: courseRouteBodySchema,
      input: {
        items: [
          { artwork_id: 0, seq: 1 },
          { artwork_id: 22, seq: 2 },
        ],
      },
    }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );

  assert.throws(
    () => parseInput({
      schema: courseRouteBodySchema,
      input: {
        items: [
          { artwork_id: 11, seq: 1, lat: 36.0 },
          { artwork_id: 22, seq: 2 },
        ],
      },
    }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );
});

test('course id param schema parses positive course id', () => {
  assert.deepEqual(parseInput({
    schema: courseIdParamSchema,
    input: {
      courseId: '12',
    },
  }), {
    courseId: 12,
  });
});

test('check-in schema parses coordinates and course item id', () => {
  assert.deepEqual(parseInput({
    schema: courseCheckinBodySchema,
    input: {
      course_item_id: '123',
      lat: '36.058',
      lng: '129.378',
    },
  }), {
    course_item_id: 123,
    lat: 36.058,
    lng: 129.378,
  });
});
