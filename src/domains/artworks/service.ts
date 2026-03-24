import { AppError } from '../../shared/api/errors.js';
import {
  mapArtworkDetail,
  mapArtworkFiltersResponse,
  mapArtworkListResponse,
} from './mapper.js';
import type { ArtworksRepository } from './repository.js';
import type {
  ArtworkDetail,
  ArtworkFiltersResponse,
  ArtworkListInput,
  ArtworkListResponse,
} from './types.js';

export interface ArtworksService {
  getArtworkDetail(artworkId: number, userId: number): Promise<ArtworkDetail>;
  getArtworkFilters(): Promise<ArtworkFiltersResponse>;
  listArtworks(input: ArtworkListInput, userId: number): Promise<ArtworkListResponse>;
}

export interface ArtworksServiceDependencies {
  artworksRepository: ArtworksRepository;
}

export function createArtworksService(
  dependencies: ArtworksServiceDependencies,
): ArtworksService {
  return {
    async getArtworkDetail(artworkId, userId) {
      const artwork = await dependencies.artworksRepository.findArtworkDetail(artworkId, userId);

      if (!artwork) {
        throw new AppError('NOT_FOUND', {
          message: 'Artwork not found',
        });
      }

      return mapArtworkDetail(artwork);
    },

    async getArtworkFilters() {
      const filters = await dependencies.artworksRepository.listArtworkFilters();
      return mapArtworkFiltersResponse(filters.zones, filters.festivalYears);
    },

    async listArtworks(input, userId) {
      const result = await dependencies.artworksRepository.listArtworks(input, userId);
      return mapArtworkListResponse(result.artworks, input.page, input.size, result.total);
    },
  };
}
