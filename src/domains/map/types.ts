export interface MapArtworksInput {
  lat: number;
  lng: number;
  radiusMeters: number;
}

export interface MapArtwork {
  artist_name_en: string | null;
  artist_name_ko: string | null;
  id: number;
  lat: number;
  liked: boolean;
  lng: number;
  place_name_en: string | null;
  place_name_ko: string | null;
  thumbnail_image_height: number | null;
  thumbnail_image_url: string | null;
  thumbnail_image_width: number | null;
  title_en: string | null;
  title_ko: string | null;
}

export interface MapArtworksResponse {
  artworks: MapArtwork[];
}
