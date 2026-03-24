import { mapMapArtwork, mapMapArtworksResponse } from './mapper.js';
import type { MapRepository } from './repository.js';
import type {
  MapArtworksInput,
  MapArtworksResponse,
} from './types.js';

export interface MapService {
  getMapArtworks(userId: number, input: MapArtworksInput): Promise<MapArtworksResponse>;
}

export interface MapServiceDependencies {
  mapRepository: MapRepository;
}

export function createMapService(
  dependencies: MapServiceDependencies,
): MapService {
  return {
    async getMapArtworks(userId, input) {
      const artworks = await dependencies.mapRepository.listArtworks(userId, input);
      const mapped = artworks.map(mapMapArtwork);

      return mapMapArtworksResponse(mapped);
    },
  };
}
