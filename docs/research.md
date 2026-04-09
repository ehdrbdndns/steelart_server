# `/v1/artworks` 정렬/좋아요 필터 확장 리서치

## 문서 목적
- `GET /v1/artworks`에 `title` 정렬을 추가하고, `likedOnly` 필터를 추가하기 위해 필요한 현재 계약, 코드 구조, DB 기준을 정리한다.
- 이번 문서는 작품 아카이브 목록 API 확장만 다루며, 상세 조회/좋아요 write API 자체 변경은 범위에서 제외한다.

## 조사 기준
- [/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md](/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md)
- [/Users/donggyunyang/code/steelart/STEELART_APP_SCREEN_SPECS.md](/Users/donggyunyang/code/steelart/STEELART_APP_SCREEN_SPECS.md)
- [/Users/donggyunyang/code/steelart/STEELART_DB_TABLES.md](/Users/donggyunyang/code/steelart/STEELART_DB_TABLES.md)
- [src/lambdas/artworks/handler.ts](/Users/donggyunyang/code/steelart/steelart_server/src/lambdas/artworks/handler.ts)
- [src/domains/artworks/types.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/types.ts)
- [src/domains/artworks/schemas.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/schemas.ts)
- [src/domains/artworks/repository.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/repository.ts)
- [src/domains/artworks/service.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/service.ts)
- [tests/unit/artworks/artworks-handler.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/unit/artworks/artworks-handler.test.ts)
- [tests/integration/content/content-read.integration.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/integration/content/content-read.integration.test.ts)

## 변경 목표
- 기존 `GET /v1/artworks`에 아래 두 기능을 추가한다.
  - `sort=title`
  - `likedOnly=true`
- 기존 필터와 페이지네이션은 그대로 유지한다.
  - `placeId`
  - `artistType`
  - `festivalYear`
  - `page`
  - `size`

## 범위에서 제외하는 것
- `GET /v1/artworks/filters` 응답 구조 변경
- 작품 좋아요 write API 변경
- 검색 API 변경
- 지도/홈 카드 정렬 규칙 변경

## 현재 루트 API 계약

### 현재 문서 상태
- [STEELART_SERVER_API_DRAFT.md](/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md)의 `GET /v1/artworks`는 현재 아래만 명시한다.
  - `sort=latest|oldest`
  - `placeId=1&placeId=2`
  - `artistType=COMPANY&artistType=INDIVIDUAL`
  - `festivalYear=2023&festivalYear=2024`
  - `page`
  - `size`
- 즉 `title` 정렬과 `likedOnly`는 아직 계약에 없다.

### 이번 변경으로 문서에 추가되어야 할 것
- `sort=latest|oldest|title`
- `likedOnly=true`
- `likedOnly`는 선택적 boolean이며 `true`일 때만 적용된다는 점
- `likedOnly`를 써도 기존 `liked: boolean` 응답 필드는 계속 유지된다는 점

## 앱 관점에서 필요한 이유

### 작품 아카이브 화면 요구사항
- [STEELART_APP_SCREEN_SPECS.md](/Users/donggyunyang/code/steelart/STEELART_APP_SCREEN_SPECS.md)의 `5-1. 작품 아카이브 목록 화면` 요구사항은 현재 아래와 같다.
  - 정렬 옵션:
    - 최신순
    - 오래된 순
  - 필터 옵션:
    - 설치 장소
    - 제작 주체
    - 축제 연도
  - 카드 구성:
    - 작품 이미지
    - 작가명
    - 위치
    - 좋아요 여부 아이콘

### 이번 추가 요구사항 해석
- `title` 정렬은 작품명 순 정렬을 직접 지원하려는 요구다.
- `likedOnly`는 사용자가 좋아요한 작품만 별도로 좁혀보고 싶은 요구다.
- 둘 다 작품 아카이브 결과 목록을 좁히거나 정렬하는 규칙이므로 `GET /v1/artworks`에 붙이는 것이 자연스럽다.

## 현재 구현 상태

### handler
- [src/lambdas/artworks/handler.ts](/Users/donggyunyang/code/steelart/steelart_server/src/lambdas/artworks/handler.ts)
- 현재 `GET /v1/artworks`는 아래 query만 읽는다.
  - `artistType`
  - `festivalYear`
  - `page`
  - `placeId`
  - `size`
  - `sort`
- `likedOnly`는 아직 읽지 않는다.

### schema
- [src/domains/artworks/schemas.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/schemas.ts)
- 현재 schema:
```ts
{
  artistType: ArtistType[];
  festivalYear: string[];
  page: number;
  placeId: number[];
  size: number;
  sort: 'latest' | 'oldest';
}
```
- 즉 아래가 아직 없다.
  - `sort='title'`
  - `likedOnly: boolean`

### type
- [src/domains/artworks/types.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/types.ts)
- 현재:
```ts
export const ARTWORK_SORT_VALUES = ['latest', 'oldest'] as const;
```
- `ArtworkListInput`도 아직 `likedOnly`를 가지지 않는다.

### repository
- [src/domains/artworks/repository.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/repository.ts)
- 현재 `listArtworks()`는 아래 where만 조합한다.
  - `a.deleted_at IS NULL`
  - `ar.deleted_at IS NULL`
  - `p.deleted_at IS NULL`
  - optional `a.place_id IN (...)`
  - optional `ar.type IN (...)`
  - optional `EXISTS (...) artwork_festivals.year IN (...)`
- 좋아요는 현재 응답용 계산만 한다.
```sql
LEFT JOIN artwork_likes al ON al.artwork_id = a.id AND al.user_id = ?
CASE WHEN al.user_id IS NULL THEN 0 ELSE 1 END AS liked
```
- 즉 `likedOnly`는 아직 where에 들어가지 않는다.

### 현재 정렬 로직
- `buildArtworkSortClause(sort)`는 지금 아래 둘만 지원한다.
  - `latest`
  - `oldest`
- 정렬 기준은 축제 연도 메타를 우선 사용한다.
```sql
ORDER BY COALESCE(festivals.latest_festival_year, festivals.oldest_festival_year, a.production_year, 0) DESC, a.id DESC
```
- `title` 정렬은 아직 없다.

## `likedOnly` 구현에 필요한 DB 기준

### `artwork_likes`
- [STEELART_DB_TABLES.md](/Users/donggyunyang/code/steelart/STEELART_DB_TABLES.md) 기준 현재 확인된 컬럼:
  - `user_id`
  - `artwork_id`
  - `created_at`
- Notes:
  - `joins to artworks for liked-artwork history`
  - `likely unique by user/artwork pair, but that is not verified from DDL yet`

### 현재 코드에서 확인되는 사실
- 작품 좋아요 write API는 이미 존재한다.
  - `POST /v1/artworks/{artworkId}/like`
  - `DELETE /v1/artworks/{artworkId}/like`
- repository도 이미 아래 동작을 한다.
  - insert:
    - `INSERT INTO artwork_likes ... ON DUPLICATE KEY UPDATE created_at = created_at`
  - delete:
    - `DELETE FROM artwork_likes WHERE user_id = ? AND artwork_id = ?`
- 따라서 `likedOnly`를 read API에 추가하는 데 필요한 저장 테이블은 이미 준비되어 있다.

## 권장 계약

### 권장 쿼리 파라미터
```http
GET /v1/artworks?sort=latest|oldest|title&placeId=1&artistType=COMPANY&festivalYear=2024&likedOnly=true&page=1&size=24
```

### 권장 의미
- `sort`
  - `latest`: 최신 축제 연도/제작 연도 우선
  - `oldest`: 오래된 축제 연도/제작 연도 우선
  - `title`: 작품명 오름차순
- `likedOnly`
  - 파라미터 없음: 필터 미적용
  - `false`: 필터 미적용으로 취급
  - `true`: 현재 사용자가 좋아요한 작품만 조회

## SQL 관점 권장안

### 1. `title` 정렬
- 지금 응답은 bilingual이지만, 정렬 기준은 한국어 우선이 자연스럽다.
- 권장 SQL:
```sql
ORDER BY a.title_ko ASC, a.title_en ASC, a.id ASC
```
- 이유:
  - 기존 search도 `title_ko`, `title_en`, `id` 순으로 title 정렬을 구현하고 있다.
  - 같은 제목일 때 `id`까지 넣어 정렬 안정성을 확보할 수 있다.

### 2. `likedOnly`
- 응답용 `LEFT JOIN artwork_likes al ...`는 그대로 유지하되, where에 아래를 추가하는 것이 가장 자연스럽다.
```sql
AND EXISTS (
  SELECT 1
  FROM artwork_likes al_filter
  WHERE al_filter.artwork_id = a.id
    AND al_filter.user_id = ?
)
```
- 이유:
  - count 쿼리와 list 쿼리 양쪽에 같은 의미를 재사용하기 쉽다.
  - 응답용 `liked` 계산과 where 조건을 분리해서 읽을 수 있다.

### 최종 where 구조 예시
```sql
WHERE a.deleted_at IS NULL
  AND ar.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND ...place filter...
  AND ...artistType filter...
  AND ...festivalYear filter...
  AND ...likedOnly filter...
```

## count / list 쿼리에 대한 영향
- 현재 `listArtworks()`는 아래 두 쿼리로 나뉜다.
  - `COUNT(*) AS total`
  - 실제 목록 query
- `likedOnly`가 추가되면 두 쿼리에 동일한 where 조건을 넣어야 한다.
- 즉 변경은 아래 순서로 가는 것이 맞다.
  1. `whereClauses`에 `likedOnly` 분기 추가
  2. `filterParams`와 `listParams` 순서 재정리
  3. count/list 쿼리 모두 같은 조건 사용

## 변경 대상 파일

### 코드
- [src/domains/artworks/types.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/types.ts)
  - `ARTWORK_SORT_VALUES`
  - `ArtworkListInput`
- [src/domains/artworks/schemas.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/schemas.ts)
  - `sort`에 `title` 추가
  - `likedOnly` 추가
- [src/lambdas/artworks/handler.ts](/Users/donggyunyang/code/steelart/steelart_server/src/lambdas/artworks/handler.ts)
  - query parsing에 `likedOnly` 추가
- [src/domains/artworks/repository.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/repository.ts)
  - `buildArtworkSortClause()`에 `title`
  - `listArtworks()` where에 `likedOnly`
- [src/domains/artworks/service.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/service.ts)
  - input 전달만 추가

### 문서
- [/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md](/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md)
- 필요하면 [docs/plan.md](/Users/donggyunyang/code/steelart/steelart_server/docs/plan.md)

## 테스트 관점

### unit test에서 추가되어야 할 것
- [tests/unit/artworks/artworks-handler.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/unit/artworks/artworks-handler.test.ts)
  - `sort=title`
  - `likedOnly=true`
  - 두 값이 parse되어 service로 전달되는지 확인
- schema test가 없다면 artworks query schema용 단위 테스트 추가 검토

### integration test에서 추가되어야 할 것
- [tests/integration/content/content-read.integration.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/integration/content/content-read.integration.test.ts)
  - `sort=title`일 때 제목순 정렬 확인
  - `likedOnly=true`일 때 좋아요한 작품만 남는지 확인
  - `likedOnly=true` + 기존 `placeId` / `artistType` / `festivalYear`와 함께 동작하는지 확인

## 구현 난이도 / 리스크

### 난이도
- 낮음 ~ 중간
- 기존 `GET /v1/artworks` 구조를 확장하는 정도다.

### 리스크
- `likedOnly` 파라미터를 count/list 양쪽에 동일하게 적용하지 않으면 `total`이 틀어질 수 있다.
- `title` 정렬을 title_ko만 쓸지 title_en까지 같이 묶을지 합의가 필요하지만, 현재 repo 전체 흐름상 `title_ko ASC, title_en ASC, id ASC`가 가장 자연스럽다.
- `artwork_likes`의 정확한 raw DDL은 루트 문서상 아직 inferred다. 다만 현재 write/read 구현과 integration test가 이미 이 테이블을 쓰고 있어서 실무상 blocker는 아니다.

## 최종 결론
- `GET /v1/artworks`에 `sort=title`과 `likedOnly=true`를 추가하는 방향이 자연스럽다.
- 별도 새 API를 만들 필요는 없다.
- 필요한 수정은 handler / schema / types / repository / 테스트 / 루트 API 문서까지 전부 한 세트다.
- 구현 시 가장 중요한 포인트는 아래 두 가지다.
  - `title` 정렬은 `title_ko`, `title_en`, `id` 기준으로 안정적으로 정렬
  - `likedOnly`는 count/list 쿼리에 동일하게 적용
