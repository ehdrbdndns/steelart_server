# Verification Scenarios — POST /v1/courses/route

## Verification Environment
1. 검증 도구: `node:test`(tsx) 유닛/통합 테스트, `pnpm typecheck`(tsc --noEmit), `pnpm sam:validate`(SAM 템플릿). 카카오는 전역 `fetch` 스텁 또는 `courseRouteProvider` 스텁으로 mock.
2. 실행 환경: 로컬 macOS, Node 24, pnpm. 핸들러를 `handleCoursesRequest(event, ctx, service)`로 직접 호출(인프로세스).
3. 대상 플랫폼: 백엔드 HTTP API(AWS Lambda). 브라우저/네이티브 UI 없음.
4. 앱 검증인 경우 선택한 플랫폼: N/A (사용자-facing 브라우저·React Native 표면 없음).
5. 앱 검증인 경우 simulator/device / OS / build: N/A.
6. 앱 검증인 경우 Maestro flow: N/A.
7. 인증/계정 상태: 유닛/핸들러 테스트는 `signAccessToken(userId, { secret })`로 Bearer 토큰 생성. 통합 테스트는 시드 유저.
8. 저장된 browser/auth state: N/A. 유닛은 매 테스트 `applyServerTestEnv()`로 `process.env` 세팅 + `resetEnvForTests()`.
9. 외부 서비스/mock/secret: 카카오 모빌리티는 **항상 mock**(전역 `fetch` 스텁 또는 provider 스텁). 실제 REST 키·네트워크 불필요. `KAKAO_MOBILITY_REST_API_KEY`는 provider 단위 테스트에서만 `process.env`로 임의값 주입/삭제.
10. 현재 환경에서 검증할 수 없는 항목과 이유:
    1. **실제 카카오 호출**(실 키·네트워크 의존) → mock으로 대체, 실호출은 배포 후 수동 스모크로 분리(`Excluded Scenarios`).
    2. **통합 테스트(실 DB)** → 통합 DB가 가용할 때만 Required. 불가 시 해당 시나리오는 `Blocked`로 기록하고 유닛+provider 테스트로 동등 분기를 커버.

## User-Requested Scenarios
없음(사용자: "따로 없어"). 아래 AI-Proposed가 전체 검증 세트.

## AI-Proposed Scenarios
research/plan의 성공·입력위반·좌표부족·카카오실패·부분경로·좌표압축·인증·좌표변환 분기 + 기존 courses/errors/env/SAM 회귀를 커버한다.

## Manual Verification Method
이 작업은 백엔드 HTTP API이며 **사용자-facing 브라우저 동작이 없어 headed Playwright 검증은 적용 불가**하다. React Native/native flow 대상도 아니므로 Maestro도 적용 불가. 따라서 1차 검증은 인프로세스 핸들러 호출 기반 자동화 테스트(`node:test`)와 정적 검증(`typecheck`, `sam validate`)으로 수행한다. 별도 일회성 스크립트가 아니라 레포 테스트 스위트에 케이스를 추가해 재현 가능하게 둔다. 실제 카카오 실호출은 배포 후 수동 스모크로 분리한다.

## App Scenario Design Rules
해당 없음(앱/네이티브 검증 아님). 백엔드 시나리오는 "요청 입력 상태 → 핸들러/서비스 동작 → 응답 envelope·상태코드·error.code" 기준으로 작성한다.

## Scenario Details

### Scenario 1: 유효한 코스로 경로 성공 반환 (happy path)
1. Metadata:
   1. User goal: 순서가 있는 작품들로 카카오 경로 좌표를 받는다.
   2. Coverage type: Happy path
   3. Source: AI-proposed
   4. Priority: Required
   5. Platform coverage: Web(N/A UI) — 백엔드 API
   6. Status: Passed
2. Environment:
   1. Start state: 작품 2개 이상이 활성 place 좌표를 가짐(stub repo가 좌표 반환).
   2. Account/auth state: 유효 Bearer 토큰.
   3. Network/mock state: provider 스텁이 정해진 `vertexes`(예: `[{lat:36.01,lng:129.11},{lat:36.02,lng:129.12}]`) 반환.
   4. 검증 방법: `courses-service.test.ts`(서비스) + `courses-handler.test.ts`(핸들러) 케이스.
3. Selector Strategy: N/A(백엔드). 검증은 반환 객체/JSON 단언.
4. Steps:
   1. `getCourseRoute({ items:[{artwork_id:11,seq:1},{artwork_id:22,seq:2},{artwork_id:33,seq:3}] })` 호출(provider/repo 스텁).
   2. 핸들러: `POST /v1/courses/route`(Bearer) 이벤트로 `handleCoursesRequest` 호출(service 스텁).
5. Expected Result:
   1. 서비스: provider가 받은 좌표가 seq 순서이고, 반환이 `{ vertexes:[...] }`.
   2. 핸들러: `statusCode===200`, body `{ data:{ vertexes:[...] }, error:null, meta:{requestId} }`.
   3. Pass/fail: vertexes가 provider 반환과 동일 순서/값.
6. Result:
   1. Failure observed:
   2. Fix attempted:
   3. Re-check result:

### Scenario 2: 입력-형식 위반은 400 (BAD_REQUEST / TOO_MANY_WAYPOINTS)
1. Metadata:
   1. User goal: 잘못된 요청은 명확한 400으로 거부.
   2. Coverage type: Edge
   3. Source: AI-proposed
   4. Priority: Required
   5. Platform coverage: 백엔드 API
   6. Status: Passed
2. Environment:
   1. Start state: 다양한 잘못된 items.
   2. Auth: 유효 Bearer.
   3. 검증 방법: `courses-schemas.test.ts`(스키마) + `courses-service.test.ts`(서비스) + 핸들러 패스스루.
3. Selector Strategy: N/A.
4. Steps:
   1. items 1개 → 스키마 min(2) 위반.
   2. items 31개 → 서비스 30-cap.
   3. seq `[1,3]`(비연속) / 같은 artwork_id 중복.
5. Expected Result:
   1. items<2/형식위반 → `AppError code='BAD_REQUEST'`, 핸들러 `statusCode===400`.
   2. items>30 → `code='TOO_MANY_WAYPOINTS'`, `statusCode===400`. (30-cap이 contiguity보다 먼저: 31개+비연속도 TOO_MANY_WAYPOINTS)
   3. 비연속/중복 → `code='BAD_REQUEST'`, `statusCode===400`.
   4. Console/network: 카카오 호출·DB 좌표 조회가 호출되지 않음(스텁 호출 카운트 0).
   5. Pass/fail: 각 케이스 code·statusCode 일치 + 좌표조회/provider 미호출.
6. Result:
   1. Failure observed:
   2. Fix attempted:
   3. Re-check result:

### Scenario 3: 유효 좌표 2개 미만이면 422 ROUTE_UNAVAILABLE
1. Metadata:
   1. User goal: 경로를 그릴 좌표가 부족하면 422로 앱 폴백 유도.
   2. Coverage type: Edge
   3. Source: AI-proposed
   4. Priority: Required
   5. Platform coverage: 백엔드 API
   6. Status: Passed
2. Environment:
   1. Start state: items 2~3개지만 repo가 유효 좌표 0~1개만 반환(나머지 작품 누락/좌표 없음).
   2. Auth: 유효 Bearer.
   3. 검증 방법: `courses-service.test.ts`(repo 스텁이 1개만 반환).
3. Selector Strategy: N/A.
4. Steps:
   1. items 3개, repo `listArtworkCoordinates`가 1개 좌표만 반환.
   2. `getCourseRoute` 호출.
5. Expected Result:
   1. `AppError code='ROUTE_UNAVAILABLE'`, `statusCode===422`.
   2. provider(`fetchRoute`) 미호출(좌표 부족이므로 카카오 호출 전 차단).
   3. Pass/fail: code='ROUTE_UNAVAILABLE' && statusCode===422 && provider 호출 0.
6. Result:
   1. Failure observed:
   2. Fix attempted:
   3. Re-check result:

### Scenario 4: 카카오 호출/산출 실패는 502 ROUTE_UNAVAILABLE
1. Metadata:
   1. User goal: 업스트림 실패 시 502로 앱 폴백 유도.
   2. Coverage type: Edge
   3. Source: AI-proposed
   4. Priority: Required
   5. Platform coverage: 백엔드 API
   6. Status: Passed
2. Environment:
   1. Start state: 유효 좌표 ≥2.
   2. Network/mock: provider 단위 테스트에서 전역 `fetch` 스텁으로 실패 케이스 모사. `process.env.KAKAO_MOBILITY_REST_API_KEY` 제어 + `resetEnvForTests()`.
   3. 검증 방법: 신규 `courses-route-provider.test.ts` + 서비스 레벨(provider 스텁이 502 throw).
3. Selector Strategy: N/A.
4. Steps:
   1. fetch가 throw(네트워크 실패).
   2. `response.ok===false`(예: 401/500).
   3. `response.json()` 파싱 실패.
   4. `routes[0].result_code !== 0`.
   5. (Q1) `result_code===0`이나 `sections[].roads[].vertexes` 비어 vertexes 0개.
   6. (Q3a) `KAKAO_MOBILITY_REST_API_KEY` 미설정.
5. Expected Result:
   1. 모든 케이스 `AppError code='ROUTE_UNAVAILABLE'`, `statusCode===502`.
   2. details에 upstreamStatus 또는 resultCode가 기록되는 케이스 확인.
   3. Pass/fail: 6개 하위 케이스 모두 502 ROUTE_UNAVAILABLE.
6. Result:
   1. Failure observed:
   2. Fix attempted:
   3. Re-check result:

### Scenario 5: 일부 작품 누락이어도 유효 ≥2면 부분 경로 200 (Q2)
1. Metadata:
   1. User goal: 일부 좌표 없는 작품이 있어도 가능한 경로를 반환.
   2. Coverage type: Edge
   3. Source: AI-proposed
   4. Priority: Required
   5. Platform coverage: 백엔드 API
   6. Status: Passed
2. Environment:
   1. Start state: items 3개, repo가 그중 2개만 좌표 반환(1개는 없는/좌표없는 작품).
   2. Auth: 유효 Bearer.
   3. 검증 방법: `courses-service.test.ts`.
3. Selector Strategy: N/A.
4. Steps:
   1. items `[11,22,33]`(seq 1,2,3), repo가 11·33만 좌표 반환(22 누락).
   2. `getCourseRoute` 호출, provider 스텁이 받은 좌표 개수를 기록.
5. Expected Result:
   1. `statusCode 없음`(throw 없음) → 200 성공.
   2. provider가 받은 좌표는 seq 순서의 유효 2개(11,33)뿐(22 제외).
   3. 응답은 `{vertexes}`만 — droppedArtworkIds 미포함(계약 준수).
   4. Pass/fail: provider 입력 좌표 길이===2 && 응답에 vertexes 존재.
6. Result:
   1. Failure observed:
   2. Fix attempted:
   3. Re-check result:

### Scenario 6: 연속 동일 좌표는 압축 후 호출 (Q3)
1. Metadata:
   1. User goal: 같은 장소 인접 작품으로 인한 불필요한 카카오 실패 방지.
   2. Coverage type: Edge
   3. Source: AI-proposed
   4. Priority: Required
   5. Platform coverage: 백엔드 API
   6. Status: Passed
2. Environment:
   1. Start state: 인접 작품 2개가 동일 lat/lng(같은 place).
   2. 검증 방법: `courses-service.test.ts`.
3. Selector Strategy: N/A.
4. Steps:
   1. items `[11,22,33]`, repo가 11·22를 동일 좌표, 33을 다른 좌표로 반환.
   2. `getCourseRoute` 호출, provider 스텁이 받은 좌표 기록.
   3. (역케이스) 11·22가 동일 좌표뿐이고 33 누락 → 압축 후 1개 → 422.
5. Expected Result:
   1. provider가 받은 좌표는 연속 중복이 1개로 압축된 2개(동일좌표 1 + 33).
   2. 역케이스: 압축 후 1개 → `ROUTE_UNAVAILABLE` 422.
   3. 비연속 동일(A-B-A)은 보존됨(별도 단언 가능).
   4. Pass/fail: 압축 동작 + 압축후<2 → 422.
6. Result:
   1. Failure observed:
   2. Fix attempted:
   3. Re-check result:

### Scenario 7: 카카오 vertexes(flat [lng,lat,...]) → {lat,lng}[] 변환 정확성
1. Metadata:
   1. User goal: x/y(경도/위도) 매핑이 뒤집히지 않고 그릴 순서가 유지된다.
   2. Coverage type: Edge
   3. Source: AI-proposed
   4. Priority: Required
   5. Platform coverage: 백엔드 API
   6. Status: Passed
2. Environment:
   1. Network/mock: 전역 `fetch` 스텁이 `routes[0].sections[].roads[].vertexes` 다중 road를 flat 배열로 반환.
   2. 검증 방법: `courses-route-provider.test.ts`.
3. Selector Strategy: N/A.
4. Steps:
   1. 2개 section/road에 걸친 vertexes `[129.11,36.01, 129.12,36.02]`, `[129.13,36.03]`(홀수 길이 방어 포함) 류 모사.
   2. `createKakaoMobilityRouteProvider().fetchRoute([...])` 호출.
5. Expected Result:
   1. 결과가 `[{lat:36.01,lng:129.11},{lat:36.02,lng:129.12},{lat:36.03,lng:129.13}]` 순서로 이어 붙음(road 순서 보존).
   2. y→lat, x→lng 매핑 정확. 홀수 잔여 요소는 버려짐(쌍 단위).
   3. 요청 body가 `origin{x:lng,y:lat}`, `waypoints`, `destination`로 구성되고 헤더 `authorization: KakaoAK <key>` 포함.
   4. Pass/fail: 변환 배열·요청 body·헤더 일치.
6. Result:
   1. Failure observed:
   2. Fix attempted:
   3. Re-check result:

### Scenario 8: Bearer 토큰 없으면 401 (인증 회귀)
1. Metadata:
   1. User goal: 보호 API가 인증 규칙을 상속한다.
   2. Coverage type: Regression(인증)
   3. Source: AI-proposed
   4. Priority: Required
   5. Platform coverage: 백엔드 API
   6. Status: Passed
2. Environment:
   1. Auth: 토큰 없음.
   2. 검증 방법: `courses-handler.test.ts`.
3. Selector Strategy: N/A.
4. Steps:
   1. `POST /v1/courses/route` 이벤트를 authorization 헤더 없이 호출.
5. Expected Result:
   1. `statusCode===401`, `error.code==='UNAUTHORIZED'`. (만료 토큰이면 `ACCESS_TOKEN_EXPIRED` — 기존 guard 규칙 상속)
   2. service.getCourseRoute 미호출.
   3. Pass/fail: 401 UNAUTHORIZED && 서비스 미호출.
6. Result:
   1. Failure observed:
   2. Fix attempted:
   3. Re-check result:

### Scenario 9: 통합 — 실 DB 좌표 조회 및 422 (조건부)
1. Metadata:
   1. User goal: 실제 DB의 places 좌표로 동작하고 누락 작품을 제외한다.
   2. Coverage type: Edge(통합)
   3. Source: AI-proposed
   4. Priority: Required(통합 DB 가용 시) / 불가 시 Blocked
   5. Platform coverage: 백엔드 API + 실 DB
   6. Status: Passed
2. Environment:
   1. Start state: artworks/artists/places 시드(작품 2개 활성 좌표 + 1개 place soft-delete).
   2. Auth: 시드 유저 토큰.
   3. Mock: 실 repo + **provider 스텁**(카카오 미호출) 주입한 service를 `handleCoursesRequest(event, ctx, routeService)`로 호출.
   4. 검증 방법: `courses-handler.integration.test.ts`(+ `createEvent` 헬퍼에 `/v1/courses/route` 정적 라우트 분기 추가).
3. Selector Strategy: N/A.
4. Steps:
   1. 활성 좌표 작품 2개로 route 요청 → 200, provider가 받은 좌표가 DB 좌표와 일치.
   2. 1개를 place soft-delete된 작품으로 바꿔 유효 1개 → 422.
5. Expected Result:
   1. 200 케이스: provider 입력 좌표 lat/lng가 시드 places 값과 일치, 응답 vertexes 존재.
   2. 422 케이스: `error.code==='ROUTE_UNAVAILABLE'`, statusCode 422.
   3. Pass/fail: 두 케이스 모두 기대치 일치. (DB 불가 시 Blocked + 사유 기록)
6. Result:
   1. Failure observed:
   2. Fix attempted:
   3. Re-check result:

### Scenario 10: 회귀 — 기존 courses/errors/env 테스트 + SAM 템플릿
1. Metadata:
   1. User goal: 신규 추가가 기존 동작/구성을 깨지 않는다.
   2. Coverage type: Regression/Adjacent
   3. Source: AI-proposed
   4. Priority: Required
   5. Platform coverage: 백엔드 API + 빌드/인프라
   6. Status: Passed
2. Environment:
   1. 검증 방법: `pnpm test`(전체 유닛), `pnpm typecheck`, `pnpm sam:validate`.
3. Selector Strategy: N/A.
4. Steps:
   1. 기존 `courses-*.test.ts`(7-1~7-11), `errors.test.ts`, `env.test.ts` 통과(스텁에 `getCourseRoute`/`listArtworkCoordinates` 추가가 기존 단언 불변).
   2. `errors.test.ts`: 기존 코드 상태/메시지 매핑 불변 + 신규 2코드 매핑 추가 단언.
   3. `env.test.ts`: 기존 env 파싱 불변(신규 키 optional).
   4. `sam validate`: 신규 라우트/파라미터 포함 템플릿 유효.
5. Expected Result:
   1. `pnpm test` 전체 통과(기존 + 신규).
   2. `pnpm typecheck` 통과(Record 완전성/타입 강제).
   3. `sam validate` 성공.
   4. Pass/fail: 세 명령 모두 성공, 기존 테스트 0 실패.
6. Result:
   1. Failure observed:
   2. Fix attempted:
   3. Re-check result:

## 검증 실행 결과 (Execution Results)
실행일: 2026-06-21. 실행 환경: Node v20.20.2(engine 경고 있으나 동작), pnpm 9.6.0.

1. `pnpm typecheck` → 통과(에러 0). 신규 에러 코드 `Record<AppErrorCode,...>` 완전성 포함.
2. `pnpm test`(유닛) → **136 pass / 0 fail**. 신규 케이스: route 스키마 3건, route 서비스 9건(성공·30초과·비연속·좌표부족422·부분경로·압축·압축후422·provider 502·미설정 502), route 핸들러 2건(200/400), 카카오 provider 6건(좌표변환·result_code≠0·!ok·fetch throw·빈 vertexes·키미설정).
   - 중간 실패 1건 발견·수정: provider 테스트의 "키 미설정" 케이스에서 `applyProviderEnv(undefined)`가 기본 파라미터값을 트리거해 키가 설정되던 버그 → 센티넬을 `null`로 변경해 해결(테스트 헬퍼 한정, production 영향 없음).
3. 통합 테스트(`node --env-file=.env.integration ... tests/integration/courses/...`) → **21 pass / 0 fail**. 신규 route 통합 2건 모두 통과:
   - "route endpoint returns kakao vertexes for seeded artwork coordinates"(실 DB places 좌표 3개를 seq 순서로 provider에 전달, 200 vertexes).
   - "route endpoint returns 422 when fewer than two artworks resolve coordinates"(없는 artwork_id + 1개 → 유효<2 → 422 ROUTE_UNAVAILABLE).
   - Scenario 9는 통합 DB 가용으로 Required 충족(Blocked 아님).
4. `pnpm sam:validate` 및 `sam validate --lint` → valid SAM Template(신규 `/v1/courses/route` 라우트 + `KakaoMobilityRestApiKey` 파라미터 포함).

매핑: Scenario 1(유닛 service/handler), 2(schemas/service/handler), 3·5·6(service), 4·7(provider), 8(handler 401 — 기존+신규 경로 인증 상속), 9(통합), 10(전체 유닛+sam) 모두 Passed.

## Excluded Scenarios
1. **실제 카카오 모빌리티 실호출**: 실 REST 키·네트워크 의존이라 로컬 자동화에서 제외. 배포 후 실 키로 1회 수동 스모크(정상 경로 좌표 반환 확인)로 분리. (사용자가 실호출 스모크를 원치 않음 — 기본 mock.)
2. **앱(steelart_app) 폴백/토스트 UX**: 서버 범위 밖(앱이 ROUTE_UNAVAILABLE 수신 시 직선 폴백). 서버는 상태코드/`error.code`만 보장.
3. **부하/쿼터 초과 동작**: 카카오 무료 쿼터 초과 시 동작은 502로 수렴(업스트림 실패)하므로 별도 시나리오화하지 않음.

## Review Questions
(현재 없음 — 사용자가 별도 시나리오 없음 + 환경은 백엔드 자동화로 확정. 통합 DB 가용 여부는 Scenario 9에서 조건부 처리, 실 카카오 호출은 Excluded.)
