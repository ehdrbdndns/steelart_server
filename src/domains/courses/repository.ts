import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';

import { withConnection } from '../../shared/db/pool.js';
import { withTransaction } from '../../shared/db/tx.js';
import type {
  CourseCheckinTarget,
  CourseDetail,
  CourseDetailItem,
  FavoriteCoursesResponse,
  CourseListInput,
  CourseListItem,
  CourseRecord,
  CreateCourseInput,
  RecentCommunityCourseListInput,
  StampProgress,
  UpdateCourseInput,
} from './types.js';

type SqlParam = string | number | bigint | boolean | Date | null;

interface CountRow extends RowDataPacket {
  total: number;
}

interface CourseListBaseRow extends RowDataPacket {
  description_en: string | null;
  description_ko: string | null;
  id: number;
  is_official: number | boolean;
  title_en: string;
  title_ko: string;
}

interface CourseListMetaRow extends RowDataPacket {
  course_id: number;
  description_en: string | null;
  description_ko: string | null;
  end_place_name_en: string | null;
  end_place_name_ko: string | null;
  checked_in_count: number;
  liked: number | boolean;
  start_place_name_en: string | null;
  start_place_name_ko: string | null;
  thumbnail_image_height: number | null;
  thumbnail_image_url: string | null;
  thumbnail_image_width: number | null;
  total_count: number;
}

interface CourseDetailSummaryRow extends RowDataPacket {
  description_en: string | null;
  description_ko: string | null;
  editable: number | boolean;
  id: number;
  is_official: number | boolean;
  liked: number | boolean;
  title_en: string;
  title_ko: string;
}

interface CourseDetailItemRow extends RowDataPacket {
  artwork_id: number;
  artist_name_en: string;
  artist_name_ko: string;
  checked_in: number | boolean;
  id: number;
  lat: number;
  lng: number;
  place_name_en: string;
  place_name_ko: string;
  seq: number;
  thumbnail_image_height: number | null;
  thumbnail_image_url: string | null;
  thumbnail_image_width: number | null;
  title_en: string;
  title_ko: string;
}

interface CourseRecordRow extends RowDataPacket {
  created_by_user_id: number | null;
  id: number;
  is_official: number | boolean;
}

interface IdRow extends RowDataPacket {
  id: number;
}

interface CourseCheckinTargetRow extends RowDataPacket {
  already_checked_in: number | boolean;
  lat: number;
  lng: number;
}

interface CourseStampProgressRow extends RowDataPacket {
  checked_in_count: number;
  total_count: number;
}

const FIRST_ARTWORK_THUMBNAIL_SQL = `
  SELECT ai.artwork_id, ai.image_url, ai.image_width, ai.image_height
  FROM artwork_images ai
  INNER JOIN (
    SELECT artwork_id, MIN(id) AS first_image_id
    FROM artwork_images
    GROUP BY artwork_id
  ) first_ai
    ON first_ai.first_image_id = ai.id
`;

function buildInClausePlaceholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

function mapStampProgress(checkedInCount: number, totalCount: number): StampProgress {
  return {
    checkedInCount,
    totalCount,
  };
}

function mapCourseListRow(
  baseRow: CourseListBaseRow,
  metaRow: CourseListMetaRow | undefined,
  includeStampProgress: boolean,
): CourseListItem {
  return {
    description_en: baseRow.description_en,
    description_ko: baseRow.description_ko,
    end_place_name_en: metaRow?.end_place_name_en ?? null,
    end_place_name_ko: metaRow?.end_place_name_ko ?? null,
    id: baseRow.id,
    is_official: baseRow.is_official === true || baseRow.is_official === 1,
    liked: metaRow?.liked === true || metaRow?.liked === 1,
    stampProgress: includeStampProgress
      ? mapStampProgress(
        Number(metaRow?.checked_in_count ?? 0),
        Number(metaRow?.total_count ?? 0),
      )
      : null,
    start_place_name_en: metaRow?.start_place_name_en ?? null,
    start_place_name_ko: metaRow?.start_place_name_ko ?? null,
    thumbnail_image_height: metaRow?.thumbnail_image_height ?? null,
    thumbnail_image_url: metaRow?.thumbnail_image_url ?? null,
    thumbnail_image_width: metaRow?.thumbnail_image_width ?? null,
    title_en: baseRow.title_en,
    title_ko: baseRow.title_ko,
  };
}

function mapCourseDetailItemRow(row: CourseDetailItemRow): CourseDetailItem {
  return {
    artwork_id: row.artwork_id,
    artist_name_en: row.artist_name_en,
    artist_name_ko: row.artist_name_ko,
    checkedIn: row.checked_in === true || row.checked_in === 1,
    id: row.id,
    lat: Number(row.lat),
    lng: Number(row.lng),
    place_name_en: row.place_name_en,
    place_name_ko: row.place_name_ko,
    seq: row.seq,
    thumbnail_image_height: row.thumbnail_image_height,
    thumbnail_image_url: row.thumbnail_image_url,
    thumbnail_image_width: row.thumbnail_image_width,
    title_en: row.title_en,
    title_ko: row.title_ko,
  };
}

function mapCourseRecordRow(row: CourseRecordRow): CourseRecord {
  return {
    created_by_user_id: row.created_by_user_id,
    id: row.id,
    is_official: row.is_official === true || row.is_official === 1,
  };
}

function mapCourseDetailRows(
  summaryRow: CourseDetailSummaryRow,
  itemRows: CourseDetailItemRow[],
): CourseDetail {
  const isOfficial = summaryRow.is_official === true || summaryRow.is_official === 1;
  const checkedInCount = itemRows.filter((row) => row.checked_in === true || row.checked_in === 1).length;
  const totalCount = itemRows.length;

  return {
    description_en: summaryRow.description_en,
    description_ko: summaryRow.description_ko,
    editable: summaryRow.editable === true || summaryRow.editable === 1,
    id: summaryRow.id,
    is_official: isOfficial,
    items: itemRows.map(mapCourseDetailItemRow),
    liked: summaryRow.liked === true || summaryRow.liked === 1,
    stampProgress: isOfficial ? mapStampProgress(checkedInCount, totalCount) : null,
    title_en: summaryRow.title_en,
    title_ko: summaryRow.title_ko,
  };
}

function buildCourseListPageSql(whereSql: string): string {
  return `SELECT
      c.id,
      c.title_ko,
      c.title_en,
      c.description_ko,
      c.description_en,
      c.is_official
    FROM courses c
    WHERE ${whereSql}
    ORDER BY c.updated_at DESC, c.id DESC
    LIMIT ?
    OFFSET ?`;
}

function buildCourseListMetaSql(
  courseIdsCount: number,
  includeStampProgress: boolean,
): string {
  const placeholders = buildInClausePlaceholders(courseIdsCount);
  const progressSelectSql = includeStampProgress
    ? `COALESCE(progress.checked_in_count, 0) AS checked_in_count,
      COALESCE(progress.total_count, 0) AS total_count`
    : `0 AS checked_in_count,
      0 AS total_count`;
  const progressJoinSql = includeStampProgress
    ? `LEFT JOIN (
      SELECT
        ci.course_id,
        COUNT(ci.id) AS total_count,
        COUNT(DISTINCT cc.course_item_id) AS checked_in_count
      FROM course_items ci
      INNER JOIN artworks a
        ON a.id = ci.artwork_id
       AND a.deleted_at IS NULL
      INNER JOIN artists ar
        ON ar.id = a.artist_id
       AND ar.deleted_at IS NULL
      INNER JOIN places p
        ON p.id = a.place_id
       AND p.deleted_at IS NULL
      LEFT JOIN course_checkins cc
        ON cc.course_item_id = ci.id
       AND cc.user_id = ?
      GROUP BY ci.course_id
    ) progress
      ON progress.course_id = c.id`
    : '';

  return `SELECT
      c.id AS course_id,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM course_likes cl
          WHERE cl.user_id = ?
            AND cl.course_id = c.id
          LIMIT 1
        ) THEN 1
        ELSE 0
      END AS liked,
      ${progressSelectSql},
      start_place.name_ko AS start_place_name_ko,
      start_place.name_en AS start_place_name_en,
      end_place.name_ko AS end_place_name_ko,
      end_place.name_en AS end_place_name_en,
      first_thumb.image_url AS thumbnail_image_url,
      first_thumb.image_width AS thumbnail_image_width,
      first_thumb.image_height AS thumbnail_image_height
    FROM courses c
    LEFT JOIN course_items first_course_item
      ON first_course_item.course_id = c.id
     AND first_course_item.seq = (
       SELECT MIN(ci_min.seq)
       FROM course_items ci_min
       WHERE ci_min.course_id = c.id
     )
    LEFT JOIN course_items last_course_item
      ON last_course_item.course_id = c.id
     AND last_course_item.seq = (
       SELECT MAX(ci_max.seq)
       FROM course_items ci_max
       WHERE ci_max.course_id = c.id
     )
    LEFT JOIN artworks start_artwork
      ON start_artwork.id = first_course_item.artwork_id
     AND start_artwork.deleted_at IS NULL
    LEFT JOIN places start_place
      ON start_place.id = start_artwork.place_id
     AND start_place.deleted_at IS NULL
    LEFT JOIN artworks end_artwork
      ON end_artwork.id = last_course_item.artwork_id
     AND end_artwork.deleted_at IS NULL
    LEFT JOIN places end_place
      ON end_place.id = end_artwork.place_id
     AND end_place.deleted_at IS NULL
    LEFT JOIN artwork_images first_thumb
      ON first_thumb.artwork_id = first_course_item.artwork_id
     AND first_thumb.id = (
       SELECT MIN(ai_min.id)
       FROM artwork_images ai_min
       WHERE ai_min.artwork_id = first_course_item.artwork_id
     )
    ${progressJoinSql}
    WHERE c.id IN (${placeholders})`;
}

async function hydrateCourseListMetaRows(
  connection: PoolConnection,
  courseIds: number[],
  userId: number,
  includeStampProgress: boolean,
): Promise<Map<number, CourseListMetaRow>> {
  if (courseIds.length === 0) {
    return new Map();
  }

  const sql = buildCourseListMetaSql(courseIds.length, includeStampProgress);
  const params: SqlParam[] = includeStampProgress
    ? [userId, userId, ...courseIds]
    : [userId, ...courseIds];
  const [rows] = await connection.execute<CourseListMetaRow[]>(sql, params);

  return new Map(rows.map((row) => [row.course_id, row]));
}

export interface CoursesRepository {
  createCourse(userId: number, input: CreateCourseInput): Promise<number>;
  createCourseCheckin(userId: number, courseId: number, courseItemId: number): Promise<void>;
  createCourseLike(userId: number, courseId: number): Promise<void>;
  deleteCourseLike(userId: number, courseId: number): Promise<void>;
  findCourseCheckinTarget(
    courseId: number,
    courseItemId: number,
    userId: number,
  ): Promise<CourseCheckinTarget | null>;
  findCourseDetail(courseId: number, userId: number): Promise<CourseDetail | null>;
  findCourseExists(courseId: number): Promise<boolean>;
  findCourseRecord(courseId: number): Promise<CourseRecord | null>;
  findCourseStampProgress(courseId: number, userId: number): Promise<StampProgress>;
  listActiveArtworkIds(artworkIds: number[]): Promise<number[]>;
  listFavoriteCourses(userId: number): Promise<FavoriteCoursesResponse>;
  listMyCourses(input: CourseListInput, userId: number): Promise<{ courses: CourseListItem[]; total: number }>;
  listRecentCommunityCourses(
    input: RecentCommunityCourseListInput,
    userId: number,
  ): Promise<{ courses: CourseListItem[]; total: number }>;
  listRecommendedCourses(
    input: CourseListInput,
    userId: number,
  ): Promise<{ courses: CourseListItem[]; total: number }>;
  softDeleteCourse(courseId: number): Promise<void>;
  updateCourse(courseId: number, input: UpdateCourseInput): Promise<void>;
}

export const coursesRepository: CoursesRepository = {
  async createCourse(userId, input) {
    return withTransaction(async (connection) => {
      const now = new Date();
      const [courseInsertResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO courses (
            title_ko,
            title_en,
            description_ko,
            description_en,
            is_official,
            created_by_user_id,
            likes_count,
            deleted_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, 0, ?, 0, NULL, ?, ?)`,
        [
          input.title_ko,
          input.title_en,
          input.description_ko,
          input.description_en,
          userId,
          now,
          now,
        ],
      );
      const courseId = courseInsertResult.insertId;

      if (input.items.length > 0) {
        const itemPlaceholders = input.items.map(() => '(?, ?, ?, ?)').join(', ');
        const itemValues = input.items.flatMap((item) => [
          courseId,
          item.seq,
          item.artwork_id,
          now,
        ]);

        await connection.execute<ResultSetHeader>(
          `INSERT INTO course_items (course_id, seq, artwork_id, created_at)
           VALUES ${itemPlaceholders}`,
          itemValues,
        );
      }

      return courseId;
    });
  },

  async createCourseCheckin(userId, courseId, courseItemId) {
    await withConnection(async (connection) => {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO course_checkins (user_id, course_id, course_item_id, created_at)
         VALUES (?, ?, ?, NOW())`,
        [userId, courseId, courseItemId],
      );
    });
  },

  async createCourseLike(userId, courseId) {
    await withConnection(async (connection) => {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO course_likes (user_id, course_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE created_at = created_at`,
        [userId, courseId],
      );
    });
  },

  async deleteCourseLike(userId, courseId) {
    await withConnection(async (connection) => {
      await connection.execute<ResultSetHeader>(
        `DELETE FROM course_likes
         WHERE user_id = ?
           AND course_id = ?`,
        [userId, courseId],
      );
    });
  },

  async findCourseCheckinTarget(courseId, courseItemId, userId) {
    return withConnection(async (connection) => {
      const [rows] = await connection.execute<CourseCheckinTargetRow[]>(
        `SELECT
            CAST(p.lat AS DOUBLE) AS lat,
            CAST(p.lng AS DOUBLE) AS lng,
            CASE WHEN cc.course_item_id IS NULL THEN 0 ELSE 1 END AS already_checked_in
         FROM course_items ci
         INNER JOIN artworks a
           ON a.id = ci.artwork_id
          AND a.deleted_at IS NULL
         INNER JOIN artists ar
           ON ar.id = a.artist_id
          AND ar.deleted_at IS NULL
         INNER JOIN places p
           ON p.id = a.place_id
          AND p.deleted_at IS NULL
         LEFT JOIN course_checkins cc
           ON cc.user_id = ?
          AND cc.course_item_id = ci.id
         WHERE ci.course_id = ?
           AND ci.id = ?
         LIMIT 1`,
        [userId, courseId, courseItemId],
      );
      const row = rows[0];

      if (!row) {
        return null;
      }

      return {
        alreadyCheckedIn: row.already_checked_in === true || row.already_checked_in === 1,
        lat: Number(row.lat),
        lng: Number(row.lng),
      };
    });
  },

  async findCourseDetail(courseId, userId) {
    return withConnection(async (connection) => {
      const [summaryRows] = await connection.execute<CourseDetailSummaryRow[]>(
        `SELECT
            c.id,
            c.title_ko,
            c.title_en,
            c.description_ko,
            c.description_en,
            c.is_official,
            CASE WHEN course_like.course_id IS NULL THEN 0 ELSE 1 END AS liked,
            CASE
              WHEN c.is_official = 0 AND c.created_by_user_id = ? THEN 1
              ELSE 0
            END AS editable
         FROM courses c
         LEFT JOIN (
           SELECT DISTINCT course_id
           FROM course_likes
           WHERE user_id = ?
         ) course_like
           ON course_like.course_id = c.id
         WHERE c.id = ?
           AND c.deleted_at IS NULL
         LIMIT 1`,
        [userId, userId, courseId],
      );
      const summary = summaryRows[0];

      if (!summary) {
        return null;
      }

      const [itemRows] = await connection.execute<CourseDetailItemRow[]>(
        `SELECT
            ci.id,
            ci.seq,
            ci.artwork_id,
            a.title_ko,
            a.title_en,
            ar.name_ko AS artist_name_ko,
            ar.name_en AS artist_name_en,
            p.name_ko AS place_name_ko,
            p.name_en AS place_name_en,
            CAST(p.lat AS DOUBLE) AS lat,
            CAST(p.lng AS DOUBLE) AS lng,
            thumb.image_url AS thumbnail_image_url,
            thumb.image_width AS thumbnail_image_width,
            thumb.image_height AS thumbnail_image_height,
            CASE WHEN cc.course_item_id IS NULL THEN 0 ELSE 1 END AS checked_in
         FROM course_items ci
         INNER JOIN artworks a
           ON a.id = ci.artwork_id
          AND a.deleted_at IS NULL
         INNER JOIN artists ar
           ON ar.id = a.artist_id
          AND ar.deleted_at IS NULL
         INNER JOIN places p
           ON p.id = a.place_id
          AND p.deleted_at IS NULL
         LEFT JOIN (${FIRST_ARTWORK_THUMBNAIL_SQL}) thumb
           ON thumb.artwork_id = a.id
         LEFT JOIN course_checkins cc
           ON cc.user_id = ?
          AND cc.course_item_id = ci.id
         WHERE ci.course_id = ?
         ORDER BY ci.seq ASC`,
        [userId, courseId],
      );

      return mapCourseDetailRows(summary, itemRows);
    });
  },

  async findCourseExists(courseId) {
    return withConnection(async (connection) => {
      const [rows] = await connection.execute<IdRow[]>(
        `SELECT id
         FROM courses
         WHERE id = ?
           AND deleted_at IS NULL
         LIMIT 1`,
        [courseId],
      );

      return Boolean(rows[0]);
    });
  },

  async findCourseRecord(courseId) {
    return withConnection(async (connection) => {
      const [rows] = await connection.execute<CourseRecordRow[]>(
        `SELECT id, is_official, created_by_user_id
         FROM courses
         WHERE id = ?
           AND deleted_at IS NULL
         LIMIT 1`,
        [courseId],
      );

      return rows[0] ? mapCourseRecordRow(rows[0]) : null;
    });
  },

  async findCourseStampProgress(courseId, userId) {
    return withConnection(async (connection) => {
      const [rows] = await connection.execute<CourseStampProgressRow[]>(
        `SELECT
            COUNT(ci.id) AS total_count,
            COUNT(DISTINCT cc.course_item_id) AS checked_in_count
         FROM course_items ci
         INNER JOIN artworks a
           ON a.id = ci.artwork_id
          AND a.deleted_at IS NULL
         INNER JOIN artists ar
           ON ar.id = a.artist_id
          AND ar.deleted_at IS NULL
         INNER JOIN places p
           ON p.id = a.place_id
          AND p.deleted_at IS NULL
         LEFT JOIN course_checkins cc
           ON cc.user_id = ?
          AND cc.course_item_id = ci.id
         WHERE ci.course_id = ?`,
        [userId, courseId],
      );
      const row = rows[0];

      return mapStampProgress(
        Number(row?.checked_in_count ?? 0),
        Number(row?.total_count ?? 0),
      );
    });
  },

  async listActiveArtworkIds(artworkIds) {
    if (artworkIds.length === 0) {
      return [];
    }

    const placeholders = buildInClausePlaceholders(artworkIds.length);

    return withConnection(async (connection) => {
      const [rows] = await connection.execute<IdRow[]>(
        `SELECT a.id
         FROM artworks a
         INNER JOIN artists ar
           ON ar.id = a.artist_id
          AND ar.deleted_at IS NULL
         INNER JOIN places p
           ON p.id = a.place_id
          AND p.deleted_at IS NULL
         WHERE a.deleted_at IS NULL
           AND a.id IN (${placeholders})`,
        artworkIds,
      );

      return rows.map((row) => row.id);
    });
  },

  async listFavoriteCourses(userId) {
    return withConnection(async (connection) => {
      const [rows] = await connection.execute<CourseListBaseRow[]>(
        `SELECT
            c.id,
            c.title_ko,
            c.title_en,
            c.description_ko,
            c.description_en,
            c.is_official
         FROM course_likes cl
         INNER JOIN courses c
           ON c.id = cl.course_id
          AND c.deleted_at IS NULL
         WHERE cl.user_id = ?
         ORDER BY cl.created_at DESC, c.created_at DESC, c.id DESC`,
        [userId],
      );
      const officialRows = rows.filter((row) => row.is_official === true || row.is_official === 1);
      const communityRows = rows.filter((row) => row.is_official !== true && row.is_official !== 1);
      const officialIds = officialRows.map((row) => row.id);
      const communityIds = communityRows.map((row) => row.id);
      const officialMetaByCourseId = await hydrateCourseListMetaRows(connection, officialIds, userId, true);
      const communityMetaByCourseId = await hydrateCourseListMetaRows(connection, communityIds, userId, false);

      return {
        communityCourses: communityRows.map((row) => mapCourseListRow(row, communityMetaByCourseId.get(row.id), false)),
        officialCourses: officialRows.map((row) => mapCourseListRow(row, officialMetaByCourseId.get(row.id), true)),
      };
    });
  },

  async listMyCourses(input, userId) {
    return withConnection(async (connection) => {
      const offset = (input.page - 1) * input.size;
      const [rows] = await connection.execute<CourseListBaseRow[]>(
        buildCourseListPageSql(
          'c.created_by_user_id = ? AND c.is_official = 0 AND c.deleted_at IS NULL',
        ),
        [userId, input.size, offset],
      );
      const [countRows] = await connection.execute<CountRow[]>(
        `SELECT COUNT(*) AS total
         FROM courses c
         WHERE c.created_by_user_id = ?
           AND c.is_official = 0
           AND c.deleted_at IS NULL`,
        [userId],
      );
      const courseIds = rows.map((row) => row.id);
      const metaByCourseId = await hydrateCourseListMetaRows(connection, courseIds, userId, false);

      return {
        courses: rows.map((row) => mapCourseListRow(row, metaByCourseId.get(row.id), false)),
        total: countRows[0]?.total ?? 0,
      };
    });
  },

  async listRecentCommunityCourses(input, userId) {
    return withConnection(async (connection) => {
      const [rows] = await connection.execute<CourseListBaseRow[]>(
        `SELECT
            c.id,
            c.title_ko,
            c.title_en,
            c.description_ko,
            c.description_en,
            c.is_official
         FROM courses c
         WHERE c.is_official = 0
           AND c.created_by_user_id IS NOT NULL
           AND c.deleted_at IS NULL
         ORDER BY c.created_at DESC, c.id DESC
         LIMIT ?`,
        [input.size],
      );
      const [countRows] = await connection.execute<CountRow[]>(
        `SELECT COUNT(*) AS total
         FROM courses c
         WHERE c.is_official = 0
           AND c.created_by_user_id IS NOT NULL
           AND c.deleted_at IS NULL`,
      );
      const courseIds = rows.map((row) => row.id);
      const metaByCourseId = await hydrateCourseListMetaRows(connection, courseIds, userId, false);

      return {
        courses: rows.map((row) => mapCourseListRow(row, metaByCourseId.get(row.id), false)),
        total: countRows[0]?.total ?? 0,
      };
    });
  },

  async listRecommendedCourses(input, userId) {
    return withConnection(async (connection) => {
      const offset = (input.page - 1) * input.size;
      const [rows] = await connection.execute<CourseListBaseRow[]>(
        buildCourseListPageSql(
          'c.is_official = 1 AND c.deleted_at IS NULL',
        ),
        [input.size, offset],
      );
      const [countRows] = await connection.execute<CountRow[]>(
        `SELECT COUNT(*) AS total
         FROM courses c
         WHERE c.is_official = 1
           AND c.deleted_at IS NULL`,
      );
      const courseIds = rows.map((row) => row.id);
      const metaByCourseId = await hydrateCourseListMetaRows(connection, courseIds, userId, true);

      return {
        courses: rows.map((row) => mapCourseListRow(row, metaByCourseId.get(row.id), true)),
        total: countRows[0]?.total ?? 0,
      };
    });
  },

  async softDeleteCourse(courseId) {
    await withConnection(async (connection) => {
      await connection.execute<ResultSetHeader>(
        `UPDATE courses
         SET deleted_at = NOW(),
             updated_at = NOW()
         WHERE id = ?
           AND deleted_at IS NULL`,
        [courseId],
      );
    });
  },

  async updateCourse(courseId, input) {
    await withTransaction(async (connection) => {
      await connection.execute<ResultSetHeader>(
        `UPDATE courses
         SET title_ko = ?,
             title_en = ?,
             description_ko = ?,
             description_en = ?
         WHERE id = ?
           AND deleted_at IS NULL`,
        [
          input.title_ko,
          input.title_en,
          input.description_ko,
          input.description_en,
          courseId,
        ],
      );

      await connection.execute<ResultSetHeader>(
        `DELETE FROM course_items
         WHERE course_id = ?`,
        [courseId],
      );

      if (input.items.length > 0) {
        const now = new Date();
        const itemPlaceholders = input.items.map(() => '(?, ?, ?, ?)').join(', ');
        const itemValues = input.items.flatMap((item) => [
          courseId,
          item.seq,
          item.artwork_id,
          now,
        ]);

        await connection.execute<ResultSetHeader>(
          `INSERT INTO course_items (course_id, seq, artwork_id, created_at)
           VALUES ${itemPlaceholders}`,
          itemValues,
        );
      }
    });
  },
};
