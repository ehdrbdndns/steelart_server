import { mapArtworkCard } from '../artworks/mapper.js';
import type { ArtworkSearchCard } from '../artworks/types.js';
import type {
  SearchArtworksResponse,
  SearchAutocompleteResponse,
  SearchAutocompleteSuggestion,
} from './types.js';

export function mapSearchArtworksResponse(
  artworks: ArtworkSearchCard[],
  page: number,
  size: number,
  totalElements: number,
): SearchArtworksResponse {
  return {
    artworks: artworks.map((artwork) => ({
      ...mapArtworkCard(artwork),
      thumbnail_image_height: artwork.thumbnail_image_height,
      thumbnail_image_width: artwork.thumbnail_image_width,
    })),
    last: page * size >= totalElements,
    page,
    size,
    totalElements,
  };
}

export function mapSearchAutocompleteResponse(
  suggestions: SearchAutocompleteSuggestion[],
): SearchAutocompleteResponse {
  return {
    suggestions: suggestions.map((suggestion) => ({
      text_en: suggestion.text_en,
      text_ko: suggestion.text_ko,
      type: suggestion.type,
    })),
  };
}
