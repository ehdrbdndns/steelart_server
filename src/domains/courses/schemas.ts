import { z } from 'zod';

import {
  COURSE_LIST_DEFAULT_PAGE,
  COURSE_LIST_DEFAULT_SIZE,
  COURSE_LIST_MAX_SIZE,
  RECENT_COMMUNITY_COURSE_DEFAULT_SIZE,
  RECENT_COMMUNITY_COURSE_MAX_SIZE,
} from './types.js';

const courseMutationItemSchema = z.object({
  artwork_id: z.coerce.number().int().positive(),
  seq: z.coerce.number().int().positive(),
}).strict();

function buildCourseItemsSchema() {
  return z.array(courseMutationItemSchema)
    .min(1, 'At least one artwork is required')
    .superRefine((items, context) => {
      const artworkIds = new Set<number>();

      for (const item of items) {
        if (artworkIds.has(item.artwork_id)) {
          context.addIssue({
            code: 'custom',
            message: 'Artwork ids must be unique within a course',
            path: ['items'],
          });
          break;
        }

        artworkIds.add(item.artwork_id);
      }

      const orderedSeq = [...items]
        .map((item) => item.seq)
        .sort((left, right) => left - right);

      for (let index = 0; index < orderedSeq.length; index += 1) {
        const expected = index + 1;

        if (orderedSeq[index] !== expected) {
          context.addIssue({
            code: 'custom',
            message: 'Items seq must start at 1 and remain contiguous',
            path: ['items'],
          });
          break;
        }
      }
    });
}

export const courseListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(COURSE_LIST_DEFAULT_PAGE),
  size: z.coerce.number().int().positive().max(COURSE_LIST_MAX_SIZE).default(COURSE_LIST_DEFAULT_SIZE),
}).strict();

export const recentCommunityCourseListQuerySchema = z.object({
  size: z.coerce
    .number()
    .int()
    .positive()
    .max(RECENT_COMMUNITY_COURSE_MAX_SIZE)
    .default(RECENT_COMMUNITY_COURSE_DEFAULT_SIZE),
}).strict();

export const courseIdParamSchema = z.object({
  courseId: z.coerce.number().int().positive(),
}).strict();

export const createCourseBodySchema = z.object({
  description_en: z.string().trim().min(1, 'English description is required'),
  description_ko: z.string().trim().min(1, 'Korean description is required'),
  items: buildCourseItemsSchema(),
  title_en: z.string().trim().min(1, 'English title is required').max(120),
  title_ko: z.string().trim().min(1, 'Korean title is required').max(120),
}).strict();

export const updateCourseBodySchema = createCourseBodySchema;

export const courseCheckinBodySchema = z.object({
  course_item_id: z.coerce.number().int().positive(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
}).strict();
