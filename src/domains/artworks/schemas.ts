import { z } from 'zod';

import {
  ARTIST_TYPE_VALUES,
  ARTWORK_SORT_VALUES,
} from './types.js';

const positiveIntegerArraySchema = z.array(z.coerce.number().int().positive()).default([]);
const festivalYearArraySchema = z.array(z.string().trim().min(1)).default([]);

export const artworkIdParamSchema = z.object({
  artworkId: z.coerce.number().int().positive(),
}).strict();

export const artworksListQuerySchema = z.object({
  artistType: z.array(z.enum(ARTIST_TYPE_VALUES)).default([]),
  festivalYear: festivalYearArraySchema,
  page: z.coerce.number().int().positive().default(1),
  placeId: positiveIntegerArraySchema,
  size: z.coerce.number().int().positive().max(100).default(24),
  sort: z.enum(ARTWORK_SORT_VALUES).default('latest'),
}).strict();
