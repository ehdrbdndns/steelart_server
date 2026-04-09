# `/v1/search/artworks` lang 정렬 확장 리서치

## 문서 목적
- `GET /v1/search/artworks`에 `lang` 쿼리 파라미터를 추가하고, `sort=title`일 때 언어별 제목 컬럼 기준으로 정렬하도록 계약과 구현 영향 범위를 정리한다.
- 이번 문서는 검색 API의 계약/구현 조사에 집중하며 실제 코드 구현은 범위에 포함하지 않는다.

## 조사 기준
- `STEELART_SERVER_API_DRAFT.md`
- `STEELART_APP_MVP_BRIEF.md`
- `STEELART_APP_SCREEN_STRUCTURE.md`
- `STEELART_APP_SCREEN_SPECS.md`
- `STEELART_DB_TABLES.md`
- `steelart_dashboard/docs/db-schema.sql`
- `src/lambdas/search/handler.ts`
- `src/domains/search/types.ts`
- `src/domains/search/schemas.ts`
- `src/domains/search/service.ts`
- `src/domains/search/repository.ts`
- `tests/unit/search/search-handler.test.ts`
- `tests/unit/search/search-schemas.test.ts`
- `tests/integration/content/content-read.integration.test.ts`

## 변경 요청 요약
- 대상 엔드포인트: `GET /v1/search/artworks`
- 추가 파라미터: `lang`
- 정렬 규칙 변경:
  - `sort=title` + `lang=ko` -> `ORDER BY a.title_ko ASC, a.id ASC`
  - `sort=title` + `lang=en` -> `ORDER BY a.title_en ASC, a.id ASC`
- `latest`, `oldest` 정렬 규칙은 그대로 유지한다.

## 범위 해석
- 검색 매칭 대상은 그대로 유지하는 것이 맞다.
  - 작품명
  - 작가명
  - 장소명
- 응답 필드 구조는 그대로 유지하는 것이 맞다.
  - 여전히 `title_ko`, `title_en`, `artist_name_ko`, `artist_name_en`, `place_name_ko`, `place_name_en`을 함께 반환한다.
- `lang`은 정렬 기준 컬럼 선택에만 영향을 주고 검색 조건 자체는 바꾸지 않는 것이 이번 요구와 일치한다.

## 앱/제품 관점 확인

### 루트 앱 문서에서 확인되는 사실
- 공용 검색은 홈/지도/작품 탭에서 재사용된다.
- 검색 결과는 작품 단위로 제공된다.
- 검색 결과 화면에서는 필터 없이 정렬만 노출한다.
- 검색 데이터 요구사항은 작품명, 작가명, 장소명 기준 매칭이다.

### 이번 변경이 공용 검색 구조와 맞는 이유
- 공용 검색 결과 화면은 정렬만 노출하므로 `lang` 기반 제목 정렬은 이 화면의 계약 확장으로 해석하는 것이 자연스럽다.
- 검색 매칭 자체를 언어별 단일 컬럼으로 제한하라는 요구는 없으므로, 기존 bilingual 매칭은 유지하는 편이 안전하다.

## 현재 루트 API 계약 상태

### 현재 명시 상태
- `STEELART_SERVER_API_DRAFT.md`의 `GET /v1/search/artworks`는 현재 아래만 명시한다.
  - `q`
  - `sort=latest|oldest|title`
  - `page`
  - `size`
- 현재 문서의 `title` 정렬 설명은 아래처럼 고정돼 있다.
```text
title: title_ko ASC, title_en ASC, id ASC
```

### 계약에서 바뀌어야 하는 부분
- 엔드포인트 예시에 `lang=ko|en` 추가
- 쿼리 파라미터 목록에 `lang` 추가
- `lang` 기본값을 `ko`로 명시
- `lang`은 `sort=title`일 때만 영향을 준다고 명시
- `title` 정렬 설명을 언어별 분기로 교체

## 현재 구현 상태

### handler
- `src/lambdas/search/handler.ts`
- 현재 `GET /v1/search/artworks`는 아래 query만 읽는다.
  - `page`
  - `q`
  - `size`
  - `sort`
- `lang`은 아직 읽지 않는다.
- 반면 `GET /v1/search/autocomplete`는 이미 `lang`을 읽고 있다.

### types
- `src/domains/search/types.ts`
- 현재 `SearchArtworksInput`은 아래만 가진다.
```ts
interface SearchArtworksInput {
  page: number;
  q: string;
  size: number;
  sort: 'latest' | 'oldest' | 'title';
}
```
- 같은 파일 안에 자동완성용 언어 enum은 이미 있다.
```ts
export const SEARCH_AUTOCOMPLETE_LANGUAGE_VALUES = ['ko', 'en'] as const;
export type SearchAutocompleteLanguage =
  (typeof SEARCH_AUTOCOMPLETE_LANGUAGE_VALUES)[number];
```
- 따라서 검색 작품 API도 같은 언어 값 체계를 재사용하거나, 더 일반적인 `SEARCH_LANGUAGE_VALUES`로 이름을 정리하는 선택지가 있다.

### schema
- `src/domains/search/schemas.ts`
- 현재 `searchArtworksQuerySchema`는 `lang` 없이 아래만 검증한다.
```ts
{
  page: number;
  q: string;
  size: number;
  sort: 'latest' | 'oldest' | 'title';
}
```
- `searchAutocompleteQuerySchema`에는 이미 `lang` 기본값 `ko`가 존재한다.
- 같은 도메인 안에서 이미 쓰는 기본값을 검색 작품 API에도 맞추는 편이 일관적이다.

### repository
- `src/domains/search/repository.ts`
- 현재 검색 조건은 양언어 컬럼을 모두 대상으로 잡는다.
```sql
WHERE a.deleted_at IS NULL
  AND ar.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND (
    a.title_ko LIKE ?
    OR a.title_en LIKE ?
    OR ar.name_ko LIKE ?
    OR ar.name_en LIKE ?
    OR p.name_ko LIKE ?
    OR p.name_en LIKE ?
  )
```
- 현재 `buildSearchArtworkSortClause(sort)`의 `title` 분기는 아래다.
```sql
ORDER BY a.title_ko ASC, a.title_en ASC, a.id ASC
```
- 즉 현재 구현은 `lang`과 무관하게 한국어 제목, 영문 제목, id 순으로 정렬한다.

### service / mapper
- `src/domains/search/service.ts`
- `src/domains/search/mapper.ts`
- 둘 다 입력 전달과 응답 포맷 구성만 담당한다.
- `lang` 추가 시 service/mapper는 구조 변경 없이 입력 타입만 따라가면 된다.

## DB / SQL 관점 조사

### 현재 스키마에서 확인되는 컬럼
- `STEELART_DB_TABLES.md`
- `artworks`
  - `title_ko` varchar(200) not null
  - `title_en` varchar(200) not null
- 따라서 이번 요구를 위한 DB 마이그레이션은 필요 없다.

### raw DDL에서 확인되는 추가 사실
- `steelart_dashboard/docs/db-schema.sql`
- `artworks` 테이블은 `utf8mb4_unicode_ci` collation을 사용한다.
- 명시된 인덱스는 아래 정도다.
  - `artist_id`
  - `place_id`
  - `category`
  - `likes_count`
  - `deleted_at`
- `title_ko`, `title_en` 전용 인덱스는 없다.

### 해석
- 이번 변경은 정렬 기준 컬럼만 바꾸는 수준이므로 DB 구조 변경은 필요 없다.
- 현재 검색 자체가 `%keyword%` 기반 `LIKE` 검색이라 title 인덱스 부재는 이미 존재하는 조건이다.
- 따라서 `lang` 추가가 성능을 본질적으로 악화시키지는 않는다.
- 다만 정확한 locale-aware 정렬 규칙이 더 중요해지면 collation 전략은 별도 과제로 다뤄야 한다.

## 권장 계약안

### 권장 요청 형식
```http
GET /v1/search/artworks?q={keyword}&sort=latest|oldest|title&lang=ko|en&page=1&size=20
```

### 권장 파라미터 의미
- `q`
  - 필수
- `sort`
  - 선택값
  - `latest | oldest | title`
  - 기본값 `latest`
- `lang`
  - 선택값
  - `ko | en`
  - 기본값 `ko`
  - `sort=title`일 때만 의미가 있다.
- `page`
  - 선택값
  - 기본값 `1`
- `size`
  - 선택값
  - 기본값 `20`

### 왜 `lang`을 선택 파라미터로 두는가
- 기존 앱/클라이언트는 현재 `lang` 없이 이 API를 호출하고 있다.
- `lang`을 필수로 만들면 하위 호환성이 깨진다.
- 같은 도메인의 `autocomplete`도 이미 `lang` 기본값을 `ko`로 처리하고 있으므로 계약 일관성도 맞는다.

## 권장 구현 포인트

### 1. 타입/검증
- `SearchArtworksInput`에 `lang: 'ko' | 'en'` 추가
- `searchArtworksQuerySchema`에 `lang` 추가
- 기본값은 `ko`
- 허용값은 `ko`, `en`

### 2. handler
- `src/lambdas/search/handler.ts`에서 `request.getQuery('lang')`를 읽어 schema에 전달

### 3. repository
- `buildSearchArtworkSortClause(sort, lang)` 형태로 시그니처 변경
- `title` 분기에서 아래처럼 언어별 컬럼을 고른다.
```sql
-- lang=ko
ORDER BY a.title_ko ASC, a.id ASC

-- lang=en
ORDER BY a.title_en ASC, a.id ASC
```
- `latest`, `oldest` 분기는 그대로 둔다.
- 검색 where 절은 그대로 유지한다.

### 4. 문서
- 루트 계약 문서 `STEELART_SERVER_API_DRAFT.md` 수정
- 구현 전에 로컬 조사 결과는 `docs/research.md`로 남긴다.

## 테스트 영향 범위

### unit test
- `tests/unit/search/search-schemas.test.ts`
  - `lang` 기본값이 `ko`로 들어가는지 확인
  - `lang=en` 허용 확인
  - `lang=jp` 같은 허용되지 않은 값 거부 확인
- `tests/unit/search/search-handler.test.ts`
  - `lang=en`이 handler에서 service까지 전달되는지 확인
  - 기존 `sort=title` 테스트를 `lang` 조합까지 확장 가능

### integration test
- `tests/integration/content/content-read.integration.test.ts`
  - 현재 fixture만으로 `lang=ko`와 `lang=en`을 모두 검증할 수 있다.
- 이유:
  - `q=포스아트` 검색 결과는 현재 두 작품이다.
    - `스페이스워크` / `Space Walk`
    - `환호의 빛` / `Light of Hwanho`
  - 따라서 정렬 기대값이 언어별로 달라진다.
```text
sort=title&lang=ko -> 스페이스워크, 환호의 빛
sort=title&lang=en -> Light of Hwanho, Space Walk
```
- 즉 새 시드 데이터 없이도 영어/한국어 정렬 분기를 둘 다 검증할 수 있다.

## 변경 대상 파일

### 계약/문서
- `STEELART_SERVER_API_DRAFT.md`
- `docs/research.md`

### 코드
- `src/lambdas/search/handler.ts`
- `src/domains/search/types.ts`
- `src/domains/search/schemas.ts`
- `src/domains/search/repository.ts`

### 테스트
- `tests/unit/search/search-handler.test.ts`
- `tests/unit/search/search-schemas.test.ts`
- `tests/integration/content/content-read.integration.test.ts`

## 주의사항
- `lang`은 검색 결과에 표시할 언어 선택이 아니라 `title` 정렬 기준 선택이다.
- 검색 매칭 조건을 언어별 단일 컬럼으로 줄이면 기존 검색 결과가 달라질 수 있으므로 이번 변경 범위에 넣지 않는 것이 안전하다.
- 응답 payload는 바꾸지 않아도 된다.
- DB 마이그레이션은 필요 없다.

## 결론
- 이번 변경은 계약 문서, query validation, handler input, repository 정렬 함수까지만 수정하면 되는 작은 범위의 API 확장이다.
- 가장 중요한 제품 결정은 `lang`을 선택 파라미터 + 기본값 `ko`로 두어 하위 호환성을 지키는 것이다.
- 테스트는 기존 fixture를 재사용해 `ko/en` 정렬 차이를 명확하게 검증할 수 있다.

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
