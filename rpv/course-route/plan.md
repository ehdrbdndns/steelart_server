# Plan — POST /v1/courses/route (코스 동선 경로 조회)

## Goal
인증된 사용자가 `items: {artwork_id, seq}[]`를 보내면, DB 좌표(`places.lat/lng` 단일 소스)를 seq 순서로 모아 카카오 자동차 다중 경유지 길찾기로 경로를 계산하고, 공통 envelope로 `{ vertexes: {lat,lng}[] }`(그릴 순서대로)를 반환하는 `POST /v1/courses/route`(Bearer 보호)를 구현한다. 캐시는 v1에서 두지 않는다.

## Scope / Non-Goals
1. 포함되는 것:
   1. 에러 카탈로그에 `ROUTE_UNAVAILABLE`(422/502), `TOO_MANY_WAYPOINTS`(400) 추가.
   2. route 입력 스키마, route 서비스 메서드, 좌표 조회 리포지토리 메서드, 응답 매퍼.
   3. 카카오 모빌리티 호출 프로바이더(DI, 전역 `fetch`) + 응답 파싱/실패→502 변환.
   4. 핸들러 분기 + 서비스 배선(프로바이더 주입).
   5. env 스키마(`KAKAO_MOBILITY_REST_API_KEY` optional), `template.yaml`(Parameter + CoursesFunction env + 라우트 이벤트), `deploy.yml`(secret 전달), `.env.example`(완료).
   6. 단위/통합 테스트(성공·좌표부족·30초과·카카오실패·입력위반, 카카오 mock).
   7. `STEELART_SERVER_API_DRAFT.md` 7-12 `구현 완료`로 갱신.
2. 포함되지 않는 것:
   1. 캐시(in-memory/DynamoDB) — Q2 결정에 따라 v1 생략(키 설계 여지만 남김).
   2. 직선 폴백 좌표 생성(앱 책임).
   3. 거리/시간 응답 필드.
   4. 코스 저장/조회(`course_items`)와의 연동 — route는 body items만 사용, 저장 안 함.
   5. Lambda VPC/NAT/EIP 고정 IP화(카카오 IP 화이트리스트 미사용).

## Approach
1. 선택한 구현 방향:
   기존 courses 도메인 슬라이스(`schemas → handler → service → repository → mapper`)에 route 경로를 동일 패턴으로 추가한다. 카카오 호출은 서비스 생성자 DI(`courseRouteProvider`)로 주입해 유닛 테스트에서 전역 `fetch` 패치 없이 stub 교체한다(auth 도메인의 provider 주입 사상과 동일).
2. 기존 코드베이스 패턴과 맞는 이유:
   좌표 조회는 7-5/7-11이 쓰는 `artworks→artists→places` INNER JOIN + `CAST(p.lat AS DOUBLE)` 패턴 재사용. 입력 검증은 7-6의 `assertContiguousItems` 로직 재사용. 에러는 기존 `AppError`/`parseInput`/envelope 흐름 그대로.
3. Open/Closed Principle(OCP)과 backward-compatible 확장 방식:
   1. `APP_ERROR_CODES` 배열 + 두 `Record<AppErrorCode,...>` 맵에 코드 **추가**(타입이 누락 강제). 기존 코드 변경 없음.
   2. `CoursesServiceDependencies.courseRouteProvider`는 **optional**로 추가 → 기존 `createCoursesService({ coursesRepository })` 호출부(유닛 테스트 9곳)가 그대로 컴파일. route 메서드만 프로바이더 부재 시 502로 방어.
   3. `assertContiguousItems(items, code = 'VALIDATION_ERROR')`에 **optional code 인자** 추가 → 7-6 동작(422) 보존, route는 `'BAD_REQUEST'` 전달.
   4. 리포지토리/핸들러/env/template/deploy는 모두 **추가** 변경.
4. 직접 수정이 필요한 부분과 이유:
   1. `template.yaml` CoursesFunction에 `Environment.Variables` 신설 + 라우트 이벤트 추가(현재 `{proxy+}` 캐치올이 없어 명시 등록 필수).
   2. `deploy.yml` 배포 step에 secret 전달(현재 브랜치에서 이 파일 수정 중 — conflict 주의).
   3. 통합 테스트 `createEvent` 헬퍼의 경로 추론 로직에 `/v1/courses/route`를 정적 라우트로 특수처리(현재 `route`를 `{courseId}`로 오인식).

## Implementation Sketch
1. 함수 signature/type/interface:
   ```ts
   // domains/courses/types.ts
   export const COURSE_ROUTE_MIN_ITEMS = 2;
   export const COURSE_ROUTE_MAX_WAYPOINTS = 30;
   export interface CourseRouteItemInput { artwork_id: number; seq: number; }
   export interface CourseRouteInput { items: CourseRouteItemInput[]; }
   export interface RouteVertex { lat: number; lng: number; }
   export interface CourseRouteResponse { vertexes: RouteVertex[]; }
   export interface ArtworkCoordinate { artwork_id: number; lat: number; lng: number; }
   export interface CourseRouteProvider {
     fetchRoute(orderedCoordinates: RouteVertex[]): Promise<RouteVertex[]>;
   }

   // domains/courses/service.ts (interface 확장)
   getCourseRoute(input: CourseRouteInput): Promise<CourseRouteResponse>;

   // domains/courses/repository.ts (interface 확장)
   listArtworkCoordinates(artworkIds: number[]): Promise<ArtworkCoordinate[]>;
   ```
2. query/API 호출 형태:
   ```sql
   -- listArtworkCoordinates: 활성 place가 조인되는 작품의 좌표만 반환(없으면 행 없음 → 제외)
   SELECT a.id AS artwork_id,
          CAST(p.lat AS DOUBLE) AS lat,
          CAST(p.lng AS DOUBLE) AS lng
   FROM artworks a
   INNER JOIN artists ar ON ar.id = a.artist_id AND ar.deleted_at IS NULL
   INNER JOIN places  p  ON p.id  = a.place_id  AND p.deleted_at IS NULL
   WHERE a.deleted_at IS NULL AND a.id IN (?, ?, ...)
   ```
   ```
   POST https://apis-navi.kakaomobility.com/v1/waypoints/directions
   headers: { authorization: `KakaoAK ${key}`, 'content-type': 'application/json' }
   body: { origin:{x:lng,y:lat}, destination:{x:lng,y:lat}, waypoints:[{x:lng,y:lat}...], priority:'RECOMMEND' }
   success: routes[0].result_code === 0 → routes[0].sections[].roads[].vertexes(flat [lng,lat,...]) → {lat:y,lng:x}[]
   ```
3. route/component/service 연결:
   handler `/v1/courses/route`(POST) → `parseInput(courseRouteBodySchema, code:'BAD_REQUEST')` → `service.getCourseRoute(input)` → `ok({vertexes})`. 서비스 배선: `createCoursesService({ coursesRepository, courseRouteProvider: createKakaoMobilityRouteProvider() })`.
4. 상태 변경/저장/비동기 흐름:
   상태 변경/DB 쓰기 없음(읽기 전용 + 외부 호출). 저장/캐시 없음.
5. edge/error 처리(순서 중요):
   1. body 없음/JSON 깨짐 → `BAD_REQUEST`(400, `parseJsonBody`/`parseInput`).
   2. items < 2 / 항목 형식 위반 → `BAD_REQUEST`(400, 스키마 min(2)+strict).
   3. items > 30 → `TOO_MANY_WAYPOINTS`(400) — **좌표 조회 전, contiguity 전**.
   4. seq 비연속 / artwork_id 중복 → `BAD_REQUEST`(400, `assertContiguousItems(_, 'BAD_REQUEST')`).
   5. (Q2 결정) 존재하지 않거나 좌표 없는 작품은 **조용히 제외**(부분 경로 허용, 응답엔 droppedArtworkIds 미포함).
   6. (Q3 결정) seq 순서 좌표에서 **연속 동일 좌표는 1개로 압축**(같은 place 인접 작품의 카카오 실패 예방). A-B-A처럼 비연속 동일은 보존.
   7. (Q2 결정) 제외·압축 후 유효 좌표 < 2 → `ROUTE_UNAVAILABLE`(422).
   8. 키 미설정 / 네트워크 실패 / `!response.ok` / JSON 파싱 실패 / `result_code !== 0` / (Q1 결정) **빈 vertexes** → `ROUTE_UNAVAILABLE`(502).
6. React Native 앱이면 stable `testID`/accessibility id: 해당 없음(백엔드 전용).
7. 실제 구현 단계에서 코드베이스 스타일에 맞게 조정해야 할 부분:
   파일 내 alphabetical key 정렬 컨벤션(기존 mapper/types가 알파벳 순), import 순서, `Number()` 캐스팅 관용구를 따른다.

## Implementation Steps

### Step 1: 에러 카탈로그 확장 (`src/shared/api/errors.ts`)
1. 목표:
   `ROUTE_UNAVAILABLE`, `TOO_MANY_WAYPOINTS` 코드가 존재하고 HTTP 상태로 매핑된다. `ROUTE_UNAVAILABLE` 기본 502, 호출부에서 `statusCode:422` 오버라이드 가능.
2. 코드베이스 근거:
   `errors.ts`는 코드 배열 + 두 Record로 구성:
   ```ts
   export const APP_ERROR_CODES = ['BAD_REQUEST', ..., 'NOT_IMPLEMENTED'] as const;
   const APP_ERROR_STATUS_CODES: Record<AppErrorCode, number> = { BAD_REQUEST:400, VALIDATION_ERROR:422, ... };
   const APP_ERROR_MESSAGES: Record<AppErrorCode, string> = { ... };
   ```
   `AppError`는 `this.statusCode = options.statusCode ?? APP_ERROR_STATUS_CODES[code]`로 코드별 기본 상태를 오버라이드 허용(같은 코드 422/502 동시 사용 가능). Serena `find_referencing_symbols(APP_ERROR_CODES)` → `AppErrorCode` 파생만 참조하므로 추가는 고립적이고 TS가 두 Record 갱신을 강제한다.
3. 구현 계획:
   - 배열에 `'ROUTE_UNAVAILABLE'`, `'TOO_MANY_WAYPOINTS'` 추가.
   - `APP_ERROR_STATUS_CODES`: `ROUTE_UNAVAILABLE: 502`, `TOO_MANY_WAYPOINTS: 400` 추가.
   - `APP_ERROR_MESSAGES`: `ROUTE_UNAVAILABLE: 'Route unavailable'`, `TOO_MANY_WAYPOINTS: 'Too many waypoints'` 추가.
   - `serializeAppError`는 `INTERNAL_ERROR`만 메시지 마스킹 → 두 신규 코드 메시지는 그대로 노출(클라이언트는 `error.code`로 분기). 변경 불필요.
4. 확인 방법:
   `pnpm typecheck` 통과(Record 누락 시 컴파일 에러), `tests/unit/errors.test.ts`가 깨지지 않는지 확인 + 신규 코드 상태 매핑 단언 추가.
5. 건드리지 말아야 할 것:
   기존 코드의 상태/메시지 값, `toAppError`/`serializeAppError` 로직.

### Step 2: 타입/상수 추가 (`src/domains/courses/types.ts`)
1. 목표:
   route 입출력·좌표·프로바이더 타입과 상수(`COURSE_ROUTE_MIN_ITEMS=2`, `COURSE_ROUTE_MAX_WAYPOINTS=30`)가 정의된다.
2. 코드베이스 근거:
   `types.ts`는 도메인 상수(`CHECKIN_ALLOWED_RADIUS_METERS` 등)와 인터페이스(`CourseDetail`, `CourseCheckinTarget` 등)를 모은 파일. 새 타입도 여기에 둔다.
3. 구현 계획:
   위 Implementation Sketch(1)의 타입/상수 추가. `CourseRouteProvider`는 lat/lng(앱 도메인 좌표)만 주고받는 seam으로 두어 카카오 x/y 매핑은 프로바이더 내부에 캡슐화.
4. 확인 방법:
   `pnpm typecheck`.
5. 건드리지 말아야 할 것:
   기존 인터페이스 필드.

### Step 3: route 입력 스키마 (`src/domains/courses/schemas.ts`)
1. 목표:
   `courseRouteBodySchema`가 `{ items: {artwork_id, seq}[] }`(min 2, 양의 정수, strict)를 검증한다. 30-cap/연속/중복은 **스키마에 넣지 않는다**(전용 코드·순서 제어를 서비스에서).
2. 코드베이스 근거:
   기존 `courseMutationItemSchema`(artwork_id/seq `z.coerce.number().int().positive()`, `.strict()`)와 `buildCourseItemsSchema`(min(1)+superRefine) 패턴. route는 min(2)만 두고 superRefine은 제외.
3. 구현 계획:
   ```ts
   const courseRouteItemSchema = z.object({
     artwork_id: z.coerce.number().int().positive(),
     seq: z.coerce.number().int().positive(),
   }).strict();
   export const courseRouteBodySchema = z.object({
     items: z.array(courseRouteItemSchema).min(COURSE_ROUTE_MIN_ITEMS, 'At least two artworks are required'),
   }).strict();
   ```
4. 확인 방법:
   `courses-schemas.test.ts`에 2개 통과 / 1개 실패 / 비배열 실패 케이스 추가.
5. 건드리지 말아야 할 것:
   `createCourseBodySchema`/`buildCourseItemsSchema`(7-6/7-7 공유).

### Step 4: 좌표 조회 리포지토리 메서드 (`src/domains/courses/repository.ts`)
1. 목표:
   `listArtworkCoordinates(artworkIds)`가 활성 place가 있는 작품의 `{artwork_id, lat, lng}`만 반환한다(없는 작품은 결과에서 제외).
2. 코드베이스 근거:
   `listActiveArtworkIds`(IN 절 + `buildInClausePlaceholders` + `withConnection`)와 `findCourseCheckinTarget`의 `CAST(p.lat AS DOUBLE)` 조인 패턴:
   ```ts
   INNER JOIN places p ON p.id = a.place_id AND p.deleted_at IS NULL
   ...CAST(p.lat AS DOUBLE) AS lat, CAST(p.lng AS DOUBLE) AS lng
   ```
   `places.lat/lng`는 NOT NULL이므로 "좌표 null"은 곧 "활성 place 조인 실패" → INNER JOIN으로 자연 제외(research Facts 4).
3. 구현 계획:
   - `interface ArtworkCoordinateRow extends RowDataPacket { artwork_id:number; lat:number; lng:number; }`
   - `CoursesRepository`에 `listArtworkCoordinates` 시그니처 추가.
   - 구현: `artworkIds.length===0 → []`; 아니면 Sketch(2)의 SQL을 `withConnection`+`connection.execute<ArtworkCoordinateRow[]>`로 실행, `rows.map(r => ({ artwork_id:r.artwork_id, lat:Number(r.lat), lng:Number(r.lng) }))` 반환.
4. 확인 방법:
   통합 테스트(좌표 조회), `pnpm typecheck`.
5. 건드리지 말아야 할 것:
   기존 쿼리/메서드.

### Step 5: 카카오 모빌리티 프로바이더 (`src/domains/courses/route-provider.ts` 신규)
1. 목표:
   `createKakaoMobilityRouteProvider(): CourseRouteProvider`가 정렬된 좌표를 받아 카카오를 호출하고 `{lat,lng}[]`를 반환하며, 모든 실패를 `ROUTE_UNAVAILABLE`(502)로 변환한다.
2. 코드베이스 근거:
   `src/shared/auth/providers/kakao.ts`의 전역 `fetch` try/catch + `!response.ok` 분기 + `response.json()` try/catch 관용구. domain 파일이 `shared/env`·`shared/api/errors`를 import하는 방향(=repository.ts가 shared/db import)과 일치하도록 domain 폴더에 배치(shared→domain 역의존 회피).
3. 구현 계획:
   - `getEnv().KAKAO_MOBILITY_REST_API_KEY` 부재 → `ROUTE_UNAVAILABLE`(502).
   - `origin=coords[0]`, `destination=coords[last]`, `waypoints=가운데`(seq 순서) → x=lng,y=lat 매핑.
   - `fetch` 네트워크 throw / `!ok` / json 파싱 실패 / `routes[0]` 없음·`result_code!==0` / 평탄화한 vertexes 길이 0 → 각각 `ROUTE_UNAVAILABLE`(502, details에 status/result_code 기록).
   - 성공: `for (section of routes[0].sections) for (road of section.roads) for (i=0; i+1<vertexes.length; i+=2) push({lng:v[i], lat:v[i+1]})`.
   - 카카오 응답은 `unknown`으로 받아 옵셔널 체이닝으로 안전 파싱(부분 타입 인터페이스 사용).
4. 확인 방법:
   신규 `courses-route-provider.test.ts`에서 전역 `fetch` 스텁으로 성공/!ok/throw/result_code≠0/키부재 검증.
5. 건드리지 말아야 할 것:
   `shared/auth/providers/kakao.ts`(로그인 전용).

### Step 6: 서비스 메서드 + 의존성 (`src/domains/courses/service.ts`)
1. 목표:
   `getCourseRoute(input)`가 검증→좌표조회→422/502 규칙→프로바이더 호출→매핑 순으로 동작하고, `CoursesServiceDependencies`에 optional `courseRouteProvider`가 추가된다.
2. 코드베이스 근거:
   `assertContiguousItems`(중복/연속 검증, 현재 `VALIDATION_ERROR` throw), `createCoursesService(dependencies)` 클로저 패턴, `mapCourseDetail` 등 매퍼 사용. Serena `find_referencing_symbols(CoursesServiceDependencies)` → `createCoursesService`만 참조 → optional 필드 추가가 고립적.
3. 구현 계획:
   - `assertContiguousItems(items, code: AppErrorCode = 'VALIDATION_ERROR')`로 시그니처 확장, 내부 `throw new AppError(code, ...)`. 7-6 호출부는 인자 생략 → 동작 불변.
   - `CoursesServiceDependencies`에 `courseRouteProvider?: CourseRouteProvider;` 추가.
   - `CoursesService` 인터페이스에 `getCourseRoute` 추가.
   - 구현(순서 = Sketch edge 처리):
     ```ts
     async getCourseRoute(input) {
       const provider = dependencies.courseRouteProvider;
       if (!provider) throw new AppError('ROUTE_UNAVAILABLE', { statusCode: 502, message: 'Route provider is not configured' });
       if (input.items.length > COURSE_ROUTE_MAX_WAYPOINTS)
         throw new AppError('TOO_MANY_WAYPOINTS', { details:{ maxWaypoints:COURSE_ROUTE_MAX_WAYPOINTS, received:input.items.length } });
       assertContiguousItems(input.items, 'BAD_REQUEST');
       const orderedArtworkIds = [...input.items].sort((a,b)=>a.seq-b.seq).map(i=>i.artwork_id);
       const coords = await dependencies.coursesRepository.listArtworkCoordinates(orderedArtworkIds);
       const byId = new Map(coords.map(c=>[c.artwork_id, c]));
       // (Q2) 누락/없는 작품 조용히 제외
       const ordered = orderedArtworkIds.map(id=>byId.get(id)).filter((c): c is ArtworkCoordinate => Boolean(c)).map(c=>({lat:c.lat,lng:c.lng}));
       // (Q3) 연속 동일 좌표 압축(비연속 동일은 보존)
       const deduped = ordered.filter((c,i)=> i===0 || c.lat!==ordered[i-1].lat || c.lng!==ordered[i-1].lng);
       if (deduped.length < COURSE_ROUTE_MIN_ITEMS)
         throw new AppError('ROUTE_UNAVAILABLE', { statusCode:422, details:{ validCoordinateCount: deduped.length } });
       const vertexes = await provider.fetchRoute(deduped); // (Q1) provider가 빈 vertexes를 502로 throw
       return mapCourseRouteResponse(vertexes);
     }
     ```
   - userId는 route 로직에 불필요(Bearer는 핸들러 `requireAuth`가 보장) → 시그니처에서 제외.
4. 확인 방법:
   `courses-service.test.ts`에 성공/좌표부족(422)/30초과(400)/카카오실패(502)/중복·비연속(400) 케이스 추가.
5. 건드리지 말아야 할 것:
   기존 메서드 동작, `assertContiguousItems`의 기본 422 동작(7-6/7-7).

### Step 7: 응답 매퍼 (`src/domains/courses/mapper.ts`)
1. 목표:
   `mapCourseRouteResponse(vertexes)`가 `{ vertexes: {lat,lng}[] }`를 정규화 반환.
2. 코드베이스 근거:
   기존 매퍼들(`mapCourseDetail` 등)이 명시적 필드 매핑으로 응답을 고정하는 패턴.
3. 구현 계획:
   ```ts
   export function mapCourseRouteResponse(vertexes: RouteVertex[]): CourseRouteResponse {
     return { vertexes: vertexes.map(v => ({ lat: v.lat, lng: v.lng })) };
   }
   ```
4. 확인 방법:
   서비스/핸들러 테스트로 간접 검증.
5. 건드리지 말아야 할 것:
   기존 매퍼.

### Step 8: 핸들러 분기 + 서비스 배선 (`src/lambdas/courses/handler.ts`)
1. 목표:
   `POST /v1/courses/route`가 라우팅되고 카카오 프로바이더가 주입된 서비스로 처리된다.
2. 코드베이스 근거:
   핸들러는 최상단 `requireAuth(event, context)` 후 `request.path`/`request.routePath`로 분기, 각 분기는 `parseInput`+`service.*`+`ok(...)`. 신규 정적 경로는 기존 정적 경로 블록과 동일 형태로 추가.
3. 구현 계획:
   - import: `courseRouteBodySchema`, `createKakaoMobilityRouteProvider`.
   - 배선: `createCoursesService({ coursesRepository, courseRouteProvider: createKakaoMobilityRouteProvider() })`.
   - 분기(정적 경로, `/v1/courses` 블록 앞에 배치):
     ```ts
     if (request.path === '/v1/courses/route') {
       assertMethod(request.method, ['POST']);
       const input = parseInput({ schema: courseRouteBodySchema, input: request.parseJsonBody(), code: 'BAD_REQUEST', message: 'Course route payload is invalid' });
       const result = await service.getCourseRoute(input);
       return ok(result, { requestId: request.requestId ?? null });
     }
     ```
   - `code: 'BAD_REQUEST'`로 모든 스키마 위반을 400으로(Q1 결정).
4. 확인 방법:
   `courses-handler.test.ts`에 POST route 200 + vertexes, (옵션) 400/502 패스스루.
5. 건드리지 말아야 할 것:
   기존 분기 순서/`requireAuth`/catch 블록.

### Step 9: env 스키마 (`src/shared/env/server.ts`)
1. 목표:
   `KAKAO_MOBILITY_REST_API_KEY`가 optional로 스키마에 선언된다(미설정이어도 다른 람다/테스트 안 깨짐).
2. 코드베이스 근거:
   `KAKAO_CLIENT_ID: z.string().min(1, ...).optional()` 패턴.
3. 구현 계획:
   `serverEnvSchema`에 `KAKAO_MOBILITY_REST_API_KEY: z.string().min(1).optional(),` 추가(알파벳 위치 유지).
4. 확인 방법:
   `tests/unit/env.test.ts` 통과, `pnpm typecheck`.
5. 건드리지 말아야 할 것:
   기존 필드/`getEnv` 캐싱.

### Step 10: SAM 템플릿 (`template.yaml`)
1. 목표:
   `KakaoMobilityRestApiKey` Parameter(NoEcho) + CoursesFunction env 주입 + `/v1/courses/route` 라우트 이벤트가 추가된다.
2. 코드베이스 근거:
   `KakaoClientId` Parameter(`Default: ''`) + `Globals.Function.Environment.Variables.KAKAO_CLIENT_ID: !Ref KakaoClientId`. CoursesFunction는 현재 함수레벨 `Environment`가 없고 라우트는 명시 등록(`{proxy+}` 없음).
3. 구현 계획:
   - `Parameters`에:
     ```yaml
     KakaoMobilityRestApiKey:
       Type: String
       Default: ''
       NoEcho: true
       Description: Kakao Mobility REST API key for course route directions (server-only).
     ```
   - CoursesFunction `Properties`에 함수레벨 env 추가(Globals와 병합되어 이 함수만 키 보유 → 최소 노출, Q3):
     ```yaml
     Environment:
       Variables:
         KAKAO_MOBILITY_REST_API_KEY: !Ref KakaoMobilityRestApiKey
     ```
   - `CoursesFunction.Events`에:
     ```yaml
     CoursesRouteRoute:
       Type: HttpApi
       Properties:
         ApiId: !Ref SteelArtHttpApi
         Method: ANY
         Path: /v1/courses/route
         PayloadFormatVersion: '2.0'
     ```
4. 확인 방법:
   `pnpm sam:validate`(또는 `sam validate`).
5. 건드리지 말아야 할 것:
   다른 함수/Globals 공통 변수/CORS/로그 설정.

### Step 11: 배포 워크플로 (`.github/workflows/deploy.yml`)
1. 목표:
   배포 시 GitHub Secret `KAKAO_MOBILITY_REST_API_KEY`가 `KakaoMobilityRestApiKey` 파라미터로 전달된다.
2. 코드베이스 근거:
   `DB_PASSWORD`/`JWT_SECRET`가 `env: ... ${{ secrets.* }}` → `--parameter-overrides DbPassword="${DB_PASSWORD}"` 패턴.
3. 구현 계획:
   - Deploy step `env`에 `KAKAO_MOBILITY_REST_API_KEY: ${{ secrets.KAKAO_MOBILITY_REST_API_KEY }}` 추가.
   - `--parameter-overrides`에 `KakaoMobilityRestApiKey="${KAKAO_MOBILITY_REST_API_KEY}"` 추가.
   - 현재 브랜치에서 이 파일이 수정 중(`M`)이므로 기존 변경과 충돌 없는 위치에 추가.
4. 확인 방법:
   YAML 문법 확인(리뷰), 실제 배포는 사용자 푸시 후 CI에서.
5. 건드리지 말아야 할 것:
   concurrency/권한/기존 파라미터.

### Step 12: 정본 문서 갱신 (`STEELART_SERVER_API_DRAFT.md`)
1. 목표:
   7-12 `구현 상태: 미구현` → `구현 완료`.
2. 코드베이스 근거:
   7-12 섹션 1184행 `- 구현 상태: \`미구현\``.
3. 구현 계획:
   해당 한 줄만 `구현 완료`로 변경. (이 문서는 상위 디렉토리 `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`로 레포 밖 — 경로 주의.)
4. 확인 방법:
   diff 확인.
5. 건드리지 말아야 할 것:
   다른 섹션.

### Step 13: 테스트 (`tests/unit/courses/*`, 신규 provider 테스트, 통합)
1. 목표:
   성공·좌표부족(422)·30초과(400)·카카오실패(502)·입력위반(400) + 라우트 분기 + 좌표조회가 검증된다. 카카오는 mock.
2. 코드베이스 근거:
   `courses-service.test.ts`의 `createCoursesRepositoryStub`/`createCoursesService` 패턴, `courses-handler.test.ts`의 `createCoursesServiceStub`/이벤트 빌더, 통합 테스트의 시드/`handleCoursesRequest(event, ctx, service)` 3-인자 주입.
3. 구현 계획:
   - 스텁 확장: `createCoursesRepositoryStub`에 `async listArtworkCoordinates(ids){ return ids.map(id=>({artwork_id:id, lat:36.0+..., lng:129.0+...})); }`; `createCoursesServiceStub`에 `async getCourseRoute(){ return { vertexes:[{lat,lng},...] }; }`.
   - service 테스트: 프로바이더 stub(`{ async fetchRoute(c){ return [{lat,lng},...]; } }`) 주입. 케이스: 성공 / 좌표부족(repo가 1개만 반환 → 422 ROUTE_UNAVAILABLE) / 30초과(items 31개 → 400 TOO_MANY_WAYPOINTS) / 카카오실패(프로바이더가 502 ROUTE_UNAVAILABLE throw) / 중복·비연속(400 BAD_REQUEST) / (Q2) 일부 작품 누락이지만 유효 ≥2 → 부분 경로 200(프로바이더가 받은 좌표 개수 단언) / (Q3) 연속 동일 좌표 입력 → 압축되어 프로바이더에 고유 좌표만 전달, 압축 후 <2면 422.
   - handler 테스트: POST `/v1/courses/route` 200 + `body.data.vertexes`. event는 `requestContext`/`routeKey`를 `POST /v1/courses/route`로 구성.
   - provider 테스트(신규 `courses-route-provider.test.ts`): `process.env.KAKAO_MOBILITY_REST_API_KEY` 설정 + `resetEnvForTests()`; `globalThis.fetch` 스텁으로 (a) 성공 응답 → vertexes 평탄화 검증, (b) `result_code:1` → 502, (c) `ok:false` → 502, (d) fetch throw → 502, (e) 키 미설정 → 502. 각 테스트 후 fetch 원복.
   - 통합 테스트: 작품/장소 시드 후 실제 repo + stub 프로바이더로 service 구성해 `handleCoursesRequest(routeEvent, ctx, routeService)` 호출 → 200 vertexes. 추가로 1개 작품의 place를 soft-delete(또는 비활성)해 유효 좌표 1개 → 422 검증. `createEvent` 헬퍼에 `/v1/courses/route` 정적 라우트 분기 추가(아래 Step 14).
4. 확인 방법:
   `pnpm test`(유닛), 가능 시 `pnpm test:integration:env`(통합).
5. 건드리지 말아야 할 것:
   기존 테스트 단언.

### Step 14: 통합 테스트 이벤트 헬퍼 보정 (`tests/integration/courses/courses-handler.integration.test.ts`)
1. 목표:
   `createEvent('/v1/courses/route', ...)`가 `routePath='/v1/courses/route'`, `pathParameters={}`로 구성된다(현재 `route`를 `{courseId}`로 오인식).
2. 코드베이스 근거:
   헬퍼의 `detailMatch && !['favorites','mine','recommended'].includes(detailMatch[1])` 분기가 단일 세그먼트를 상세로 처리.
3. 구현 계획:
   제외 리스트에 `'route'` 추가(두 곳: pathParameters, routePath 결정부) → `/v1/courses/route`는 정적 경로로 처리.
4. 확인 방법:
   통합 테스트에서 route 케이스가 올바른 routeKey로 분기.
5. 건드리지 말아야 할 것:
   like/checkin/detail 매칭.

## Checks and Risks
1. 실행할 targeted check:
   1. `pnpm typecheck`(tsc --noEmit, 전체지만 빌드 동등 — Record 누락/타입 강제 확인).
   2. `pnpm test`(유닛 — courses schemas/service/handler + provider).
   3. `pnpm sam:validate`(template.yaml 라우트/파라미터 유효성).
   4. (가능 시) `pnpm test:integration:env`(좌표 조회 + 422).
2. 실행하지 않을 check:
   1. 전체 `pnpm lint`(스크립트가 placeholder no-op이며 RPV 규칙상 전체 lint 미실행).
   2. 실 카카오 호출(mock으로 대체, 키 없음).
3. 주요 위험:
   1. `parseInput` `code:'BAD_REQUEST'`가 모든 스키마 위반을 400으로 만들어 의도(Q1)와 일치하는지 — 테스트로 고정.
   2. 30초과 vs 비연속 동시 입력 시 `TOO_MANY_WAYPOINTS`가 우선해야 함 — 서비스가 30-cap을 contiguity보다 먼저 체크(테스트로 고정).
   3. `deploy.yml` 브랜치 동시 수정 충돌 — 최소 위치 추가, diff 확인.
   4. 통합 DB 부재 시 통합 테스트 Blocked — verification에 명시.
4. fallback:
   통합 DB가 없으면 유닛+provider 테스트로 핵심 분기를 모두 커버하고, 좌표 조회 쿼리는 코드 리뷰 + 기존 동등 쿼리(7-5/7-11) 대조로 검증.

## Review Questions
(모두 해결됨 — plan Q1·Q2·Q3 모두 (A) 승인. 반영 위치:
1. Q1(빈 vertexes → 502): Implementation Sketch 5-8, Step 5(provider), Step 13(provider 테스트).
2. Q2(없는/좌표없는 작품 조용히 제외, droppedArtworkIds 미포함): Sketch 5-5/5-7, Step 6 서비스, Step 13.
3. Q3(연속 동일 좌표 압축): Sketch 5-6, Step 6 서비스 `deduped`, Step 13.
사용자 `승인` 완료 → 검증 시나리오 단계로 진행.)
