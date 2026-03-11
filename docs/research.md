# 3단계 실행 리서치

## 문서 목적
- 이 문서는 [IMPLEMENTATION_SEQUENCE.md](./IMPLEMENTATION_SEQUENCE.md)의 `3단계. SAM HTTP API 및 자동 CI/CD`를 실제로 시작하기 전에 필요한 자료를 모아둔 리서치 문서다.
- 대상 브랜치는 `codex/03-sam-http-api-cicd`다.
- 기존 `research.md` 내용은 제거하고, 3단계 전용 내용만 남긴다.

## 대상 단계 요약
- 목표: `AWS SAM + HTTP API + GitHub Actions` 기준의 배포 골격을 확정한다.
- 구현 범위:
  - `infra/sam/template.yaml` 생성
  - `AWS::Serverless::HttpApi` 리소스 정의
  - 도메인 Lambda 리소스 골격 정의
  - 공통 환경 변수 wiring
  - `infra/sam/samconfig.toml` 생성
  - `.github/workflows/ci.yml` 생성
  - `.github/workflows/deploy.yml` 생성
  - `nodejs24.x`, `arm64`, `esbuild` 기준 설정
  - 기본 IAM 정책과 로그 설정 정리
- 산출물:
  - `sam build` 가능한 SAM 템플릿
  - CI/CD 워크플로우 초안

## 현재 시작점
- 1단계 부트스트랩은 이미 끝나 있다.
- 2단계 공통 런타임도 이미 `src/shared/*` 기준으로 들어가 있다.
- 따라서 3단계는 “서버 코드가 어느 정도 준비된 상태에서 인프라 뼈대와 배포 파이프라인을 연결하는 단계”로 보면 된다.
- 현재 리포지토리 구조상 3단계의 핵심 신규 파일은 아래다.
  - `infra/sam/template.yaml`
  - `infra/sam/samconfig.toml`
  - `.github/workflows/ci.yml`
  - `.github/workflows/deploy.yml`

## 3단계에서 바로 결정해도 되는 것
- API Gateway는 계속 `HTTP API`로 간다.
- SAM 템플릿은 `Transform: AWS::Serverless-2016-10-31` 기준으로 간다.
- Lambda runtime은 `nodejs24.x`
- Lambda architecture는 `arm64`
- TypeScript 빌드는 `esbuild`
- SAM 템플릿 공통값은 `Globals`로 최대한 모은다.
- CI와 deploy workflow는 분리한다.
- AWS 인증은 장기 액세스 키보다 GitHub OIDC + role assume을 우선한다.

## 3단계에서 아직 미루는 것
- 실제 도메인 API 라우트 전체 연결
- JWT authorizer 상세 설계
- Secrets Manager 런타임 fetch 구현
- RDS Proxy 실제 연결
- 스테이징/운영 외의 복잡한 다중 환경 전략
- canary, alarms, auto rollback 같은 고급 배포 전략

## 공식 자료 기준 핵심 사실

### 1. Lambda 런타임
- AWS Lambda는 `Node.js 24`를 `nodejs24.x`로 공식 지원한다.
- 운영체제는 `Amazon Linux 2023`다.
- 현재 문서 기준에서 `nodejs24.x` 선택은 맞다.

### 2. SAM 템플릿의 공통 구성
- AWS SAM 템플릿은 `Globals` 섹션으로 `AWS::Serverless::Function`과 `AWS::Serverless::HttpApi` 같은 리소스의 공통 속성을 상속시킬 수 있다.
- 3단계에서는 `Runtime`, `Architectures`, `Timeout`, `MemorySize`, `Environment`, `LoggingConfig` 같은 중복 속성을 `Globals.Function`으로 모으는 편이 적절하다.

### 3. `AWS::Serverless::HttpApi`
- `AWS::Serverless::HttpApi`는 `AccessLogSettings`, `Auth`, `DefaultRouteSettings`, `RouteSettings`, `StageName`, `PropagateTags` 등을 가진다.
- `AccessLogSettings`는 API stage access log 설정이다.
- `PropagateTags: true`를 주면 태그가 생성 리소스에 전파된다.

### 4. Function의 `HttpApi` 이벤트
- `AWS::Serverless::Function`의 `Events`에서 `Type: HttpApi`를 선언할 수 있다.
- `Path`, `Method`, `ApiId`, `PayloadFormatVersion`, `RouteSettings`를 줄 수 있다.
- `PayloadFormatVersion`의 기본값은 `2.0`이다.
- `Path`와 `Method`를 생략하면 default route가 생기므로, SteelArt는 도메인별 명시 라우트를 쓰는 편이 안전하다.

### 5. TypeScript + esbuild
- AWS SAM은 Node.js Lambda를 `esbuild`로 빌드할 수 있다.
- `AWS::Serverless::Function` 리소스에 `Metadata`를 두고 `BuildMethod: esbuild`를 지정하면 된다.
- AWS 공식 예시도 `Environment.Variables.NODE_OPTIONS: --enable-source-maps`를 함께 둔다.

### 6. `samconfig.toml`
- `samconfig.toml`은 SAM CLI 설정 파일이다.
- SAM CLI는 `template.yaml` 위치를 기준으로 `samconfig.toml`을 찾는다.
- `--config-file` 값도 template 위치를 기준으로 해석된다.
- 따라서 이 프로젝트에서는 `infra/sam/template.yaml`과 `infra/sam/samconfig.toml`을 같은 디렉터리에 두는 편이 가장 단순하다.

### 7. `sam validate`
- `sam validate`는 템플릿이 유효한지 검사한다.
- `--lint` 옵션으로 `cfn-lint`를 통한 추가 검증을 수행할 수 있다.
- AWS 공식 문서상 `sam validate`는 AWS credentials configured 상태를 요구한다.

### 8. `sam build`
- `sam build`는 이후 `sam deploy`에 사용될 빌드 결과물을 준비한다.
- `--base-dir`로 code path 해석 기준을 바꿀 수 있지만, 현재 구조에서는 template 기준 상대 경로를 명확히 잡는 쪽이 더 단순하다.
- 캐시 빌드는 가능하지만 3단계 초안에서는 옵션을 단순하게 유지하는 편이 좋다.

### 9. `sam deploy`
- 첫 배포는 `sam deploy --guided`로 설정값을 만들고, 이후에는 `sam deploy`로 간다.
- 설정값은 `samconfig.toml`에 저장된다.
- CI 배포에서는 보통 `--no-confirm-changeset`와 `--no-fail-on-empty-changeset`를 함께 쓴다.
- IAM 리소스가 포함되면 `CAPABILITY_IAM` 또는 `CAPABILITY_NAMED_IAM`가 필요하다.

### 10. GitHub Actions 기본 문법
- workflow 파일은 `.github/workflows` 아래에 둬야 한다.
- `on`으로 `push`, `pull_request`, `workflow_dispatch` 등을 정의한다.
- branch/path filter를 함께 걸 수 있다.
- action은 SHA, version tag, branch로 지정할 수 있지만, GitHub는 commit SHA pinning이 가장 안전하다고 권장한다.

### 11. GitHub OIDC + AWS
- GitHub Docs와 AWS 공식 action README 모두 OIDC를 권장한다.
- deploy workflow는 `permissions.id-token: write`가 필요하다.
- `contents: read`는 checkout에 필요하다.
- GitHub OIDC provider는 `https://token.actions.githubusercontent.com`
- audience는 공식 action 기준 `sts.amazonaws.com`
- trust policy에는 `token.actions.githubusercontent.com:sub` 조건을 넣어 어떤 repo/branch/workflow가 role을 assume할 수 있는지 제한하는 게 권장된다.

### 12. GitHub Actions에서 Node / pnpm / SAM
- `actions/setup-node`는 `node-version: 24`를 명시하는 걸 권장한다.
- `actions/setup-node`는 `pnpm` cache도 지원한다.
- `pnpm/action-setup`은 pnpm 설치용이고 Node 설치는 따로 하지 않는다.
- `aws-actions/setup-sam`은 SAM CLI를 설치하고 PATH에 넣는다.
- `aws-actions/setup-sam` README 예시도 `setup-sam` 이후 `configure-aws-credentials`와 `sam build`, `sam deploy` 순서를 사용한다.

## 이 단계에서 필요한 구체적 산출물

### 1. `infra/sam/template.yaml`

#### 꼭 들어가야 하는 상위 구조
- `AWSTemplateFormatVersion`
- `Transform: AWS::Serverless-2016-10-31`
- `Description`
- `Parameters`
- `Globals`
- `Resources`
- `Outputs`

#### `Parameters` 권장안
- `StageName`
- `AppName`
- `AwsRegion` 또는 region은 런타임에서 환경변수로만 처리
- `DbHost`
- `DbPort`
- `DbName`
- `DbUser`
- `DbPasswordSecretArn` 또는 임시 plain env placeholder
- `JwtSecretArn` 또는 임시 plain env placeholder

#### 3단계에서의 현실적인 권장안
- 3단계는 CI/CD skeleton이 우선이므로, `Secrets Manager` ARN을 parameter로 받는 구조만 먼저 열어두고 실제 secret fetch는 4단계 이후에 미뤄도 된다.
- 즉, template에는 환경 변수 wiring까지만 넣고, 런타임 secret retrieval은 아직 구현하지 않아도 된다.

#### `Globals.Function` 권장안
- `Runtime: nodejs24.x`
- `Architectures: [arm64]`
- `Timeout`
- `MemorySize`
- `Environment.Variables`
  - `APP_ENV`
  - `AWS_REGION`
  - `NODE_OPTIONS: --enable-source-maps`
  - DB / auth 관련 키
- `LoggingConfig`
- 필요 시 `Tags`

#### `Globals.HttpApi`를 따로 둘지 여부
- AWS SAM `Globals`는 `AWS::Serverless::HttpApi`도 지원한다.
- 다만 지금 구조에서는 `HttpApi` 리소스가 하나일 가능성이 높아서, 별도 `Globals.HttpApi`보다 `Resources.HttpApi.Properties`에서 직접 선언해도 충분하다.

### 2. `AWS::Serverless::HttpApi` 리소스

#### 3단계에서 추천하는 최소 속성
- `Name`
- `StageName`
- `AccessLogSettings`
- `DefaultRouteSettings`
- `PropagateTags: true`
- `Tags`

#### `AccessLogSettings`에 필요한 것
- 별도 `AWS::Logs::LogGroup`
- `DestinationArn`
- `Format`

#### access log format에 포함하면 좋은 값
- `$context.requestId`
- `$context.httpMethod`
- `$context.routeKey`
- `$context.status`
- `$context.responseLength`
- `$context.identity.sourceIp`

#### `StageName` 선택
- 3단계 초안에서는 `dev` 또는 parameter 기반이 무난하다.
- production까지 바로 엮지 않는다면 `StageName`은 parameter화하는 편이 이후 재사용성이 높다.

### 3. 도메인 Lambda 리소스 골격

#### 3단계에서 필요한 리소스
- `AuthFunction`
- `UsersFunction`
- `HomeFunction`
- `SearchFunction`
- `ArtworksFunction`
- `MapFunction`
- `CoursesFunction`

#### 각 함수에 공통으로 필요한 것
- `Type: AWS::Serverless::Function`
- `CodeUri`
- `Handler`
- `Events`
- `Metadata.BuildMethod: esbuild`

#### `CodeUri` 전략
- 현재 코드베이스는 루트 `src/` 아래에 모든 코드가 있다.
- SAM은 template 기준 상대 경로를 쓰므로 `../../src` 같은 형태가 될 수 있다.
- 이 경로는 장기적으로 읽기 불편하므로, 3단계에서는 다음 둘 중 하나를 선택해야 한다.
  1. template 기준 상대 경로를 그대로 사용
  2. root script에서 `--base-dir`를 사용
- 현재 구조와 단순성을 기준으로 보면 `template.yaml`에서 명시 경로를 쓰는 쪽이 먼저 낫다.

#### `Handler` 전략
- 현재 핸들러 위치:
  - `src/lambdas/auth/handler.ts`
  - `src/lambdas/users/handler.ts`
  - 나머지는 아직 `.gitkeep`만 있음
- 3단계에서는 나머지 도메인 핸들러 파일도 placeholder라도 실제 `handler.ts`를 만들어야 `sam build`가 깨지지 않는다.
- 이건 로컬 문서와 현재 코드 상태를 바탕으로 한 구현 추론이다.

#### `Metadata` 권장안
- `BuildMethod: esbuild`
- `BuildProperties`
  - `EntryPoints`
  - `Minify: false`
  - `Target: es2022`
  - `Sourcemap: true`
  - `Format: esm`
  - `OutExtension`
  - `External`

#### `Format: esm` 선택 이유
- 현재 `package.json`이 `"type": "module"`이다.
- 따라서 Lambda 핸들러 번들도 ESM 전제를 유지하는 쪽이 충돌이 적다.
- 이 부분은 현재 저장소 설정을 바탕으로 한 구현 판단이다.

### 4. 환경 변수 wiring

#### 3단계에서 wiring 해야 하는 값
- `APP_ENV`
- `AWS_REGION`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`
- `LOG_LEVEL`

#### Secrets handling 방향
- 문서 기준 목표는 `Secrets Manager`지만, 3단계는 skeleton이다.
- 따라서 3단계 구현 방식은 둘 중 하나다.
  1. deploy parameter로 바로 environment variables 주입
  2. secret ARN만 주입하고 런타임 구현은 나중 단계
- 3단계 목표가 `sam validate/build/deploy skeleton`인 점을 감안하면, 먼저 1번으로 움직이고 4단계 이후 2번으로 전환하는 게 가장 빠르다.
- 이건 source를 바탕으로 한 구현 전략 추론이다.

### 5. IAM / Logs

#### 3단계에서 필요한 최소 IAM
- Lambda execution role
- CloudWatch Logs 쓰기
- 이후 비밀값, DB, X-Ray 접근은 별도 확장

#### 실전 주의
- template에 IAM 리소스가 포함되면 deploy command에 capability 설정이 필요하다.
- custom role names를 넣으면 `CAPABILITY_NAMED_IAM`가 필요할 수 있다.
- 처음에는 SAM이 생성하는 role에 최소 정책만 붙이는 편이 단순하다.

#### 로그 설정
- Function level: `LoggingConfig`
- API level: `HttpApi.AccessLogSettings`
- 둘은 역할이 다르므로 둘 다 두는 편이 좋다.

## `samconfig.toml` 설계 포인트

### 파일 위치
- `infra/sam/samconfig.toml`
- `template.yaml`과 같은 디렉터리에 둔다.

### 이유
- AWS 공식 문서상 config file은 template 위치 기준으로 해석된다.
- 같은 디렉터리에 두면 root script와 CI에서 path 혼동이 가장 적다.

### environment 이름 권장안
- `default`
- `dev`
- `prod`

### 3단계에서 넣어둘 만한 값
- `stack_name`
- `s3_bucket`
- `s3_prefix`
- `region`
- `capabilities`
- `confirm_changeset = false`
- `fail_on_empty_changeset = false`
- `resolve_s3 = true` 여부

### 주의
- 계정/버킷 이름처럼 환경별 민감한 운영값을 저장할지 여부는 팀 정책 문제다.
- 이 저장소는 공개 GitHub 저장소이므로, secret은 넣지 않되 non-secret deploy config만 넣는 편이 안전하다.

## GitHub Actions 설계 포인트

### `ci.yml`

#### 목적
- PR과 branch push에서 quality gate 수행

#### 추천 trigger
- `pull_request`:
  - `main`
- `push`:
  - `main`
  - 필요 시 `codex/**`

#### path filter 후보
- `src/**`
- `infra/sam/**`
- `.github/workflows/**`
- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`

#### 추천 단계
1. checkout
2. setup node 24
3. setup pnpm
4. install
5. typecheck
6. test
7. setup sam
8. sam build
9. 필요 시 sam validate

#### 중요한 주의
- AWS 공식 문서상 `sam validate`는 AWS credentials configured를 요구한다.
- 따라서 PR CI에서 OIDC를 쓰지 않을 계획이면 `ci.yml`은 `sam build`까지만 하고, `sam validate`는 deploy workflow로 보내는 구성이 현실적이다.
- 반대로 PR CI에도 OIDC를 줄 수 있다면 `sam validate --lint`까지 포함 가능하다.
- 이건 공식 문서의 credential requirement를 바탕으로 한 운영 추론이다.

### `deploy.yml`

#### 목적
- trusted branch 기준 AWS 배포

#### 추천 trigger
- `push` on `main`
- `workflow_dispatch`

#### 권한
- `permissions`
  - `contents: read`
  - `id-token: write`

#### 추천 단계
1. checkout
2. setup node 24
3. setup pnpm
4. install
5. setup sam
6. configure aws credentials by OIDC
7. sam validate
8. sam build
9. sam deploy

#### deploy command 권장 옵션
- `--config-env <env>`
- `--no-confirm-changeset`
- `--no-fail-on-empty-changeset`
- 필요 시 `--capabilities CAPABILITY_IAM`

### Action 선택 기준
- `actions/checkout`
- `actions/setup-node`
- `pnpm/action-setup`
- `aws-actions/setup-sam`
- `aws-actions/configure-aws-credentials`

### 보안 기준
- GitHub Docs는 action을 SHA로 pin하는 것이 가장 안전하다고 권장한다.
- 3단계 구현에서는 적어도 major version 또는 SHA pinning 전략을 명시해야 한다.

## 이 저장소에 맞는 권장 명령 형태

### 로컬
- `pnpm install`
- `pnpm typecheck`
- `pnpm test`
- `sam validate --template-file infra/sam/template.yaml --config-file samconfig.toml`
- `sam build --template-file infra/sam/template.yaml --config-file samconfig.toml`

### 최초 수동 배포
- `sam deploy --guided --template-file infra/sam/template.yaml --config-file samconfig.toml`

### CI/CD 배포
- `sam deploy --template-file infra/sam/template.yaml --config-file samconfig.toml --config-env <env> --no-confirm-changeset --no-fail-on-empty-changeset`

## 3단계 구현 시 예상되는 결정 포인트

### 1. `sam validate`를 CI에 넣을지
- 넣는다:
  - OIDC 또는 AWS credentials가 CI에도 필요
- 안 넣는다:
  - PR CI는 `typecheck/test/sam build`
  - deploy workflow에서 `sam validate`

### 2. deploy workflow의 환경 수
- 최소:
  - `dev`
  - `prod`
- skeleton 단계에서는 `dev` 한 개만 먼저 열어도 된다.

### 3. placeholder handler 추가 여부
- `sam build`를 확실히 통과시키려면 모든 함수 logical resource가 참조하는 실제 `handler.ts` 파일이 존재해야 한다.
- 따라서 3단계에서 미구현 도메인에도 최소 placeholder handler 파일을 추가할 가능성이 높다.

### 4. IAM role naming
- custom named role을 만들면 capability와 운영 복잡도가 올라간다.
- 3단계 skeleton은 자동 생성 role이 더 단순하다.

## 3단계에서 피해야 할 실수
- `AWS::Serverless::Api`로 다시 돌아가는 것
- `HttpApi` default route를 실수로 여러 함수에 두는 것
- template와 samconfig를 다른 디렉터리에 두고 path 해석을 혼동하는 것
- CI workflow에 `id-token: write`를 전역으로 남발하는 것
- 배포 workflow에 long-lived AWS key를 secret으로 넣는 것
- `sam validate` credential requirement를 무시하고 PR CI를 불안정하게 만드는 것
- `main` push와 PR workflow의 역할을 섞어버리는 것

## 3단계에서 권장하는 구현 순서
1. `infra/sam/template.yaml`
2. placeholder handler가 없는 도메인 Lambda 파일 추가
3. `infra/sam/samconfig.toml`
4. 루트 `package.json`의 `sam:*` 스크립트를 실제 명령으로 교체
5. `.github/workflows/ci.yml`
6. `.github/workflows/deploy.yml`
7. `sam validate`
8. `sam build`

## 3단계 완료 조건을 코드/운영 기준으로 풀어쓰면
- `infra/sam/template.yaml`이 존재한다.
- `AWS::Serverless::HttpApi`가 명시적으로 선언되어 있다.
- 도메인 Lambda 리소스가 template에 골격으로 선언되어 있다.
- `nodejs24.x`, `arm64`, `esbuild`가 template 기준으로 반영되어 있다.
- `infra/sam/samconfig.toml`이 template 기준 경로와 맞게 배치되어 있다.
- `ci.yml`, `deploy.yml`이 문법상 유효하다.
- `sam validate`가 통과한다.
- `sam build`가 통과한다.

## 공식 참고 자료
- AWS Lambda Node.js runtime: [Building Lambda functions with Node.js](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html)
- AWS SAM HttpApi resource: [AWS::Serverless::HttpApi](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-resource-httpapi.html)
- AWS SAM Function HttpApi event: [HttpApi property for Function](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-property-function-httpapi.html)
- AWS SAM Function resource: [AWS::Serverless::Function](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-resource-function.html)
- AWS SAM Globals: [Globals section of the AWS SAM template](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-specification-template-anatomy-globals.html)
- AWS SAM TypeScript + esbuild: [Building Node.js Lambda functions with esbuild in AWS SAM](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-using-build-typescript.html)
- AWS SAM config file: [AWS SAM CLI configuration file](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-config.html)
- AWS SAM validate: [sam validate](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-validate.html)
- AWS SAM validate overview: [Validate AWS SAM template files](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-using-validate.html)
- AWS SAM build: [sam build](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-build.html)
- AWS SAM deploy overview: [Introduction to deploying with AWS SAM](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/using-sam-cli-deploy.html)
- AWS SAM deploy reference: [sam deploy](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-deploy.html)
- GitHub Actions workflow syntax: [Workflow syntax for GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- GitHub OIDC with AWS: [Configuring OpenID Connect in Amazon Web Services](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)
- `aws-actions/setup-sam`: [setup-sam README](https://github.com/aws-actions/setup-sam)
- `aws-actions/configure-aws-credentials`: [configure-aws-credentials README](https://github.com/aws-actions/configure-aws-credentials)
- `actions/setup-node`: [setup-node README](https://github.com/actions/setup-node)
- `pnpm/action-setup`: [pnpm action setup README](https://github.com/pnpm/action-setup)

## 한 줄 결론
- 3단계의 핵심은 “`shared` 기반 위에 `SAM template + samconfig + CI workflow + OIDC deploy workflow`를 최소하지만 실제 배포 가능한 형태로 연결하는 것”이며, 특히 `HttpApi 명시 라우트`, `template와 samconfig의 같은 디렉터리 배치`, `deploy job만 OIDC 권한 부여`, `sam validate credential requirement`를 먼저 정확히 잡는 것이 중요하다.
