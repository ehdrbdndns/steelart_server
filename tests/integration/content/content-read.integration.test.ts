import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

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
  queryRows,
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

interface LikeCountRow extends RowDataPacket {
  total: number;
}

function createEvent(
  path: string,
  query = '',
  token?: string,
  method = 'GET',
): APIGatewayProxyEventV2 {
  const likeMatch = path.match(/^\/v1\/artworks\/([^/]+)\/like$/);
  const detailMatch = likeMatch
    ? null
    : path.match(/^\/v1\/artworks\/([^/]+)$/);
  const pathParameters = likeMatch
    ? {
      artworkId: likeMatch[1],
    }
    : detailMatch && detailMatch[1] !== 'filters'
      ? {
        artworkId: detailMatch[1],
      }
      : {};
  const routePath = likeMatch
    ? '/v1/artworks/{artworkId}/like'
    : detailMatch && detailMatch[1] !== 'filters'
      ? '/v1/artworks/{artworkId}'
      : path;

  return {
    body: undefined,
    cookies: [],
    headers: token
      ? {
        authorization: `Bearer ${token}`,
      }
      : {},
    isBase64Encoded: false,
    pathParameters,
    queryStringParameters: undefined,
    rawPath: path,
    rawQueryString: query,
    requestContext: {
      accountId: 'account-id',
      apiId: 'api-id',
      domainName: 'example.com',
      domainPrefix: 'example',
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'integration-test',
      },
      requestId: 'integration-request-id',
      routeKey: `${method} ${routePath}`,
      stage: '$default',
      time: '19/Mar/2026:00:00:00 +0000',
      timeEpoch: 1,
    },
    routeKey: `${method} ${routePath}`,
    stageVariables: undefined,
    version: '2.0',
  };
}

function findArtworkById<TItem extends { id: number; liked: boolean }>(
  items: TItem[],
  artworkId: number,
): TItem {
  const item = items.find((candidate) => candidate.id === artworkId);

  assert.ok(item, `artwork ${artworkId} should exist in response`);
  return item;
}

async function countArtworkLikes(userId: number, artworkId: number): Promise<number> {
  const rows = await queryRows<LikeCountRow>(
    `SELECT COUNT(*) AS total
     FROM artwork_likes
     WHERE user_id = ?
       AND artwork_id = ?`,
    [userId, artworkId],
  );

  return rows[0]?.total ?? 0;
}

async function collectLikedStateSnapshots(
  seeded: SeededContentIds,
  artworkId: number,
  token: string,
): Promise<{
  detail: boolean;
  home: boolean;
  list: boolean;
  map: boolean;
  search: boolean;
}> {
  const lambdaContext = {} as Context;
  const detailResponse = await handleArtworksRequest(
    createEvent(`/v1/artworks/${artworkId}`, '', token),
    lambdaContext,
  ) as APIGatewayProxyStructuredResultV2;
  const listQuery = new URLSearchParams();
  listQuery.append('placeId', String(seeded.placeIds.yeongildae));
  listQuery.append('artistType', 'INDIVIDUAL');
  listQuery.append('festivalYear', '2022');
  listQuery.set('sort', 'latest');
  const listResponse = await handleArtworksRequest(
    createEvent('/v1/artworks', listQuery.toString(), token),
    lambdaContext,
  ) as APIGatewayProxyStructuredResultV2;
  const homeResponse = await handleHomeRequest(
    createEvent('/v1/home', '', token),
    lambdaContext,
  ) as APIGatewayProxyStructuredResultV2;
  const searchResponse = await handleSearchRequest(
    createEvent('/v1/search/artworks', 'q=영일의 바람&sort=latest&page=1&size=20', token),
    lambdaContext,
  ) as APIGatewayProxyStructuredResultV2;
  const mapResponse = await handleMapRequest(
    createEvent('/v1/map/artworks', 'lat=36.058&lng=129.378&radiusMeters=500', token),
    lambdaContext,
  ) as APIGatewayProxyStructuredResultV2;

  return {
    detail: JSON.parse(detailResponse.body as string).data.liked,
    home: findArtworkById(
      JSON.parse(homeResponse.body as string).data.artworks,
      artworkId,
    ).liked,
    list: findArtworkById(
      JSON.parse(listResponse.body as string).data.artworks,
      artworkId,
    ).liked,
    map: findArtworkById(
      JSON.parse(mapResponse.body as string).data.artworks,
      artworkId,
    ).liked,
    search: findArtworkById(
      JSON.parse(searchResponse.body as string).data.artworks,
      artworkId,
    ).liked,
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
    ['영일 작가', 'Yeongil Artist', 'INDIVIDUAL', now, now],
  );
  await pool.execute(
    `INSERT INTO artists (name_ko, name_en, type, profile_image_url, deleted_at, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?)`,
    ['영일 삭제 작가', 'Yeongil Deleted Artist', 'INDIVIDUAL', now, now, now],
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
  await pool.execute(
    `INSERT INTO places (name_ko, name_en, address, lat, lng, zone_id, deleted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['영일 삭제 장소', 'Yeongil Deleted Place', '경북 포항시 삭제 장소', 36.059, 129.379, yeongilZoneResult.insertId, now, now, now],
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
        material,
        description_ko,
        description_en,
        audio_url_ko,
        audio_url_en,
        likes_count,
        deleted_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      '스페이스워크',
      'Space Walk',
      companyArtistResult.insertId,
      yeongildaePlaceResult.insertId,
      'STEEL_ART',
      2021,
      '102m',
      '102m',
      'steel',
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
        material,
        description_ko,
        description_en,
        audio_url_ko,
        audio_url_en,
        likes_count,
        deleted_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      '영일의 바람',
      'Wind of Yeongil',
      individualArtistResult.insertId,
      yeongildaePlaceResult.insertId,
      'PUBLIC_ART',
      2020,
      null,
      null,
      'steel',
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
        material,
        description_ko,
        description_en,
        audio_url_ko,
        audio_url_en,
        likes_count,
        deleted_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      '환호의 빛',
      'Light of Hwanho',
      companyArtistResult.insertId,
      spaceWalkPlaceResult.insertId,
      'STEEL_ART',
      2024,
      null,
      null,
      'corten steel',
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
    `INSERT INTO artworks (
        title_ko,
        title_en,
        artist_id,
        place_id,
        category,
        production_year,
        size_text_ko,
        size_text_en,
        material,
        description_ko,
        description_en,
        audio_url_ko,
        audio_url_en,
        likes_count,
        deleted_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      '영일 삭제 작품',
      'Deleted Yeongil Artwork',
      companyArtistResult.insertId,
      yeongildaePlaceResult.insertId,
      'PUBLIC_ART',
      2019,
      null,
      null,
      'steel',
      '삭제된 작품',
      'Deleted artwork',
      null,
      null,
      0,
      now,
      now,
      now,
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
  assert.deepEqual(body.data.courses[0].stampProgress, {
    checkedInCount: 1,
    totalCount: 2,
  });
  assert.equal('stamped' in body.data.courses[0], false);
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

// 자동완성 API는 작품명, 작가명, 위치명 후보를 함께 반환하고 soft delete된 후보는 제외해야 한다.
test('search autocomplete endpoint returns artwork, artist, and place suggestions', { skip: integrationSkipReason }, async () => {
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
    {
      text_en: 'Yeongil Artist',
      text_ko: '영일 작가',
      type: 'ARTIST_NAME',
    },
    {
      text_en: 'Yeongildae',
      text_ko: '영일대',
      type: 'PLACE_NAME',
    },
  ]);
});

// 자동완성 API는 lang=en일 때 영문 컬럼 기준으로 후보를 정렬해야 한다.
test('search autocomplete endpoint uses english columns when lang is en', { skip: integrationSkipReason }, async () => {
  const seeded = await seedContentScenario();
  const token = signAccessToken(seeded.userId);

  const response = await handleSearchRequest(
    createEvent('/v1/search/autocomplete', 'q=Yeongil&lang=en&size=5', token),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(body.data.suggestions, [
    {
      text_en: 'Yeongil Artist',
      text_ko: '영일 작가',
      type: 'ARTIST_NAME',
    },
    {
      text_en: 'Yeongildae',
      text_ko: '영일대',
      type: 'PLACE_NAME',
    },
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

// 작품 검색 API는 title 정렬일 때 lang이 없으면 한국어 제목 기준으로 오름차순 정렬해야 한다.
test('search endpoint sorts artwork matches by korean title by default', { skip: integrationSkipReason }, async () => {
  const seeded = await seedContentScenario();
  const token = signAccessToken(seeded.userId);

  const response = await handleSearchRequest(
    createEvent('/v1/search/artworks', 'q=포스아트&sort=title&page=1&size=20', token),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(body.data.artworks.map((artwork: { id: number }) => artwork.id), [
    seeded.artworkIds.spaceWalk,
    seeded.artworkIds.hwanho,
  ]);
  assert.deepEqual(body.data.artworks.map((artwork: { title_ko: string }) => artwork.title_ko), [
    '스페이스워크',
    '환호의 빛',
  ]);
  assert.equal(body.data.totalElements, 2);
  assert.equal(body.data.last, true);
});

// 작품 검색 API는 title 정렬일 때 lang=en이면 영어 제목 기준으로 오름차순 정렬해야 한다.
test('search endpoint sorts artwork matches by english title when lang is en', { skip: integrationSkipReason }, async () => {
  const seeded = await seedContentScenario();
  const token = signAccessToken(seeded.userId);

  const response = await handleSearchRequest(
    createEvent('/v1/search/artworks', 'q=포스아트&sort=title&lang=en&page=1&size=20', token),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(body.data.artworks.map((artwork: { id: number }) => artwork.id), [
    seeded.artworkIds.hwanho,
    seeded.artworkIds.spaceWalk,
  ]);
  assert.deepEqual(body.data.artworks.map((artwork: { title_en: string }) => artwork.title_en), [
    'Light of Hwanho',
    'Space Walk',
  ]);
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

// 작품 목록 API는 lang=ko일 때 한국어 제목 기준으로 정렬해야 한다.
test('artworks list endpoint sorts by Korean title when sort=title and lang=ko', { skip: integrationSkipReason }, async () => {
  const seeded = await seedContentScenario();
  const token = signAccessToken(seeded.userId);

  const query = new URLSearchParams();
  query.set('sort', 'title');
  query.set('lang', 'ko');
  query.set('page', '1');
  query.set('size', '24');

  const response = await handleArtworksRequest(
    createEvent('/v1/artworks', query.toString(), token),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(body.data.artworks.map((artwork: { id: number }) => artwork.id), [
    seeded.artworkIds.spaceWalk,
    seeded.artworkIds.yeongilWind,
    seeded.artworkIds.hwanho,
  ]);
  assert.equal(body.data.total, 3);
});

// 작품 목록 API는 lang=en일 때 영어 제목 기준으로 정렬해야 한다.
test('artworks list endpoint sorts by English title when sort=title and lang=en', { skip: integrationSkipReason }, async () => {
  const seeded = await seedContentScenario();
  const token = signAccessToken(seeded.userId);

  const query = new URLSearchParams();
  query.set('sort', 'title');
  query.set('lang', 'en');
  query.set('page', '1');
  query.set('size', '24');

  const response = await handleArtworksRequest(
    createEvent('/v1/artworks', query.toString(), token),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(body.data.artworks.map((artwork: { id: number }) => artwork.id), [
    seeded.artworkIds.hwanho,
    seeded.artworkIds.spaceWalk,
    seeded.artworkIds.yeongilWind,
  ]);
  assert.equal(body.data.total, 3);
});

// 작품 목록 API는 likedOnly=true일 때 사용자가 좋아요한 작품만 반환해야 한다.
test('artworks list endpoint applies likedOnly filter', { skip: integrationSkipReason }, async () => {
  const seeded = await seedContentScenario();
  const token = signAccessToken(seeded.userId);

  const query = new URLSearchParams();
  query.set('likedOnly', 'true');
  query.set('sort', 'latest');
  query.set('page', '1');
  query.set('size', '24');

  const response = await handleArtworksRequest(
    createEvent('/v1/artworks', query.toString(), token),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.total, 1);
  assert.deepEqual(body.data.artworks.map((artwork: { id: number }) => artwork.id), [
    seeded.artworkIds.spaceWalk,
  ]);
  assert.ok(body.data.artworks.every((artwork: { liked: boolean }) => artwork.liked === true));
});

// 작품 목록 API는 likedOnly와 기존 필터를 함께 적용할 수 있어야 한다.
test('artworks list endpoint combines likedOnly with place, artistType, and festivalYear filters', { skip: integrationSkipReason }, async () => {
  const seeded = await seedContentScenario();
  const token = signAccessToken(seeded.userId);

  const query = new URLSearchParams();
  query.append('placeId', String(seeded.placeIds.yeongildae));
  query.append('artistType', 'COMPANY');
  query.append('festivalYear', '2024');
  query.set('likedOnly', 'true');
  query.set('sort', 'latest');
  query.set('page', '1');
  query.set('size', '24');

  const response = await handleArtworksRequest(
    createEvent('/v1/artworks', query.toString(), token),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.total, 1);
  assert.deepEqual(body.data.artworks.map((artwork: { id: number }) => artwork.id), [
    seeded.artworkIds.spaceWalk,
  ]);
  assert.equal(body.data.artworks[0].liked, true);
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
  assert.equal(body.data.material, 'steel');
  assert.equal(body.data.zone_name_ko, '영일');
  assert.equal(body.data.zone_name_en, 'Yeongil');
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
  assert.equal(body.data.zones[0].places.length, 2);
  assert.ok(body.data.zones[0].places.some((place: { id: number }) => place.id === seeded.placeIds.yeongildae));
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
  assert.equal(body.data.artworks[0].title_en, 'Space Walk');
  assert.equal(body.data.artworks[0].artist_name_ko, '포스아트');
  assert.equal(body.data.artworks[0].artist_name_en, 'PosArt');
  assert.equal(body.data.artworks[0].place_name_ko, '영일대');
  assert.equal(body.data.artworks[0].place_name_en, 'Yeongildae');
  assert.equal(body.data.artworks[0].thumbnail_image_url, 'https://example.com/space-walk-1.jpg');
  assert.equal(body.data.artworks[0].thumbnail_image_width, 1200);
  assert.equal(body.data.artworks[0].thumbnail_image_height, 800);
  assert.equal(typeof body.data.artworks[0].lat, 'number');
  assert.equal(typeof body.data.artworks[0].lng, 'number');
  assert.equal(body.data.artworks[0].liked, true);
});

// 작품 좋아요 API는 row를 생성하고 기존 읽기 API들에 liked=true를 반영해야 한다.
test('artwork like endpoint creates a like row and updates liked flags across read APIs', { skip: integrationSkipReason }, async () => {
  const seeded = await seedContentScenario();
  const token = signAccessToken(seeded.userId);

  const response = await handleArtworksRequest(
    createEvent(`/v1/artworks/${seeded.artworkIds.yeongilWind}/like`, '', token, 'POST'),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(body.data, {
    artworkId: seeded.artworkIds.yeongilWind,
    liked: true,
  });
  assert.equal(await countArtworkLikes(seeded.userId, seeded.artworkIds.yeongilWind), 1);

  const snapshots = await collectLikedStateSnapshots(seeded, seeded.artworkIds.yeongilWind, token);

  assert.deepEqual(snapshots, {
    detail: true,
    home: true,
    list: true,
    map: true,
    search: true,
  });
});

// 작품 좋아요 API는 중복 POST/DELETE에도 최종 상태만 유지하는 멱등 동작이어야 한다.
test('artwork like endpoints stay idempotent across repeated requests', { skip: integrationSkipReason }, async () => {
  const seeded = await seedContentScenario();
  const token = signAccessToken(seeded.userId);

  const firstLikeResponse = await handleArtworksRequest(
    createEvent(`/v1/artworks/${seeded.artworkIds.yeongilWind}/like`, '', token, 'POST'),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const secondLikeResponse = await handleArtworksRequest(
    createEvent(`/v1/artworks/${seeded.artworkIds.yeongilWind}/like`, '', token, 'POST'),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(firstLikeResponse.statusCode, 200);
  assert.equal(secondLikeResponse.statusCode, 200);
  assert.equal(await countArtworkLikes(seeded.userId, seeded.artworkIds.yeongilWind), 1);

  const firstUnlikeResponse = await handleArtworksRequest(
    createEvent(`/v1/artworks/${seeded.artworkIds.yeongilWind}/like`, '', token, 'DELETE'),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const secondUnlikeResponse = await handleArtworksRequest(
    createEvent(`/v1/artworks/${seeded.artworkIds.yeongilWind}/like`, '', token, 'DELETE'),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(firstUnlikeResponse.statusCode, 200);
  assert.equal(secondUnlikeResponse.statusCode, 200);
  assert.equal(await countArtworkLikes(seeded.userId, seeded.artworkIds.yeongilWind), 0);

  const snapshots = await collectLikedStateSnapshots(seeded, seeded.artworkIds.yeongilWind, token);

  assert.deepEqual(snapshots, {
    detail: false,
    home: false,
    list: false,
    map: false,
    search: false,
  });
});

// 없는 작품에 대한 작품 좋아요 API는 NOT_FOUND를 반환해야 한다.
test('artwork like endpoint returns NOT_FOUND for missing artworks', { skip: integrationSkipReason }, async () => {
  const seeded = await seedContentScenario();
  const token = signAccessToken(seeded.userId);

  const response = await handleArtworksRequest(
    createEvent('/v1/artworks/999999/like', '', token, 'POST'),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'NOT_FOUND');
});
