# Final Report

## 변경 사항
1. 코스 목록 응답에 `creator_nickname` 필드를 추가했다.
2. 사용자 생성 코스는 `courses.created_by_user_id`로 `users`를 조회해 작성자 `nickname`을 반환한다.
3. 공식 코스는 공통 응답 shape 유지를 위해 `creator_nickname: null`을 반환한다.
4. `GET /v1/courses/community/recent`, `GET /v1/courses/mine`, `GET /v1/courses/favorites`의 `communityCourses`에 작성자 닉네임이 포함되도록 했다.
5. `GET /v1/courses/recommended`와 `favorites.officialCourses`에는 `creator_nickname: null`이 포함된다.

## 변경한 파일/모듈
1. `src/domains/courses/types.ts`
2. `src/domains/courses/mapper.ts`
3. `src/domains/courses/repository.ts`
4. `tests/unit/courses/courses-mapper.test.ts`
5. `tests/unit/courses/courses-handler.test.ts`
6. `tests/integration/courses/courses-handler.integration.test.ts`
7. `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
8. `rpv/course-creator-nickname/research.md`
9. `rpv/course-creator-nickname/plan.md`
10. `rpv/course-creator-nickname/verification-scenarios.md`

## 검증 결과
1. Scenario 1: 최근 시민 추천 코스에 작성자 닉네임 포함
   1. Status: Passed
   2. Evidence: `pnpm test:integration:env`
2. Scenario 2: 내 코스 목록에 작성자 닉네임 포함
   1. Status: Passed
   2. Evidence: `pnpm test:integration:env`
3. Scenario 3: 즐겨찾기 목록에서 공식/시민 추천 코스 닉네임 정책 유지
   1. Status: Passed
   2. Evidence: `pnpm test:integration:env`
4. Scenario 4: mapper와 handler 단위 응답 shape 유지
   1. Status: Passed
   2. Evidence: `pnpm exec tsx --test tests/unit/courses/courses-mapper.test.ts tests/unit/courses/courses-handler.test.ts`, `pnpm test`
5. Scenario 5: 타입 안정성과 기존 공식 코스 목록 회귀 확인
   1. Status: Passed
   2. Evidence: `pnpm typecheck`, `pnpm test`, `pnpm test:integration:env`

## Browser/Device/Auth State
1. Browser state: N/A
2. Device/simulator state: N/A
3. Auth state: unit test는 stubbed authenticated request, integration test는 테스트 JWT 사용.
4. Fresh session 여부: N/A

## Automated Checks
1. `pnpm exec tsx --test tests/unit/courses/courses-mapper.test.ts tests/unit/courses/courses-handler.test.ts`
   1. Result: Passed, 12/12 tests.
2. `pnpm typecheck`
   1. Result: Passed.
3. `pnpm test`
   1. Result: Passed, 115/115 tests.
4. `pnpm test:integration:env`
   1. Result: Passed, 48/48 tests.

## Hotfixes
1. 없음.

## RPV Skill 개선 추천안
1. 추천 사항: backend-only API 변경에서는 headed Playwright와 Maestro가 적용 불가한 경우를 위한 간단한 API 검증 템플릿을 별도 섹션으로 제공하면 좋다.
2. 이유: 현재 템플릿은 UI/manual verification 설명이 길어서 서버 API 응답 shape 변경에는 N/A 항목이 많다.
3. 기대 효과: backend 작업의 verification-scenarios 문서가 더 짧고 검토하기 쉬워진다.
4. 반영 우선순위: 낮음.
5. 다음 작업 전에 반영할지 여부: 필수는 아니다.

## 남은 위험
1. `users.nickname`이 빈 문자열이면 `creator_nickname`도 빈 문자열로 반환된다. 이번 작업에서는 DB 값을 그대로 전달하는 것으로 확정했다.
2. 앱 화면에서 이 값을 실제로 표시하는 작업은 이번 범위에 포함하지 않았다.
