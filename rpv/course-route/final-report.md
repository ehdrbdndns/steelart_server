# Final Report — POST /v1/courses/route (코스 동선 경로 조회)

## 변경 사항
인증된 사용자가 순서가 있는 작품 목록(`items: {artwork_id, seq}[]`)을 보내면, 서버가 DB 좌표(`places.lat/lng` 단일 소스)를 seq 순서로 모아 카카오모빌리티 다중 경유지 자동차 길찾기로 경로를 계산하고 공통 envelope로 `{ vertexes: {lat,lng}[] }`를 반환하는 `POST /v1/courses/route`(Bearer 보호)를 신설했다.

핵심 동작:
1. `artwork_id`로 DB 좌표 조회(앱이 보낸 좌표는 무시, DB 단일 소스). 좌표 없는(활성 place 조인 실패) 작품은 조용히 제외.
2. seq 오름차순 정렬 후 연속 동일 좌표는 1개로 압축(같은 장소 인접 작품의 카카오 실패 예방).
3. 유효 좌표 2개 미만 → `422 ROUTE_UNAVAILABLE`.
4. 카카오 호출(`priority=RECOMMEND`) → `routes[0].sections[].roads[].vertexes`(flat `[lng,lat,...]`)를 `{lat,lng}[]`로 변환해 그릴 순서대로 반환.
5. 카카오 키 미설정/네트워크 실패/`!ok`/JSON 파싱 실패/`result_code≠0`/빈 vertexes → `502 ROUTE_UNAVAILABLE`.
6. 입력 위반(items<2, seq 비연속, artwork_id 중복) → `400 BAD_REQUEST`, items>30 → `400 TOO_MANY_WAYPOINTS`.
7. 캐시는 v1에서 두지 않음(서버리스 in-memory 실효 미미, 계약상 미구현도 준수). 경로 좌표 영구 저장 없음.
8. 카카오 REST 키는 서버 전용 env `KAKAO_MOBILITY_REST_API_KEY`(앱 미노출).

## 변경한 파일/모듈
신규:
1. `src/domains/courses/route-provider.ts` — 카카오 모빌리티 호출/응답 파싱 프로바이더(전역 `fetch`, 실패→502).
2. `tests/unit/courses/courses-route-provider.test.ts` — provider 유닛 테스트(fetch mock).
3. `rpv/course-route/` — research/plan/verification-scenarios/final-report.

수정:
1. `src/shared/api/errors.ts` — `ROUTE_UNAVAILABLE`(기본 502), `TOO_MANY_WAYPOINTS`(400) 코드 + 상태/메시지 매핑.
2. `src/domains/courses/types.ts` — route 입출력·좌표·provider 타입 + `COURSE_ROUTE_MIN_ITEMS`/`COURSE_ROUTE_MAX_WAYPOINTS`.
3. `src/domains/courses/schemas.ts` — `courseRouteBodySchema`(items min 2, strict).
4. `src/domains/courses/repository.ts` — `listArtworkCoordinates`(artworks→artists→places INNER JOIN, `CAST(... AS DOUBLE)`).
5. `src/domains/courses/service.ts` — `getCourseRoute`, optional `courseRouteProvider` 의존성, `assertContiguousItems`에 optional `code` 인자.
6. `src/domains/courses/mapper.ts` — `mapCourseRouteResponse`.
7. `src/lambdas/courses/handler.ts` — `/v1/courses/route` POST 분기 + provider 배선.
8. `src/shared/env/server.ts` — `KAKAO_MOBILITY_REST_API_KEY` optional.
9. `template.yaml` — `KakaoMobilityRestApiKey` Parameter(NoEcho) + CoursesFunction env 주입(전용) + `/v1/courses/route` 라우트 이벤트.
10. `.github/workflows/deploy.yml` — 배포 step에 `KAKAO_MOBILITY_REST_API_KEY` secret 전달 + `KakaoMobilityRestApiKey` 파라미터.
11. `.env.example` — `KAKAO_MOBILITY_REST_API_KEY=` placeholder.
12. `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md` — 7-12 구현 상태 `구현 완료`.
13. 테스트: `tests/unit/courses/courses-schemas.test.ts`, `courses-service.test.ts`, `courses-handler.test.ts`, `tests/integration/courses/courses-handler.integration.test.ts`(route 통합 2건 + `createEvent` 헬퍼에 `/v1/courses/route` 정적 라우트 보정).

## 검증 결과
verification-scenarios.md 10개 시나리오 전부 **Passed**.
1. Scenario 1(happy), 2(입력위반 400), 3(좌표부족 422), 4(카카오실패 502), 5(부분경로 200), 6(좌표압축), 7(좌표변환), 8(인증 401), 10(회귀) → 유닛/정적 검증 통과.
2. Scenario 9(통합) → 통합 DB 가용으로 Required 충족, route 통합 2건 통과(Blocked 아님).

## Browser/Device/Auth State
해당 없음(백엔드 HTTP API, 브라우저/네이티브 UI 표면 없음 → headed Playwright/Maestro 적용 불가). 인증은 `signAccessToken`로 생성한 Bearer 토큰을 인프로세스 핸들러 호출에 사용. 통합은 시드 유저 + `.env.integration`의 disposable 통합 DB. 카카오는 항상 mock.

## Automated Checks
1. `pnpm typecheck` → 통과(0 에러).
2. `pnpm test` → 136 pass / 0 fail.
3. `node --env-file=.env.integration --import tsx --test --test-concurrency=1 tests/integration/courses/courses-handler.integration.test.ts` → 21 pass / 0 fail.
4. `pnpm sam:validate` + `sam validate --lint` → valid SAM Template.

## Hotfixes
없음. 검증 중 발견된 1건의 테스트 실패(provider "키 미설정" 케이스의 기본 파라미터값 트리거 버그)는 plan 범위 내 테스트 헬퍼 수정으로 해결했고 production 코드 영향이 없어 hotfix 문서 대상이 아니었다.

## RPV Skill 개선 추천안
1. 추천 사항: research 단계 체크리스트에 "비밀/키 주입 경로(배포 워크플로·SAM 파라미터·Secrets 위치) 확인"을 명시.
   - 이유: 키 발급처/보관 위치/env 로딩 구조(`.env` 미사용, 통합은 `INTEGRATION_*`만 매핑, 배포는 GitHub Secrets)를 파악하는 데 사용자와 여러 왕복이 필요했다.
   - 기대 효과: 외부 서비스 키가 필요한 작업에서 초반에 배포/시크릿 표면을 한 번에 정리해 왕복 감소.
   - 반영 우선순위: 중.
   - 다음 작업 전 반영 여부: 선택(다음 외부 연동 작업 전 권장).
2. 추천 사항: plan review gate에서 "research 질문이 모두 해결돼도, 정본에 명시 없는 구현 판단(에러 분기·부분 결과·정규화 등)을 Review Question으로 명시" 단계를 강제.
   - 이유: 사용자의 "질문은 없어?" 한마디로 빈 vertexes/부분경로/좌표압축 같은 결정 3건을 추가로 surface했고, 이는 계약 정확도에 직접 영향이 컸다.
   - 기대 효과: 암묵적 기본값을 사용자 검토로 끌어올려 계약 드리프트 예방.
   - 반영 우선순위: 상.
   - 다음 작업 전 반영 여부: 권장.
3. 추천 사항: verification-scenarios에 "백엔드/비-UI 작업" 프로파일을 정식 분기로 추가(현재 템플릿은 앱/브라우저 중심).
   - 이유: headed Playwright/Maestro 필드를 N/A로 채우는 작업이 반복됐다.
   - 기대 효과: 백엔드 작업에서 불필요한 UI 검증 필드 제거, 자동화 테스트 매핑에 집중.
   - 반영 우선순위: 중.
   - 다음 작업 전 반영 여부: 선택.

## 남은 위험
1. **실제 카카오 실호출 미검증**: 모든 테스트가 mock. 실제 REST 키·네트워크 동작(요청 본문 수용성, `result_code` 분포)은 배포 후 수동 스모크로 확인 필요. (사용자가 GitHub Secret `KAKAO_MOBILITY_REST_API_KEY` 등록 완료.)
2. **무료 쿼터/약관**: 다중 경유지 무료 쿼터 정확 수치 미확정(ADR "5,000/일"). 길찾기 제품 별도 활성화/사업자 인증 필요 여부 미확정 → 운영 전 확인 권장.
3. **카카오 IP 화이트리스트**: Lambda 동적 아웃바운드 IP라 콘솔 "허용 IP 주소"는 비워야 함(설정 시 502 유발). 향후 IP 제한이 필요하면 Lambda VPC+NAT+EIP 전환 별도 과제.
4. **`deploy.yml` 동시 수정**: 현재 브랜치(`codex/deploy-concurrency-fix`)에서 이 파일이 함께 수정 중 → 머지 시 충돌 점검 필요.
5. **캐시 미구현**: 추천/공식 코스가 다수 사용자에게 동일 순서로 자주 호출되면 카카오 호출량↑. 실측 문제화 시 DynamoDB(TTL) 공유 캐시 후속 도입(설계상 정렬 artwork_id 키로 삽입 가능).
