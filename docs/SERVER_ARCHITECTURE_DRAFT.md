# SteelArt Server 아키텍처 초안

## 문서 목적
- 이 문서는 `steelart_server`의 초기 백엔드 아키텍처를 제안한다.
- 실제 코드 부트스트랩 전에 합의하기 위한 작업 초안이다.
- 현재 앱 기획 문서, API 초안, 루트 DB 요약 문서를 기준으로 작성한다.

## 목표
- `steelart_app`을 위한 안정적인 `/v1` API를 제공한다.
- `steelart_dashboard`에서 이미 사용 중인 DB 모델을 그대로 재사용한다.
- 인증, 위치, 좋아요, 코스 체크인 동작을 앱과 운영 기준에 맞게 일관되게 유지한다.
- MVP에는 단순하지만, 이후 쓰기 기능과 체크인이 붙어도 무너지지 않는 구조로 시작한다.

## 초기 부트스트랩 범위에서 하지 않을 것
- 공지사항이나 외부 링크용 CMS 구축
- 서버가 관리하는 최근 검색어 저장 기능 구축
- 지도 전용 상세 API 분리
- 위치 권한 상태를 관리하는 서버 API 추가
- 도메인 경계가 안정되기 전에 배포 토폴로지를 과도하게 세분화하는 작업

## 권장 스택
- 런타임: `Node.js 24` (`nodejs24.x`)
- 언어: `TypeScript`
- 패키지 매니저: `pnpm`
- 검증: `zod`
- DB 접근: `mysql2/promise` + 파라미터 바인딩
- AWS SDK: v3 모듈만 사용
- 인프라 및 자동 CI/CD 기준: `AWS SAM`

## 왜 이 스택인가
- `steelart_dashboard`가 이미 `TypeScript`, `mysql2`, `zod`를 사용하고 있다.
- 같은 검증 방식과 SQL 스타일을 재사용하면 팀의 인지 부하와 스키마 드리프트를 줄일 수 있다.
- 현재 테이블 집합은 아직 raw SQL로 충분히 다룰 수 있는 규모다.
- `AWS SAM`은 Lambda/API Gateway 배포와 CI/CD 자동화를 빠르게 정리하기에 적합하다.

## 제안하는 AWS 구성
- `API Gateway HTTP API`
- 도메인별 `Lambda`
- `RDS MySQL`
- DB 및 인증 시크릿 관리를 위한 `Secrets Manager`
- 런타임 로그와 운영 가시성을 위한 `CloudWatch Logs`
- 배포 템플릿과 자동 CI/CD를 위한 `AWS SAM`

## API Gateway 선택 결정
- SteelArt 서버의 API Gateway 기준은 `HTTP API`로 확정한다.
- `AWS SAM` 템플릿에서는 `AWS::Serverless::HttpApi`를 우선 기준으로 사용한다.
- `REST API`(`AWS::Serverless::Api`)는 현재 범위에서는 기본 선택지로 두지 않는다.

## HTTP API를 선택한 이유
- 현재 SteelArt 서버는 모바일 앱용 Lambda 백엔드 API가 중심이다.
- MVP 범위에서 필요한 기능은 인증, 일반 CRUD성 조회/수정, CORS, Lambda 연동이 대부분이다.
- `HTTP API`는 `REST API`보다 단순하고 비용 면에서도 유리하다.
- 요청 검증은 API Gateway 레벨이 아니라 서버 코드의 `zod`로 처리하는 방향과도 잘 맞는다.
- 현재 요구사항에는 `API key`, usage plan, API Gateway 레벨 request validation, private endpoint 같은 `REST API` 전용 강한 요구가 없다.

## REST API를 기본 선택지로 두지 않는 이유
- 기능이 더 많은 대신 구성과 운영 복잡도가 커진다.
- 지금 단계에서 `REST API`를 선택해도 SteelArt MVP에 바로 필요한 이점이 크지 않다.
- 특히 문서상 이미 합의된 구조는 `HTTP API + Lambda + zod 검증` 조합에 더 자연스럽게 맞는다.

## HTTP API 적용 원칙
- 공통 API 진입점은 `/v1` 기준으로 유지한다.
- 인증은 공통 auth guard 또는 JWT authorizer 관점에서 설계하되, 실제 요청 검증은 애플리케이션 코드에서 수행한다.
- CORS, stage, route 연결은 `HTTP API` 기준으로 단순하게 유지한다.
- 이후 `REST API` 고유 기능이 꼭 필요해질 때만 전환 여부를 다시 검토한다.

## RDS 접근 권장사항
- Lambda 동시성이 작고 통제 가능할 때만 직접 `mysql2` 연결 관리로 시작한다.
- 동시성이 의미 있게 올라가면 `RDS Proxy`를 붙이는 방향을 우선 검토한다.
- 특히 지도, 검색, 체크인이 동시에 붙는 시점부터는 `RDS Proxy`를 사실상 권장 인프라로 본다.

## 도메인 단위 Lambda 권장사항
- 거대한 단일 Lambda 하나보다, 소수의 도메인 Lambda로 나누는 방식이 적절하다.
- 초기 부트스트랩 단계에서 엔드포인트마다 Lambda를 하나씩 두는 구조도 피한다.
- 너무 잘게 쪼개면 라우팅, 배포, 운영 복잡도만 먼저 커진다.

## 라우트 소유 구조 제안
- `/v1/auth/*` -> `auth` Lambda
- `/v1/users/*`, `/v1/me/*` -> `users` Lambda
- `/v1/home/*` -> `home` Lambda
- `/v1/search/*` -> `search` Lambda
- `/v1/artworks/*` -> `artworks` Lambda
- `/v1/map/*` -> `map` Lambda
- `/v1/courses/*` -> `courses` Lambda

## 내부 요청 흐름
1. API Gateway가 HTTP 요청을 받는다.
2. 도메인 Lambda 핸들러가 요청을 정규화하고, 필요 시 인증 가드를 수행한다.
3. `zod` 스키마가 path, query, body를 검증한다.
4. 도메인 서비스가 비즈니스 로직을 실행한다.
5. 리포지토리 계층이 `mysql2`를 통해 SQL을 수행한다.
6. 매퍼 계층이 DB row를 API 응답 DTO로 변환한다.
7. 공통 응답 헬퍼가 `{ data, meta, error }` 형태로 반환한다.

## 권장 코드 레이어
- `handler`
  - HTTP 이벤트 파싱
  - 인증 가드 연결
  - 요청 검증
  - 응답 포맷팅
- `service`
  - 비즈니스 규칙
  - 오케스트레이션
  - 트랜잭션 경계
- `repository`
  - SQL 쿼리
  - row 조회
  - 영속성 업데이트
- `mapper`
  - DB row -> API 응답 매핑
- `schema`
  - 요청/응답 인접 DTO용 `zod` 검증기

## 도메인별 책임

### `auth`
- 카카오 로그인 교환
- 애플 로그인 교환
- `POST /v1/auth/refresh` 기반 access token 재발급
- `/v1/auth/me` 기반 토큰/세션 검증
- `user_auth_providers` 기반의 소셜 provider 식별자와 내부 사용자 매핑
- `user_refresh_tokens` 기반 refresh token 저장

### `users`
- 온보딩 저장
- 프로필 조회/수정
- 알림 설정 수정
- 언어 설정 수정

### `home`
- 홈 배너 목록
- 홈 존 목록
- 존 기준 작품 카드 목록
- 공식 추천 코스 목록

### `search`
- 작품명, 작가명, 장소명 기준 작품 검색
- 홈과 지도에서 재사용하는 공용 검색 로직

### `artworks`
- 아카이브 목록
- 복수 필터 조회
- 작품 상세
- 작품 좋아요/취소

### `map`
- 주변 작품 마커 조회
- 서버 계산 거리 반환
- 존/키워드 기반 마커 조회
- 지도 전용 상세 계약은 별도 분리하지 않음

### `courses`
- 공식 코스 목록
- 내 코스 목록
- 코스 상세
- 사용자 코스 생성/수정
- 코스 좋아요/취소
- 거리 검증이 포함된 공식 코스 체크인

## 인증 방향
- 현재 API 초안은 카카오/애플 로그인 후 서버가 앱 토큰을 발급하는 구조를 전제로 한다.
- 4단계 첫 구현은 `JWT_SECRET` 기반 access JWT를 사용하는 구조로 시작한다.
- access token 만료 기한은 발급 시점 기준 `1시간`으로 둔다.
- 소셜 로그인 매핑은 `users`에 직접 넣지 않고 `user_auth_providers`를 기준으로 연결한다.
- refresh token은 `user_refresh_tokens`에 저장하고, 만료 기한은 발급 시점 기준 `30일`로 둔다.
- 보호 API 호출 시 access token이 만료되면 `401 ACCESS_TOKEN_EXPIRED`를 반환하고, 앱은 `POST /v1/auth/refresh`로 새 access token을 요청한다.
- refresh token도 만료되었으면 `401 REFRESH_TOKEN_EXPIRED`를 반환하고 앱은 재로그인을 유도한다.
- Apple 로그인은 초기 단계에서 `identityToken` 검증만 먼저 구현하고, authorization code 교환은 후속 단계로 미룬다.
- 제품 요구가 바뀌지 않는 한 로그아웃 API는 추가하지 않는다.
- access token 만료 시 보호 API는 `401 ACCESS_TOKEN_EXPIRED`를 반환하고, 앱이 `POST /v1/auth/refresh`로 재발급한 뒤 원래 요청을 재시도한다.

## 이미 확정된 데이터 규칙
- 홈 지역 모델은 `zones`를 사용한다.
- `artistType` 필터는 `artists.type`을 사용한다.
- 작품 상세는 `artwork_festivals` 전체 목록을 반환한다.
- 최근 검색어는 앱 로컬 `AsyncStorage`에만 저장한다.
- 공지사항과 외부 링크는 앱 하드코딩으로 유지한다.
- 지도의 즐겨찾기-only 필터는 클라이언트에서 처리한다.
- 지도 bottom sheet는 기존 작품 상세 API를 재사용한다.

## 위치 규칙
- `lat/lng`가 들어오면 지도 마커 응답에 서버 계산 거리 값을 포함한다.
- 코스 체크인은 기본 10m 기준을 사용한다.
- 해당 기준 주변에는 약간의 GPS 허용 오차를 둔다.
- 정확한 허용 수치는 구현 단계에서 코드와 문서에 명시해야 한다.

## 보안 및 운영 기본선
- 모든 입력은 `zod`로 검증한다.
- SQL은 `?` 바인딩을 사용해 파라미터화한다.
- 인증 가드는 핸들러마다 중복 구현하지 않고 공통화한다.
- 인증 실패, 검증 실패, not found, conflict, 체크인 거리 실패에 대한 에러 코드를 표준화한다.
- 첫 부트스트랩부터 request id 또는 correlation id 로그를 남긴다.
- `AWS SAM` 배포 파이프라인에서 빌드, 검증, 배포 단계를 자동화한다.
- API Gateway 레벨 request validation에 의존하지 않고, 애플리케이션 계층의 `zod` 검증을 기준으로 삼는다.

## 미디어 처리 가정
- 작품 이미지, 오디오 URL, 배너 이미지는 DB에 저장된 URL을 그대로 사용한다.
- 사용자가 별도로 요청하지 않는 한 초기 서버 범위에 바이너리 업로드 플로우는 포함하지 않는다.

## 구현 권장 순서
- 먼저 인프라와 공통 런타임을 부트스트랩한다.
- 그 다음 인증과 사용자 도메인을 구현한다.
- 이후 읽기 중심 도메인인 홈, 작품, 검색, 지도를 구현한다.
- 그 다음 코스 쓰기 기능과 좋아요를 붙인다.
- 마지막으로 GPS 허용 오차가 포함된 공식 코스 체크인을 구현한다.

## 함께 동기화해야 할 문서
- API 응답 형태가 바뀌면 `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`를 같이 수정한다.
- 스키마 가정이 바뀌면 `/Users/donggyunyang/code/steelart/STEELART_DB_TABLES.md` 또는 raw DDL 기준 문서를 같이 수정한다.
- 앱 동작에 영향이 생기면 루트 앱 문서와 Figma 기준을 다시 확인한다.
