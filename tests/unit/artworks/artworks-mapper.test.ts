import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mapArtworkDetail,
  mapArtworkFiltersResponse,
  mapArtworkFiltersV2Response,
  mapArtworkLikeResponse,
} from '../../../src/domains/artworks/mapper.js';

// 작품 필터 매퍼는 장소와 축제 연도 목록에 아티스트 타입 옵션을 함께 붙여야 한다.
test('artworks mapper builds bilingual filter response', () => {
  assert.deepEqual(mapArtworkFiltersResponse([
    {
      id: 1,
      name_en: 'Yeongil',
      name_ko: '영일',
      places: [
        {
          id: 1,
          name_en: 'Space Walk',
          name_ko: '스페이스워크',
        },
      ],
    },
  ], ['2024', '2023']), {
    artistTypes: [
      {
        label_en: 'Company',
        label_ko: '단체',
        value: 'COMPANY',
      },
      {
        label_en: 'Individual',
        label_ko: '개인',
        value: 'INDIVIDUAL',
      },
    ],
    festivalYears: ['2024', '2023'],
    zones: [
      {
        id: 1,
        name_en: 'Yeongil',
        name_ko: '영일',
        places: [
          {
            id: 1,
            name_en: 'Space Walk',
            name_ko: '스페이스워크',
          },
        ],
      },
    ],
  });
});

// 작품 상세 매퍼는 권역 id와 한영 권역명을 그대로 보존해야 한다.
test('artworks mapper builds detail response with zone names', () => {
  assert.deepEqual(mapArtworkDetail({
    address: '경북 포항시 환호공원',
    address_en: 'Hwanho Park, Pohang-si, Gyeongbuk',
    artist_name_en: 'Artist One',
    artist_name_ko: '작가 하나',
    audio_url_en: null,
    audio_url_ko: null,
    category: 'STEEL_ART',
    description_en: 'desc',
    description_ko: '설명',
    festival_years: ['2024', '2023'],
    id: 12,
    images: [],
    lat: 36.1,
    liked: true,
    lng: 129.3,
    material: 'stainless steel',
    material_en: 'stainless steel (en)',
    place_name_en: 'Space Walk',
    place_name_ko: '스페이스워크',
    production_year: 2024,
    size_text_en: null,
    size_text_ko: null,
    title_en: 'Space Walk',
    title_ko: '스페이스워크',
    zone_id: 2,
    zone_name_en: 'Hwanho',
    zone_name_ko: '환호',
  }), {
    address: '경북 포항시 환호공원',
    address_en: 'Hwanho Park, Pohang-si, Gyeongbuk',
    artist_name_en: 'Artist One',
    artist_name_ko: '작가 하나',
    audio_url_en: null,
    audio_url_ko: null,
    category: 'STEEL_ART',
    description_en: 'desc',
    description_ko: '설명',
    festival_years: ['2024', '2023'],
    id: 12,
    images: [],
    lat: 36.1,
    liked: true,
    lng: 129.3,
    material: 'stainless steel',
    material_en: 'stainless steel (en)',
    place_name_en: 'Space Walk',
    place_name_ko: '스페이스워크',
    production_year: 2024,
    size_text_en: null,
    size_text_ko: null,
    title_en: 'Space Walk',
    title_ko: '스페이스워크',
    zone_id: 2,
    zone_name_en: 'Hwanho',
    zone_name_ko: '환호',
  });
});

// 작품 좋아요 매퍼는 artworkId와 최종 liked 상태만 그대로 반환해야 한다.
test('artworks mapper builds minimal like response', () => {
  assert.deepEqual(mapArtworkLikeResponse(12, true), {
    artworkId: 12,
    liked: true,
  });
});

// v2 매퍼는 같은 name_ko place들을 한 칩으로 묶고 placeIds를 모아야 한다.
test('artworks v2 mapper groups places by name_ko and collects placeIds', () => {
  const result = mapArtworkFiltersV2Response(
    [
      { zone_id: 1, zone_name_ko: '영일대해수욕장', zone_name_en: 'Yeongildae Beach', place_id: 2, place_name_ko: '영일대해수욕장', place_name_en: 'Yeongildae Beach' },
      { zone_id: 1, zone_name_ko: '영일대해수욕장', zone_name_en: 'Yeongildae Beach', place_id: 1, place_name_ko: '영일대해수욕장', place_name_en: 'Yeongil-dae Beach' },
      { zone_id: 1, zone_name_ko: '영일대해수욕장', zone_name_en: 'Yeongildae Beach', place_id: 3, place_name_ko: '설머리다목적광장', place_name_en: 'Seolmeori Plaza' },
    ],
    ['2024', '2023'],
  );

  assert.deepEqual(result.response.zones, [
    {
      id: 1,
      name_en: 'Yeongildae Beach',
      name_ko: '영일대해수욕장',
      places: [
        { name_en: 'Yeongil-dae Beach', name_ko: '영일대해수욕장', placeIds: [1, 2] },
        { name_en: 'Seolmeori Plaza', name_ko: '설머리다목적광장', placeIds: [3] },
      ],
    },
  ]);
  assert.deepEqual(result.response.festivalYears, ['2024', '2023']);
  assert.deepEqual(result.response.artistTypes.map((option) => option.value), ['COMPANY', 'INDIVIDUAL']);
  assert.deepEqual(result.nameEnConflicts, ['영일대해수욕장']);
});
