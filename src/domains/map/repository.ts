import type { RowDataPacket } from 'mysql2/promise';

import { withConnection } from '../../shared/db/pool.js';
import type { MapArtwork, MapArtworksInput } from './types.js';

interface MapArtworkRow extends RowDataPacket {
  artist_name_en: string | null;
  artist_name_ko: string | null;
  id: number;
  lat: number;
  liked: number | boolean;
  lng: number;
  place_name_en: string | null;
  place_name_ko: string | null;
  thumbnail_image_height: number | null;
  thumbnail_image_url: string | null;
  thumbnail_image_width: number | null;
  title_en: string | null;
  title_ko: string | null;
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

function mapArtworkRow(row: MapArtworkRow): MapArtwork {
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
  };
}

export interface MapRepository {
  listArtworks(userId: number, input: MapArtworksInput): Promise<MapArtwork[]>;
}

export function createMapRepository(): MapRepository {
  return {
    async listArtworks(userId, input) {
      return withConnection(async (connection) => {
        const [rows] = await connection.execute<MapArtworkRow[]>(
          `SELECT
              map_artworks.artist_name_ko,
              map_artworks.artist_name_en,
              map_artworks.id,
              map_artworks.place_name_ko,
              map_artworks.place_name_en,
              map_artworks.title_ko,
              map_artworks.title_en,
              map_artworks.lat,
              map_artworks.lng,
              map_artworks.thumbnail_image_url,
              map_artworks.thumbnail_image_width,
              map_artworks.thumbnail_image_height,
              map_artworks.liked
           FROM (
             SELECT
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
               CASE WHEN al.user_id IS NULL THEN 0 ELSE 1 END AS liked,
               6371000 * 2 * ASIN(
                 SQRT(
                   POW(SIN(RADIANS(CAST(p.lat AS DOUBLE) - ?) / 2), 2) +
                   COS(RADIANS(?)) * COS(RADIANS(CAST(p.lat AS DOUBLE))) *
                   POW(SIN(RADIANS(CAST(p.lng AS DOUBLE) - ?) / 2), 2)
                 )
               ) AS distance_m
             FROM artworks a
             INNER JOIN artists ar ON ar.id = a.artist_id
             INNER JOIN places p ON p.id = a.place_id
             ${THUMBNAIL_JOIN_SQL}
             LEFT JOIN artwork_likes al ON al.artwork_id = a.id AND al.user_id = ?
             WHERE a.deleted_at IS NULL
               AND ar.deleted_at IS NULL
               AND p.deleted_at IS NULL
           ) map_artworks
           WHERE map_artworks.distance_m <= ?
           ORDER BY map_artworks.distance_m ASC, map_artworks.id ASC`,
          [input.lat, input.lat, input.lng, userId, input.radiusMeters],
        );

        return rows.map(mapArtworkRow);
      });
    },
  };
}
