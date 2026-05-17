import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { handleCoursesRequest } from '../../../src/lambdas/courses/handler.js';
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

interface SeededCourseIds {
  artworkIds: {
    one: number;
    two: number;
    three: number;
  };
  myCourseId: number;
  myCourseItemId: number;
  officialCourseId: number;
  officialCourseItemIds: {
    first: number;
    second: number;
  };
  otherUserCourseId: number;
  userId: number;
  otherUserId: number;
}

interface CountRow extends RowDataPacket {
  total: number;
}

function createEvent(
  path: string,
  query = '',
  token?: string,
  method = 'GET',
  body?: unknown,
): APIGatewayProxyEventV2 {
  const likeMatch = path.match(/^\/v1\/courses\/([^/]+)\/like$/);
  const checkinMatch = path.match(/^\/v1\/courses\/([^/]+)\/checkins$/);
  const detailMatch = likeMatch || checkinMatch
    ? null
    : path.match(/^\/v1\/courses\/([^/]+)$/);
  const pathParameters = likeMatch
      ? { courseId: likeMatch[1] }
      : checkinMatch
        ? { courseId: checkinMatch[1] }
        : detailMatch && !['favorites', 'mine', 'recommended'].includes(detailMatch[1])
          ? { courseId: detailMatch[1] }
          : {};
  const routePath = likeMatch
    ? '/v1/courses/{courseId}/like'
    : checkinMatch
      ? '/v1/courses/{courseId}/checkins'
      : detailMatch && !['favorites', 'mine', 'recommended'].includes(detailMatch[1])
        ? '/v1/courses/{courseId}'
        : path;

  return {
    body: body === undefined ? undefined : JSON.stringify(body),
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

async function countCourseLikes(userId: number, courseId: number): Promise<number> {
  const rows = await queryRows<CountRow>(
    `SELECT COUNT(*) AS total
     FROM course_likes
     WHERE user_id = ?
       AND course_id = ?`,
    [userId, courseId],
  );

  return rows[0]?.total ?? 0;
}

async function countCourseCheckins(userId: number, courseItemId: number): Promise<number> {
  const rows = await queryRows<CountRow>(
    `SELECT COUNT(*) AS total
     FROM course_checkins
     WHERE user_id = ?
       AND course_item_id = ?`,
    [userId, courseItemId],
  );

  return rows[0]?.total ?? 0;
}

async function insertUser(nickname: string): Promise<number> {
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
    [nickname, 'POHANG', '30S', 'ko', 1, now, now],
  );

  return result.insertId;
}

async function insertCommunityCourse(
  userId: number,
  index: number,
  createdAt: Date,
  deletedAt: Date | null = null,
): Promise<number> {
  const [result] = await getPool().execute<ResultSetHeader>(
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
      ) VALUES (?, ?, ?, ?, 0, ?, 0, ?, ?, ?)`,
    [
      `시민 추천 코스 ${index}`,
      `Community Course ${index}`,
      `시민 추천 코스 설명 ${index}`,
      `Community course description ${index}`,
      userId,
      deletedAt,
      createdAt,
      createdAt,
    ],
  );

  return result.insertId;
}

async function seedCoursesScenario(): Promise<SeededCourseIds> {
  const pool = getPool();
  const now = new Date('2026-03-19T00:00:00.000Z');
  const userId = await insertUser('course-owner');
  const otherUserId = await insertUser('other-owner');

  const [zoneResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO zones (code, name_ko, name_en, sort_order)
     VALUES (?, ?, ?, ?)`,
    ['YEONGIL', '영일', 'Yeongil', 1],
  );

  const [startPlaceResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO places (name_ko, name_en, address, lat, lng, zone_id, deleted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    ['영일대', 'Yeongildae', '경북 포항시 영일대', 36.058, 129.378, zoneResult.insertId, now, now],
  );
  const [midPlaceResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO places (name_ko, name_en, address, lat, lng, zone_id, deleted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    ['환호공원', 'Hwanho Park', '경북 포항시 환호공원', 36.067, 129.395, zoneResult.insertId, now, now],
  );
  const [endPlaceResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO places (name_ko, name_en, address, lat, lng, zone_id, deleted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    ['송도해수욕장', 'Songdo Beach', '경북 포항시 송도해수욕장', 36.034, 129.369, zoneResult.insertId, now, now],
  );

  const [artistResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO artists (name_ko, name_en, type, profile_image_url, deleted_at, created_at, updated_at)
     VALUES (?, ?, ?, NULL, NULL, ?, ?)`,
    ['포스아트', 'PosArt', 'COMPANY', now, now],
  );

  const [artworkOneResult] = await pool.execute<ResultSetHeader>(
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
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL, NULL, 0, NULL, ?, ?)`,
    ['영일의 바람', 'Wind of Yeongil', artistResult.insertId, startPlaceResult.insertId, 'PUBLIC_ART', 2020, '영일대 작품', 'Artwork at Yeongildae', now, now],
  );
  const [artworkTwoResult] = await pool.execute<ResultSetHeader>(
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
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL, NULL, 0, NULL, ?, ?)`,
    ['환호의 빛', 'Light of Hwanho', artistResult.insertId, midPlaceResult.insertId, 'STEEL_ART', 2024, '환호 작품', 'Artwork at Hwanho', now, now],
  );
  const [artworkThreeResult] = await pool.execute<ResultSetHeader>(
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
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL, NULL, 0, NULL, ?, ?)`,
    ['송도의 물결', 'Wave of Songdo', artistResult.insertId, endPlaceResult.insertId, 'STEEL_ART', 2022, '송도 작품', 'Artwork at Songdo', now, now],
  );

  await pool.execute(
    `INSERT INTO artwork_images (artwork_id, image_url, created_at, image_width, image_height)
     VALUES (?, ?, NOW(), ?, ?), (?, ?, NOW(), ?, ?), (?, ?, NOW(), ?, ?)`,
    [
      artworkOneResult.insertId, 'https://example.com/course-1.jpg', 1200, 800,
      artworkTwoResult.insertId, 'https://example.com/course-2.jpg', 1280, 720,
      artworkThreeResult.insertId, 'https://example.com/course-3.jpg', 900, 900,
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
      ) VALUES (?, ?, ?, ?, 1, NULL, 0, NULL, ?, ?)`,
    ['포항 추천 코스', 'Official Pohang Course', '포항 추천 동선', 'Official route in Pohang', now, now],
  );
  const [myCourseResult] = await pool.execute<ResultSetHeader>(
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
      ) VALUES (?, ?, ?, ?, 0, ?, 0, NULL, ?, ?)`,
    ['내 산책 코스', 'My Walking Course', '내가 만든 코스', 'My custom route', userId, now, now],
  );
  const [otherCourseResult] = await pool.execute<ResultSetHeader>(
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
      ) VALUES (?, ?, ?, ?, 0, ?, 0, NULL, ?, ?)`,
    ['다른 사람 코스', 'Other User Course', '다른 사람이 만든 코스', 'Route by another user', otherUserId, now, now],
  );

  const [officialItemOneResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO course_items (course_id, seq, artwork_id, created_at)
     VALUES (?, 1, ?, ?)`,
    [officialCourseResult.insertId, artworkOneResult.insertId, now],
  );
  const [officialItemTwoResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO course_items (course_id, seq, artwork_id, created_at)
     VALUES (?, 2, ?, ?)`,
    [officialCourseResult.insertId, artworkTwoResult.insertId, now],
  );
  const [myCourseItemResult] = await pool.execute<ResultSetHeader>(
    `INSERT INTO course_items (course_id, seq, artwork_id, created_at)
     VALUES (?, 1, ?, ?), (?, 2, ?, ?)`,
    [myCourseResult.insertId, artworkTwoResult.insertId, now, myCourseResult.insertId, artworkThreeResult.insertId, now],
  );
  await pool.execute<ResultSetHeader>(
    `INSERT INTO course_items (course_id, seq, artwork_id, created_at)
     VALUES (?, 1, ?, ?)`,
    [otherCourseResult.insertId, artworkThreeResult.insertId, now],
  );

  await pool.execute(
    `INSERT INTO course_likes (user_id, course_id, created_at)
     VALUES (?, ?, NOW()), (?, ?, NOW())`,
    [userId, officialCourseResult.insertId, userId, myCourseResult.insertId],
  );
  await pool.execute(
    `INSERT INTO course_checkins (user_id, course_id, course_item_id, created_at)
     VALUES (?, ?, ?, NOW())`,
    [userId, officialCourseResult.insertId, officialItemOneResult.insertId],
  );

  return {
    artworkIds: {
      one: artworkOneResult.insertId,
      three: artworkThreeResult.insertId,
      two: artworkTwoResult.insertId,
    },
    myCourseId: myCourseResult.insertId,
    myCourseItemId: myCourseItemResult.insertId,
    officialCourseId: officialCourseResult.insertId,
    officialCourseItemIds: {
      first: officialItemOneResult.insertId,
      second: officialItemTwoResult.insertId,
    },
    otherUserCourseId: otherCourseResult.insertId,
    otherUserId,
    userId,
  };
}

let seeded: SeededCourseIds;

if (integrationSkipReason) {
  test('courses integration tests are skipped when integration DB env is missing', { skip: integrationSkipReason }, () => {});
} else {
  before(async () => {
    await prepareIntegrationDatabase();
  });

  after(async () => {
    await closeIntegrationDatabase();
  });

  beforeEach(async () => {
    await resetIntegrationDatabase();
    seeded = await seedCoursesScenario();
  });

  test('recommended courses endpoint returns paginated official cards with liked and place names', async () => {
    const token = signAccessToken(seeded.userId);

    const response = await handleCoursesRequest(
      createEvent('/v1/courses/recommended', 'page=1&size=20', token),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;
    const body = JSON.parse(response.body as string);

    assert.equal(response.statusCode, 200);
    assert.equal(body.data.page, 1);
    assert.equal(body.data.size, 20);
    assert.equal(body.data.total, 1);
    assert.equal(body.data.courses[0].id, seeded.officialCourseId);
    assert.equal(body.data.courses[0].liked, true);
    assert.deepEqual(body.data.courses[0].stampProgress, {
      checkedInCount: 1,
      totalCount: 2,
    });
    assert.equal('stamped' in body.data.courses[0], false);
    assert.equal(body.data.courses[0].start_place_name_ko, '영일대');
    assert.equal(body.data.courses[0].end_place_name_ko, '환호공원');
  });

  test('recommended courses endpoint returns zero progress for a user without check-ins', async () => {
    const token = signAccessToken(seeded.otherUserId);

    const response = await handleCoursesRequest(
      createEvent('/v1/courses/recommended', 'page=1&size=20', token),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;
    const body = JSON.parse(response.body as string);

    assert.equal(response.statusCode, 200);
    assert.equal(body.data.courses[0].id, seeded.officialCourseId);
    assert.equal(body.data.courses[0].liked, false);
    assert.deepEqual(body.data.courses[0].stampProgress, {
      checkedInCount: 0,
      totalCount: 2,
    });
    assert.equal('stamped' in body.data.courses[0], false);
  });

  test('course progress excludes soft-deleted artwork items', async () => {
    const token = signAccessToken(seeded.userId);
    await getPool().execute(
      `UPDATE artworks
       SET deleted_at = NOW()
       WHERE id = ?`,
      [seeded.artworkIds.two],
    );

    const listResponse = await handleCoursesRequest(
      createEvent('/v1/courses/recommended', 'page=1&size=20', token),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;
    const listBody = JSON.parse(listResponse.body as string);
    const detailResponse = await handleCoursesRequest(
      createEvent(`/v1/courses/${seeded.officialCourseId}`, '', token),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;
    const detailBody = JSON.parse(detailResponse.body as string);

    assert.equal(listResponse.statusCode, 200);
    assert.deepEqual(listBody.data.courses[0].stampProgress, {
      checkedInCount: 1,
      totalCount: 1,
    });
    assert.equal(detailResponse.statusCode, 200);
    assert.deepEqual(detailBody.data.stampProgress, {
      checkedInCount: 1,
      totalCount: 1,
    });
    assert.deepEqual(detailBody.data.items.map((item: { id: number }) => item.id), [
      seeded.officialCourseItemIds.first,
    ]);
  });

  test('my courses endpoint returns only authored custom courses', async () => {
    const token = signAccessToken(seeded.userId);

    const response = await handleCoursesRequest(
      createEvent('/v1/courses/mine', 'page=1&size=20', token),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;
    const body = JSON.parse(response.body as string);

    assert.equal(response.statusCode, 200);
    assert.equal(body.data.total, 1);
    assert.equal(body.data.courses[0].id, seeded.myCourseId);
    assert.equal(body.data.courses[0].liked, true);
    assert.equal(body.data.courses[0].stampProgress, null);
    assert.equal('stamped' in body.data.courses[0], false);
  });

  test('recent community courses endpoint returns latest 10 public user courses', async () => {
    const token = signAccessToken(seeded.userId);
    const insertedCourseIds: number[] = [];

    for (let index = 1; index <= 11; index += 1) {
      insertedCourseIds.push(
        await insertCommunityCourse(
          seeded.otherUserId,
          index,
          new Date(Date.UTC(2026, 2, 19, 0, index, 0)),
        ),
      );
    }

    await getPool().execute<ResultSetHeader>(
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
        ) VALUES (?, ?, ?, ?, 1, NULL, 0, NULL, ?, ?)`,
      [
        '최신 공식 코스',
        'Latest Official Course',
        '제외되어야 하는 공식 코스',
        'Official course to exclude',
        new Date(Date.UTC(2026, 2, 19, 1, 0, 0)),
        new Date(Date.UTC(2026, 2, 19, 1, 0, 0)),
      ],
    );
    const deletedCourseId = await insertCommunityCourse(
      seeded.otherUserId,
      12,
      new Date(Date.UTC(2026, 2, 19, 1, 1, 0)),
      new Date(Date.UTC(2026, 2, 19, 1, 2, 0)),
    );

    const response = await handleCoursesRequest(
      createEvent('/v1/courses/community/recent', 'size=10', token),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;
    const body = JSON.parse(response.body as string);
    const expectedIds = insertedCourseIds.slice(1).reverse();

    assert.equal(response.statusCode, 200);
    assert.equal(body.data.page, 1);
    assert.equal(body.data.size, 10);
    assert.equal(body.data.total, 13);
    assert.deepEqual(
      body.data.courses.map((course: { id: number }) => course.id),
      expectedIds,
    );
    assert.equal(body.data.courses.every((course: { is_official: boolean }) => !course.is_official), true);
    assert.equal(body.data.courses.every((course: { stampProgress: null }) => course.stampProgress === null), true);
    assert.equal(body.data.courses.some((course: { id: number }) => course.id === deletedCourseId), false);
    assert.equal(body.data.courses.some((course: { id: number }) => course.id === seeded.officialCourseId), false);
  });

  test('favorites endpoint returns liked official and community courses in separate arrays', async () => {
    const token = signAccessToken(seeded.userId);

    const response = await handleCoursesRequest(
      createEvent('/v1/courses/favorites', '', token),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;
    const body = JSON.parse(response.body as string);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(
      body.data.officialCourses.map((course: { id: number }) => course.id),
      [seeded.officialCourseId],
    );
    assert.deepEqual(
      body.data.communityCourses.map((course: { id: number }) => course.id),
      [seeded.myCourseId],
    );
    assert.equal(body.data.officialCourses[0].liked, true);
    assert.deepEqual(body.data.officialCourses[0].stampProgress, {
      checkedInCount: 1,
      totalCount: 2,
    });
    assert.equal(body.data.communityCourses[0].liked, true);
    assert.equal(body.data.communityCourses[0].stampProgress, null);
  });

  test('owner can soft-delete custom course and deleted course disappears from course reads', async () => {
    const token = signAccessToken(seeded.userId);

    const response = await handleCoursesRequest(
      createEvent(`/v1/courses/${seeded.myCourseId}`, '', token, 'DELETE'),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;
    const body = JSON.parse(response.body as string);
    const deletedRows = await queryRows<RowDataPacket>(
      `SELECT deleted_at
       FROM courses
       WHERE id = ?`,
      [seeded.myCourseId],
    );
    const myCoursesResponse = await handleCoursesRequest(
      createEvent('/v1/courses/mine', 'page=1&size=20', token),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;
    const communityResponse = await handleCoursesRequest(
      createEvent('/v1/courses/community/recent', 'size=10', token),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;
    const favoritesResponse = await handleCoursesRequest(
      createEvent('/v1/courses/favorites', '', token),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;
    const detailResponse = await handleCoursesRequest(
      createEvent(`/v1/courses/${seeded.myCourseId}`, '', token),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;

    assert.equal(response.statusCode, 200);
    assert.deepEqual(body.data, {
      courseId: seeded.myCourseId,
      deleted: true,
    });
    assert.notEqual(deletedRows[0]?.deleted_at, null);
    assert.equal(JSON.parse(myCoursesResponse.body as string).data.total, 0);
    assert.equal(
      JSON.parse(communityResponse.body as string).data.courses.some(
        (course: { id: number }) => course.id === seeded.myCourseId,
      ),
      false,
    );
    assert.equal(JSON.parse(favoritesResponse.body as string).data.communityCourses.length, 0);
    assert.equal(detailResponse.statusCode, 404);
  });

  test('official and non-owner course delete are forbidden', async () => {
    const token = signAccessToken(seeded.userId);

    const officialResponse = await handleCoursesRequest(
      createEvent(`/v1/courses/${seeded.officialCourseId}`, '', token, 'DELETE'),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;
    const nonOwnerResponse = await handleCoursesRequest(
      createEvent(`/v1/courses/${seeded.otherUserCourseId}`, '', token, 'DELETE'),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;

    assert.equal(officialResponse.statusCode, 403);
    assert.equal(JSON.parse(officialResponse.body as string).error.code, 'FORBIDDEN');
    assert.equal(nonOwnerResponse.statusCode, 403);
    assert.equal(JSON.parse(nonOwnerResponse.body as string).error.code, 'FORBIDDEN');
  });

  test('course detail endpoint returns seq order, liked, editable, and checkedIn state', async () => {
    const token = signAccessToken(seeded.userId);

    const response = await handleCoursesRequest(
      createEvent(`/v1/courses/${seeded.officialCourseId}`, '', token),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;
    const body = JSON.parse(response.body as string);

    assert.equal(response.statusCode, 200);
    assert.equal(body.data.id, seeded.officialCourseId);
    assert.equal(body.data.liked, true);
    assert.equal(body.data.editable, false);
    assert.deepEqual(body.data.stampProgress, {
      checkedInCount: 1,
      totalCount: 2,
    });
    assert.equal('stamped' in body.data, false);
    assert.deepEqual(body.data.items.map((item: { seq: number }) => item.seq), [1, 2]);
    assert.deepEqual(body.data.items.map((item: { checkedIn: boolean }) => item.checkedIn), [true, false]);
  });

  test('course create endpoint persists course and items then returns detail response', async () => {
    const token = signAccessToken(seeded.userId);

    const response = await handleCoursesRequest(
      createEvent('/v1/courses', '', token, 'POST', {
        description_en: 'Fresh seaside route',
        description_ko: '새 바닷길 코스',
        items: [
          { artwork_id: seeded.artworkIds.one, seq: 1 },
        ],
        title_en: 'Fresh Course',
        title_ko: '새 코스',
      }),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;
    const body = JSON.parse(response.body as string);
    const rows = await queryRows<RowDataPacket>(
      `SELECT created_by_user_id
       FROM courses
       WHERE id = ?`,
      [body.data.id],
    );

    assert.equal(response.statusCode, 200);
    assert.equal(body.data.title_ko, '새 코스');
    assert.equal(body.data.stampProgress, null);
    assert.equal('stamped' in body.data, false);
    assert.equal(rows[0]?.created_by_user_id, seeded.userId);
  });

  test('course update endpoint replaces course items and persists latest detail', async () => {
    const token = signAccessToken(seeded.userId);

    const response = await handleCoursesRequest(
      createEvent(`/v1/courses/${seeded.myCourseId}`, '', token, 'PATCH', {
        description_en: 'Updated route',
        description_ko: '업데이트 코스',
        items: [
          { artwork_id: seeded.artworkIds.one, seq: 1 },
          { artwork_id: seeded.artworkIds.two, seq: 2 },
        ],
        title_en: 'Updated Course',
        title_ko: '업데이트 코스',
      }),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;
    const body = JSON.parse(response.body as string);
    const rows = await queryRows<CountRow>(
      `SELECT COUNT(*) AS total
       FROM course_items
       WHERE course_id = ?`,
      [seeded.myCourseId],
    );

    assert.equal(response.statusCode, 200);
    assert.equal(body.data.title_ko, '업데이트 코스');
    assert.equal(body.data.stampProgress, null);
    assert.equal('stamped' in body.data, false);
    assert.equal(rows[0]?.total, 2);
  });

  test('official course update is forbidden', async () => {
    const token = signAccessToken(seeded.userId);

    const response = await handleCoursesRequest(
      createEvent(`/v1/courses/${seeded.officialCourseId}`, '', token, 'PATCH', {
        description_en: 'Updated route',
        description_ko: '업데이트 코스',
        items: [{ artwork_id: seeded.artworkIds.one, seq: 1 }],
        title_en: 'Updated Course',
        title_ko: '업데이트 코스',
      }),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;

    assert.equal(response.statusCode, 403);
    assert.equal(JSON.parse(response.body as string).error.code, 'FORBIDDEN');
  });

  test('non-owner course update is forbidden', async () => {
    const token = signAccessToken(seeded.userId);

    const response = await handleCoursesRequest(
      createEvent(`/v1/courses/${seeded.otherUserCourseId}`, '', token, 'PATCH', {
        description_en: 'Updated route',
        description_ko: '업데이트 코스',
        items: [{ artwork_id: seeded.artworkIds.one, seq: 1 }],
        title_en: 'Updated Course',
        title_ko: '업데이트 코스',
      }),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;

    assert.equal(response.statusCode, 403);
    assert.equal(JSON.parse(response.body as string).error.code, 'FORBIDDEN');
  });

  test('course like and unlike endpoints are idempotent', async () => {
    const token = signAccessToken(seeded.userId);

    await handleCoursesRequest(
      createEvent(`/v1/courses/${seeded.otherUserCourseId}/like`, '', token, 'POST'),
      {} as Context,
    );
    await handleCoursesRequest(
      createEvent(`/v1/courses/${seeded.otherUserCourseId}/like`, '', token, 'POST'),
      {} as Context,
    );

    assert.equal(await countCourseLikes(seeded.userId, seeded.otherUserCourseId), 1);

    await handleCoursesRequest(
      createEvent(`/v1/courses/${seeded.otherUserCourseId}/like`, '', token, 'DELETE'),
      {} as Context,
    );
    await handleCoursesRequest(
      createEvent(`/v1/courses/${seeded.otherUserCourseId}/like`, '', token, 'DELETE'),
      {} as Context,
    );

    assert.equal(await countCourseLikes(seeded.userId, seeded.otherUserCourseId), 0);
  });

  test('official course check-in succeeds within 15 meters', async () => {
    const token = signAccessToken(seeded.userId);

    const response = await handleCoursesRequest(
      createEvent(`/v1/courses/${seeded.officialCourseId}/checkins`, '', token, 'POST', {
        course_item_id: seeded.officialCourseItemIds.second,
        lat: 36.06701,
        lng: 129.39501,
      }),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body as string).data, {
      checkedIn: true,
      courseId: seeded.officialCourseId,
      courseItemId: seeded.officialCourseItemIds.second,
      stampProgress: {
        checkedInCount: 2,
        totalCount: 2,
      },
    });
    assert.equal(await countCourseCheckins(seeded.userId, seeded.officialCourseItemIds.second), 1);
  });

  test('unofficial course check-in is forbidden', async () => {
    const token = signAccessToken(seeded.userId);

    const response = await handleCoursesRequest(
      createEvent(`/v1/courses/${seeded.myCourseId}/checkins`, '', token, 'POST', {
        course_item_id: seeded.myCourseItemId,
        lat: 36.067,
        lng: 129.395,
      }),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;

    assert.equal(response.statusCode, 403);
    assert.equal(JSON.parse(response.body as string).error.code, 'FORBIDDEN');
  });

  test('check-in rejects item from another course', async () => {
    const token = signAccessToken(seeded.userId);

    const response = await handleCoursesRequest(
      createEvent(`/v1/courses/${seeded.officialCourseId}/checkins`, '', token, 'POST', {
        course_item_id: seeded.myCourseItemId,
        lat: 36.067,
        lng: 129.395,
      }),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;

    assert.equal(response.statusCode, 404);
    assert.equal(JSON.parse(response.body as string).error.code, 'NOT_FOUND');
  });

  test('check-in rejects location outside allowed radius', async () => {
    const token = signAccessToken(seeded.userId);

    const response = await handleCoursesRequest(
      createEvent(`/v1/courses/${seeded.officialCourseId}/checkins`, '', token, 'POST', {
        course_item_id: seeded.officialCourseItemIds.second,
        lat: 36.07,
        lng: 129.41,
      }),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;

    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(response.body as string).error.code, 'BAD_REQUEST');
  });

  test('check-in rejects duplicate item stamp', async () => {
    const token = signAccessToken(seeded.userId);

    const response = await handleCoursesRequest(
      createEvent(`/v1/courses/${seeded.officialCourseId}/checkins`, '', token, 'POST', {
        course_item_id: seeded.officialCourseItemIds.first,
        lat: 36.058,
        lng: 129.378,
      }),
      {} as Context,
    ) as APIGatewayProxyStructuredResultV2;

    assert.equal(response.statusCode, 409);
    assert.equal(JSON.parse(response.body as string).error.code, 'CONFLICT');
  });
}
