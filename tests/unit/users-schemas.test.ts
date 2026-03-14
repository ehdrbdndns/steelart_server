import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../src/shared/api/errors.js';
import { parseOrThrow } from '../../src/shared/validation/parse.js';
import {
  languageUpdateSchema,
  notificationsUpdateSchema,
  onboardingUpdateSchema,
} from '../../src/domains/users/schemas.js';

test('users schemas accept valid onboarding and settings payloads', () => {
  assert.deepEqual(
    parseOrThrow(onboardingUpdateSchema, {
      age_group: '20S',
      nickname: '  포항산책러  ',
      residency: 'POHANG',
    }),
    {
      age_group: '20S',
      nickname: '포항산책러',
      residency: 'POHANG',
    },
  );

  assert.deepEqual(
    parseOrThrow(notificationsUpdateSchema, {
      notifications_enabled: false,
    }),
    {
      notifications_enabled: false,
    },
  );

  assert.deepEqual(
    parseOrThrow(languageUpdateSchema, {
      language: 'en',
    }),
    {
      language: 'en',
    },
  );
});

test('users schemas reject blank nickname', () => {
  assert.throws(
    () => parseOrThrow(onboardingUpdateSchema, {
      age_group: '20S',
      nickname: '   ',
      residency: 'POHANG',
    }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );
});
