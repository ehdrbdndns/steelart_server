import { z } from 'zod';

export const mapArtworksQuerySchema = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radiusMeters: z.coerce.number().positive(),
}).strict();
