import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../src/shared/api/errors.js';
import { createAuthService } from '../../src/domains/auth/service.js';
import type { AuthRepository } from '../../src/domains/auth/repository.js';
import type {
  AppleAuthProviderClient,
  KakaoAuthProviderClient,
} from '../../src/domains/auth/types.js';
import type { UsersRepository } from '../../src/domains/users/repository.js';
import type { UserRecord } from '../../src/domains/users/types.js';

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

test('refreshAccessToken returns new access token for valid refresh token', async () => {
  const user = createUser();
  const authRepository: AuthRepository = {
    async createUserWithIdentityAndRefreshToken() {
      throw new Error('not used');
    },
    async findRefreshTokenWithUser() {
      return {
        refreshToken: {
          created_at: new Date('2026-03-14T00:00:00.000Z'),
          expires_at: new Date('2026-04-13T00:00:00.000Z'),
          id: 10,
          refresh_token: 'refresh-token',
          revoked_at: null,
          updated_at: new Date('2026-03-14T00:00:00.000Z'),
          user_id: user.id,
        },
        user,
      };
    },
    async findUserByProviderIdentity() {
      throw new Error('not used');
    },
    async storeRefreshToken() {
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
    now: () => new Date('2026-03-14T00:00:00.000Z'),
    signAccessToken: (userId) => `signed:${userId}`,
    usersRepository,
  });

  const result = await service.refreshAccessToken('refresh-token');

  assert.deepEqual(result, {
    token: 'signed:1',
  });
});

test('refreshAccessToken throws REFRESH_TOKEN_EXPIRED for stale refresh token', async () => {
  const user = createUser();
  const authRepository: AuthRepository = {
    async createUserWithIdentityAndRefreshToken() {
      throw new Error('not used');
    },
    async findRefreshTokenWithUser() {
      return {
        refreshToken: {
          created_at: new Date('2026-03-14T00:00:00.000Z'),
          expires_at: new Date('2026-03-13T00:00:00.000Z'),
          id: 10,
          refresh_token: 'refresh-token',
          revoked_at: null,
          updated_at: new Date('2026-03-14T00:00:00.000Z'),
          user_id: user.id,
        },
        user,
      };
    },
    async findUserByProviderIdentity() {
      throw new Error('not used');
    },
    async storeRefreshToken() {
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
    now: () => new Date('2026-03-14T00:00:00.000Z'),
    usersRepository,
  });

  await assert.rejects(
    () => service.refreshAccessToken('refresh-token'),
    (error: unknown) => error instanceof AppError && error.code === 'REFRESH_TOKEN_EXPIRED',
  );
});

test('loginWithKakao stores refresh token for an existing user', async () => {
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
    async findRefreshTokenWithUser() {
      throw new Error('not used');
    },
    async findUserByProviderIdentity() {
      return user;
    },
    async storeRefreshToken(_userId, refreshToken) {
      storedRefreshToken = refreshToken;
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
    createRefreshToken: () => 'new-refresh-token',
    getRefreshTokenExpiresAt: () => new Date('2026-04-13T00:00:00.000Z'),
    kakaoProvider: {
      async getIdentity() {
        return {
          provider: 'kakao',
          providerEmail: 'steel@example.com',
          providerUserId: 'kakao-user-1',
        };
      },
    },
    now: () => new Date('2026-03-14T00:00:00.000Z'),
    signAccessToken: (userId) => `signed:${userId}`,
    usersRepository,
  });

  const result = await service.loginWithKakao({
    accessToken: 'kakao-access-token',
  });

  assert.equal(storedRefreshToken, 'new-refresh-token');
  assert.deepEqual(result, {
    onboardingCompleted: false,
    refreshToken: 'new-refresh-token',
    token: 'signed:1',
    user: {
      age_group: null,
      id: 1,
      language: 'ko',
      nickname: null,
      notifications_enabled: true,
      residency: null,
    },
  });
});
