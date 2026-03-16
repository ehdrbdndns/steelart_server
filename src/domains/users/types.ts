export const RESIDENCY_VALUES = ['POHANG', 'NON_POHANG'] as const;
export const AGE_GROUP_VALUES = ['TEEN', '20S', '30S', '40S', '50S', '60S', '70_PLUS'] as const;
export const LANGUAGE_VALUES = ['ko', 'en'] as const;

export type Residency = (typeof RESIDENCY_VALUES)[number];
export type AgeGroup = (typeof AGE_GROUP_VALUES)[number];
export type Language = (typeof LANGUAGE_VALUES)[number];

export interface UserRecord {
  age_group: AgeGroup | null;
  created_at: Date | string;
  id: number;
  language: Language;
  nickname: string | null;
  notifications_enabled: boolean;
  residency: Residency | null;
  updated_at: Date | string;
}

export interface UserDto {
  age_group: AgeGroup | null;
  id: number;
  language: Language;
  nickname: string | null;
  notifications_enabled: boolean;
  residency: Residency | null;
}

export interface UserProfileResponse {
  onboardingCompleted: boolean;
  user: UserDto;
}

export interface OnboardingUpdateInput {
  age_group: AgeGroup;
  nickname: string;
  residency: Residency;
}

export interface ProfileUpdateInput {
  age_group: AgeGroup;
  nickname: string;
  residency: Residency;
}

export interface NotificationsUpdateInput {
  notifications_enabled: boolean;
}

export interface LanguageUpdateInput {
  language: Language;
}
