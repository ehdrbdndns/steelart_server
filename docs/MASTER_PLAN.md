# SteelArt Server 구현 계획

## 문서 목적
- 이 문서는 현재까지 합의된 SteelArt 서버 문서를 기준으로 실제 구현 순서와 산출물을 정리한 실행 계획이다.
- 단순한 API 나열이 아니라, 어떤 순서로 무엇을 만들고 무엇을 검증해야 하는지까지 포함한다.

## 조사 기준
- `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
- `/Users/donggyunyang/code/steelart/STEELART_DB_TABLES.md`
- `/Users/donggyunyang/code/steelart/STEELART_APP_MVP_BRIEF.md`
- `/Users/donggyunyang/code/steelart/steelart_server/docs/SERVER_ARCHITECTURE_DRAFT.md`
- `/Users/donggyunyang/code/steelart/steelart_server/docs/FOLDER_STRUCTURE_DRAFT.md`

## 전제
- 서버는 아직 코드가 없는 문서 우선 상태다.
- API Gateway는 `HTTP API`로 확정한다.
- 런타임은 `Node.js 24`(`nodejs24.x`)로 간다.
- 인프라와 배포는 `AWS SAM` 기준으로 설계한다.
- 서버 검증은 API Gateway가 아니라 애플리케이션 계층의 `zod`가 담당한다.
- DB 접근은 `mysql2` raw SQL을 사용한다.
- 구현 중 제품 동작이 바뀌면 루트 문서를 같이 수정한다.

## 목표
- `/v1` 기준의 안정적인 앱 API를 구현한다.
- `steelart_dashboard`와 같은 DB 모델을 사용한다.
- 로그인, 온보딩, 홈, 검색, 작품, 지도, 코스, 체크인을 앱 흐름에 맞게 지원한다.
- 초기부터 자동 CI/CD가 가능한 `AWS SAM` 기반 구조를 갖춘다.

## 기술 기준
- 런타임: `nodejs24.x`
- 아키텍처: `arm64`
- 언어: `TypeScript`
- 패키지 매니저: `pnpm`
- API Gateway: `HTTP API`
- Lambda 배포: `AWS SAM`
- DB: `MySQL` + `mysql2/promise`
- 검증: `zod`
- 테스트: 단위 테스트 + 통합 테스트
- 로그: request id 기반 구조화 로그

## 구현 원칙
- 핸들러는 얇게 유지한다.
- 비즈니스 로직은 `service`, SQL은 `repository`, 응답 변환은 `mapper`에 둔다.
- 공통 응답은 `{ data, meta, error }` 형태로 통일한다.
- 문서에 없는 API를 임의로 만들지 않는다.
- 최근 검색어, 공지사항, 외부 링크, 지도 상세 전용 API는 초기 범위에서 제외한다.
- 체크인 거리 검증과 지도 거리 계산은 공통 geo 로직으로 맞춘다.

## 작업 스트림

### 1. 프로젝트 부트스트랩
- 루트 `package.json` 생성
- `pnpm` 기반 기본 스크립트 구성
- `tsconfig.json` 구성
- `.env.example` 구성
- 기본 lint/test/build 스크립트 구성
- `src`, `.github/workflows`, `tests` 구조 생성
- 루트 `template.yaml`, 루트 `samconfig.toml` 배치

### 2. 공통 런타임
- 환경변수 파서
- DB pool / transaction 유틸
- 공통 에러 타입
- 공통 응답 유틸
- request id / logger 유틸
- 공통 라우트 헬퍼
- auth guard 기본 구조
- geo distance 유틸

### 3. SAM 및 자동 배포
- `template.yaml`
- `samconfig.toml`
- 도메인 Lambda 리소스 선언
- `AWS::Serverless::HttpApi` 선언
- 환경 변수 wiring
- 로그 및 기본 IAM 정책 정리
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`

### 4. 인증/사용자 API
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
- access token 만료 `1시간` 정책
- `user_refresh_tokens` 기반 refresh token 발급/저장
- access token 만료 시 `401 ACCESS_TOKEN_EXPIRED -> refresh -> 재요청` 흐름
- refresh token 만료 `30일` 정책
- `user_auth_providers` 기준 소셜 로그인 매핑
- Apple `identityToken` 우선 검증

### 5. 읽기 중심 콘텐츠 API
- `GET /v1/home`
- `GET /v1/home/artworks`
- `GET /v1/home/recommended-courses`
- `GET /v1/search/artworks`
- `GET /v1/artworks`
- `GET /v1/artworks/{artworkId}`
- `GET /v1/artworks/filters`
- `GET /v1/map/artworks`

### 6. 참여 기능 API
- `POST /v1/artworks/{artworkId}/like`
- `DELETE /v1/artworks/{artworkId}/like`
- `GET /v1/courses/recommended`
- `GET /v1/courses/mine`
- `GET /v1/courses/{courseId}`
- `POST /v1/courses`
- `PATCH /v1/courses/{courseId}`
- `POST /v1/courses/{courseId}/like`
- `DELETE /v1/courses/{courseId}/like`

### 7. 체크인 및 안정화
- `POST /v1/courses/{courseId}/checkins`
- 10m + GPS 허용 오차 규칙 반영
- 실패 코드/재시도 규칙 표준화
- 통합 테스트 추가
- 인덱스 검토
- `RDS Proxy` 필요 여부 검토

## 단계별 실행 계획

### 0단계. 설계 고정
- 아키텍처 문서 기준 확정
- `HTTP API`, `Node.js 24`, `AWS SAM`, `zod`, `mysql2` 기준 고정
- 문서 간 경로와 용어 정합성 확인

### 1단계. 스캐폴딩
- 코드 폴더 생성
- TypeScript 빌드 가능 상태 확보
- 최소 2개 Lambda 엔트리포인트 생성
- SAM 템플릿에서 함수 리소스와 `HttpApi` 골격 연결

### 2단계. 공통 기반 구현
- env, db, response, error, logger, route, auth, geo 구현
- 로컬 실행과 빌드가 가능한지 확인
- `sam build`가 통과하는지 확인

### 3단계. 인증/사용자 구현
- 로그인/세션/온보딩/프로필 API 구현
- 사용자 상태와 토큰 구조 정리
- 앱이 메인 탭 이전까지 이동 가능한 최소 API 확보

### 4단계. 홈/검색/작품/지도 구현
- 읽기 API 응답 구조 고정
- 다국어 필드와 이미지/오디오/좌표 매핑 확정
- 검색과 거리 계산 규칙 구현
- 현재 상태: `진행 중`

### 5단계. 코스/좋아요 구현
- 코스 조회/생성/수정
- 작품/코스 좋아요
- 공식 코스와 사용자 코스 분리 규칙 반영

### 6단계. 체크인 구현
- 공식 코스 여부 확인
- 중복 체크인 방지
- 거리 계산 및 허용 오차 적용
- 실패 응답 코드와 메시지 구조 확정

### 7단계. 품질 및 배포 안정화
- 단위 테스트와 통합 테스트 추가
- CI에서 빌드/테스트/배포 검증
- 운영 로그와 모니터링 포인트 정리
- 스테이징/운영 환경 변수 분리

## 우선순위 이유
- 인증과 사용자 API가 없으면 앱은 로그인과 온보딩을 통과할 수 없다.
- 읽기 API가 먼저 안정되어야 앱 UI와 API 계약을 빨리 고정할 수 있다.
- 좋아요, 코스 쓰기, 체크인은 읽기 계약이 고정된 뒤 붙여야 재작업이 적다.
- 자동 CI/CD는 뒤에 붙이는 것이 아니라 초반부터 넣어야 이후 변경 비용이 낮다.

## 단계별 산출물

### 1차 산출물
- 빌드 가능한 프로젝트
- `HttpApi` 기반 SAM 템플릿
- CI/CD 골격
- 공통 런타임 모듈

### 2차 산출물
- 인증/사용자 API
- 홈/검색/작품/지도 읽기 API
- API 응답 스키마 초안 고정

### 3차 산출물
- 코스 생성/수정/좋아요
- 체크인
- 테스트와 운영 로그

## 같이 확인해야 할 항목
- 카카오/애플 인증 상세 방식
- `users`, `artwork_likes`, `course_likes` 실제 DDL
- `user_auth_providers`, `user_refresh_tokens`의 dashboard raw DDL 반영 여부
- GPS 허용 오차 수치
- 홈 `zones` 정렬 기준
- GitHub Actions의 브랜치별 배포 규칙
- 스테이징/운영 환경 구분 방식

## 위험 요소
- 실제 DB 구조가 문서 추정과 다를 수 있다.
- 소셜 로그인 계약이 확정되지 않으면 인증 API가 지연될 수 있다.
- 체크인 허용 오차 정책이 늦게 정해지면 코스 도메인 안정화가 밀릴 수 있다.
- 자동 배포 전략을 뒤로 미루면 환경 변수/권한/배포 구조를 다시 손봐야 할 수 있다.

## 완료 기준
- `nodejs24.x` 기준으로 `sam build`가 동작한다.
- `HttpApi` 기준 API 라우팅이 동작한다.
- `/v1` 인증/사용자/홈/검색/작품/지도/코스/체크인 API가 구현된다.
- 앱이 로그인, 온보딩, 탐색, 좋아요, 코스 작성, 체크인 흐름을 수행할 수 있다.
- CI에서 빌드/테스트가 통과하고 배포 파이프라인이 동작한다.

## 한 줄 결론
- SteelArt 서버 구현은 `Node.js 24 + TypeScript + AWS SAM + HTTP API + mysql2 + zod`를 기준으로, 공통 기반과 자동 배포를 먼저 세운 뒤 인증/사용자, 읽기 API, 참여 기능, 체크인 순서로 진행하는 것이 가장 재작업이 적다.
