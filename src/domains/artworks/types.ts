export const ARTIST_TYPE_VALUES = ['COMPANY', 'INDIVIDUAL'] as const;
export const ARTWORK_CATEGORY_VALUES = ['STEEL_ART', 'PUBLIC_ART'] as const;
export const ARTWORK_SORT_VALUES = ['latest', 'oldest'] as const;

export type ArtistType = (typeof ARTIST_TYPE_VALUES)[number];
export type ArtworkCategory = (typeof ARTWORK_CATEGORY_VALUES)[number];
export type ArtworkSort = (typeof ARTWORK_SORT_VALUES)[number];

export interface ArtworkCard {
  artist_name_en: string;
  artist_name_ko: string;
  id: number;
  lat: number;
  liked: boolean;
  lng: number;
  place_name_en: string;
  place_name_ko: string;
  thumbnail_image_url: string | null;
  title_en: string;
  title_ko: string;
  zone_id: number | null;
}

export interface ArtworkArchiveItem {
  address: string | null;
  artist_name_en: string;
  artist_name_ko: string;
  id: number;
  liked: boolean;
  thumbnail_image_height: number | null;
  thumbnail_image_url: string | null;
  thumbnail_image_width: number | null;
  title_en: string;
  title_ko: string;
}

export interface ArtworkListInput {
  artistTypes: ArtistType[];
  festivalYears: string[];
  page: number;
  placeIds: number[];
  size: number;
  sort: ArtworkSort;
}

export interface ArtworkListResponse {
  artworks: ArtworkArchiveItem[];
  page: number;
  size: number;
  total: number;
}

export interface ArtworkImage {
  image_height: number | null;
  image_url: string;
  image_width: number | null;
}

export interface ArtworkDetail {
  address: string | null;
  artist_name_en: string;
  artist_name_ko: string;
  audio_url_en: string | null;
  audio_url_ko: string | null;
  category: ArtworkCategory;
  description_en: string;
  description_ko: string;
  festival_years: string[];
  id: number;
  images: ArtworkImage[];
  lat: number;
  liked: boolean;
  lng: number;
  place_name_en: string;
  place_name_ko: string;
  production_year: number | null;
  size_text_en: string | null;
  size_text_ko: string | null;
  title_en: string;
  title_ko: string;
  zone_id: number | null;
}

export interface PlaceFilterOption {
  id: number;
  name_en: string;
  name_ko: string;
}

export interface ZonePlaceFilterOption {
  id: number;
  name_en: string;
  name_ko: string;
  places: PlaceFilterOption[];
}

export interface ArtistTypeFilterOption {
  label_en: string;
  label_ko: string;
  value: ArtistType;
}

export interface ArtworkFiltersResponse {
  artistTypes: ArtistTypeFilterOption[];
  festivalYears: string[];
  zones: ZonePlaceFilterOption[];
}
