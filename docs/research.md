# 1단계 실행 리서치

## 대상 단계
- 문서 기준 단계: `IMPLEMENTATION_SEQUENCE.md`의 `1단계. 프로젝트 부트스트랩`
- 대상 브랜치: `codex/01-bootstrap-project`

## 1단계의 목표
- 아직 코드가 없는 `steelart_server`를 실제 TypeScript 서버 프로젝트로 시작 가능한 상태로 만든다.
- 이후 단계에서 공통 모듈, SAM 템플릿, 도메인 API를 얹을 수 있도록 최소 골격만 만든다.
- 이 단계에서는 제품 기능 구현보다 "프로젝트가 자랄 수 있는 기반"을 만드는 것이 목표다.

## 1단계에서 해야 하는 일
- 루트 `package.json` 생성
- 루트 `tsconfig.json` 생성
- 루트 `.env.example` 생성
- `src/`, `infra/sam/`, `.github/workflows/`, `tests/` 디렉터리 생성
- `src/lambdas/`, `src/domains/`, `src/shared/` 하위 기본 구조 생성
- 최소 엔트리 파일 또는 placeholder 파일 생성
- 타입체크와 빌드 검증을 위한 최소 스크립트 연결

## 1단계에서 하지 말아야 하는 일
- 실제 도메인 비즈니스 로직 구현
- SAM 템플릿 상세 라우트 작성
- GitHub Actions 워크플로우 상세 구현
- 인증/DB/응답 유틸 구현
- 실제 API 계약 구현
- 실제 체크인/좋아요/검색 기능 구현

## 1단계에 필요한 확정 입력값

### 기술 스택
- 런타임: `Node.js 24`
- Lambda 런타임 식별자: `nodejs24.x`
- 아키텍처: `arm64`
- 언어: `TypeScript`
- 패키지 매니저: `pnpm`
- API Gateway 기준: `HTTP API`
- 인프라 기준: `AWS SAM`
- DB 접근 기준: `mysql2`
- 요청 검증 기준: `zod`

### 구조 원칙
- 루트는 진입 문서와 프로젝트 설정만 둔다.
- 로컬 문서는 `docs/` 아래에서 관리한다.
- 비즈니스 로직은 `src/domains`
- Lambda 엔트리포인트는 `src/lambdas`
- 공통 코드는 `src/shared`
- SAM 템플릿은 `infra/sam`
- 자동 배포는 `.github/workflows`

### 브랜치 작업 원칙
- 브랜치명은 `codex/01-bootstrap-project`
- 이 브랜치에서는 "구조와 설정"만 만든다.
- 공통 런타임 로직은 다음 브랜치 `codex/02-shared-runtime`에서 구현한다.
- SAM 템플릿 상세와 CI/CD 구현은 `codex/03-sam-http-api-cicd`에서 진행한다.

## 1단계에서 생성해야 하는 디렉터리

### 루트 디렉터리
- `.github/workflows/`
- `infra/sam/`
- `src/`
- `tests/`

### `src/` 하위
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

### `tests/` 하위
- `tests/unit/`
- `tests/integration/`

## 1단계에서 생성해야 하는 파일

### 루트 파일
- `package.json`
- `tsconfig.json`
- `.env.example`

### 최소 placeholder 파일
- `src/lambdas/auth/handler.ts`
- `src/lambdas/users/handler.ts`

### 지금은 디렉터리만 만들어도 되는 위치
- `infra/sam/`
- `.github/workflows/`
- `src/domains/*`
- `src/shared/*`
- `tests/*`

## package.json에 필요한 정보

### 목적
- 루트 단일 패키지 기준으로 의존성과 스크립트를 관리한다.
- 함수별 개별 `package.json` 구조는 사용하지 않는다.

### 기본 필드 권장안
- `name`: `steelart_server`
- `private`: `true`
- `packageManager`: `pnpm`
- `engines.node`: `>=24`

### 초기 스크립트 권장안
- `typecheck`
- `build`
- `lint`
- `test`
- `sam:validate`
- `sam:build`

### 1단계에서 바로 넣어도 되는 devDependencies
- `typescript`
- `@types/node`
- `@types/aws-lambda`

### 1단계에서 넣어도 되지만 급하지 않은 항목
- `esbuild`
- `eslint`
- `vitest` 또는 다른 테스트 러너

### 2단계 이후에 넣어도 되는 런타임 의존성
- `zod`
- `mysql2`
- `@aws-sdk/*`

## tsconfig.json에 필요한 정보

### 역할
- root `tsconfig.json`은 TypeScript emit보다 타입체크 기준 설정 역할이 더 크다.
- 실제 Lambda 번들은 이후 `AWS SAM + esbuild`가 담당한다.

### 권장 방향
- `target`: `ES2022` 이상
- `module`: `NodeNext`
- `moduleResolution`: `NodeNext`
- `strict`: `true`
- `noEmit`: `true`
- `skipLibCheck`: `true`
- `resolveJsonModule`: `true`
- `verbatimModuleSyntax`: `true`
- `isolatedModules`: `true`

### 이유
- Node 24와 맞는 최신 문법을 쓰기 쉽다.
- root build는 타입체크 중심으로 단순화할 수 있다.
- 실제 배포 아티팩트는 SAM/esbuild가 만들기 때문에 `tsc` emit에 의존할 필요가 없다.

## .env.example에 필요한 정보

### 목적
- 실제 secret을 넣는 파일이 아니라, 어떤 환경 변수가 필요한지 명세하는 파일이다.
- 1단계에서는 값보다 키 목록의 뼈대를 먼저 잡는 것이 중요하다.

### 초기 placeholder 권장안
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

### 주의
- 실제 비밀값은 넣지 않는다.
- 이후 단계에서 `Secrets Manager` 기준으로 정리하더라도 `.env.example`은 개발용 명세 문서로 유지한다.

## placeholder 파일에 필요한 정보

### `src/lambdas/auth/handler.ts`
- 최소 export만 있는 placeholder로 충분하다.
- 이후 SAM/esbuild에서 entry point로 연결될 위치라는 점만 드러나면 된다.

### `src/lambdas/users/handler.ts`
- `auth`와 같은 방식의 최소 placeholder면 된다.

### 지금 하지 않아도 되는 것
- handler 내부 라우팅 로직 작성
- APIGateway 이벤트 파싱 구현
- 응답 유틸 연결

## 1단계 완료 시 확인해야 할 문서 정합성
- `README.md`의 Read First 순서와 실제 문서 구조가 맞는지
- `FOLDER_STRUCTURE_DRAFT.md`의 구조와 실제 생성 구조가 크게 다르지 않은지
- `MASTER_PLAN.md`와 `IMPLEMENTATION_SEQUENCE.md`의 1단계 범위가 실제 작업 범위와 맞는지

## 1단계 검증 기준 상세

### 로컬 검증
- `pnpm install`이 정상 동작한다.
- `pnpm typecheck`가 통과한다.
- placeholder 엔트리 파일 import 에러가 없다.

### 구조 검증
- 문서에 정의한 핵심 디렉터리가 생성되어 있다.
- 루트에는 문서/설정만 있고 도메인 구현 코드는 아직 없다.
- 함수별 개별 `package.json`이 생기지 않았다.

### 범위 검증
- SAM 상세 템플릿을 과하게 구현하지 않았다.
- 공통 런타임 로직을 1단계에서 과도하게 넣지 않았다.
- 실제 API 비즈니스 로직이 1단계 브랜치에 섞이지 않았다.

## 1단계에서 예상되는 결정 포인트

### 바로 결정해도 되는 것
- root 단일 패키지 구조 사용
- `pnpm` 사용
- `nodejs24.x` 사용
- TypeScript 타입체크 중심 `tsconfig` 사용

### 다음 브랜치에서 결정해도 되는 것
- SAM 템플릿 상세 구조
- GitHub Actions 워크플로우 내용
- 공통 에러 코드 목록
- auth guard 구현 방식
- logger 포맷

## 1단계에서 피해야 할 실수
- `Node.js 24`가 아닌 이전 런타임 기준으로 시작하는 것
- 함수별 `package.json` 구조를 도입하는 것
- secret 값을 샘플 파일에 넣는 것
- 도메인 구현 없이도 충분한 단계인데 과하게 코드를 쓰는 것
- 문서에 없는 폴더 체계를 임의로 만드는 것

## 1단계 작업에 참고할 공식 기준
- AWS Lambda는 `nodejs24.x` 런타임을 지원한다.
- `AWS SAM`은 TypeScript Lambda를 `esbuild`로 빌드할 수 있다.
- `AWS::Serverless::HttpApi`를 기준으로 HTTP API 리소스를 구성할 수 있다.

## 공식 참고 링크
- AWS Lambda Node.js 런타임: [Building Lambda functions with Node.js](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html)
- AWS Lambda 지원 런타임: [Lambda runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html)
- AWS SAM TypeScript + esbuild: [Building Node.js Lambda functions with esbuild in AWS SAM](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-using-build-typescript.html)
- AWS SAM HttpApi event/source: [HttpApi property for Function](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-property-function-httpapi.html)
- AWS SAM HttpApi resource: [AWS::Serverless::HttpApi](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-resource-httpapi.html)

## 1단계 한 줄 결론
- `codex/01-bootstrap-project` 브랜치에서는 `Node.js 24 + TypeScript + pnpm + HTTP API + AWS SAM` 기준으로 루트 설정 파일과 디렉터리 골격만 만들고, 실제 공통 로직과 인프라 상세 구현은 다음 단계로 넘기는 것이 맞다.
