import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mapCourseCheckinResponse,
  mapCourseLikeResponse,
  mapCourseListResponse,
} from '../../../src/domains/courses/mapper.js';

test('courses mapper builds paginated list response', () => {
  assert.deepEqual(mapCourseListResponse([
    {
      description_en: 'Seaside route',
      description_ko: '바닷길 코스',
      end_place_name_en: 'Space Walk',
      end_place_name_ko: '스페이스워크',
      id: 1,
      is_official: true,
      liked: true,
      stampProgress: { checkedInCount: 1, totalCount: 2 },
      start_place_name_en: 'Yeongildae',
      start_place_name_ko: '영일대',
      thumbnail_image_height: 800,
      thumbnail_image_url: 'https://example.com/course.jpg',
      thumbnail_image_width: 1200,
      title_en: 'Seaside Course',
      title_ko: '바닷길 코스',
    },
  ], 2, 20, 21), {
    courses: [
      {
        description_en: 'Seaside route',
        description_ko: '바닷길 코스',
        end_place_name_en: 'Space Walk',
        end_place_name_ko: '스페이스워크',
        id: 1,
        is_official: true,
        liked: true,
        stampProgress: { checkedInCount: 1, totalCount: 2 },
        start_place_name_en: 'Yeongildae',
        start_place_name_ko: '영일대',
        thumbnail_image_height: 800,
        thumbnail_image_url: 'https://example.com/course.jpg',
        thumbnail_image_width: 1200,
        title_en: 'Seaside Course',
        title_ko: '바닷길 코스',
      },
    ],
    page: 2,
    size: 20,
    total: 21,
  });
});

test('courses mapper builds minimal like response', () => {
  assert.deepEqual(mapCourseLikeResponse(12, true), {
    courseId: 12,
    liked: true,
  });
});

test('courses mapper builds minimal check-in response', () => {
  assert.deepEqual(mapCourseCheckinResponse(12, 34, {
    checkedInCount: 2,
    totalCount: 5,
  }), {
    checkedIn: true,
    courseId: 12,
    courseItemId: 34,
    stampProgress: {
      checkedInCount: 2,
      totalCount: 5,
    },
  });
});
