import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mapHomeResponse,
  mapRecommendedCoursesResponse,
} from '../../../src/domains/home/mapper.js';

// 홈 매퍼는 aggregate 응답의 다국어 필드와 선택된 존 정보를 그대로 유지해야 한다.
test('home mapper keeps aggregate response fields intact', () => {
  assert.deepEqual(mapHomeResponse({
    artworks: [
      {
        artist_name_en: 'Artist One',
        artist_name_ko: '작가 하나',
        id: 1,
        lat: 36.1,
        liked: false,
        lng: 129.3,
        place_name_en: 'Space Walk',
        place_name_ko: '스페이스워크',
        thumbnail_image_url: null,
        title_en: 'Steel Wave',
        title_ko: '철의 파도',
        zone_id: 3,
      },
    ],
    banners: [
      {
        banner_image_url: 'https://example.com/banner.jpg',
        display_order: 1,
        id: 5,
      },
    ],
    selectedZoneId: 3,
    zones: [
      {
        code: 'HWANHO',
        id: 3,
        name_en: 'Hwanho',
        name_ko: '환호',
        sort_order: 2,
      },
    ],
  }), {
    artworks: [
      {
        artist_name_en: 'Artist One',
        artist_name_ko: '작가 하나',
        id: 1,
        lat: 36.1,
        liked: false,
        lng: 129.3,
        place_name_en: 'Space Walk',
        place_name_ko: '스페이스워크',
        thumbnail_image_url: null,
        title_en: 'Steel Wave',
        title_ko: '철의 파도',
        zone_id: 3,
      },
    ],
    banners: [
      {
        banner_image_url: 'https://example.com/banner.jpg',
        display_order: 1,
        id: 5,
      },
    ],
    selectedZoneId: 3,
    zones: [
      {
        code: 'HWANHO',
        id: 3,
        name_en: 'Hwanho',
        name_ko: '환호',
        sort_order: 2,
      },
    ],
  });
});

// 홈 매퍼는 추천 코스 카드의 썸네일 크기 필드를 그대로 유지해야 한다.
test('home mapper keeps recommended course thumbnail dimensions', () => {
  assert.deepEqual(mapRecommendedCoursesResponse([
    {
      description_en: 'Official walk',
      description_ko: '공식 산책 코스',
      id: 10,
      is_official: true,
      stamped: true,
      thumbnail_image_height: 800,
      thumbnail_image_url: 'https://example.com/course.jpg',
      thumbnail_image_width: 1200,
      title_en: 'Yeongildae Walk',
      title_ko: '영일대 산책 코스',
    },
  ]), {
    courses: [
      {
        description_en: 'Official walk',
        description_ko: '공식 산책 코스',
        id: 10,
        is_official: true,
        stamped: true,
        thumbnail_image_height: 800,
        thumbnail_image_url: 'https://example.com/course.jpg',
        thumbnail_image_width: 1200,
        title_en: 'Yeongildae Walk',
        title_ko: '영일대 산책 코스',
      },
    ],
  });
});
