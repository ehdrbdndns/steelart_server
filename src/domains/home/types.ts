import type { ArtworkCard } from '../artworks/types.js';

export interface HomeBanner {
  banner_image_url: string | null;
  display_order: number;
  id: number;
}

export interface HomeZone {
  code: string;
  id: number;
  name_en: string;
  name_ko: string;
  sort_order: number;
}

export interface HomeResponse {
  artworks: ArtworkCard[];
  banners: HomeBanner[];
  selectedZoneId: number | null;
  zones: HomeZone[];
}

export interface HomeArtworksInput {
  zoneId: number;
}

export interface HomeArtworksResponse {
  artworks: ArtworkCard[];
  zoneId: number;
}

export interface RecommendedCourseCard {
  description_en: string | null;
  description_ko: string | null;
  id: number;
  is_official: true;
  stamped: boolean;
  thumbnail_image_height: number | null;
  thumbnail_image_url: string | null;
  thumbnail_image_width: number | null;
  title_en: string;
  title_ko: string;
}

export interface RecommendedCoursesResponse {
  courses: RecommendedCourseCard[];
}
