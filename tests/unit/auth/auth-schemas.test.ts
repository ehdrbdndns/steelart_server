import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/shared/api/errors.js';
import { parseInput } from '../../../src/shared/validation/parse.js';
import {
  appleLoginSchema,
  devLoginSchema,
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

// 개발용 로그인은 body 없이 기본 dev user 로그인을 허용해야 한다.
test('devLoginSchema accepts an empty body as default dev login', () => {
  assert.deepEqual(devLoginSchema.parse(undefined), {});
});

// 개발용 로그인은 양의 정수 userId만 허용해야 한다.
test('devLoginSchema accepts a positive integer userId', () => {
  assert.deepEqual(devLoginSchema.parse({ userId: 12 }), {
    userId: 12,
  });
});

// 개발용 로그인은 0 이하 userId를 거부해야 한다.
test('devLoginSchema rejects non-positive userId values', () => {
  assert.throws(() => devLoginSchema.parse({ userId: 0 }));
  assert.throws(() => devLoginSchema.parse({ userId: -1 }));
});
