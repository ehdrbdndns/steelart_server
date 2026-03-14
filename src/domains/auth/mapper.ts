import {
  computeOnboardingCompleted,
  mapUserRecordToDto,
} from '../users/mapper.js';
import type { UserRecord } from '../users/types.js';
import type {
  LoginResponseData,
  RefreshResponseData,
  SessionResponseData,
} from './types.js';

export function mapLoginResponse(
  user: UserRecord,
  token: string,
  refreshToken: string,
): LoginResponseData {
  return {
    onboardingCompleted: computeOnboardingCompleted(user),
    refreshToken,
    token,
    user: mapUserRecordToDto(user),
  };
}

export function mapSessionResponse(user: UserRecord): SessionResponseData {
  return {
    authenticated: true,
    onboardingCompleted: computeOnboardingCompleted(user),
    user: mapUserRecordToDto(user),
  };
}

export function mapRefreshResponse(token: string): RefreshResponseData {
  return {
    token,
  };
}
