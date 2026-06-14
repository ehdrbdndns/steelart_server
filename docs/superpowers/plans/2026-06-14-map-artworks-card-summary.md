# Map Artworks Card Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/v1/map/artworks` 응답에 클러스터 bottom sheet 카드 렌더링에 필요한 작가명, 장소명, 썸네일 URL/크기 필드를 포함한다.

**Architecture:** 기존 `map` 도메인 Lambda, service, repository 구조는 유지한다. `MapArtwork` DTO를 카드 요약 필드까지 확장하고, repository SQL에서 기존 `artworks`, `artists`, `places`, `artwork_likes` 조인에 첫 번째 `artwork_images` 썸네일 조인을 추가한다. API 계약 문서와 단위/통합 테스트를 같은 변경 세트에서 갱신한다.

**Tech Stack:** Node.js 24, TypeScript, AWS Lambda HTTP API, mysql2 raw SQL, zod, node:test

---

## File Structure

- Modify: `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
  - `/v1/map/artworks` 실제 `data` 타입에 카드 요약 필드를 반영한다.
- Modify: `src/domains/map/types.ts`
  - `MapArtwork`에 작가명, 장소명, 썸네일 URL/width/height를 추가한다.
- Modify: `src/domains/map/repository.ts`
  - `MapArtworkRow`, `mapArtworkRow`, `createMapRepository().listArtworks()` SELECT를 확장한다.
  - `artwork_images`에서 artwork별 `MIN(id)` 이미지를 썸네일로 선택한다.
- Modify: `src/domains/map/mapper.ts`
  - Lambda 응답 경계에서 확장된 필드를 그대로 반환한다.
- Modify: `tests/unit/map/map-mapper.test.ts`
  - 매퍼가 카드 요약 필드를 보존하는지 검증한다.
- Modify: `tests/unit/map/map-handler.test.ts`
  - 핸들러 스텁과 응답 assertion을 확장해 Lambda 응답 경로를 검증한다.
- Modify: `tests/integration/content/content-read.integration.test.ts`
  - 실제 DB seed 기반으로 `/v1/map/artworks` 응답의 작가명, 장소명, 썸네일 필드를 검증한다.

## Current Implementation Notes

- 현재 `src/domains/map/types.ts`의 `MapArtwork`는 `id`, `title_ko`, `title_en`, `lat`, `lng`, `liked`만 가진다.
- 현재 `src/domains/map/repository.ts`는 `artworks a`, `artists ar`, `places p`, `artwork_likes al`를 조인하지만 SELECT에는 `ar.name_*`, `p.name_*`, `artwork_images` 썸네일을 포함하지 않는다.
- 검색 API는 `src/domains/search/repository.ts`에서 `THUMBNAIL_JOIN_SQL` 패턴으로 `artwork_images`의 artwork별 가장 작은 `id` 이미지를 썸네일로 사용한다. 지도 API도 같은 기준을 따른다.
- `tests/integration/content/content-read.integration.test.ts`의 seed 데이터는 첫 번째 작품에 아래 값을 이미 넣는다.

```ts
artist_name_ko: '포스아트'
artist_name_en: 'PosArt'
place_name_ko: '영일대'
place_name_en: 'Yeongildae'
thumbnail_image_url: 'https://example.com/space-walk-1.jpg'
thumbnail_image_width: 1200
thumbnail_image_height: 800
```

### Task 1: API Contract Update

**Files:**
- Modify: `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`

- [ ] **Step 1: Update the map artwork response contract**

Replace section `6-1. 지도용 작품 마커 조회`의 `응답 권장 필드` and `실제 data 타입` blocks with this content:

````markdown
- 응답 권장 필드:
  - `id`
  - `title_ko`, `title_en`
  - `lat`, `lng`
  - `liked`
  - `artist_name_ko`, `artist_name_en`
  - `place_name_ko`, `place_name_en`
  - `thumbnail_image_url`
  - `thumbnail_image_width`
  - `thumbnail_image_height`
- 주의:
  - 즐겨찾기 여부 필터링은 앱에서 처리한다.
  - 내 위치 기준 거리 계산과 반경 필터링은 서버에서 수행한다.
  - 지도 마커 조회는 `lat/lng/radiusMeters`만 받고, 검색은 공용 검색 API에서 처리한다.
  - 응답에는 거리값을 포함하지 않고, 서버 내부 정렬과 반경 필터에만 사용한다.
  - 클러스터 bottom sheet는 검색 결과/작품 카드와 같은 UX로 노출되므로 카드 요약 필드를 함께 반환한다.
- 실제 `data` 타입:
```ts
{
  artworks: Array<{
    id: number;
    title_ko: string | null;
    title_en: string | null;
    lat: number;
    lng: number;
    liked: boolean;
    artist_name_ko: string | null;
    artist_name_en: string | null;
    place_name_ko: string | null;
    place_name_en: string | null;
    thumbnail_image_url: string | null;
    thumbnail_image_width: number | null;
    thumbnail_image_height: number | null;
  }>;
}
```
````

- [ ] **Step 2: Verify the contract diff**

Run:

```bash
git diff -- /Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md
```

Expected: diff only changes `/v1/map/artworks` response field documentation and does not add a new map endpoint.

- [ ] **Step 3: Commit contract update**

```bash
git add /Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md
git commit -m "docs: expand map artworks response contract"
```

### Task 2: Type and Mapper Contract

**Files:**
- Modify: `src/domains/map/types.ts`
- Modify: `src/domains/map/mapper.ts`
- Test: `tests/unit/map/map-mapper.test.ts`

- [ ] **Step 1: Write the failing mapper test**

Replace `tests/unit/map/map-mapper.test.ts` with:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { mapMapArtwork } from '../../../src/domains/map/mapper.js';

// 지도 매퍼는 클러스터 bottom sheet 카드에 필요한 요약 필드를 보존해야 한다.
test('map mapper keeps card summary fields', () => {
  const mapped = mapMapArtwork({
    artist_name_en: 'PosArt',
    artist_name_ko: '포스아트',
    id: 1,
    lat: 36.1001,
    liked: false,
    lng: 129.3001,
    place_name_en: 'Yeongildae',
    place_name_ko: '영일대',
    thumbnail_image_height: 800,
    thumbnail_image_url: 'https://example.com/space-walk-1.jpg',
    thumbnail_image_width: 1200,
    title_en: 'Space Walk',
    title_ko: '스페이스워크',
  });

  assert.deepEqual(mapped, {
    artist_name_en: 'PosArt',
    artist_name_ko: '포스아트',
    id: 1,
    lat: 36.1001,
    liked: false,
    lng: 129.3001,
    place_name_en: 'Yeongildae',
    place_name_ko: '영일대',
    thumbnail_image_height: 800,
    thumbnail_image_url: 'https://example.com/space-walk-1.jpg',
    thumbnail_image_width: 1200,
    title_en: 'Space Walk',
    title_ko: '스페이스워크',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- tests/unit/map/map-mapper.test.ts
```

Expected: FAIL during TypeScript execution because `MapArtwork` does not yet accept `artist_name_en`, `artist_name_ko`, `place_name_en`, `place_name_ko`, `thumbnail_image_url`, `thumbnail_image_width`, or `thumbnail_image_height`.

- [ ] **Step 3: Expand `MapArtwork`**

Replace `src/domains/map/types.ts` with:

```ts
export interface MapArtworksInput {
  lat: number;
  lng: number;
  radiusMeters: number;
}

export interface MapArtwork {
  artist_name_en: string | null;
  artist_name_ko: string | null;
  id: number;
  lat: number;
  liked: boolean;
  lng: number;
  place_name_en: string | null;
  place_name_ko: string | null;
  thumbnail_image_height: number | null;
  thumbnail_image_url: string | null;
  thumbnail_image_width: number | null;
  title_en: string | null;
  title_ko: string | null;
}

export interface MapArtworksResponse {
  artworks: MapArtwork[];
}
```

- [ ] **Step 4: Preserve new fields in the mapper**

Replace `mapMapArtwork` in `src/domains/map/mapper.ts` with:

```ts
export function mapMapArtwork(artwork: MapArtwork): MapArtwork {
  return {
    artist_name_en: artwork.artist_name_en,
    artist_name_ko: artwork.artist_name_ko,
    id: artwork.id,
    lat: artwork.lat,
    liked: artwork.liked,
    lng: artwork.lng,
    place_name_en: artwork.place_name_en,
    place_name_ko: artwork.place_name_ko,
    thumbnail_image_height: artwork.thumbnail_image_height,
    thumbnail_image_url: artwork.thumbnail_image_url,
    thumbnail_image_width: artwork.thumbnail_image_width,
    title_en: artwork.title_en,
    title_ko: artwork.title_ko,
  };
}
```

- [ ] **Step 5: Make response mapping explicit**

Replace `mapMapArtworksResponse` in `src/domains/map/mapper.ts` with:

```ts
export function mapMapArtworksResponse(artworks: MapArtwork[]): MapArtworksResponse {
  return {
    artworks: artworks.map(mapMapArtwork),
  };
}
```

- [ ] **Step 6: Run mapper test to verify it passes**

Run:

```bash
pnpm test -- tests/unit/map/map-mapper.test.ts
```

Expected: PASS, including `map mapper keeps card summary fields`.

- [ ] **Step 7: Commit type and mapper update**

```bash
git add src/domains/map/types.ts src/domains/map/mapper.ts tests/unit/map/map-mapper.test.ts
git commit -m "feat: add card fields to map artwork dto"
```

### Task 3: Repository SQL and Row Mapping

**Files:**
- Modify: `src/domains/map/repository.ts`
- Test: `tests/integration/content/content-read.integration.test.ts`

- [ ] **Step 1: Write the failing integration assertions**

In `tests/integration/content/content-read.integration.test.ts`, update `test('map endpoint returns artworks ordered by distance within radius')` to:

```ts
test('map endpoint returns artworks ordered by distance within radius', async () => {
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
  assert.equal(typeof body.data.artworks[0].lat, 'number');
  assert.equal(typeof body.data.artworks[0].lng, 'number');
  assert.equal(body.data.artworks[0].liked, true);
  assert.equal(body.data.artworks[0].artist_name_ko, '포스아트');
  assert.equal(body.data.artworks[0].artist_name_en, 'PosArt');
  assert.equal(body.data.artworks[0].place_name_ko, '영일대');
  assert.equal(body.data.artworks[0].place_name_en, 'Yeongildae');
  assert.equal(body.data.artworks[0].thumbnail_image_url, 'https://example.com/space-walk-1.jpg');
  assert.equal(body.data.artworks[0].thumbnail_image_width, 1200);
  assert.equal(body.data.artworks[0].thumbnail_image_height, 800);
});
```

- [ ] **Step 2: Run integration test to verify it fails**

Run:

```bash
pnpm test:integration -- tests/integration/content/content-read.integration.test.ts
```

Expected: FAIL for missing `artist_name_ko`, `artist_name_en`, `place_name_ko`, `place_name_en`, `thumbnail_image_url`, `thumbnail_image_width`, or `thumbnail_image_height` on map artwork items. If the local integration DB is not configured, rerun with the project’s configured integration environment command:

```bash
pnpm test:integration:env -- tests/integration/content/content-read.integration.test.ts
```

- [ ] **Step 3: Expand `MapArtworkRow`**

Replace the `MapArtworkRow` interface in `src/domains/map/repository.ts` with:

```ts
interface MapArtworkRow extends RowDataPacket {
  artist_name_en: string | null;
  artist_name_ko: string | null;
  id: number;
  lat: number;
  liked: number | boolean;
  lng: number;
  place_name_en: string | null;
  place_name_ko: string | null;
  thumbnail_image_height: number | null;
  thumbnail_image_url: string | null;
  thumbnail_image_width: number | null;
  title_en: string | null;
  title_ko: string | null;
}
```

- [ ] **Step 4: Expand `mapArtworkRow`**

Replace `mapArtworkRow` in `src/domains/map/repository.ts` with:

```ts
function mapArtworkRow(row: MapArtworkRow): MapArtwork {
  return {
    artist_name_en: row.artist_name_en,
    artist_name_ko: row.artist_name_ko,
    id: row.id,
    lat: Number(row.lat),
    liked: row.liked === true || row.liked === 1,
    lng: Number(row.lng),
    place_name_en: row.place_name_en,
    place_name_ko: row.place_name_ko,
    thumbnail_image_height: row.thumbnail_image_height,
    thumbnail_image_url: row.thumbnail_image_url,
    thumbnail_image_width: row.thumbnail_image_width,
    title_en: row.title_en,
    title_ko: row.title_ko,
  };
}
```

- [ ] **Step 5: Add thumbnail join constant**

Insert this constant after the `MapRepository` interface in `src/domains/map/repository.ts`:

```ts
const THUMBNAIL_JOIN_SQL = `
  LEFT JOIN (
    SELECT ai.artwork_id, ai.image_url, ai.image_width, ai.image_height
    FROM artwork_images ai
    INNER JOIN (
      SELECT artwork_id, MIN(id) AS first_image_id
      FROM artwork_images
      GROUP BY artwork_id
    ) first_ai ON first_ai.first_image_id = ai.id
  ) thumb ON thumb.artwork_id = a.id
`;
```

- [ ] **Step 6: Expand the repository SELECT**

Replace the SQL string inside `connection.execute<MapArtworkRow[]>` in `createMapRepository().listArtworks()` with:

```ts
`SELECT
    map_artworks.id,
    map_artworks.title_ko,
    map_artworks.title_en,
    map_artworks.artist_name_ko,
    map_artworks.artist_name_en,
    map_artworks.place_name_ko,
    map_artworks.place_name_en,
    map_artworks.lat,
    map_artworks.lng,
    map_artworks.thumbnail_image_url,
    map_artworks.thumbnail_image_width,
    map_artworks.thumbnail_image_height,
    map_artworks.liked
 FROM (
   SELECT
     a.id,
     a.title_ko,
     a.title_en,
     ar.name_ko AS artist_name_ko,
     ar.name_en AS artist_name_en,
     p.name_ko AS place_name_ko,
     p.name_en AS place_name_en,
     CAST(p.lat AS DOUBLE) AS lat,
     CAST(p.lng AS DOUBLE) AS lng,
     thumb.image_url AS thumbnail_image_url,
     thumb.image_width AS thumbnail_image_width,
     thumb.image_height AS thumbnail_image_height,
     CASE WHEN al.user_id IS NULL THEN 0 ELSE 1 END AS liked,
     6371000 * 2 * ASIN(
       SQRT(
         POW(SIN(RADIANS(CAST(p.lat AS DOUBLE) - ?) / 2), 2) +
         COS(RADIANS(?)) * COS(RADIANS(CAST(p.lat AS DOUBLE))) *
         POW(SIN(RADIANS(CAST(p.lng AS DOUBLE) - ?) / 2), 2)
       )
     ) AS distance_m
   FROM artworks a
   INNER JOIN artists ar ON ar.id = a.artist_id
   INNER JOIN places p ON p.id = a.place_id
   ${THUMBNAIL_JOIN_SQL}
   LEFT JOIN artwork_likes al ON al.artwork_id = a.id AND al.user_id = ?
   WHERE a.deleted_at IS NULL
     AND ar.deleted_at IS NULL
     AND p.deleted_at IS NULL
 ) map_artworks
 WHERE map_artworks.distance_m <= ?
 ORDER BY map_artworks.distance_m ASC, map_artworks.id ASC`
```

- [ ] **Step 7: Run integration test to verify it passes**

Run:

```bash
pnpm test:integration:env -- tests/integration/content/content-read.integration.test.ts
```

Expected: PASS for `map endpoint returns artworks ordered by distance within radius`; other content integration tests remain PASS.

- [ ] **Step 8: Commit repository update**

```bash
git add src/domains/map/repository.ts tests/integration/content/content-read.integration.test.ts
git commit -m "feat: return card summaries from map artworks"
```

### Task 4: Handler Contract Test

**Files:**
- Modify: `tests/unit/map/map-handler.test.ts`

- [ ] **Step 1: Expand the handler service stub**

Replace `createMapServiceStub` in `tests/unit/map/map-handler.test.ts` with:

```ts
function createMapServiceStub(): MapService {
  return {
    async getMapArtworks() {
      return {
        artworks: [
          {
            artist_name_en: 'PosArt',
            artist_name_ko: '포스아트',
            id: 1,
            lat: 36.1,
            liked: true,
            lng: 129.3,
            place_name_en: 'Yeongildae',
            place_name_ko: '영일대',
            thumbnail_image_height: 800,
            thumbnail_image_url: 'https://example.com/space-walk-1.jpg',
            thumbnail_image_width: 1200,
            title_en: 'Space Walk',
            title_ko: '스페이스워크',
          },
        ],
      };
    },
  };
}
```

- [ ] **Step 2: Expand the successful handler assertions**

Replace the assertions in `test('map handler returns map artworks for GET /v1/map/artworks')` with:

```ts
  const body = JSON.parse(response.body as string);

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.artworks[0].lat, 36.1);
  assert.equal(body.data.artworks[0].liked, true);
  assert.equal(body.data.artworks[0].artist_name_ko, '포스아트');
  assert.equal(body.data.artworks[0].artist_name_en, 'PosArt');
  assert.equal(body.data.artworks[0].place_name_ko, '영일대');
  assert.equal(body.data.artworks[0].place_name_en, 'Yeongildae');
  assert.equal(body.data.artworks[0].thumbnail_image_url, 'https://example.com/space-walk-1.jpg');
  assert.equal(body.data.artworks[0].thumbnail_image_width, 1200);
  assert.equal(body.data.artworks[0].thumbnail_image_height, 800);
```

- [ ] **Step 3: Run handler test**

Run:

```bash
pnpm test -- tests/unit/map/map-handler.test.ts
```

Expected: PASS for both map handler unit tests.

- [ ] **Step 4: Commit handler test update**

```bash
git add tests/unit/map/map-handler.test.ts
git commit -m "test: assert map artwork card fields in handler"
```

### Task 5: Full Verification

**Files:**
- Verify: `src/domains/map/types.ts`
- Verify: `src/domains/map/mapper.ts`
- Verify: `src/domains/map/repository.ts`
- Verify: `tests/unit/map/map-mapper.test.ts`
- Verify: `tests/unit/map/map-handler.test.ts`
- Verify: `tests/integration/content/content-read.integration.test.ts`
- Verify: `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`

- [ ] **Step 1: Run map unit tests**

Run:

```bash
pnpm test -- tests/unit/map/map-mapper.test.ts tests/unit/map/map-handler.test.ts tests/unit/map/map-schemas.test.ts
```

Expected: PASS for all map unit tests.

- [ ] **Step 2: Run all unit tests**

Run:

```bash
pnpm test
```

Expected: PASS for all unit tests.

- [ ] **Step 3: Run TypeScript typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 4: Run content integration tests**

Run:

```bash
pnpm test:integration:env -- tests/integration/content/content-read.integration.test.ts
```

Expected: PASS. The map endpoint test confirms first-distance ordering, liked state, artist names, place names, and thumbnail URL/width/height.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
git diff --stat
git diff -- src/domains/map/types.ts src/domains/map/mapper.ts src/domains/map/repository.ts tests/unit/map/map-mapper.test.ts tests/unit/map/map-handler.test.ts tests/integration/content/content-read.integration.test.ts /Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md
```

Expected: diff is limited to map artwork response expansion, its tests, and the API contract update. No schema migration, new endpoint, or app-local behavior change is included.

- [ ] **Step 6: Commit verification fixes if needed**

If verification required small fixes, stage only the files changed by this plan and commit:

```bash
git add src/domains/map/types.ts src/domains/map/mapper.ts src/domains/map/repository.ts tests/unit/map/map-mapper.test.ts tests/unit/map/map-handler.test.ts tests/integration/content/content-read.integration.test.ts /Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md
git commit -m "test: verify expanded map artwork response"
```

If no verification fixes were needed after Tasks 1-4 commits, do not create an empty commit.

## Self-Review

- Spec coverage: The plan adds all requested fields: `artist_name_ko`, `artist_name_en`, `place_name_ko`, `place_name_en`, `thumbnail_image_url`, `thumbnail_image_width`, and `thumbnail_image_height`. It preserves existing `id`, `title_ko`, `title_en`, `lat`, `lng`, and `liked`.
- API behavior: The plan keeps the existing `/v1/map/artworks` endpoint, request parameters, radius filtering, distance ordering, authentication, and client-side favorite filtering policy.
- SQL consistency: The thumbnail selection follows the existing search/course pattern: first `artwork_images.id` per artwork.
- Type consistency: `MapArtworkRow`, `MapArtwork`, `mapArtworkRow`, `mapMapArtwork`, handler stubs, unit tests, and integration assertions use identical snake_case field names.
- Placeholder scan: The plan contains no unresolved implementation placeholders and gives exact replacement snippets and commands.
