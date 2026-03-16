import { z } from 'zod';

import {
  AGE_GROUP_VALUES,
  LANGUAGE_VALUES,
  RESIDENCY_VALUES,
} from './types.js';

const nicknameSchema = z
  .string()
  .trim()
  .min(1, 'Nickname is required');

export const residencySchema = z.enum(RESIDENCY_VALUES);
export const ageGroupSchema = z.enum(AGE_GROUP_VALUES);
export const languageSchema = z.enum(LANGUAGE_VALUES);

export const onboardingUpdateSchema = z.object({
  age_group: ageGroupSchema,
  nickname: nicknameSchema,
  residency: residencySchema,
}).strict();

export const profileUpdateSchema = z.object({
  age_group: ageGroupSchema,
  nickname: nicknameSchema,
  residency: residencySchema,
}).strict();

export const notificationsUpdateSchema = z.object({
  notifications_enabled: z.boolean(),
}).strict();

export const languageUpdateSchema = z.object({
  language: languageSchema,
}).strict();
