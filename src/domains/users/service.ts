import { AppError } from '../../shared/api/errors.js';
import { mapUserProfileResponse } from './mapper.js';
import type {
  LanguageUpdateInput,
  NotificationsUpdateInput,
  OnboardingUpdateInput,
  ProfileUpdateInput,
  UserProfileResponse,
} from './types.js';
import type { UsersRepository } from './repository.js';

export interface UsersService {
  getProfile(userId: number): Promise<UserProfileResponse>;
  updateLanguage(userId: number, input: LanguageUpdateInput): Promise<UserProfileResponse>;
  updateNotifications(userId: number, input: NotificationsUpdateInput): Promise<UserProfileResponse>;
  updateOnboarding(userId: number, input: OnboardingUpdateInput): Promise<UserProfileResponse>;
  updateProfile(userId: number, input: ProfileUpdateInput): Promise<UserProfileResponse>;
}

export interface UsersServiceDependencies {
  usersRepository: UsersRepository;
}

export function createUsersService(
  dependencies: UsersServiceDependencies,
): UsersService {
  return {
    async getProfile(userId) {
      const user = await dependencies.usersRepository.findUserById(userId);

      if (!user) {
        throw new AppError('UNAUTHORIZED', {
          message: 'Authenticated user was not found',
        });
      }

      return mapUserProfileResponse(user);
    },

    async updateLanguage(userId, input) {
      const user = await dependencies.usersRepository.updateLanguage(userId, input);
      return mapUserProfileResponse(user);
    },

    async updateNotifications(userId, input) {
      const user = await dependencies.usersRepository.updateNotifications(userId, input);
      return mapUserProfileResponse(user);
    },

    async updateOnboarding(userId, input) {
      const user = await dependencies.usersRepository.updateOnboarding(userId, input);
      return mapUserProfileResponse(user);
    },

    async updateProfile(userId, input) {
      const user = await dependencies.usersRepository.updateProfile(userId, input);
      return mapUserProfileResponse(user);
    },
  };
}
