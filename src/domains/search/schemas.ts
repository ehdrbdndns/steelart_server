import { z } from 'zod';

import {
  SEARCH_ARTWORK_SORT_VALUES,
  SEARCH_AUTOCOMPLETE_LANGUAGE_VALUES,
} from './types.js';

export const searchArtworksQuerySchema = z.object({
  lang: z.enum(SEARCH_AUTOCOMPLETE_LANGUAGE_VALUES).default('ko'),
  page: z.coerce.number().int().positive().default(1),
  q: z.string().trim().min(1, 'Search query is required'),
  size: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(SEARCH_ARTWORK_SORT_VALUES).default('latest'),
}).strict();

export const searchAutocompleteQuerySchema = z.object({
  lang: z.enum(SEARCH_AUTOCOMPLETE_LANGUAGE_VALUES).default('ko'),
  q: z.string().trim().min(1, 'Search query is required'),
  size: z.coerce.number().int().positive().max(20).default(10),
}).strict();
