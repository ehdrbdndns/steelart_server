import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/shared/api/errors.js';
import { parseInput } from '../../../src/shared/validation/parse.js';
import {
  appleLoginSchema,
  kakaoLoginSchema,
  refreshTokenSchema,
} from '../../../src/domains/auth/schemas.js';

// 인증 스키마는 정상 로그인 payload를 파싱해야 한다.
test('auth schemas parse valid login payloads', () => {
  assert.deepEqual(
    parseInput({
      schema: kakaoLoginSchema,
      input: {
        accessToken: 'kakao-token',
      },
    }),
    {
      accessToken: 'kakao-token',
    },
  );

  assert.deepEqual(
    parseInput({
      schema: refreshTokenSchema,
      input: {
        refreshToken: 'refresh-token',
      },
    }),
    {
      refreshToken: 'refresh-token',
    },
  );
});

// Apple 로그인에서는 빈 authorizationCode를 허용하면 안 된다.
test('apple login schema rejects blank authorization code', () => {
  assert.throws(
    () => parseInput({
      schema: appleLoginSchema,
      input: {
        authorizationCode: '   ',
        identityToken: 'identity-token',
      },
    }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );
});
