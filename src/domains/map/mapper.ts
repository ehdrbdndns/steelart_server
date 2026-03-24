import type {
  MapArtwork,
  MapArtworksResponse,
} from './types.js';

export function mapMapArtwork(artwork: MapArtwork): MapArtwork {
  return {
    id: artwork.id,
    lat: artwork.lat,
    liked: artwork.liked,
    lng: artwork.lng,
    title_en: artwork.title_en,
    title_ko: artwork.title_ko,
  };
}

export function mapMapArtworksResponse(artworks: MapArtwork[]): MapArtworksResponse {
  return {
    artworks,
  };
}
