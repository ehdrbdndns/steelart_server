import assert from 'node:assert/strict';
import test from 'node:test';

import { mapMapArtwork } from '../../../src/domains/map/mapper.js';

// 지도 매퍼는 지도 응답에 필요한 최소 필드만 남겨야 한다.
test('map mapper keeps minimal artwork fields', () => {
  const mapped = mapMapArtwork({
    id: 1,
    lat: 36.1001,
    liked: false,
    lng: 129.3001,
    title_en: 'Space Walk',
    title_ko: '스페이스워크',
  });

  assert.equal(mapped.id, 1);
  assert.equal(mapped.title_ko, '스페이스워크');
  assert.equal(mapped.liked, false);
});
