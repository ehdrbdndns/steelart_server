# 코스 / 체크인 구현 계획

## 문서 목적
- `codex/07-courses` 브랜치 하나에서 코스와 체크인 범위를 함께 구현하기 위한 작업 단위를 정리한다.
- [docs/research.md](/Users/donggyunyang/code/steelart/steelart_server/docs/research.md)에 정리한 결정사항을 코드, 테스트, 문서 변경 항목으로 고정한다.

## 상태
- 구현 완료

## 권장 브랜치
- `codex/07-courses`

## 구현 범위

### 코스 기능
- `GET /v1/courses/recommended`
- `GET /v1/courses/mine`
- `GET /v1/courses/{courseId}`
- `POST /v1/courses`
- `PATCH /v1/courses/{courseId}`
- `POST /v1/courses/{courseId}/like`
- `DELETE /v1/courses/{courseId}/like`

### 체크인 및 안정화
- `POST /v1/courses/{courseId}/checkins`
- 공식 코스 여부 검증
- 거리 검증 `10m + tolerance 5m`
- 중복 체크인 방지
- 테스트 / 문서 / reset helper 정리

## 고정 결정

### 목록 API
- 목록은 `page`, `size` 기반 페이지네이션으로 통일한다.
- 기본값은 `page=1`, `size=20`으로 둔다.
- 최대 `size`는 `100`으로 제한한다.
- 검색 query는 추가하지 않는다.
- 정렬 query는 추가하지 않는다.
- 목록 카드에는 아래 필드를 포함한다.
  - `liked`
  - `start_place_name_ko`, `start_place_name_en`
  - `end_place_name_ko`, `end_place_name_en`
- 목록 카드에서는 아래 필드를 제외한다.
  - `artwork_count`
  - 예상 시간/거리 같은 파생값

### 코스 수정 정책
- official course는 consumer `PATCH` 금지
- non-owner course도 consumer `PATCH` 금지
- 두 경우 모두 `403 FORBIDDEN`

### 코스 생성 / 수정 validation
- `title_ko`, `title_en` 필수
- `description_ko`, `description_en` 필수
- `items` 최소 1개
- `seq`는 1부터 연속값
- 같은 코스 내 `artwork_id` 중복 금지
- 모든 `artwork_id`는 active artwork여야 함

### 체크인 정책
- official course만 체크인 가능
- 체크인 순서는 강제하지 않는다.
- `CHECKIN_BASE_RADIUS_METERS = 10`
- `CHECKIN_TOLERANCE_METERS = 5`
- 실제 허용 반경은 `15m`

## API 계약 초안

### 1. 추천 코스 / 내 코스 목록 응답
```ts
{
  courses: Array<{
    id: number;
    title_ko: string;
    title_en: string;
    description_ko: string | null;
    description_en: string | null;
    is_official: boolean;
    stamped: boolean;
    liked: boolean;
    thumbnail_image_url: string | null;
    thumbnail_image_width: number | null;
    thumbnail_image_height: number | null;
    start_place_name_ko: string | null;
    start_place_name_en: string | null;
    end_place_name_ko: string | null;
    end_place_name_en: string | null;
  }>;
  page: number;
  size: number;
  total: number;
}
```
- `recommended`는 `is_official = true`만 반환
- `mine`은 `created_by_user_id = auth.userId`만 반환
- `mine`의 `stamped`는 원칙적으로 `false`다.
  - 체크인은 official course에만 허용되기 때문이다.

### 2. 코스 상세 응답
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
- `editable`은 `is_official === false && created_by_user_id === auth.userId`일 때만 `true`
- `stamped`는 해당 유저가 이 코스에 체크인 row를 하나라도 가지면 `true`

### 3. 코스 생성 / 수정 성공 응답
- `POST /v1/courses`
- `PATCH /v1/courses/{courseId}`
- 두 엔드포인트 모두 저장 직후 최신 코스 상세 응답을 반환한다.
- 이유:
  - 앱이 저장 직후 추가 fetch 없이 상세 화면으로 전환 가능하다.
  - 저장된 `items` 순서와 `editable`, `liked`, `stamped`의 정규화 결과를 바로 내려줄 수 있다.

### 4. 코스 좋아요 응답
```ts
{
  courseId: number;
  liked: boolean;
}
```
- `POST`는 최종 상태 `liked: true`
- `DELETE`는 최종 상태 `liked: false`
- 둘 다 멱등 처리

### 5. 코스 체크인 응답
```ts
{
  courseId: number;
  courseItemId: number;
  checkedIn: true;
  stamped: true;
}
```
- 성공하면 해당 item은 체크인 완료로 본다.
- 코스 단위 `stamped`도 `true`가 된다.

### 6. 코스 체크인 실패 정책
- course 없음 / course_item이 다른 코스 소속 -> `404 NOT_FOUND`
- official course 아님 -> `403 FORBIDDEN`
- 이미 체크인 완료 -> `409 CONFLICT`
- 허용 반경 초과 -> `400 BAD_REQUEST`

## 수정 대상 파일

### 도메인 코드
- [src/domains/courses/types.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/courses/types.ts)
- [src/domains/courses/schemas.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/courses/schemas.ts)
- [src/domains/courses/mapper.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/courses/mapper.ts)
- [src/domains/courses/repository.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/courses/repository.ts)
- [src/domains/courses/service.ts](/Users/donggyunyang/code/steelart/steelart_server/src/domains/courses/service.ts)

### Lambda
- [src/lambdas/courses/handler.ts](/Users/donggyunyang/code/steelart/steelart_server/src/lambdas/courses/handler.ts)

### 테스트
- [tests/unit/courses/courses-handler.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/unit/courses/courses-handler.test.ts)
- [tests/unit/courses/courses-schemas.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/unit/courses/courses-schemas.test.ts)
- [tests/unit/courses/courses-mapper.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/unit/courses/courses-mapper.test.ts)
- [tests/unit/courses/courses-service.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/unit/courses/courses-service.test.ts)
- [tests/integration/courses/courses-handler.integration.test.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/integration/courses/courses-handler.integration.test.ts)
- [tests/integration/helpers/database.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/integration/helpers/database.ts)

### 문서
- [/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md](/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md)
- [docs/research.md](/Users/donggyunyang/code/steelart/steelart_server/docs/research.md)
- [docs/IMPLEMENTATION_SEQUENCE.md](/Users/donggyunyang/code/steelart/steelart_server/docs/IMPLEMENTATION_SEQUENCE.md)
- [docs/MASTER_PLAN.md](/Users/donggyunyang/code/steelart/steelart_server/docs/MASTER_PLAN.md)

## 단계별 구현 계획

### 0단계. 문서 / 추적 상태 정리 [완료]
- `.gitignore`에서 [docs/plan.md](/Users/donggyunyang/code/steelart/steelart_server/docs/plan.md), [docs/research.md](/Users/donggyunyang/code/steelart/steelart_server/docs/research.md)를 제외해 git 추적 대상으로 바꾼다.
- 루트 API 초안에 아래 계약을 먼저 반영하거나 코드와 동시에 반영한다.
  - 코스 목록 query `page`, `size`
  - 코스 목록/상세/좋아요/체크인 응답 타입
  - `PATCH`의 `403 FORBIDDEN`
  - 체크인 거리 `15m`

### 1단계. courses 도메인 scaffold [완료]
- `src/domains/courses` 디렉터리를 만든다.
- `types.ts`에 아래를 정의한다.
  - `CourseListItem`
  - `CourseListResponse`
  - `CourseDetail`
  - `CourseLikeResponse`
  - `CourseCheckinResponse`
  - `CreateCourseInput`
  - `UpdateCourseInput`
  - `CourseCheckinInput`
- pagination / checkin 상수도 여기서 같이 고정한다.
  - `COURSE_LIST_DEFAULT_PAGE = 1`
  - `COURSE_LIST_DEFAULT_SIZE = 20`
  - `COURSE_LIST_MAX_SIZE = 100`
  - `CHECKIN_BASE_RADIUS_METERS = 10`
  - `CHECKIN_TOLERANCE_METERS = 5`

### 2단계. schema / handler 입력 파싱 [완료]
- `schemas.ts`에서 아래를 만든다.
  - 목록 query schema
  - `courseId` path param schema
  - create body schema
  - update body schema
  - checkin body schema
- `handler.ts`는 기존 handler 규격에 맞춰 고정 경로와 route template 경로를 분리해 처리한다.
  - 고정 경로는 `request.path === '/v1/courses/recommended'`처럼 비교
  - 동적 경로는 `request.routePath === '/v1/courses/{courseId}'`처럼 비교
- 모든 코스 엔드포인트는 인증 필요로 처리한다.

### 3단계. 목록 조회 구현 [완료]
- `repository.ts`에 추천 코스 / 내 코스 목록 쿼리를 추가한다.
- 추천 코스 목록 쿼리:
  - `courses`
  - 첫 item thumbnail
  - 첫 item place = 시작 장소
  - 마지막 item place = 마지막 장소
  - `course_likes` join -> `liked`
  - `course_checkins exists` -> `stamped`
  - `WHERE is_official = 1 AND deleted_at IS NULL`
  - `ORDER BY updated_at DESC`
- 내 코스 목록 쿼리:
  - `WHERE created_by_user_id = ? AND deleted_at IS NULL`
  - 카드 shape는 추천 코스와 동일
  - `stamped`는 `false` 고정
- total count 쿼리를 별도로 두고 `page`, `size`, `total`을 반환한다.
- `mapper.ts`에서 목록 응답 매퍼를 만든다.

### 4단계. 상세 조회 구현 [완료]
- `repository.ts`에 코스 상세 조회 쿼리를 추가한다.
- 상세는 아래 조인이 필요하다.
  - `courses`
  - `course_items`
  - `artworks`
  - `artists`
  - `places`
  - 첫 artwork thumbnail
  - `course_likes` -> `liked`
  - `course_checkins` -> `stamped`, `items[].checkedIn`
- `ORDER BY ci.seq ASC`
- `service.ts`에서 not found / editable 계산을 처리한다.
- `mapper.ts`에서 상세 응답 타입으로 매핑한다.

### 5단계. 생성 / 수정 구현 [완료]
- `service.ts`에서 공통 validation을 구현한다.
  - active artwork 존재 확인
  - duplicate artwork 금지
  - seq 연속값 확인
- `POST /v1/courses`
  - transaction 내에서 `courses` insert
  - `course_items` bulk insert
  - 저장 후 상세를 다시 읽어 반환
- `PATCH /v1/courses/{courseId}`
  - course 존재 확인
  - official 여부 확인 -> `403`
  - owner 여부 확인 -> `403`
  - transaction 내에서 course 기본 정보 update
  - 기존 `course_items` delete 후 새 `items` insert
  - 저장 후 상세를 다시 읽어 반환

### 6단계. 좋아요 구현 [완료]
- 작품 좋아요와 같은 멱등 패턴을 코스에도 적용한다.
- 존재 확인:
  - `courses.id = ?`
  - `deleted_at IS NULL`
- 좋아요 생성:
  - `INSERT ... ON DUPLICATE KEY UPDATE created_at = created_at`
- 좋아요 취소:
  - `DELETE ...`
- 응답은 `{ courseId, liked }`

### 7단계. 체크인 구현 [완료]
- 검증 순서:
  1. course 존재 + `deleted_at IS NULL`
  2. `is_official = 1`
  3. `course_item_id`가 해당 `course_id` 소속인지 확인
  4. item의 artwork/place 좌표 로드
  5. 사용자 좌표와 거리 계산
  6. `distance <= 15m` 확인
  7. 중복 체크인 여부 확인
  8. `course_checkins` insert
- 순서 강제는 하지 않는다.
- 성공 응답은 `{ courseId, courseItemId, checkedIn: true, stamped: true }`

### 8단계. 테스트 보강 [완료]

#### unit
- `courses-schemas`
  - `page`, `size` 기본값 / 최대값
  - create/update/checkin body validation
- `courses-handler`
  - 라우팅
  - query / path / body parsing
  - 응답 status / body
- `courses-service`
  - official/non-official 분기
  - owner 권한 분기
  - like/unlike 멱등
  - 중복 체크인 / 반경 초과 / 다른 코스 item 거부
- `courses-mapper`
  - 목록 / 상세 / 체크인 / 좋아요 응답 매핑

#### integration
- 추천 코스 목록이 official만 반환하는지
- 추천 코스 / 내 코스 목록이 `page`, `size`, `total`을 반환하는지
- 목록 카드에 `liked`, 시작 장소명, 마지막 장소명이 들어가는지
- 내 코스 목록이 작성자 기준인지
- 코스 상세가 `seq ASC`, `liked`, `editable`, `items[].checkedIn`을 반영하는지
- 사용자 코스 생성/수정이 실제 DB에 반영되는지
- official course 수정이 `403`인지
- non-owner 수정이 `403`인지
- 코스 좋아요 row 생성/삭제가 멱등인지
- official course만 체크인 허용하는지
- 다른 코스 item으로 체크인 시도가 `404`인지
- `15m` 초과 시 `400`인지
- 중복 체크인이 `409`인지

### 9단계. reset helper / 문서 정리 [완료]
- [tests/integration/helpers/database.ts](/Users/donggyunyang/code/steelart/steelart_server/tests/integration/helpers/database.ts)에 `DELETE FROM course_likes`를 추가한다.
- 루트 API 초안에 최종 응답 예시와 에러 정책을 반영한다.
- 구현 완료 후 [docs/IMPLEMENTATION_SEQUENCE.md](/Users/donggyunyang/code/steelart/steelart_server/docs/IMPLEMENTATION_SEQUENCE.md), [docs/MASTER_PLAN.md](/Users/donggyunyang/code/steelart/steelart_server/docs/MASTER_PLAN.md) 상태를 갱신한다.

## 검증 계획
- `pnpm typecheck`
- `pnpm test`
- `set -a && source .env.integration && set +a && pnpm test:integration`

## 리스크와 대응

### 1. 시작 장소 / 마지막 장소 join이 복잡해질 수 있음
- 대응:
  - `seq = 1`과 max `seq`를 명확히 분리한 서브쿼리로 가져간다.
  - item이 1개인 코스는 시작/마지막 장소가 동일해도 허용한다.

### 2. 저장 직후 상세 재조회 비용이 생김
- 대응:
  - create / update는 write API이므로 추가 read 1회는 허용한다.
  - 대신 앱의 추가 fetch를 없애 응답 계약을 단순화한다.

### 3. 체크인 좌표 기준이 artwork인지 place인지 혼동될 수 있음
- 대응:
  - `course_items`는 artwork만 들고 있으므로 `artworks -> places` 기준 좌표를 명시적으로 사용한다.
  - 구현 시 API 초안에도 같은 기준을 남긴다.

## 완료 기준
- 코스 7개 엔드포인트가 모두 동작한다.
- 체크인 정책 `official only`, `15m`, `409 duplicate`, `404 wrong item`이 반영된다.
- 목록 응답이 `page`, `size`, `total`과 카드 필드 `liked`, 시작/마지막 장소명을 포함한다.
- `POST/PATCH /v1/courses`가 상세 응답을 반환한다.
- 타입체크, 단위 테스트, 통합 테스트가 모두 통과한다.
- 루트 API 초안과 구현 계획 문서가 최신 상태로 정리된다.
