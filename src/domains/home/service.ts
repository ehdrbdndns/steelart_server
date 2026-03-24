import { mapHomeArtworksResponse, mapHomeResponse, mapRecommendedCoursesResponse } from './mapper.js';
import type { HomeRepository } from './repository.js';
import type {
  HomeArtworksInput,
  HomeArtworksResponse,
  HomeResponse,
  RecommendedCoursesResponse,
} from './types.js';
import type { ArtworksRepository } from '../artworks/repository.js';

export interface HomeService {
  getHome(userId: number): Promise<HomeResponse>;
  getHomeArtworks(userId: number, input: HomeArtworksInput): Promise<HomeArtworksResponse>;
  getRecommendedCourses(userId: number): Promise<RecommendedCoursesResponse>;
}

export interface HomeServiceDependencies {
  artworksRepository: Pick<ArtworksRepository, 'listHomeArtworkCards'>;
  homeRepository: HomeRepository;
}

export function createHomeService(
  dependencies: HomeServiceDependencies,
): HomeService {
  return {
    async getHome(userId) {
      const [banners, zones] = await Promise.all([
        dependencies.homeRepository.listActiveBanners(),
        dependencies.homeRepository.listActiveZones(),
      ]);
      const selectedZoneId = zones[0]?.id ?? null;
      const artworks = selectedZoneId
        ? await dependencies.artworksRepository.listHomeArtworkCards(selectedZoneId, userId)
        : [];

      return mapHomeResponse({
        artworks,
        banners,
        selectedZoneId,
        zones,
      });
    },

    async getHomeArtworks(userId, input) {
      const artworks = await dependencies.artworksRepository.listHomeArtworkCards(input.zoneId, userId);
      return mapHomeArtworksResponse(input.zoneId, artworks);
    },

    async getRecommendedCourses(userId) {
      const courses = await dependencies.homeRepository.listRecommendedCourses(userId);
      return mapRecommendedCoursesResponse(courses);
    },
  };
}
