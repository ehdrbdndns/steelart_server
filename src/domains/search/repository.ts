import type { RowDataPacket } from 'mysql2/promise';

import type {
  ArtworkSort,
} from '../artworks/types.js';
import { withConnection } from '../../shared/db/pool.js';
import type {
  SearchArtworksInput,
  SearchArtworkCard,
  SearchArtworkQueryResult,
  SearchAutocompleteInput,
  SearchAutocompleteSuggestion,
  SearchAutocompleteType,
} from './types.js';

type SqlParam = string | number;

interface ArtworkCardRow extends RowDataPacket {
  artist_name_en: string;
  artist_name_ko: string;
  id: number;
  lat: number;
  liked: number | boolean;
  lng: number;
  place_name_en: string;
  place_name_ko: string;
  thumbnail_image_height: number | null;
  thumbnail_image_url: string | null;
  thumbnail_image_width: number | null;
  title_en: string;
  title_ko: string;
  zone_id: number | null;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface SearchSuggestionRow extends RowDataPacket {
  text_en: string;
  text_ko: string;
  type: SearchAutocompleteType;
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

function mapSearchArtworkRow(row: ArtworkCardRow): SearchArtworkCard {
  return {
    artist_name_en: row.artist_name_en,
    artist_name_ko: row.artist_name_ko,
    id: row.id,
    lat: Number(row.lat),
    liked: row.liked === true || row.liked === 1,
    lng: Number(row.lng),
    place_name_en: row.place_name_en,
    place_name_ko: row.place_name_ko,
    thumbnail_image_height: row.thumbnail_image_height,
    thumbnail_image_url: row.thumbnail_image_url,
    thumbnail_image_width: row.thumbnail_image_width,
    title_en: row.title_en,
    title_ko: row.title_ko,
    zone_id: row.zone_id,
  };
}

function buildSearchArtworkFilter(
  q: string,
): {
  params: SqlParam[];
  whereClause: string;
} {
  const keyword = `%${q}%`;
  const params: SqlParam[] = [
    keyword,
    keyword,
    keyword,
    keyword,
    keyword,
    keyword,
  ];

  return {
    params,
    whereClause: `WHERE a.deleted_at IS NULL
      AND ar.deleted_at IS NULL
      AND p.deleted_at IS NULL
      AND (
        a.title_ko LIKE ?
        OR a.title_en LIKE ?
        OR ar.name_ko LIKE ?
        OR ar.name_en LIKE ?
        OR p.name_ko LIKE ?
        OR p.name_en LIKE ?
      )`,
  };
}

function buildSearchArtworkSortClause(sort: ArtworkSort): string {
  if (sort === 'oldest') {
    return `ORDER BY COALESCE(festivals.oldest_festival_year, festivals.latest_festival_year, a.production_year, 0) ASC, a.id ASC`;
  }

  return `ORDER BY COALESCE(festivals.latest_festival_year, festivals.oldest_festival_year, a.production_year, 0) DESC, a.id DESC`;
}

const FESTIVAL_META_JOIN_SQL = `
  LEFT JOIN (
    SELECT artwork_id,
           MAX(CAST(\`year\` AS UNSIGNED)) AS latest_festival_year,
           MIN(CAST(\`year\` AS UNSIGNED)) AS oldest_festival_year
    FROM artwork_festivals
    GROUP BY artwork_id
  ) festivals ON festivals.artwork_id = a.id
`;

export interface SearchRepository {
  autocomplete(input: SearchAutocompleteInput, userId: number): Promise<SearchAutocompleteSuggestion[]>;
  searchArtworks(input: SearchArtworksInput, userId: number): Promise<SearchArtworkQueryResult>;
}

export function createSearchRepository(): SearchRepository {
  return {
    async autocomplete(input, _userId) {
      return withConnection(async (connection) => {
        const searchColumn = input.lang === 'en'
          ? 'a.title_en'
          : 'a.title_ko';
        const prefixKeyword = `${input.q}%`;
        const containsKeyword = `%${input.q}%`;
        const params: SqlParam[] = [
          containsKeyword,
          prefixKeyword,
          input.size,
        ];
        const [rows] = await connection.execute<SearchSuggestionRow[]>(
          `SELECT DISTINCT
             a.title_ko AS text_ko,
             a.title_en AS text_en,
             'ARTWORK_TITLE' AS type
           FROM artworks a
           WHERE a.deleted_at IS NULL
             AND ${searchColumn} LIKE ?
           ORDER BY
             CASE
               WHEN ${searchColumn} LIKE ? THEN 0
               ELSE 1
             END ASC,
             CHAR_LENGTH(${searchColumn}) ASC,
             ${searchColumn} ASC
           LIMIT ?`,
          params,
        );

        return rows.map((row) => ({
          text_en: row.text_en,
          text_ko: row.text_ko,
          type: row.type,
        }));
      });
    },
    async searchArtworks(input, userId) {
      return withConnection(async (connection) => {
        const filter = buildSearchArtworkFilter(input.q);
        const [countRows] = await connection.execute<CountRow[]>(
          `SELECT COUNT(*) AS total
           FROM artworks a
           INNER JOIN artists ar ON ar.id = a.artist_id
           INNER JOIN places p ON p.id = a.place_id
           ${filter.whereClause}`,
          filter.params,
        );

        const offset = (input.page - 1) * input.size;
        const [rows] = await connection.execute<ArtworkCardRow[]>(
          `SELECT
             a.id,
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
             p.zone_id AS zone_id,
             CASE WHEN al.user_id IS NULL THEN 0 ELSE 1 END AS liked
           FROM artworks a
           INNER JOIN artists ar ON ar.id = a.artist_id
           INNER JOIN places p ON p.id = a.place_id
           ${THUMBNAIL_JOIN_SQL}
           ${FESTIVAL_META_JOIN_SQL}
           LEFT JOIN artwork_likes al ON al.artwork_id = a.id AND al.user_id = ?
           ${filter.whereClause}
           ${buildSearchArtworkSortClause(input.sort)}
           LIMIT ? OFFSET ?`,
          [userId, ...filter.params, input.size, offset],
        );

        return {
          artworks: rows.map(mapSearchArtworkRow),
          total: countRows[0]?.total ?? 0,
        };
      });
    },
  };
}
