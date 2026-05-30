# Verification Scenarios

## Verification Environment
1. 검증 도구:
   1. TypeScript typecheck
   2. Node test runner via `pnpm test`
   3. 통합 DB 환경이 준비된 경우 `pnpm test:integration:env`
2. 실행 환경: 로컬 `steelart_server` workspace.
3. 대상 플랫폼: Backend API / AWS Lambda handler code.
4. 앱 검증인 경우 선택한 플랫폼: N/A.
5. 앱 검증인 경우 simulator/device name / OS version / app build: N/A.
6. 앱 검증인 경우 Maestro flow 파일 또는 실행 방법: N/A.
7. 인증/계정 상태:
   1. unit test는 mocked/stubbed authenticated request.
   2. integration test는 테스트용 JWT와 integration DB seed.
8. 저장된 browser/auth state 또는 fresh session 사용 여부: N/A.
9. 외부 서비스, mock/stub, secret/env 의존성:
   1. unit test는 외부 서비스 의존성이 없다.
   2. integration test는 `.env.integration`과 실제 MySQL integration DB가 필요하다.
10. 현재 환경에서 검증할 수 없는 항목과 이유:
   1. integration DB 접속 정보가 없거나 DB가 실행 중이 아니면 `pnpm test:integration:env`는 Blocked로 기록한다.

## User-Requested Scenarios
1. 사용자가 별도 검증 시나리오를 제공하지 않았다.

## AI-Proposed Scenarios
1. `GET /v1/courses/community/recent?size=10` 응답의 사용자 생성 코스가 `creator_nickname`을 포함한다.
2. `GET /v1/courses/mine?page=1&size=20` 응답의 내 코스가 `creator_nickname`을 포함한다.
3. `GET /v1/courses/favorites` 응답에서 `communityCourses`는 작성자 닉네임을 포함하고 `officialCourses`는 `creator_nickname: null`을 포함한다.
4. `GET /v1/courses/recommended?page=1&size=20` 공식 코스 목록은 기존 데이터와 진행률을 유지하면서 `creator_nickname: null`을 포함한다.
5. 기존 코스 상세, 삭제 후 목록 제외, 공식 코스 제외 조건 등 인접 동작이 깨지지 않는다.

## Manual Verification Method
1. 이번 작업은 브라우저 표면이나 React Native 앱 UI가 아니라 backend API 응답 shape 변경이다.
2. 사용자-facing 브라우저 동작이 없으므로 headed Playwright 수동 검증은 적용하지 않는다.
3. React Native/native flow 변경이 없으므로 Maestro 검증은 적용하지 않는다.
4. 수동 검증은 API handler/integration test 결과와 응답 JSON assertion으로 대체한다.
5. 실제 앱에서 표시되는지 여부는 이번 서버 변경 범위 밖이며, 앱 작업에서 별도 검증해야 한다.

## Scenario Details

### Scenario 1: 최근 시민 추천 코스에 작성자 닉네임 포함
1. Source: AI-proposed
2. Priority: Required
3. Platform coverage: N/A
4. Start state: integration DB에 여러 사용자 생성 코스와 공식 코스가 seed되어 있다.
5. Browser/auth state 또는 simulator/device/auth state: 테스트 JWT 사용.
6. Viewport 또는 simulator/device: N/A.
7. Maestro flow 또는 headed Playwright 방법: N/A.
8. 사용한 selector/testID: N/A.
9. 좌표 기반 제스처 사용 여부와 이유: 사용하지 않음.
10. Steps:
    1. `GET /v1/courses/community/recent?size=10` handler/integration test를 실행한다.
    2. 응답의 `courses[]`를 확인한다.
11. Expected result:
    1. 모든 반환 코스는 `is_official: false`다.
    2. 각 코스에는 `creator_nickname` 필드가 있다.
    3. seed 작성자의 nickname과 `creator_nickname` 값이 일치한다.
    4. 삭제된 코스와 공식 코스는 포함되지 않는다.
12. Observable evidence:
    1. integration assertion pass.
13. Console/network checks:
    1. 테스트 실패 없이 종료.
14. Refresh/back-navigation checks: N/A.
15. Pass/fail criteria:
    1. `creator_nickname` assertion과 기존 목록 조건 assertion이 모두 통과하면 Passed.
16. Status: Passed
17. Failure observed: RED 단계에서 production 구현 전 `creator_nickname`이 `undefined`로 실패하는 것을 확인했다.
18. Fix attempted: `CourseListItem`, mapper, repository SQL에 `creator_nickname` 조회/매핑을 추가했다.
19. Re-check result: `pnpm test`와 `pnpm test:integration:env` 통과.

### Scenario 2: 내 코스 목록에 작성자 닉네임 포함
1. Source: AI-proposed
2. Priority: Required
3. Platform coverage: N/A
4. Start state: integration DB에 인증 사용자 소유의 사용자 생성 코스가 있다.
5. Browser/auth state 또는 simulator/device/auth state: 테스트 JWT 사용.
6. Viewport 또는 simulator/device: N/A.
7. Maestro flow 또는 headed Playwright 방법: N/A.
8. 사용한 selector/testID: N/A.
9. 좌표 기반 제스처 사용 여부와 이유: 사용하지 않음.
10. Steps:
    1. `GET /v1/courses/mine?page=1&size=20` handler/integration test를 실행한다.
    2. 응답의 첫 코스를 확인한다.
11. Expected result:
    1. 응답 코스는 인증 사용자가 작성한 사용자 생성 코스만 포함한다.
    2. 응답 코스에는 `creator_nickname` 필드가 있다.
    3. 값은 인증 사용자의 nickname과 일치한다.
12. Observable evidence:
    1. integration assertion pass.
13. Console/network checks:
    1. 테스트 실패 없이 종료.
14. Refresh/back-navigation checks: N/A.
15. Pass/fail criteria:
    1. 기존 작성자 기준 필터와 `creator_nickname` assertion이 모두 통과하면 Passed.
16. Status: Passed
17. Failure observed: RED 단계에서 production 구현 전 `creator_nickname`이 `undefined`로 실패하는 것을 확인했다.
18. Fix attempted: 내 코스 목록 SQL에서 `users`를 `LEFT JOIN`하고 `creator.nickname AS creator_nickname`을 반환했다.
19. Re-check result: `pnpm test`와 `pnpm test:integration:env` 통과.

### Scenario 3: 즐겨찾기 목록에서 공식/시민 추천 코스 닉네임 정책 유지
1. Source: AI-proposed
2. Priority: Required
3. Platform coverage: N/A
4. Start state: integration DB에 인증 사용자가 좋아요한 공식 코스와 사용자 생성 코스가 있다.
5. Browser/auth state 또는 simulator/device/auth state: 테스트 JWT 사용.
6. Viewport 또는 simulator/device: N/A.
7. Maestro flow 또는 headed Playwright 방법: N/A.
8. 사용한 selector/testID: N/A.
9. 좌표 기반 제스처 사용 여부와 이유: 사용하지 않음.
10. Steps:
    1. `GET /v1/courses/favorites` handler/integration test를 실행한다.
    2. `officialCourses[0]`와 `communityCourses[0]`를 확인한다.
11. Expected result:
    1. `officialCourses[0].creator_nickname === null`.
    2. `communityCourses[0].creator_nickname`은 해당 코스 작성자의 nickname과 일치한다.
    3. 기존 liked 값과 공식 코스 stampProgress 값은 유지된다.
12. Observable evidence:
    1. integration assertion pass.
13. Console/network checks:
    1. 테스트 실패 없이 종료.
14. Refresh/back-navigation checks: N/A.
15. Pass/fail criteria:
    1. 공식/사용자 생성 코스 분리, liked, stampProgress, creator nickname assertion이 모두 통과하면 Passed.
16. Status: Passed
17. Failure observed: production 구현 전 즐겨찾기 목록의 `creator_nickname` 반환이 없었다.
18. Fix attempted: 즐겨찾기 목록 SQL에서 사용자 생성 코스는 작성자 nickname, 공식 코스는 `NULL`을 반환하도록 추가했다.
19. Re-check result: `pnpm test`와 `pnpm test:integration:env` 통과.

### Scenario 4: mapper와 handler 단위 응답 shape 유지
1. Source: AI-proposed
2. Priority: Required
3. Platform coverage: N/A
4. Start state: unit test fixture에 공식/사용자 생성 코스 목록 데이터가 있다.
5. Browser/auth state 또는 simulator/device/auth state: N/A.
6. Viewport 또는 simulator/device: N/A.
7. Maestro flow 또는 headed Playwright 방법: N/A.
8. 사용한 selector/testID: N/A.
9. 좌표 기반 제스처 사용 여부와 이유: 사용하지 않음.
10. Steps:
    1. `pnpm test`를 실행한다.
    2. 코스 mapper/handler unit test 결과를 확인한다.
11. Expected result:
    1. mapper가 `creator_nickname`을 누락하지 않는다.
    2. handler 응답 JSON에 `creator_nickname`이 포함된다.
    3. 기존 `stamped` 미포함 assertion은 계속 통과한다.
12. Observable evidence:
    1. unit test pass.
13. Console/network checks:
    1. 테스트 실패 없이 종료.
14. Refresh/back-navigation checks: N/A.
15. Pass/fail criteria:
    1. 전체 unit test가 통과하면 Passed.
16. Status: Passed
17. Failure observed: RED 단계에서 mapper가 `creator_nickname`을 복사하지 않아 mapper unit test가 실패했다.
18. Fix attempted: `mapCourseListItem`이 `creator_nickname`을 명시적으로 복사하도록 수정했다.
19. Re-check result: `pnpm exec tsx --test tests/unit/courses/courses-mapper.test.ts tests/unit/courses/courses-handler.test.ts`와 `pnpm test` 통과.

### Scenario 5: 타입 안정성과 기존 공식 코스 목록 회귀 확인
1. Source: AI-proposed
2. Priority: Required
3. Platform coverage: N/A
4. Start state: 코드 변경 완료.
5. Browser/auth state 또는 simulator/device/auth state: N/A.
6. Viewport 또는 simulator/device: N/A.
7. Maestro flow 또는 headed Playwright 방법: N/A.
8. 사용한 selector/testID: N/A.
9. 좌표 기반 제스처 사용 여부와 이유: 사용하지 않음.
10. Steps:
    1. `pnpm typecheck`를 실행한다.
    2. `GET /v1/courses/recommended` 관련 unit/integration assertion이 기존대로 통과하는지 확인한다.
11. Expected result:
    1. TypeScript compile error가 없다.
    2. 공식 추천 코스 목록은 `creator_nickname: null`을 포함한다.
    3. 공식 추천 코스의 `stampProgress`와 `liked` 값은 기존 동작을 유지한다.
12. Observable evidence:
    1. typecheck pass.
    2. test pass.
13. Console/network checks:
    1. typecheck/test 실패 없이 종료.
14. Refresh/back-navigation checks: N/A.
15. Pass/fail criteria:
    1. typecheck와 관련 tests가 모두 통과하면 Passed.
16. Status: Passed
17. Failure observed: 없음.
18. Fix attempted: 공식 코스 목록 helper는 `NULL AS creator_nickname`을 반환하도록 구현했다.
19. Re-check result: `pnpm typecheck`, `pnpm test`, `pnpm test:integration:env` 통과.

## Excluded Scenarios
1. 앱 UI에서 작성자 닉네임이 실제로 표시되는지 확인하지 않는다. 이번 작업은 서버 응답 필드 추가이며 앱 표시 변경은 별도 작업이다.
2. 코스 상세 API에 `creator_nickname`이 포함되는지 확인하지 않는다. 이번 scope의 Non-Goals에 해당한다.
3. DB migration 검증은 하지 않는다. schema 변경이 없다.
4. 실제 AWS 배포 검증은 하지 않는다. 로컬 코드와 테스트 검증 범위다.

## Review Questions
1. 현재 구현 시작을 막는 미답변 질문은 없다.
