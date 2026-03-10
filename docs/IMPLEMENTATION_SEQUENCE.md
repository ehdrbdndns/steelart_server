# SteelArt Server 브랜치별 구현 순서

## 문서 목적
- 이 문서는 `MASTER_PLAN.md`를 실제 브랜치 실행 단위로 쪼갠 구현 순서 문서다.
- 각 단계는 별도 Git 브랜치에서 순차적으로 진행한다.
- 각 브랜치마다 해야 할 작업, 산출물, 검증 기준, 다음 단계로 넘어가는 조건을 명시한다.

## 운영 원칙
- 브랜치 생성 순서는 이 문서 순서를 따른다.
- 각 단계 브랜치는 직전 단계가 기본 브랜치에 머지된 상태에서 분기한다.
- 브랜치명은 `codex/` prefix를 사용한다.
- 한 브랜치에서 목표 범위를 넘는 작업을 하지 않는다.
- 각 단계의 검증 기준을 만족해야 다음 브랜치로 넘어간다.
- API 계약이나 스키마 가정이 바뀌면 문서도 같은 브랜치에서 같이 수정한다.

## 브랜치 순서 요약
1. `codex/01-bootstrap-project`
2. `codex/02-shared-runtime`
3. `codex/03-sam-http-api-cicd`
4. `codex/04-auth-users`
5. `codex/05-read-content`
6. `codex/06-courses-engagement`
7. `codex/07-checkin-hardening`

## 1단계. 프로젝트 부트스트랩

### 브랜치명
- `codex/01-bootstrap-project`

### 목표
- `steelart_server`를 실제 코드 프로젝트로 시작할 수 있는 최소 골격을 만든다.

### 수행 작업
- 루트 `package.json` 생성
- `pnpm` 기반 기본 스크립트 추가
- `tsconfig.json` 생성
- `.env.example` 생성
- `src/`, `infra/sam/`, `.github/workflows/`, `tests/` 기본 디렉터리 생성
- `src/lambdas/`, `src/domains/`, `src/shared/` 빈 구조 생성
- 기본 빌드/타입체크 스크립트 연결

### 산출물
- 빌드 가능한 TypeScript 프로젝트 골격
- 문서와 맞는 폴더 구조 초안

### 검증 기준
- `pnpm install`이 정상 수행된다.
- `pnpm typecheck` 또는 동등한 타입 검사 스크립트가 통과한다.
- 최소 엔트리 파일이 존재한다.
- 문서 구조와 실제 폴더 구조가 크게 어긋나지 않는다.

### 다음 단계로 넘어가는 조건
- 로컬에서 프로젝트 초기화가 재현 가능하다.
- 이후 공통 모듈을 넣을 위치가 확정되어 있다.

## 2단계. 공통 런타임 구축

### 브랜치명
- `codex/02-shared-runtime`

### 목표
- 모든 도메인이 공통으로 사용할 런타임 기반을 만든다.

### 수행 작업
- 환경변수 파서 구현
- DB pool 유틸 구현
- 트랜잭션 유틸 구현
- 공통 에러 타입 및 에러 코드 정의
- 공통 응답 유틸 `{ data, meta, error }` 구현
- request id / logger 유틸 구현
- 공통 라우트 헬퍼 구현
- auth guard 기본 구조 구현
- geo distance 유틸 구현

### 산출물
- `src/shared/*` 핵심 모듈
- 공통 코드 사용 예제 또는 최소 샘플 핸들러

### 검증 기준
- 공통 모듈 import가 정상 동작한다.
- 타입 검사 통과
- 공통 응답 유틸이 일관된 응답 형태를 반환한다.
- DB 유틸이 연결 생성과 해제를 정상 처리한다.
- geo 유틸이 기본 거리 계산 테스트를 통과한다.

### 다음 단계로 넘어가는 조건
- 이후 도메인 구현 시 공통 기반 추가 수정 없이 바로 사용할 수 있다.

## 3단계. SAM HTTP API 및 자동 CI/CD

### 브랜치명
- `codex/03-sam-http-api-cicd`

### 목표
- `AWS SAM + HTTP API + GitHub Actions` 기준의 배포 골격을 확정한다.

### 수행 작업
- `infra/sam/template.yaml` 생성
- `AWS::Serverless::HttpApi` 리소스 정의
- 도메인 Lambda 리소스 골격 정의
- 공통 환경 변수 wiring
- `infra/sam/samconfig.toml` 생성
- `.github/workflows/ci.yml` 생성
- `.github/workflows/deploy.yml` 생성
- `nodejs24.x`, `arm64`, `esbuild` 기준 설정
- 기본 IAM 정책과 로그 설정 정리

### 산출물
- `sam build` 가능한 SAM 템플릿
- CI/CD 워크플로우 초안

### 검증 기준
- `sam validate` 통과
- `sam build` 통과
- GitHub Actions workflow 문법 오류 없음
- `HttpApi`와 Lambda 연결이 템플릿 상에서 명확하다.

### 다음 단계로 넘어가는 조건
- 이후 도메인 API를 SAM 템플릿에 무리 없이 추가할 수 있다.
- 기본 CI가 타입체크/빌드까지는 검증한다.

## 4단계. 인증 및 사용자 API

### 브랜치명
- `codex/04-auth-users`

### 목표
- 앱이 로그인과 온보딩을 통과할 수 있는 최소 API를 구현한다.

### 수행 작업
- `POST /v1/auth/kakao`
- `POST /v1/auth/apple`
- `GET /v1/auth/me`
- `PATCH /v1/users/me/onboarding`
- `GET /v1/users/me`
- `PATCH /v1/users/me`
- `PATCH /v1/me/notifications`
- `PATCH /v1/me/language`
- 토큰 구조와 auth guard 연결
- 사용자 DTO/스키마/매퍼 구현

### 산출물
- `auth`, `users` 도메인 구현
- 인증/온보딩/프로필 API 스키마

### 검증 기준
- 보호 API가 인증 없이 호출되면 적절히 실패한다.
- 인증 성공 시 사용자 정보와 온보딩 상태가 반환된다.
- 온보딩 저장 후 프로필 조회 결과에 반영된다.
- 타입 검사와 최소 단위 테스트 통과
- API 응답이 문서 초안과 충돌하지 않는다.

### 다음 단계로 넘어가는 조건
- 앱이 로그인 후 메인 진입 전까지 필요한 서버 API를 사용할 수 있다.

## 5단계. 읽기 중심 콘텐츠 API

### 브랜치명
- `codex/05-read-content`

### 목표
- 홈, 검색, 작품, 지도의 읽기 흐름을 모두 연다.

### 수행 작업
- `GET /v1/home/banners`
- `GET /v1/home/zones`
- `GET /v1/home/artworks`
- `GET /v1/home/recommended-courses`
- `GET /v1/search/artworks`
- `GET /v1/artworks`
- `GET /v1/artworks/{artworkId}`
- `GET /v1/artworks/filters`
- `GET /v1/map/artworks`
- 다국어 필드, 이미지 URL, 오디오 URL, 좌표, 거리 필드 매핑
- 검색 조건과 다중 필터 처리

### 산출물
- `home`, `search`, `artworks`, `map` 도메인 읽기 API

### 검증 기준
- 홈 배너/존/작품/추천 코스 응답이 분리 API 구조를 만족한다.
- 검색이 작품명, 작가명, 장소명을 기준으로 동작한다.
- 작품 목록 필터가 `placeId`, `artistType`, `festivalYear` 복수 선택을 지원한다.
- 작품 상세가 `artwork_festivals` 전체 목록을 포함한다.
- 지도 API가 `lat/lng` 입력 시 거리 계산 필드를 반환한다.

### 다음 단계로 넘어가는 조건
- 앱의 홈, 작품, 지도 탐색 흐름이 서버 응답 기준으로 재현 가능하다.

## 6단계. 코스 및 참여 기능

### 브랜치명
- `codex/06-courses-engagement`

### 목표
- 코스 탐색과 사용자 참여 기능을 구현한다.

### 수행 작업
- `POST /v1/artworks/{artworkId}/like`
- `DELETE /v1/artworks/{artworkId}/like`
- `GET /v1/courses/recommended`
- `GET /v1/courses/mine`
- `GET /v1/courses/{courseId}`
- `POST /v1/courses`
- `PATCH /v1/courses/{courseId}`
- `POST /v1/courses/{courseId}/like`
- `DELETE /v1/courses/{courseId}/like`
- 코스 아이템 순서 처리
- 공식/사용자 코스 분리 규칙 반영

### 산출물
- `courses` 도메인 조회/쓰기 API
- 작품/코스 좋아요 API

### 검증 기준
- 공식 코스와 내 코스가 분리 조회된다.
- 사용자 코스 생성/수정 시 순서화된 아이템이 저장된다.
- 좋아요/취소가 중복 없이 동작한다.
- 코스 상세가 지도/리스트 구성에 필요한 데이터를 반환한다.

### 다음 단계로 넘어가는 조건
- 앱의 코스 탭과 좋아요 흐름이 서버 응답 기준으로 동작 가능하다.

## 7단계. 체크인 및 안정화

### 브랜치명
- `codex/07-checkin-hardening`

### 목표
- 공식 코스 체크인을 완성하고, 배포 가능한 안정화 수준까지 끌어올린다.

### 수행 작업
- `POST /v1/courses/{courseId}/checkins`
- 공식 코스 여부 검증
- 중복 체크인 방지
- 10m + GPS 허용 오차 규칙 적용
- 실패 코드와 재시도 규칙 표준화
- 통합 테스트 추가
- 인덱스 검토
- `RDS Proxy` 필요 여부 검토
- 운영 로그와 배포 파이프라인 점검

### 산출물
- 체크인 기능
- 통합 테스트 세트
- 안정화된 배포 기준

### 검증 기준
- 비공식 코스는 체크인할 수 없다.
- 동일 코스 아이템 중복 체크인이 차단된다.
- 거리 기준을 벗어나면 명확한 실패 코드가 반환된다.
- 통합 테스트가 인증, 읽기 API, 코스, 체크인 흐름을 검증한다.
- CI에서 빌드/테스트가 통과한다.
- 배포 파이프라인이 정상 실행된다.

### 다음 단계로 넘어가는 조건
- MVP 범위의 서버 기능이 모두 구현되어 있다.
- 운영 배포와 이후 기능 확장이 가능한 최소 안정성을 확보했다.

## 브랜치별 공통 검증 체크리스트
- 타입 검사 통과
- 문서와 코드 간 API 계약 불일치 없음
- 변경된 도메인의 최소 테스트 추가
- `sam validate` 또는 `sam build` 영향 범위 확인
- 환경 변수 추가 시 `.env.example` 반영
- 문서 경로/구조가 바뀌면 관련 문서도 함께 수정

## 한 줄 결론
- 구현은 `MASTER_PLAN.md`의 큰 방향을 유지하되, 실제 작업은 `codex/01-bootstrap-project`부터 `codex/07-checkin-hardening`까지 브랜치별로 순차 진행하고, 각 브랜치의 검증 기준을 만족한 뒤 다음 단계로 넘어가는 방식이 가장 안전하다.
