# `/v1/artworks` 정렬/언어/좋아요 필터 확장 구현 계획

## 문서 목적
- [docs/research.md](/Users/donggyunyang/code/steelart/steelart_server/docs/research.md)의 조사 결과를 바탕으로 `GET /v1/artworks`에 아래 기능을 추가하는 실제 구현 계획을 정리한다.
  - `sort=title`
  - `lang=ko|en`
  - `likedOnly=true`
- 이 문서는 현재 코드베이스의 실제 파일과 함수 이름을 기준으로 작성한다.

## 구현 목표
- `GET /v1/artworks`가 아래 쿼리 파라미터를 지원하도록 확장한다.
```http
GET /v1/artworks?sort=latest|oldest|title&lang=ko|en&placeId=1&artistType=COMPANY&festivalYear=2024&likedOnly=true&page=1&size=24
```
- 기존 응답 shape는 유지한다.
```ts
{
  artworks: Array<{
    id: number;
    title_ko: string;
    title_en: string;
    artist_name_ko: string;
    artist_name_en: string;
    address: string | null;
    thumbnail_image_url: string | null;
    thumbnail_image_width: number | null;
    thumbnail_image_height: number | null;
    liked: boolean;
  }>;
  page: number;
  size: number;
  total: number;
}
```

## 현재 상태
- 전체 단계 완료
- 구현 완료:
  - `sort=title`
  - `lang=ko|en`
  - `likedOnly=true`
- 검증 완료:
  - `pnpm typecheck`
  - `pnpm test`
  - `set -a && source /Users/donggyunyang/code/steelart/steelart_server/.env.integration && set +a && pnpm test:integration`

## 고정 결정
- 새 API를 만들지 않는다.
- 기존 `GET /v1/artworks`를 확장한다.
- `lang`은 선택적 enum이다.
  - 허용값: `ko`, `en`
  - 기본값: `ko`
  - `sort=title`일 때만 정렬 기준 컬럼 선택에 사용한다.
  - `sort=latest|oldest`일 때는 무시해도 된다.
- `likedOnly`는 선택적 boolean이다.
  - 없음: 필터 미적용
  - `false`: 필터 미적용
  - `true`: 현재 사용자가 좋아요한 작품만 조회
- `title` 정렬은 `lang` 값에 따라 아래 기준으로 구현한다.
```sql
-- lang=ko
ORDER BY a.title_ko ASC, a.id ASC

-- lang=en
ORDER BY a.title_en ASC, a.id ASC
```
- `likedOnly`는 count 쿼리와 list 쿼리에 동일하게 적용한다.

## 수정 대상 파일

### 코드
- [src/domains/artworks/types.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/types.ts)
- [src/domains/artworks/schemas.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/schemas.ts)
- [src/lambdas/artworks/handler.ts](/Users/donggyunyang/code/steelart/steelart_server/src/lambdas/artworks/handler.ts)
- [src/domains/artworks/service.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/service.ts)
- [src/domains/artworks/repository.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/repository.ts)

### 테스트
- [tests/unit/artworks/artworks-handler.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/unit/artworks/artworks-handler.test.ts)
- [tests/integration/content/content-read.integration.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/integration/content/content-read.integration.test.ts)

### 문서
- [/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md](/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md)
- [docs/research.md](/Users/donggyunyang/code/steelart/steelart_server/docs/research.md)

## 단계별 구현 계획

### 0단계. 브랜치 / 작업 기준 고정 [완료]
- 현재 작업 브랜치를 확인한다.
- 구현 전 기준 동작을 확인한다.
  - `GET /v1/artworks`는 현재 `sort=latest|oldest`만 허용
  - `likedOnly`는 아직 schema/handler/repository 어디에도 없음

### 1단계. 타입 정의 확장 [완료]
- 파일: [src/domains/artworks/types.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/types.ts)

#### 변경 내용
- `ARTWORK_SORT_VALUES`에 `title` 추가
```ts
export const ARTWORK_SORT_VALUES = ['latest', 'oldest', 'title'] as const;
```
- `ArtworkListInput`에 아래 필드 추가
  - `lang: 'ko' | 'en'`
  - `likedOnly: boolean`

#### 구현 예시
```ts
export interface ArtworkListInput {
  artistTypes: ArtistType[];
  festivalYears: string[];
  lang: 'ko' | 'en';
  likedOnly: boolean;
  page: number;
  placeIds: number[];
  size: number;
  sort: ArtworkSort;
}
```

### 2단계. query schema 확장 [완료]
- 파일: [src/domains/artworks/schemas.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/schemas.ts)

#### 변경 내용
- `sort` enum에 `title` 허용
- `lang` enum 추가
- `likedOnly` boolean 추가

#### 구현 예시
```ts
const booleanQuerySchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return value;
}, z.boolean().default(false));

export const artworksListQuerySchema = z.object({
  artistType: z.array(z.enum(ARTIST_TYPE_VALUES)).default([]),
  festivalYear: festivalYearArraySchema,
  lang: z.enum(['ko', 'en']).default('ko'),
  likedOnly: booleanQuerySchema,
  page: z.coerce.number().int().positive().default(1),
  placeId: positiveIntegerArraySchema,
  size: z.coerce.number().int().positive().max(100).default(24),
  sort: z.enum(ARTWORK_SORT_VALUES).default('latest'),
}).strict();
```

#### 주의
- `lang`은 title 정렬에만 의미가 있다.
- `lang`이 없으면 기본값은 `ko`다.
- `likedOnly`는 `request.getQuery('likedOnly')`에서 문자열로 들어온다.
- `"true"` / `"false"` 문자열은 명시적으로 boolean으로 변환해야 한다.

### 3단계. handler에서 새 query 파라미터 읽기 [완료]
- 파일: [src/lambdas/artworks/handler.ts](/Users/donggyunyang/code/steelart/steelart_server/src/lambdas/artworks/handler.ts)

#### 현재 코드
```ts
input: {
  artistType: request.getQueryList('artistType'),
  festivalYear: request.getQueryList('festivalYear'),
  page: request.getQuery('page'),
  placeId: request.getQueryList('placeId'),
  size: request.getQuery('size'),
  sort: request.getQuery('sort'),
},
```

#### 변경 내용
- `likedOnly: request.getQuery('likedOnly')` 추가
- service 호출 payload에 `likedOnly: input.likedOnly` 추가

#### 구현 예시
```ts
input: {
  artistType: request.getQueryList('artistType'),
  festivalYear: request.getQueryList('festivalYear'),
  lang: request.getQuery('lang'),
  likedOnly: request.getQuery('likedOnly'),
  page: request.getQuery('page'),
  placeId: request.getQueryList('placeId'),
  size: request.getQuery('size'),
  sort: request.getQuery('sort'),
},
```

```ts
const result = await service.listArtworks({
  artistTypes: input.artistType,
  festivalYears: input.festivalYear,
  lang: input.lang,
  likedOnly: input.likedOnly,
  page: input.page,
  placeIds: input.placeId,
  size: input.size,
  sort: input.sort,
}, auth.userId);
```

### 4단계. service 전달 구조 확장 [완료]
- 파일: [src/domains/artworks/service.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/service.ts)

#### 변경 내용
- service 로직 자체는 단순 전달이므로 구조 변경만 반영
- `ArtworkListInput`이 바뀌면 service는 그대로 repository로 전달 가능

#### 점검 포인트
- 별도 비즈니스 로직 추가는 필요 없음
- `lang`, `likedOnly`는 handler와 repository 사이 계약 확장으로 처리

### 5단계. repository where / order by 로직 확장 [완료]
- 파일: [src/domains/artworks/repository.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/repository.ts)

#### 5-1. `buildArtworkSortClause()` 확장
- 현재:
  - `latest`
  - `oldest`
- 추가:
  - `title`
  - `lang`

#### 구현 예시
```ts
function buildArtworkSortClause(sort: ArtworkSort, lang: 'ko' | 'en'): string {
  if (sort === 'oldest') {
    return `ORDER BY COALESCE(festivals.oldest_festival_year, festivals.latest_festival_year, a.production_year, 0) ASC, a.id ASC`;
  }

  if (sort === 'title') {
    return lang === 'en'
      ? `ORDER BY a.title_en ASC, a.id ASC`
      : `ORDER BY a.title_ko ASC, a.id ASC`;
  }

  return `ORDER BY COALESCE(festivals.latest_festival_year, festivals.oldest_festival_year, a.production_year, 0) DESC, a.id DESC`;
}
```

#### 5-2. `likedOnly` where 추가
- 현재 `listArtworks()`는 `whereClauses`와 `filterParams`를 만들어 count/list 두 쿼리에서 재사용한다.
- 여기서 `input.likedOnly`가 `true`일 때만 아래 조건을 추가한다.

```sql
EXISTS (
  SELECT 1
  FROM artwork_likes al_filter
  WHERE al_filter.artwork_id = a.id
    AND al_filter.user_id = ?
)
```

#### 구현 예시
```ts
if (input.likedOnly) {
  whereClauses.push(`
    EXISTS (
      SELECT 1
      FROM artwork_likes al_filter
      WHERE al_filter.artwork_id = a.id
        AND al_filter.user_id = ?
    )
  `);
  filterParams.push(userId);
}
```

#### 중요 주의
- 응답용 `LEFT JOIN artwork_likes al ...`는 그대로 둔다.
- `likedOnly`는 where에서만 적용한다.
- count 쿼리와 list 쿼리에 들어가는 `filterParams` 순서가 깨지지 않게 유지한다.
- list 쿼리에서만 `lang`이 정렬 기준 컬럼 선택에 사용된다.
- count 쿼리에는 `lang`이 직접 영향을 주지 않는다.

### 6단계. unit test 보강 [완료]
- 파일: [tests/unit/artworks/artworks-handler.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/unit/artworks/artworks-handler.test.ts)

#### 추가해야 할 테스트
- `sort=title`가 들어오면 handler가 그대로 service에 넘기는지
- `lang=en`이 들어오면 handler가 `lang: 'en'`으로 service에 넘기는지
- `lang`이 없으면 기본값이 `ko`로 적용되는지
- `likedOnly=true`가 들어오면 handler가 `likedOnly: true`로 service에 넘기는지
- `likedOnly`가 없으면 기본값이 `false`로 적용되는지

#### 구현 방식
- 기존 `artworks handler returns list response for GET /v1/artworks` 패턴을 그대로 재사용
- `rawQueryString`만 바꿔서 추가 케이스 작성

#### 예시 시나리오
```ts
rawQueryString: 'artistType=COMPANY&lang=en&likedOnly=true&page=1&size=24&sort=title'
```

### 7단계. integration test 보강 [완료]
- 파일: [tests/integration/content/content-read.integration.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/integration/content/content-read.integration.test.ts)

#### 추가해야 할 시나리오
- `GET /v1/artworks?sort=title&lang=ko`
  - 한국어 제목순으로 결과가 정렬되는지
- `GET /v1/artworks?sort=title&lang=en`
  - 영어 제목순으로 결과가 정렬되는지
- `GET /v1/artworks?likedOnly=true`
  - 좋아요한 작품만 남는지
- `GET /v1/artworks?likedOnly=true&placeId=...&artistType=...&festivalYear=...`
  - 기존 필터와 함께 조합되어도 동작하는지

#### seed 기준 활용
- 현재 통합 테스트 시드에는 이미:
  - 좋아요 row 생성 helper
  - 작품 여러 개
  - place / artistType / festivalYear 조합
  가 있으므로 이를 그대로 활용한다.

#### 검증 포인트
- `total` 값도 결과 개수와 일치하는지 확인
- `likedOnly=true` 결과의 모든 item이 `liked === true`인지 확인

### 8단계. 루트 API 문서 동기화 [완료]
- 파일: [/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md](/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md)

#### 변경 내용
- `GET /v1/artworks` 쿼리 파라미터를 아래처럼 수정
  - `sort=latest|oldest|title`
  - `lang=ko|en`
  - `likedOnly=true`
- 주의 섹션에 아래를 추가
  - `sort=title`일 때 `lang`에 따라 정렬 기준 컬럼을 선택
  - `lang` 기본값은 `ko`
  - `likedOnly=true`이면 현재 사용자가 좋아요한 작품만 반환
  - `likedOnly`는 선택적 boolean

## 검증 계획

### 1. 타입 체크
```bash
pnpm typecheck
```

### 2. unit test
```bash
pnpm test -- --test-name-pattern="artworks handler"
```

### 3. integration test
```bash
set -a && source .env.integration && set +a && pnpm test:integration -- --test-name-pattern="artworks"
```

### 4. 전체 회귀
```bash
pnpm test
set -a && source .env.integration && set +a && pnpm test:integration
```

## 리스크와 대응

### 리스크 1. `likedOnly` count/list 불일치
- 원인:
  - count 쿼리와 list 쿼리에 조건이 다르게 적용될 경우
- 대응:
  - `whereClauses`와 `filterParams`를 공용으로 유지

### 리스크 2. `title` 정렬 시 한글/영문 혼합 정렬 품질
- 원인:
  - bilingual title 정렬 기준이 `lang`에 따라 달라짐
- 대응:
  - `lang=ko`면 `title_ko`, `id`
  - `lang=en`면 `title_en`, `id`
  - 향후 locale-aware 정렬이 필요하면 별도 변경으로 분리

### 리스크 3. `likedOnly`의 boolean 파싱 오해
- 원인:
  - query 문자열이 `"true"`, `"false"`로 들어옴
- 대응:
  - schema에서 문자열 boolean을 명시적으로 파싱
  - handler unit test로 parse 결과를 고정

## 완료 기준
- `GET /v1/artworks`가 `sort=title`을 지원한다.
- `GET /v1/artworks`가 `lang=ko|en`을 지원한다.
- `GET /v1/artworks`가 `likedOnly=true`를 지원한다.
- 기존 `placeId`, `artistType`, `festivalYear` 필터와 함께 조합 가능하다.
- `total` 값이 실제 결과와 일치한다.
- unit test / integration test / typecheck가 모두 통과한다.
- 루트 API 문서가 실제 코드와 일치한다.
