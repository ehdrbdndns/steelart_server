# 7-8단계 코스 / 체크인 리서치

## 문서 목적
- `codex/07-courses`와 `codex/08-checkin-hardening` 구현 전에 필요한 제품 계약, DB 제약, 기존 코드 재사용 지점, 문서 공백을 한 번에 정리한다.
- 이번 문서는 구현 계획서가 아니라, 실제 코드를 쓰기 전에 확인해야 할 사실과 권장 방향을 모은 리서치 문서다.

## 조사 기준
- [/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md](/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md)
- [/Users/donggyunyang/code/steelart/STEELART_DB_TABLES.md](/Users/donggyunyang/code/steelart/STEELART_DB_TABLES.md)
- [/Users/donggyunyang/code/steelart/steelart_dashboard/docs/db-schema.sql](/Users/donggyunyang/code/steelart/steelart_dashboard/docs/db-schema.sql)
- [/Users/donggyunyang/code/steelart/steelart_dashboard/docs/db-contract.md](/Users/donggyunyang/code/steelart/steelart_dashboard/docs/db-contract.md)
- [/Users/donggyunyang/code/steelart/STEELART_APP_MVP_BRIEF.md](/Users/donggyunyang/code/steelart/STEELART_APP_MVP_BRIEF.md)
- [/Users/donggyunyang/code/steelart/STEELART_APP_SCREEN_STRUCTURE.md](/Users/donggyunyang/code/steelart/STEELART_APP_SCREEN_STRUCTURE.md)
- [/Users/donggyunyang/code/steelart/STEELART_APP_SCREEN_SPECS.md](/Users/donggyunyang/code/steelart/STEELART_APP_SCREEN_SPECS.md)
- [template.yaml](/Users/donggyunyang/code/steelart/steelart_server/template.yaml)
- [src/lambdas/courses/handler.ts](/Users/donggyunyang/code/steelart/steelart_server/src/lambdas/courses/handler.ts)
- [src/domains/home/repository.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/home/repository.ts)
- [src/shared/geo/distance.ts](/Users/donggyunyang/code/steelart/steelart_server/src/shared/geo/distance.ts)
- [tests/integration/content/content-read.integration.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/integration/content/content-read.integration.test.ts)
- [tests/integration/helpers/database.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/integration/helpers/database.ts)
- integration DB 실제 조회
  - `SHOW CREATE TABLE course_likes`
  - `SHOW CREATE TABLE users`

## 구현 범위 요약

### 7단계. 코스 기능
- `GET /v1/courses/recommended`
- `GET /v1/courses/mine`
- `GET /v1/courses/{courseId}`
- `POST /v1/courses`
- `PATCH /v1/courses/{courseId}`
- `POST /v1/courses/{courseId}/like`
- `DELETE /v1/courses/{courseId}/like`

### 8단계. 체크인 및 안정화
- `POST /v1/courses/{courseId}/checkins`
- 공식 코스 여부 검증
- 중복 체크인 방지
- 10m 기반 위치 검증 + GPS 허용 오차 반영
- 코스/체크인 통합 테스트 추가
- 운영 안정화 포인트 점검

## 먼저 결론
- 현재 `courses`는 SAM 라우트만 있고 실제 도메인 구현은 전혀 없다.
- DB 기준으로 코스/체크인 구현은 충분히 가능하다.
- 가장 큰 공백은 스키마가 아니라 API 계약이다.
  - 코스 목록/상세 응답 필드가 루트 초안에 아직 구체적으로 적혀 있지 않다.
  - 체크인 실패를 어떤 에러 코드로 표현할지 shared error set에서 아직 정해져 있지 않다.
- 따라서 구현은 가능하지만, 아래 항목은 코드 작성과 동시에 문서도 같이 고정해야 한다.
  - 코스 목록/상세 응답 타입
  - 코스 좋아요 응답 타입
  - 체크인 실패 코드/메시지 정책
  - 코스 목록 페이지네이션 규칙

## 현재 코드베이스 상태

### 현재 서버 코드
- [src/lambdas/courses/handler.ts](/Users/donggyunyang/code/steelart/steelart_server/src/lambdas/courses/handler.ts)는 아직 `NOT_IMPLEMENTED` placeholder다.
- `src/domains/courses` 디렉터리는 아직 존재하지 않는다.
- 현재 `main` 기준으로 완료된 관련 도메인은 아래뿐이다.
  - `auth`, `users`
  - `home`, `search`, `artworks`, `map`
  - 작품 좋아요

### 현재 SAM 라우트
- [template.yaml](/Users/donggyunyang/code/steelart/steelart_server/template.yaml)에 아래 두 라우트는 이미 연결돼 있다.
  - `/v1/courses`
  - `/v1/courses/{proxy+}`
- 따라서 인프라 추가 작업 없이 handler/domain 구현만 하면 된다.

### 현재 공통 유틸 재사용 가능 항목
- 인증:
  - `requireAuth()`
- 응답:
  - `ok()`, `fail()`
- 에러:
  - `AppError`
- route:
  - `request.path`
  - `request.routePath`
  - `request.pathParams`
- geo:
  - `calculateDistanceMeters()`
  - `isWithinRadiusMeters()`

## 앱 / 제품 요구사항 정리

### 코스 탭 구조
- 앱은 `코스` 탭을 공식 코스 소비와 사용자 생성 코스 작성이 함께 있는 축으로 본다.
- [STEELART_APP_SCREEN_SPECS.md](/Users/donggyunyang/code/steelart/STEELART_APP_SCREEN_SPECS.md) 기준:
  - 상단 탭은 `추천 코스`, `내 코스`
  - `추천 코스`는 `is_official = true`
  - `내 코스`는 사용자가 만든 코스

### 코스 상세 요구사항
- `CourseDetailScreen`은 아래 정보를 알아야 한다.
  - 코스 기본 정보
  - 공식/사용자 생성 표시
  - 순서화된 작품 목록
  - 지도 표시용 좌표
  - 좋아요
  - 코스 시작

### 코스 진행 / 체크인 요구사항
- `CourseRunScreen`은 아래 흐름을 가진다.
  - 현재 진행 상태
  - 다음 체크인 대상
  - 지도 진입
- 체크인은 아래 UX 규칙을 가진다.
  - 대상: 공식 코스
  - 방식: 위치 권한 확인 -> 현재 위치 수집 -> 서버 검증
  - 기준: 10m 이내
  - 실패 시 재시도 또는 지도 보기 유도

### 사용자 생성 코스 요구사항
- 로그인 사용자만 생성/수정 가능
- 기본 공개형
- 작성 흐름은 단순하다.
  - 제목
  - 설명
  - 작품 선택
  - 순서 편집
  - 저장

### 앱 문서에서 확인된 중요한 제약
- 체크인은 별도 상세 화면 API가 아니라 코스 진행 흐름 안에서 수행된다.
- 코스 좋아요는 MVP 범위에 포함된다.
- 사용자 생성 코스는 기본 공개형이지만, `내 코스`는 작성자 기준 조회가 필요하다.

## 루트 API 초안 기준 현재 계약

### 현재 미구현으로 남아 있는 엔드포인트
- [STEELART_SERVER_API_DRAFT.md](/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md#L817)
  - `GET /v1/courses/recommended`
- [STEELART_SERVER_API_DRAFT.md](/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md#L823)
  - `GET /v1/courses/mine`
- [STEELART_SERVER_API_DRAFT.md](/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md#L831)
  - `GET /v1/courses/{courseId}`
- [STEELART_SERVER_API_DRAFT.md](/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md#L837)
  - `POST /v1/courses`
- [STEELART_SERVER_API_DRAFT.md](/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md#L856)
  - `PATCH /v1/courses/{courseId}`
- [STEELART_SERVER_API_DRAFT.md](/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md#L862)
  - `POST /v1/courses/{courseId}/like`
- [STEELART_SERVER_API_DRAFT.md](/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md#L866)
  - `DELETE /v1/courses/{courseId}/like`
- [STEELART_SERVER_API_DRAFT.md](/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md#L869)
  - `POST /v1/courses/{courseId}/checkins`

### 초안에 이미 적혀 있는 요청 예시
- 코스 생성 요청은 bilingual title/description + `items[]` 구조다.
- 체크인 요청은 `course_item_id`, `lat`, `lng`를 받는다.

### 초안에서 아직 부족한 부분
- `GET /v1/courses/recommended` 응답 타입 미정
- `GET /v1/courses/mine` 응답 타입 미정
- `GET /v1/courses/{courseId}` 상세 응답 타입 미정
- `POST /v1/courses` 성공 응답 타입 미정
- `PATCH /v1/courses/{courseId}` 성공 응답 타입 미정
- 코스 좋아요 응답 타입 미정
- 코스 좋아요 실패 규칙 미정
- 체크인 실패 코드 규칙 미정

## 실제 DB 확인 결과

### `courses`
- raw DDL은 [db-schema.sql](/Users/donggyunyang/code/steelart/steelart_dashboard/docs/db-schema.sql#L72) 기준이다.
- 핵심 컬럼:
  - `id`
  - `title_ko`, `title_en`
  - `description_ko`, `description_en`
  - `is_official`
  - `created_by_user_id`
  - `likes_count`
  - `deleted_at`
  - `created_at`, `updated_at`
- 구현상 의미:
  - soft delete 도메인이다.
  - 사용자 생성 코스는 `created_by_user_id`로 소유권을 판단한다.
  - 공식 코스/사용자 코스 구분은 `is_official` 하나로 충분하다.

### `course_items`
- raw DDL은 [db-schema.sql](/Users/donggyunyang/code/steelart/steelart_dashboard/docs/db-schema.sql#L93) 기준이다.
- 핵심 제약:
  - `UNIQUE(course_id, seq)`
  - FK `course_id -> courses.id`
  - FK `artwork_id -> artworks.id`
- 구현상 의미:
  - 한 코스 안에서 순서는 반드시 `seq`로 관리된다.
  - item 자체에는 제목/좌표/이미지가 없으므로 상세 응답은 `artworks`, `places`, `artwork_images` 조인이 필요하다.
  - item 좌표는 결국 연결된 artwork/place 좌표를 써야 한다.

### `course_checkins`
- raw DDL은 [db-schema.sql](/Users/donggyunyang/code/steelart/steelart_dashboard/docs/db-schema.sql#L108) 기준이다.
- 핵심 제약:
  - `UNIQUE(user_id, course_item_id)`
  - FK `course_id -> courses.id ON DELETE CASCADE`
  - FK `course_item_id -> course_items.id ON DELETE CASCADE`
- 구현상 의미:
  - 같은 사용자가 같은 코스 아이템을 두 번 체크인할 수 없다.
  - 체크인 검증 시 `course_item_id`가 실제로 `{courseId}` 소속인지 반드시 확인해야 한다.
  - 코스 삭제 시 체크인 row는 자동 삭제된다.

### `course_likes`
- 루트 문서에는 추정으로만 적혀 있었지만, integration DB에서 실제 DDL을 확인했다.

```sql
CREATE TABLE `course_likes` (
  `user_id` bigint(20) NOT NULL,
  `course_id` bigint(20) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`,`course_id`),
  KEY `idx_course_likes_course_id` (`course_id`),
  CONSTRAINT `fk_course_likes_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_course_likes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

### `course_likes` 구현상 의미
- 작품 좋아요와 동일하게 `(user_id, course_id)` 복합 PK 기반 멱등 처리가 가능하다.
- `INSERT ... ON DUPLICATE KEY UPDATE created_at = created_at` 패턴을 그대로 쓸 수 있다.
- `DELETE`도 멱등 처리로 가져가는 편이 앱 UX와 일관된다.

### `users`
- integration DB에서 실제 DDL을 확인했다.
- 구현상 중요한 컬럼:
  - `id`
  - `nickname`
  - `residency`
  - `age_group`
  - `language`
  - `notifications_enabled`
- 코스/체크인 구현에는 소유권, 좋아요, 체크인 row의 FK 부모로만 쓰인다.

## dashboard / 운영 규칙에서 가져와야 할 사실

### 백오피스 DB contract
- [db-contract.md](/Users/donggyunyang/code/steelart/steelart_dashboard/docs/db-contract.md#L23) 기준으로 아래 규칙이 명시돼 있다.
  - `course_items` reorder는 기존 `id`를 유지하고 `seq`만 바꾼다.
  - `course_items` delete는 `course_checkins`가 있으면 `409`
  - `courses`는 soft delete 도메인이다.

### 이 규칙을 consumer 서버에 그대로 가져와야 하는가
- 공식 코스 관리에는 중요하다.
- 하지만 consumer API의 `PATCH /v1/courses/{courseId}`는 사용자 생성 코스 전용으로 제한할 가능성이 높다.
- 체크인은 공식 코스에서만 허용되므로, 사용자 생성 코스에는 보통 `course_checkins`가 없다.
- 따라서 consumer update는 dashboard처럼 복잡한 item reorder/delete API를 따로 둘 필요가 없다.
- 권장안:
  - consumer `POST/PATCH /v1/courses`는 `items[]` 전체 교체 방식으로 단순화
  - official course는 consumer PATCH 금지
  - non-owner course도 consumer PATCH 금지

## 이미 재사용 가능한 서버 코드 / 패턴

### 홈 추천 코스 쿼리
- [src/domains/home/repository.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/home/repository.ts#L79)에 공식 코스 리스트 쿼리가 이미 있다.
- 현재 이 쿼리가 주는 필드:
  - `id`
  - `title_ko`, `title_en`
  - `description_ko`, `description_en`
  - `stamped`
  - 첫 작품 썸네일
  - `is_official`
- `stamped` 의미:
  - 해당 유저가 그 코스에서 체크인한 row가 하나라도 있으면 `true`
  - 전체 완료 여부가 아니라 `course_checkins exists` 의미다.
- `GET /v1/courses/recommended`는 이 쿼리를 재사용하거나 shared query로 추출하는 편이 낫다.

### 작품 좋아요 패턴
- [src/domains/artworks/service.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/artworks/service.ts#L60) 기준으로 작품 좋아요는 멱등 처리다.
- 권장안:
  - 코스 좋아요도 동일하게
    - `POST` 최종 `liked: true`
    - `DELETE` 최종 `liked: false`
- 현재 작품 좋아요는 `likes_count`를 따로 증감하지 않는다.
- 코스 좋아요도 같은 phase에서는 `courses.likes_count`를 write-through 하지 않는 편이 일관적이다.

### route / auth / response
- 코스는 SAM에서 `/v1/courses` base + `/v1/courses/{proxy+}` proxy 라우트를 모두 받는다.
- 현재 공통 route helper는 `request.path`와 `request.routePath`를 분리한다.
- 코스 handler는 proxy 기반이므로 auth/search/home처럼 `request.path` 비교로 충분하다.

### geo 유틸
- [src/shared/geo/distance.ts](/Users/donggyunyang/code/steelart/steelart_server/src/shared/geo/distance.ts)
  - `calculateDistanceMeters`
  - `isWithinRadiusMeters`
- 체크인은 별도 위치 계산 유틸을 만들지 말고 이 모듈을 재사용하는 편이 맞다.

## 구현 전에 고정해야 할 계약 / 권장안

### 1. 코스 목록 응답
- 앱 문서에는 코스 목록 카드가 있지만, 서버 초안에는 필드가 없다.
- 권장안:
  - `GET /v1/courses/recommended`
    - 홈 추천 코스 카드와 같은 shape로 시작
    - 무한 스크롤용 페이지네이션 응답으로 정의
  - `GET /v1/courses/mine`
    - 추천 코스 카드와 유사한 shape + `is_official: false`
    - 무한 스크롤용 페이지네이션 응답으로 정의
- 페이지네이션은 반드시 들어간다.
  - 코스 탭은 무한 스크롤로 사용할 예정이므로 `recommended`, `mine` 모두 페이지네이션이 필요하다.
  - 기존 목록 API와 일관되게 `page`, `size` query를 사용한다.
  - 응답도 동일하게 `page`, `size`, `total`을 포함하는 형태로 맞춘다.
  - 정렬 query는 이번 단계에서 두지 않는다.
  - 검색 query도 이번 단계에서 두지 않는다.
- 목록 카드에 반드시 들어가야 하는 필드:
  - `liked`
  - 시작 장소명
  - 마지막 장소명
- 권장안:
  - 다국어 구조와 일관성을 위해 장소명도 bilingual로 둔다.
    - `start_place_name_ko`, `start_place_name_en`
    - `end_place_name_ko`, `end_place_name_en`
  - `liked`는 로그인 사용자 기준 boolean으로 계산한다.
- 제외하기로 확정한 필드:
  - `artwork_count`
  - 예상 시간/거리 같은 파생값

### 2. 코스 탭 검색/정렬
- [STEELART_APP_SCREEN_STRUCTURE.md](/Users/donggyunyang/code/steelart/STEELART_APP_SCREEN_STRUCTURE.md#L149)에는 `CourseListScreen`에 검색/정렬이 적혀 있다.
- 하지만 이번 서버 구현 범위에서는 포함하지 않는다.
- 확정안:
  - 코스 목록 API는 `page`, `size` 기반 페이지네이션만 지원한다.
  - 검색 query는 추가하지 않는다.
  - 정렬 query는 추가하지 않는다.
  - 검색/정렬이 필요해지면 별도 change로 API 초안부터 고정한다.

### 3. 코스 상세 응답
- 앱 상세 화면과 코스 진행 화면을 보면 상세 응답은 아래를 포함하는 편이 안전하다.
- 권장안 `data` 타입:
```ts
{
  id: number;
  title_ko: string;
  title_en: string;
  description_ko: string | null;
  description_en: string | null;
  is_official: boolean;
  liked: boolean;
  stamped: boolean;
  editable: boolean;
  items: Array<{
    id: number;
    seq: number;
    artwork_id: number;
    title_ko: string;
    title_en: string;
    artist_name_ko: string;
    artist_name_en: string;
    place_name_ko: string;
    place_name_en: string;
    thumbnail_image_url: string | null;
    thumbnail_image_width: number | null;
    thumbnail_image_height: number | null;
    lat: number;
    lng: number;
    checkedIn: boolean;
  }>;
}
```
- 이유:
  - `CourseDetailScreen`의 리스트/지도 표현을 한 응답으로 처리 가능
  - `CourseRunScreen`의 진행 상태와 다음 체크인 대상 계산 가능
  - 별도 “코스 진행 상태 조회” API를 당장 만들 필요가 없다

### 4. 코스 생성/수정 payload
- 루트 초안은 `items: [{ artwork_id, seq }]`를 이미 제시한다.
- 여기에 아래 validation을 권장한다.
  - `title_ko`, `title_en` 필수
  - `description_ko`, `description_en` 필수
  - `items` 최소 1개
  - `seq`는 1부터 연속값
  - 같은 코스 안에서 `artwork_id` 중복 금지
  - 모든 `artwork_id`는 active artwork여야 함
- 생성 시 서버가 강제로 채울 값:
  - `is_official = false`
  - `created_by_user_id = auth.userId`
  - `likes_count = 0`

### 5. 코스 수정 권한
- 확정안:
  - official course는 consumer PATCH 금지
  - `created_by_user_id !== auth.userId`면 금지
  - 두 경우 모두 `403 FORBIDDEN`
- 이 정책이면 detail 응답의 `editable` 계산도 단순해진다.
  - `is_official === false && created_by_user_id === auth.userId`일 때만 `editable: true`

### 6. 체크인 실패 코드
- 현재 shared `AppErrorCode`에는 체크인 전용 코드가 없다.
- 현재 선택지는 두 가지다.
  - 기존 공통 코드만 사용
    - 범위 밖 거리 -> `BAD_REQUEST`
    - 이미 체크인함 -> `CONFLICT`
    - 비공식 코스 -> `FORBIDDEN`
  - shared error code에 전용 값 추가
    - 예: `CHECKIN_OUT_OF_RANGE`, `CHECKIN_ALREADY_COMPLETED`
- 권장안:
  - 이번 단계에서 별도 코드를 굳이 늘리지 말고 공통 코드로 시작
  - 대신 `message`와 `details`를 명확히 준다

### 7. GPS 허용 오차
- 제품 문서에서 확정된 건 `10m 기준`뿐이다.
- 허용 오차는 넣기로 확정했다.
- 권장안:
  - 코드에 `CHECKIN_BASE_RADIUS_METERS = 10`
  - `CHECKIN_TOLERANCE_METERS = 5`
  - 최종 허용 반경을 합산한 상수로 처리
- 따라서 실제 판정 반경은 `15m`로 구현한다.

### 8. 체크인 순서 강제 여부
- 현재 문서에는 “다음 체크인 대상”이 보이지만, 서버가 반드시 `seq` 순서 강제를 해야 한다는 문장은 없다.
- 확정안:
  - 1차 구현은 순서 강제를 하지 않는다.
  - 같은 코스의 아무 item이나 위치와 중복 조건만 맞으면 체크인 허용
  - `CourseRunScreen`의 다음 체크인 대상 표시는 클라이언트가 `items[].checkedIn`과 `seq`를 보고 계산한다.

## 구현 시 필요한 SQL/로직 포인트

### 추천 코스 목록
- `courses c`
- `course_items first_course_item ON seq = 1`
- `course_items last_course_item` 또는 max `seq` 서브쿼리
- `artwork_images` 첫 이미지 join
- 시작/마지막 item 기준 `artworks -> places` join
- `course_checkins` 존재 여부로 `stamped`
- `course_likes` join을 추가하면 `liked`도 계산 가능
- `WHERE c.is_official = 1 AND c.deleted_at IS NULL`

### 내 코스 목록
- `WHERE c.created_by_user_id = ? AND c.deleted_at IS NULL`
- 첫 item thumbnail join
- 시작/마지막 item 기준 `artworks -> places` join
- item count는 `COUNT(ci.id)` 서브쿼리 또는 grouped join으로 계산 가능

### 코스 상세
- `courses`
- `course_items`
- `artworks`
- `artists`
- `places`
- 첫 이미지
- `course_likes` -> `liked`
- `course_checkins` -> `stamped` / `items[].checkedIn`
- item 정렬은 `ORDER BY ci.seq ASC`

### 코스 좋아요
- 존재 확인:
```sql
SELECT 1
FROM courses
WHERE id = ?
  AND deleted_at IS NULL
LIMIT 1
```
- 생성:
```sql
INSERT INTO course_likes (user_id, course_id)
VALUES (?, ?)
ON DUPLICATE KEY UPDATE created_at = created_at
```
- 삭제:
```sql
DELETE FROM course_likes
WHERE user_id = ?
  AND course_id = ?
```

### 체크인
- 검증 순서 권장안:
  1. 코스 존재 + `deleted_at IS NULL`
  2. `is_official = 1`
  3. `course_item_id`가 해당 `course_id` 소속인지 확인
  4. 해당 item의 artwork/place 좌표 로드
  5. 현재 위치와 거리 계산
  6. 중복 체크인 여부 확인
  7. insert
- insert:
```sql
INSERT INTO course_checkins (user_id, course_id, course_item_id, created_at)
VALUES (?, ?, ?, NOW())
```
- 중복은 `UNIQUE(user_id, course_item_id)`로 차단 가능하다.

## 테스트 관점에서 꼭 반영할 것

### Unit test
- `courses/handler`
  - recommended
  - mine
  - detail
  - create
  - update
  - like
  - unlike
  - checkin
- `courses/service`
  - 권한 검증
  - official/non-official 분기
  - idempotent like/unlike
  - 중복 checkin
  - 거리 초과
- `courses/schemas`
  - create/update body
  - checkin body
  - path params

### Integration test
- 추천 코스 목록이 official만 반환하는지
- 내 코스 목록이 작성자 기준인지
- 코스 상세가 `seq ASC`와 `checkedIn`을 반영하는지
- 사용자 코스 생성/수정이 실제 `courses`, `course_items`에 반영되는지
- 코스 좋아요 row 생성/삭제
- 체크인 row 생성
- 비공식 코스 체크인 거부
- 다른 코스 item으로 체크인 시도 거부
- 거리 초과 거부
- 중복 체크인 거부

### integration reset helper 주의
- [tests/integration/helpers/database.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/integration/helpers/database.ts#L70) 는 현재 `course_likes`를 비우지 않는다.
- 코스 좋아요 integration test를 추가하려면 reset 순서에 `DELETE FROM course_likes`가 필요하다.
- 위치는 `courses` 삭제 전에 들어가야 한다.

## 문서 추적 정책
- [docs/research.md](/Users/donggyunyang/code/steelart/steelart_server/docs/research.md)는 현재 `.gitignore` 대상이다.
- 이번 단계에서는 그대로 유지한다.
- 즉, 리서치 내용은 로컬 작업 참고용이며 git 추적 대상으로 바꾸지 않는다.

## 권장 구현 순서

### `codex/07-courses`
- `src/domains/courses`
  - `types.ts`
  - `schemas.ts`
  - `mapper.ts`
  - `repository.ts`
  - `service.ts`
- `src/lambdas/courses/handler.ts`
- 먼저 구현할 엔드포인트:
  - `GET /v1/courses/recommended`
  - `GET /v1/courses/mine`
  - `GET /v1/courses/{courseId}`
  - `POST /v1/courses`
  - `PATCH /v1/courses/{courseId}`
  - `POST /v1/courses/{courseId}/like`
  - `DELETE /v1/courses/{courseId}/like`
- 구현 후 문서 반영:
  - 루트 API 초안에 응답 타입 추가
  - `MASTER_PLAN`, `IMPLEMENTATION_SEQUENCE` 상태 갱신

### `codex/08-checkin-hardening`
- `POST /v1/courses/{courseId}/checkins`
- geo 상수 고정
- 체크인 실패 정책 고정
- integration 대폭 보강
- 필요 시 `AppErrorCode` 확장 여부 결정

## 이번 리서치 기준 최종 판단
- 코스/체크인 구현은 DB와 앱 흐름상 충분히 진행 가능하다.
- 가장 먼저 해야 할 일은 “코스 응답 타입”을 코드와 문서에서 동시에 고정하는 것이다.
- 구현 난이도는 checkin보다 courses 쪽이 더 크다.
  - 이유:
    - 체크인은 단일 write + 위치 검증 문제
    - 코스는 목록/상세/생성/수정/좋아요/권한/아이템 replacement를 한 번에 다뤄야 함
- 따라서 다음 실제 구현은 `codex/07-courses`에서 코스 read/write/likes를 먼저 열고, 그 다음 `codex/08-checkin-hardening`에서 체크인과 안정화를 붙이는 순서가 맞다.
