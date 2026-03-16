import {
  createPublicKey,
  createVerify,
} from 'node:crypto';

import { z } from 'zod';

import { AppError } from '../../api/errors.js';
import { getEnv } from '../../env/server.js';
import { parseInput } from '../../validation/parse.js';
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

async function loadAppleKeys(now: number): Promise<AppleJwk[]> {
  if (cachedKeys && now - cachedKeys.fetchedAt < APPLE_KEY_CACHE_TTL_MS) {
    return cachedKeys.keys;
  }

  let response: Response;

  try {
    response = await fetch(APPLE_JWKS_URL);
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

  let jwksPayloadRaw: unknown;

  try {
    jwksPayloadRaw = await response.json();
  } catch (error) {
    throw new AppError('INTERNAL_ERROR', {
      cause: error,
      message: 'Apple public key response is invalid',
    });
  }

  const jwksPayload = parseInput({
    schema: appleJwksSchema,
    input: jwksPayloadRaw,
    message: 'Apple public key response is invalid',
  });

  cachedKeys = {
    fetchedAt: now,
    keys: jwksPayload.keys,
  };

  return jwksPayload.keys;
}

export function createAppleAuthProvider(): AppleAuthProviderClient {
  return {
    async getIdentity(input: AppleLoginInput) {
      void input.authorizationCode;

      const parts = input.identityToken.split('.');

      if (parts.length !== 3) {
        throw new AppError('UNAUTHORIZED', {
          message: 'Apple identity token format is invalid',
        });
      }

      const [headerPart, payloadPart, signaturePart] = parts;
      const header = parseInput({
        schema: appleJwtHeaderSchema,
        input: decodeJwtPart(headerPart),
        message: 'Apple identity token header is invalid',
      });
      const payload = parseInput({
        schema: appleJwtPayloadSchema,
        input: decodeJwtPart(payloadPart),
        message: 'Apple identity token payload is invalid',
      });
      const signature = Buffer.from(signaturePart, 'base64url');
      const signingInput = `${headerPart}.${payloadPart}`;

      const now = Date.now();
      const appleKeys = await loadAppleKeys(now);

      const matchingKey = appleKeys.find((key) => key.kid === header.kid);

      if (!matchingKey) {
        throw new AppError('UNAUTHORIZED', {
          message: 'Apple identity token signature is invalid',
        });
      }

      const publicKey = createPublicKey({
        format: 'jwk',
        key: matchingKey as never,
      });
      const verifier = createVerify('RSA-SHA256');

      verifier.update(signingInput);
      verifier.end();

      if (!verifier.verify(publicKey, signature)) {
        throw new AppError('UNAUTHORIZED', {
          message: 'Apple identity token signature is invalid',
        });
      }

      if (payload.iss !== APPLE_ISSUER) {
        throw new AppError('UNAUTHORIZED', {
          message: 'Apple identity token issuer is invalid',
        });
      }

      const configuredAudience = getEnv().APPLE_CLIENT_ID;

      if (configuredAudience && payload.aud !== configuredAudience) {
        throw new AppError('UNAUTHORIZED', {
          message: 'Apple identity token audience is invalid',
        });
      }

      if (payload.exp <= Math.floor(now / 1000)) {
        throw new AppError('UNAUTHORIZED', {
          message: 'Apple identity token expired',
        });
      }

      return {
        provider: 'apple',
        providerEmail: payload.email ?? null,
        providerUserId: payload.sub,
      };
    },
  };
}
