import type {
  RowDataPacket,
} from 'mysql2/promise';

import { withConnection } from '../../shared/db/pool.js';
import type {
  ArtworkCategory,
  ArtworkArchiveItem,
  ArtworkCard,
  ArtworkDetail,
  ArtworkImage,
  ArtworkListInput,
  ArtworkSort,
  PlaceFilterOption,
  ZonePlaceFilterOption,
} from './types.js';

type SqlParam = string | number | bigint | boolean | Date | null;

interface ArtworkCardRow extends RowDataPacket {
  artist_name_en: string;
  artist_name_ko: string;
  category: ArtworkCategory;
  festival_years_summary: string | null;
  id: number;
  lat: number;
  liked: number | boolean;
  lng: number;
  oldest_festival_year: number | null;
  place_name_en: string;
  place_name_ko: string;
  production_year: number | null;
  thumbnail_image_height: number | null;
  thumbnail_image_url: string | null;
  thumbnail_image_width: number | null;
  title_en: string;
  title_ko: string;
  updated_at: Date | string;
  zone_id: number | null;
}

interface ArtworkArchiveRow extends RowDataPacket {
  address: string | null;
  artist_name_en: string;
  artist_name_ko: string;
  id: number;
  liked: number | boolean;
  thumbnail_image_height: number | null;
  thumbnail_image_url: string | null;
  thumbnail_image_width: number | null;
  title_en: string;
  title_ko: string;
}

interface ArtworkDetailRow extends RowDataPacket {
  address: string | null;
  artist_name_en: string;
  artist_name_ko: string;
  audio_url_en: string | null;
  audio_url_ko: string | null;
  category: ArtworkDetail['category'];
  description_en: string;
  description_ko: string;
  id: number;
  lat: number;
  liked: number | boolean;
  lng: number;
  place_name_en: string;
  place_name_ko: string;
  production_year: number | null;
  size_text_en: string | null;
  size_text_ko: string | null;
  title_en: string;
  title_ko: string;
  zone_id: number | null;
}

interface ArtworkImageRow extends RowDataPacket {
  image_height: number | null;
  image_url: string;
  image_width: number | null;
}

interface FestivalYearRow extends RowDataPacket {
  year: string;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface PlaceFilterRow extends RowDataPacket {
  place_id: number;
  place_name_en: string;
  place_name_ko: string;
  zone_id: number;
  zone_name_en: string;
  zone_name_ko: string;
}

interface FestivalYearFilterRow extends RowDataPacket {
  year: string;
}

const THUMBNAIL_JOIN_SQL = `
  LEFT JOIN (
    SELECT ai.artwork_id, ai.image_url, ai.image_width, ai.image_height
    FROM artwork_images ai
    INNER JOIN (
      SELECT artwork_id, MIN(id) AS first_image_id
      FROM artwork_images
      GROUP BY artwork_id
    ) first_ai ON first_ai.first_image_id = ai.id
  ) thumb ON thumb.artwork_id = a.id
`;

const FESTIVAL_META_JOIN_SQL = `
  LEFT JOIN (
    SELECT artwork_id,
           GROUP_CONCAT(\`year\` ORDER BY CAST(\`year\` AS UNSIGNED) DESC SEPARATOR ', ') AS festival_years_summary,
           MAX(CAST(\`year\` AS UNSIGNED)) AS latest_festival_year,
           MIN(CAST(\`year\` AS UNSIGNED)) AS oldest_festival_year
    FROM artwork_festivals
    GROUP BY artwork_id
  ) festivals ON festivals.artwork_id = a.id
`;

function mapArtworkCardRow(row: ArtworkCardRow): ArtworkCard {
  return {
    artist_name_en: row.artist_name_en,
    artist_name_ko: row.artist_name_ko,
    id: row.id,
    lat: Number(row.lat),
    liked: row.liked === true || row.liked === 1,
    lng: Number(row.lng),
    place_name_en: row.place_name_en,
    place_name_ko: row.place_name_ko,
    thumbnail_image_url: row.thumbnail_image_url,
    title_en: row.title_en,
    title_ko: row.title_ko,
    zone_id: row.zone_id,
  };
}

function mapArtworkArchiveRow(row: ArtworkArchiveRow): ArtworkArchiveItem {
  return {
    address: row.address,
    artist_name_en: row.artist_name_en,
    artist_name_ko: row.artist_name_ko,
    id: row.id,
    liked: row.liked === true || row.liked === 1,
    thumbnail_image_height: row.thumbnail_image_height,
    thumbnail_image_url: row.thumbnail_image_url,
    thumbnail_image_width: row.thumbnail_image_width,
    title_en: row.title_en,
    title_ko: row.title_ko,
  };
}

function mapArtworkDetailRow(
  row: ArtworkDetailRow,
  images: ArtworkImage[],
  festivalYears: string[],
): ArtworkDetail {
  return {
    address: row.address,
    artist_name_en: row.artist_name_en,
    artist_name_ko: row.artist_name_ko,
    audio_url_en: row.audio_url_en,
    audio_url_ko: row.audio_url_ko,
    category: row.category,
    description_en: row.description_en,
    description_ko: row.description_ko,
    festival_years: festivalYears,
    id: row.id,
    images,
    lat: Number(row.lat),
    liked: row.liked === true || row.liked === 1,
    lng: Number(row.lng),
    place_name_en: row.place_name_en,
    place_name_ko: row.place_name_ko,
    production_year: row.production_year,
    size_text_en: row.size_text_en,
    size_text_ko: row.size_text_ko,
    title_en: row.title_en,
    title_ko: row.title_ko,
    zone_id: row.zone_id,
  };
}

function buildArtworkSortClause(sort: ArtworkSort): string {
  if (sort === 'oldest') {
    return `ORDER BY COALESCE(festivals.oldest_festival_year, festivals.latest_festival_year, a.production_year, 0) ASC, a.id ASC`;
  }

  return `ORDER BY COALESCE(festivals.latest_festival_year, festivals.oldest_festival_year, a.production_year, 0) DESC, a.id DESC`;
}

export interface ArtworksRepository {
  findArtworkDetail(artworkId: number, userId: number): Promise<ArtworkDetail | null>;
  listArtworkFilters(): Promise<{ festivalYears: string[]; zones: ZonePlaceFilterOption[] }>;
  listArtworks(input: ArtworkListInput, userId: number): Promise<{ artworks: ArtworkArchiveItem[]; total: number }>;
  listHomeArtworkCards(zoneId: number, userId: number): Promise<ArtworkCard[]>;
}

export const artworksRepository: ArtworksRepository = {
  async findArtworkDetail(artworkId, userId) {
    return withConnection(async (connection) => {
      const detailParams: SqlParam[] = [userId, artworkId];
      const [rows] = await connection.execute<ArtworkDetailRow[]>(
        `SELECT
            a.id,
            a.title_ko,
            a.title_en,
            ar.name_ko AS artist_name_ko,
            ar.name_en AS artist_name_en,
            a.description_ko,
            a.description_en,
            a.size_text_ko,
            a.size_text_en,
            a.audio_url_ko,
            a.audio_url_en,
            a.category,
            a.production_year,
            p.name_ko AS place_name_ko,
            p.name_en AS place_name_en,
            p.address,
            CAST(p.lat AS DOUBLE) AS lat,
            CAST(p.lng AS DOUBLE) AS lng,
            p.zone_id AS zone_id,
            CASE WHEN al.user_id IS NULL THEN 0 ELSE 1 END AS liked
         FROM artworks a
         INNER JOIN artists ar ON ar.id = a.artist_id
         INNER JOIN places p ON p.id = a.place_id
         LEFT JOIN artwork_likes al ON al.artwork_id = a.id AND al.user_id = ?
         WHERE a.deleted_at IS NULL
           AND ar.deleted_at IS NULL
           AND p.deleted_at IS NULL
           AND a.id = ?
         LIMIT 1`,
        detailParams,
      );
      const detailRow = rows[0];

      if (!detailRow) {
        return null;
      }

      const [imageRows] = await connection.execute<ArtworkImageRow[]>(
        `SELECT image_url, image_width, image_height
         FROM artwork_images
         WHERE artwork_id = ?
         ORDER BY id ASC`,
        [artworkId],
      );
      const [festivalRows] = await connection.execute<FestivalYearRow[]>(
        `SELECT \`year\` AS year
         FROM artwork_festivals
         WHERE artwork_id = ?
         ORDER BY CAST(\`year\` AS UNSIGNED) DESC, \`year\` DESC`,
        [artworkId],
      );

      const images = imageRows.map((row) => ({
        image_height: row.image_height,
        image_url: row.image_url,
        image_width: row.image_width,
      }));
      const festivalYears = festivalRows.map((row) => row.year);

      return mapArtworkDetailRow(detailRow, images, festivalYears);
    });
  },

  async listArtworkFilters() {
    return withConnection(async (connection) => {
      const [placeRows] = await connection.execute<PlaceFilterRow[]>(
        `SELECT
            z.id AS zone_id,
            z.name_ko AS zone_name_ko,
            z.name_en AS zone_name_en,
            p.id AS place_id,
            p.name_ko AS place_name_ko,
            p.name_en AS place_name_en
         FROM places p
         INNER JOIN zones z ON z.id = p.zone_id
         ORDER BY z.sort_order ASC, z.name_ko ASC, p.name_ko ASC`,
      );
      const [festivalYearRows] = await connection.execute<FestivalYearFilterRow[]>(
        `SELECT DISTINCT \`year\` AS year
         FROM artwork_festivals
         ORDER BY CAST(\`year\` AS UNSIGNED) DESC, \`year\` DESC`,
      );

      return {
        festivalYears: festivalYearRows.map((row) => row.year),
        zones: placeRows.reduce<ZonePlaceFilterOption[]>((zones, row) => {
          const existingZone = zones.find((zone) => zone.id === row.zone_id);
          const place: PlaceFilterOption = {
            id: row.place_id,
            name_en: row.place_name_en,
            name_ko: row.place_name_ko,
          };

          if (existingZone) {
            existingZone.places.push(place);
            return zones;
          }

          zones.push({
            id: row.zone_id,
            name_en: row.zone_name_en,
            name_ko: row.zone_name_ko,
            places: [place],
          });

          return zones;
        }, []),
      };
    });
  },

  async listArtworks(input, userId) {
    return withConnection(async (connection) => {
      const filterParams: SqlParam[] = [];
      const whereClauses = [
        'a.deleted_at IS NULL',
        'ar.deleted_at IS NULL',
        'p.deleted_at IS NULL',
      ];

      if (input.placeIds.length > 0) {
        whereClauses.push(`a.place_id IN (${input.placeIds.map(() => '?').join(', ')})`);
        filterParams.push(...input.placeIds);
      }

      if (input.artistTypes.length > 0) {
        whereClauses.push(`ar.type IN (${input.artistTypes.map(() => '?').join(', ')})`);
        filterParams.push(...input.artistTypes);
      }

      if (input.festivalYears.length > 0) {
        whereClauses.push(`EXISTS (
          SELECT 1
          FROM artwork_festivals af_filter
          WHERE af_filter.artwork_id = a.id
            AND af_filter.year IN (${input.festivalYears.map(() => '?').join(', ')})
        )`);
        filterParams.push(...input.festivalYears);
      }

      const whereClause = `WHERE ${whereClauses.join(' AND ')}`;
      const [countRows] = await connection.execute<CountRow[]>(
        `SELECT COUNT(*) AS total
         FROM artworks a
         INNER JOIN artists ar ON ar.id = a.artist_id
         INNER JOIN places p ON p.id = a.place_id
         ${whereClause}`,
        filterParams,
      );

      const offset = (input.page - 1) * input.size;
      const [rows] = await connection.execute<ArtworkArchiveRow[]>(
        `SELECT
            a.id,
            a.title_ko,
            a.title_en,
            ar.name_ko AS artist_name_ko,
            ar.name_en AS artist_name_en,
            p.address,
            thumb.image_url AS thumbnail_image_url,
            thumb.image_width AS thumbnail_image_width,
            thumb.image_height AS thumbnail_image_height,
            CASE WHEN al.user_id IS NULL THEN 0 ELSE 1 END AS liked
         FROM artworks a
         INNER JOIN artists ar ON ar.id = a.artist_id
         INNER JOIN places p ON p.id = a.place_id
         ${THUMBNAIL_JOIN_SQL}
         ${FESTIVAL_META_JOIN_SQL}
         LEFT JOIN artwork_likes al ON al.artwork_id = a.id AND al.user_id = ?
         ${whereClause}
         ${buildArtworkSortClause(input.sort)}
         LIMIT ? OFFSET ?`,
        [userId, ...filterParams, input.size, offset],
      );

      return {
        artworks: rows.map(mapArtworkArchiveRow),
        total: countRows[0]?.total ?? 0,
      };
    });
  },

  async listHomeArtworkCards(zoneId, userId) {
    return withConnection(async (connection) => {
      const params: SqlParam[] = [userId, zoneId];
      const [rows] = await connection.execute<ArtworkCardRow[]>(
        `SELECT
            a.id,
            a.title_ko,
            a.title_en,
            ar.name_ko AS artist_name_ko,
            ar.name_en AS artist_name_en,
            p.name_ko AS place_name_ko,
            p.name_en AS place_name_en,
            thumb.image_url AS thumbnail_image_url,
            thumb.image_width AS thumbnail_image_width,
            thumb.image_height AS thumbnail_image_height,
            CAST(p.lat AS DOUBLE) AS lat,
            CAST(p.lng AS DOUBLE) AS lng,
            p.zone_id AS zone_id,
            CASE WHEN al.user_id IS NULL THEN 0 ELSE 1 END AS liked,
            a.category,
            a.production_year,
            festivals.festival_years_summary,
            festivals.latest_festival_year,
            festivals.oldest_festival_year,
            a.updated_at
         FROM artworks a
         INNER JOIN artists ar ON ar.id = a.artist_id
         INNER JOIN places p ON p.id = a.place_id
         ${THUMBNAIL_JOIN_SQL}
         ${FESTIVAL_META_JOIN_SQL}
         LEFT JOIN artwork_likes al ON al.artwork_id = a.id AND al.user_id = ?
         WHERE a.deleted_at IS NULL
           AND ar.deleted_at IS NULL
           AND p.deleted_at IS NULL
           AND p.zone_id = ?
         ORDER BY a.updated_at DESC
         LIMIT 10`,
        params,
      );

      return rows.map(mapArtworkCardRow);
    });
  },

};
