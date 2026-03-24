import { z } from 'zod';

export const homeArtworksQuerySchema = z.object({
  zoneId: z.coerce.number().int().positive(),
}).strict();
