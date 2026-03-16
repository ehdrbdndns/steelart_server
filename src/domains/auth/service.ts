import { AppError } from '../../shared/api/errors.js';
import {
  createRefreshToken,
  getRefreshTokenExpiresAt,
  isExpiredAt,
  signAccessToken,
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
  kakaoProvider: KakaoAuthProviderClient;
  usersRepository: Pick<UsersRepository, 'findUserById'>;
}

export function createAuthService(
  dependencies: AuthServiceDependencies,
): AuthService {
  async function loginWithIdentity(identity: SocialIdentity): Promise<LoginResponseData> {
    const currentTime = new Date();
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
      await dependencies.authRepository.createRefreshTokenRecord(
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

  return {
    async getSession(userId) {
      const user = await dependencies.usersRepository.findUserById(userId);

      if (!user) {
        throw new AppError('UNAUTHORIZED', {
          message: 'Authenticated user was not found',
        });
      }

      return mapSessionResponse(user);
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
      const storedRefreshToken = await dependencies.authRepository.findRefreshToken(refreshToken);

      if (!storedRefreshToken || storedRefreshToken.revoked_at) {
        throw new AppError('UNAUTHORIZED', {
          message: 'Refresh token is invalid',
        });
      }

      if (isExpiredAt(storedRefreshToken.expires_at, new Date())) {
        throw new AppError('REFRESH_TOKEN_EXPIRED', {
          message: 'Refresh token expired',
        });
      }

      return mapRefreshResponse(
        signAccessToken(storedRefreshToken.user_id),
      );
    },
  };
}
