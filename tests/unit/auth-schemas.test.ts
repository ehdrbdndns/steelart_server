import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../src/shared/api/errors.js';
import { parseOrThrow } from '../../src/shared/validation/parse.js';
import {
  appleLoginSchema,
  kakaoLoginSchema,
  refreshTokenSchema,
} from '../../src/domains/auth/schemas.js';

test('auth schemas parse valid login payloads', () => {
  assert.deepEqual(
    parseOrThrow(kakaoLoginSchema, {
      accessToken: 'kakao-token',
    }),
    {
      accessToken: 'kakao-token',
    },
  );

  assert.deepEqual(
    parseOrThrow(refreshTokenSchema, {
      refreshToken: 'refresh-token',
    }),
    {
      refreshToken: 'refresh-token',
    },
  );
});

test('apple login schema rejects blank authorization code', () => {
  assert.throws(
    () => parseOrThrow(appleLoginSchema, {
      authorizationCode: '   ',
      identityToken: 'identity-token',
    }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );
});
