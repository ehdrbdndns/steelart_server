# Research — POST /v1/courses/route (코스 동선 경로 조회)

## User Intake
1. 요청한 결과:
   1. `POST /v1/courses/route` Bearer 보호 엔드포인트 신설. 순서가 있는 작품 집합을 받아 카카오모빌리티 다중 경유지 길찾기(자동차)로 경로 polyline 좌표를 계산해 앱에 내려준다.
2. 현재 불편/문제:
   1. 정본 계약(`STEELART_SERVER_API_DRAFT.md` 7-12)에서 이 API는 `미구현` 상태다. 앱의 "코스 동선" 지도 polyline 기능을 위한 서버 프록시가 없다.
3. 영향을 받는 사용자/역할:
   1. 인증된 앱 사용자(Bearer 토큰 보유). 최종 코스(저장 전)와 저장된 코스(내 코스/추천 코스 상세) 양쪽 화면에서 호출.
4. 관련 화면/흐름:
   1. steelart_app의 코스 동선 지도(인앱 카카오 지도 polyline 렌더링). 서버는 좌표만 반환하고 직선 폴백은 앱이 처리.
5. 제공된 예시/자료:
   1. `STEELART_SERVER_API_DRAFT.md` 7-12 (계약 정본).
   2. `steelart_app/docs/adr/0001-course-route-kakao-car-directions.md` (자동차 경로 채택 배경).
   3. 카카오모빌리티 공식 문서: https://developers.kakaomobility.com/guide/navi-api/waypoints
6. 제약/Non-goals:
   1. 카카오 REST 키는 서버에만 둔다(앱 번들/`EXPO_PUBLIC_*` 노출 금지).
   2. 경로 좌표를 DB에 영구 저장하지 않는다(카카오 장기 저장 약관 불명확) — 짧은 TTL 캐시만.
   3. 거리/시간은 응답에 포함하지 않는다.
   4. 서버는 직선 폴백 좌표를 만들지 않는다(앱 책임).
   5. 앱이 보낸 좌표는 신뢰하지 않는다(요청에 좌표가 와도 무시, DB가 단일 좌표 소스).
7. 사용자의 완료 기준:
   1. 단위/통합 테스트 추가(성공·좌표부족·30초과·카카오실패, 카카오 호출은 mock).
   2. `STEELART_SERVER_API_DRAFT.md` 7-12 구현 상태를 `구현 완료`로 갱신.
   3. 응답은 공통 envelope(`{data, meta, error}`)를 따르고 인증/만료는 기존 Bearer 규칙과 동일.

## Goal
인증된 사용자가 순서가 있는 작품 목록(`items: {artwork_id, seq}[]`)을 보내면, 서버가 DB 좌표(단일 소스)로 카카오 자동차 다중 경유지 경로를 계산해 그릴 순서대로의 `vertexes: {lat, lng}[]`를 공통 envelope로 반환하는 프록시 엔드포인트를 구현한다.

## Decisions (확정)
1. **(Q1 승인됨) 입력-형식 위반 = HTTP 400**: items 2개 미만 / seq 비연속 / artwork_id 중복은 `BAD_REQUEST`(400), items 30 초과는 `TOO_MANY_WAYPOINTS`(400). 이 엔드포인트에서 **422는 `ROUTE_UNAVAILABLE`(유효 좌표 2개 미만) 전용**으로 둔다. route body는 `parseInput({ code: 'BAD_REQUEST', ... })`로 파싱한다.
2. **카카오 REST 키 준비됨**: env 변수명은 `KAKAO_MOBILITY_REST_API_KEY`로 확정. 발급처는 `developers.kakao.com` 콘솔 → 내 애플리케이션 → 앱 키 → REST API 키. 사용자가 실제 키 값을 직접 보유/주입한다(채팅·git 노출 금지).
   1. **env 로딩 구조(중요)**: 앱 런타임(`getEnv()`)은 `process.env`만 읽고 **dotenv가 없다 — `.env` 파일을 자동 로드하지 않는다.** 유닛 테스트는 `process.env`를 코드에서 직접 세팅. 통합 테스트만 `pnpm test:integration:env`가 `--env-file=.env.integration`을 로드하지만, 그 파일은 `INTEGRATION_*` 접두 변수(`INTEGRATION_DB_*`/`INTEGRATION_JWT_SECRET`)만 담고 헬퍼(`tests/integration/helpers/database.ts`)가 DB/JWT/APP_ENV만 앱 변수로 매핑한다 → **카카오 키는 `.env.integration`로 앱에 전달되지 않는다.**
   2. **키가 실제 소비되는 유일한 지점 = 배포된 Lambda 환경변수**(template.yaml/SAM 파라미터). 테스트는 카카오를 mock + route 프로바이더 stub 주입이라 키가 필요 없다.
   3. 변수 선언 문서화: `.env.example`에 빈 placeholder 추가 완료(커밋되는 템플릿).
   4. **키 값을 넣는 곳 = GitHub 저장소 Secrets**(확정): 배포는 `.github/workflows/deploy.yml`(`main` push)에서 GitHub Actions로 수행되며, 진짜 비밀값은 `DB_PASSWORD`/`JWT_SECRET`처럼 `${{ secrets.* }}`에서 가져와 `sam deploy --parameter-overrides`로 전달한다(비밀 아닌 값은 `${{ vars.* }}`). 사용자는 **Settings → Secrets and variables → Actions → New repository secret**에 `KAKAO_MOBILITY_REST_API_KEY`로 키를 등록한다. 구현 단계에서 (a) `template.yaml`에 `KakaoMobilityRestApiKey` Parameter(NoEcho) + CoursesFunction env 주입, (b) `deploy.yml` 배포 step `env`에 `KAKAO_MOBILITY_REST_API_KEY: ${{ secrets.KAKAO_MOBILITY_REST_API_KEY }}` + `--parameter-overrides`에 `KakaoMobilityRestApiKey="${KAKAO_MOBILITY_REST_API_KEY}"` 추가를 `DB_PASSWORD`와 동일 패턴으로 배선한다. **`samconfig.toml`은 깃에 커밋되므로 진짜 비밀키를 하드코딩하지 않는다.**
   5. (선택) 로컬 실제 호출 스모크 테스트 시에만: 깃 무시되는 `.env`에 `KAKAO_MOBILITY_REST_API_KEY=<키>`(접두사 없는 이름)를 넣고 `--env-file=.env`로 실행.
   6. **카카오 콘솔 "허용 IP 주소"는 비워둔다**: 이 서버는 Lambda이고 `template.yaml`에 VpcConfig가 없어 아웃바운드 IP가 동적(요청마다 변동)이다. IP 화이트리스트를 걸면 카카오 호출이 실패해 `502 ROUTE_UNAVAILABLE`로 이어진다. 키 보안은 "서버 전용 비밀 유지(앱 미노출)"로 충족한다. IP 제한이 꼭 필요하면 Lambda를 VPC+NAT 게이트웨이+EIP로 고정 IP화한 뒤 EIP를 화이트리스트해야 하며, 이는 v1 범위 밖이다.
   7. (확정) 사용자가 GitHub Secrets에 `KAKAO_MOBILITY_REST_API_KEY`를 등록 완료했다.
3. **(Q2 승인됨) v1 캐시 생략**: 서버리스(Lambda)에서 in-memory 캐시는 컨테이너 간 공유가 안 되고 실효가 미미하며, 정본의 "짧은 TTL 캐시만"은 캐시 의무가 아니라 제약이므로 미구현도 준수. 입력/응답은 정렬된 artwork_id로 키를 만들 수 있는 구조로 유지해 추후(추천 코스 적중이 실측 문제화될 때) DynamoDB TTL 공유 캐시를 후속 도입할 여지만 남긴다. → route 서비스는 매 호출 카카오 직행, 캐시 코드/의존성 없음.
4. **(Q3 승인됨) 키 미설정/카카오 실패 = 502 ROUTE_UNAVAILABLE, env 주입은 CoursesFunction 전용**: `KAKAO_MOBILITY_REST_API_KEY`가 비었거나 미설정인 채 호출되면 카카오 호출 실패와 동일하게 `502 ROUTE_UNAVAILABLE`로 던지고 서버 로그를 남긴다(앱은 직선 폴백). `template.yaml`에서 이 키는 `Globals`가 아니라 **CoursesFunction의 `Environment.Variables`에만** 주입해 노출 표면을 최소화한다. env 스키마는 `.optional()`로 두어 다른 람다/테스트가 깨지지 않게 한다.

## Current Behavior
1. `courses` 도메인은 7-1~7-11이 모두 `구현 완료` 상태이며 `src/lambdas/courses/handler.ts`가 경로별로 분기한다.
2. `/v1/courses/route`는 핸들러 분기, SAM 라우트, 서비스/리포지토리 메서드 모두 존재하지 않는다. 현재 호출하면 핸들러 말단의 `throw new AppError('NOT_FOUND', ...)`로 떨어지지만, 애초에 `template.yaml`에 해당 라우트가 없어 API Gateway가 람다로 전달하지도 않는다.
3. 좌표는 기존 7-5 상세/7-11 체크인이 `places.lat`/`places.lng`(decimal(10,7))를 `artworks.place_id`로 INNER JOIN 후 `CAST(... AS DOUBLE)`로 가져온다.

## Relevant Surfaces
1. 라우팅/엔트리: `src/lambdas/courses/handler.ts` (경로 분기), `template.yaml` `CoursesFunction.Events` (API Gateway 라우트 명시 등록).
2. 도메인: `src/domains/courses/{schemas,types,service,repository,mapper}.ts`.
3. 공유: `src/shared/api/errors.ts`(에러 코드/HTTP 매핑), `src/shared/api/response.ts`(envelope), `src/shared/validation/parse.ts`(zod→AppError), `src/shared/auth/guard.ts`(`requireAuth`), `src/shared/env/server.ts`(env 스키마).
4. 외부 연동: 카카오모빌리티 `POST https://apis-navi.kakaomobility.com/v1/waypoints/directions` (전역 `fetch`).
5. 데이터: `artworks` → `artists`(artist_id) → `places`(place_id) 조인, `places.lat/lng`가 좌표 소스. `course_items`는 이 엔드포인트에서 사용하지 않는다(요청 body의 items를 직접 받음, 저장 안 함).
6. 테스트: `tests/unit/courses/*.test.ts`, `tests/integration/courses/courses-handler.integration.test.ts`.

## Codebase Analysis Method
1. Serena MCP로 확인한 symbols/참조/패턴:
   1. `find_referencing_symbols(createCoursesService)` → 참조처는 `src/lambdas/courses/handler.ts`(프로덕션 배선)와 `tests/unit/courses/courses-service.test.ts`뿐. 서비스 의존성 추가는 외부 호출부를 깨지 않음.
   2. `find_referencing_symbols(CoursesServiceDependencies)` → `createCoursesService` 시그니처에서만 참조. 의존성 인터페이스 확장이 고립적.
   3. `find_referencing_symbols(APP_ERROR_CODES)` → 같은 파일의 `AppErrorCode = (typeof APP_ERROR_CODES)[number]` 파생에만 사용. 코드 추가 시 TS가 `Record<AppErrorCode,...>` 두 맵(상태/메시지) 갱신을 강제 → 누락 방지.
2. Serena MCP로 좁힌 파일/모듈 범위: 위 `Relevant Surfaces`의 courses 도메인 5개 파일 + errors/parse/env 공유 모듈.
3. 추가로 사용한 보조 명령: `rg`/`grep`으로 7-12 섹션 위치 및 DB 좌표 컬럼(`places.lat/lng`) 확인, `Read`로 핸들러/서비스/리포지토리/스키마/테스트 본문 정독.
4. Serena MCP를 사용할 수 없었던 부분: 없음. 구조 파악은 Serena 우선, 본문 정독만 `Read`로 보완.

## Facts
1. **에러 카탈로그(`src/shared/api/errors.ts`)**: `APP_ERROR_CODES`에 `ROUTE_UNAVAILABLE`, `TOO_MANY_WAYPOINTS`는 **없다**. 현재 매핑은 `BAD_REQUEST=400`, `VALIDATION_ERROR=422`, `CONFLICT=409`, `INTERNAL_ERROR=500` 등. `AppError`는 `options.statusCode`로 코드 기본 상태를 **오버라이드 가능**하다(같은 코드로 422/502 동시 표현 가능).
2. **검증(`parse.ts`)**: `parseInput`은 기본 코드 `VALIDATION_ERROR`(→422)지만 `code` 인자로 `BAD_REQUEST`(→400) 등 지정 가능. 기존 7-6 생성/7-7 수정은 `code` 미지정이라 **입력 위반 시 실제로는 422(VALIDATION_ERROR)** 를 반환한다. (정본/요청문이 말하는 "400"과 불일치 — Review Question 1 참조.)
3. **입력 검증 규칙(7-6, `schemas.ts` + `service.ts`)**: items 배열 `.min(1)`, 각 item `{artwork_id, seq}` 양의 정수, `.strict()`. `superRefine` + 서비스 `assertContiguousItems`가 (a) artwork_id 중복 금지, (b) seq가 1부터 연속을 검증. 7-6은 추가로 `assertActiveArtworksExist`로 비활성 작품을 **거부**(`VALIDATION_ERROR`)한다.
4. **좌표 소스/“좌표 null”의 실제 의미**: `places.lat`/`places.lng`는 DB 스키마상 **NOT NULL**이다. 기존 쿼리(`findCourseDetail`, `findCourseCheckinTarget`)는 `artworks→artists→places`를 모두 `deleted_at IS NULL` 조건으로 INNER JOIN한다. 따라서 "좌표 없는 작품"은 실제로는 *작품/작가/장소가 없거나 soft-delete되어 활성 place 행이 조인되지 않는 작품*을 의미한다. INNER JOIN 후 결과에 없는 artwork_id를 경로에서 자연스럽게 제외하면 계약(“좌표 null 제외”)을 만족한다.
5. **7-6과의 핵심 차이**: 7-6은 비활성/누락 작품을 *거부*하지만, 7-12는 *조용히 제외*하고 유효 좌표 2개 미만일 때만 `422 ROUTE_UNAVAILABLE`을 낸다. 따라서 route 서비스는 `assertActiveArtworksExist`를 호출하지 **않는다**.
6. **DI 패턴(`service.ts`)**: 서비스는 `createCoursesService({ coursesRepository })` 생성자 DI. 카카오 호출/캐시도 의존성으로 주입하면 유닛 테스트에서 mock 가능(전역 `fetch` 패치 불필요).
7. **인증**: 핸들러 최상단에서 `requireAuth(event, context)`를 한 번 호출 후 분기 → 새 라우트도 Bearer 보호와 `ACCESS_TOKEN_EXPIRED` 등 만료 규칙을 자동 상속.
8. **SAM 라우팅(`template.yaml`)**: `CoursesFunction`은 `{proxy+}` 캐치올이 없고 경로별 명시 등록(`/v1/courses`, `/v1/courses/recommended`, `/v1/courses/{courseId}` 등). `/v1/courses/route` **라우트 이벤트를 새로 추가하지 않으면** API Gateway가 람다로 전달하지 않는다. HTTP API v2는 정적 경로(`/v1/courses/route`)를 경로 변수 경로(`/v1/courses/{courseId}`)보다 우선 매칭하므로 충돌 없음.
9. **env(`server.ts` + `template.yaml`)**: env는 zod 스키마. `KAKAO_CLIENT_ID`/`APPLE_CLIENT_ID`는 `.optional()` 패턴. `template.yaml`은 `Parameters` + `Globals.Function.Environment.Variables`로 주입. `KAKAO_MOBILITY_REST_API_KEY`는 아직 없다.
10. **외부 HTTP 패턴(`providers/kakao.ts`)**: 전역 `fetch`를 try/catch로 감싸고, `!response.ok` 및 JSON 파싱 실패를 각각 분기 처리하는 기존 관용구가 있다. route 프로바이더도 동일 관용구로 작성하되 실패를 `502 ROUTE_UNAVAILABLE`로 변환.
11. **응답 envelope(`response.ts`)**: `ok(data, meta)`가 `{data, error:null, meta}`를, `fail(appError, meta)`가 `{data:null, error:{code,message,details?}, meta}`를 만든다. route 성공 응답 `data = { vertexes: {lat,lng}[] }`.

## Required Knowledge for Goal
1. **카카오 다중 경유지 길찾기 호출 형태** (공식 문서로 확인, 아래 Third-Party 섹션):
   1. `origin = 첫 유효 좌표`, `destination = 마지막 유효 좌표`, `waypoints = 중간 유효 좌표들`(seq 순서). 좌표는 `{x: lng, y: lat}`.
   2. `priority: "RECOMMEND"` 고정(계약).
   3. 응답 성공: `routes[0].result_code === 0`. polyline은 `routes[0].sections[].roads[].vertexes`(flat `[lng,lat,lng,lat,...]`)를 순서대로 이어 붙여 `{lat:y, lng:x}[]`로 변환.
2. **경유지 상한**: 카카오 실제 상한은 waypoints 30개(= origin/destination 제외)지만, 계약은 보수적으로 **입력 items 30 초과 → `400 TOO_MANY_WAYPOINTS`** 로 둔다(원시 입력 길이 기준 체크).
3. **캐시 전략**: Lambda 환경에 공유 캐시(Redis 등) 인프라가 없다. "짧은 TTL 캐시만" 요구는 **모듈 레벨 in-memory `Map`(warm 컨테이너 내 best-effort TTL)** 으로 구현하는 것이 유일하게 추가 인프라 없는 방법. 키는 *그릴 순서(seq 정렬)대로의 유효 artwork_id 배열* 해시(순서가 경로를 결정하므로 정렬-집합이 아니라 순서 보존 필요). `node:crypto` `createHash('sha256')` 사용.
4. **좌표 정밀도**: DB `decimal(10,7)`을 `CAST(... AS DOUBLE)` 후 `Number()`로 변환(기존 패턴 동일).

## Third-Party / Official Docs
1. 확인 문서: https://developers.kakaomobility.com/guide/navi-api/waypoints (WebFetch로 2026-06-21 확인).
2. 확인된 계약:
   1. `POST https://apis-navi.kakaomobility.com/v1/waypoints/directions`
   2. 헤더: `Authorization: KakaoAK ${REST_API_KEY}`, `Content-Type: application/json`
   3. body: `origin{x,y}`, `destination{x,y}`, `waypoints[{x,y}]`, `priority: RECOMMEND|TIME|DISTANCE`. `x=경도(lng)`, `y=위도(lat)`.
   4. 제약: **waypoints 최대 30개**, 총 경로 1,500km 미만.
   5. 응답: `{ trans_id, routes: [{ result_code, result_msg, summary, sections: [{ roads: [{ ..., vertexes: [lng,lat,lng,lat,...] }] }] }] }`. `result_code === 0`이 성공.
3. 적용 차이: 계약은 상한을 "입력 items 30개"로 보수화하고, `result_code !== 0` 또는 호출/네트워크/파싱 실패를 모두 `502 ROUTE_UNAVAILABLE`로 단일화한다. 실패 코드별 세분 처리는 하지 않는다.

## Existing Patterns
1. **도메인 슬라이스**: `schemas`(zod 입력) → `handler`(parseInput + 분기) → `service`(비즈니스 규칙 + AppError) → `repository`(SQL) → `mapper`(응답 정규화). route도 이 슬라이스를 그대로 따른다.
2. **좌표 조회**: `findCourseCheckinTarget`/`findCourseDetail`의 `INNER JOIN artworks/artists/places ... CAST(p.lat AS DOUBLE)` 패턴을 재사용해 `listArtworkCoordinates(artworkIds)` 신설.
3. **입력 정합성**: `assertContiguousItems`(service.ts)의 중복/연속 검증 로직 형태를 route 입력 검증에 재사용(에러 코드만 계약에 맞게 조정 — Review Question 1 결과 반영).
4. **외부 호출 mock**: 서비스 생성자 DI로 외부 클라이언트를 주입해 유닛 테스트에서 stub 교체(auth 도메인의 `KakaoAuthProviderClient` 주입 패턴과 동일 사상).
5. **에러 카탈로그 확장**: `APP_ERROR_CODES` 배열 + `APP_ERROR_STATUS_CODES`/`APP_ERROR_MESSAGES` 두 Record에 코드 추가(타입이 누락을 강제).

## Unknowns
1. (해결됨 → Decisions 2) 카카오 REST 키는 사용자가 직접 준비. 발급처: **`developers.kakao.com` 콘솔**(카카오 로그인과 동일 콘솔) → 내 애플리케이션 → 앱 선택/생성 → **앱 키 → REST API 키**. 길찾기 헤더 `Authorization: KakaoAK {REST_API_KEY}`의 키가 이 REST API 키다. 구현/테스트는 카카오 호출 mock이라 키 없이도 가능하며, 실 키 동작은 배포 후 확인.
2. 다중 경유지 길찾기 **무료 쿼터의 정확한 수치** 미확정 — ADR엔 "5,000건/일"로 적혀 있으나 공식 문서 본문에서 숫자를 명시 확인하지 못함.
3. 길찾기 제품이 앱에서 **별도 활성화/사업자 인증**을 요구하는지 미확정 — 개발/테스트는 표준 REST 키로 동작, 운영 쿼터 상향은 파트너십 문의 가능성.
4. 카카오 `result_code`의 비-0 실패 코드 세부 목록은 공식 문서에서 완전히 노출되지 않음. 계약상 "비-0 = 실패 → 502"로 단일 처리하므로 구현에는 영향 없음.

## Risks
1. **에러 상태 코드 불일치(중요)**: 정본/요청문은 입력 위반을 "400"이라 하지만 기존 7-6은 동일 입력 위반을 422(VALIDATION_ERROR)로 반환한다. 어느 쪽을 따르느냐에 따라 스키마/서비스의 에러 코드와 테스트 기대값이 달라진다. → Review Question 1.
2. **캐시 일관성**: in-memory 캐시는 warm 컨테이너 단위라 글로벌하지 않다. 콜드 스타트/스케일아웃 시 캐시 미스가 늘 수 있으나 정확성 문제는 없다(계약이 "짧은 TTL 캐시만" 허용). → Review Question 2.
3. **라우트 우선순위**: `template.yaml`에 `/v1/courses/route`를 추가하지 않으면 404. 추가하되 `/v1/courses/{courseId}`보다 정적 경로가 우선이라 기존 상세 라우트 회귀 없음(단, 명시 등록 누락이 회귀 원인이 될 수 있어 SAM validate로 확인).
4. **좌표 누락 처리**: route는 누락 작품을 거부하지 않고 제외하므로, 잘못된 artwork_id를 보내도 다른 좌표가 2개 이상이면 200을 반환한다(계약 의도). 7-6과 다른 동작이라 테스트로 고정 필요.
5. **키 노출**: `KAKAO_MOBILITY_REST_API_KEY`를 `Globals`에 두면 모든 람다 env에 주입된다(여전히 서버측이나 노출 표면 증가). CoursesFunction에만 주입하는 편이 최소 노출. → Review Question 3.

## Likely Change Points
1. `src/shared/api/errors.ts` — `ROUTE_UNAVAILABLE`, `TOO_MANY_WAYPOINTS` 코드 + 상태/메시지 매핑 추가.
2. `src/domains/courses/schemas.ts` — `courseRouteBodySchema`(items min 2 + 중복/연속 검증) 추가.
3. `src/domains/courses/types.ts` — `CourseRouteInput`, `RouteVertex`, `CourseRouteResponse`, 좌표 조회 타입 + 카카오 프로바이더/캐시 인터페이스 타입.
4. `src/domains/courses/repository.ts` — `listArtworkCoordinates(artworkIds)` 추가(INNER JOIN places, seq 매핑은 서비스에서).
5. `src/domains/courses/service.ts` — `getCourseRoute(input, userId)` 추가, `CoursesServiceDependencies`에 카카오 라우트 프로바이더(+캐시/clock) 의존성 추가.
6. `src/domains/courses/mapper.ts` — `mapCourseRouteResponse(vertexes)` 추가.
7. 신규 `src/shared/kakao/mobility-route.ts`(또는 `src/domains/courses/route-provider.ts`) — 카카오 호출/응답 파싱 프로바이더 + in-memory TTL 캐시.
8. `src/lambdas/courses/handler.ts` — `/v1/courses/route` POST 분기 추가, 서비스 배선에 라우트 프로바이더 주입.
9. `src/shared/env/server.ts` — `KAKAO_MOBILITY_REST_API_KEY: z.string().min(1).optional()` 추가.
10. `template.yaml` — `KakaoMobilityRestApiKey` Parameter(NoEcho) + `CoursesRouteRoute` 이벤트 + CoursesFunction env 주입.
11. `.github/workflows/deploy.yml` — 배포 step `env`에 `KAKAO_MOBILITY_REST_API_KEY: ${{ secrets.KAKAO_MOBILITY_REST_API_KEY }}` + `--parameter-overrides`에 `KakaoMobilityRestApiKey=...` 추가(`DB_PASSWORD` 패턴). (현재 브랜치에서 이 파일이 수정 중이므로 conflict 주의.)
12. `.env.example` — `KAKAO_MOBILITY_REST_API_KEY=` 추가(완료).
13. `STEELART_SERVER_API_DRAFT.md` 7-12 — 구현 상태 `구현 완료`로 갱신.
14. 테스트: `tests/unit/courses/courses-schemas.test.ts`(route 스키마), `courses-service.test.ts`(성공/좌표부족/30초과/카카오실패), `courses-handler.test.ts`(라우트 분기/envelope), 신규 route 프로바이더 유닛 테스트, 통합 테스트(좌표 조회 + 카카오 stub 주입).

## Review Questions
(모두 해결됨 — Q1·Q2·Q3 답변을 `Decisions`에 반영. 사용자 `승인` 완료, plan 단계로 진행.)
