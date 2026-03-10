import { AppError } from '../api/errors.js';

export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function validatePoint(point: GeoPoint): void {
  if (!Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90) {
    throw new AppError('BAD_REQUEST', {
      details: point,
      message: 'Latitude must be between -90 and 90',
    });
  }

  if (!Number.isFinite(point.lng) || point.lng < -180 || point.lng > 180) {
    throw new AppError('BAD_REQUEST', {
      details: point,
      message: 'Longitude must be between -180 and 180',
    });
  }
}

export function calculateDistanceMeters(from: GeoPoint, to: GeoPoint): number {
  validatePoint(from);
  validatePoint(to);

  if (from.lat === to.lat && from.lng === to.lng) {
    return 0;
  }

  // Haversine formula works on radians, so we first convert the latitude/longitude deltas.
  const latDelta = toRadians(to.lat - from.lat);
  const lngDelta = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  // `haversine` is the angular distance ratio between two points on the earth sphere.
  // `sin(delta / 2)^2` captures the latitude/longitude gap and the cosine terms scale it by latitude.
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2;

  // `2 * R * asin(sqrt(h))` converts the angular distance back into meters on the earth radius.
  const distance = 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
  return Math.round(distance * 1000) / 1000;
}

export function isWithinRadiusMeters(from: GeoPoint, to: GeoPoint, radiusMeters: number): boolean {
  if (!Number.isFinite(radiusMeters) || radiusMeters < 0) {
    throw new AppError('BAD_REQUEST', {
      details: {
        radiusMeters,
      },
      message: 'Radius must be a non-negative number',
    });
  }

  return calculateDistanceMeters(from, to) <= radiusMeters;
}
