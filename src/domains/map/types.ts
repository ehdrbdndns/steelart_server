export interface MapArtworksInput {
  lat: number;
  lng: number;
  radiusMeters: number;
}

export interface MapArtwork {
  id: number;
  lat: number;
  liked: boolean;
  lng: number;
  title_en: string;
  title_ko: string;
}

export interface MapArtworksResponse {
  artworks: MapArtwork[];
}
