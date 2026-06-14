import type {
  MapArtwork,
  MapArtworksResponse,
} from './types.js';

export function mapMapArtwork(artwork: MapArtwork): MapArtwork {
  return {
    artist_name_en: artwork.artist_name_en,
    artist_name_ko: artwork.artist_name_ko,
    id: artwork.id,
    lat: artwork.lat,
    liked: artwork.liked,
    lng: artwork.lng,
    place_name_en: artwork.place_name_en,
    place_name_ko: artwork.place_name_ko,
    thumbnail_image_height: artwork.thumbnail_image_height,
    thumbnail_image_url: artwork.thumbnail_image_url,
    thumbnail_image_width: artwork.thumbnail_image_width,
    title_en: artwork.title_en,
    title_ko: artwork.title_ko,
  };
}

export function mapMapArtworksResponse(artworks: MapArtwork[]): MapArtworksResponse {
  return {
    artworks: artworks.map(mapMapArtwork),
  };
}
