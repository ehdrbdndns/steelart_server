import type {
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';

import { AppError } from '../../shared/api/errors.js';
import { withConnection } from '../../shared/db/pool.js';
import { withTransaction } from '../../shared/db/tx.js';
import type { UserRecord } from '../users/types.js';
import type {
  AuthProvider,
  RefreshTokenRecord,
  SocialIdentity,
} from './types.js';

interface UserRow extends RowDataPacket {
  age_group: UserRecord['age_group'];
  created_at: UserRecord['created_at'];
  id: number;
  language: UserRecord['language'];
  nickname: string | null;
  notifications_enabled: number | boolean;
  residency: UserRecord['residency'];
  updated_at: UserRecord['updated_at'];
}

interface RefreshTokenRow extends RowDataPacket {
  created_at: RefreshTokenRecord['created_at'];
  expires_at: RefreshTokenRecord['expires_at'];
  id: number;
  revoked_at: RefreshTokenRecord['revoked_at'];
  refresh_token: string;
  updated_at: RefreshTokenRecord['updated_at'];
  user_id: number;
}

export interface CreateUserWithIdentityInput {
  identity: SocialIdentity;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface AuthRepository {
  createUserWithIdentityAndRefreshToken(input: CreateUserWithIdentityInput): Promise<UserRecord>;
  createRefreshTokenRecord(userId: number, refreshToken: string, expiresAt: Date): Promise<void>;
  findRefreshToken(refreshToken: string): Promise<RefreshTokenRecord | null>;
  findUserByProviderIdentity(provider: AuthProvider, providerUserId: string): Promise<UserRecord | null>;
}

const USER_SELECT_COLUMNS = [
  'u.id',
  'u.nickname',
  'u.residency',
  'u.age_group',
  'u.language',
  'u.notifications_enabled',
  'u.created_at',
  'u.updated_at',
].join(', ');

function mapUserRow(row: UserRow): UserRecord {
  const trimmedNickname = row.nickname?.trim();
  const normalizedNickname = trimmedNickname ? trimmedNickname : '';

  return {
    age_group: row.age_group,
    created_at: row.created_at,
    id: row.id,
    language: row.language,
    nickname: normalizedNickname,
    notifications_enabled: row.notifications_enabled === true || row.notifications_enabled === 1,
    residency: row.residency,
    updated_at: row.updated_at,
  };
}

function mapRefreshTokenRow(row: RefreshTokenRow): RefreshTokenRecord {
  return {
    created_at: row.created_at,
    expires_at: row.expires_at,
    id: row.id,
    refresh_token: row.refresh_token,
    revoked_at: row.revoked_at,
    updated_at: row.updated_at,
    user_id: row.user_id,
  };
}

export const authRepository: AuthRepository = {
  async createUserWithIdentityAndRefreshToken(input) {
    return withTransaction(async (connection) => {
      const now = new Date();

      const [userInsertResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO users (
            nickname,
            residency,
            age_group,
            language,
            notifications_enabled,
            created_at,
            updated_at
          ) VALUES ('', NULL, NULL, 'ko', 1, ?, ?)`,
        [now, now],
      );

      const userId = userInsertResult.insertId;

      await connection.execute<ResultSetHeader>(
        `INSERT INTO user_auth_providers (
            user_id,
            provider,
            provider_user_id,
            created_at
          ) VALUES (?, ?, ?, ?)`,
        [
          userId,
          input.identity.provider.toUpperCase(),
          input.identity.providerUserId,
          now,
        ],
      );

      await connection.execute<ResultSetHeader>(
        `INSERT INTO user_refresh_tokens (
            user_id,
            refresh_token,
            expires_at,
            revoked_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, NULL, ?, ?)`,
        [userId, input.refreshToken, input.refreshTokenExpiresAt, now, now],
      );

      const [rows] = await connection.execute<UserRow[]>(
        `SELECT ${USER_SELECT_COLUMNS}
          FROM users u
          WHERE u.id = ?
          LIMIT 1`,
        [userId],
      );
      const user = rows[0] ? mapUserRow(rows[0]) : null;

      if (!user) {
        throw new AppError('INTERNAL_ERROR', {
          message: 'Created user could not be reloaded',
        });
      }

      return user;
    });
  },

  async findRefreshToken(refreshToken) {
    return withConnection(async (connection) => {
      const [rows] = await connection.execute<RefreshTokenRow[]>(
        `SELECT
            rt.id,
            rt.user_id,
            rt.refresh_token,
            rt.expires_at,
            rt.revoked_at,
            rt.created_at,
            rt.updated_at
          FROM user_refresh_tokens rt
          WHERE rt.refresh_token = ?
          LIMIT 1`,
        [refreshToken],
      );

      return rows[0] ? mapRefreshTokenRow(rows[0]) : null;
    });
  },

  async findUserByProviderIdentity(provider, providerUserId) {
    return withConnection(async (connection) => {
      const [rows] = await connection.execute<UserRow[]>(
        `SELECT ${USER_SELECT_COLUMNS}
          FROM user_auth_providers p
          JOIN users u
            ON u.id = p.user_id
          WHERE p.provider = ?
            AND p.provider_user_id = ?
          LIMIT 1`,
        [provider.toUpperCase(), providerUserId],
      );

      return rows[0] ? mapUserRow(rows[0]) : null;
    });
  },

  async createRefreshTokenRecord(userId, refreshToken, expiresAt) {
    await withConnection(async (connection) => {
      const [rows] = await connection.execute<UserRow[]>(
        `SELECT ${USER_SELECT_COLUMNS}
          FROM users u
          WHERE u.id = ?
          LIMIT 1`,
        [userId],
      );
      const user = rows[0] ? mapUserRow(rows[0]) : null;

      if (!user) {
        throw new AppError('UNAUTHORIZED', {
          message: 'Authenticated user was not found',
        });
      }

      const now = new Date();

      await connection.execute<ResultSetHeader>(
        `INSERT INTO user_refresh_tokens (
            user_id,
            refresh_token,
            expires_at,
            revoked_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, NULL, ?, ?)`,
        [userId, refreshToken, expiresAt, now, now],
      );
    });
  },
};
