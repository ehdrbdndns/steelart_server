import { AppError } from '../../api/errors.js';
import { parseOrThrow } from '../../validation/parse.js';
import type { KakaoAuthProviderClient } from '../../../domains/auth/types.js';
import { z } from 'zod';

const KAKAO_ACCESS_TOKEN_INFO_URL = 'https://kapi.kakao.com/v1/user/access_token_info';
const KAKAO_USER_INFO_URL = 'https://kapi.kakao.com/v2/user/me';

const kakaoTokenInfoSchema = z.object({
  app_id: z.number().int().positive().optional(),
  expires_in_millis: z.number().int().nonnegative().optional(),
  id: z.union([z.number().int().positive(), z.string().min(1)]).transform(String),
});

const kakaoUserInfoSchema = z.object({
  id: z.union([z.number().int().positive(), z.string().min(1)]).transform(String),
  kakao_account: z.object({
    email: z.string().email().nullable().optional(),
  }).partial().optional(),
});

interface KakaoProviderOptions {
  fetch?: typeof fetch;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw new AppError('INTERNAL_ERROR', {
      cause: error,
      message: 'Kakao response format is invalid',
    });
  }
}

export function createKakaoAuthProvider(
  options: KakaoProviderOptions = {},
): KakaoAuthProviderClient {
  const fetcher = options.fetch ?? globalThis.fetch;

  if (!fetcher) {
    throw new AppError('INTERNAL_ERROR', {
      message: 'Fetch API is not available',
    });
  }

  return {
    async getIdentity(accessToken) {
      let tokenInfoResponse: Response;
      let userInfoResponse: Response;

      try {
        tokenInfoResponse = await fetcher(KAKAO_ACCESS_TOKEN_INFO_URL, {
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        });
        userInfoResponse = await fetcher(KAKAO_USER_INFO_URL, {
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

      if (!tokenInfoResponse.ok || !userInfoResponse.ok) {
        throw new AppError('UNAUTHORIZED', {
          details: {
            tokenInfoStatus: tokenInfoResponse.status,
            userInfoStatus: userInfoResponse.status,
          },
          message: 'Kakao access token is invalid',
        });
      }

      const tokenInfo = parseOrThrow(
        kakaoTokenInfoSchema,
        await parseJsonResponse(tokenInfoResponse),
        {
          message: 'Kakao token info response is invalid',
        },
      );
      const userInfo = parseOrThrow(
        kakaoUserInfoSchema,
        await parseJsonResponse(userInfoResponse),
        {
          message: 'Kakao user info response is invalid',
        },
      );

      if (tokenInfo.id !== userInfo.id) {
        throw new AppError('UNAUTHORIZED', {
          message: 'Kakao user identity does not match the token',
        });
      }

      return {
        provider: 'kakao',
        providerEmail: userInfo.kakao_account?.email ?? null,
        providerUserId: userInfo.id,
      };
    },
  };
}
