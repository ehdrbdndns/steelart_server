import type {
  UserDto,
  UserProfileResponse,
  UserRecord,
} from './types.js';

export function computeOnboardingCompleted(
  user: Pick<UserRecord, 'age_group' | 'nickname' | 'residency'>,
): boolean {
  return Boolean(
    user.nickname?.trim()
    && user.residency
    && user.age_group,
  );
}

export function mapUserRecordToDto(user: UserRecord): UserDto {
  return {
    age_group: user.age_group,
    id: user.id,
    language: user.language,
    nickname: user.nickname,
    notifications_enabled: user.notifications_enabled,
    residency: user.residency,
  };
}

export function mapUserProfileResponse(user: UserRecord): UserProfileResponse {
  return {
    onboardingCompleted: computeOnboardingCompleted(user),
    user: mapUserRecordToDto(user),
  };
}
