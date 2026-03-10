# 2단계 실행 리서치

## 문서 목적
- 이 문서는 [IMPLEMENTATION_SEQUENCE.md](/Users/donggyunyang/code/steelart/steelart_server/docs/IMPLEMENTATION_SEQUENCE.md)의 `2단계. 공통 런타임 구축`을 실제로 시작하기 전에 필요한 자료를 모아둔 리서치 문서다.
- 대상 브랜치는 `codex/02-shared-runtime`이다.
- 기존 `research.md`의 1단계 내용은 제거하고, 2단계 전용 내용만 남긴다.

## 대상 단계 요약
- 목표: 모든 도메인이 공통으로 사용할 런타임 기반을 만든다.
- 구현 범위:
  - 환경변수 파서
  - DB pool / transaction 유틸
  - 공통 에러 타입 / 에러 코드
  - 공통 응답 유틸 `{ data, meta, error }`
  - request id / logger 유틸
  - 공통 라우트 헬퍼
  - auth guard 기본 구조
  - geo distance 유틸
- 산출물:
  - `src/shared/*` 핵심 모듈
  - 공통 코드 사용 예제 또는 최소 샘플 핸들러

## 2단계에서 바로 결정해도 되는 것
- 런타임 의존성은 `zod`, `mysql2`를 추가한다.
- 공통 모듈은 `src/shared` 아래에서만 만든다.
- Lambda 핸들러는 계속 얇게 유지하고, 공통 헬퍼만 연결한다.
- API Gateway는 `HTTP API` 전제를 유지한다.
- 응답은 항상 `{ data, meta, error }` 형태로 고정한다.

## 2단계에서 아직 미루는 것
- 실제 소셜 로그인 검증
- 실제 사용자/도메인 비즈니스 로직
- SAM 템플릿 상세와 GitHub Actions 구현
- RDS Proxy 연동
- Secrets Manager 실사용 연동

## 이번 단계에서 추가할 패키지

### 런타임 의존성
- `zod`
- `mysql2`

### 추가 라이브러리를 당장 넣지 않아도 되는 영역
- 로거는 외부 라이브러리 없이 `console` 기반 구조화 로그로 시작해도 충분하다.
- 라우터 프레임워크는 도입하지 않는다.
- 테스트 러너는 `Node.js 24`의 내장 `node:test`를 우선 검토할 수 있다.

## 권장 파일 목록
- `src/shared/env/server.ts`
- `src/shared/db/pool.ts`
- `src/shared/db/tx.ts`
- `src/shared/api/errors.ts`
- `src/shared/api/response.ts`
- `src/shared/api/route.ts`
- `src/shared/auth/guard.ts`
- `src/shared/logger/logger.ts`
- `src/shared/geo/distance.ts`
- `src/shared/validation/parse.ts`

## 모듈별 조사 결과

### 1. 환경변수 파서

#### 필요한 이유
- Lambda 환경변수는 런타임에서 문자열로 들어오므로 애플리케이션 시작 시점에 한 번 파싱하고 고정하는 편이 안전하다.
- 2단계부터 `DB_PORT`, `APP_ENV`, `JWT_SECRET` 같은 값의 누락 여부를 조기에 잡아야 한다.

#### 구현 기준
- `process.env`를 입력으로 받고 `zod`로 검증한다.
- `DB_PORT`는 문자열 입력을 숫자로 coercion 한다.
- 결과는 `env` singleton으로 export 한다.
- 파싱 실패 시 즉시 예외를 던져 cold start 단계에서 잘못된 설정을 드러낸다.

#### 초기 키 제안
- `APP_ENV`
- `AWS_REGION`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`
- 선택:
  - `LOG_LEVEL`
  - `DB_SSL_CA_PATH`

#### 메모
- AWS는 비밀값에 일반 환경변수 대신 `Secrets Manager` 사용을 권장한다. 다만 현재 단계에서는 인터페이스를 먼저 고정하고, 실제 secret sourcing은 뒤 단계에서 바꿔도 된다.
- `Node.js`는 `process.env`를 기본 환경변수 인터페이스로 제공한다.

### 2. DB pool 유틸

#### 필요한 이유
- 이후 모든 repository가 같은 연결 정책을 재사용해야 한다.
- Lambda에서 요청마다 새 연결 설정 코드를 반복하면 코드가 쉽게 흩어진다.

#### 구현 기준
- `mysql2/promise`의 `createPool`을 사용한다.
- pool은 모듈 스코프 singleton으로 만들고 재사용한다.
- 기본 옵션 후보:
  - `waitForConnections: true`
  - `connectionLimit`: 작은 값으로 시작
  - `queueLimit: 0`
  - `enableKeepAlive: true`
- SQL 실행은 기본적으로 `execute`를 우선 사용한다.

#### Lambda 관점 메모
- AWS Lambda는 실행 환경 재사용을 권장하므로 DB 연결 객체도 핸들러 바깥에서 재사용하는 쪽이 맞다.
- Node.js Lambda는 keep-alive 사용을 권장한다.
- Node.js 20 이상 Lambda는 추가 CA 인증서를 자동 로드하지 않으므로, RDS SSL을 강제할 경우 CA 번들 경로를 명시적으로 다뤄야 한다.

#### 2단계에서 필요한 최소 API
- `getPool()`
- `withConnection(fn)`
- 선택:
  - `closePool()` for tests only

### 3. 트랜잭션 유틸

#### 필요한 이유
- 이후 코스 생성/수정, 좋아요 토글, 체크인 같은 write API에서 트랜잭션 경계가 필요하다.
- 서비스 계층이 매번 `beginTransaction`, `commit`, `rollback`, `release`를 직접 반복하지 않도록 해야 한다.

#### 구현 기준
- pool에서 connection을 받아 `beginTransaction` 후 callback을 실행한다.
- 성공 시 `commit`, 실패 시 `rollback`, 마지막에 항상 `release`.
- callback 반환값을 그대로 반환한다.

#### 2단계에서 필요한 최소 API
- `withTransaction<T>(fn: (connection) => Promise<T>): Promise<T>`

### 4. 공통 에러 타입 / 에러 코드

#### 필요한 이유
- 응답 포맷과 로깅이 일관되려면 애플리케이션 오류를 공통 타입으로 올리는 편이 낫다.
- 아직 도메인 API가 없더라도 인증 실패, 검증 실패, not found, method not allowed 같은 공통 오류는 지금 고정할 수 있다.

#### 2단계에서 고정할 최소 코드
- `BAD_REQUEST`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `METHOD_NOT_ALLOWED`
- `VALIDATION_ERROR`
- `CONFLICT`
- `INTERNAL_ERROR`

#### 구현 기준
- `AppError` 같은 공통 클래스 하나로 시작한다.
- 필드 권장안:
  - `code`
  - `message`
  - `statusCode`
  - `details`
- domain-specific code는 나중 단계에서 추가한다.

#### 메모
- 2단계에서는 공통 코드만 정의하고, 체크인 거리 실패 같은 도메인 코드는 6단계 이후에 붙이는 편이 낫다.

### 5. 공통 응답 유틸

#### 필요한 이유
- 루트 API 초안에서 `{ data, meta, error }` 형태를 이미 제안하고 있다.
- 도메인별 핸들러가 각자 응답 모양을 만들면 계약이 쉽게 흔들린다.

#### 구현 기준
- 성공 응답 helper:
  - `ok(data, meta?)`
- 실패 응답 helper:
  - `fail(appError, meta?)`
- HTTP API v2 응답은 명시적으로 `statusCode`, `headers`, `body`를 반환한다.
- `content-type`은 `application/json; charset=utf-8`로 고정한다.

#### 왜 명시적 응답이 필요한가
- AWS 문서상 payload format 2.0에서는 `statusCode` 없이 JSON을 반환해도 자동 추론이 가능하다.
- 그래도 공통 유틸은 항상 명시형 응답을 만들도록 두는 편이 테스트와 디버깅에 유리하다.

### 6. request id / logger 유틸

#### 필요한 이유
- 인증, DB, 라우트, 에러를 묶어서 볼 때 공통 request id가 없으면 Lambda 로그 추적이 불편하다.
- `2단계`에서 이 기반을 잡아야 이후 도메인 로그가 같은 형식으로 쌓인다.

#### request id 기준
- 1순위: `event.requestContext.requestId`
- 2순위: `context.awsRequestId`

#### 구현 기준
- `createLogger(baseContext)` 형태의 작은 유틸로 시작한다.
- 출력은 JSON 객체 한 줄로 고정한다.
- 권장 필드:
  - `level`
  - `message`
  - `requestId`
  - `path`
  - `method`
  - `domain`
  - `timestamp`
  - `extra`

#### 메모
- Lambda는 `console.log`, `console.error` 출력을 CloudWatch Logs로 보낸다.
- 현재 단계에서는 외부 logger 패키지보다 구조화 포맷만 고정하는 쪽이 더 중요하다.

### 7. 공통 라우트 헬퍼

#### 필요한 이유
- 이 서버는 도메인별 Lambda 구조를 쓰므로, 각 핸들러 안에서 메서드/세그먼트 분기 정도는 반복된다.
- 하지만 라우팅 프레임워크까지 넣을 정도는 아니므로, HTTP API 이벤트를 정규화하는 작은 헬퍼가 적절하다.

#### HTTP API v2에서 꼭 알아야 할 점
- 이벤트 버전은 `2.0` 형식이다.
- `rawPath`, `rawQueryString`, `cookies`, `requestContext.http.method` 등을 사용한다.
- 중복 query string 값은 payload format 2.0에서 쉼표로 합쳐질 수 있다.

#### SteelArt에 중요한 해석
- `placeId=1&placeId=2` 같은 반복 쿼리는 이후 `artworks` 필터에서 반드시 필요하다.
- 따라서 route/query helper는 단일 값 getter 외에 `getQueryList()` 같은 다중 값 해석기를 가져야 한다.
- 이 부분은 AWS 문서의 payload 2.0 동작을 SteelArt 필터 규칙에 맞게 적용한 추론이다.

#### 2단계에서 필요한 최소 기능
- method 추출
- path 추출
- path segment 추출
- query 단일 값 추출
- query 다중 값 추출
- JSON body 파싱
- route miss 시 `METHOD_NOT_ALLOWED`, `NOT_FOUND` 응답 연결

### 8. auth guard 기본 구조

#### 필요한 이유
- 실제 로그인 API는 4단계에 구현되지만, 보호 라우트가 사용할 guard 인터페이스는 2단계에서 미리 정하는 편이 낫다.
- 그렇지 않으면 `auth`, `users`, `courses` 도메인이 각자 인증 체크 방식을 만들게 된다.

#### 2단계에서 해야 할 최소 구현
- `Authorization` 헤더에서 Bearer 토큰 추출
- 토큰 없음 -> `UNAUTHORIZED`
- guard 인터페이스와 `AuthContext` 타입 정의
- 미래의 토큰 검증 함수를 연결할 자리 마련

#### 2단계에서 하지 않을 것
- 카카오/애플 토큰 검증
- 사용자 조회까지 포함한 실제 인증 완성
- refresh token 정책

#### 권장 인터페이스
- `getBearerToken(headers)`
- `requireAuth(event, context?)`
- `optionalAuth(event, context?)`

### 9. geo distance 유틸

#### 필요한 이유
- 지도 거리 계산과 체크인 반경 계산을 서로 다른 코드로 구현하면 같은 좌표인데 결과가 달라질 수 있다.
- 현재 문서 기준으로 거리 규칙은 공통 모듈로 빼는 것이 맞다.

#### 구현 기준
- 입력:
  - `lat`
  - `lng`
- 출력:
  - 미터 단위 숫자
- 권장 함수:
  - `calculateDistanceMeters(from, to)`
  - `isWithinRadiusMeters(from, to, radiusMeters)`

#### 검증 포인트
- 동일 좌표 -> `0`
- 반경 경계 근처 -> 오차 허용 범위 확인
- 위도/경도 범위 외 값 -> 즉시 예외

#### 메모
- 체크인 허용 오차 정책 자체는 아직 확정되지 않았으므로, 2단계에서는 순수 거리 계산 함수까지만 만드는 편이 맞다.

### 10. validation parse 유틸

#### 필요한 이유
- 모든 라우트에서 `schema.parse()`와 에러 포맷팅을 중복 작성하면 금방 반복이 심해진다.
- `zod` 에러를 공통 `AppError`로 바꾸는 접점이 필요하다.

#### 구현 기준
- `safeParse`를 우선 사용한다.
- 실패 시 `ZodError`를 `VALIDATION_ERROR`로 감싼다.
- field-level error는 `flattenError` 또는 동등한 포맷으로 내려주면 이후 앱 디버깅에 유리하다.

## 2단계 구현 순서 제안
1. `zod`, `mysql2` 설치
2. `shared/api/errors.ts`
3. `shared/validation/parse.ts`
4. `shared/env/server.ts`
5. `shared/logger/logger.ts`
6. `shared/api/response.ts`
7. `shared/db/pool.ts`
8. `shared/db/tx.ts`
9. `shared/api/route.ts`
10. `shared/auth/guard.ts`
11. `shared/geo/distance.ts`
12. `auth`, `users` placeholder handler 중 하나를 공통 유틸 예제로 갱신

## 2단계 검증 기준을 코드로 바꾸면 필요한 항목

### import / 타입
- `pnpm typecheck` 통과
- shared 모듈 간 순환 참조 없음

### 응답 유틸
- 성공/실패 응답이 모두 `{ data, meta, error }`를 유지
- `statusCode`, `headers`, `body`가 명시적으로 들어감

### DB 유틸
- pool singleton 생성
- connection acquire / release 정상 동작
- transaction success 시 commit
- failure 시 rollback 후 release

### logger / request id
- HTTP API 이벤트가 있으면 `requestContext.requestId` 사용
- 없으면 `awsRequestId` fallback

### route helper
- method/path 추출 정상 동작
- comma-separated query list 분해 동작
- JSON body parse 실패 시 `BAD_REQUEST` 또는 `VALIDATION_ERROR`

### geo
- 동일 좌표 0m 테스트 통과
- 기본 반경 포함 여부 테스트 통과

## 주의할 점
- `HTTP API` payload 2.0은 multi-value query string 전용 필드가 없다.
- 따라서 반복 쿼리를 단순 `queryStringParameters[name]`만 읽으면 SteelArt 필터 요구사항을 놓칠 수 있다.
- Lambda에서 DB pool을 요청마다 새로 만들지 않는다.
- `pool.end()`는 일반 요청 흐름에서 호출하지 않는다.
- 공통 런타임 단계에서 도메인 로직을 섞지 않는다.
- logger에 raw token, password, 전체 user payload를 그대로 찍지 않는다.

## 남아 있는 확인 포인트
- 실제 앱 토큰 포맷을 JWT로 바로 갈지, 4단계에서 더 정교하게 정할지
- RDS SSL 연결을 stage 2에서 바로 반영할지, stage 3 인프라 단계에서 묶을지
- validation error의 `details`를 앱에 어느 정도까지 노출할지

## 공식 참고 자료
- AWS Lambda Node.js: [Building Lambda functions with Node.js](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html)
- AWS Lambda 환경변수: [Working with Lambda environment variables](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html)
- AWS Lambda context: [Using the Lambda context object](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html)
- API Gateway HTTP API Lambda payload v2.0: [Create AWS Lambda proxy integrations for HTTP APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html)
- Node.js 환경변수: [Environment Variables](https://nodejs.org/api/environment_variables.html)
- Node.js 테스트 러너: [Test runner](https://nodejs.org/api/test.html)
- mysql2 문서: [MySQL2 Documentation](https://sidorares.github.io/node-mysql2/)
- zod 기본 사용: [Zod Basics](https://zod.dev/basics)
- zod 에러 포맷: [Formatting errors](https://zod.dev/error-formatting)

## 한 줄 결론
- 2단계는 `shared` 레이어의 인터페이스를 굳히는 단계이며, 특히 `HTTP API v2 query 처리`, `Lambda 재사용 가능한 DB pool`, `zod 기반 env/validation`, `request id가 포함된 구조화 로그`를 먼저 제대로 잡는 것이 핵심이다.
