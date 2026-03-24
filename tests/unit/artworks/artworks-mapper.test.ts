import assert from 'node:assert/strict';
import test from 'node:test';

import { mapArtworkFiltersResponse } from '../../../src/domains/artworks/mapper.js';

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
