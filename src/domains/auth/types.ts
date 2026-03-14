import type {
  UserDto,
  UserRecord,
} from '../users/types.js';

export const AUTH_PROVIDER_VALUES = ['kakao', 'apple'] as const;

export type AuthProvider = (typeof AUTH_PROVIDER_VALUES)[number];

export interface KakaoLoginInput {
  accessToken: string;
}

export interface AppleLoginInput {
  authorizationCode: string;
  identityToken: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface SocialIdentity {
  provider: AuthProvider;
  providerEmail: string | null;
  providerUserId: string;
}

export interface LoginResponseData {
  onboardingCompleted: boolean;
  refreshToken: string;
  token: string;
  user: UserDto;
}

export interface SessionResponseData {
  authenticated: true;
  onboardingCompleted: boolean;
  user: UserDto;
}

export interface RefreshResponseData {
  token: string;
}

export interface RefreshTokenRecord {
  created_at: Date | string;
  expires_at: Date | string;
  id: number;
  refresh_token: string;
  revoked_at: Date | string | null;
  updated_at: Date | string;
  user_id: number;
}

export interface RefreshTokenWithUser {
  refreshToken: RefreshTokenRecord;
  user: UserRecord;
}

export interface KakaoAuthProviderClient {
  getIdentity(accessToken: string): Promise<SocialIdentity>;
}

export interface AppleAuthProviderClient {
  getIdentity(input: AppleLoginInput): Promise<SocialIdentity>;
}
