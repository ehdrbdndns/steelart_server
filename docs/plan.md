# artwork detail `material` 반영 구현 계획

## 문서 목적
- [docs/research.md](/Users/donggyunyang/code/steelart/steelart_server/docs/research.md)를 바탕으로 `GET /v1/artworks/{artworkId}` 상세 응답에 `material`을 추가하는 실제 구현 순서를 정리한다.
- 이번 계획은 `루트 API 명세서`와 `steelart_server` 코드 수정만 포함한다.
- 기준 코드 파일은 아래를 직접 읽고 작성했다.
  - `src/domains/artworks/types.ts`
  - `src/domains/artworks/repository.ts`
  - `src/domains/artworks/mapper.ts`
  - `src/domains/artworks/service.ts`
  - `src/lambdas/artworks/handler.ts`
  - `tests/unit/artworks/artworks-handler.test.ts`
  - `tests/unit/artworks/artworks-mapper.test.ts`
  - `tests/integration/content/content-read.integration.test.ts`

## 구현 목표
- `GET /v1/artworks/{artworkId}` 응답에 `material` 필드를 추가한다.
- 루트 API 초안과 서버 타입/SQL/mapper/test를 일관되게 맞춘다.
- 현재 코드 구조를 유지한다.
  - handler는 thin 유지
  - business logic은 service
  - SQL은 repository
- 이번 변경은 read API 확장에 한정한다.

## 현재 코드 기준 전제

### 1. 상세 응답 타입 위치
- `ArtworkDetail` 타입은 [src/domains/artworks/types.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/types.ts)에 있다.
- 현재 메타 필드는 아래까지만 있다.
  - `size_text_ko`
  - `size_text_en`
  - `production_year`
  - `zone_id`
  - `zone_name_ko`
  - `zone_name_en`
- `material`은 아직 없다.

### 2. 상세 조회 SQL 위치
- `findArtworkDetail()`는 [src/domains/artworks/repository.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/repository.ts)에 있다.
- 현재 SELECT는 `a.size_text_ko`, `a.size_text_en`, `a.audio_url_ko`, `a.audio_url_en`, `a.category`, `a.production_year` 등을 읽고 있다.
- `a.material`은 아직 조회하지 않는다.

### 3. 상세 응답 매핑 위치
- repository 내부의 `mapArtworkDetailRow()`가 DB row -> 도메인 타입 매핑을 한다.
- [src/domains/artworks/mapper.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/mapper.ts)의 `mapArtworkDetail()`가 최종 API 응답 객체를 만든다.
- 둘 다 `material`을 모르고 있다.

### 4. service / handler 구조
- [src/domains/artworks/service.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/service.ts)의 `getArtworkDetail()`는 repository 결과를 `mapArtworkDetail()`에 넘긴 뒤 반환한다.
- [src/lambdas/artworks/handler.ts](/Users/donggyunyang/code/steelart/steelart_server/src/lambdas/artworks/handler.ts)는 path param 파싱 후 `service.getArtworkDetail()`만 호출한다.
- 따라서 실제 변경은 타입/SQL/mapper/test가 중심이다.

## 고정 결정
- 새 엔드포인트를 만들지 않는다.
- 기존 `GET /v1/artworks/{artworkId}`를 확장한다.
- 응답 필드 이름은 `material`로 둔다.
- 현재 범위에서는 `material` 타입을 `string | null`로 가정한다.
- `service`와 `handler`는 구조 변경 없이 유지한다.

## 수정 대상 파일

### 문서
- [/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md](/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md)

### 코드
- [src/domains/artworks/types.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/types.ts)
- [src/domains/artworks/repository.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/repository.ts)
- [src/domains/artworks/mapper.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/mapper.ts)

### 테스트
- [tests/unit/artworks/artworks-handler.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/unit/artworks/artworks-handler.test.ts)
- [tests/unit/artworks/artworks-mapper.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/unit/artworks/artworks-mapper.test.ts)
- [tests/integration/content/content-read.integration.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/integration/content/content-read.integration.test.ts)

## 단계별 구현 계획

### 1단계. 루트 API 초안 확장
- 파일: [/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md](/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md)

#### 변경 내용
- `GET /v1/artworks/{artworkId}`의 실제 `data` 타입에 `material`을 추가한다.

#### 권장 위치
- `size_text_ko`, `size_text_en` 다음
- `production_year` 이전

#### 권장 형태
```ts
{
  ...
  size_text_ko: string | null;
  size_text_en: string | null;
  material: string | null;
  production_year: number | null;
  ...
}
```

#### 이유
- 현재 상세 응답의 작품 메타데이터 흐름상 `size_text_*`와 `production_year` 사이가 가장 자연스럽다.
- 구현 코드도 같은 순서로 맞추면 리뷰와 유지보수가 쉬워진다.

### 2단계. 상세 타입 확장
- 파일: [src/domains/artworks/types.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/types.ts)

#### 변경 내용
- `ArtworkDetail`에 `material: string | null` 추가

#### 구현 방향
```ts
export interface ArtworkDetail {
  ...
  size_text_en: string | null;
  size_text_ko: string | null;
  material: string | null;
  title_en: string;
  ...
}
```

#### 주의
- 현재 타입 파일은 artwork list, filters, detail을 한 파일에 모아두고 있다.
- 이번 변경은 `ArtworkDetail`에만 한정한다.

### 3단계. repository row 타입 확장
- 파일: [src/domains/artworks/repository.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/repository.ts)

#### 변경 내용
- `ArtworkDetailRow`에 `material: string | null` 추가

#### 구현 방향
```ts
interface ArtworkDetailRow extends RowDataPacket {
  ...
  production_year: number | null;
  size_text_en: string | null;
  size_text_ko: string | null;
  material: string | null;
  title_en: string;
  ...
}
```

#### 이유
- repository 내부 mapper가 `row.material`을 안전하게 참조할 수 있어야 한다.
- detail row 타입을 먼저 맞추면 이후 SQL/mapper 변경이 타입 오류 없이 이어진다.

### 4단계. 상세 조회 SQL 확장
- 파일: [src/domains/artworks/repository.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/repository.ts)

#### 현재 상태
```sql
SELECT
  a.id,
  a.title_ko,
  a.title_en,
  ar.name_ko AS artist_name_ko,
  ar.name_en AS artist_name_en,
  a.description_ko,
  a.description_en,
  a.size_text_ko,
  a.size_text_en,
  a.audio_url_ko,
  a.audio_url_en,
  a.category,
  a.production_year,
  ...
```

#### 변경 내용
- SELECT 목록에 `a.material` 추가

#### 권장 형태
```sql
SELECT
  a.id,
  a.title_ko,
  a.title_en,
  ar.name_ko AS artist_name_ko,
  ar.name_en AS artist_name_en,
  a.description_ko,
  a.description_en,
  a.size_text_ko,
  a.size_text_en,
  a.material,
  a.audio_url_ko,
  a.audio_url_en,
  a.category,
  a.production_year,
  ...
```

#### 주의
- 조인 구조는 그대로 둔다.
  - `artists`
  - `places`
  - `zones`
  - `artwork_likes`
- image query와 festival year query는 변경할 필요 없다.

### 5단계. repository mapper 확장
- 파일: [src/domains/artworks/repository.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/repository.ts)

#### 변경 내용
- `mapArtworkDetailRow()`에 `material` passthrough 추가

#### 구현 방향
```ts
function mapArtworkDetailRow(
  row: ArtworkDetailRow,
  images: ArtworkImage[],
  festivalYears: string[],
): ArtworkDetail {
  return {
    ...
    production_year: row.production_year,
    size_text_en: row.size_text_en,
    size_text_ko: row.size_text_ko,
    material: row.material,
    title_en: row.title_en,
    ...
  };
}
```

#### 이유
- repository layer에서 domain 타입을 완성하는 현재 구조를 유지해야 한다.
- service는 mapper 호출만 하고, domain 타입 해석은 repository + mapper가 담당하는 편이 현재 설계와 맞다.

### 6단계. public mapper 확장
- 파일: [src/domains/artworks/mapper.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/mapper.ts)

#### 변경 내용
- `mapArtworkDetail()`에 `material` 추가

#### 구현 방향
```ts
export function mapArtworkDetail(detail: ArtworkDetail): ArtworkDetail {
  return {
    ...
    production_year: detail.production_year,
    size_text_en: detail.size_text_en,
    size_text_ko: detail.size_text_ko,
    material: detail.material,
    title_en: detail.title_en,
    ...
  };
}
```

#### 이유
- 현재 artwork 상세 응답은 final mapper를 한 번 더 거친다.
- 이 단계에서 빠뜨리면 SQL과 타입을 수정해도 실제 API 응답에는 안 나온다.

### 7단계. service / handler 영향 확인
- 파일: [src/domains/artworks/service.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/service.ts)
- 파일: [src/lambdas/artworks/handler.ts](/Users/donggyunyang/code/steelart/steelart_server/src/lambdas/artworks/handler.ts)

#### 확인 결과
- `getArtworkDetail()`는 repository 결과를 그대로 `mapArtworkDetail()`로 넘긴다.
- handler는 service 결과를 그대로 `ok()` 응답에 넣는다.

#### 실행 계획
- service / handler는 별도 코드 수정 없이 타입 정합성만 확인한다.
- 단, regression이 없는지 handler unit test로 응답 shape를 확인한다.

## 테스트 계획

### 8단계. handler unit test 보강
- 파일: [tests/unit/artworks/artworks-handler.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/unit/artworks/artworks-handler.test.ts)

#### 현재 상태
- `createArtworksServiceStub().getArtworkDetail()` 반환 객체에 `material`이 없다.
- 상세 응답 검증은 현재 아래까지만 본다.
  - `id`
  - `zone_name_ko`
  - `zone_name_en`

#### 변경 내용
- stub 상세 객체에 `material` 추가
- `GET /v1/artworks/{id}` 응답 assertion에 `material` 추가

#### 예시
```ts
return {
  ...
  size_text_en: null,
  size_text_ko: null,
  material: 'stainless steel',
  title_en: 'Space Walk',
  ...
};
```

```ts
assert.equal(JSON.parse(response.body as string).data.material, 'stainless steel');
```

### 9단계. mapper unit test 보강
- 파일: [tests/unit/artworks/artworks-mapper.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/unit/artworks/artworks-mapper.test.ts)

#### 현재 상태
- 상세 매퍼 테스트 fixture는 현재 권역명까지 검증한다.
- `material`은 없다.

#### 변경 내용
- `mapArtworkDetail()` input fixture와 expected object에 `material` 추가

#### 예시
```ts
assert.deepEqual(mapArtworkDetail({
  ...
  size_text_en: null,
  size_text_ko: null,
  material: 'stainless steel',
  ...
}), {
  ...
  size_text_en: null,
  size_text_ko: null,
  material: 'stainless steel',
  ...
});
```

### 10단계. integration test 보강
- 파일: [tests/integration/content/content-read.integration.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/integration/content/content-read.integration.test.ts)

#### 현재 상태
- 상세 응답 검증은 아래까지만 본다.
  - `id`
  - `liked`
  - `festival_years`
  - `images.length`
  - `zone_name_ko`
  - `zone_name_en`

#### 변경 내용
- artwork seed 데이터에 `material`을 넣을 수 있도록 seed INSERT를 보강
- 상세 응답 assertion에 `material` 추가

#### 주의
- integration seed의 `INSERT INTO artworks` 컬럼 목록이 현재 고정돼 있으므로, 실제 구현 시 `material` 컬럼을 INSERT에 추가해야 할 수 있다.
- 이 테스트는 현재 DB 환경변수가 없으면 skip되므로, 로컬 검증 시에는 unit test 우선으로 본다.

## 검증 계획

### 필수 실행
- `pnpm typecheck`
- `pnpm exec tsx --test tests/unit/artworks/artworks-mapper.test.ts tests/unit/artworks/artworks-handler.test.ts`

### 선택 실행
- `pnpm exec tsx --test tests/integration/content/content-read.integration.test.ts`

#### 주의
- integration test는 `INTEGRATION_DB_*` 환경변수가 없으면 skip될 수 있다.
- 따라서 이번 변경의 빠른 회귀 확인은 unit test + typecheck 조합으로 충분하다.

## 구현 순서 제안
1. 루트 API 초안에 `material`을 추가한다.
2. `ArtworkDetail`와 `ArtworkDetailRow` 타입을 확장한다.
3. `findArtworkDetail()` SQL에 `a.material`을 추가한다.
4. repository mapper와 public mapper에 `material` passthrough를 추가한다.
5. handler unit test와 mapper unit test를 보강한다.
6. integration test seed/응답 assertion을 보강한다.
7. `pnpm typecheck`와 artwork 관련 unit test를 실행한다.

## 완료 기준
- 루트 API 초안의 작품 상세 타입에 `material`이 포함된다.
- `GET /v1/artworks/{artworkId}` 응답 타입이 `material`을 가진다.
- 상세 조회 SQL이 `a.material`을 실제로 읽는다.
- mapper 계층에서 `material`이 누락되지 않는다.
- artwork detail 관련 unit test가 `material`을 검증한다.
