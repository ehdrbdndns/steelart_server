import { AppError } from '../../shared/api/errors.js';
import {
  createRefreshToken as defaultCreateRefreshToken,
  getRefreshTokenExpiresAt as defaultGetRefreshTokenExpiresAt,
  isExpiredAt,
  signAccessToken as defaultSignAccessToken,
} from '../../shared/auth/token.js';
import type { UsersRepository } from '../users/repository.js';
import {
  mapLoginResponse,
  mapRefreshResponse,
  mapSessionResponse,
} from './mapper.js';
import type { AuthRepository } from './repository.js';
import type {
  AppleAuthProviderClient,
  AppleLoginInput,
  KakaoAuthProviderClient,
  KakaoLoginInput,
  LoginResponseData,
  RefreshResponseData,
  SocialIdentity,
  SessionResponseData,
} from './types.js';

export interface AuthService {
  getSession(userId: number): Promise<SessionResponseData>;
  loginWithApple(input: AppleLoginInput): Promise<LoginResponseData>;
  loginWithKakao(input: KakaoLoginInput): Promise<LoginResponseData>;
  refreshAccessToken(refreshToken: string): Promise<RefreshResponseData>;
}

export interface AuthServiceDependencies {
  appleProvider: AppleAuthProviderClient;
  authRepository: AuthRepository;
  createRefreshToken?: () => string;
  getRefreshTokenExpiresAt?: (now?: Date) => Date;
  kakaoProvider: KakaoAuthProviderClient;
  now?: () => Date;
  signAccessToken?: (userId: number, options?: { now?: Date }) => string;
  usersRepository: Pick<UsersRepository, 'findUserById'>;
}

export function createAuthService(
  dependencies: AuthServiceDependencies,
): AuthService {
  const now = dependencies.now ?? (() => new Date());
  const signAccessToken = dependencies.signAccessToken ?? defaultSignAccessToken;
  const createRefreshToken = dependencies.createRefreshToken ?? defaultCreateRefreshToken;
  const getRefreshTokenExpiresAt = dependencies.getRefreshTokenExpiresAt ?? defaultGetRefreshTokenExpiresAt;

  async function loginWithIdentity(identity: SocialIdentity): Promise<LoginResponseData> {
    const currentTime = now();
    const refreshToken = createRefreshToken();
    const refreshTokenExpiresAt = getRefreshTokenExpiresAt(currentTime);
    const existingUser = await dependencies.authRepository.findUserByProviderIdentity(
      identity.provider,
      identity.providerUserId,
    );
    const user = existingUser
      ?? await dependencies.authRepository.createUserWithIdentityAndRefreshToken({
        identity,
        refreshToken,
        refreshTokenExpiresAt,
      });

    if (existingUser) {
      await dependencies.authRepository.storeRefreshToken(
        user.id,
        refreshToken,
        refreshTokenExpiresAt,
      );
    }

    return mapLoginResponse(
      user,
      signAccessToken(user.id, { now: currentTime }),
      refreshToken,
    );
  }

  async function requireCurrentUser(userId: number) {
    const user = await dependencies.usersRepository.findUserById(userId);

    if (!user) {
      throw new AppError('UNAUTHORIZED', {
        message: 'Authenticated user was not found',
      });
    }

    return user;
  }

  return {
    async getSession(userId) {
      return mapSessionResponse(await requireCurrentUser(userId));
    },

    async loginWithApple(input) {
      const identity = await dependencies.appleProvider.getIdentity(input);
      return loginWithIdentity(identity);
    },

    async loginWithKakao(input) {
      const identity = await dependencies.kakaoProvider.getIdentity(input.accessToken);
      return loginWithIdentity(identity);
    },

    async refreshAccessToken(refreshToken) {
      const refreshTokenWithUser = await dependencies.authRepository.findRefreshTokenWithUser(refreshToken);

      if (!refreshTokenWithUser || refreshTokenWithUser.refreshToken.revoked_at) {
        throw new AppError('UNAUTHORIZED', {
          message: 'Refresh token is invalid',
        });
      }

      if (isExpiredAt(refreshTokenWithUser.refreshToken.expires_at, now())) {
        throw new AppError('REFRESH_TOKEN_EXPIRED', {
          message: 'Refresh token expired',
        });
      }

      return mapRefreshResponse(
        signAccessToken(refreshTokenWithUser.user.id, { now: now() }),
      );
    },
  };
}
