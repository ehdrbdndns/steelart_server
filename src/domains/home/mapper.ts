import { mapArtworkCard } from '../artworks/mapper.js';
import type { ArtworkCard } from '../artworks/types.js';
import type {
  HomeArtworksResponse,
  HomeBanner,
  HomeResponse,
  HomeZone,
  RecommendedCourseCard,
  RecommendedCoursesResponse,
} from './types.js';

export function mapHomeBanner(banner: HomeBanner): HomeBanner {
  return {
    banner_image_url: banner.banner_image_url,
    display_order: banner.display_order,
    id: banner.id,
  };
}

export function mapHomeZone(zone: HomeZone): HomeZone {
  return {
    code: zone.code,
    id: zone.id,
    name_en: zone.name_en,
    name_ko: zone.name_ko,
    sort_order: zone.sort_order,
  };
}

export function mapHomeResponse(input: {
  artworks: ArtworkCard[];
  banners: HomeBanner[];
  selectedZoneId: number | null;
  zones: HomeZone[];
}): HomeResponse {
  return {
    artworks: input.artworks.map(mapArtworkCard),
    banners: input.banners.map(mapHomeBanner),
    selectedZoneId: input.selectedZoneId,
    zones: input.zones.map(mapHomeZone),
  };
}

export function mapHomeArtworksResponse(zoneId: number, artworks: ArtworkCard[]): HomeArtworksResponse {
  return {
    artworks: artworks.map(mapArtworkCard),
    zoneId,
  };
}

export function mapRecommendedCourseCard(course: RecommendedCourseCard): RecommendedCourseCard {
  return {
    description_en: course.description_en,
    description_ko: course.description_ko,
    id: course.id,
    is_official: true,
    stamped: course.stamped,
    thumbnail_image_height: course.thumbnail_image_height,
    thumbnail_image_url: course.thumbnail_image_url,
    thumbnail_image_width: course.thumbnail_image_width,
    title_en: course.title_en,
    title_ko: course.title_ko,
  };
}

export function mapRecommendedCoursesResponse(
  courses: RecommendedCourseCard[],
): RecommendedCoursesResponse {
  return {
    courses: courses.map(mapRecommendedCourseCard),
  };
}
