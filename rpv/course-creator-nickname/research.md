# Research

## User Intake
1. 요청한 결과: 사용자 생성 코스 목록 응답에 생성자 닉네임을 `creator_nickname` 필드로 반환한다.
2. 현재 불편/문제: 최근 사용자 생성 코스 API가 코스 작성자 이름을 내려주지 않는다.
3. 영향을 받는 사용자/역할: SteelArt 앱에서 사용자 생성 코스를 보는 앱 사용자와, 코스를 만든 일반 사용자.
4. 관련 화면/흐름: 코스 탭의 공개 시민 추천 코스 최근 목록, 특히 `GET /v1/courses/community/recent?size=10`.
5. 제공된 예시/자료: 사용자가 이전 대화에서 “사용자가 만든 코스 가져오는 api 최근 10개”와 “생성자 이름”을 언급했고, 이번 요청에서 `creator_nickname` 필드명을 지정했다.
6. 제약/Non-goals: `/rpv` 스킬을 명시했으므로 구현 전에 research, plan, verification-scenarios 문서를 작성하고 각 단계에서 사용자 승인을 받아야 한다.
7. 사용자의 완료 기준: `GET /v1/courses/community/recent`, `GET /v1/courses/mine`, `GET /v1/courses/favorites`의 `communityCourses` 응답에 생성자 닉네임이 `creator_nickname`으로 포함된다. 공통 타입 영향으로 공식 코스 응답에 `creator_nickname: null`이 포함되는 것은 허용한다.

## Goal
1. 사용자 생성 코스 목록 API가 코스 작성자의 `users.nickname` 값을 `creator_nickname`으로 반환하도록 API 계약과 구현 범위를 확정한다.
2. 적용 범위는 `GET /v1/courses/community/recent`, `GET /v1/courses/mine`, `GET /v1/courses/favorites`의 `communityCourses`다.
3. `CourseListItem` 공통 타입 영향으로 공식 코스 목록 또는 `favorites.officialCourses`에 `creator_nickname: null`이 포함되는 것은 허용한다.

## Current Behavior
1. `GET /v1/courses/community/recent?size=10`는 공개 사용자 생성 코스 중 최근 생성된 코스를 최대 10개 반환한다.
2. 해당 API는 `courses.is_official = 0`, `courses.created_by_user_id IS NOT NULL`, `courses.deleted_at IS NULL` 조건을 사용한다.
3. 현재 응답의 코스 아이템에는 `id`, 제목, 설명, `is_official`, `liked`, `stampProgress`, 썸네일, 시작/종료 장소명만 있다.
4. `creator_nickname`, `creator`, `created_by`, `nickname` 같은 생성자 표시 필드는 현재 코스 목록 응답 타입과 mapper에 없다.
5. `GET /v1/courses/mine`도 사용자 생성 코스 목록을 반환하지만, 현재는 작성자 본인 기준 목록이므로 생성자 이름이 응답에 없다.
6. `GET /v1/courses/favorites`는 좋아요한 코스를 `officialCourses`와 `communityCourses`로 나누며, `communityCourses`도 같은 `CourseListItem` 구조를 사용한다.

## Relevant Surfaces
1. API 라우트: `GET /v1/courses/community/recent?size=10`.
2. 인접 API 라우트: `GET /v1/courses/mine?page=1&size=20`, `GET /v1/courses/favorites`, `GET /v1/courses/recommended?page=1&size=20`.
3. API 계약 문서: `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`.
4. DB 문서: `/Users/donggyunyang/code/steelart/STEELART_DB_TABLES.md`.
5. 라우터/핸들러: `src/lambdas/courses/handler.ts`.
6. 도메인 서비스: `src/domains/courses/service.ts`.
7. 도메인 타입: `src/domains/courses/types.ts`.
8. 응답 mapper: `src/domains/courses/mapper.ts`.
9. SQL repository: `src/domains/courses/repository.ts`.
10. 단위 테스트: `tests/unit/courses/courses-handler.test.ts`, `tests/unit/courses/courses-mapper.test.ts`, `tests/unit/courses/courses-service.test.ts`.
11. 통합 테스트: `tests/integration/courses/courses-handler.integration.test.ts`.

## Codebase Analysis Method
1. Serena MCP로 확인한 symbols/참조/패턴:
   1. `get_symbols_overview`로 `src/domains/courses/repository.ts`, `src/domains/courses/types.ts`, `src/domains/courses/mapper.ts`의 주요 symbol을 확인했다.
   2. `find_symbol`로 `CourseListItem`, `mapCourseListRow`, `mapCourseListItem`, `buildCourseListPageSql`, `coursesRepository/listRecentCommunityCourses`, `coursesRepository/listMyCourses`, `coursesRepository/listFavoriteCourses`, `coursesRepository/listRecommendedCourses` 본문을 확인했다.
   3. `find_referencing_symbols`로 `CourseListItem`과 `mapCourseListRow` 참조 위치를 확인했다.
   4. `search_for_pattern`으로 `creator_nickname`, `created_by_user_id`, `nickname`, `listRecentCommunityCourses`, `listMyCourses` 패턴을 코스 도메인과 테스트에서 확인했다.
2. Serena MCP로 좁힌 파일/모듈 범위:
   1. `src/domains/courses/types.ts`
   2. `src/domains/courses/mapper.ts`
   3. `src/domains/courses/repository.ts`
   4. `tests/unit/courses/*`
   5. `tests/integration/courses/courses-handler.integration.test.ts`
3. 추가로 사용한 보조 명령:
   1. `rg`로 루트 API 초안, DB 테이블 문서, 앱 화면 스펙에서 코스/닉네임/생성자 관련 문구를 검색했다.
   2. `sed`로 `STEELART_SERVER_API_DRAFT.md`의 코스 API 섹션과 `STEELART_DB_TABLES.md`의 `courses`, `users` 섹션을 확인했다.
   3. `sed`로 `package.json`의 검증 스크립트를 확인했다.
4. Serena MCP를 사용할 수 없었던 항목:
   1. 루트 Markdown 문서는 code symbol이 아니므로 `rg`와 `sed`를 보조로 사용했다.

## Facts
1. `CourseListItem` 타입에는 현재 `creator_nickname` 필드가 없다.
2. `mapCourseListItem`은 `CourseListItem`을 API 응답으로 복사하지만 생성자 관련 필드를 반환하지 않는다.
3. `mapCourseListRow`는 `CourseListBaseRow`와 `CourseListMetaRow`를 합쳐 `CourseListItem`을 만들지만 생성자 관련 값을 매핑하지 않는다.
4. `buildCourseListPageSql`은 `courses c`만 조회하고 `users` 테이블을 조인하지 않는다.
5. `listRecentCommunityCourses`는 별도 SQL을 사용하며, `courses c`만 조회하고 `users` 테이블을 조인하지 않는다.
6. `listMyCourses`와 `listRecommendedCourses`는 `buildCourseListPageSql`을 공유한다.
7. `listFavoriteCourses`는 `course_likes`와 `courses`만 조인하고, 공식/시민 추천 코스를 분리한 뒤 동일한 `mapCourseListRow`를 사용한다.
8. `CourseListItem`은 `CourseListResponse.courses`, `FavoriteCoursesResponse.communityCourses`, `FavoriteCoursesResponse.officialCourses`에 모두 쓰인다.
9. `STEELART_SERVER_API_DRAFT.md`의 `GET /v1/courses/community/recent` 실제 data 타입에는 `creator_nickname`이 없다.
10. `STEELART_SERVER_API_DRAFT.md`의 `GET /v1/courses/mine` 실제 data 타입에도 `creator_nickname`이 없다.
11. `STEELART_SERVER_API_DRAFT.md`의 `GET /v1/courses/favorites`는 `CourseListItem[]`을 재사용한다고 적혀 있다.
12. `STEELART_DB_TABLES.md` 기준 `courses.created_by_user_id`는 `users.id`를 참조하는 nullable FK다.
13. `STEELART_DB_TABLES.md` 기준 `users.nickname`은 nullable varchar이고, 신규 가입 온보딩 전 상태에서 서버가 `nickname=''`로 저장한다.
14. 통합 테스트는 `insertUser(nickname: string)` helper로 사용자를 만들며, 코스 생성 시 `created_by_user_id`를 저장한다.
15. 통합 테스트는 현재 `/v1/courses/community/recent?size=10` 응답에서 공식 코스가 제외되는지 검증하지만 생성자 닉네임은 검증하지 않는다.
16. `package.json`에는 `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:integration:env` 스크립트가 있다.

## Third-Party / Official Docs
1. 이번 변경은 새로운 라이브러리, SDK, 외부 API, 호스팅 서비스 동작에 의존하지 않는다.
2. 기존 프로젝트는 `mysql2` raw SQL과 TypeScript 타입을 사용한다.
3. SQL 조인과 응답 필드 추가만 필요한 변경으로 보이며, 별도 third-party 공식 문서 확인은 현재 필요하지 않다.

## Existing Patterns
1. 코스 목록 API는 repository에서 base row를 조회한 뒤 `hydrateCourseListMetaRows`로 좋아요, 썸네일, 시작/종료 장소, 공식 코스 진행률 메타를 붙인다.
2. 목록 응답은 repository의 `mapCourseListRow`에서 도메인 `CourseListItem`으로 만들고, mapper의 `mapCourseListItem`에서 API 응답 shape으로 다시 복사한다.
3. 공식 코스는 `stampProgress`를 객체로 반환하고, 사용자 생성 코스는 `stampProgress: null`을 반환한다.
4. 공개 시민 추천 코스 최근 목록은 페이지네이션 없이 `size`만 받고 `page: 1`로 응답한다.
5. 사용자 생성 코스는 `is_official = 0`과 `created_by_user_id IS NOT NULL` 기준으로 식별한다.
6. 공식 코스는 작성자 사용자가 없을 수 있으므로 생성자 닉네임을 추가한다면 공식 코스에서는 nullable 처리 또는 필드 제외 정책이 필요하다.

## Unknowns
1. `users.nickname`이 `NULL` 또는 빈 문자열인 경우 응답을 DB 값 그대로 반환할지, `null`로 정규화할지 확정되지 않았다.
2. 루트 API 초안 `STEELART_SERVER_API_DRAFT.md`를 이번 변경과 함께 갱신해야 하는지 확정되지 않았지만, 서버 작업 규칙상 API 계약 변경이면 같이 갱신하는 것이 맞다.

## Risks
1. `CourseListItem`은 여러 목록 API에서 공유되므로 필드를 타입에 단순 추가하면 `recommended`, `mine`, `favorites`, `community/recent` 응답 계약에 동시에 영향을 줄 수 있다. 사용자는 공식 코스 응답에 `creator_nickname: null`이 포함되는 것을 허용했다.
2. `buildCourseListPageSql`에 직접 `users` 조인을 추가하면 공식 추천 코스 목록에도 영향을 줄 수 있다.
3. `users.nickname`이 nullable이고 빈 문자열도 가능하므로 앱 표시에서 빈 작성자명이 나타날 수 있다.
4. inner join을 사용하면 `created_by_user_id`가 존재하지만 사용자 row가 누락된 비정상 데이터가 목록에서 사라질 수 있다. left join을 사용하면 목록 보존은 되지만 `creator_nickname: null`이 생길 수 있다.
5. API 계약 문서를 갱신하지 않으면 앱/서버 간 필드 계약이 어긋날 수 있다.

## Likely Change Points
1. `src/domains/courses/types.ts`
   1. `CourseListItem`에 `creator_nickname` 필드를 추가할 가능성이 높다.
2. `src/domains/courses/repository.ts`
   1. `CourseListBaseRow` 또는 별도 row 타입에 `creator_nickname`을 추가할 가능성이 높다.
   2. `GET /v1/courses/community/recent`, `GET /v1/courses/mine`, `GET /v1/courses/favorites`의 `communityCourses`에 대응되는 사용자 생성 코스 조회 SQL에서 `users`를 조인해 `u.nickname AS creator_nickname`을 조회할 가능성이 높다.
   3. 공식 코스 응답에는 `creator_nickname: null`을 반환하는 방식이 가능하다.
   4. `mapCourseListRow`에서 `creator_nickname`을 응답 객체에 매핑할 가능성이 높다.
3. `src/domains/courses/mapper.ts`
   1. `mapCourseListItem`에서 `creator_nickname`을 응답에 포함할 가능성이 높다.
4. `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
   1. 적용 대상 API의 실제 `data` 타입에 `creator_nickname`을 추가할 가능성이 높다.
5. `tests/unit/courses/courses-mapper.test.ts`
   1. mapper가 새 필드를 보존하는지 검증할 가능성이 높다.
6. `tests/unit/courses/courses-handler.test.ts`
   1. 핸들러 응답 fixture에 `creator_nickname`을 추가할 가능성이 높다.
7. `tests/integration/courses/courses-handler.integration.test.ts`
   1. `/v1/courses/community/recent`가 작성자 닉네임을 반환하는지 검증할 가능성이 높다.

## Review Questions
1. 현재 research 단계에서 plan 작성을 막는 미답변 질문은 없다.
