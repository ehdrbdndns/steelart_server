import type {
  ArtworkCard,
  ArtworkSort,
} from '../artworks/types.js';

export const SEARCH_AUTOCOMPLETE_TYPE_VALUES = [
  'ARTWORK_TITLE',
  'ARTIST_NAME',
  'PLACE_NAME',
] as const;

export type SearchAutocompleteType = (typeof SEARCH_AUTOCOMPLETE_TYPE_VALUES)[number];

export const SEARCH_AUTOCOMPLETE_LANGUAGE_VALUES = [
  'ko',
  'en',
] as const;

export type SearchAutocompleteLanguage = (typeof SEARCH_AUTOCOMPLETE_LANGUAGE_VALUES)[number];

export interface SearchArtworksInput {
  page: number;
  q: string;
  size: number;
  sort: ArtworkSort;
}

export interface SearchArtworkCard extends ArtworkCard {
  thumbnail_image_height: number | null;
  thumbnail_image_width: number | null;
}

export interface SearchArtworkQueryResult {
  artworks: SearchArtworkCard[];
  total: number;
}

export interface SearchArtworksResponse {
  artworks: SearchArtworkCard[];
  last: boolean;
  page: number;
  size: number;
  totalElements: number;
}

export interface SearchAutocompleteInput {
  lang: SearchAutocompleteLanguage;
  q: string;
  size: number;
}

export interface SearchAutocompleteSuggestion {
  text_en: string;
  text_ko: string;
  type: SearchAutocompleteType;
}

export interface SearchAutocompleteResponse {
  suggestions: SearchAutocompleteSuggestion[];
}
