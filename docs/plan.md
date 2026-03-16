# 4단계 상세 실행 계획

## 문서 목적
- 이 문서는 [IMPLEMENTATION_SEQUENCE.md](./IMPLEMENTATION_SEQUENCE.md)의 `4단계. 인증 및 사용자 API`를 실제 구현으로 옮기기 위한 상세 플랜이다.
- 대상 브랜치는 `codex/04-auth-users`다.
- 구현 순서, 수정 파일, 검증 기준, 완료 조건, 마지막 PR 생성 단계까지 한 번에 정리한다.

## 기준 문서
- [research.md](./research.md)
- [IMPLEMENTATION_SEQUENCE.md](./IMPLEMENTATION_SEQUENCE.md)
- [MASTER_PLAN.md](./MASTER_PLAN.md)
- [SERVER_ARCHITECTURE_DRAFT.md](./SERVER_ARCHITECTURE_DRAFT.md)
- [FOLDER_STRUCTURE_DRAFT.md](./FOLDER_STRUCTURE_DRAFT.md)
- [STEELART_SERVER_API_DRAFT.md](../../STEELART_SERVER_API_DRAFT.md)
- [STEELART_DB_TABLES.md](../../STEELART_DB_TABLES.md)

## 단계 목표
- 앱이 카카오/애플 로그인 후 온보딩과 마이페이지 진입까지 필요한 최소 서버 API를 사용할 수 있게 만든다.
- access JWT 발급/검증, `user_auth_providers` 기반 소셜 로그인 매핑, `user_refresh_tokens` 기반 refresh token 저장, 온보딩 저장, 프로필 조회/수정, 설정 수정까지 연결한다.
- access token 만료 시 `401 -> /v1/auth/refresh -> 원래 요청 재시도` 흐름이 가능해야 한다.
- 4단계가 끝나면 앱이 `로그인 -> 온보딩 -> 메인 진입 전 프로필/설정 확인` 흐름을 서버 기준으로 수행할 수 있어야 한다.

## 이번 단계에 포함하는 범위
- `POST /v1/auth/kakao`
- `POST /v1/auth/apple`
- `POST /v1/auth/refresh`
- `GET /v1/auth/me`
- `PATCH /v1/users/me/onboarding`
- `GET /v1/users/me`
- `PATCH /v1/users/me`
- `PATCH /v1/me/notifications`
- `PATCH /v1/me/language`
- `JWT_SECRET` 기반 access JWT 발급/검증
- `user_refresh_tokens` 기반 refresh token 발급/저장
- `user_auth_providers` 기반 소셜 로그인 사용자 매핑
- `onboardingCompleted` 파생 계산
- 최소 단위 테스트

## 이번 단계에서 제외하는 범위
- 로그아웃 API
- Apple authorization code 교환
- `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` 기반 client secret 생성
- 닉네임 중복 확인 전용 API
- 홈, 검색, 작품, 지도, 코스 읽기 API
- 체크인, 좋아요, 사용자 생성 코스
- 운영 배포 파이프라인 추가 변경

## 구현 전 고정 결정
- 앱 access token은 `JWT_SECRET` 기반 JWT로 구현한다.
- refresh token은 `user_refresh_tokens`에서 관리한다.
- 회원가입이 일어나는 최초 로그인 시점에는 refresh token도 반드시 생성한다.
- refresh token 만료 기한은 발급 시점 기준 `30일`로 둔다.
- 보호 API에서 access token이 만료되면 `401 ACCESS_TOKEN_EXPIRED`를 반환한다.
- 앱은 이 경우 `POST /v1/auth/refresh`로 새 access token을 발급받아 원래 요청을 재시도한다.
- refresh token이 만료되었으면 `401 REFRESH_TOKEN_EXPIRED`를 반환하고 앱은 재로그인한다.
- 소셜 로그인 매핑은 `users` 직접 컬럼이 아니라 `user_auth_providers`를 사용한다.
- Apple 로그인은 4단계에서 `identityToken` 검증만 먼저 구현한다.
- 닉네임은 중복을 허용하며, 별도 중복 확인 로직을 두지 않는다.
- access token 만료 기한은 발급 시점 기준 `1시간`으로 둔다.
- `onboardingCompleted`는 아래 3개 값이 모두 채워졌을 때 `true`로 계산한다.
  - `nickname`
  - `residency`
  - `age_group`
- `GET /v1/auth/me`의 무효 토큰은 `401 UNAUTHORIZED`로 처리한다.

## 구현 전 확인사항
- `src/shared/auth/guard.ts`는 현재 Bearer 토큰 추출만 하고 있다.
- `src/lambdas/auth/handler.ts`, `src/lambdas/users/handler.ts`는 placeholder 상태다.
- `src/domains/auth`, `src/domains/users`, `src/shared/auth/token.ts`, `src/shared/auth/providers/*`는 아직 실제 파일이 없다.
- `user_auth_providers`, `user_refresh_tokens`는 [STEELART_DB_TABLES.md](../../STEELART_DB_TABLES.md)에 server-standard schema로 고정했다.
- 따라서 4단계 SQL은 아래 표준 컬럼명을 기준으로 바로 작성한다.
  - `user_auth_providers`
    - `id`, `user_id`, `provider`, `provider_user_id`, `created_at`, `updated_at`
  - `user_refresh_tokens`
    - `id`, `user_id`, `refresh_token`, `expires_at`, `revoked_at`, `created_at`, `updated_at`

## 수정 대상 파일

### 새로 만들 파일
- `src/shared/auth/token.ts`
- `src/shared/auth/providers/kakao.ts`
- `src/shared/auth/providers/apple.ts`
- `src/domains/auth/service.ts`
- `src/domains/auth/repository.ts`
- `src/domains/auth/schemas.ts`
- `src/domains/auth/mapper.ts`
- `src/domains/auth/types.ts`
- `src/domains/users/service.ts`
- `src/domains/users/repository.ts`
- `src/domains/users/schemas.ts`
- `src/domains/users/mapper.ts`
- `src/domains/users/types.ts`
- `tests/unit/auth-token.test.ts`
- `tests/unit/auth-schemas.test.ts`
- `tests/unit/users-schemas.test.ts`
- `tests/unit/auth-refresh.test.ts`
- 필요 시 handler/service 단위 테스트 파일

### 수정할 파일
- `src/shared/auth/guard.ts`
- `src/lambdas/auth/handler.ts`
- `src/lambdas/users/handler.ts`
- `src/shared/env/server.ts`
- `package.json`
- 필요 시 `.env.example`
- 필요 시 [STEELART_SERVER_API_DRAFT.md](../../STEELART_SERVER_API_DRAFT.md)
- 필요 시 [STEELART_DB_TABLES.md](../../STEELART_DB_TABLES.md)

## 구현 원칙
- 핸들러는 얇게 유지한다.
- 외부 provider 호출은 `shared/auth/providers/*`에 둔다.
- 토큰 서명/검증은 `shared/auth/token.ts`로 모은다.
- refresh token 저장은 repository에서 처리한다.
- DB 접근은 `domains/*/repository.ts`에만 둔다.
- 응답 포맷은 반드시 `{ data, meta, error }`를 유지한다.
- access token에는 프로필 정보를 넣지 않고 `sub` 중심 최소 claim만 넣는다.
- 로그인/프로필 API 응답 DTO는 루트 API 초안과 최대한 맞춘다.

## 상세 실행 순서

### 0단계. 입력값과 구현 결정 고정
- 상태: 완료
- 작업
  - 4단계 범위를 이 문서 기준으로 고정한다.
  - `access JWT`, `refresh token`, `user_auth_providers`, `user_refresh_tokens`, `identityToken only`, `onboardingCompleted` 계산 규칙을 재확인한다.
  - `/v1/auth/me` 무효 토큰 처리 방식을 최종 결정한다.
- 권장 결정
  - 무효 토큰 -> `401`
- 완료 기준
  - 구현 도중 다시 흔들릴 핵심 결정이 남지 않는다.

### 1단계. 인증/사용자 도메인 파일 골격 생성
- 상태: 완료
- 작업
  - `auth`, `users` 도메인 폴더의 `service.ts`, `repository.ts`, `schemas.ts`, `mapper.ts`, `types.ts`를 만든다.
  - `shared/auth/token.ts`, `shared/auth/providers/kakao.ts`, `shared/auth/providers/apple.ts`를 만든다.
  - 각 파일에는 최소 export 구조만 먼저 만든다.
- 완료 기준
  - 이후 단계에서 import path 없이 바로 구현을 채울 수 있다.

### 2단계. 앱 JWT 유틸 구현
- 상태: 완료
- 작업
  - `shared/auth/token.ts`에 access JWT sign/verify/decode 유틸을 구현한다.
  - refresh token 생성 유틸을 구현한다.
  - refresh token 만료일 계산 유틸을 구현한다.
  - 최소 access token claim을 정한다.
    - `sub`
    - `iat`
    - `exp`
  - 토큰 만료/서명 실패를 `UNAUTHORIZED`로 변환하는 기준을 정한다.
  - `shared/auth/guard.ts`를 확장해 내부 user id까지 반환할 수 있게 만든다.
- 대상 파일
  - `src/shared/auth/token.ts`
  - `src/shared/auth/guard.ts`
- 완료 기준
  - 보호 라우트에서 토큰 문자열이 아니라 인증된 내부 사용자 ID를 얻을 수 있다.
  - 로그인 서비스에서 access token과 refresh token을 함께 만들 수 있다.
  - refresh token 만료일을 일관되게 계산할 수 있다.

### 3단계. 요청 스키마와 도메인 타입 정의
- 상태: 완료
- 작업
  - `auth` 요청 스키마를 정의한다.
    - `kakaoLoginSchema`
    - `appleLoginSchema`
  - `users` 요청 스키마를 정의한다.
    - `onboardingUpdateSchema`
    - `profileUpdateSchema`
    - `notificationsUpdateSchema`
    - `languageUpdateSchema`
  - `residency`, `age_group`, `language` enum을 타입과 schema에서 통일한다.
- 대상 파일
  - `src/domains/auth/schemas.ts`
  - `src/domains/auth/types.ts`
  - `src/domains/users/schemas.ts`
  - `src/domains/users/types.ts`
- 완료 기준
  - 모든 입력이 `zod` 기준으로 검증 가능하다.

### 4단계. `user_auth_providers`, `user_refresh_tokens`, `users` 읽기/쓰기 저장소 구현
- 상태: 완료
- 작업
  - 내부 사용자 조회/생성 repository를 구현한다.
  - `user_auth_providers`에서 provider + provider user id 기준 조회 로직을 구현한다.
  - 신규 로그인 사용자를 위한 생성 흐름을 구현한다.
    1. `users` insert
    2. `user_auth_providers` insert
    3. `user_refresh_tokens` insert
  - refresh token 저장 로직을 구현한다.
  - refresh token lookup / 만료 확인용 조회 로직을 구현한다.
  - 온보딩/프로필/설정 update SQL을 구현한다.
- 대상 파일
  - `src/domains/auth/repository.ts`
  - `src/domains/users/repository.ts`
- SQL 기준
  - `users` 기본값:
    - `nickname = null`
    - `residency = null`
    - `age_group = null`
    - `language = 'ko'`
    - `notifications_enabled = true`
  - `user_auth_providers` 제약:
    - unique `(provider, provider_user_id)`
    - unique `(user_id, provider)`
  - `user_refresh_tokens` 제약:
    - unique `refresh_token`
    - 유효 토큰 조건: `revoked_at is null and expires_at > now()`
- 완료 기준
  - 인증/프로필 도메인이 필요한 DB 읽기/쓰기를 모두 repository에서 해결할 수 있다.
  - 신규 사용자 생성 시 refresh token 저장까지 repository에서 처리할 수 있다.

### 5단계. Kakao provider 클라이언트 구현
- 상태: 완료
- 작업
  - Kakao access token request/response 스키마를 정의한다.
  - access token 정보 조회 로직을 구현한다.
  - 사용자 정보 조회 로직을 구현한다.
  - 내부에서 사용할 provider user id 추출 규칙을 고정한다.
  - 필요하면 `app_id` 검증 훅을 열어두되, 실제 키 부재로 인해 strict compare는 optional 경로로 둔다.
- 대상 파일
  - `src/shared/auth/providers/kakao.ts`
  - 필요 시 `src/domains/auth/types.ts`
- 완료 기준
  - `accessToken` 하나로 Kakao 사용자 고유 식별자를 안정적으로 얻을 수 있다.

### 6단계. Apple provider 클라이언트 구현
- 상태: 완료
- 작업
  - `identityToken` payload 검증 스키마를 정의한다.
  - Apple public key 조회와 서명 검증 로직을 구현한다.
  - `aud`, `iss`, `sub` 등 최소 claim을 검증한다.
  - 4단계 범위에서는 authorization code 교환을 하지 않는다.
- 대상 파일
  - `src/shared/auth/providers/apple.ts`
- 완료 기준
  - `identityToken`만으로 Apple 사용자 고유 식별자 추출이 가능하다.

### 7단계. `auth` 서비스 구현
- 상태: 완료
- 작업
  - Kakao 로그인 서비스 구현
    - provider 검증
    - identity lookup
    - user create or reuse
    - access token 발급
    - refresh token 발급 및 저장
    - 응답 DTO 구성
  - Apple 로그인 서비스 구현
  - refresh token 재발급 서비스 구현
  - `/v1/auth/me` 조회 서비스 구현
  - `onboardingCompleted` 계산 함수를 `auth` 또는 `users` 공통 영역에 둔다.
- 대상 파일
  - `src/domains/auth/service.ts`
  - `src/domains/auth/mapper.ts`
- 완료 기준
  - 로그인과 세션 확인 로직이 handler 없이 서비스에서 동작한다.

### 8단계. `users` 서비스 구현
- 상태: 완료
- 작업
  - 온보딩 저장 서비스 구현
  - 프로필 조회 서비스 구현
  - 프로필 수정 서비스 구현
  - 알림 설정 수정 서비스 구현
  - 언어 설정 수정 서비스 구현
  - 각 서비스 응답에서 `onboardingCompleted`와 profile DTO를 일관되게 반환한다.
- 대상 파일
  - `src/domains/users/service.ts`
  - `src/domains/users/mapper.ts`
- 완료 기준
  - `users` 도메인의 모든 API가 서비스 계층만으로 구성된다.

### 9단계. `auth` Lambda 라우트 구현
- 상태: 완료
- 작업
  - `POST /v1/auth/kakao`
  - `POST /v1/auth/apple`
  - `POST /v1/auth/refresh`
  - `GET /v1/auth/me`
  - route helper와 response helper를 이용해 handler를 얇게 유지한다.
  - `/v1/auth/me`는 결정된 정책대로 `401` 또는 정상 응답을 반환한다.
- 대상 파일
  - `src/lambdas/auth/handler.ts`
- 완료 기준
  - auth 관련 3개 엔드포인트가 실제 HTTP 레벨에서 동작한다.

### 10단계. `users` Lambda 라우트 구현
- 상태: 완료
- 작업
  - `PATCH /v1/users/me/onboarding`
  - `GET /v1/users/me`
  - `PATCH /v1/users/me`
  - `PATCH /v1/me/notifications`
  - `PATCH /v1/me/language`
  - 보호 라우트는 모두 auth guard를 사용한다.
- 대상 파일
  - `src/lambdas/users/handler.ts`
- 완료 기준
  - users 관련 5개 엔드포인트가 실제 HTTP 레벨에서 동작한다.

### 11단계. 단위 테스트 추가
- 상태: 완료
- 작업
  - access JWT sign/verify 테스트
  - refresh token 생성 테스트
  - refresh token 만료일 계산 테스트
  - refresh API 서비스 테스트
  - Kakao/Apple request schema 테스트
  - onboarding/profile/settings schema 테스트
  - `onboardingCompleted` 계산 테스트
  - handler 또는 service 수준 최소 happy path / failure path 테스트
- 대상 파일
  - `tests/unit/**/*.test.ts`
- 최소 검증 시나리오
  - 무효 토큰 -> 실패
  - 유효 토큰 -> user id 추출
  - 신규 사용자 생성 -> refresh token 저장
  - 만료된 access token -> `401 ACCESS_TOKEN_EXPIRED`
  - 유효한 refresh token -> 새 access token 발급
  - 만료된 refresh token -> `401 REFRESH_TOKEN_EXPIRED`
  - 온보딩 필수 필드 누락 -> 검증 실패
  - 설정 patch payload 타입 오류 -> 검증 실패
- 완료 기준
  - 4단계 핵심 로직이 테스트로 보호된다.

### 12단계. 문서 정합성 보정
- 상태: 완료
- 작업
  - 구현 중 고정된 결정이 있으면 문서를 함께 수정한다.
  - 특히 아래 항목은 실제 구현과 문서가 어긋나지 않게 본다.
    - `/v1/auth/me` 무효 토큰 정책
    - `/v1/auth/refresh` 계약
    - `user_auth_providers` 사용 사실
    - `user_refresh_tokens` 사용 사실
    - Apple `identityToken only` 범위
  - 필요 시 루트 문서도 갱신한다.
- 대상 파일
  - `docs/research.md`
  - `docs/IMPLEMENTATION_SEQUENCE.md`
  - `docs/SERVER_ARCHITECTURE_DRAFT.md`
  - 필요 시 [STEELART_SERVER_API_DRAFT.md](../../STEELART_SERVER_API_DRAFT.md)
  - 필요 시 [STEELART_DB_TABLES.md](../../STEELART_DB_TABLES.md)
- 완료 기준
  - 코드와 문서가 다시 어긋나지 않는다.

### 13단계. 로컬 검증
- 상태: 완료
- 작업
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - 로컬 서버 또는 `sam local start-api`를 띄운 뒤 실제 HTTP 호출로 smoke test
  - 아래 순서로 직접 API를 호출해본다.
    1. `POST /v1/auth/kakao`
    2. `POST /v1/auth/refresh`
    3. `GET /v1/auth/me`
    4. `PATCH /v1/users/me/onboarding`
    5. `GET /v1/users/me`
    6. `PATCH /v1/users/me`
    7. `PATCH /v1/me/notifications`
    8. `PATCH /v1/me/language`
- 예시 호출
  - 아래 예시는 로컬 base URL을 `http://127.0.0.1:3000/v1`로 가정한다.
  - 로그인 provider 토큰은 테스트 가능한 실제 값 또는 mock 전략으로 대체한다.
```bash
# 1) Kakao 로그인
curl -i -X POST http://127.0.0.1:3000/v1/auth/kakao \
  -H 'content-type: application/json' \
  -d '{"accessToken":"<kakao-access-token>"}'

# 2) Refresh token으로 access token 재발급
curl -i -X POST http://127.0.0.1:3000/v1/auth/refresh \
  -H 'content-type: application/json' \
  -d '{"refreshToken":"<refresh-token>"}'

# 3) 현재 세션 확인
curl -i http://127.0.0.1:3000/v1/auth/me \
  -H 'authorization: Bearer <access-token>'

# 4) 온보딩 저장
curl -i -X PATCH http://127.0.0.1:3000/v1/users/me/onboarding \
  -H 'authorization: Bearer <access-token>' \
  -H 'content-type: application/json' \
  -d '{"nickname":"포항산책러","residency":"POHANG","age_group":"20S"}'

# 5) 내 프로필 조회
curl -i http://127.0.0.1:3000/v1/users/me \
  -H 'authorization: Bearer <access-token>'

# 6) 내 프로필 수정
curl -i -X PATCH http://127.0.0.1:3000/v1/users/me \
  -H 'authorization: Bearer <access-token>' \
  -H 'content-type: application/json' \
  -d '{"nickname":"포항야행자","residency":"NON_POHANG","age_group":"30S"}'

# 7) 알림 설정 수정
curl -i -X PATCH http://127.0.0.1:3000/v1/me/notifications \
  -H 'authorization: Bearer <access-token>' \
  -H 'content-type: application/json' \
  -d '{"notifications_enabled":false}'

# 8) 언어 설정 수정
curl -i -X PATCH http://127.0.0.1:3000/v1/me/language \
  -H 'authorization: Bearer <access-token>' \
  -H 'content-type: application/json' \
  -d '{"language":"en"}'
```
- 추가 확인 시나리오
  - 만료된 access token으로 `GET /v1/users/me` 호출 -> `401 ACCESS_TOKEN_EXPIRED`
  - 유효한 refresh token으로 `POST /v1/auth/refresh` 호출 -> 새 `token` 반환
  - 만료된 refresh token으로 `POST /v1/auth/refresh` 호출 -> `401 REFRESH_TOKEN_EXPIRED`
- 완료 기준
  - 4단계 구현이 타입/테스트/빌드/SAM 빌드 기준을 통과한다.

### 14단계. 변경 정리와 PR 생성
- 상태: 완료
- 작업
  - 변경 파일을 검토한다.
  - 4단계 범위를 넘는 구현이 없는지 확인한다.
  - 커밋 후 원격 브랜치에 push한다.
  - `main` 대상 PR을 생성한다.
  - PR 본문에 아래를 적는다.
    - 4단계 범위
    - `user_auth_providers` 사용 전제
    - `user_refresh_tokens` 사용 전제
    - refresh token `30일` 만료 정책
    - `401 ACCESS_TOKEN_EXPIRED -> /v1/auth/refresh` 흐름
    - Apple은 `identityToken`만 구현했다는 점
    - 검증 결과
- 완료 기준
  - `codex/04-auth-users` 브랜치 결과가 리뷰 가능한 PR 형태로 올라간다.

## 검증 체크리스트
- `shared/auth/token.ts`가 존재한다.
- `shared/auth/providers/kakao.ts`가 존재한다.
- `shared/auth/providers/apple.ts`가 존재한다.
- `auth`, `users` 도메인 파일이 모두 존재한다.
- `POST /v1/auth/kakao`가 `token`, `user`, `onboardingCompleted`를 반환한다.
- `POST /v1/auth/apple`가 `token`, `user`, `onboardingCompleted`를 반환한다.
- `POST /v1/auth/refresh`가 새 access token을 반환한다.
- 로그인 성공 시 `refreshToken`도 함께 반환된다.
- `GET /v1/auth/me`가 결정된 인증 정책대로 동작한다.
- access token 만료 시 `401 ACCESS_TOKEN_EXPIRED`가 반환된다.
- refresh token 만료 시 `401 REFRESH_TOKEN_EXPIRED`가 반환된다.
- 보호 API가 인증 없이 호출되면 실패한다.
- `PATCH /v1/users/me/onboarding`가 프로필과 `onboardingCompleted`를 반영한다.
- `PATCH /v1/me/notifications`가 `notifications_enabled`만 수정한다.
- `PATCH /v1/me/language`가 `language`만 수정한다.
- `onboardingCompleted` 계산 규칙이 모든 응답에서 일관된다.
- `pnpm typecheck`가 통과한다.
- `pnpm test`가 통과한다.
- `pnpm build`가 통과한다.
- `pnpm sam:validate`가 통과한다.
- `pnpm sam:build`가 통과한다.

## 예상 리스크와 대응
- 대시보드 raw DDL과 server-standard schema 차이 가능성
  - 대응: 4단계는 표준 스키마로 구현하고, dashboard 쪽 raw DDL이 확보되면 같은 태스크에서 동기화한다
- Apple 검증 난이도
  - 대응: 4단계는 `identityToken` 검증만 구현하고 code 교환은 미룸
- 외부 provider 장애
  - 대응: provider 호출 실패를 `UNAUTHORIZED` 또는 명확한 auth error로 표준화

## 완료 조건
- 4단계 대상 8개 엔드포인트가 실제 코드로 구현되어 있다.
- access JWT 발급/검증이 동작한다.
- refresh token이 `user_refresh_tokens`에 저장된다.
- refresh token 만료일은 발급 시점 기준 `30일`로 계산된다.
- 만료된 access token은 refresh API를 통해 새 access token으로 이어질 수 있다.
- 소셜 로그인 사용자가 `user_auth_providers` 기준으로 내부 사용자와 연결된다.
- 온보딩 저장 후 `onboardingCompleted`가 기대대로 계산된다.
- 프로필/알림/언어 수정이 모두 동작한다.
- 타입 검사, 테스트, 빌드가 통과한다.
- `codex/04-auth-users` 브랜치 PR이 생성된다.

## 한 줄 결론
- 4단계의 핵심은 `access JWT + 30일 refresh token`, `401 ACCESS_TOKEN_EXPIRED -> /v1/auth/refresh`, `user_auth_providers 기반 소셜 로그인 매핑`, `onboardingCompleted 파생 계산`, `auth/users 도메인 실제 라우트 연결`을 작은 단위로 끊어서 구현하고 검증하는 것이다.
