import type {
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';

import { AppError } from '../../shared/api/errors.js';
import { withConnection } from '../../shared/db/pool.js';
import type {
  LanguageUpdateInput,
  NotificationsUpdateInput,
  OnboardingUpdateInput,
  ProfileUpdateInput,
  UserRecord,
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

export interface UsersRepository {
  findUserById(userId: number): Promise<UserRecord | null>;
  updateLanguage(userId: number, input: LanguageUpdateInput): Promise<UserRecord>;
  updateNotifications(userId: number, input: NotificationsUpdateInput): Promise<UserRecord>;
  updateOnboarding(userId: number, input: OnboardingUpdateInput): Promise<UserRecord>;
  updateProfile(userId: number, input: ProfileUpdateInput): Promise<UserRecord>;
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

export const usersRepository: UsersRepository = {
  async findUserById(userId) {
    return withConnection(async (connection) => {
      const [rows] = await connection.execute<UserRow[]>(
        `SELECT ${USER_SELECT_COLUMNS}
          FROM users u
          WHERE u.id = ?
          LIMIT 1`,
        [userId],
      );

      return rows[0] ? mapUserRow(rows[0]) : null;
    });
  },

  async updateLanguage(userId, input) {
    return withConnection(async (connection) => {
      const now = new Date();
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE users
            SET language = ?,
                updated_at = ?
          WHERE id = ?`,
        [input.language, now, userId],
      );

      if (result.affectedRows === 0) {
        throw new AppError('NOT_FOUND', {
          message: 'User not found',
        });
      }

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
          message: 'Updated user could not be reloaded',
        });
      }

      return user;
    });
  },

  async updateNotifications(userId, input) {
    return withConnection(async (connection) => {
      const now = new Date();
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE users
            SET notifications_enabled = ?,
                updated_at = ?
          WHERE id = ?`,
        [input.notifications_enabled ? 1 : 0, now, userId],
      );

      if (result.affectedRows === 0) {
        throw new AppError('NOT_FOUND', {
          message: 'User not found',
        });
      }

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
          message: 'Updated user could not be reloaded',
        });
      }

      return user;
    });
  },

  async updateOnboarding(userId, input) {
    return withConnection(async (connection) => {
      const now = new Date();
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE users
            SET nickname = ?,
                residency = ?,
                age_group = ?,
                updated_at = ?
          WHERE id = ?`,
        [input.nickname, input.residency, input.age_group, now, userId],
      );

      if (result.affectedRows === 0) {
        throw new AppError('NOT_FOUND', {
          message: 'User not found',
        });
      }

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
          message: 'Updated user could not be reloaded',
        });
      }

      return user;
    });
  },

  async updateProfile(userId, input) {
    return withConnection(async (connection) => {
      const now = new Date();
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE users
            SET nickname = ?,
                residency = ?,
                age_group = ?,
                updated_at = ?
          WHERE id = ?`,
        [input.nickname, input.residency, input.age_group, now, userId],
      );

      if (result.affectedRows === 0) {
        throw new AppError('NOT_FOUND', {
          message: 'User not found',
        });
      }

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
          message: 'Updated user could not be reloaded',
        });
      }

      return user;
    });
  },
};
