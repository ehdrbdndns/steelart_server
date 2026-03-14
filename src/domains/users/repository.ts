import type {
  Pool,
  PoolConnection,
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

async function updateUserWithExecutor(
  executor: QueryExecutor,
  userId: number,
  setClause: string,
  values: Array<string | number | Date | null>,
): Promise<UserRecord> {
  const now = new Date();
  const [result] = await executor.execute<ResultSetHeader>(
    `UPDATE users
        SET ${setClause},
            updated_at = ?
      WHERE id = ?`,
    [...values, now, userId],
  );

  if (result.affectedRows === 0) {
    throw new AppError('NOT_FOUND', {
      message: 'User not found',
    });
  }

  const updatedUser = await findUserByIdWithExecutor(executor, userId);

  if (!updatedUser) {
    throw new AppError('INTERNAL_ERROR', {
      message: 'Updated user could not be reloaded',
    });
  }

  return updatedUser;
}

export const mysqlUsersRepository: UsersRepository = {
  async findUserById(userId) {
    return withConnection((connection) => findUserByIdWithExecutor(connection, userId));
  },

  async updateLanguage(userId, input) {
    return withConnection((connection) =>
      updateUserWithExecutor(
        connection,
        userId,
        'language = ?',
        [input.language],
      ));
  },

  async updateNotifications(userId, input) {
    return withConnection((connection) =>
      updateUserWithExecutor(
        connection,
        userId,
        'notifications_enabled = ?',
        [input.notifications_enabled ? 1 : 0],
      ));
  },

  async updateOnboarding(userId, input) {
    return withConnection((connection) =>
      updateUserWithExecutor(
        connection,
        userId,
        'nickname = ?, residency = ?, age_group = ?',
        [input.nickname, input.residency, input.age_group],
      ));
  },

  async updateProfile(userId, input) {
    return withConnection((connection) =>
      updateUserWithExecutor(
        connection,
        userId,
        'nickname = ?, residency = ?, age_group = ?',
        [input.nickname, input.residency, input.age_group],
      ));
  },
};
