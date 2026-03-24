import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/shared/api/errors.js';
import { parseInput } from '../../../src/shared/validation/parse.js';
import { mapArtworksQuerySchema } from '../../../src/domains/map/schemas.js';

// 지도 스키마는 lat/lng를 모두 필수로 받아야 한다.
test('map schema requires lat and lng values', () => {
  assert.deepEqual(parseInput({
    schema: mapArtworksQuerySchema,
    input: {
      lat: '36.1',
      lng: '129.3',
      radiusMeters: '500',
    },
    code: 'BAD_REQUEST',
  }), {
    lat: 36.1,
    lng: 129.3,
    radiusMeters: 500,
  });

  assert.throws(
    () => parseInput({
      schema: mapArtworksQuerySchema,
      input: {
        lat: '36.1',
      },
      code: 'BAD_REQUEST',
    }),
    (error: unknown) => error instanceof AppError && error.code === 'BAD_REQUEST',
  );

  assert.throws(
    () => parseInput({
      schema: mapArtworksQuerySchema,
      input: {
        lng: '129.3',
      },
      code: 'BAD_REQUEST',
    }),
    (error: unknown) => error instanceof AppError && error.code === 'BAD_REQUEST',
  );

  assert.throws(
    () => parseInput({
      schema: mapArtworksQuerySchema,
      input: {
        lat: '36.1',
        lng: '129.3',
      },
      code: 'BAD_REQUEST',
    }),
    (error: unknown) => error instanceof AppError && error.code === 'BAD_REQUEST',
  );
});
