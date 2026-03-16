import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateDistanceMeters,
  isWithinRadiusMeters,
} from '../../src/shared/geo/distance.js';

// 같은 좌표를 비교하면 거리는 0m여야 한다.
test('calculateDistanceMeters returns 0 for identical coordinates', () => {
  assert.equal(
    calculateDistanceMeters(
      { lat: 36.019, lng: 129.3435 },
      { lat: 36.019, lng: 129.3435 },
    ),
    0,
  );
});

// 반경 판정은 실제 거리 기준으로 경계값을 올바르게 처리해야 한다.
test('isWithinRadiusMeters handles boundary checks in meters', () => {
  const origin = { lat: 36.019, lng: 129.3435 };
  const nearby = { lat: 36.019, lng: 129.34361 };

  assert.equal(isWithinRadiusMeters(origin, nearby, 12), true);
  assert.equal(isWithinRadiusMeters(origin, nearby, 5), false);
});
