import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/shared/api/errors.js';
import { resetEnvForTests } from '../../../src/shared/env/server.js';
import { verifyAccessToken } from '../../../src/shared/auth/token.js';
import { createAuthService } from '../../../src/domains/auth/service.js';
import type { AuthRepository } from '../../../src/domains/auth/repository.js';
import type {
  AppleAuthProviderClient,
  KakaoAuthProviderClient,
} from '../../../src/domains/auth/types.js';
import type { UsersRepository } from '../../../src/domains/users/repository.js';
import type { UserRecord } from '../../../src/domains/users/types.js';

function applyServerTestEnv(): void {
  process.env.APP_ENV = 'test';
  process.env.AWS_REGION = 'ap-northeast-2';
  process.env.DB_HOST = 'localhost';
  process.env.DB_NAME = 'steelart';
  process.env.DB_PASSWORD = 'password';
  process.env.DB_PORT = '3306';
  process.env.DB_USER = 'steelart';
  process.env.JWT_SECRET = 'test-secret';
  process.env.LOG_LEVEL = 'error';
  resetEnvForTests();
}

function createUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    age_group: '20S',
    created_at: new Date('2026-03-14T00:00:00.000Z'),
    id: 1,
    language: 'ko',
    nickname: 'steelwalker',
    notifications_enabled: true,
    residency: 'POHANG',
    updated_at: new Date('2026-03-14T00:00:00.000Z'),
    ...overrides,
  };
}

function createUnusedKakaoProvider(): KakaoAuthProviderClient {
  return {
    async getIdentity() {
      throw new Error('Kakao provider should not be called in this test');
    },
  };
}

function createUnusedAppleProvider(): AppleAuthProviderClient {
  return {
    async getIdentity() {
      throw new Error('Apple provider should not be called in this test');
    },
  };
}

// 유효한 refresh token이면 새 access token을 발급해야 한다.
test('refreshAccessToken returns new access token for valid refresh token', async () => {
  applyServerTestEnv();
  const user = createUser();
  const authRepository: AuthRepository = {
    async createUserWithIdentityAndRefreshToken() {
      throw new Error('not used');
    },
    async createRefreshTokenRecord() {
      throw new Error('not used');
    },
    async findRefreshToken() {
      return {
        created_at: new Date('2026-03-14T00:00:00.000Z'),
        expires_at: new Date('2026-04-13T00:00:00.000Z'),
        id: 10,
        refresh_token: 'refresh-token',
        revoked_at: null,
        updated_at: new Date('2026-03-14T00:00:00.000Z'),
        user_id: user.id,
      };
    },
    async findUserByProviderIdentity() {
      throw new Error('not used');
    },
  };
  const usersRepository: Pick<UsersRepository, 'findUserById'> = {
    async findUserById() {
      return user;
    },
  };
  const service = createAuthService({
    appleProvider: createUnusedAppleProvider(),
    authRepository,
    kakaoProvider: createUnusedKakaoProvider(),
    usersRepository,
  });

  const result = await service.refreshAccessToken('refresh-token');

  const claims = verifyAccessToken(result.token, {
    secret: 'test-secret',
  });

  assert.equal(claims.sub, 1);
  assert.equal(claims.type, 'access');
  assert.ok(claims.exp > claims.iat);
});

// 만료된 refresh token은 REFRESH_TOKEN_EXPIRED 에러를 던져야 한다.
test('refreshAccessToken throws REFRESH_TOKEN_EXPIRED for stale refresh token', async () => {
  applyServerTestEnv();
  const user = createUser();
  const authRepository: AuthRepository = {
    async createUserWithIdentityAndRefreshToken() {
      throw new Error('not used');
    },
    async createRefreshTokenRecord() {
      throw new Error('not used');
    },
    async findRefreshToken() {
      return {
        created_at: new Date('2026-03-14T00:00:00.000Z'),
        expires_at: new Date('2020-03-13T00:00:00.000Z'),
        id: 10,
        refresh_token: 'refresh-token',
        revoked_at: null,
        updated_at: new Date('2026-03-14T00:00:00.000Z'),
        user_id: user.id,
      };
    },
    async findUserByProviderIdentity() {
      throw new Error('not used');
    },
  };
  const usersRepository: Pick<UsersRepository, 'findUserById'> = {
    async findUserById() {
      return user;
    },
  };
  const service = createAuthService({
    appleProvider: createUnusedAppleProvider(),
    authRepository,
    kakaoProvider: createUnusedKakaoProvider(),
    usersRepository,
  });

  await assert.rejects(
    () => service.refreshAccessToken('refresh-token'),
    (error: unknown) => error instanceof AppError && error.code === 'REFRESH_TOKEN_EXPIRED',
  );
});

// 기존 사용자로 카카오 로그인하면 refresh token을 새로 저장해야 한다.
test('loginWithKakao stores refresh token for an existing user', async () => {
  applyServerTestEnv();
  const user = createUser({
    age_group: null,
    nickname: null,
    residency: null,
  });
  let storedRefreshToken: string | null = null;
  const authRepository: AuthRepository = {
    async createUserWithIdentityAndRefreshToken() {
      throw new Error('should not create a new user');
    },
    async createRefreshTokenRecord(_userId, refreshToken) {
      storedRefreshToken = refreshToken;
    },
    async findRefreshToken() {
      throw new Error('not used');
    },
    async findUserByProviderIdentity() {
      return user;
    },
  };
  const usersRepository: Pick<UsersRepository, 'findUserById'> = {
    async findUserById() {
      return user;
    },
  };
  const service = createAuthService({
    appleProvider: createUnusedAppleProvider(),
    authRepository,
    kakaoProvider: {
      async getIdentity() {
        return {
          provider: 'kakao',
          providerUserId: 'kakao-user-1',
        };
      },
    },
    usersRepository,
  });

  const result = await service.loginWithKakao({
    accessToken: 'kakao-access-token',
  });

  assert.equal(storedRefreshToken, result.refreshToken);
  assert.ok(result.refreshToken.length > 20);
  assert.deepEqual(result.user, {
    age_group: null,
    id: 1,
    language: 'ko',
    nickname: null,
    notifications_enabled: true,
    residency: null,
  });
  assert.equal(result.onboardingCompleted, false);

  const claims = verifyAccessToken(result.token, {
    secret: 'test-secret',
  });

  assert.equal(claims.sub, 1);
  assert.equal(claims.type, 'access');
});
