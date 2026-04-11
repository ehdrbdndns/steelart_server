# `/v1/search/artworks` lang 정렬 확장 구현 계획

## 문서 목적
- [docs/research.md](/Users/donggyunyang/code/steelart/steelart_server/docs/research.md)의 조사 결과를 바탕으로 `GET /v1/search/artworks`에 `lang` 파라미터를 추가하는 실제 구현 순서를 정리한다.
- 이번 계획은 코드 수정, 테스트 보강, 검증 실행까지 포함한다.

## 구현 목표
- `GET /v1/search/artworks`가 아래 요청을 지원하도록 확장한다.
```http
GET /v1/search/artworks?q={keyword}&sort=latest|oldest|title&lang=ko|en&page=1&size=20
```
- `sort=title`일 때만 `lang`에 따라 제목 정렬 컬럼을 바꾼다.
```sql
-- lang=ko
ORDER BY a.title_ko ASC, a.id ASC

-- lang=en
ORDER BY a.title_en ASC, a.id ASC
```
- `latest`, `oldest` 정렬과 검색 매칭 기준은 그대로 유지한다.
- 응답 shape는 바꾸지 않는다.

## 고정 결정
- 새 엔드포인트를 만들지 않는다.
- 기존 `GET /v1/search/artworks`를 확장한다.
- `lang`은 선택 파라미터다.
  - 허용값: `ko`, `en`
  - 기본값: `ko`
  - `sort=title`일 때만 의미가 있다.
- 검색 조건은 그대로 유지한다.
  - 작품명
  - 작가명
  - 장소명
  - 한/영 컬럼 전체 매칭
- 응답은 계속 bilingual 필드를 함께 반환한다.
  - `title_ko`, `title_en`
  - `artist_name_ko`, `artist_name_en`
  - `place_name_ko`, `place_name_en`

## 수정 대상 파일

### 코드
- [src/lambdas/search/handler.ts](/Users/donggyunyang/code/steelart/steelart_server/src/lambdas/search/handler.ts)
- [src/domains/search/types.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/search/types.ts)
- [src/domains/search/schemas.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/search/schemas.ts)
- [src/domains/search/repository.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/search/repository.ts)

### 테스트
- [tests/unit/search/search-handler.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/unit/search/search-handler.test.ts)
- [tests/unit/search/search-schemas.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/unit/search/search-schemas.test.ts)
- [tests/integration/content/content-read.integration.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/integration/content/content-read.integration.test.ts)

### 문서
- [docs/research.md](/Users/donggyunyang/code/steelart/steelart_server/docs/research.md)
- [/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md](/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md)

## 단계별 구현 계획

### 1단계. 입력 계약 확장
- 파일: [src/domains/search/types.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/search/types.ts)

#### 변경 내용
- `SearchArtworksInput`에 `lang` 필드를 추가한다.
- 기존 autocomplete용 언어 값 체계를 search artworks에도 재사용한다.

#### 구현 방향
```ts
export interface SearchArtworksInput {
  lang: SearchAutocompleteLanguage;
  page: number;
  q: string;
  size: number;
  sort: SearchArtworkSort;
}
```

#### 판단 기준
- 새 enum을 따로 만들 필요는 없다.
- 현재 파일 안에 이미 `ko | en` 언어 타입이 있으므로 같은 도메인에서 중복 정의를 피하는 편이 낫다.
- 다만 이름이 어색하면 아래처럼 공용 이름으로 정리하는 리팩터링은 가능하다.
```ts
export const SEARCH_LANGUAGE_VALUES = ['ko', 'en'] as const;
export type SearchLanguage = (typeof SEARCH_LANGUAGE_VALUES)[number];
```
- 이 리팩터링은 선택 사항이다. 범위를 최소화하려면 기존 `SearchAutocompleteLanguage`를 재사용해도 충분하다.

### 2단계. query schema 확장
- 파일: [src/domains/search/schemas.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/search/schemas.ts)

#### 변경 내용
- `searchArtworksQuerySchema`에 `lang`을 추가한다.
- 기본값은 `ko`로 둔다.

#### 구현 방향
```ts
export const searchArtworksQuerySchema = z.object({
  lang: z.enum(SEARCH_AUTOCOMPLETE_LANGUAGE_VALUES).default('ko'),
  page: z.coerce.number().int().positive().default(1),
  q: z.string().trim().min(1, 'Search query is required'),
  size: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(SEARCH_ARTWORK_SORT_VALUES).default('latest'),
}).strict();
```

#### 주의
- `lang` 기본값은 schema 단계에서 주입해야 handler/service에서 별도 기본값 처리가 필요 없다.
- `lang`은 `title` 정렬일 때만 실제 SQL에서 쓰지만, 입력 계약에는 항상 포함되게 유지하는 편이 단순하다.

### 3단계. handler query parsing 확장
- 파일: [src/lambdas/search/handler.ts](/Users/donggyunyang/code/steelart/steelart_server/src/lambdas/search/handler.ts)

#### 변경 내용
- `GET /v1/search/artworks` 분기에서 `request.getQuery('lang')`를 읽어 schema에 전달한다.

#### 구현 방향
```ts
const input = parseInput({
  schema: searchArtworksQuerySchema,
  input: {
    lang: request.getQuery('lang'),
    page: request.getQuery('page'),
    q: request.getQuery('q'),
    size: request.getQuery('size'),
    sort: request.getQuery('sort'),
  },
  message: 'Search query is invalid',
});
```

#### 주의
- handler는 parse 후의 `input`을 service에 그대로 넘기므로 추가 비즈니스 분기는 필요 없다.
- autocomplete와 artworks search가 같은 `lang` 처리 패턴을 갖게 되어 도메인 일관성이 좋아진다.

### 4단계. repository 정렬 함수 확장
- 파일: [src/domains/search/repository.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/search/repository.ts)

#### 현재 문제
- 현재 `buildSearchArtworkSortClause(sort)`는 `title`일 때 항상 아래를 사용한다.
```sql
ORDER BY a.title_ko ASC, a.title_en ASC, a.id ASC
```
- 이 구현은 이번 요구사항과 맞지 않는다.

#### 변경 내용
- `buildSearchArtworkSortClause(sort, lang)` 형태로 시그니처를 바꾼다.
- `title` 분기에서 `lang`에 따라 컬럼을 고른다.

#### 구현 방향
```ts
function buildSearchArtworkSortClause(
  sort: SearchArtworkSort,
  lang: 'ko' | 'en',
): string {
  if (sort === 'title') {
    return lang === 'en'
      ? `ORDER BY a.title_en ASC, a.id ASC`
      : `ORDER BY a.title_ko ASC, a.id ASC`;
  }

  if (sort === 'oldest') {
    return `ORDER BY COALESCE(festivals.oldest_festival_year, festivals.latest_festival_year, a.production_year, 0) ASC, a.id ASC`;
  }

  return `ORDER BY COALESCE(festivals.latest_festival_year, festivals.oldest_festival_year, a.production_year, 0) DESC, a.id DESC`;
}
```

#### 적용 위치
- `searchArtworks()` 안의 list query에서
```ts
${buildSearchArtworkSortClause(input.sort, input.lang)}
```
- 형태로 바꾼다.

#### 주의
- `latest`, `oldest` 분기는 그대로 둔다.
- count query에는 정렬이 없으므로 `lang`이 직접 영향을 주지 않는다.
- 검색 where 절은 이번 작업에서 건드리지 않는다.

### 5단계. service/mapper 영향 확인
- 파일: [src/domains/search/service.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/search/service.ts)
- 파일: [src/domains/search/mapper.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/search/mapper.ts)

#### 확인 결과
- service는 repository 호출 후 paging metadata를 붙이는 역할만 한다.
- mapper는 응답 형태를 조립할 뿐이다.

#### 실행 계획
- 서비스 코드 수정은 타입 반영 외에는 필요 없음을 확인만 한다.
- mapper는 수정하지 않는다.

## 테스트 계획

### 6단계. schema 단위 테스트 보강
- 파일: [tests/unit/search/search-schemas.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/unit/search/search-schemas.test.ts)

#### 추가 테스트
- `lang`이 없으면 기본값 `ko`가 주입되는지
- `lang=en`이 허용되는지
- `lang=jp`가 `VALIDATION_ERROR`로 거부되는지
- 기존 `sort=title` 허용 테스트가 `lang`과 충돌하지 않는지

#### 예시 기대값
```ts
{
  lang: 'ko',
  page: 1,
  q: '포항',
  size: 20,
  sort: 'latest',
}
```

### 7단계. handler 단위 테스트 보강
- 파일: [tests/unit/search/search-handler.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/unit/search/search-handler.test.ts)

#### 추가 테스트
- `lang=en`이 service로 전달되는지
- `lang`이 없을 때 service가 `lang='ko'`를 받는지
- 기존 `sort=title` 테스트를 `lang` 조합까지 확장하는지

#### 권장 시나리오
```text
q=포스아트&sort=title&lang=en&page=1&size=2
```

#### 검증 방법
- service stub에서 `input.lang`과 `input.sort`를 캡처한다.
- 응답 자체보다 handler가 schema 결과를 그대로 넘기는지를 우선 검증한다.

### 8단계. integration 테스트 보강
- 파일: [tests/integration/content/content-read.integration.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/integration/content/content-read.integration.test.ts)

#### 현재 활용 가능한 fixture
- `q=포스아트` 검색 결과는 현재 두 작품이다.
  - `스페이스워크` / `Space Walk`
  - `환호의 빛` / `Light of Hwanho`

#### 추가 테스트 1
- 제목 정렬이 `lang=ko`일 때 한국어 제목순인지 확인
```text
GET /v1/search/artworks?q=포스아트&sort=title&lang=ko&page=1&size=20
```
- 기대 순서
```text
스페이스워크
환호의 빛
```

#### 추가 테스트 2
- 제목 정렬이 `lang=en`일 때 영어 제목순인지 확인
```text
GET /v1/search/artworks?q=포스아트&sort=title&lang=en&page=1&size=20
```
- 기대 순서
```text
Light of Hwanho
Space Walk
```

#### 추가 테스트 3
- `lang` 없이 호출했을 때 기본값 `ko`와 동일하게 동작하는지 확인
```text
GET /v1/search/artworks?q=포스아트&sort=title&page=1&size=20
```

#### 주의
- 새 시드 데이터는 필요 없다.
- 기존 `title` 정렬 통합 테스트를 교체하거나 분리해서 `ko/en/default` 세 케이스로 정리하면 된다.

## 문서 동기화 계획

### 9단계. 루트 계약 문서와 구현 일치 확인
- 파일: [/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md](/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md)

#### 확인 항목
- `lang=ko|en`가 쿼리 파라미터에 들어가 있는지
- `lang` 기본값 `ko`가 명시돼 있는지
- `title` 정렬 규칙이 언어별 분기로 바뀌었는지

#### 현재 상태
- 이번 문서 작성 전에 이미 반영됨
- 구현 완료 후 문서와 코드가 동일한지 다시 한 번 대조만 한다.

## 실행 순서
1. `src/domains/search/types.ts`에 `lang` 반영
2. `src/domains/search/schemas.ts`에 `lang` 검증 추가
3. `src/lambdas/search/handler.ts`에서 `lang` query 파싱 추가
4. `src/domains/search/repository.ts` 정렬 함수 수정
5. `tests/unit/search/search-schemas.test.ts` 보강
6. `tests/unit/search/search-handler.test.ts` 보강
7. `tests/integration/content/content-read.integration.test.ts` 보강
8. 관련 테스트 실행
9. 문서와 코드 최종 대조

## 검증 계획

### 우선 실행
```bash
pnpm test -- --test tests/unit/search/search-schemas.test.ts tests/unit/search/search-handler.test.ts
```

### 그다음 실행
```bash
pnpm test -- --test tests/integration/content/content-read.integration.test.ts
```

### 필요 시 전체 확인
```bash
pnpm typecheck
```

## 완료 기준
- `GET /v1/search/artworks`가 `lang` query를 허용한다.
- `lang` 기본값이 `ko`로 적용된다.
- `sort=title&lang=ko`와 `sort=title&lang=en`의 정렬 순서가 다르게 동작한다.
- `sort=latest|oldest` 동작은 회귀 없이 유지된다.
- unit/integration 테스트가 이를 검증한다.
- 루트 API 문서와 구현이 일치한다.
