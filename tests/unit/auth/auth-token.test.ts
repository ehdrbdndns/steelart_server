import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/shared/api/errors.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  createRefreshToken,
  getRefreshTokenExpiresAt,
  signAccessToken,
  verifyAccessToken,
} from '../../../src/shared/auth/token.js';

// 발급한 access token은 동일한 사용자 클레임으로 다시 검증되어야 한다.
test('signAccessToken and verifyAccessToken round-trip claims', () => {
  const issuedAt = new Date('2026-03-14T00:00:00.000Z');
  const token = signAccessToken(7, {
    now: issuedAt,
    secret: 'test-secret',
  });

  const claims = verifyAccessToken(token, {
    now: new Date('2026-03-14T00:30:00.000Z'),
    secret: 'test-secret',
  });

  assert.deepEqual(claims, {
    exp: Math.floor(issuedAt.getTime() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
    iat: Math.floor(issuedAt.getTime() / 1000),
    sub: 7,
    type: 'access',
  });
});

// 만료된 access token은 ACCESS_TOKEN_EXPIRED 에러를 던져야 한다.
test('verifyAccessToken throws ACCESS_TOKEN_EXPIRED when token is stale', () => {
  const token = signAccessToken(3, {
    now: new Date('2026-03-14T00:00:00.000Z'),
    secret: 'test-secret',
    ttlSeconds: 60,
  });

  assert.throws(
    () => verifyAccessToken(token, {
      now: new Date('2026-03-14T00:02:00.000Z'),
      secret: 'test-secret',
    }),
    (error: unknown) => error instanceof AppError && error.code === 'ACCESS_TOKEN_EXPIRED',
  );
});

// refresh token 헬퍼는 불투명 토큰 문자열과 30일 만료 시점을 만들어야 한다.
test('refresh token helpers create opaque token and 30-day expiry', () => {
  const now = new Date('2026-03-14T00:00:00.000Z');
  const refreshToken = createRefreshToken();
  const expiresAt = getRefreshTokenExpiresAt(now);

  assert.equal(typeof refreshToken, 'string');
  assert.ok(refreshToken.length > 20);
  assert.equal(expiresAt.toISOString(), '2026-04-13T00:00:00.000Z');
});
