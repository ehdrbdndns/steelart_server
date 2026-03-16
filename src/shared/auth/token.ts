import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { AppError } from '../api/errors.js';
import { getEnv } from '../env/server.js';

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_DAYS = 30;
const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

interface JwtHeader {
  alg: 'HS256';
  typ: 'JWT';
}

export interface AccessTokenClaims {
  exp: number;
  iat: number;
  sub: number;
  type: 'access';
}

export interface AccessTokenOptions {
  now?: Date;
  secret?: string;
  ttlSeconds?: number;
}

export interface VerifyAccessTokenOptions {
  now?: Date;
  secret?: string;
}

interface JwtParts {
  header: unknown;
  payload: unknown;
  signature: string;
  signingInput: string;
}

function getJwtSecret(secret?: string): string {
  return secret ?? getEnv().JWT_SECRET;
}

function toUnixSeconds(value: Date): number {
  return Math.floor(value.getTime() / 1000);
}

function encodeJwtPart(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeJwtPart(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch (error) {
    throw new AppError('UNAUTHORIZED', {
      cause: error,
      message: 'JWT format is invalid',
    });
  }
}

function createSignature(signingInput: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(signingInput).digest();
}

function parseJwt(token: string): JwtParts {
  const parts = token.split('.');

  if (parts.length !== 3) {
    throw new AppError('UNAUTHORIZED', {
      message: 'JWT format is invalid',
    });
  }

  const [headerPart, payloadPart, signature] = parts;

  return {
    header: decodeJwtPart(headerPart),
    payload: decodeJwtPart(payloadPart),
    signature,
    signingInput: `${headerPart}.${payloadPart}`,
  };
}

function assertJwtHeader(header: unknown): asserts header is JwtHeader {
  if (
    typeof header !== 'object'
    || header === null
    || (header as Record<string, unknown>).alg !== 'HS256'
    || (header as Record<string, unknown>).typ !== 'JWT'
  ) {
    throw new AppError('UNAUTHORIZED', {
      message: 'JWT header is invalid',
    });
  }
}

function assertAccessTokenClaims(payload: unknown): asserts payload is AccessTokenClaims {
  if (typeof payload !== 'object' || payload === null) {
    throw new AppError('UNAUTHORIZED', {
      message: 'JWT payload is invalid',
    });
  }

  const claims = payload as Record<string, unknown>;

  if (
    typeof claims.sub !== 'number'
    || !Number.isInteger(claims.sub)
    || claims.sub <= 0
    || claims.type !== 'access'
    || typeof claims.iat !== 'number'
    || !Number.isInteger(claims.iat)
    || typeof claims.exp !== 'number'
    || !Number.isInteger(claims.exp)
  ) {
    throw new AppError('UNAUTHORIZED', {
      message: 'JWT payload is invalid',
    });
  }
}

function assertSignature(signature: string, expectedSignature: Buffer): void {
  let actualSignature: Buffer;

  try {
    actualSignature = Buffer.from(signature, 'base64url');
  } catch (error) {
    throw new AppError('UNAUTHORIZED', {
      cause: error,
      message: 'JWT signature is invalid',
    });
  }

  if (
    actualSignature.length !== expectedSignature.length
    || !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    throw new AppError('UNAUTHORIZED', {
      message: 'JWT signature is invalid',
    });
  }
}

export function signAccessToken(userId: number, options: AccessTokenOptions = {}): string {
  const now = options.now ?? new Date();
  const ttlSeconds = options.ttlSeconds ?? ACCESS_TOKEN_TTL_SECONDS;
  const iat = toUnixSeconds(now);
  const header: JwtHeader = {
    alg: 'HS256',
    typ: 'JWT',
  };
  const payload: AccessTokenClaims = {
    exp: iat + ttlSeconds,
    iat,
    sub: userId,
    type: 'access',
  };
  const signingInput = `${encodeJwtPart(header)}.${encodeJwtPart(payload)}`;
  const signature = createSignature(signingInput, getJwtSecret(options.secret)).toString('base64url');

  return `${signingInput}.${signature}`;
}

export function verifyAccessToken(
  token: string,
  options: VerifyAccessTokenOptions = {},
): AccessTokenClaims {
  const parsed = parseJwt(token);
  assertJwtHeader(parsed.header);
  assertAccessTokenClaims(parsed.payload);
  assertSignature(parsed.signature, createSignature(parsed.signingInput, getJwtSecret(options.secret)));

  const nowSeconds = toUnixSeconds(options.now ?? new Date());

  if (parsed.payload.exp <= nowSeconds) {
    throw new AppError('ACCESS_TOKEN_EXPIRED', {
      message: 'Access token expired',
    });
  }

  return parsed.payload;
}

export function createRefreshToken(size = 32): string {
  return randomBytes(size).toString('base64url');
}

export function getRefreshTokenExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
}

export function isExpiredAt(value: Date | string, now = new Date()): boolean {
  const date = value instanceof Date ? value : new Date(value);
  return date.getTime() <= now.getTime();
}
