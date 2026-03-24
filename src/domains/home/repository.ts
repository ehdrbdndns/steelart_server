import type { RowDataPacket } from 'mysql2/promise';

import { withConnection } from '../../shared/db/pool.js';
import type {
  HomeBanner,
  HomeZone,
  RecommendedCourseCard,
} from './types.js';

interface HomeBannerRow extends RowDataPacket {
  banner_image_url: string | null;
  display_order: number;
  id: number;
}

interface HomeZoneRow extends RowDataPacket {
  code: string;
  id: number;
  name_en: string;
  name_ko: string;
  sort_order: number;
}

interface RecommendedCourseRow extends RowDataPacket {
  description_en: string | null;
  description_ko: string | null;
  id: number;
  is_official: number | boolean;
  stamped: number | boolean;
  thumbnail_image_height: number | null;
  thumbnail_image_url: string | null;
  thumbnail_image_width: number | null;
  title_en: string;
  title_ko: string;
}

const FIRST_ARTWORK_THUMBNAIL_SQL = `
  SELECT ai.artwork_id, ai.image_url, ai.image_width, ai.image_height
  FROM artwork_images ai
  INNER JOIN (
    SELECT artwork_id, MIN(id) AS first_image_id
    FROM artwork_images
    GROUP BY artwork_id
  ) first_ai ON first_ai.first_image_id = ai.id
`;

export interface HomeRepository {
  listActiveBanners(): Promise<HomeBanner[]>;
  listActiveZones(): Promise<HomeZone[]>;
  listRecommendedCourses(userId: number): Promise<RecommendedCourseCard[]>;
}

export const homeRepository: HomeRepository = {
  async listActiveBanners() {
    return withConnection(async (connection) => {
      const [rows] = await connection.execute<HomeBannerRow[]>(
        `SELECT id, banner_image_url, display_order
         FROM home_banners
         WHERE is_active = 1
         ORDER BY display_order ASC`,
      );

      return rows.map((row) => ({
        banner_image_url: row.banner_image_url,
        display_order: row.display_order,
        id: row.id,
      }));
    });
  },

  async listActiveZones() {
    return withConnection(async (connection) => {
      const [rows] = await connection.execute<HomeZoneRow[]>(
        `SELECT z.id, z.code, z.name_ko, z.name_en, z.sort_order
         FROM zones z
         ORDER BY z.sort_order ASC, z.name_ko ASC`,
      );

      return rows.map((row) => ({
        code: row.code,
        id: row.id,
        name_en: row.name_en,
        name_ko: row.name_ko,
        sort_order: row.sort_order,
      }));
    });
  },

  async listRecommendedCourses(userId) {
    return withConnection(async (connection) => {
      const [rows] = await connection.execute<RecommendedCourseRow[]>(
        `SELECT
            c.id,
            c.title_ko,
            c.title_en,
            c.description_ko,
            c.description_en,
            c.is_official,
            CASE WHEN course_stamp.course_id IS NULL THEN 0 ELSE 1 END AS stamped,
            first_thumb.image_url AS thumbnail_image_url,
            first_thumb.image_width AS thumbnail_image_width,
            first_thumb.image_height AS thumbnail_image_height
         FROM courses c
         LEFT JOIN course_items first_course_item
           ON first_course_item.course_id = c.id
          AND first_course_item.seq = 1
         LEFT JOIN (
           SELECT DISTINCT course_id
           FROM course_checkins
           WHERE user_id = ?
         ) course_stamp ON course_stamp.course_id = c.id
         LEFT JOIN (${FIRST_ARTWORK_THUMBNAIL_SQL}) first_thumb
           ON first_thumb.artwork_id = first_course_item.artwork_id
         WHERE c.is_official = 1
           AND c.deleted_at IS NULL
         ORDER BY c.updated_at DESC`,
        [userId],
      );

      return rows.map((row) => ({
        description_en: row.description_en,
        description_ko: row.description_ko,
        id: row.id,
        is_official: true,
        stamped: row.stamped === true || row.stamped === 1,
        thumbnail_image_height: row.thumbnail_image_height,
        thumbnail_image_url: row.thumbnail_image_url,
        thumbnail_image_width: row.thumbnail_image_width,
        title_en: row.title_en,
        title_ko: row.title_ko,
      }));
    });
  },
};
