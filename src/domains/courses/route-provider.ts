import { AppError } from '../../shared/api/errors.js';
import { getEnv } from '../../shared/env/server.js';
import type { CourseRouteProvider, RouteVertex } from './types.js';

const KAKAO_WAYPOINTS_DIRECTIONS_URL =
  'https://apis-navi.kakaomobility.com/v1/waypoints/directions';

interface KakaoRoad {
  vertexes?: number[];
}

interface KakaoSection {
  roads?: KakaoRoad[];
}

interface KakaoRoute {
  result_code?: number;
  sections?: KakaoSection[];
}

interface KakaoDirectionsResponse {
  routes?: KakaoRoute[];
}

function routeUnavailable(message: string, options: { cause?: unknown; details?: unknown } = {}): AppError {
  return new AppError('ROUTE_UNAVAILABLE', {
    cause: options.cause,
    details: options.details,
    message,
    statusCode: 502,
  });
}

function toKakaoPoint(vertex: RouteVertex): { x: number; y: number } {
  // 카카오 좌표는 x=경도(lng), y=위도(lat).
  return { x: vertex.lng, y: vertex.lat };
}

function flattenVertexes(route: KakaoRoute): RouteVertex[] {
  const vertexes: RouteVertex[] = [];

  for (const section of route.sections ?? []) {
    for (const road of section.roads ?? []) {
      const flat = road.vertexes ?? [];

      for (let index = 0; index + 1 < flat.length; index += 2) {
        // flat = [lng, lat, lng, lat, ...]
        vertexes.push({
          lat: flat[index + 1],
          lng: flat[index],
        });
      }
    }
  }

  return vertexes;
}

export function createKakaoMobilityRouteProvider(): CourseRouteProvider {
  return {
    async fetchRoute(orderedCoordinates) {
      const apiKey = getEnv().KAKAO_MOBILITY_REST_API_KEY;

      if (!apiKey) {
        throw routeUnavailable('Kakao mobility REST API key is not configured');
      }

      const origin = orderedCoordinates[0];
      const destination = orderedCoordinates[orderedCoordinates.length - 1];
      const waypoints = orderedCoordinates.slice(1, -1);

      const requestBody = {
        destination: toKakaoPoint(destination),
        origin: toKakaoPoint(origin),
        priority: 'RECOMMEND',
        waypoints: waypoints.map(toKakaoPoint),
      };

      let response: Response;

      try {
        response = await fetch(KAKAO_WAYPOINTS_DIRECTIONS_URL, {
          body: JSON.stringify(requestBody),
          headers: {
            authorization: `KakaoAK ${apiKey}`,
            'content-type': 'application/json',
          },
          method: 'POST',
        });
      } catch (error) {
        throw routeUnavailable('Failed to reach Kakao mobility service', { cause: error });
      }

      if (!response.ok) {
        throw routeUnavailable('Kakao mobility request failed', {
          details: { upstreamStatus: response.status },
        });
      }

      let payload: KakaoDirectionsResponse;

      try {
        payload = (await response.json()) as KakaoDirectionsResponse;
      } catch (error) {
        throw routeUnavailable('Kakao mobility response is invalid', { cause: error });
      }

      const route = payload.routes?.[0];

      if (!route || route.result_code !== 0) {
        throw routeUnavailable('Kakao could not compute a route', {
          details: { resultCode: route?.result_code ?? null },
        });
      }

      const vertexes = flattenVertexes(route);

      if (vertexes.length === 0) {
        throw routeUnavailable('Kakao returned an empty route');
      }

      return vertexes;
    },
  };
}
