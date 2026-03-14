import type {
  Pool,
  PoolConnection,
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
  RefreshTokenWithUser,
  SocialIdentity,
} from './types.js';

type QueryExecutor = Pick<Pool | PoolConnection, 'execute'>;

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

interface RefreshTokenJoinRow extends UserRow {
  refresh_created_at: RefreshTokenRecord['created_at'];
  refresh_expires_at: RefreshTokenRecord['expires_at'];
  refresh_id: number;
  refresh_revoked_at: RefreshTokenRecord['revoked_at'];
  refresh_token: string;
  refresh_updated_at: RefreshTokenRecord['updated_at'];
  refresh_user_id: number;
}

export interface CreateUserWithIdentityInput {
  identity: SocialIdentity;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface AuthRepository {
  createUserWithIdentityAndRefreshToken(input: CreateUserWithIdentityInput): Promise<UserRecord>;
  findRefreshTokenWithUser(refreshToken: string): Promise<RefreshTokenWithUser | null>;
  findUserByProviderIdentity(provider: AuthProvider, providerUserId: string): Promise<UserRecord | null>;
  storeRefreshToken(userId: number, refreshToken: string, expiresAt: Date): Promise<void>;
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
  return {
    age_group: row.age_group,
    created_at: row.created_at,
    id: row.id,
    language: row.language,
    nickname: row.nickname,
    notifications_enabled: row.notifications_enabled === true || row.notifications_enabled === 1,
    residency: row.residency,
    updated_at: row.updated_at,
  };
}

function mapRefreshTokenJoinRow(row: RefreshTokenJoinRow): RefreshTokenWithUser {
  return {
    refreshToken: {
      created_at: row.refresh_created_at,
      expires_at: row.refresh_expires_at,
      id: row.refresh_id,
      refresh_token: row.refresh_token,
      revoked_at: row.refresh_revoked_at,
      updated_at: row.refresh_updated_at,
      user_id: row.refresh_user_id,
    },
    user: mapUserRow(row),
  };
}

async function findUserByIdWithExecutor(
  executor: QueryExecutor,
  userId: number,
): Promise<UserRecord | null> {
  const [rows] = await executor.execute<UserRow[]>(
    `SELECT ${USER_SELECT_COLUMNS}
       FROM users u
      WHERE u.id = ?
      LIMIT 1`,
    [userId],
  );

  return rows[0] ? mapUserRow(rows[0]) : null;
}

async function insertRefreshTokenWithExecutor(
  executor: QueryExecutor,
  userId: number,
  refreshToken: string,
  expiresAt: Date,
): Promise<void> {
  const now = new Date();

  await executor.execute<ResultSetHeader>(
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
}

export const mysqlAuthRepository: AuthRepository = {
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
          ) VALUES (NULL, NULL, NULL, 'ko', 1, ?, ?)`,
        [now, now],
      );

      const userId = userInsertResult.insertId;

      await connection.execute<ResultSetHeader>(
        `INSERT INTO user_auth_providers (
            user_id,
            provider,
            provider_user_id,
            provider_email,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          input.identity.provider,
          input.identity.providerUserId,
          input.identity.providerEmail,
          now,
          now,
        ],
      );

      await insertRefreshTokenWithExecutor(
        connection,
        userId,
        input.refreshToken,
        input.refreshTokenExpiresAt,
      );

      const user = await findUserByIdWithExecutor(connection, userId);

      if (!user) {
        throw new AppError('INTERNAL_ERROR', {
          message: 'Created user could not be reloaded',
        });
      }

      return user;
    });
  },

  async findRefreshTokenWithUser(refreshToken) {
    return withConnection(async (connection) => {
      const [rows] = await connection.execute<RefreshTokenJoinRow[]>(
        `SELECT
            rt.id AS refresh_id,
            rt.user_id AS refresh_user_id,
            rt.refresh_token,
            rt.expires_at AS refresh_expires_at,
            rt.revoked_at AS refresh_revoked_at,
            rt.created_at AS refresh_created_at,
            rt.updated_at AS refresh_updated_at,
            ${USER_SELECT_COLUMNS}
           FROM user_refresh_tokens rt
           JOIN users u
             ON u.id = rt.user_id
          WHERE rt.refresh_token = ?
          LIMIT 1`,
        [refreshToken],
      );

      return rows[0] ? mapRefreshTokenJoinRow(rows[0]) : null;
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
        [provider, providerUserId],
      );

      return rows[0] ? mapUserRow(rows[0]) : null;
    });
  },

  async storeRefreshToken(userId, refreshToken, expiresAt) {
    await withConnection(async (connection) => {
      const user = await findUserByIdWithExecutor(connection, userId);

      if (!user) {
        throw new AppError('UNAUTHORIZED', {
          message: 'Authenticated user was not found',
        });
      }

      await insertRefreshTokenWithExecutor(connection, userId, refreshToken, expiresAt);
    });
  },
};
