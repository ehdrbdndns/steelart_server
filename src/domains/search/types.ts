import type {
  ArtworkSearchCard,
  ArtworkSort,
} from '../artworks/types.js';

export const SEARCH_AUTOCOMPLETE_TYPE_VALUES = [
  'ARTWORK_TITLE',
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

export interface SearchArtworksResponse {
  artworks: ArtworkSearchCard[];
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
