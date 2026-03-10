# SteelArt Server 리서치 정리

## 읽은 문서 범위
- `/Users/donggyunyang/code/steelart/AGENTS.md`
- `/Users/donggyunyang/code/steelart/STEELART_DB_TABLES.md`
- `/Users/donggyunyang/code/steelart/STEELART_APP_MVP_BRIEF.md`
- `/Users/donggyunyang/code/steelart/STEELART_APP_SCREEN_STRUCTURE.md`
- `/Users/donggyunyang/code/steelart/STEELART_APP_SCREEN_SPECS.md`
- `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
- `/Users/donggyunyang/code/steelart/steelart_server/README.md`
- `/Users/donggyunyang/code/steelart/steelart_server/docs/SERVER_ARCHITECTURE_DRAFT.md`
- `/Users/donggyunyang/code/steelart/steelart_server/docs/FOLDER_STRUCTURE_DRAFT.md`
- `/Users/donggyunyang/code/steelart/steelart_server/docs/IMPLEMENTATION_SEQUENCE.md`

## 지금 이 폴더가 의미하는 것
- `steelart_server`는 아직 구현된 서버가 아니라, 문서 기준으로 서버를 부트스트랩하기 위한 준비 폴더다.
- 목표는 `steelart_app`이 요구하는 기능을 `steelart_dashboard`와 같은 데이터 모델 위에서 안정적인 `/v1` API로 제공하는 것이다.
- 즉, 내가 너와 같이 해야 하는 일은 "문서를 읽고 방향을 잡는 것"에서 끝나는 게 아니라, 이 문서들을 기준으로 실제 서버 프로젝트를 세우고 순서대로 API를 구현하는 것이다.

## 문서 기준으로 확정된 큰 방향

### 1. 서버의 역할
- 앱 전용 백엔드로서 로그인, 온보딩, 홈, 검색, 작품, 지도, 코스, 마이페이지를 지원해야 한다.
- 대시보드에서 관리되는 데이터와 용어를 그대로 재사용해야 한다.
- 앱 화면 구조는 Figma와 앱 문서를 따르고, 서버는 그 흐름을 깨지 않는 API를 제공해야 한다.

### 2. 기술 방향
- 런타임: `Node.js`
- 언어: `TypeScript`
- 패키지 매니저: `pnpm`
- 검증: `zod`
- DB 접근: `mysql2` raw SQL
- 인프라 형태: `API Gateway HTTP API + Lambda + RDS`
- Lambda는 엔드포인트별 쪼개기보다 도메인별로 묶는다.

### 3. 서버가 다뤄야 하는 도메인
- `auth`
- `users`
- `home`
- `search`
- `artworks`
- `map`
- `courses`

### 4. 이미 확정된 제품/API 규칙
- Base path는 `/v1`
- 익명 탐색은 허용하지 않음
- 로그인 후 온보딩 3단계를 완료해야 메인 탭 진입
- 홈 데이터는 일괄 API가 아니라 분리된 API로 조회
- 홈의 `region` 개념은 `zones`로 해석
- 작품 검색은 작품명, 작가명, 장소명까지 한 API로 검색
- 최근 검색어는 서버 저장이 아니라 앱 로컬 `AsyncStorage`
- 작품 필터는 `placeId`, `artistType`, `festivalYear` 복수 선택 허용
- `artistType`는 `artists.type`
- 작품 상세는 `artwork_festivals`의 전체 연도 목록을 반환
- 지도 상세 전용 API는 없고 작품 상세 API를 재사용
- 지도 검색도 공용 작품 검색 API를 재사용
- 지도의 즐겨찾기-only 필터는 서버가 아니라 앱에서 처리
- 공지사항과 외부 링크는 서버가 아니라 앱 하드코딩
- 체크인은 공식 코스만 가능
- 체크인은 10m 기준 + 약간의 GPS 허용 오차 적용
- 로그아웃 API 없음
- 닉네임 중복 확인 API 없음

## DB와 앱을 같이 보고 파악한 핵심
- 서버는 새 스키마를 발명하는 역할이 아니다. 이미 대시보드와 DB에 있는 모델을 앱용 응답으로 잘 가공하는 역할이 핵심이다.
- 중심 테이블은 `artists`, `artworks`, `artwork_images`, `artwork_festivals`, `places`, `zones`, `courses`, `course_items`, `course_checkins`, `home_banners`, `users`, `artwork_likes`, `course_likes`다.
- 앱 경험상 작품과 장소가 1:1처럼 보일 수 있지만 실제 DB는 N:1일 수 있으므로, API 설계 시 이 차이를 의식해야 한다.
- 읽기 API가 먼저 안정되어야 앱의 홈, 작품, 지도, 코스 흐름이 열리고, 그 다음에 좋아요/코스 작성/체크인을 붙이는 순서가 맞다.

## 내가 너와 같이 해야 하는 일

### 1. 서버 골격을 실제 코드로 시작하기
- 현재 문서만 있는 상태를 끝내고 실제 `TypeScript` 서버 프로젝트를 만든다.
- 최소한 아래는 바로 생겨야 한다.
  - `package.json`
  - `tsconfig.json`
  - `.env.example`
  - `src/shared/*`
  - `src/lambdas/*`
  - `src/domains/*`
  - `infra/cdk/*`

### 2. 공통 기반 먼저 만들기
- 환경변수 파싱
- DB pool / transaction 유틸
- 공통 응답 포맷 `{ data, meta, error }`
- 공통 에러 코드
- 인증 가드
- 라우팅 헬퍼
- 로깅 / request id 처리

### 3. 1차 구현 우선순위대로 API 만들기
- `POST /v1/auth/kakao`
- `POST /v1/auth/apple`
- `GET /v1/auth/me`
- `PATCH /v1/users/me/onboarding`
- `GET /v1/users/me`
- `PATCH /v1/users/me`
- `PATCH /v1/me/notifications`
- `PATCH /v1/me/language`

이 단계가 먼저인 이유는 앱이 로그인과 온보딩을 통과해야 다른 탭이 열리기 때문이다.

### 4. 읽기 중심 API를 붙이기
- `GET /v1/home/banners`
- `GET /v1/home/zones`
- `GET /v1/home/artworks`
- `GET /v1/home/recommended-courses`
- `GET /v1/search/artworks`
- `GET /v1/artworks`
- `GET /v1/artworks/{artworkId}`
- `GET /v1/artworks/filters`
- `GET /v1/map/artworks`

이 단계가 끝나야 홈, 작품, 지도 경험이 대부분 살아난다.

### 5. 참여형 기능을 구현하기
- 작품 좋아요 / 취소
- 추천 코스 / 내 코스 / 코스 상세
- 사용자 코스 생성 / 수정
- 코스 좋아요 / 취소

### 6. 마지막으로 체크인 규칙을 완성하기
- `POST /v1/courses/{courseId}/checkins`
- 공식 코스 여부 검증
- 중복 체크인 방지
- 거리 계산
- GPS 오차 허용 기준 명시
- 실패 코드와 재시도 UX를 앱과 맞추기

## 같이 결정하거나 확인해야 하는 것
- 카카오/애플 로그인 세부 인증 방식
- 서버 토큰 발급 방식과 만료/갱신 전략
- `users`, `artwork_likes`, `course_likes`의 실제 DDL 확인
- GPS 허용 오차를 코드상 몇 m까지 볼지
- 체크인 실패 코드 이름과 앱 메시지 연결 방식
- 홈 `zones` 정렬과 노출 규칙

## 작업하면서 계속 지켜야 할 원칙
- Figma와 앱 문서에 없는 제품 동작을 서버에서 임의로 만들지 않는다.
- API 계약이 바뀌면 루트의 `STEELART_SERVER_API_DRAFT.md`도 같이 갱신한다.
- 스키마 가정이 바뀌면 `STEELART_DB_TABLES.md` 또는 raw DDL 기준으로 같이 맞춘다.
- 핸들러는 얇게 유지하고, 비즈니스 로직은 서비스, SQL은 리포지토리로 분리한다.
- 공지, 외부 링크, 최근 검색어, 지도 상세 전용 API 같은 비대상 범위는 초기에 만들지 않는다.

## 한 줄 결론
- 내가 너와 이 폴더에서 해야 하는 일은, 문서로 합의된 SteelArt 서버 방향을 바탕으로 `Node.js + TypeScript + mysql2 + zod` 구조의 실제 `steelart_server`를 부트스트랩하고, `/v1` 인증/사용자 API부터 시작해서 홈/검색/작품/지도/코스/체크인 API를 구현 가능한 순서대로 완성하는 것이다.
