# artwork detail `material` 반환 리서치

## 문서 목적
- `artworks` 테이블에 추가된 `material` 컬럼을 `GET /v1/artworks/{artworkId}` 상세 API 응답에 포함하기 위해, 현재 `루트 API 명세서`와 `steelart_server` 코드 기준으로 필요한 변경 사항을 정리한다.
- 이번 문서는 구현 문서가 아니라 조사 문서다.
- 범위는 아래 둘만 포함한다.
  - `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
  - 현재 `steelart_server` 코드와 테스트

## 이번 문서의 범위

### 포함
- 루트 API 계약 초안
- 작품 상세 API의 서버 타입
- 상세 조회 SQL
- mapper / service / handler 흐름
- 관련 unit / integration 테스트 영향

### 제외
- `STEELART_DB_TABLES.md` 등 다른 루트 문서
- `steelart_app`
- `steelart_dashboard`
- 실제 DB DDL 확인 작업

## 조사 기준
- `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
- `src/domains/artworks/types.ts`
- `src/domains/artworks/repository.ts`
- `src/domains/artworks/mapper.ts`
- `src/domains/artworks/service.ts`
- `src/lambdas/artworks/handler.ts`
- `tests/unit/artworks/artworks-handler.test.ts`
- `tests/unit/artworks/artworks-mapper.test.ts`
- `tests/integration/content/content-read.integration.test.ts`

## 변경 요청 요약
- `artworks.material` 컬럼이 새로 추가되었다.
- 작품 상세 API `GET /v1/artworks/{artworkId}`가 이 값을 응답에 포함해야 한다.
- 현재 루트 API 초안과 서버 구현에는 아직 `material`이 없다.

## 핵심 결론
- 현재 범위 기준으로 필요한 변경은 단순하다.
  - 루트 API 초안의 상세 응답 타입에 `material` 추가
  - 서버 `ArtworkDetail` 타입에 `material` 추가
  - 상세 조회 SQL에서 `a.material` 조회
  - repository row mapper와 public mapper에서 `material` passthrough
  - 상세 응답 관련 unit / integration 테스트 fixture와 assertion 보강
- `service`와 `handler`는 현재 구조상 별도 로직 변경이 거의 필요 없다.
- 다만 현재 범위 안에서는 `material`의 정확한 타입과 nullable 여부를 확정할 근거가 없다.
  - 그래서 문서 안의 권장 타입은 일단 `string | null` 가정으로 적는 것이 안전하다.

## 현재 루트 API 계약 상태

### 현재 계약
- `STEELART_SERVER_API_DRAFT.md`의 `GET /v1/artworks/{artworkId}` 응답 타입은 현재 아래 필드를 가진다.
  - `title_ko`, `title_en`
  - `artist_name_ko`, `artist_name_en`
  - `description_ko`, `description_en`
  - `size_text_ko`, `size_text_en`
  - `production_year`
  - `category`
  - `festival_years`
  - `place_name_ko`, `place_name_en`
  - `address`
  - `lat`, `lng`
  - `zone_id`, `zone_name_ko`, `zone_name_en`
  - `audio_url_ko`, `audio_url_en`
  - `liked`
  - `images`
- `material`은 없다.

### 계약에서 바뀌어야 하는 부분
- `GET /v1/artworks/{artworkId}`의 실제 `data` 타입에 `material` 추가

### 권장 계약안
```ts
{
  id: number;
  title_ko: string;
  title_en: string;
  artist_name_ko: string;
  artist_name_en: string;
  description_ko: string;
  description_en: string;
  size_text_ko: string | null;
  size_text_en: string | null;
  material: string | null;
  production_year: number | null;
  category: 'STEEL_ART' | 'PUBLIC_ART';
  festival_years: string[];
  place_name_ko: string;
  place_name_en: string;
  address: string | null;
  lat: number;
  lng: number;
  zone_id: number | null;
  zone_name_ko: string | null;
  zone_name_en: string | null;
  audio_url_ko: string | null;
  audio_url_en: string | null;
  liked: boolean;
  images: Array<{
    image_url: string;
    image_width: number | null;
    image_height: number | null;
  }>;
}
```

## 현재 서버 구현 상태

### 1. 타입
- `src/domains/artworks/types.ts`
- `ArtworkDetail` 타입은 현재 아래 메타데이터를 가진다.
  - `size_text_ko`
  - `size_text_en`
  - `production_year`
  - `zone_id`
  - `zone_name_ko`
  - `zone_name_en`
- `material`은 없다.

### 2. repository row 타입
- `src/domains/artworks/repository.ts`
- `ArtworkDetailRow`에도 `material`이 없다.

### 3. 상세 조회 SQL
- `findArtworkDetail()`의 SELECT는 현재 아래 작품 필드를 읽는다.
  - `a.title_ko`
  - `a.title_en`
  - `a.description_ko`
  - `a.description_en`
  - `a.size_text_ko`
  - `a.size_text_en`
  - `a.audio_url_ko`
  - `a.audio_url_en`
  - `a.category`
  - `a.production_year`
- `a.material`은 SELECT하지 않는다.

### 4. repository mapper
- `mapArtworkDetailRow()`는 현재 `ArtworkDetail` 반환 시 아래를 포함한다.
  - `size_text_ko`
  - `size_text_en`
  - `production_year`
  - `zone_id`
  - `zone_name_ko`
  - `zone_name_en`
- `material`은 passthrough하지 않는다.

### 5. public mapper
- `src/domains/artworks/mapper.ts`
- `mapArtworkDetail()`도 `material`을 포함하지 않는다.

### 6. service
- `src/domains/artworks/service.ts`
- `getArtworkDetail()`는 repository 결과를 받아 `mapArtworkDetail()`에 넘긴 뒤 반환한다.
- 필드 추가 시 service 자체의 분기 로직 변경은 필요 없다.

### 7. handler
- `src/lambdas/artworks/handler.ts`
- `GET /v1/artworks/{artworkId}`는 path param 파싱 후 `service.getArtworkDetail()`만 호출한다.
- 응답 구조는 service 반환 객체를 그대로 `ok()`로 감싼다.
- 따라서 `handler`도 별도 로직 변경 없이 타입 따라간다.

## 서버 기준 권장 변경 포인트

### 1. 루트 API 초안
- 파일: `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
- 변경:
  - 작품 상세 응답 타입에 `material` 추가

### 2. 상세 도메인 타입
- 파일: `src/domains/artworks/types.ts`
- 변경:
```ts
export interface ArtworkDetail {
  ...
  size_text_ko: string | null;
  size_text_en: string | null;
  material: string | null;
  production_year: number | null;
  ...
}
```

### 3. repository row 타입
- 파일: `src/domains/artworks/repository.ts`
- 변경:
```ts
interface ArtworkDetailRow extends RowDataPacket {
  ...
  size_text_en: string | null;
  size_text_ko: string | null;
  material: string | null;
  title_en: string;
  ...
}
```

### 4. 상세 조회 SQL
- 파일: `src/domains/artworks/repository.ts`
- 변경:
  - `SELECT` 목록에 `a.material` 추가

예상 형태:
```sql
SELECT
  a.id,
  a.title_ko,
  a.title_en,
  ...
  a.size_text_ko,
  a.size_text_en,
  a.material,
  a.audio_url_ko,
  a.audio_url_en,
  ...
```

### 5. repository mapper
- 파일: `src/domains/artworks/repository.ts`
- 변경:
```ts
function mapArtworkDetailRow(...): ArtworkDetail {
  return {
    ...
    size_text_en: row.size_text_en,
    size_text_ko: row.size_text_ko,
    material: row.material,
    title_en: row.title_en,
    ...
  };
}
```

### 6. public mapper
- 파일: `src/domains/artworks/mapper.ts`
- 변경:
```ts
export function mapArtworkDetail(detail: ArtworkDetail): ArtworkDetail {
  return {
    ...
    size_text_en: detail.size_text_en,
    size_text_ko: detail.size_text_ko,
    material: detail.material,
    title_en: detail.title_en,
    ...
  };
}
```

### 7. service / handler
- 현재 구조상 별도 구현 포인트는 거의 없다.
- 타입과 mapper가 맞춰지면 그대로 따라간다.

## 테스트 영향 범위

### 1. unit test: handler
- 파일: `tests/unit/artworks/artworks-handler.test.ts`
- 현재 상세 응답 stub에는 `material`이 없다.
- 변경 필요:
  - `createArtworksServiceStub().getArtworkDetail()` 반환 객체에 `material` 추가
  - `GET /v1/artworks/{id}` 응답 assertion에 `material` 추가

### 2. unit test: mapper
- 파일: `tests/unit/artworks/artworks-mapper.test.ts`
- 현재 상세 매퍼 테스트 객체에도 `material`이 없다.
- 변경 필요:
  - input fixture에 `material` 추가
  - expected object에도 `material` 추가

### 3. integration test
- 파일: `tests/integration/content/content-read.integration.test.ts`
- 현재 상세 응답 검증은 아래까지만 본다.
  - `id`
  - `liked`
  - `festival_years`
  - `images.length`
  - `zone_name_ko`
  - `zone_name_en`
- 변경 필요:
  - 시드 데이터가 `material`을 넣을 수 있게 맞추기
  - 상세 응답 assertion에 `material` 추가

## 권장 구현 순서
1. 루트 API 초안에 `material`을 추가한다.
2. `ArtworkDetail` 타입과 `ArtworkDetailRow` 타입을 확장한다.
3. 상세 조회 SQL에 `a.material`을 추가한다.
4. repository mapper와 public mapper에 `material` passthrough를 추가한다.
5. handler / mapper / integration 테스트를 보강한다.

## 현재 범위에서 남는 미확정 사항
- `material`의 정확한 타입이 `string | null`인지 `string`인지 현재 문서와 서버 코드만으로는 확정할 수 없다.
- 하지만 서버와 API 초안 반영 작업 관점에서는 우선 `string | null` 가정이 가장 안전하다.
- 실제 구현 직전에 이미 다른 스레드에서 계약이 확정되어 있다면, 그 값을 우선 적용하면 된다.

## 최종 판단
- 현재 범위에서 `material` 반영은 `작품 상세 계약 + server detail read path` 수정으로 정리할 수 있다.
- 바뀌는 핵심은 아래 다섯 군데다.
  - 루트 API 초안
  - `src/domains/artworks/types.ts`
  - `src/domains/artworks/repository.ts`
  - `src/domains/artworks/mapper.ts`
  - 작품 상세 관련 테스트
- `service`와 `handler`는 구조상 영향이 작다.
