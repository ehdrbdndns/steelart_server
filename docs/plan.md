# 5단계 읽기 중심 콘텐츠 API 구현 계획

- 작성일: 2026-03-19
- 대상 단계: `5단계. 읽기 중심 콘텐츠 API`
- 기준 문서: [research.md](./research.md)
- 권장 브랜치: `codex/05-read-content`

## 문서 목적
- 이 문서는 [research.md](./research.md)에 정리한 5단계 요구사항을 실제 구현 작업 순서로 옮긴 상세 계획이다.
- 목표는 `home`, `search`, `artworks`, `map` 도메인의 읽기 API를 앱 첫 렌더와 탐색 흐름에 맞게 완성하는 것이다.
- 구현 범위, 수정 파일, 검증 절차, 리스크 대응을 한 문서에서 바로 확인할 수 있게 정리한다.

## 범위

### 포함
- `GET /v1/home`
- `GET /v1/home/artworks`
- `GET /v1/home/recommended-courses`
- `GET /v1/search/artworks`
- `GET /v1/artworks`
- `GET /v1/artworks/{artworkId}`
- `GET /v1/artworks/filters`
- `GET /v1/map/artworks`
- 작품 카드/상세 공통 read model
- `artwork_likes` 기반 `liked` 계산
- 다국어 원본 필드(`*_ko`, `*_en`) 그대로 반환하는 응답 구조
- unit test / integration test 추가

### 제외
- `GET /v1/home/banners`
- `GET /v1/home/zones`
- 작품/코스 좋아요 write API
- 코스 상세/생성/수정
- 체크인
- 배너 action metadata용 스키마 추가

## 고정 구현 기준
- 홈 첫 렌더는 `GET /v1/home` aggregate API로 처리한다.
- `GET /v1/home`은 `banners`, `zones`, `selectedZoneId`, `artworks`를 반환한다.
- `GET /v1/home/recommended-courses`는 분리 유지한다.
- `GET /v1/home/artworks?zoneId=...`는 zone 전환용 부분 갱신 API로 구현한다.
- `GET /v1/home/banners`, `GET /v1/home/zones`는 별도 endpoint로 구현하지 않는다.
- 다국어 필드는 `title_ko`, `title_en`처럼 원본 필드를 그대로 반환한다.
- `GET /v1/search/artworks`는 `sort=latest|oldest`, `page`, `size`를 받고 `thumbnail_image_url`과 함께 `thumbnail_image_width`, `thumbnail_image_height`, `totalElements`, `last`를 반환한다.
- `GET /v1/search/autocomplete`는 `q`, `lang`, `size`를 받고 작품명 기준 `suggestions[{ text_ko, text_en, type }]`를 반환한다.
- `liked`는 `artwork_likes`를 현재 로그인 사용자 기준으로 left join 해서 계산한다.
- 5단계 읽기 API는 보호 API로 구현한다.
- `GET /v1/artworks`의 `latest|oldest`는 `festivalYear` 기준 의미로 해석한다.
- `GET /v1/home`의 `selectedZoneId`는 `sort_order ASC, name_ko ASC` 기준 첫 zone을 사용한다.
- 배너는 이미지 목록만 반환하고 클릭 action은 이번 단계에서 다루지 않는다.

## 수정 대상 파일

### 새로 만들 파일
- `src/domains/home/types.ts`
- `src/domains/home/schemas.ts`
- `src/domains/home/mapper.ts`
- `src/domains/home/repository.ts`
- `src/domains/home/service.ts`
- `src/domains/search/types.ts`
- `src/domains/search/schemas.ts`
- `src/domains/search/mapper.ts`
- `src/domains/search/repository.ts`
- `src/domains/search/service.ts`
- `src/domains/artworks/types.ts`
- `src/domains/artworks/schemas.ts`
- `src/domains/artworks/mapper.ts`
- `src/domains/artworks/repository.ts`
- `src/domains/artworks/service.ts`
- `src/domains/map/types.ts`
- `src/domains/map/schemas.ts`
- `src/domains/map/mapper.ts`
- `src/domains/map/repository.ts`
- `src/domains/map/service.ts`
- `tests/unit/home/home-handler.test.ts`
- `tests/unit/search/search-handler.test.ts`
- `tests/unit/artworks/artworks-handler.test.ts`
- `tests/unit/map/map-handler.test.ts`
- `tests/integration/content/content-read.integration.test.ts`

### 수정할 파일
- `src/lambdas/home/handler.ts`
- `src/lambdas/search/handler.ts`
- `src/lambdas/artworks/handler.ts`
- `src/lambdas/map/handler.ts`
- `STEELART_SERVER_API_DRAFT.md`
- `docs/research.md`
- `docs/IMPLEMENTATION_SEQUENCE.md`
- 필요 시 `docs/MASTER_PLAN.md`

## 구현 순서

### 0단계. 계약 최종 고정
- 상태: `진행 중`
- 작업
  - [research.md](./research.md) 기준으로 home aggregate 구조를 다시 확인한다.
  - `GET /v1/home/banners`, `GET /v1/home/zones`를 구현 대상에서 제외하는 방향을 유지한다.
  - `GET /v1/artworks` 정렬 기준이 `festivalYear`라는 점을 코드/테스트에서 일관되게 반영할 수 있도록 명시한다.
- 완료 기준
  - 구현 중 다시 뒤집을 결정이 없다고 판단할 수 있다.

### 1단계. 작품 공통 read model 설계
- 상태: `진행 중`
- 작업
  - `artworks` 도메인에 공통 카드 row 타입과 상세 row 타입을 정의한다.
  - 작품 카드에서 재사용할 공통 SQL 조인 구조를 `artworks/repository.ts`에 먼저 만든다.
  - 공통 카드 필드:
    - `id`
    - `title_ko`, `title_en`
    - `artist_name_ko`, `artist_name_en`
    - `place_name_ko`, `place_name_en`
    - `thumbnail_image_url`
    - `liked`
    - `lat`, `lng`
    - `zone_id`
  - 대표 이미지 선택 규칙과 `artwork_likes` join 규칙을 공통화한다.
- 완료 기준
  - `home/search/map`이 같은 artwork card query를 재사용할 준비가 된다.

### 2단계. artworks 도메인 구현
- 상태: `진행 중`
- 작업
  - `GET /v1/artworks`
    - multi filter parsing
    - `festivalYear` 기준 정렬
    - pagination
    - 응답 필드는 `id`, `title_*`, `artist_name_*`, `address`, `thumbnail_image_*`, `liked`로 제한
  - `GET /v1/artworks/{artworkId}`
    - 상세 조인
    - `artwork_images`
    - `artwork_festivals`
    - `liked`
  - `GET /v1/artworks/filters`
    - `zones -> places`
    - `artistTypes`
    - `festivalYears`
  - mapper에서 bilingual 응답 필드를 그대로 유지한다.
- 완료 기준
  - 작품 목록/상세/필터 API의 core SQL과 mapper가 완성된다.

### 3단계. search, map 도메인 구현
- 상태: `진행 중`
- 작업
  - `GET /v1/search/artworks`
    - 작품명/작가명/장소명 검색
    - 빈 `q` 처리
    - `sort=latest|oldest`
    - `page`, `size`
    - `totalElements`, `last`
  - `GET /v1/search/autocomplete`
    - 작품명 자동완성
    - `lang=ko|en`
    - `size`
    - `ARTWORK_TITLE`
  - `GET /v1/map/artworks`
    - `lat/lng/radiusMeters` 필수
    - 반경 내 지도 작품 조회
    - 최소 필드(`id`, `title_*`, `lat/lng`, `liked`)만 반환
    - SQL 거리 계산 후 거리순 정렬
  - search와 map은 각 도메인 repository에서 필요한 read query를 직접 관리한다.
  - 자동완성 SQL은 search repository에서 직접 관리한다.
- 완료 기준
  - 검색과 지도 API가 같은 작품 카드 read model 위에서 동작한다.

### 4단계. home 도메인 구현
- 상태: `진행 중`
- 작업
  - `GET /v1/home`
    - 활성 배너 목록 조회
    - zone 목록 조회
    - 첫 zone을 `selectedZoneId`로 선택
    - 해당 zone의 작품 카드 목록 조회
  - `GET /v1/home/artworks`
    - `zoneId` 기준 부분 갱신
  - `GET /v1/home/recommended-courses`
    - `is_official = 1`
    - 대표 썸네일
    - `thumbnail_image_width`, `thumbnail_image_height`
    - 현재 사용자 기준 `stamped`
  - `home` service에서 aggregate 응답 조립만 하고, SQL은 repository에 둔다.
- 완료 기준
  - 홈 첫 렌더용 aggregate 응답과 zone 전환용 부분 갱신 응답이 모두 동작한다.

### 5단계. Lambda handler 연결
- 상태: `진행 중`
- 작업
  - `home`, `search`, `artworks`, `map` handler에서 라우팅과 method 검증 구현
  - 모든 read API에 `requireAuth` 적용
  - query/body parsing은 `parseInput`과 각 도메인 schema를 사용
  - 응답은 기존 `{ data, meta, error }` envelope을 그대로 사용
- 완료 기준
  - placeholder handler가 모두 실제 도메인 service로 연결된다.

### 6단계. unit test 작성
- 상태: `진행 중`
- 작업
  - handler 테스트
    - 홈 aggregate 응답
    - zone artwork 부분 갱신
    - 검색 query validation
    - 작품 목록 필터/정렬
    - 지도 lat/lng validation
  - mapper 테스트
    - bilingual 필드 유지
    - liked / distance field 반영
  - schema 테스트
    - `zoneId`
    - `page/size`
    - multi filter
    - map 좌표
- 완료 기준
  - 도메인별 unit test가 추가되고, 테스트 위에 한글 설명 주석이 붙어 있다.

### 7단계. integration test 작성
- 상태: `진행 중`
- 작업
  - 실제 integration DB 기준으로 content read 시나리오 추가
  - 최소 시나리오
    - `GET /v1/home`
    - `GET /v1/home/artworks?zoneId=...`
    - `GET /v1/home/recommended-courses`
    - `GET /v1/search/artworks?q=...&sort=latest&page=1&size=20`
    - `GET /v1/search/autocomplete?q=...&lang=ko&size=10`
    - `GET /v1/artworks`
    - `GET /v1/artworks/{id}`
    - `GET /v1/artworks/filters`
    - `GET /v1/map/artworks?lat=...&lng=...`
- 완료 기준
  - handler -> service -> repository -> DB 흐름이 실제로 검증된다.

### 8단계. 문서 정리
- 상태: `진행 중`
- 작업
  - 루트 API 초안에 stage 5 구현 내용 반영
  - [research.md](./research.md)의 미정 항목 정리
  - [IMPLEMENTATION_SEQUENCE.md](./IMPLEMENTATION_SEQUENCE.md) 5단계 상태 업데이트
  - 필요 시 [MASTER_PLAN.md](./MASTER_PLAN.md)도 맞춤
- 완료 기준
  - 코드와 문서가 같은 계약을 가리킨다.

## 검증 절차

### 필수 검증
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:integration`
- `pnpm sam:validate`
- `pnpm sam:build`

### 수동 확인 포인트
- `GET /v1/home`
  - `banners`, `zones`, `selectedZoneId`, `artworks`가 한 응답에 들어온다.
- `GET /v1/home/artworks?zoneId=...`
  - 전달한 zone 기준 작품만 바뀐다.
- `GET /v1/home/recommended-courses`
  - 공식 코스만 내려온다.
- `GET /v1/search/artworks?q=...`
  - 작품 검색은 작품명/작가명/장소명 매칭이 모두 동작한다.
  - 자동완성은 작품명 후보만 반환한다.
- `GET /v1/artworks`
  - multi filter가 동작한다.
- `GET /v1/artworks/{artworkId}`
  - `festival_years`, `images`, `liked`가 모두 내려온다.
- `GET /v1/map/artworks?lat=...&lng=...&radiusMeters=...`
  - 반경 내 작품만 최소 필드로 반환된다.

## 리스크와 대응

### 1. `festivalYear` 정렬 구현 복잡도
- 위험
  - 작품이 여러 축제 연도를 가지면 list 정렬이 단순하지 않다.
- 대응
  - artwork별 대표 festival year 계산 규칙을 repository에서 먼저 고정한다.

### 2. home aggregate 응답 크기 증가
- 위험
  - 첫 렌더 최적화가 목적이지만, artwork 카드 수를 너무 크게 잡으면 오히려 느려질 수 있다.
- 대응
  - `GET /v1/home`의 `artworks` 개수는 제한된 기본 개수로 둔다.

### 3. 다국어 필드 확장에 따른 mapper 중복
- 위험
  - `*_ko`, `*_en` 필드가 많아져 mapper가 장황해질 수 있다.
- 대응
  - card/detail mapper를 분리하고, bilingual field mapping helper는 최소 범위에서만 둔다.

### 4. `artwork_likes` join에 따른 목록 성능
- 위험
  - list/detail/search/map 전부 `liked`를 계산하면 조인이 반복된다.
- 대응
  - artwork 공통 read query에 `LEFT JOIN artwork_likes ... AND user_id = ?`를 통일하고, explain 필요 시 인덱스 상태를 다시 확인한다.

## 완료 기준
- 5단계 범위의 8개 read API가 구현된다.
- 홈 첫 렌더는 `GET /v1/home` 하나로 above-the-fold 데이터를 받을 수 있다.
- 추천 코스는 분리 API로 유지된다.
- 응답은 bilingual 필드를 그대로 반환한다.
- unit / integration / SAM 검증이 모두 통과한다.
- 루트 API 문서와 로컬 문서가 구현 기준과 일치한다.

## 한 줄 결론
- 5단계는 `artworks` 도메인이 아카이브/상세 read model을 담당하고, `home/search/map`은 각자 유스케이스별 query를 직접 관리하며, 홈 첫 렌더는 `GET /v1/home` aggregate API로 최적화하는 것이 핵심이다.
