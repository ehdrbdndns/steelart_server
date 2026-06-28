import { AppError } from '../../shared/api/errors.js';
import {
  mapArtworkDetail,
  mapArtworkFiltersResponse,
  mapArtworkFiltersV2Response,
  mapArtworkLikeResponse,
  mapArtworkListResponse,
} from './mapper.js';
import type { ArtworksRepository } from './repository.js';
import type {
  ArtworkDetail,
  ArtworkFiltersResponse,
  ArtworkFiltersV2Response,
  ArtworkLikeResponse,
  ArtworkListInput,
  ArtworkListResponse,
} from './types.js';

export interface ArtworksService {
  getArtworkDetail(artworkId: number, userId: number): Promise<ArtworkDetail>;
  getArtworkFilters(): Promise<ArtworkFiltersResponse>;
  getArtworkFiltersV2(): Promise<{ nameEnConflicts: string[]; response: ArtworkFiltersV2Response }>;
  likeArtwork(artworkId: number, userId: number): Promise<ArtworkLikeResponse>;
  listArtworks(input: ArtworkListInput, userId: number): Promise<ArtworkListResponse>;
  unlikeArtwork(artworkId: number, userId: number): Promise<ArtworkLikeResponse>;
}

export interface ArtworksServiceDependencies {
  artworksRepository: ArtworksRepository;
}

export function createArtworksService(
  dependencies: ArtworksServiceDependencies,
): ArtworksService {
  async function assertArtworkExists(artworkId: number): Promise<void> {
    const exists = await dependencies.artworksRepository.findArtworkExists(artworkId);

    if (!exists) {
      throw new AppError('NOT_FOUND', {
        message: 'Artwork not found',
      });
    }
  }

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

    async getArtworkFiltersV2() {
      const filters = await dependencies.artworksRepository.listArtworkFiltersV2();
      return mapArtworkFiltersV2Response(filters.placeRows, filters.festivalYears);
    },

    async likeArtwork(artworkId, userId) {
      await assertArtworkExists(artworkId);
      await dependencies.artworksRepository.createArtworkLike(userId, artworkId);

      return mapArtworkLikeResponse(artworkId, true);
    },

    async listArtworks(input, userId) {
      const result = await dependencies.artworksRepository.listArtworks(input, userId);
      return mapArtworkListResponse(result.artworks, input.page, input.size, result.total);
    },

    async unlikeArtwork(artworkId, userId) {
      await assertArtworkExists(artworkId);
      await dependencies.artworksRepository.deleteArtworkLike(userId, artworkId);

      return mapArtworkLikeResponse(artworkId, false);
    },
  };
}
