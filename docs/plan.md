# research.md 구현 상세 플랜

## 문서 목적
- 이 문서는 `research.md`에 정리된 `1단계 실행 리서치`를 실제 구현 작업으로 옮기기 위한 상세 플랜이다.
- 대상 범위는 `IMPLEMENTATION_SEQUENCE.md`의 `1단계. 프로젝트 부트스트랩`이며, 대상 브랜치는 `codex/01-bootstrap-project`다.

## 목표
- `steelart_server`를 실제 코드 프로젝트로 시작 가능한 상태로 만든다.
- 이후 단계에서 공통 런타임, SAM 템플릿, 도메인 API를 바로 얹을 수 있도록 기본 뼈대를 만든다.
- 이 단계에서는 기능 구현보다 "구조와 설정"을 만드는 데 집중한다.

## 기준 문서
- `/Users/donggyunyang/code/steelart/steelart_server/docs/research.md`
- `/Users/donggyunyang/code/steelart/steelart_server/docs/MASTER_PLAN.md`
- `/Users/donggyunyang/code/steelart/steelart_server/docs/IMPLEMENTATION_SEQUENCE.md`
- `/Users/donggyunyang/code/steelart/steelart_server/docs/FOLDER_STRUCTURE_DRAFT.md`
- `/Users/donggyunyang/code/steelart/steelart_server/docs/SERVER_ARCHITECTURE_DRAFT.md`

## 범위

### 이번 단계에 포함
- 루트 설정 파일 생성
- 기본 디렉터리 구조 생성
- 최소 placeholder 엔트리 파일 생성
- 타입체크 가능 상태 확보
- 2단계와 3단계로 넘길 수 있는 기반 마련

### 이번 단계에 제외
- 실제 API 구현
- DB 연결 로직 구현
- `zod` 스키마 구현
- SAM 템플릿 상세 작성
- GitHub Actions 워크플로우 상세 구현
- 인증/토큰/응답 유틸 구현

## 구현 순서

### 0. 깃 브랜치 생성

### 1. 현재 상태 확인
- 현재 `steelart_server`에 코드 프로젝트 파일이 없는지 확인한다.
- 이미 존재하는 설정 파일과 충돌하는 이름이 없는지 확인한다.
- 문서 기준 디렉터리 구조와 실제 폴더 상태를 비교한다.

### 2. 루트 설정 파일 작성
- `package.json`
- `tsconfig.json`
- `.env.example`

#### `package.json` 작성 원칙
- 루트 단일 패키지 구조
- `private: true`
- `packageManager: pnpm`
- `engines.node: >=24`
- 최소 스크립트:
  - `typecheck`
  - `build`
  - `lint`
  - `test`
  - `sam:validate`
  - `sam:build`

#### `package.json` 초기 devDependencies
- `typescript`
- `@types/node`
- `@types/aws-lambda`

#### `tsconfig.json` 작성 원칙
- 타입체크 중심
- `noEmit: true`
- `strict: true`
- `target: ES2022` 이상
- `module: NodeNext`
- `moduleResolution: NodeNext`
- `skipLibCheck: true`
- `resolveJsonModule: true`
- `verbatimModuleSyntax: true`
- `isolatedModules: true`

#### `.env.example` 작성 원칙
- 실제 값은 넣지 않는다.
- 초기 변수 키만 정의한다.
- 권장 키:
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

### 3. 디렉터리 구조 생성
- `.github/workflows/`
- `infra/sam/`
- `src/`
- `tests/`

#### `src/` 하위 구조
- `src/lambdas/auth/`
- `src/lambdas/users/`
- `src/lambdas/home/`
- `src/lambdas/search/`
- `src/lambdas/artworks/`
- `src/lambdas/map/`
- `src/lambdas/courses/`
- `src/domains/auth/`
- `src/domains/users/`
- `src/domains/home/`
- `src/domains/search/`
- `src/domains/artworks/`
- `src/domains/map/`
- `src/domains/courses/`
- `src/shared/api/`
- `src/shared/auth/`
- `src/shared/db/`
- `src/shared/env/`
- `src/shared/geo/`
- `src/shared/logger/`
- `src/shared/utils/`
- `src/shared/validation/`

#### `tests/` 하위 구조
- `tests/unit/`
- `tests/integration/`

### 4. 최소 placeholder 파일 생성
- `src/lambdas/auth/handler.ts`
- `src/lambdas/users/handler.ts`

#### placeholder 원칙
- export 가능한 최소 함수만 둔다.
- 추후 SAM `EntryPoint`가 될 위치라는 점만 분명히 한다.
- 라우팅, 비즈니스 로직, 응답 유틸은 넣지 않는다.

### 5. 문서 정합성 맞추기
- 생성한 구조가 `FOLDER_STRUCTURE_DRAFT.md`와 크게 다르지 않은지 확인한다.
- 새 파일이 생겼다면 문서 목록이 필요한 최소 범위에서 맞는지 확인한다.
- 1단계 범위를 넘는 구현이 들어가 있지 않은지 확인한다.

### 6. 로컬 검증
- `pnpm install`
- `pnpm typecheck`
- 필요 시 `pnpm build`

### 7. 결과 점검
- "프로젝트 초기화가 재현 가능하다"는 조건을 만족하는지 점검한다.
- 2단계 브랜치에서 공통 런타임 구현을 바로 시작할 수 있는 상태인지 확인한다.

## 파일별 예상 결과

### `package.json`
- 루트 패키지 기준으로 동작
- 최소 스크립트만 정의
- 런타임은 `Node.js 24` 기준

### `tsconfig.json`
- `tsc` emit 없이 타입체크만 수행
- Node 24와 TypeScript 최신 문법에 무리가 없는 설정

### `.env.example`
- 향후 필요한 secret과 환경 변수 키를 명세
- 실제 값 없음

### `src/lambdas/auth/handler.ts`
- placeholder handler export

### `src/lambdas/users/handler.ts`
- placeholder handler export

## 검증 체크리스트

### 구조 체크
- 문서에 정의된 핵심 디렉터리가 모두 존재한다.
- 루트에는 설정 파일만 생기고 실제 도메인 구현은 아직 없다.
- 함수별 개별 `package.json`이 생기지 않았다.

### 설정 체크
- `package.json`이 `pnpm`과 `Node.js 24` 기준으로 작성되었다.
- `tsconfig.json`이 타입체크 중심이다.
- `.env.example`에 실제 secret이 없다.

### 실행 체크
- `pnpm install` 성공
- `pnpm typecheck` 성공
- placeholder 파일 기준 import/type 에러 없음

### 범위 체크
- 1단계에서 공통 런타임 로직을 구현하지 않았다.
- 1단계에서 SAM 템플릿 상세와 CI/CD 구현을 하지 않았다.
- 1단계에서 API 비즈니스 로직을 넣지 않았다.

## 예상 리스크
- TypeScript 설정을 너무 빨리 확정해 이후 SAM/esbuild와 충돌할 수 있다.
- placeholder 파일을 과하게 구현하면 2단계 범위를 잠식할 수 있다.
- `.env.example`에 너무 많은 변수를 넣으면 아직 확정되지 않은 설계가 굳을 수 있다.

## 대응 원칙
- 설정은 최소한으로 시작한다.
- placeholder는 정말 최소 구현만 둔다.
- 확정되지 않은 값은 변수 키 정도만 열어두고 상세는 다음 단계로 넘긴다.

## 이번 단계 완료 조건
- 루트 설정 파일이 모두 존재한다.
- 문서 기준 디렉터리 구조가 실제로 생성되어 있다.
- 최소 placeholder 엔트리 파일이 존재한다.
- `pnpm typecheck`가 통과한다.
- 다음 브랜치 `codex/02-shared-runtime`에서 바로 공통 모듈 구현에 들어갈 수 있다.

## 한 줄 결론
- `research.md`를 구현하는 1단계 작업은 "루트 설정 파일 + 디렉터리 구조 + 최소 placeholder"까지만 만드는 부트스트랩 작업이며, 공통 로직과 인프라 상세는 다음 단계로 넘기는 것이 맞다.
