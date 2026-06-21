import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../../src/shared/api/errors.js';
import { resetEnvForTests } from '../../../src/shared/env/server.js';
import { createKakaoMobilityRouteProvider } from '../../../src/domains/courses/route-provider.js';

type FetchStub = (...args: any[]) => Promise<any>;

const originalFetch = globalThis.fetch;

const coordinates = [
  { lat: 36.01, lng: 129.11 },
  { lat: 36.02, lng: 129.12 },
  { lat: 36.03, lng: 129.13 },
];

function applyProviderEnv(apiKey: string | null = 'kakao-test-key'): void {
  process.env.APP_ENV = 'test';
  process.env.AWS_REGION = 'ap-northeast-2';
  process.env.DB_HOST = 'localhost';
  process.env.DB_NAME = 'steelart';
  process.env.DB_PASSWORD = 'password';
  process.env.DB_PORT = '3306';
  process.env.DB_USER = 'steelart';
  process.env.JWT_SECRET = 'test-secret';
  process.env.LOG_LEVEL = 'error';

  // null이면 키 미설정 상태를 모사한다. (undefined를 넘기면 기본값이 적용되어 의도와 달라진다.)
  if (apiKey === null) {
    delete process.env.KAKAO_MOBILITY_REST_API_KEY;
  } else {
    process.env.KAKAO_MOBILITY_REST_API_KEY = apiKey;
  }

  resetEnvForTests();
}

function stubFetch(impl: FetchStub): void {
  globalThis.fetch = impl as unknown as typeof fetch;
}

function restoreFetch(): void {
  globalThis.fetch = originalFetch;
}

function rejectsRouteUnavailable502(error: unknown): boolean {
  return error instanceof AppError && error.code === 'ROUTE_UNAVAILABLE' && error.statusCode === 502;
}

test('kakao route provider maps flat vertexes to ordered lat/lng and builds the request', async () => {
  applyProviderEnv();
  let capturedUrl: unknown;
  let capturedInit: any;
  stubFetch(async (url: unknown, init: any) => {
    capturedUrl = url;
    capturedInit = init;
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          routes: [
            {
              result_code: 0,
              sections: [
                { roads: [{ vertexes: [129.11, 36.01, 129.12, 36.02] }] },
                { roads: [{ vertexes: [129.13, 36.03] }] },
              ],
            },
          ],
        };
      },
    };
  });

  try {
    const vertexes = await createKakaoMobilityRouteProvider().fetchRoute(coordinates);

    assert.deepEqual(vertexes, [
      { lat: 36.01, lng: 129.11 },
      { lat: 36.02, lng: 129.12 },
      { lat: 36.03, lng: 129.13 },
    ]);
    assert.equal(capturedUrl, 'https://apis-navi.kakaomobility.com/v1/waypoints/directions');
    assert.equal(capturedInit.method, 'POST');
    assert.equal(capturedInit.headers.authorization, 'KakaoAK kakao-test-key');

    const body = JSON.parse(capturedInit.body);
    assert.deepEqual(body.origin, { x: 129.11, y: 36.01 });
    assert.deepEqual(body.destination, { x: 129.13, y: 36.03 });
    assert.deepEqual(body.waypoints, [{ x: 129.12, y: 36.02 }]);
    assert.equal(body.priority, 'RECOMMEND');
  } finally {
    restoreFetch();
  }
});

test('kakao route provider throws 502 when result_code is non-zero', async () => {
  applyProviderEnv();
  stubFetch(async () => ({
    ok: true,
    status: 200,
    async json() {
      return { routes: [{ result_code: 104 }] };
    },
  }));

  try {
    await assert.rejects(
      () => createKakaoMobilityRouteProvider().fetchRoute(coordinates),
      rejectsRouteUnavailable502,
    );
  } finally {
    restoreFetch();
  }
});

test('kakao route provider throws 502 when upstream response is not ok', async () => {
  applyProviderEnv();
  stubFetch(async () => ({
    ok: false,
    status: 401,
    async json() {
      return {};
    },
  }));

  try {
    await assert.rejects(
      () => createKakaoMobilityRouteProvider().fetchRoute(coordinates),
      rejectsRouteUnavailable502,
    );
  } finally {
    restoreFetch();
  }
});

test('kakao route provider throws 502 when fetch rejects', async () => {
  applyProviderEnv();
  stubFetch(async () => {
    throw new Error('network down');
  });

  try {
    await assert.rejects(
      () => createKakaoMobilityRouteProvider().fetchRoute(coordinates),
      rejectsRouteUnavailable502,
    );
  } finally {
    restoreFetch();
  }
});

test('kakao route provider throws 502 when route has no drawable vertexes', async () => {
  applyProviderEnv();
  stubFetch(async () => ({
    ok: true,
    status: 200,
    async json() {
      return { routes: [{ result_code: 0, sections: [] }] };
    },
  }));

  try {
    await assert.rejects(
      () => createKakaoMobilityRouteProvider().fetchRoute(coordinates),
      rejectsRouteUnavailable502,
    );
  } finally {
    restoreFetch();
  }
});

test('kakao route provider throws 502 without calling fetch when the api key is missing', async () => {
  applyProviderEnv(null);
  let fetchCalled = false;
  stubFetch(async () => {
    fetchCalled = true;
    return {
      ok: true,
      status: 200,
      async json() {
        return {};
      },
    };
  });

  try {
    await assert.rejects(
      () => createKakaoMobilityRouteProvider().fetchRoute(coordinates),
      rejectsRouteUnavailable502,
    );
    assert.equal(fetchCalled, false);
  } finally {
    restoreFetch();
  }
});
