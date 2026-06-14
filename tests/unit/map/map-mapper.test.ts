import assert from 'node:assert/strict';
import test from 'node:test';

import { mapMapArtwork } from '../../../src/domains/map/mapper.js';

test('map mapper keeps card summary fields', () => {
  const artwork = {
    artist_name_en: 'Studio Heech',
    artist_name_ko: '희치 스튜디오',
    id: 1,
    lat: 36.1001,
    liked: true,
    lng: 129.3001,
    place_name_en: 'Hwanho Park',
    place_name_ko: '환호공원',
    thumbnail_image_height: 900,
    thumbnail_image_url: 'https://example.com/space-walk.jpg',
    thumbnail_image_width: 1200,
    title_en: 'Space Walk',
    title_ko: '스페이스워크',
  };

  const mapped = mapMapArtwork(artwork);

  assert.deepEqual(mapped, artwork);
});
