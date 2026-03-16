import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/shared/api/errors.js';
import { parseInput } from '../../../src/shared/validation/parse.js';
import {
  languageUpdateSchema,
  notificationsUpdateSchema,
  onboardingUpdateSchema,
} from '../../../src/domains/users/schemas.js';

// 사용자 온보딩과 설정 스키마는 정상 payload를 통과시켜야 한다.
test('users schemas accept valid onboarding and settings payloads', () => {
  assert.deepEqual(
    parseInput({
      schema: onboardingUpdateSchema,
      input: {
        age_group: '20S',
        nickname: '  포항산책러  ',
        residency: 'POHANG',
      },
    }),
    {
      age_group: '20S',
      nickname: '포항산책러',
      residency: 'POHANG',
    },
  );

  assert.deepEqual(
    parseInput({
      schema: notificationsUpdateSchema,
      input: {
        notifications_enabled: false,
      },
    }),
    {
      notifications_enabled: false,
    },
  );

  assert.deepEqual(
    parseInput({
      schema: languageUpdateSchema,
      input: {
        language: 'en',
      },
    }),
    {
      language: 'en',
    },
  );
});

// 닉네임은 공백만 있는 값이면 거부해야 한다.
test('users schemas reject blank nickname', () => {
  assert.throws(
    () => parseInput({
      schema: onboardingUpdateSchema,
      input: {
        age_group: '20S',
        nickname: '   ',
        residency: 'POHANG',
      },
    }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );
});
