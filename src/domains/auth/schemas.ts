import { z } from 'zod';

const nonEmptyStringSchema = z.string().trim().min(1);

export const kakaoLoginSchema = z.object({
  accessToken: nonEmptyStringSchema,
}).strict();

export const appleLoginSchema = z.object({
  authorizationCode: nonEmptyStringSchema,
  identityToken: nonEmptyStringSchema,
}).strict();

export const refreshTokenSchema = z.object({
  refreshToken: nonEmptyStringSchema,
}).strict();
