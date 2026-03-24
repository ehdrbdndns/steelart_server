import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import type { ResultSetHeader } from 'mysql2/promise';

import { handleArtworksRequest } from '../../../src/lambdas/artworks/handler.js';
import { handleHomeRequest } from '../../../src/lambdas/home/handler.js';
import { handleMapRequest } from '../../../src/lambdas/map/handler.js';
import { handleSearchRequest } from '../../../src/lambdas/search/handler.js';
import { signAccessToken } from '../../../src/shared/auth/token.js';
import { getPool } from '../../../src/shared/db/pool.js';
import {
  closeIntegrationDatabase,
  getIntegrationSkipReason,
  prepareIntegrationDatabase,
  resetIntegrationDatabase,
} from '../helpers/database.js';

const integrationSkipReason = getIntegrationSkipReason();

interface SeededContentIds {
  officialCourseId: number;
  officialCourseItemId: number;
  unofficialCourseId: number;
  placeIds: {
    spaceWalk: number;
    yeongildae: number;
  };
  userId: number;
  artworkIds: {
    hwanho: number;
    spaceWalk: number;
    yeongilWind: number;
  };
  zoneIds: {
    empty: number;
    hwanho: number;
    yeongil: number;
  };
}

function createEvent(path: string, query = '', token?: string): APIGatewayProxyEventV2 {
  return {
    body: undefined,
    cookies: [],
    headers: token
      ? {
        authorization: `Bearer ${token}`,
      }
      : {},
    isBase64Encoded: false,
    pathParameters: undefined,
    queryStringParameters: undefined,
    rawPath: path,
    rawQueryString: query,
    requestContext: {
      accountId: 'account-id',
      apiId: 'api-id',
      domainName: 'example.com',
      domainPrefix: 'example',
      http: {
        method: 'GET',
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'integration-test',
      },
      requestId: 'integration-request-id',
      routeKey: '$default',
      stage: '$default',
      time: '19/Mar/2026:00:00:00 +0000',
      timeEpoch: 1,
    },
    routeKey: '$default',
    stageVariables: undefined,
    version: '2.0',
  };
}

async function insertUser(): Promise<number> {
  const now = new Date('2026-03-19T00:00:00.000Z');
  const [result] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO users (
        nickname,
        residency,
        age_group,
        language,
        notifications_enabled,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['reader', 'POHANG', '30S', 'ko', 1, now, now],
  );

  return result.insertId;
}

async function seedContentScenario(): Promise<SeededContentIds> {
  const pool = getPool();
  const now = new Date('2026-03-19T00:00:00.000Z');
  const userId = await insertUser();

  const [yeongilZoneResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO zones (code, name_ko, name_en, sort_order)
     VALUES (?, ?, ?, ?)`,
    ['YEONGIL', '영일', 'Yeongil', 1],
  );
  const [hwanhoZoneResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO zones (code, name_ko, name_en, sort_order)
     VALUES (?, ?, ?, ?)`,
    ['HWANHO', '환호', 'Hwanho', 2],
  );
  const [emptyZoneResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO zones (code, name_ko, name_en, sort_order)
     VALUES (?, ?, ?, ?)`,
    ['JUKDO', '죽도', 'Jukdo', 3],
  );

  const [companyArtistResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO artists (name_ko, name_en, type, profile_image_url, deleted_at, created_at, updated_at)
     VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
    ['포스아트', 'PosArt', 'COMPANY', now, now],
  );
  const [individualArtistResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO artists (name_ko, name_en, type, profile_image_url, deleted_at, created_at, updated_at)
     VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
    ['김철수', 'Kim Cheolsu', 'INDIVIDUAL', now, now],
  );

  const [yeongildaePlaceResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO places (name_ko, name_en, address, lat, lng, zone_id, deleted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    ['영일대', 'Yeongildae', '경북 포항시 영일대', 36.058, 129.378, yeongilZoneResult.insertId, now, now],
  );
  const [spaceWalkPlaceResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO places (name_ko, name_en, address, lat, lng, zone_id, deleted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    ['스페이스워크', 'Space Walk', '경북 포항시 환호공원', 36.067, 129.395, hwanhoZoneResult.insertId, now, now],
  );

  const [spaceWalkArtworkResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO artworks (
        title_ko,
        title_en,
        artist_id,
        place_id,
        category,
        production_year,
        size_text_ko,
        size_text_en,
        description_ko,
        description_en,
        audio_url_ko,
        audio_url_en,
        likes_count,
        deleted_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      '스페이스워크',
      'Space Walk',
      companyArtistResult.insertId,
      yeongildaePlaceResult.insertId,
      'STEEL_ART',
      2021,
      '102m',
      '102m',
      '영일대에 있는 대표 작품',
      'Representative steel artwork at Yeongildae',
      null,
      null,
      1,
      now,
      new Date('2026-03-19T02:00:00.000Z'),
    ],
  );
  const [yeongilWindArtworkResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO artworks (
        title_ko,
        title_en,
        artist_id,
        place_id,
        category,
        production_year,
        size_text_ko,
        size_text_en,
        description_ko,
        description_en,
        audio_url_ko,
        audio_url_en,
        likes_count,
        deleted_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      '영일의 바람',
      'Wind of Yeongil',
      individualArtistResult.insertId,
      yeongildaePlaceResult.insertId,
      'PUBLIC_ART',
      2020,
      null,
      null,
      '영일대 바다를 바라보는 작품',
      'Artwork facing the Yeongildae sea',
      null,
      null,
      0,
      now,
      new Date('2026-03-19T01:00:00.000Z'),
    ],
  );
  const [hwanhoArtworkResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO artworks (
        title_ko,
        title_en,
        artist_id,
        place_id,
        category,
        production_year,
        size_text_ko,
        size_text_en,
        description_ko,
        description_en,
        audio_url_ko,
        audio_url_en,
        likes_count,
        deleted_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      '환호의 빛',
      'Light of Hwanho',
      companyArtistResult.insertId,
      spaceWalkPlaceResult.insertId,
      'STEEL_ART',
      2024,
      null,
      null,
      '환호공원의 철 조형물',
      'Steel artwork in Hwanho park',
      null,
      null,
      0,
      now,
      new Date('2026-03-19T03:00:00.000Z'),
    ],
  );

  await pool.execute(
    `INSERT INTO artwork_images (artwork_id, image_url, created_at, image_width, image_height)
     VALUES (?, ?, NOW(), ?, ?), (?, ?, NOW(), ?, ?), (?, ?, NOW(), ?, ?), (?, ?, NOW(), ?, ?)`,
    [
      spaceWalkArtworkResult.insertId, 'https://example.com/space-walk-1.jpg', 1200, 800,
      spaceWalkArtworkResult.insertId, 'https://example.com/space-walk-2.jpg', 1200, 800,
      yeongilWindArtworkResult.insertId, 'https://example.com/wind.jpg', 1200, 800,
      hwanhoArtworkResult.insertId, 'https://example.com/hwanho.jpg', 1200, 800,
    ],
  );
  await pool.execute(
    `INSERT INTO artwork_festivals (artwork_id, \`year\`, created_at)
     VALUES (?, ?, NOW()), (?, ?, NOW()), (?, ?, NOW()), (?, ?, NOW())`,
    [
      spaceWalkArtworkResult.insertId, '2024',
      spaceWalkArtworkResult.insertId, '2023',
      yeongilWindArtworkResult.insertId, '2022',
      hwanhoArtworkResult.insertId, '2025',
    ],
  );
  await pool.execute(
    `INSERT INTO artwork_likes (user_id, artwork_id, created_at)
     VALUES (?, ?, NOW())`,
    [userId, spaceWalkArtworkResult.insertId],
  );

  await pool.execute(
    `INSERT INTO home_banners (banner_image_url, display_order, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
    [
      'https://example.com/banner-1.jpg', 1, 1, now, now,
      'https://example.com/banner-2.jpg', 2, 1, now, now,
      'https://example.com/banner-hidden.jpg', 3, 0, now, now,
    ],
  );

  const [officialCourseResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO courses (
        title_ko,
        title_en,
        description_ko,
        description_en,
        is_official,
        created_by_user_id,
        likes_count,
        deleted_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    ['영일대 산책 코스', 'Yeongildae Walk', '공식 산책 코스', 'Official walking course', 1, userId, 0, now, now],
  );
  const [unofficialCourseResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO courses (
        title_ko,
        title_en,
        description_ko,
        description_en,
        is_official,
        created_by_user_id,
        likes_count,
        deleted_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    ['비공식 코스', 'Unofficial Course', null, null, 0, userId, 0, now, now],
  );

  const [officialCourseFirstItemResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO course_items (course_id, seq, artwork_id, created_at)
     VALUES (?, ?, ?, NOW())`,
    [officialCourseResult.insertId, 1, spaceWalkArtworkResult.insertId],
  );
  await pool.execute(
    `INSERT INTO course_items (course_id, seq, artwork_id, created_at)
     VALUES (?, ?, ?, NOW()), (?, ?, ?, NOW())`,
    [
      officialCourseResult.insertId, 2, yeongilWindArtworkResult.insertId,
      unofficialCourseResult.insertId, 1, hwanhoArtworkResult.insertId,
    ],
  );
  await pool.execute(
    `INSERT INTO course_checkins (user_id, course_id, course_item_id, created_at)
     VALUES (?, ?, ?, NOW())`,
    [userId, officialCourseResult.insertId, officialCourseFirstItemResult.insertId],
  );

  return {
    officialCourseId: officialCourseResult.insertId,
    officialCourseItemId: officialCourseFirstItemResult.insertId,
    unofficialCourseId: unofficialCourseResult.insertId,
    placeIds: {
      spaceWalk: spaceWalkPlaceResult.insertId,
      yeongildae: yeongildaePlaceResult.insertId,
    },
    userId,
    artworkIds: {
      hwanho: hwanhoArtworkResult.insertId,
      spaceWalk: spaceWalkArtworkResult.insertId,
      yeongilWind: yeongilWindArtworkResult.insertId,
    },
    zoneIds: {
      empty: emptyZoneResult.insertId,
      hwanho: hwanhoZoneResult.insertId,
      yeongil: yeongilZoneResult.insertId,
    },
  };
}

before(async () => {
  if (integrationSkipReason) {
    return;
  }

  await prepareIntegrationDatabase();
});

beforeEach(async () => {
  if (integrationSkipReason) {
    return;
  }

  await resetIntegrationDatabase();
});

after(async () => {
  if (integrationSkipReason) {
    return;
  }

  await closeIntegrationDatabase();
});

// 홈 aggregate API는 첫 존과 그 존의 작품 목록, 활성 배너를 한 번에 내려줘야 한다.
test('home aggregate endpoint returns banners, zones, selectedZoneId, and artworks', { skip: integrationSkipReason }, async () => {
  const seeded = await seedContentScenario();
  const token = signAccessToken(seeded.userId);

  const response = await handleHomeRequest(
    createEvent('/v1/home', '', token),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.selectedZoneId, seeded.zoneIds.yeongil);
  assert.equal(body.data.banners.length, 2);
  assert.deepEqual(body.data.zones.map((zone: { id: number }) => zone.id), [
    seeded.zoneIds.yeongil,
    seeded.zoneIds.hwanho,
    seeded.zoneIds.empty,
  ]);
  assert.deepEqual(body.data.artworks.map((artwork: { id: number }) => artwork.id), [
    seeded.artworkIds.spaceWalk,
    seeded.artworkIds.yeongilWind,
  ]);
});

// 홈 존 전환 API는 전달한 zoneId에 속한 작품만 부분 갱신 응답으로 반환해야 한다.
test('home artworks endpoint returns artworks for the requested zone', { skip: integrationSkipReason }, async () => {
  const seeded = await seedContentScenario();
  const token = signAccessToken(seeded.userId);

  const response = await handleHomeRequest(
    createEvent('/v1/home/artworks', `zoneId=${seeded.zoneIds.hwanho}`, token),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.zoneId, seeded.zoneIds.hwanho);
  assert.deepEqual(body.data.artworks.map((artwork: { id: number }) => artwork.id), [
    seeded.artworkIds.hwanho,
  ]);
});

// 홈 추천 코스 API는 공식 코스만 반환하고 첫 작품 이미지를 썸네일로 사용해야 한다.
test('recommended courses endpoint returns official courses only', { skip: integrationSkipReason }, async () => {
  const seeded = await seedContentScenario();
  const token = signAccessToken(seeded.userId);

  const response = await handleHomeRequest(
    createEvent('/v1/home/recommended-courses', '', token),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.courses.length, 1);
  assert.equal(body.data.courses[0].id, seeded.officialCourseId);
  assert.equal(body.data.courses[0].stamped, true);
  assert.equal(body.data.courses[0].thumbnail_image_url, 'https://example.com/space-walk-1.jpg');
  assert.equal(body.data.courses[0].thumbnail_image_width, 1200);
  assert.equal(body.data.courses[0].thumbnail_image_height, 800);
});

// 작품 검색 API는 장소명 검색과 latest 정렬, 페이지 메타를 함께 반환해야 한다.
test('search endpoint returns paginated artwork matches by place name', { skip: integrationSkipReason }, async () => {
  const seeded = await seedContentScenario();
  const token = signAccessToken(seeded.userId);

  const response = await handleSearchRequest(
    createEvent('/v1/search/artworks', 'q=영일대&sort=latest&page=1&size=1', token),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(body.data.artworks.map((artwork: { id: number }) => artwork.id), [
    seeded.artworkIds.spaceWalk,
  ]);
  assert.equal(body.data.page, 1);
  assert.equal(body.data.size, 1);
  assert.equal(body.data.totalElements, 2);
  assert.equal(body.data.last, false);
  assert.equal(body.data.artworks[0].thumbnail_image_width, 1200);
  assert.equal(body.data.artworks[0].thumbnail_image_height, 800);
});

// 자동완성 API는 작품명 후보만 반환해야 한다.
test('search autocomplete endpoint returns typed suggestions', { skip: integrationSkipReason }, async () => {
  const seeded = await seedContentScenario();
  const token = signAccessToken(seeded.userId);

  const response = await handleSearchRequest(
    createEvent('/v1/search/autocomplete', 'q=영일&lang=ko&size=5', token),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(body.data.suggestions, [
    {
      text_en: 'Wind of Yeongil',
      text_ko: '영일의 바람',
      type: 'ARTWORK_TITLE',
    },
  ]);
});

// 작품 검색 API는 작품 아카이브 정렬값을 재사용해 oldest 순서와 다음 페이지를 계산해야 한다.
test('search endpoint reuses artwork sort values for oldest pagination', { skip: integrationSkipReason }, async () => {
  const seeded = await seedContentScenario();
  const token = signAccessToken(seeded.userId);

  const response = await handleSearchRequest(
    createEvent('/v1/search/artworks', 'q=영일대&sort=oldest&page=2&size=1', token),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(body.data.artworks.map((artwork: { id: number }) => artwork.id), [
    seeded.artworkIds.spaceWalk,
  ]);
  assert.equal(body.data.page, 2);
  assert.equal(body.data.size, 1);
  assert.equal(body.data.totalElements, 2);
  assert.equal(body.data.last, true);
});

// 작품 목록 API는 다중 필터와 festivalYear 기준 정렬 의미를 함께 적용해야 한다.
test('artworks list endpoint applies multi filters', { skip: integrationSkipReason }, async () => {
  const seeded = await seedContentScenario();
  const token = signAccessToken(seeded.userId);

  const query = new URLSearchParams();
  query.append('placeId', String(seeded.placeIds.yeongildae));
  query.append('artistType', 'COMPANY');
  query.append('festivalYear', '2024');
  query.set('sort', 'latest');

  const response = await handleArtworksRequest(
    createEvent('/v1/artworks', query.toString(), token),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.total, 1);
  assert.equal(body.data.artworks[0].id, seeded.artworkIds.spaceWalk);
  assert.equal(body.data.artworks[0].title_ko, '스페이스워크');
  assert.equal(body.data.artworks[0].artist_name_ko, '포스아트');
  assert.equal(body.data.artworks[0].address, '경북 포항시 영일대');
  assert.equal(body.data.artworks[0].liked, true);
  assert.equal(body.data.artworks[0].thumbnail_image_url, 'https://example.com/space-walk-1.jpg');
  assert.equal(body.data.artworks[0].thumbnail_image_width, 1200);
  assert.equal(body.data.artworks[0].thumbnail_image_height, 800);
});

// 작품 상세 API는 이미지, 축제 연도, liked 상태를 함께 반환해야 한다.
test('artwork detail endpoint returns images, festival years, and liked state', { skip: integrationSkipReason }, async () => {
  const seeded = await seedContentScenario();
  const token = signAccessToken(seeded.userId);

  const response = await handleArtworksRequest(
    createEvent(`/v1/artworks/${seeded.artworkIds.spaceWalk}`, '', token),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.id, seeded.artworkIds.spaceWalk);
  assert.equal(body.data.liked, true);
  assert.deepEqual(body.data.festival_years, ['2024', '2023']);
  assert.equal(body.data.images.length, 2);
});

// 작품 필터 API는 zone 아래에 place 목록을 묶어 반환하고 축제 연도 목록도 함께 내려야 한다.
test('artwork filters endpoint returns zones with places and festival years', { skip: integrationSkipReason }, async () => {
  const seeded = await seedContentScenario();
  const token = signAccessToken(seeded.userId);

  const response = await handleArtworksRequest(
    createEvent('/v1/artworks/filters', '', token),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.zones.length, 2);
  assert.equal(body.data.zones[0].id, seeded.zoneIds.yeongil);
  assert.deepEqual(body.data.zones[0].places.map((place: { id: number }) => place.id), [
    seeded.placeIds.yeongildae,
  ]);
  assert.deepEqual(body.data.festivalYears, ['2025', '2024', '2023', '2022']);
  assert.equal(body.data.artistTypes.length, 2);
});

// 지도 API는 좌표와 반경이 주어지면 반경 내 작품만 거리순으로 반환해야 한다.
test('map endpoint returns artworks ordered by distance within radius', { skip: integrationSkipReason }, async () => {
  const seeded = await seedContentScenario();
  const token = signAccessToken(seeded.userId);

  const response = await handleMapRequest(
    createEvent('/v1/map/artworks', 'lat=36.058&lng=129.378&radiusMeters=500', token),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.artworks[0].id, seeded.artworkIds.spaceWalk);
  assert.equal(body.data.artworks.length, 2);
  assert.equal(body.data.artworks[0].title_ko, '스페이스워크');
  assert.equal(typeof body.data.artworks[0].lat, 'number');
  assert.equal(typeof body.data.artworks[0].lng, 'number');
  assert.equal(body.data.artworks[0].liked, true);
});
