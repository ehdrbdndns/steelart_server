import { AppError } from '../../api/errors.js';
import { parseInput } from '../../validation/parse.js';
import type { KakaoAuthProviderClient } from '../../../domains/auth/types.js';
import { z } from 'zod';

const KAKAO_USER_INFO_URL = 'https://kapi.kakao.com/v2/user/me';

const kakaoUserInfoSchema = z.object({
  id: z.union([z.number().int().positive(), z.string().min(1)]).transform(String),
});

export function createKakaoAuthProvider(): KakaoAuthProviderClient {
  return {
    async getIdentity(accessToken) {
      let userInfoResponse: Response;

      try {
        userInfoResponse = await fetch(KAKAO_USER_INFO_URL, {
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        });
      } catch (error) {
        throw new AppError('INTERNAL_ERROR', {
          cause: error,
          message: 'Failed to reach Kakao authentication service',
        });
      }

      if (!userInfoResponse.ok) {
        throw new AppError('UNAUTHORIZED', {
          details: {
            userInfoStatus: userInfoResponse.status,
          },
          message: 'Kakao access token is invalid',
        });
      }

      let payload: unknown;

      try {
        payload = await userInfoResponse.json();
      } catch (error) {
        throw new AppError('INTERNAL_ERROR', {
          cause: error,
          message: 'Kakao response format is invalid',
        });
      }

      const userInfo = parseInput({
        schema: kakaoUserInfoSchema,
        input: payload,
        message: 'Kakao user info response is invalid',
      });

      return {
        provider: 'kakao',
        providerUserId: userInfo.id,
      };
    },
  };
}
