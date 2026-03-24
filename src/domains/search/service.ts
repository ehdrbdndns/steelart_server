import {
  mapSearchArtworksResponse,
  mapSearchAutocompleteResponse,
} from './mapper.js';
import type { SearchRepository } from './repository.js';
import type {
  SearchArtworksInput,
  SearchArtworksResponse,
  SearchAutocompleteInput,
  SearchAutocompleteResponse,
} from './types.js';

export interface SearchService {
  searchArtworks(userId: number, input: SearchArtworksInput): Promise<SearchArtworksResponse>;
  autocomplete(userId: number, input: SearchAutocompleteInput): Promise<SearchAutocompleteResponse>;
}

export interface SearchServiceDependencies {
  searchRepository: SearchRepository;
}

export function createSearchService(
  dependencies: SearchServiceDependencies,
): SearchService {
  return {
    async searchArtworks(userId, input) {
      const result = await dependencies.searchRepository.searchArtworks(input, userId);
      return mapSearchArtworksResponse(
        result.artworks,
        input.page,
        input.size,
        result.total,
      );
    },
    async autocomplete(userId, input) {
      const suggestions = await dependencies.searchRepository.autocomplete(input, userId);
      return mapSearchAutocompleteResponse(suggestions);
    },
  };
}
