# 5단계 읽기 중심 콘텐츠 API 리서치

- 작성일: 2026-03-19
- 대상 단계: `5단계. 읽기 중심 콘텐츠 API`
- 권장 브랜치: `codex/05-read-content`

## 문서 목적
- 이 문서는 [IMPLEMENTATION_SEQUENCE.md](./IMPLEMENTATION_SEQUENCE.md)의 5단계를 실제 구현으로 옮기기 전에 필요한 제품 요구사항, API 계약, DB 근거, 현재 코드 공백, 미정 항목을 한곳에 정리한 리서치 문서다.
- 이번 단계의 목표는 `home`, `search`, `artworks`, `map` 도메인의 읽기 API를 완성해서 앱의 홈, 작품, 지도 탐색 흐름을 실데이터 기준으로 열어 주는 것이다.
- 기존 `RDS TLS` 관련 리서치는 이번 단계와 무관하므로 이 문서에서 제거했다.
- 현재 브랜치에는 관련 구현이 있을 수 있지만, `main`에 머지되기 전까지는 구현 완료로 간주하지 않는다.

## 이번 단계의 범위

### 포함
- `GET /v1/home`
- `GET /v1/home/artworks`
- `GET /v1/home/recommended-courses`
- `GET /v1/search/artworks`
- `GET /v1/artworks`
- `GET /v1/artworks/{artworkId}`
- `GET /v1/artworks/filters`
- `GET /v1/map/artworks`
- 작품 카드/상세 응답용 다국어 필드 매핑
- 작품 카드/상세 응답용 이미지, 오디오, 좌표, 거리 필드 매핑
- 작품 검색과 지도 검색의 공용 검색 로직 정리

### 제외
- `GET /v1/home/banners`
- `GET /v1/home/zones`
- `POST /v1/artworks/{artworkId}/like`
- `DELETE /v1/artworks/{artworkId}/like`
- `GET /v1/courses/recommended`
- `GET /v1/courses/mine`
- `GET /v1/courses/{courseId}`
- 코스 생성/수정
- 체크인
- 배너 클릭 액션용 신규 스키마 추가

## 현재 코드베이스 기준 상태

### 이미 준비된 것
- 공통 HTTP request 헬퍼: [src/shared/api/route.ts](../src/shared/api/route.ts)
  - `getQueryList()`가 반복 쿼리 파라미터와 comma-separated 값을 모두 처리한다.
  - `getPath()`가 API Gateway stage prefix(`/dev`)를 제거한다.
- 공통 validation 유틸: [src/shared/validation/parse.ts](../src/shared/validation/parse.ts)
- 공통 응답/에러 유틸: [src/shared/api/response.ts](../src/shared/api/response.ts), [src/shared/api/errors.ts](../src/shared/api/errors.ts)
- 공통 logger: [src/shared/logger/logger.ts](../src/shared/logger/logger.ts)
- 인증 가드: [src/shared/auth/guard.ts](../src/shared/auth/guard.ts)
- 거리 계산 유틸: [src/shared/geo/distance.ts](../src/shared/geo/distance.ts)
  - `calculateDistanceMeters()`를 그대로 재사용할 수 있다.
- SAM 라우트는 이미 연결돼 있다: [template.yaml](../template.yaml)
  - `/v1/home/{proxy+}` -> `HomeFunction`
  - `/v1/search/{proxy+}` -> `SearchFunction`
  - `/v1/artworks`, `/v1/artworks/{proxy+}` -> `ArtworksFunction`
  - `/v1/map/{proxy+}` -> `MapFunction`

### 현재 구현 결과
- `src/domains/home`, `src/domains/search`, `src/domains/artworks`, `src/domains/map`에 실제 타입/스키마/매퍼/repository/service가 추가됐다.
- [src/lambdas/home/handler.ts](../src/lambdas/home/handler.ts), [src/lambdas/search/handler.ts](../src/lambdas/search/handler.ts), [src/lambdas/artworks/handler.ts](../src/lambdas/artworks/handler.ts), [src/lambdas/map/handler.ts](../src/lambdas/map/handler.ts)가 실제 read API handler로 교체됐다.
- `tests/unit/home`, `tests/unit/search`, `tests/unit/artworks`, `tests/unit/map` 단위 테스트와 `tests/integration/content/content-read.integration.test.ts` 통합 테스트가 추가됐다.

## 제품/계약 기준으로 이미 확정된 요구사항

### 홈
- 홈 첫 렌더는 `GET /v1/home` aggregate API로 처리한다.
- `GET /v1/home`은 아래를 한 번에 반환한다.
  - `banners`
  - `zones`
  - `selectedZoneId`
  - `artworks`
- `GET /v1/home/banners`, `GET /v1/home/zones`는 별도 endpoint로 두지 않는다.
- `GET /v1/home/recommended-courses`는 UI 하단 섹션이므로 별도 API를 유지한다.
- `GET /v1/home/artworks?zoneId=...`는 홈 첫 렌더 이후 zone 전환용 부분 갱신 API로 둔다.
- 홈의 지역 개념은 `zones`로 해석한다.
- 추천 코스는 `is_official = true` 코스만 노출한다.

### 검색
- 검색 대상은 작품 기준이다.
- 검색 기준은 아래 3가지다.
  - 작품명
  - 작가명
  - 장소명
- 검색 결과 카드에는 `thumbnail_image_url`과 함께 `thumbnail_image_width`, `thumbnail_image_height`도 포함한다.
- 최근 검색어는 서버가 아니라 앱 로컬 `AsyncStorage`에서 관리한다.

### 작품
- 작품 목록 필터는 아래 3가지를 지원한다.
  - `placeId` 복수 값
  - `artistType` 복수 값
  - `festivalYear` 복수 값
- `artistType`은 `artists.type`으로 해석한다.
- 작품 상세는 `artwork_festivals`의 전체 연도 목록을 반환해야 한다.

### 지도
- 지도용 검색은 별도 API를 두지 않고 `GET /v1/search/artworks`를 재사용한다.
- 지도 bottom sheet는 별도 상세 API를 두지 않고 `GET /v1/artworks/{artworkId}`를 재사용한다.
- 지도의 즐겨찾기-only 필터는 클라이언트에서 처리한다.
- 서버는 `lat/lng/radiusMeters`가 들어오면 SQL에서 거리 계산과 반경 필터를 처리해야 한다.

### 인증 관점
- 제품은 익명 탐색을 허용하지 않는다.
- 앱 메인 진입은 로그인 후에만 가능하다.
- 작품 카드와 검색 카드에는 `liked` 상태가 필요하다.
- 이 문서의 판단으로는 5단계 읽기 API 전체를 보호 API로 두는 것이 가장 자연스럽다.
  - 이건 소스 문서의 직접 문구라기보다, 현재 제품 흐름과 응답 필드 요구를 조합한 구현 판단이다.

## DB 스키마 기준 핵심 근거

### 직접 DDL이 있는 테이블
- `artists`
- `artworks`
- `artwork_images`
- `artwork_festivals`
- `courses`
- `course_items`
- `home_banners`
- `places`
- `zones`

### 직접 조회한 DDL이 있는 추가 테이블
- `artwork_likes`
  - 실제 `SHOW CREATE TABLE artwork_likes` 결과:
```sql
CREATE TABLE `artwork_likes` (
  `user_id` bigint(20) NOT NULL,
  `artwork_id` bigint(20) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`,`artwork_id`),
  KEY `idx_artwork_likes_artwork_id` (`artwork_id`),
  CONSTRAINT `fk_artwork_likes_artwork` FOREIGN KEY (`artwork_id`) REFERENCES `artworks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_artwork_likes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```
  - 해석:
    - 복합 PK라서 한 사용자는 한 작품에 좋아요를 한 번만 누를 수 있다.
    - `artwork_id` 인덱스가 있어 artwork list/detail에서 user별 좋아요 조인 조건에 적합하다.
    - user 또는 artwork 삭제 시 `ON DELETE CASCADE`로 정리된다.

### 5단계에서 자주 쓰일 조인
- 작품 기본 조인
  - `artworks a`
  - `INNER JOIN artists ar ON ar.id = a.artist_id`
  - `INNER JOIN places p ON p.id = a.place_id`
  - `LEFT JOIN zones z ON z.id = p.zone_id`
- 작품 대표 이미지
  - `artwork_images`에서 `MIN(id)` 이미지 1장을 대표 이미지로 쓰는 패턴이 dashboard admin에 이미 있다.
- 작품 축제 연도
  - `artwork_festivals`를 `artwork_id` 기준으로 묶는다.
- 코스 대표 썸네일
  - `course_items`는 항상 `seq = 1`부터 시작하고 첫 작품이 `seq = 1`이라는 불변식을 둔다.
  - 코스 대표 썸네일은 `course_items.seq = 1`인 첫 작품 -> `artwork_images` 대표 이미지로 연결한다.
- 좋아요 여부
  - `LEFT JOIN artwork_likes al ON al.artwork_id = a.id AND al.user_id = ?`

### soft delete 필터
- `artists.deleted_at`
- `artworks.deleted_at`
- `places.deleted_at`
- `courses.deleted_at`
- 5단계 읽기 API는 최소한 위 4개 도메인의 soft delete를 모두 제외하는 방향이 맞다.
- `zones`와 `home_banners`는 별도 soft delete가 없다.

## dashboard 코드에서 재사용 가능한 근거 SQL

### 1. 작품 목록 베이스 쿼리
- [steelart_dashboard/src/app/api/admin/artworks/route.ts](/Users/donggyunyang/code/steelart/steelart_dashboard/src/app/api/admin/artworks/route.ts)
- 이미 아래 정보가 한 번에 묶여 있다.
  - 작품 제목
  - 작가명
  - 장소명
  - 존 id / 존 이름
  - 대표 썸네일
  - 축제 연도 요약
- 5단계 서버 구현은 이 쿼리를 consumer 응답 용도로 정리해 재사용하는 것이 가장 빠르다.

### 2. 작품 상세 베이스 쿼리
- [steelart_dashboard/src/app/api/admin/artworks/[id]/route.ts](/Users/donggyunyang/code/steelart/steelart_dashboard/src/app/api/admin/artworks/[id]/route.ts)
- 이미 아래 세 묶음이 정리돼 있다.
  - artwork core row
  - place row
  - image rows
  - festival year rows
- 5단계 상세 API는 여기에 `artist`, `liked`만 추가하면 거의 완성된다.

### 3. 홈 배너 목록
- [steelart_dashboard/src/app/api/admin/home-banners/route.ts](/Users/donggyunyang/code/steelart/steelart_dashboard/src/app/api/admin/home-banners/route.ts)
- `home_banners` 조회는 매우 단순하다.
- 다만 consumer API는 `is_active = 1`만 반환해야 한다.

### 4. 존 정렬 기준
- [steelart_dashboard/src/app/api/admin/zones/route.ts](/Users/donggyunyang/code/steelart/steelart_dashboard/src/app/api/admin/zones/route.ts)
- 현재 admin은 `ORDER BY sort_order ASC, name_ko ASC`를 사용한다.
- 5단계 `GET /v1/home`의 zone 목록도 이 기준을 그대로 따르는 것이 가장 자연스럽다.

### 5. 코스 아이템 + 작품 썸네일
- [steelart_dashboard/src/app/api/admin/courses/[id]/items/route.ts](/Users/donggyunyang/code/steelart/steelart_dashboard/src/app/api/admin/courses/[id]/items/route.ts)
- 코스와 작품 대표 이미지 연결 패턴이 이미 있다.
- `home/recommended-courses`의 카드 썸네일을 만들 때 이 패턴을 응용할 수 있다.

## 5단계 공통 구현 방향

### 1. 다국어 응답 전략
- 다국어 텍스트는 서버가 `title` 하나로 접어서 반환하지 않는다.
- 한국어/영어 필드를 함께 그대로 반환한다.
- 대표 예시:
  - `title_ko`, `title_en`
  - `artist_name_ko`, `artist_name_en`
  - `place_name_ko`, `place_name_en`
  - `description_ko`, `description_en`
  - `size_text_ko`, `size_text_en`
- `audio_url`처럼 언어와 무관한 필드는 단일 필드로 유지한다.
- 이 결정으로 앱은 두 언어 값을 모두 받고, 렌더링 계층에서 현재 locale에 맞는 필드를 선택하면 된다.

### 2. 응답 필드 공통화
- 검색 카드, 홈 작품 카드, 작품 목록 카드, 지도 마커 카드가 거의 같은 read model을 공유한다.
- 권장 공통 카드 필드:
  - `id`
  - `title_ko`
  - `title_en`
  - `artist_name_ko`
  - `artist_name_en`
  - `place_name_ko`
  - `place_name_en`
  - `thumbnail_image_url`
  - `liked`
  - `lat`
  - `lng`
  - `radiusMeters`
  - `zone_id`

### 3. 인증 적용
- `liked`를 내려야 하고 앱도 로그인 이후에만 접근하므로, 이번 단계의 read API 전체에 `requireAuth`를 붙이는 쪽이 단순하다.
- 이 구조면 `artwork_likes`를 user 기준으로 left join 할 수 있다.

### 4. soft delete 처리
- read API는 모두 아래 조건을 공통 적용해야 한다.
  - `a.deleted_at IS NULL`
  - `ar.deleted_at IS NULL`
  - `p.deleted_at IS NULL`
  - `c.deleted_at IS NULL`

### 5. pagination / size
- `GET /v1/artworks`만은 API 초안에 `page`, `size`가 명시돼 있으므로 pagination을 넣어야 한다.
- 나머지 home/search/map read API는 현재 문서상 page/size 계약이 없다.
- 권장:
  - `home/*`, `search/*`, `map/*`는 우선 고정 기본 개수 또는 무페이지 조회
  - `artworks`만 pagination 적용

## API별 상세 조사

### 1. `GET /v1/home`
- 목적
  - 홈 첫 렌더에 필요한 상단 데이터 묶음을 한 번에 제공
- 포함 권장 필드
  - `banners`
  - `zones`
  - `selectedZoneId`
  - `artworks`
- 내부 데이터 소스
  - `banners` -> `home_banners`
  - `zones` -> `zones` + 필요 시 `places`, `artworks`
  - `artworks` -> `artworks`, `artists`, `places`, `zones`, `artwork_images`, `artwork_likes`
- 세부 규칙
  - `banners`는 `WHERE is_active = 1 ORDER BY display_order ASC`
  - `zones`는 `ORDER BY sort_order ASC, name_ko ASC`
  - `selectedZoneId`는 정렬된 zone 목록의 첫 항목 id를 쓰는 것이 가장 단순하다.
  - `artworks`는 `selectedZoneId` 기준 작품 카드 목록을 내려준다.
- 주의
  - `GET /v1/home/banners`, `GET /v1/home/zones`는 별도 endpoint로 두지 않는다.
  - `recommendedCourses`는 이 API에 포함하지 않는다.
  - 홈 첫 렌더 최적화가 목적이므로, above-the-fold 데이터까지만 포함하는 게 맞다.
  - 현재 스키마에는 배너 클릭용 action/target 필드가 없으므로, `banners`는 이미지 목록 중심으로만 구현하는 것이 안전하다.

### 2. `GET /v1/home/artworks?zoneId={zoneId}`
- 목적
  - 선택된 zone의 가로 카드 작품 리스트
  - 홈 첫 렌더 이후 zone 전환용 부분 갱신
- 필수 입력
  - `zoneId` positive int
- 데이터 소스
  - `artworks`, `artists`, `places`, `zones`, `artwork_images`, `artwork_likes`
- 응답 권장 필드
  - 공통 작품 카드 필드
- 정렬
  - 문서에 고정 규칙이 없다.
  - 권장안: `a.updated_at DESC`
  - 이유: admin 리스트와 일관되고, 최신 반영작을 우선 노출하기 쉽다.
- 남은 결정
  - 고정 개수 제한(예: 10개) 여부
  - 현재 문서에는 없다.

### 3. `GET /v1/home/recommended-courses`
- 목적
  - 공식 추천 코스 카드 목록
- 데이터 소스
  - `courses`
  - `course_items`
  - 대표 썸네일용 `artworks` + `artwork_images`
- 필터
  - `c.is_official = 1`
  - `c.deleted_at IS NULL`
- 응답 권장 필드
  - `id`
  - `title`
  - `description`
  - `stamped`
  - `thumbnail_image_url`
  - `thumbnail_image_width`
  - `thumbnail_image_height`
  - `is_official`
- 주의
  - 스키마에는 `예상 소요 시간`이나 `거리` 같은 정보가 없다.
  - 현재 홈 추천 코스 카드에서는 작품 수 대신, 현재 사용자가 해당 코스에 체크인 이력을 남겼는지를 `stamped`로 내려준다.
  - 대표 썸네일 계산은 `course_items.seq = 1`이 코스의 첫 작품이라는 불변식에 의존한다.
- 구현 메모
  - 이 endpoint는 `courses` 도메인 정식 구현 전이지만, 읽기 카드 수준으로는 5단계에서 먼저 구현 가능하다.
  - `stamped`는 `course_checkins`에서 `user_id + course_id` 존재 여부로 계산한다.

### 4. `GET /v1/search/artworks?q={keyword}&sort=latest|oldest&page=1&size=20`
- 목적
  - 홈 검색, 지도 검색 공용 작품 검색
- 필수 입력
  - `q` non-empty string
- 선택 입력
  - `sort=latest|oldest`
  - `page`
  - `size`
- 권장 검색 필드
  - `a.title_ko`, `a.title_en`
  - `ar.name_ko`, `ar.name_en`
  - `p.name_ko`, `p.name_en`
- 응답 권장 필드
  - 공통 작품 카드 필드
  - `page`
  - `size`
  - `totalElements`
  - `last`
- 주의
  - 최근 검색어 저장은 서버 범위가 아니다.
- 권장안
  - `q`가 비어 있으면 빈 배열 대신 `VALIDATION_ERROR`
  - 이유: 빈 검색 결과 브라우징은 `GET /v1/artworks`가 담당하는 것이 더 명확하다.
  - 정렬값은 작품 아카이브와 동일하게 `latest|oldest`를 재사용한다.
  - 무한 스크롤 전제이므로 offset 기반 `page/size`와 `totalElements/last`를 함께 반환한다.

### 5. `GET /v1/search/autocomplete?q={keyword}&lang=ko|en&size=10`
- 목적
  - 검색 입력 중 작품명 기반 자동완성 후보 제공
- 필수 입력
  - `q` non-empty string
- 선택 입력
  - `lang=ko|en`
  - `size`
- 데이터 소스
  - `artworks.title_ko`, `artworks.title_en`
- 응답 권장 필드
  - `suggestions`
    - `text_ko`
    - `text_en`
    - `type=ARTWORK_TITLE`
- 권장안
  - `lang`에 따라 비교 컬럼과 정렬 컬럼을 `title_ko` 또는 `title_en` 하나로 고정한다.
  - prefix match를 substring match보다 먼저 정렬한다.
  - 최근 검색어 자동완성은 여전히 앱 로컬 저장소가 담당하고, 이 endpoint는 일반 검색 제안만 반환한다.

### 5. `GET /v1/artworks`
- 목적
  - 작품 아카이브 목록
- 쿼리 파라미터
  - `sort=latest|oldest`
  - `placeId` 복수 값
  - `artistType` 복수 값
  - `festivalYear` 복수 값
  - `page`
  - `size`
- 파싱 근거
  - 현재 [route.ts](../src/shared/api/route.ts)의 `getQueryList()`로 복수 값 처리가 가능하다.
- 데이터 소스
  - `artworks`
  - `artists`
  - `places`
  - `artwork_images`
  - `artwork_festivals`
  - `artwork_likes`
- 응답 권장 필드
  - `id`
  - `title_ko`, `title_en`
  - `artist_name_ko`, `artist_name_en`
  - `address`
  - `thumbnail_image_url`
  - `thumbnail_image_width`
  - `thumbnail_image_height`
  - `liked`
  - `page`
  - `size`
  - `total`
- 남은 결정
  - `latest|oldest`의 기준은 `created_at`이 아니라 `festival year`로 보는 쪽이 제품 의미에 더 가깝다.
- 권장안
  - 1차 구현은 `festivalYear DESC|ASC` 의미로 해석하는 것이 더 자연스럽다.
  - 단, 실제 DB 정렬은 `artwork_festivals`와의 조인 방식에 따라 세부 구현을 고정해야 한다.
  - 목록 API는 카드에 필요한 최소 필드만 반환하고, 상세 설명/위치 좌표/추가 미디어는 상세 API로 분리한다.

### 6. `GET /v1/artworks/{artworkId}`
- 목적
  - 작품 상세 화면과 지도 bottom sheet의 공통 상세 응답
- 데이터 소스
  - `artworks`
  - `artists`
  - `places`
  - `zones`
  - `artwork_images`
  - `artwork_festivals`
  - `artwork_likes`
- 응답 권장 필드
  - `id`
  - `title_ko`
  - `title_en`
  - `artist_name_ko`
  - `artist_name_en`
  - `description_ko`
  - `description_en`
  - `size_text_ko`
  - `size_text_en`
  - `production_year`
  - `festival_years`
  - `place_name_ko`
  - `place_name_en`
  - `address`
  - `lat`
  - `lng`
  - `images`
  - `audio_url`
  - `liked`
- 구현 메모
  - 대표 이미지는 `images[0]`으로 판단 가능
  - 축제 연도는 `CAST(year AS UNSIGNED) DESC` 정렬을 dashboard가 이미 사용 중이다.
  - 지도 재사용을 위해 `lat/lng`, `place_name_ko`, `place_name_en`은 반드시 상세 응답에 포함해야 한다.

### 7. `GET /v1/artworks/filters`
- 목적
  - 작품 아카이브 필터 옵션 제공
- 필요한 묶음
  - `zones`
  - `artistTypes`
  - `festivalYears`
- 데이터 소스
  - `places`
  - `zones`
  - `artwork_festivals`
- 권장 응답 구조
  - `zones: [{ id, name_ko, name_en, places: [{ id, name_ko, name_en }] }]`
  - `artistTypes: [{ value, label_ko, label_en }]`
  - `festivalYears: ['2025', '2024', ...]`
- 권장안
  - `zones`와 `places`는 별도 활성 작품 조건 없이 테이블 기준으로 그대로 노출한다
  - `festivalYears`도 `artwork_festivals` 기준 distinct + numeric desc로 그대로 노출한다
  - `artistTypes`는 enum 고정값 `COMPANY`, `INDIVIDUAL`

### 8. `GET /v1/map/artworks`
- 목적
  - 지도 마커용 작품 목록
- 쿼리 파라미터
  - `lat`
  - `lng`
- 응답 권장 필드
  - `id`
  - `title_ko`, `title_en`
  - `lat`, `lng`
  - `liked`
- 구현 방향
  - 검색/zone 필터 없이 지도에 노출할 전체 작품의 최소 필드를 가져온다
  - SQL에서 거리 계산과 반경 필터링, 거리순 정렬까지 처리한다
- 거리 계산 규칙
  - `lat`, `lng`, `radiusMeters`는 모두 필수다
  - 서버는 반경 내 작품만 반환한다
- 정렬 권장안
  - 거리 오름차순

## 구현 구조 권장안

### 파일 구조
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

### read model 재사용 권장
- `search`, `home`, `map`이 모두 artwork card 계열 응답을 다루지만, 유스케이스가 달라 필요한 조건과 필드도 조금씩 다르다.
- 권장안:
  - `artworks` domain은 아카이브/상세와 직접 연결된 read query를 담당한다.
  - `home`, `search`, `map`은 각 도메인 repository에서 필요한 read query를 직접 관리한다.
- 이유
  - 대표 썸네일, artist/place join, liked 계산은 겹치지만, endpoint별 필터와 응답 shape가 달라 repository 경계를 분리하는 편이 읽기 쉽다.

## 테스트 관점에서 필요한 것

### unit test
- `tests/unit/home/*`
  - 홈 aggregate, zone artwork, 추천코스 schema, mapper, handler
  - `tests/unit/search/*`
  - 검색 query validation, 자동완성 query validation, handler
- `tests/unit/artworks/*`
  - 필터 query validation, detail mapper, handler
- `tests/unit/map/*`
  - lat/lng validation, distance field mapping, handler

### integration test
- `tests/integration/content/*` 신규 폴더 권장
  - 최소 시나리오
  - `GET /v1/home`
  - `GET /v1/home/artworks?zoneId=...`
  - `GET /v1/search/artworks?q=...&sort=latest&page=1&size=20`
  - `GET /v1/search/autocomplete?q=...&lang=ko|en&size=10`
  - `GET /v1/artworks`
  - `GET /v1/artworks/{id}`
  - `GET /v1/artworks/filters`
  - `GET /v1/map/artworks?lat=...&lng=...`

## 구현 전에 확정해야 할 미정 항목

### 1. 홈 배너 클릭 액션 필드
- 현재 DB와 dashboard에는 action metadata가 없다.
- 5단계 범위에서는 이미지 목록만 반환하는 것으로 고정해도 무방하다.

### 2. `GET /v1/artworks` 정렬 의미
- `latest|oldest`는 `festivalYear` 기준으로 해석하는 것이 제품 의미에 맞다.

### 3. `GET /v1/home`의 기본 작품 선택 규칙
- `selectedZoneId`는 `sort_order ASC, name_ko ASC`로 정렬된 zone 목록의 첫 번째 zone을 사용한다.
- 즉 현재 기준으로는 사실상 “가나다 순으로 가장 앞선 기본 zone”이 첫 권역이 된다.

## 최종 결론
- 5단계는 새로운 인프라 작업보다 `읽기 모델을 정교하게 설계하는 단계`에 가깝다.
- 현재 repo에는 handler 자리와 공통 런타임은 이미 준비돼 있고, 실제 구현 공백은 `home/search/artworks/map` 도메인 파일과 테스트뿐이다.
- DB 관점에서는 `artworks + artists + places + zones + artwork_images + artwork_festivals + artwork_likes`를 묶는 공통 read model이 핵심이고, `home/recommended-courses`만 `courses + course_items`를 추가로 본다.
- 홈 초기 진입 최적화를 위해 `GET /v1/home` aggregate API를 새 기준으로 두고, zone 전환은 `GET /v1/home/artworks`로 부분 갱신하는 구조가 가장 현실적이다.
- `artwork_likes`는 실제 DDL까지 확인됐으므로 `liked` 계산용 조인 조건은 더 이상 추정이 아니다.
- 남은 확인 포인트는 `배너 클릭 액션` 하나 정도이고, 나머지 `다국어 응답`, `작품 정렬 기준`, `기본 zone 선택 규칙`은 이 문서에서 구현 방향으로 고정했다.
- 이 기준을 따르면 5단계 구현은 현재 shared runtime과 auth/users 패턴을 그대로 따라 비교적 직선적으로 진행할 수 있다.
