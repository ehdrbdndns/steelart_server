# research.md 구현 상세 플랜

## 문서 목적
- 이 문서는 [research.md](/Users/donggyunyang/code/steelart/steelart_server/docs/research.md)에 정리된 `2단계 실행 리서치`를 실제 구현 작업으로 옮기기 위한 상세 플랜이다.
- 대상 범위는 [IMPLEMENTATION_SEQUENCE.md](/Users/donggyunyang/code/steelart/steelart_server/docs/IMPLEMENTATION_SEQUENCE.md)의 `2단계. 공통 런타임 구축`이며, 대상 브랜치는 `codex/02-shared-runtime`이다.

## 목표
- 모든 도메인 Lambda가 공통으로 사용할 `shared` 런타임 모듈을 만든다.
- 이후 3단계 SAM 연결과 4단계 인증/사용자 API 구현 시 공통 기반을 다시 뜯어고치지 않도록 인터페이스를 먼저 고정한다.
- 이번 단계에서는 도메인 비즈니스 로직이 아니라 `env`, `db`, `error`, `response`, `route`, `auth`, `logger`, `geo`, `validation`의 기초를 만드는 데 집중한다.

## 기준 문서
- [research.md](/Users/donggyunyang/code/steelart/steelart_server/docs/research.md)
- [MASTER_PLAN.md](/Users/donggyunyang/code/steelart/steelart_server/docs/MASTER_PLAN.md)
- [IMPLEMENTATION_SEQUENCE.md](/Users/donggyunyang/code/steelart/steelart_server/docs/IMPLEMENTATION_SEQUENCE.md)
- [FOLDER_STRUCTURE_DRAFT.md](/Users/donggyunyang/code/steelart/steelart_server/docs/FOLDER_STRUCTURE_DRAFT.md)
- [SERVER_ARCHITECTURE_DRAFT.md](/Users/donggyunyang/code/steelart/steelart_server/docs/SERVER_ARCHITECTURE_DRAFT.md)

## 범위

### 이번 단계에 포함
- `zod`, `mysql2` 런타임 의존성 추가
- `src/shared` 핵심 모듈 구현
- 공통 모듈을 사용하는 최소 샘플 핸들러 연결
- 타입검사와 기본 단위 테스트 통과
- 이후 단계에서 재사용할 인터페이스와 에러 코드 확정

### 이번 단계에 제외
- 실제 카카오/애플 인증 검증
- 실제 사용자/도메인 service 구현
- SAM 템플릿 상세 작성
- GitHub Actions 상세 작성
- 실제 RDS Proxy, Secrets Manager 연동
- 체크인 허용 오차 정책 확정

## 구현 순서

### 0. 작업 브랜치 준비
- 상태: 완료
- `main` 최신 상태에서 `codex/02-shared-runtime` 브랜치를 생성한다.
- 1단계 산출물이 모두 존재하는지 확인한다.

### 1. 현재 상태 확인
- 상태: 완료
- `package.json`에 `zod`, `mysql2`가 아직 없는지 확인한다.
- `src/shared/*`가 현재 `.gitkeep` 상태인지 확인한다.
- 테스트 러너는 우선 `node:test`를 기준으로 잡을지 확인한다.

### 2. 의존성 추가
- 상태: 완료
- `package.json`에 런타임 의존성 추가:
  - `zod`
  - `mysql2`
- 필요 시 테스트 스크립트를 `node --test` 또는 동등한 최소 명령으로 갱신한다.

### 3. 공통 에러와 validation 유틸 구현
- 상태: 완료
- `src/shared/api/errors.ts`
- `src/shared/validation/parse.ts`

#### `errors.ts` 목표
- `AppError` 공통 클래스 정의
- 공통 에러 코드 enum 또는 union 정의
- status code 매핑 정의
- unknown error를 `INTERNAL_ERROR`로 감싸는 helper 준비

#### `parse.ts` 목표
- `zod` schema를 `safeParse`로 실행하는 공통 함수 정의
- `ZodError`를 `VALIDATION_ERROR` 형태의 `AppError`로 변환
- field-level details를 일관된 구조로 정리

### 4. 환경변수 파서 구현
- 상태: 완료
- `src/shared/env/server.ts`

#### 목표
- `process.env`를 읽어 `zod`로 검증한 뒤 singleton export
- 문자열 입력을 필요한 타입으로 coercion
- 잘못된 설정은 cold start 시 바로 실패

#### 포함할 키
- `APP_ENV`
- `AWS_REGION`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`
- 선택 가능:
  - `LOG_LEVEL`
  - `DB_SSL_CA_PATH`

### 5. logger와 response 유틸 구현
- 상태: 완료
- `src/shared/logger/logger.ts`
- `src/shared/api/response.ts`

#### `logger.ts` 목표
- request id를 담는 구조화 logger 생성
- `info`, `warn`, `error`, `debug` 수준 함수 제공
- `console` 기반 JSON 로그 한 줄 출력

#### `response.ts` 목표
- 성공 응답 helper
- 실패 응답 helper
- `{ data, meta, error }` 응답 구조 고정
- `statusCode`, `headers`, `body`를 명시적으로 반환

### 6. DB pool / transaction 구현
- 상태: 완료
- `src/shared/db/pool.ts`
- `src/shared/db/tx.ts`

#### `pool.ts` 목표
- `mysql2/promise` pool singleton 생성
- `getPool`, `withConnection` 제공
- pool 옵션을 최소한으로 고정

#### `tx.ts` 목표
- `withTransaction` helper 제공
- begin/commit/rollback/release 반복 제거

#### 주의
- 요청 흐름에서 `pool.end()`를 호출하지 않는다.
- 테스트 환경에서만 close helper가 필요하면 별도 export 한다.

### 7. route / auth / geo 유틸 구현
- 상태: 완료
- `src/shared/api/route.ts`
- `src/shared/auth/guard.ts`
- `src/shared/geo/distance.ts`

#### `route.ts` 목표
- HTTP API v2 이벤트 정규화
- method/path/query/body 접근 helper 제공
- `getQueryList()`로 comma-separated query도 해석
- JSON body parse 실패 시 공통 에러 반환

#### `guard.ts` 목표
- `Authorization` 헤더에서 Bearer 토큰 추출
- `requireAuth`, `optionalAuth` 인터페이스 제공
- 실제 토큰 검증 함수 연결 자리는 남겨두되, 인증 완성은 4단계로 미룸

#### `distance.ts` 목표
- haversine 또는 동등한 미터 단위 거리 계산
- `calculateDistanceMeters`
- `isWithinRadiusMeters`
- 위도/경도 범위 validation 포함

### 8. 샘플 핸들러 연결
- 상태: 완료
- [src/lambdas/auth/handler.ts](/Users/donggyunyang/code/steelart/steelart_server/src/lambdas/auth/handler.ts) 또는 [src/lambdas/users/handler.ts](/Users/donggyunyang/code/steelart/steelart_server/src/lambdas/users/handler.ts) 중 하나를 샘플 연결 대상으로 선택한다.

#### 목표
- 공통 route helper
- logger
- response helper
- optional auth 또는 require auth
- env read
중 최소 2~4개를 실제로 연결해서 사용 예제를 만든다.

#### 범위 제한
- 여전히 도메인 비즈니스 로직은 넣지 않는다.
- 응답은 `NOT_IMPLEMENTED` placeholder를 유지해도 된다.

### 9. 테스트 작성
- 상태: 완료
- `tests/unit/` 아래에 최소 단위 테스트 추가

#### 우선순위
1. `distance.ts`
2. `errors.ts` / `parse.ts`
3. `response.ts`
4. `route.ts`

#### 최소 케이스
- 동일 좌표 거리 0
- 반경 포함/제외 판정
- validation 실패 시 `VALIDATION_ERROR`
- response helper가 공통 shape 유지
- route helper가 comma-separated query를 분리

### 10. 문서 정합성 맞추기
- 상태: 완료
- 실제 생성 파일이 [FOLDER_STRUCTURE_DRAFT.md](/Users/donggyunyang/code/steelart/steelart_server/docs/FOLDER_STRUCTURE_DRAFT.md)와 크게 어긋나지 않는지 확인한다.
- 필요 시 해당 문서의 “처음 바로 만들어야 할 파일” 목록과 맞춘다.
- 이번 단계 범위를 넘는 구현이 들어갔는지 점검한다.

### 11. 로컬 검증
- 상태: 완료
- `pnpm install`
- `pnpm typecheck`
- `pnpm test`
- 필요 시 `pnpm build`

### 12. 결과 점검
- 상태: 완료
- 공통 모듈 import가 정상 동작하는지 확인한다.
- 도메인 구현 없이도 `shared` 레이어 단독으로 재사용 가능한지 확인한다.
- 3단계 SAM 템플릿과 4단계 auth/users 구현이 이 기반 위에 바로 올라갈 수 있는지 확인한다.

### 13. 브랜치 정리 및 PR 생성
- 상태: 진행 중
- 변경 파일이 이번 단계 범위 안에 있는지 최종 확인한다.
- 검증 결과를 기준으로 커밋 메시지를 정리한다.
- `codex/02-shared-runtime` 브랜치를 원격에 push 한다.
- PR 템플릿에 맞춰 요약, 범위, 검증 결과, 리뷰 포인트를 작성한다.
- `main` 대상으로 PR을 생성한다.
- PR 본문에는 이번 단계에서 아직 하지 않은 범위도 명시한다.

## 파일별 예상 결과

### `src/shared/api/errors.ts`
- 공통 에러 코드와 `AppError`
- `isAppError`, `toAppError` 같은 최소 helper

### `src/shared/validation/parse.ts`
- schema safe parse helper
- `ZodError -> AppError` 변환

### `src/shared/env/server.ts`
- `env` singleton export
- 숫자 coercion과 필수값 검증

### `src/shared/logger/logger.ts`
- request id 포함 JSON logger

### `src/shared/api/response.ts`
- 성공/실패 응답 helper
- 공통 headers

### `src/shared/db/pool.ts`
- `getPool`
- `withConnection`

### `src/shared/db/tx.ts`
- `withTransaction`

### `src/shared/api/route.ts`
- method/path/query/body helper
- multi-value query 해석 helper

### `src/shared/auth/guard.ts`
- bearer token 추출
- `requireAuth`, `optionalAuth`
- `AuthContext` 타입

### `src/shared/geo/distance.ts`
- 미터 단위 거리 계산
- 반경 판정 helper

## 검증 체크리스트

### 구조 체크
- `src/shared/*` 핵심 파일이 실제 구현 파일로 채워진다.
- placeholder `.gitkeep`만 남아 있지 않다.
- 도메인 디렉터리에는 아직 비즈니스 구현이 들어가지 않는다.

### 설정 체크
- `package.json`에 `zod`, `mysql2`가 추가된다.
- 테스트 스크립트가 최소한의 shared 단위 테스트를 실행할 수 있다.
- `.env.example`가 필요하면 새 키를 반영하되 실제 값은 없다.

### 실행 체크
- `pnpm install` 성공
- `pnpm typecheck` 성공
- `pnpm test` 성공
- 샘플 핸들러가 shared 모듈 import 기준으로 타입 오류가 없다

### 기능 체크
- env parser가 필수값 누락을 잡는다
- response helper가 일관된 응답 shape를 보장한다
- route helper가 HTTP API v2 query/body를 읽을 수 있다
- auth guard가 bearer token 유무를 판별한다
- geo helper가 기본 거리 계산을 통과한다
- transaction helper가 commit/rollback/release 흐름을 캡슐화한다

### 범위 체크
- 실제 소셜 로그인 검증을 구현하지 않았다
- 실제 사용자/작품/코스 비즈니스 로직을 넣지 않았다
- SAM/CI 상세 구현을 섞지 않았다

## 예상 리스크
- route helper를 과하게 일반화하면 실제 도메인 구현 전에 복잡도가 커질 수 있다.
- auth guard 인터페이스를 너무 빨리 굳히면 4단계 인증 구현 때 다시 손봐야 할 수 있다.
- DB pool 옵션을 과하게 확정하면 Lambda 환경과 실제 배포 단계에서 조정이 필요할 수 있다.
- validation details 구조를 과하게 상세화하면 앱/서버 계약이 아직 없는 상태에서 과설계가 될 수 있다.

## 대응 원칙
- 공통 유틸은 “최소하지만 실제로 재사용 가능한” 수준까지만 만든다.
- domain-specific 판단은 넣지 않는다.
- unknown error와 validation error만 명확히 구분해도 2단계 목표는 달성한 것으로 본다.
- logger, route, auth는 인터페이스 우선으로 만들고 구현은 얇게 유지한다.

## 이번 단계 완료 조건
- `src/shared` 핵심 모듈이 모두 구현되어 있다.
- 공통 모듈을 사용하는 샘플 핸들러가 최소 하나 존재한다.
- `pnpm typecheck`와 `pnpm test`가 통과한다.
- 공통 응답, 공통 에러, 공통 validation, 공통 거리 계산이 코드로 재사용 가능한 상태다.
- 다음 브랜치 `codex/03-sam-http-api-cicd`와 `codex/04-auth-users`에서 shared 레이어를 그대로 사용할 수 있다.
- 원격 브랜치가 push 되어 있고 `main` 대상 PR이 생성되어 있다.

## 한 줄 결론
- `research.md`를 구현하는 2단계 작업은 `shared` 런타임 인터페이스를 먼저 굳히는 단계이며, `zod + mysql2 + HTTP API v2 + 구조화 로그`를 기준으로 공통 모듈을 작고 명확하게 만드는 것이 핵심이다.
