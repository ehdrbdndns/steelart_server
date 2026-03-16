import assert from 'node:assert/strict';
import test from 'node:test';

import {
  computeOnboardingCompleted,
  mapUserProfileResponse,
} from '../../../src/domains/users/mapper.js';
import type { UserRecord } from '../../../src/domains/users/types.js';

function createUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    age_group: '30S',
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

// 온보딩 완료 여부는 nickname, residency, age_group 세 값이 모두 있어야 true여야 한다.
test('computeOnboardingCompleted requires nickname, residency, and age_group', () => {
  assert.equal(computeOnboardingCompleted(createUser()), true);
  assert.equal(computeOnboardingCompleted(createUser({ nickname: null })), false);
  assert.equal(computeOnboardingCompleted(createUser({ residency: null })), false);
  assert.equal(computeOnboardingCompleted(createUser({ age_group: null })), false);
});

// 사용자 응답 매퍼는 프로필 필드와 온보딩 완료 여부를 함께 반환해야 한다.
test('mapUserProfileResponse keeps profile fields and onboarding flag', () => {
  assert.deepEqual(mapUserProfileResponse(createUser({ nickname: null })), {
    onboardingCompleted: false,
    user: {
      age_group: '30S',
      id: 1,
      language: 'ko',
      nickname: null,
      notifications_enabled: true,
      residency: 'POHANG',
    },
  });
});
