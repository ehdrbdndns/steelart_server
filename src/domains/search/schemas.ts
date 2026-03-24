import { z } from 'zod';

import { ARTWORK_SORT_VALUES } from '../artworks/types.js';
import { SEARCH_AUTOCOMPLETE_LANGUAGE_VALUES } from './types.js';

export const searchArtworksQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  q: z.string().trim().min(1, 'Search query is required'),
  size: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(ARTWORK_SORT_VALUES).default('latest'),
}).strict();

export const searchAutocompleteQuerySchema = z.object({
  lang: z.enum(SEARCH_AUTOCOMPLETE_LANGUAGE_VALUES).default('ko'),
  q: z.string().trim().min(1, 'Search query is required'),
  size: z.coerce.number().int().positive().max(20).default(10),
}).strict();
