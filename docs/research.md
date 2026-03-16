# 4단계 실행 리서치

## 문서 목적
- 이 문서는 [IMPLEMENTATION_SEQUENCE.md](./IMPLEMENTATION_SEQUENCE.md)의 `4단계. 인증 및 사용자 API`를 구현하기 전에 필요한 정보를 모아둔 리서치 문서다.
- 대상 브랜치는 `codex/04-auth-users`다.
- 기존 `research.md`에 있던 3단계 CI/CD 조사 내용은 제거하고, 4단계 전용 내용만 남긴다.

## 대상 단계 요약
- 목표: 앱이 로그인과 온보딩을 통과할 수 있는 최소 API를 구현한다.
- 구현 대상 엔드포인트:
  - `POST /v1/auth/kakao`
  - `POST /v1/auth/apple`
  - `POST /v1/auth/refresh`
  - `GET /v1/auth/me`
  - `PATCH /v1/users/me/onboarding`
  - `GET /v1/users/me`
  - `PATCH /v1/users/me`
  - `PATCH /v1/me/notifications`
  - `PATCH /v1/me/language`
- 이 단계에서 함께 해결해야 할 공통 과제:
  - access token / refresh token 발급 구조
  - 보호 라우트와 auth guard 연결
  - 사용자 DTO, `zod` 스키마, DB row 매퍼
  - 소셜 provider 사용자와 내부 사용자 매핑

## 현재 시작점

### 이미 구현된 공통 기반
- `src/shared/api/*`
  - 공통 에러, 응답, 라우트 유틸이 있다.
- `src/shared/auth/guard.ts`
  - Bearer 토큰 추출과 `requireAuth`만 구현되어 있다.
  - 아직 토큰 서명/검증은 없다.
- `src/shared/db/*`
  - MySQL pool, transaction 유틸이 있다.
- `src/shared/env/server.ts`
  - `JWT_SECRET`, `KAKAO_CLIENT_ID`, `APPLE_CLIENT_ID`, DB 환경변수 파서는 이미 있다.

### 아직 비어 있는 부분
- `src/lambdas/auth/handler.ts`
  - shared runtime placeholder만 있는 상태다.
- `src/lambdas/users/handler.ts`
  - bootstrap placeholder만 있는 상태다.
- `src/domains/auth`, `src/domains/users`
  - 문서상 구조만 있고 실제 구현은 아직 없다.
- `shared/auth/token.ts`
  - [FOLDER_STRUCTURE_DRAFT.md](./FOLDER_STRUCTURE_DRAFT.md)에는 계획되어 있지만 아직 파일이 없다.

### 4단계에서 바로 드러나는 핵심 공백
- 앱 토큰 서명/검증 모듈이 아직 없다.
- `user_auth_providers`, `user_refresh_tokens`는 대시보드 raw DDL에는 없지만, 서버 표준 스키마를 먼저 고정해야 한다.
- Apple 서버 검증에 필요한 추가 자격 증명이 현재 환경변수에 없다.

## 루트 계약 문서 기준 확정 사항

### 제품/플로우
- 익명 탐색은 허용하지 않는다.
- 로그인 성공 후:
  - 신규 사용자 또는 온보딩 미완료 사용자 -> 온보딩 진입
  - 기존 사용자이면서 온보딩 완료 -> 메인 탭 진입
- 온보딩은 아래 3개를 모두 완료해야 끝난다.
  - `nickname`
  - `residency`
  - `age_group`
- 닉네임은 중복을 허용한다.
- 알림 설정과 언어 설정은 분리 API로 수정한다.
- 로그아웃 API는 없다.
- 닉네임 중복 확인 전용 API는 없다.

### API 초안 기준 필수 응답 구조
- `POST /v1/auth/kakao`, `POST /v1/auth/apple`
  - `token`
  - `refreshToken`
  - `user`
  - `onboardingCompleted`
- `POST /v1/auth/refresh`
  - `token`
- `GET /v1/auth/me`
  - `authenticated`
  - `onboardingCompleted`
  - `user`
- 모든 응답은 `{ data, meta, error }` 공통 포맷을 유지한다.

## 엔드포인트별 구현 요구사항

### 엔드포인트 역할 요약
- `POST /v1/auth/kakao`
  - 카카오 로그인 결과를 서버가 받아 내부 사용자와 연결하고 앱 전용 access token과 refresh token을 발급하는 로그인 API다.
  - 로그인 직후 앱이 다음 화면을 결정할 수 있도록 `user`와 `onboardingCompleted`를 함께 반환해야 한다.
- `POST /v1/auth/apple`
  - 애플 로그인 결과를 서버가 검증하고 내부 사용자와 연결한 뒤 앱 전용 access token과 refresh token을 발급하는 로그인 API다.
  - 역할은 카카오 로그인과 같고 provider만 다르다.
- `POST /v1/auth/refresh`
  - 만료된 access token 대신 새 access token을 발급하는 재발급 API다.
  - 보호 API가 `401 ACCESS_TOKEN_EXPIRED`를 반환했을 때 앱이 바로 호출하는 엔드포인트다.
- `GET /v1/auth/me`
  - 현재 Bearer 토큰이 유효한지 확인하고, 지금 로그인된 사용자의 기본 정보와 온보딩 완료 여부를 돌려주는 세션 확인 API다.
  - 앱 실행 시 `로그인 화면`, `온보딩`, `메인 탭` 중 어디로 보낼지 결정하는 기준이 된다.
- `PATCH /v1/users/me/onboarding`
  - 온보딩 3단계에서 받은 `nickname`, `residency`, `age_group`를 저장하는 API다.
  - 저장 후 사용자가 메인 탭에 진입 가능한 상태인지 판단하는 기준 데이터가 된다.
- `GET /v1/users/me`
  - 마이페이지에서 내 프로필을 조회하는 API다.
  - 로그인 상태 확인보다 프로필 데이터 조회에 초점이 있다.
- `PATCH /v1/users/me`
  - 온보딩 완료 이후 사용자가 자신의 기본 프로필을 수정하는 API다.
  - `nickname`, `residency`, `age_group` 중심의 프로필 수정 역할로 해석하는 것이 자연스럽다.
- `PATCH /v1/me/notifications`
  - 알림 수신 여부만 따로 변경하는 설정 API다.
  - `notifications_enabled` 한 필드만 책임진다.
- `PATCH /v1/me/language`
  - 앱 언어 설정만 따로 변경하는 설정 API다.
  - `language`를 `ko` 또는 `en`으로 변경하는 역할이다.

### 1. `POST /v1/auth/kakao`
- 요청 계약:
  - `{ "accessToken": "kakao-access-token" }`
- 인증 전 라우트다.
- 서버가 해야 할 일:
  - 카카오 access token 유효성 확인
  - 카카오 사용자 고유 식별자 확보
  - 내부 사용자 조회 또는 생성
  - access token 발급
  - refresh token 생성 및 `user_refresh_tokens` 저장
  - `onboardingCompleted` 계산 후 응답

### 2. `POST /v1/auth/apple`
- 요청 계약:
  - `{ "identityToken": "apple-identity-token", "authorizationCode": "apple-auth-code" }`
- 인증 전 라우트다.
- 서버가 해야 할 일:
  - Apple identity token 서명/claim 검증
  - 필요 시 authorization code 교환 또는 검증
  - Apple 사용자 고유 식별자 확보
  - 내부 사용자 조회 또는 생성
  - access token 발급
  - refresh token 생성 및 `user_refresh_tokens` 저장
  - `onboardingCompleted` 계산 후 응답

### 3. `POST /v1/auth/refresh`
- 요청 계약:
  - `{ "refreshToken": "app-refresh-token" }`
- 인증 전 라우트다.
- 서버가 해야 할 일:
  - refresh token 조회
  - `user_refresh_tokens.expires_at` 기준 만료 여부 확인
  - 유효하면 새 access token 발급
  - 만료되었으면 `401 REFRESH_TOKEN_EXPIRED` 반환
- 응답 방향:
  - 성공 시 새 access token만 반환
  - 앱은 이 토큰으로 원래 요청을 재시도

### 4. `GET /v1/auth/me`
- 보호 라우트다.
- 해야 할 일:
  - Bearer 토큰 검증
  - 사용자 조회
  - 토큰 유효 여부와 온보딩 완료 여부 반환
- 계약상 응답은 `authenticated: true`를 포함한다.
- 구현 기준:
  - 유효하지 않은 토큰이면 `401`로 실패시킨다.
  - access token 만료는 `401 ACCESS_TOKEN_EXPIRED`로 명확히 구분한다.
  - 정상 응답은 유효한 세션에만 사용한다.

### 5. `PATCH /v1/users/me/onboarding`
- 보호 라우트다.
- 요청 바디:
  - `nickname`
  - `residency`
  - `age_group`
- 해야 할 일:
  - 세 필드 검증
  - 사용자 row 업데이트
  - 응답에서 최신 프로필과 `onboardingCompleted` 반영

### 6. `GET /v1/users/me`
- 보호 라우트다.
- 마이페이지용 기본 프로필 조회다.
- 최소 포함 필드:
  - `id`
  - `nickname`
  - `residency`
  - `age_group`
  - `language`
  - `notifications_enabled`

### 7. `PATCH /v1/users/me`
- 보호 라우트다.
- 온보딩 이후 프로필 수정용이다.
- 수정 대상은 `nickname`, `residency`, `age_group` 중심으로 보는 것이 자연스럽다.
- 별도 설정 API와 겹치지 않게 `language`, `notifications_enabled`는 여기서 받지 않는 편이 안전하다.
- 이 부분은 API 초안의 역할 분리에 따른 구현 권장안이다.

### 8. `PATCH /v1/me/notifications`
- 보호 라우트다.
- 요청 바디:
  - `{ "notifications_enabled": false }`
- `users.notifications_enabled`만 갱신한다.

### 9. `PATCH /v1/me/language`
- 보호 라우트다.
- 요청 바디:
  - `{ "language": "ko" }`
- 허용 값:
  - `ko`
  - `en`

## 사용자 데이터 모델 조사

### `users` 테이블에서 현재 확인된 컬럼
- 루트 [STEELART_DB_TABLES.md](../../STEELART_DB_TABLES.md)와 `steelart_dashboard` 관리자 코드 기준으로 확인된 값:
  - `id`
  - `nickname`
  - `residency`
  - `age_group`
  - `language`
  - `notifications_enabled`
  - `created_at`
  - `updated_at`

### enum-like 값
- `residency`
  - `POHANG`
  - `NON_POHANG`
- `age_group`
  - `TEEN`
  - `20S`
  - `30S`
  - `40S`
  - `50S`
  - `60S`
  - `70_PLUS`
- `language`
  - `ko`
  - `en`

### 대시보드 코드에서 확인한 사실
- 관리자 목록 API는 아래 필드만 읽는다.
  - `nickname`
  - `residency`
  - `age_group`
  - `language`
  - `notifications_enabled`
- realistic seed 스크립트도 동일 컬럼만 사용한다.
- 즉 4단계에서 프로필/온보딩 API를 구현하는 데 필요한 최소 사용자 컬럼은 이미 충분히 확인됐다.

### 아직 확인되지 않은 부분
- `users`의 raw DDL이 없다.
- 소셜 로그인 연결용 컬럼은 어디에도 나타나지 않는다.
  - 예: `provider`, `provider_user_id`, `apple_sub`, `kakao_user_id`
- 따라서 4단계 인증 구현에는 사용자 식별 매핑 전략이 반드시 필요하다.

## 소셜 로그인 매핑 테이블 정리

### 현재 확인된 사실
- 소셜 로그인 사용자 매핑은 `users` 테이블이 아니라 `user_auth_providers` 테이블을 기준으로 잡는다.
- 따라서 4단계 구현에서 신규 매핑 테이블을 따로 설계하는 것이 아니라, 기존 `user_auth_providers`를 사용하는 방향으로 진행한다.
- 서버 구현 기준 표준 컬럼은 아래처럼 고정한다.
  - `id`
  - `user_id`
  - `provider`
  - `provider_user_id`
  - `created_at`
  - `updated_at`
- 제약은 아래처럼 고정한다.
  - unique `(provider, provider_user_id)`
  - unique `(user_id, provider)`
- 현재 provider 값은 `kakao`, `apple`로 둔다.

### 4단계 구현에 미치는 영향
- 카카오/애플 로그인 성공 후 내부 사용자 조회는 아래 순서로 설계해야 한다.
  1. provider 고유 식별자 추출
  2. `user_auth_providers`에서 내부 사용자 조회
  3. 없으면 `users` 생성 후 `user_auth_providers` 연결 row 생성
- 즉 가장 큰 리스크는 "어느 테이블에 저장할지"가 아니라 "이 표준 스키마를 실제 SQL과 대시보드 쪽 문서에도 일관되게 반영하는 것"으로 바뀐다.

### 문서 반영 원칙
- 현재 단계 문서에서는 소셜 로그인 매핑 테이블을 `user_auth_providers`로 고정한다.
- 대시보드 raw DDL이 나중에 열리더라도 우선은 이 표준 스키마를 기준으로 4단계를 구현한다.

## refresh token 저장 테이블 정리

### 현재 확인된 사실
- refresh token은 `user_refresh_tokens` 테이블에서 관리한다.
- 회원가입이 일어나는 최초 로그인 시점에는 refresh token을 반드시 생성해야 한다.
- 현재 정책상 refresh token 만료 기한은 발급 시점 기준 `30일`이다.
- 서버 구현 기준 표준 컬럼은 아래처럼 고정한다.
  - `id`
  - `user_id`
  - `refresh_token`
  - `expires_at`
  - `revoked_at`
  - `created_at`
  - `updated_at`
- 제약은 아래처럼 고정한다.
  - unique `refresh_token`
  - valid token = `revoked_at is null` and `expires_at > now()`
- 현재는 사용자당 여러 refresh token을 허용한다.

### 4단계 구현에 미치는 영향
- 로그인 성공 후 토큰 발급 순서는 아래와 같이 설계해야 한다.
  1. 내부 사용자 조회 또는 생성
  2. access JWT 발급
  3. refresh token 생성
  4. `expires_at = issued_at + 30일` 계산
  5. `user_refresh_tokens`에 저장
  6. 응답에 `token`, `refreshToken`, `user`, `onboardingCompleted` 반환

### 구현 메모
- 4단계 범위에는 refresh token 재발급 API가 포함된다.
- 보호 API에서 access token이 만료되면 `401 ACCESS_TOKEN_EXPIRED`를 반환한다.
- 앱은 이 경우 `POST /v1/auth/refresh`를 호출해 새 access token을 받고 원래 요청을 재시도한다.
- refresh token도 만료되었으면 `401 REFRESH_TOKEN_EXPIRED`를 반환하고 앱은 재로그인으로 보낸다.
- refresh token rotation / revoke 전략은 후속 단계에서 더 강화하되, 현재 스키마는 `revoked_at`으로 그 확장 여지를 남긴다.

## `onboardingCompleted` 판단 규칙

### 문서에서 직접 보이는 사실
- 온보딩은 `nickname`, `residency`, `age_group` 3단계를 모두 완료해야 끝난다.
- 별도 `onboarding_completed` 컬럼은 현재 확인되지 않았다.

### 구현 방향
- 아래 세 값이 모두 비어 있지 않으면 `onboardingCompleted = true`
  - `nickname`
  - `residency`
  - `age_group`
- 별도 컬럼이 없는 현재 문서 상태에서는 이 파생 계산 방식이 가장 자연스럽다.
- 4단계는 이 방식으로 구현한다.

## 소셜 provider 조사

### Kakao 로그인

#### 현재 앱 계약과 맞는 서버 플로우
- 앱이 이미 카카오 로그인 access token을 받아서 서버에 전달한다.
- 따라서 서버는 OAuth authorization code 교환보다 아래 순서가 맞다.
  1. 요청 body에서 `accessToken` 검증
  2. Kakao API로 token 유효성 확인
  3. Kakao API로 사용자 정보 조회
  4. Kakao 사용자 ID를 내부 사용자에 매핑
  5. 앱 전용 토큰 발급

#### 공식 문서에서 확인할 포인트
- `Kakao Login - REST API`
  - 카카오 로그인 REST 흐름의 기준 문서다.
- `Retrieve token information`
  - access token 유효성, 사용자 ID, `app_id`, 만료 시간 확인용이다.
- `Retrieve user information`
  - `v2/user/me`로 사용자 기본 정보를 읽는 기준 문서다.

#### 구현 시 주의점
- 앱이 access token을 주므로 서버가 카카오 비밀키로 별도 교환할 필요는 없다.
- 다만 토큰 정보 응답의 `app_id`를 기준으로 "정말 우리 Kakao 앱에서 발급된 토큰인지" 확인할지 결정해야 한다.
- 현재 서버 env의 `KAKAO_CLIENT_ID` 이름 자체는 구현 의도와 충돌하지 않는 것으로 본다.
- 다만 실제 Kakao 키는 아직 발급 전이므로, 4단계 구현에서는 env 이름을 유지하되 실제 운영값 주입은 후속 설정이 필요하다.

### Apple 로그인

#### 현재 앱 계약과 맞는 서버 플로우
- 앱이 `identityToken`과 `authorizationCode`를 함께 보낸다.
- 서버는 최소한 아래 둘 중 하나를 수행해야 한다.
  - `identityToken` 서명과 claim 검증
  - `authorizationCode`를 Apple token endpoint로 교환
- 보안적으로는 둘 다 확인하는 편이 더 안전하다.

#### 공식 문서에서 확인할 포인트
- `Request an authorization to the Sign in with Apple server`
  - authorization code를 token endpoint로 교환하는 기준 문서다.
- `Generate and validate tokens`
  - client secret JWT 생성과 검증 흐름 문서다.
- `Fetch Apple's public key for verifying token signature`
  - `identityToken` 서명 검증용 JWK 조회 문서다.

#### 현재 환경변수와의 차이
- 지금 서버 env에는 `APPLE_CLIENT_ID`만 있다.
- 하지만 authorization code 교환까지 하려면 일반적으로 아래가 더 필요하다.
  - `APPLE_TEAM_ID`
  - `APPLE_KEY_ID`
  - `APPLE_PRIVATE_KEY`
- 4단계는 `identityToken` 검증만 먼저 구현하는 방향으로 진행한다.
- 따라서 Apple authorization code 교환과 추가 env 확장은 후속 단계로 미룬다.

#### `APPLE_CLIENT_ID` 값
- 현재 사용자 식별자는 `com.steelart.app`으로 확인됐다.
- 앱 네이티브 Sign in with Apple 흐름이라면 이 값을 `APPLE_CLIENT_ID`로 두는 방향이 자연스럽다.

## 앱 토큰 구조 조사

### 현재 코드 상태
- [src/shared/auth/guard.ts](../src/shared/auth/guard.ts)는 Bearer 토큰 문자열만 꺼낸다.
- 토큰 발급, 서명, 만료 검증, 사용자 ID 추출 로직은 없다.
- env에는 `JWT_SECRET`이 이미 존재한다.

### 4단계 토큰 방향
- access token 포맷
  - JWT 기반으로 진행한다.
- access token claim
  - 최소 `sub`(내부 user id)
  - `iat`
  - `exp`
  - 필요 시 `ver` 또는 `type`
- access token TTL
  - 발급 시점 기준 `1시간`
- refresh token 포맷
  - 서버가 생성해 `user_refresh_tokens`에서 관리하는 값으로 둔다.
- refresh token TTL
  - 발급 시점 기준 `30일`

### 현재 문서 기준 구현안
- 4단계는 `JWT_SECRET`을 사용하는 access JWT + DB 관리 refresh token 조합으로 구현한다.
- 최소 claim은 아래 정도면 충분하다.
  - `sub`: 내부 사용자 ID
  - `iat`
  - `exp`
- `onboardingCompleted`, `nickname`, `language` 같은 프로필 값은 토큰에 넣지 않고 DB에서 읽는 편이 안전하다.
- 보호 API는 access token 만료 시 `401 ACCESS_TOKEN_EXPIRED`를 반환한다.
- refresh API는 refresh token이 유효하면 새 access token을 반환하고, refresh token이 만료되었으면 `401 REFRESH_TOKEN_EXPIRED`를 반환한다.

### 현재 코드베이스에 추가로 필요한 것
- `shared/auth/token.ts`
  - access JWT sign
  - access JWT verify
  - access JWT decode claims
  - refresh token 생성
- 토큰 검증 실패 -> `UNAUTHORIZED`
- 보호 라우트에서 `requireAuth`가 단순 token string 반환이 아니라 내부 user id까지 포함하도록 확장 필요

## 4단계 구현을 위해 필요한 환경변수 검토

### 현재 이미 있는 값
- `APP_ENV`
- `AWS_REGION`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`
- `KAKAO_CLIENT_ID`
- `APPLE_CLIENT_ID`
- `LOG_LEVEL`

### 4단계에서 추가 가능성이 높은 값
- Apple authorization code 교환까지 구현한다면:
  - `APPLE_TEAM_ID`
  - `APPLE_KEY_ID`
  - `APPLE_PRIVATE_KEY`
- Kakao access token introspection만 한다면 `KAKAO_CLIENT_ID` 외 추가 env 없이도 시작 가능할 가능성이 높다.
- 다만 Kakao app 검증을 더 엄격히 하려면 비교 대상 값 명칭을 다시 정리해야 한다.

## 코드 구조 측면에서 필요한 파일

### `auth` 도메인
- `src/domains/auth/service.ts`
- `src/domains/auth/repository.ts`
- `src/domains/auth/schemas.ts`
- `src/domains/auth/mapper.ts`
- `src/domains/auth/types.ts`

### `users` 도메인
- `src/domains/users/service.ts`
- `src/domains/users/repository.ts`
- `src/domains/users/schemas.ts`
- `src/domains/users/mapper.ts`
- `src/domains/users/types.ts`

### 공통 인증 모듈
- `src/shared/auth/token.ts`
- `src/shared/auth/providers/kakao.ts`
- `src/shared/auth/providers/apple.ts`

### 현재 라우트 연결 대상
- `src/lambdas/auth/handler.ts`
- `src/lambdas/users/handler.ts`

## SQL 관점에서 필요한 읽기/쓰기

### 사용자 조회
- 내부 user id로 조회
- 닉네임/거주지/연령대/언어/알림 상태 조회

### 인증 매핑 조회
- provider + provider user id로 내부 사용자 조회
- 없으면 신규 user 생성 후 identity 연결

### refresh token 저장
- 로그인 또는 회원가입 시 refresh token row 생성
- 저장 대상은 `user_refresh_tokens`
- `expires_at` 기준 만료일은 발급 시점 기준 `30일`

### 사용자 생성
- 기본값 권장:
  - `nickname = null`
  - `residency = null`
  - `age_group = null`
  - `language = 'ko'`
  - `notifications_enabled = true`
- 이 기본값은 API 초안 로그인 응답 예시와 일치한다.

### 프로필/온보딩 수정
- `PATCH /v1/users/me/onboarding`
- `PATCH /v1/users/me`
- `PATCH /v1/me/notifications`
- `PATCH /v1/me/language`

## 검증 포인트

### 단위 테스트 우선 대상
- 카카오 로그인 request schema
- 애플 로그인 request schema
- onboarding request schema
- access token sign/verify
- refresh token 생성
- `onboardingCompleted` 계산 함수
- auth guard가 잘못된/누락된 토큰에서 실패하는지

### 저장소/서비스 테스트 우선 대상
- 신규 social identity -> user 생성
- 기존 social identity -> 기존 user 반환
- 신규 user 생성 시 refresh token 저장
- onboarding 저장 후 `GET /v1/users/me` 반영
- notification/language patch 반영

### HTTP 수준 검증 포인트
- 보호 라우트는 인증 없이 `401`
- 로그인 성공 시 `token`, `refreshToken`, `user`, `onboardingCompleted` 반환
- access token 만료 시 `401 ACCESS_TOKEN_EXPIRED`
- refresh API 성공 시 새 access token 반환
- refresh token 만료 시 `401 REFRESH_TOKEN_EXPIRED`와 재로그인 유도
- `/v1/auth/me`가 토큰 기반으로 사용자 프로필 반환
- `PATCH /v1/users/me/onboarding` 후 `onboardingCompleted = true`
- 공통 응답 포맷 유지

## 단계 착수 전에 확정해야 할 질문

### 반드시 확정해야 하는 것
- 없음

### 있으면 좋지만 구현을 막지는 않는 것
- 추후 refresh token rotation / revoke 전략

## 4단계 구현 권장 결론
- `auth`와 `users` 도메인을 동시에 여는 브랜치다.
- 기술적으로 가장 큰 이슈는 표준 스키마에 맞는 repository SQL을 안정적으로 구현하고, 이후 대시보드 문서와 동기화하는 것이다.
- 현재 문서 상태만 보면 아래 순서가 가장 안전하다.
  1. 표준 스키마 기준 repository SQL 고정
  2. access JWT / refresh token 발급 유틸 추가
  3. refresh API 구현
  4. Kakao 로그인부터 구현
  5. Apple `identityToken` 검증 연결
  6. onboarding/profile/settings API 연결
- Apple authorization code 교환은 후속 단계로 미룬다.

## 공식 참고 링크
- Kakao Developers: [Kakao Login - REST API](https://developers.kakao.com/docs/latest/en/kakaologin/rest-api)
  - 이 문서 안에 `Retrieve token information`과 `Retrieve user information` 섹션이 함께 있다.
- Kakao Developers: [Concepts](https://developers.kakao.com/docs/latest/en/kakaologin/common)
- Apple Developer: [Request an authorization to the Sign in with Apple server](https://developer.apple.com/documentation/signinwithapplerestapi/request_an_authorization_to_the_sign_in_with_apple_server)
- Apple Developer: [Generate and validate tokens](https://developer.apple.com/documentation/signinwithapplerestapi/generate_and_validate_tokens)
- Apple Developer: [Fetch Apple's public key for verifying token signature](https://developer.apple.com/documentation/signinwithapplerestapi/fetch_apple_s_public_key_for_verifying_token_signature)

## 함께 본 내부 참고 문서
- [IMPLEMENTATION_SEQUENCE.md](./IMPLEMENTATION_SEQUENCE.md)
- [STEELART_SERVER_API_DRAFT.md](../../STEELART_SERVER_API_DRAFT.md)
- [STEELART_DB_TABLES.md](../../STEELART_DB_TABLES.md)
- [STEELART_APP_MVP_BRIEF.md](../../STEELART_APP_MVP_BRIEF.md)
- [STEELART_APP_SCREEN_SPECS.md](../../STEELART_APP_SCREEN_SPECS.md)
- [FOLDER_STRUCTURE_DRAFT.md](./FOLDER_STRUCTURE_DRAFT.md)
- [SERVER_ARCHITECTURE_DRAFT.md](./SERVER_ARCHITECTURE_DRAFT.md)
