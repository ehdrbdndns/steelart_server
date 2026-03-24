import type { RowDataPacket } from 'mysql2/promise';

import { withConnection } from '../../shared/db/pool.js';
import type { MapArtwork, MapArtworksInput } from './types.js';

interface MapArtworkRow extends RowDataPacket {
  id: number;
  lat: number;
  liked: number | boolean;
  lng: number;
  title_en: string;
  title_ko: string;
}

function mapArtworkRow(row: MapArtworkRow): MapArtwork {
  return {
    id: row.id,
    lat: Number(row.lat),
    liked: row.liked === true || row.liked === 1,
    lng: Number(row.lng),
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
              map_artworks.id,
              map_artworks.title_ko,
              map_artworks.title_en,
              map_artworks.lat,
              map_artworks.lng,
              map_artworks.liked
           FROM (
             SELECT
               a.id,
               a.title_ko,
               a.title_en,
               CAST(p.lat AS DOUBLE) AS lat,
               CAST(p.lng AS DOUBLE) AS lng,
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
