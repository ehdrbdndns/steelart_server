import {
  createPublicKey,
  createVerify,
} from 'node:crypto';

import { z } from 'zod';

import { AppError } from '../../api/errors.js';
import { getEnv } from '../../env/server.js';
import { parseOrThrow } from '../../validation/parse.js';
import type {
  AppleAuthProviderClient,
  AppleLoginInput,
} from '../../../domains/auth/types.js';

const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_KEY_CACHE_TTL_MS = 60 * 60 * 1000;

const appleJwtHeaderSchema = z.object({
  alg: z.literal('RS256'),
  kid: z.string().min(1),
}).passthrough();

const appleJwtPayloadSchema = z.object({
  aud: z.string().min(1),
  email: z.string().email().nullable().optional(),
  exp: z.number().int(),
  iat: z.number().int(),
  iss: z.string().min(1),
  sub: z.string().min(1),
}).passthrough();

const appleJwkSchema = z.object({
  alg: z.string().optional(),
  e: z.string().min(1),
  kid: z.string().min(1),
  kty: z.literal('RSA'),
  n: z.string().min(1),
  use: z.string().optional(),
});

const appleJwksSchema = z.object({
  keys: z.array(appleJwkSchema).min(1),
});

type AppleJwk = z.output<typeof appleJwkSchema>;

interface AppleProviderOptions {
  fetch?: typeof fetch;
}

interface DecodedAppleToken {
  header: z.output<typeof appleJwtHeaderSchema>;
  payload: z.output<typeof appleJwtPayloadSchema>;
  signature: Buffer;
  signingInput: string;
}

let cachedKeys: {
  fetchedAt: number;
  keys: AppleJwk[];
} | null = null;

function decodeJwtPart(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch (error) {
    throw new AppError('UNAUTHORIZED', {
      cause: error,
      message: 'Apple identity token format is invalid',
    });
  }
}

function decodeAppleToken(identityToken: string): DecodedAppleToken {
  const parts = identityToken.split('.');

  if (parts.length !== 3) {
    throw new AppError('UNAUTHORIZED', {
      message: 'Apple identity token format is invalid',
    });
  }

  const [headerPart, payloadPart, signaturePart] = parts;

  return {
    header: parseOrThrow(appleJwtHeaderSchema, decodeJwtPart(headerPart), {
      message: 'Apple identity token header is invalid',
    }),
    payload: parseOrThrow(appleJwtPayloadSchema, decodeJwtPart(payloadPart), {
      message: 'Apple identity token payload is invalid',
    }),
    signature: Buffer.from(signaturePart, 'base64url'),
    signingInput: `${headerPart}.${payloadPart}`,
  };
}

async function fetchAppleKeys(fetcher: typeof fetch): Promise<AppleJwk[]> {
  const now = Date.now();

  if (cachedKeys && now - cachedKeys.fetchedAt < APPLE_KEY_CACHE_TTL_MS) {
    return cachedKeys.keys;
  }

  let response: Response;

  try {
    response = await fetcher(APPLE_JWKS_URL);
  } catch (error) {
    throw new AppError('INTERNAL_ERROR', {
      cause: error,
      message: 'Failed to reach Apple authentication service',
    });
  }

  if (!response.ok) {
    throw new AppError('INTERNAL_ERROR', {
      details: {
        status: response.status,
      },
      message: 'Apple public key response is invalid',
    });
  }

  const payload = parseOrThrow(appleJwksSchema, await response.json(), {
    message: 'Apple public key response is invalid',
  });

  cachedKeys = {
    fetchedAt: now,
    keys: payload.keys,
  };

  return payload.keys;
}

function verifyAppleSignature(token: DecodedAppleToken, jwk: AppleJwk): boolean {
  const publicKey = createPublicKey({
    format: 'jwk',
    key: jwk as never,
  });
  const verifier = createVerify('RSA-SHA256');

  verifier.update(token.signingInput);
  verifier.end();

  return verifier.verify(publicKey, token.signature);
}

export function createAppleAuthProvider(
  options: AppleProviderOptions = {},
): AppleAuthProviderClient {
  const fetcher = options.fetch ?? globalThis.fetch;

  if (!fetcher) {
    throw new AppError('INTERNAL_ERROR', {
      message: 'Fetch API is not available',
    });
  }

  return {
    async getIdentity(input: AppleLoginInput) {
      void input.authorizationCode;

      const decodedToken = decodeAppleToken(input.identityToken);
      const appleKeys = await fetchAppleKeys(fetcher);
      const matchingKey = appleKeys.find((key) => key.kid === decodedToken.header.kid);

      if (!matchingKey || !verifyAppleSignature(decodedToken, matchingKey)) {
        throw new AppError('UNAUTHORIZED', {
          message: 'Apple identity token signature is invalid',
        });
      }

      if (decodedToken.payload.iss !== APPLE_ISSUER) {
        throw new AppError('UNAUTHORIZED', {
          message: 'Apple identity token issuer is invalid',
        });
      }

      const configuredAudience = getEnv().APPLE_CLIENT_ID;

      if (configuredAudience && decodedToken.payload.aud !== configuredAudience) {
        throw new AppError('UNAUTHORIZED', {
          message: 'Apple identity token audience is invalid',
        });
      }

      if (decodedToken.payload.exp <= Math.floor(Date.now() / 1000)) {
        throw new AppError('UNAUTHORIZED', {
          message: 'Apple identity token expired',
        });
      }

      return {
        provider: 'apple',
        providerEmail: decodedToken.payload.email ?? null,
        providerUserId: decodedToken.payload.sub,
      };
    },
  };
}
