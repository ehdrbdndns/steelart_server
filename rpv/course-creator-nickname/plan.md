# Plan

## Goal
1. 사용자 생성 코스 목록 응답에 작성자 닉네임을 `creator_nickname` 필드로 추가한다.
2. 적용 대상은 `GET /v1/courses/community/recent`, `GET /v1/courses/mine`, `GET /v1/courses/favorites`의 `communityCourses`다.
3. 공통 `CourseListItem` 영향으로 공식 코스 응답에는 `creator_nickname: null`을 포함한다.

## Scope
1. 코스 목록 도메인 타입에 `creator_nickname: string | null`을 추가한다.
2. 사용자 생성 코스 목록 SQL에서 `courses.created_by_user_id -> users.id`를 조인해 `users.nickname`을 조회한다.
3. 공식 코스 목록 SQL은 공통 응답 shape 유지를 위해 `NULL AS creator_nickname`을 반환한다.
4. `GET /v1/courses/community/recent`, `GET /v1/courses/mine`, `GET /v1/courses/favorites`, `GET /v1/courses/recommended`의 목록 응답 mapper가 새 필드를 보존하도록 한다.
5. 루트 API 계약 문서 `STEELART_SERVER_API_DRAFT.md`의 관련 코스 목록 타입을 갱신한다.
6. 단위 테스트와 통합 테스트에 `creator_nickname` 기대값을 추가한다.

## Non-Goals
1. 코스 상세 `GET /v1/courses/{courseId}`에는 이번 작업에서 `creator_nickname`을 추가하지 않는다.
2. 코스 생성, 수정, 삭제, 좋아요, 체크인 동작은 변경하지 않는다.
3. DB schema, migration, index는 변경하지 않는다.
4. 사용자 닉네임 표시 정책을 새로 만들지 않는다. `users.nickname` 값을 응답에 그대로 전달하되, 조인 결과가 없거나 공식 코스면 `null`을 반환한다.
5. 앱 화면 표시는 이번 서버 작업 범위에 포함하지 않는다.

## Implementation Strategy
1. 기존 `CourseListItem` 공통 응답 구조를 확장한다.
2. `CourseListItem`이 이미 `mine`, `recommended`, `favorites`, `community/recent`에서 공유되므로, 새 필드는 모든 목록 응답에 존재하게 만들고 공식 코스에서는 `null`을 반환한다.
3. 사용자 생성 코스는 `created_by_user_id IS NOT NULL` 조건이 이미 있으므로 `LEFT JOIN users u ON u.id = c.created_by_user_id`로 닉네임을 가져온다.
4. `LEFT JOIN`을 사용해 비정상 데이터에서 사용자 row가 없어도 코스 목록 자체가 사라지지 않도록 한다.
5. `buildCourseListPageSql`에는 `includeCreatorNickname` 옵션을 추가하거나 where 외 별도 인자를 추가해, 공식 코스와 내 코스가 같은 helper를 계속 쓰되 `creator_nickname` select 정책만 다르게 한다.
6. `listFavoriteCourses`는 공식/사용자 생성 코스가 한 쿼리 결과에 섞이므로, `LEFT JOIN users`와 `CASE WHEN c.is_official = 0 THEN u.nickname ELSE NULL END AS creator_nickname` 방식으로 한 번에 조회한다.

## Implementation Principles
1. Open/Closed Principle(OCP)을 우선한다.
2. 가능한 한 기존 `CourseListItem`, `mapCourseListRow`, `mapCourseListItem` 확장 지점을 활용해 backward-compatible하게 필드를 추가한다.
3. 기존 코드 수정은 코스 목록 응답 생성 경로에 한정하고, 코스 상세/쓰기/체크인 로직에는 손대지 않는다.
4. React Native 앱 기능 구현이 아니므로 Maestro용 `testID` 계약은 이번 계획에 포함하지 않는다.

## Codebase Grounding
1. 확인한 관련 파일/모듈:
   1. `src/domains/courses/types.ts`
   2. `src/domains/courses/mapper.ts`
   3. `src/domains/courses/repository.ts`
   4. `src/domains/courses/service.ts`
   5. `src/lambdas/courses/handler.ts`
   6. `tests/unit/courses/courses-mapper.test.ts`
   7. `tests/unit/courses/courses-handler.test.ts`
   8. `tests/integration/courses/courses-handler.integration.test.ts`
   9. `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
2. 따를 기존 패턴:
   1. repository에서 SQL row를 조회한다.
   2. `mapCourseListRow`가 repository row를 `CourseListItem`으로 만든다.
   3. mapper의 `mapCourseListItem`이 API 응답에서 허용할 필드만 명시적으로 복사한다.
   4. 목록 API 테스트는 handler 단위 fixture와 integration DB seed를 둘 다 사용한다.
3. 관련 함수/컴포넌트/API:
   1. `CourseListItem`
   2. `mapCourseListRow`
   3. `mapCourseListItem`
   4. `buildCourseListPageSql`
   5. `coursesRepository.listMyCourses`
   6. `coursesRepository.listRecentCommunityCourses`
   7. `coursesRepository.listFavoriteCourses`
   8. `coursesRepository.listRecommendedCourses`
4. 관련 데이터 흐름/상태/권한:
   1. 인증된 요청에서 `auth.userId`를 서비스에 넘긴다.
   2. `mine`은 `courses.created_by_user_id = auth.userId`로 필터링한다.
   3. `community/recent`는 `is_official = 0`, `created_by_user_id IS NOT NULL`, `deleted_at IS NULL`로 필터링한다.
   4. `favorites`는 현재 사용자의 `course_likes`를 기준으로 공식/사용자 생성 코스를 분리한다.
5. 구현 전 실제 코드 작성 없이 확인한 근거:
   1. `CourseListItem`에는 현재 `creator_nickname`이 없다.
   2. `mapCourseListItem`은 생성자 필드를 복사하지 않는다.
   3. `buildCourseListPageSql`은 현재 `courses c`만 조회한다.
   4. `listRecentCommunityCourses`와 `listFavoriteCourses`도 현재 `users` 조인이 없다.
6. Serena MCP로 확인한 symbol/참조 관계:
   1. `CourseListItem`은 `CourseListResponse`, `FavoriteCoursesResponse`, `mapCourseListItem`, repository 목록 반환 타입에서 참조된다.
   2. `mapCourseListRow`는 `listFavoriteCourses`, `listMyCourses`, `listRecentCommunityCourses`, `listRecommendedCourses`에서 호출된다.
   3. `mapFavoriteCoursesResponse`는 `officialCourses`와 `communityCourses` 모두 `mapCourseListItem`을 통과시킨다.

## Implementation Sketches
1. 추가/변경할 함수 signature:
   1. `CourseListItem`:
      ```ts
      creator_nickname: string | null;
      ```
   2. `CourseListBaseRow`:
      ```ts
      creator_nickname: string | null;
      ```
   3. `buildCourseListPageSql`:
      ```ts
      function buildCourseListPageSql(whereSql: string, includeCreatorNickname: boolean): string
      ```
2. 주요 type/interface/request/response shape:
   1. 사용자 생성 코스 목록 item:
      ```ts
      {
        id: number;
        title_ko: string;
        title_en: string;
        description_ko: string | null;
        description_en: string | null;
        is_official: false;
        creator_nickname: string | null;
        liked: boolean;
        stampProgress: null;
        thumbnail_image_url: string | null;
        thumbnail_image_width: number | null;
        thumbnail_image_height: number | null;
        start_place_name_ko: string | null;
        start_place_name_en: string | null;
        end_place_name_ko: string | null;
        end_place_name_en: string | null;
      }
      ```
   2. 공식 코스 목록 item:
      ```ts
      {
        is_official: true;
        creator_nickname: null;
      }
      ```
3. 핵심 query/select/include 또는 API 호출 형태:
   1. 사용자 생성 코스 조회:
      ```sql
      LEFT JOIN users creator
        ON creator.id = c.created_by_user_id
      SELECT creator.nickname AS creator_nickname
      ```
   2. 공식 코스 조회:
      ```sql
      SELECT NULL AS creator_nickname
      ```
   3. favorites 혼합 조회:
      ```sql
      LEFT JOIN users creator
        ON creator.id = c.created_by_user_id
      SELECT
        CASE
          WHEN c.is_official = 0 THEN creator.nickname
          ELSE NULL
        END AS creator_nickname
      ```
4. route/component/service 연결 방식:
   1. `src/lambdas/courses/handler.ts` 변경은 필요 없을 가능성이 높다.
   2. `src/domains/courses/service.ts` 변경은 필요 없을 가능성이 높다.
   3. repository와 mapper의 반환 shape만 확장한다.
5. 상태 변경, 저장, polling, background job 흐름:
   1. 해당 없음.
6. 외부 API payload/config/env 예시:
   1. 해당 없음.
7. 에러/edge case 처리의 코드 흐름:
   1. 공식 코스는 `creator_nickname: null`.
   2. 사용자 생성 코스인데 `users` row가 없으면 `creator_nickname: null`.
   3. 사용자 닉네임이 DB에서 `NULL`이면 `null`.
   4. 사용자 닉네임이 빈 문자열이면 빈 문자열 그대로 반환한다.
8. React Native 앱 검증에 필요한 `testID`/accessibility id:
   1. 해당 없음.
9. 실제 구현 단계에서 코드베이스 스타일에 맞게 조정해야 할 부분:
   1. TypeScript strictness에 맞춰 모든 test fixture의 `CourseListItem` 객체에 `creator_nickname`을 추가해야 할 수 있다.
   2. `STEELART_SERVER_API_DRAFT.md`의 `CourseListItem[]` 약칭 섹션은 관련 목록 타입과 일관되게 설명을 보강해야 한다.

## Implementation Order

### Step 1: 타입과 mapper 확장
1. 변경할 파일/모듈:
   1. `src/domains/courses/types.ts`
   2. `src/domains/courses/mapper.ts`
2. 의도한 변경:
   1. `CourseListItem`에 `creator_nickname: string | null`을 추가한다.
   2. `mapCourseListItem`이 `creator_nickname`을 명시적으로 복사하게 한다.
3. 이유:
   1. API 응답에서 필드를 노출하려면 타입과 mapper가 먼저 필드를 보존해야 한다.
4. 선행 조건/의존성:
   1. 없음.
5. 중간 확인 방법:
   1. TypeScript가 `CourseListItem` fixture 누락을 알려주는지 확인한다.
6. 건드리지 말아야 할 것:
   1. `CourseDetail` 타입은 수정하지 않는다.
7. 핵심 구현 스케치:
   ```ts
   export interface CourseListItem {
     creator_nickname: string | null;
     ...
   }
   ```

### Step 2: repository row와 SQL 확장
1. 변경할 파일/모듈:
   1. `src/domains/courses/repository.ts`
2. 의도한 변경:
   1. `CourseListBaseRow`에 `creator_nickname`을 추가한다.
   2. `mapCourseListRow`에서 `creator_nickname: baseRow.creator_nickname ?? null`을 반환한다.
   3. `buildCourseListPageSql`이 사용자 생성 코스 조회에서는 `users` 조인과 `creator.nickname` select를 포함하고, 공식 코스 조회에서는 `NULL AS creator_nickname`을 포함하게 한다.
   4. `listRecentCommunityCourses` SQL에 `LEFT JOIN users creator`와 `creator.nickname AS creator_nickname`을 추가한다.
   5. `listFavoriteCourses` SQL에 `LEFT JOIN users creator`와 `CASE WHEN c.is_official = 0 THEN creator.nickname ELSE NULL END AS creator_nickname`을 추가한다.
3. 이유:
   1. 목표 API들이 모두 repository 목록 row에서 출발하므로 SQL select가 새 필드를 제공해야 한다.
4. 선행 조건/의존성:
   1. Step 1 타입 추가.
5. 중간 확인 방법:
   1. `pnpm typecheck`.
6. 건드리지 말아야 할 것:
   1. 코스 상세 SQL.
   2. 코스 생성/수정/삭제 SQL.
   3. 체크인 SQL.
7. 핵심 구현 스케치:
   ```ts
   function buildCourseListPageSql(whereSql: string, includeCreatorNickname: boolean): string {
     const creatorSelectSql = includeCreatorNickname
       ? 'creator.nickname AS creator_nickname'
       : 'NULL AS creator_nickname';
     const creatorJoinSql = includeCreatorNickname
       ? 'LEFT JOIN users creator ON creator.id = c.created_by_user_id'
       : '';
     ...
   }
   ```

### Step 3: API 계약 문서 갱신
1. 변경할 파일/모듈:
   1. `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
2. 의도한 변경:
   1. `GET /v1/courses/recommended` 실제 data 타입에 `creator_nickname: null`을 추가한다.
   2. `GET /v1/courses/mine` 실제 data 타입에 `creator_nickname: string | null`을 추가한다.
   3. `GET /v1/courses/community/recent` 실제 data 타입에 `creator_nickname: string | null`을 추가한다.
   4. `GET /v1/courses/favorites` 설명에 공식 코스는 `creator_nickname: null`, 사용자 생성 코스는 작성자 닉네임을 반환한다고 보강한다.
3. 이유:
   1. 서버 작업 규칙상 API contract 변경은 root draft를 함께 갱신해야 한다.
4. 선행 조건/의존성:
   1. 적용 범위 확정.
5. 중간 확인 방법:
   1. 문서 diff 확인.
6. 건드리지 말아야 할 것:
   1. API path, method, 권한, 조회 조건은 변경하지 않는다.
7. 핵심 구현 스케치:
   ```ts
   creator_nickname: string | null;
   ```

### Step 4: 단위 테스트 갱신
1. 변경할 파일/모듈:
   1. `tests/unit/courses/courses-mapper.test.ts`
   2. `tests/unit/courses/courses-handler.test.ts`
2. 의도한 변경:
   1. mapper fixture와 expected response에 `creator_nickname`을 추가한다.
   2. `GET /v1/courses/mine` handler 테스트가 새 필드를 포함하는지 확인한다.
   3. favorite/recommended 관련 fixture가 있다면 공식 코스 `creator_nickname: null`, 사용자 생성 코스 `creator_nickname` 값을 반영한다.
3. 이유:
   1. mapper가 새 필드를 누락하면 API 응답에 노출되지 않는다.
4. 선행 조건/의존성:
   1. Step 1, Step 2.
5. 중간 확인 방법:
   1. `pnpm test tests/unit/courses/courses-mapper.test.ts tests/unit/courses/courses-handler.test.ts`가 가능하면 실행한다.
   2. Node test runner 스크립트 구조상 특정 파일 인자 전달이 맞지 않으면 `pnpm test`를 실행한다.
6. 건드리지 말아야 할 것:
   1. unrelated course validation 테스트.
7. 핵심 구현 스케치:
   ```ts
   assert.equal(body.data.courses[0].creator_nickname, '...');
   ```

### Step 5: 통합 테스트 갱신
1. 변경할 파일/모듈:
   1. `tests/integration/courses/courses-handler.integration.test.ts`
2. 의도한 변경:
   1. `my courses endpoint returns only authored custom courses`에서 `creator_nickname`이 seeded user nickname인지 확인한다.
   2. `recent community courses endpoint`에서 반환된 코스들의 `creator_nickname`이 작성자 nickname과 일치하는지 확인한다.
   3. `favorites endpoint`에서 `officialCourses[0].creator_nickname === null`과 `communityCourses[0].creator_nickname` 값을 확인한다.
3. 이유:
   1. 실제 DB join이 동작하는지 검증해야 한다.
4. 선행 조건/의존성:
   1. repository SQL 구현.
5. 중간 확인 방법:
   1. 통합 테스트 환경이 준비되어 있으면 courses integration 테스트를 실행한다.
6. 건드리지 말아야 할 것:
   1. seed 데이터의 의미를 바꾸지 않는다.
7. 핵심 구현 스케치:
   ```ts
   assert.equal(body.data.courses[0].creator_nickname, '...');
   assert.equal(body.data.officialCourses[0].creator_nickname, null);
   ```

## State, Error, and Edge Handling
1. 인증 상태:
   1. 기존 인증 흐름을 그대로 사용한다.
2. Empty state:
   1. 코스 목록이 비어 있으면 기존처럼 빈 배열을 반환한다.
3. Error state:
   1. 새 조인은 에러 응답을 추가하지 않는다.
4. Deleted course:
   1. 기존 `deleted_at IS NULL` 조건을 유지한다.
5. Missing user row:
   1. `LEFT JOIN`으로 목록을 유지하고 `creator_nickname: null`을 반환한다.
6. Nullable nickname:
   1. DB의 `NULL`은 `null`, 빈 문자열은 빈 문자열 그대로 반환한다.

## Automated Checks
1. `pnpm typecheck`
2. `pnpm test`
3. 통합 DB 환경이 준비된 경우 `pnpm test:integration:env`
4. 통합 DB 환경이 없으면 `pnpm test:integration:env`는 실행하지 못한 검증으로 기록한다.

## Risks and Fallback
1. 위험: `CourseListItem` 공통 확장으로 공식 코스 API에도 새 필드가 추가된다.
   1. 대응: 사용자가 `creator_nickname: null` 포함을 허용했으므로 계약 문서에 명시한다.
2. 위험: `users.nickname`이 빈 문자열이면 앱에 빈 작성자명이 노출될 수 있다.
   1. 대응: 이번 범위에서는 DB 값을 그대로 전달하고, 표시 fallback은 앱 또는 별도 정책 변경으로 분리한다.
3. 위험: 통합 테스트 DB가 로컬에서 준비되지 않았을 수 있다.
   1. 대응: unit/typecheck는 필수로 실행하고, integration은 환경 부재 시 미실행 사유를 기록한다.
4. fallback:
   1. 문제가 발생하면 `creator_nickname` 필드 추가 변경만 되돌리면 기존 API 동작으로 복귀할 수 있다.

## Review Questions
1. 현재 구현 시작을 막는 미답변 질문은 없다.
