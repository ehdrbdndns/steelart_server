# 3단계 상세 실행 계획

## 문서 목적
- 이 문서는 [IMPLEMENTATION_SEQUENCE.md](./IMPLEMENTATION_SEQUENCE.md)의 `3단계. SAM HTTP API 및 자동 CI/CD`를 실제 구현으로 옮기기 위한 상세 플랜이다.
- 대상 브랜치는 `codex/03-sam-http-api-cicd`다.
- 구현 단계에서 체크리스트처럼 사용할 수 있도록 작업 순서, 수정 파일, 검증 기준, 완료 조건을 함께 정리한다.

## 기준 문서
- [research.md](./research.md)
- [IMPLEMENTATION_SEQUENCE.md](./IMPLEMENTATION_SEQUENCE.md)
- [MASTER_PLAN.md](./MASTER_PLAN.md)
- [SERVER_ARCHITECTURE_DRAFT.md](./SERVER_ARCHITECTURE_DRAFT.md)
- [FOLDER_STRUCTURE_DRAFT.md](./FOLDER_STRUCTURE_DRAFT.md)

## 단계 목표
- `AWS SAM + API Gateway HTTP API + GitHub Actions` 기준의 배포 골격을 실제 리포지토리에 반영한다.
- `sam build`가 가능한 템플릿을 만든다.
- CI workflow와 deploy workflow를 분리해 이후 도메인 구현이 바로 올라갈 수 있는 기반을 만든다.

## 이번 단계에 포함하는 범위
- `infra/sam/template.yaml` 생성
- `infra/sam/samconfig.toml` 생성
- `.github/workflows/ci.yml` 생성
- `.github/workflows/deploy.yml` 생성
- `package.json`의 `sam:*` 스크립트 실제 연결
- `src/lambdas/*`의 placeholder handler 정리
- `nodejs24.x`, `arm64`, `esbuild`, `HTTP API` 기준 고정
- 최소 로그/IAM/환경 변수 wiring 반영

## 이번 단계에서 제외하는 범위
- 실제 비즈니스 로직 구현
- JWT authorizer 상세 구현
- Secrets Manager 런타임 조회 구현
- RDS Proxy 연결
- 스테이징/운영 다중 환경 세분화
- 배포 후 smoke test 자동화

## 구현 전 확인사항
- 현재 공통 런타임은 이미 `src/shared/*`에 있다.
- 현재 실제 handler 파일은 `auth`, `users`만 존재한다.
- 3단계에서 `sam build`를 통과시키려면 `home`, `search`, `artworks`, `map`, `courses` handler 파일도 최소 placeholder 형태로 필요하다.
- `sam validate`는 AWS credentials configured 상태를 요구하므로, 로컬 기본 검증과 GitHub Actions 검증 범위를 분리해서 설계해야 한다.

## 수정 대상 파일

### 새로 만들 파일
- `infra/sam/template.yaml`
- `infra/sam/samconfig.toml`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `src/lambdas/home/handler.ts`
- `src/lambdas/search/handler.ts`
- `src/lambdas/artworks/handler.ts`
- `src/lambdas/map/handler.ts`
- `src/lambdas/courses/handler.ts`

### 수정할 파일
- `package.json`
- 필요 시 `.env.example`
- 필요 시 `docs/FOLDER_STRUCTURE_DRAFT.md`
- 필요 시 `docs/README.md`

## 구현 원칙
- Lambda는 도메인별로 나누되, 각 함수는 최소 엔트리포인트만 먼저 만든다.
- SAM 템플릿은 이후 도메인 라우트를 무리 없이 추가할 수 있도록 `Parameters`, `Globals`, `Resources`, `Outputs`를 명시적으로 나눈다.
- `HTTP API`는 default route를 쓰지 않고 함수별 명시 route를 둔다.
- CI는 품질 검증 중심으로, deploy는 AWS 인증이 필요한 단계만 담당하게 나눈다.
- workflow는 장기 액세스 키가 아니라 OIDC role assume을 전제로 둔다.

## 상세 실행 순서

### 0단계. 입력값과 범위 고정
- 상태: 완료
- 작업
  - 3단계 구현 범위를 이 문서 기준으로 고정한다.
  - `Node.js 24`, `nodejs24.x`, `arm64`, `HTTP API`, `AWS SAM`, `esbuild`, `pnpm` 기준을 다시 확인한다.
  - 3단계에서 하지 않을 작업을 명시적으로 유지한다.
- 확인 포인트
  - 실제 API 구현이나 DB 접근 로직이 섞이지 않아야 한다.
  - 문서와 코드가 `REST API` 전제로 흐르지 않아야 한다.

### 1단계. Lambda 엔트리포인트 골격 보강
- 상태: 완료
- 작업
  - 없는 도메인 handler 파일을 모두 만든다.
  - 각 handler는 최소한 `APIGatewayProxyHandlerV2` 기준의 placeholder 응답을 반환하게 한다.
  - 기존 `auth`, `users` handler가 빌드 진입점으로 계속 동작하는지 확인한다.
- 대상 파일
  - `src/lambdas/home/handler.ts`
  - `src/lambdas/search/handler.ts`
  - `src/lambdas/artworks/handler.ts`
  - `src/lambdas/map/handler.ts`
  - `src/lambdas/courses/handler.ts`
- 완료 기준
  - 도메인별 handler 경로가 모두 실제 파일로 존재한다.
  - 향후 `template.yaml`에서 각 함수의 `Handler`를 안정적으로 참조할 수 있다.

### 2단계. `package.json` 스크립트와 로컬 실행 기준 정리
- 상태: 완료
- 작업
  - placeholder였던 `sam:validate`, `sam:build` 스크립트를 실제 명령으로 교체한다.
  - 필요하면 `sam:deploy:guided` 또는 동등한 보조 스크립트를 추가한다.
  - template/config 파일 위치를 기준으로 root에서 실행 가능한 명령을 정리한다.
- 대상 파일
  - `package.json`
- 권장 스크립트 방향
  - `sam:validate`
  - `sam:build`
  - 선택적으로 `sam:deploy:guided`
- 완료 기준
  - 루트에서 일관된 명령으로 SAM 검증/빌드를 실행할 수 있다.

### 3단계. `template.yaml` 상위 구조 작성
- 상태: 완료
- 작업
  - `AWSTemplateFormatVersion`, `Transform`, `Description`, `Parameters`, `Globals`, `Resources`, `Outputs`를 작성한다.
  - `StageName`, `AppName`, DB/auth/logging 관련 parameter를 정의한다.
  - `Globals.Function`에 `Runtime`, `Architectures`, `Timeout`, `MemorySize`, `Environment`, `LoggingConfig`를 모은다.
- 대상 파일
  - `infra/sam/template.yaml`
- 결정 사항
  - runtime: `nodejs24.x`
  - architecture: `arm64`
  - `NODE_OPTIONS=--enable-source-maps`
  - 공통 environment 변수 key 고정
- 완료 기준
  - 템플릿 상위 구조만 보아도 환경/함수/출력 관계가 읽힌다.

### 4단계. `AWS::Serverless::HttpApi`와 로그 리소스 구성
- 상태: 완료
- 작업
  - `AWS::Serverless::HttpApi` 리소스를 추가한다.
  - stage access log용 `AWS::Logs::LogGroup`를 만든다.
  - `StageName`, `AccessLogSettings`, `DefaultRouteSettings`, `PropagateTags`를 설정한다.
  - access log format에 request id, route key, status, source IP를 포함한다.
- 대상 파일
  - `infra/sam/template.yaml`
- 완료 기준
  - API stage 설정과 access log 경로가 템플릿에 명시된다.
  - HTTP API가 함수 이벤트와 연결될 준비가 된다.

### 5단계. 도메인 Lambda 리소스와 route 연결
- 상태: 완료
- 작업
  - `AuthFunction`, `UsersFunction`, `HomeFunction`, `SearchFunction`, `ArtworksFunction`, `MapFunction`, `CoursesFunction`를 만든다.
  - 각 함수에 `CodeUri`, `Handler`, `Events`, `Metadata.BuildMethod: esbuild`를 설정한다.
  - route는 `/v1/*` 기준으로 명시적으로 선언한다.
  - `PayloadFormatVersion`은 `2.0` 기준으로 정리한다.
- 대상 파일
  - `infra/sam/template.yaml`
- 구현 기준
  - default route는 사용하지 않는다.
  - `package.json`의 ESM 설정과 충돌하지 않도록 `esbuild` 출력 형식을 맞춘다.
- 완료 기준
  - 각 도메인 Lambda와 `HttpApi` route 연결이 템플릿 상에서 명확하다.
  - `sam build` 시 엔트리포인트 해석 오류가 없다.

### 6단계. 환경 변수 wiring과 최소 IAM 정리
- 상태: 완료
- 작업
  - `APP_ENV`, `AWS_REGION`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `LOG_LEVEL`을 function 환경 변수로 연결한다.
  - 최소 실행 권한은 SAM 기본 role 생성 + 로그 쓰기 기준으로 유지한다.
  - 지금 단계에서 Secrets Manager runtime fetch는 넣지 않고, 나중 단계 확장 가능성만 열어둔다.
- 대상 파일
  - `infra/sam/template.yaml`
  - 필요 시 `.env.example`
- 완료 기준
  - 런타임이 필요로 하는 필수 env key가 템플릿 수준에서 누락 없이 연결된다.
  - 3단계 범위를 넘는 IAM/secret 복잡성이 들어오지 않는다.

### 7단계. `samconfig.toml` 작성
- 상태: 완료
- 작업
  - `infra/sam/samconfig.toml`을 만든다.
  - `default`, `dev` 중심으로 최소 설정을 넣는다.
  - `stack_name`, `region`, `capabilities`, `confirm_changeset`, `fail_on_empty_changeset` 기준을 정한다.
  - template와 같은 디렉터리에 두는 구조를 고정한다.
- 대상 파일
  - `infra/sam/samconfig.toml`
- 주의
  - secret이나 계정 민감값은 넣지 않는다.
  - 공개 저장소에 올려도 되는 비민감 설정만 넣는다.
- 완료 기준
  - 로컬/CI에서 같은 config 경로를 기준으로 명령을 재사용할 수 있다.

### 8단계. `ci.yml` 작성
- 상태: 완료
- 작업
  - PR과 push용 quality gate workflow를 만든다.
  - `actions/checkout`, `actions/setup-node`, `pnpm/action-setup`, `aws-actions/setup-sam`를 사용한다.
  - `pnpm install`, `pnpm typecheck`, `pnpm test`, `pnpm sam:build`를 실행한다.
  - 필요 시 path filter를 넣어 불필요한 실행을 줄인다.
- 대상 파일
  - `.github/workflows/ci.yml`
- 설계 기준
  - AWS credentials가 없는 상태에서도 돌아가야 한다.
  - 따라서 CI에서는 기본적으로 `sam validate`보다 `sam build` 중심으로 둔다.
- 완료 기준
  - workflow 문법이 맞고, PR 품질 게이트 역할이 분명하다.

### 9단계. `deploy.yml` 작성
- 상태: 완료
- 작업
  - `main` push 및 `workflow_dispatch` 기반 deploy workflow를 만든다.
  - OIDC를 위한 `permissions: { contents: read, id-token: write }`를 설정한다.
  - `aws-actions/configure-aws-credentials`로 role assume 흐름을 구성한다.
  - `sam validate`, `sam build`, `sam deploy` 순서를 넣는다.
  - 환경 이름과 role ARN, region 같은 값은 repository secret/variable 전제로 설계한다.
- 대상 파일
  - `.github/workflows/deploy.yml`
- 결정 필요값
  - `AWS_DEPLOY_ROLE_ARN`
  - `AWS_REGION`
  - `SAM_CONFIG_ENV`
- 완료 기준
  - deploy workflow가 OIDC 기준의 최소 안전선에 맞게 작성된다.
  - 장기 액세스 키 의존이 남지 않는다.

### 10단계. 문서 정합성 보정
- 상태: 완료
- 작업
  - 3단계 구현으로 인해 바뀐 구조가 있으면 문서를 함께 수정한다.
  - `docs/README.md`에 `plan.md`가 유지되는지 확인한다.
  - 실제 템플릿/워크플로우 구조가 [FOLDER_STRUCTURE_DRAFT.md](./FOLDER_STRUCTURE_DRAFT.md)와 크게 어긋나면 맞춘다.
- 대상 파일
  - `docs/README.md`
  - `docs/FOLDER_STRUCTURE_DRAFT.md`
- 완료 기준
  - 문서와 실제 파일 구조가 다시 어긋나지 않는다.

### 11단계. 로컬 검증
- 상태: 완료
- 작업
  - `pnpm install`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm sam:build`
  - 가능하면 AWS credentials configured 환경에서 `pnpm sam:validate`
- 검증 분리 원칙
  - credential이 없으면 `sam validate`는 로컬 필수 조건으로 두지 않는다.
  - 대신 왜 제외했는지 결과에 명시한다.
- 완료 기준
  - 3단계 산출물이 적어도 로컬 품질 게이트와 SAM 빌드를 통과한다.

### 12단계. 변경 정리와 PR 생성
- 상태: 완료
- 작업
  - 변경 파일을 다시 검토한다.
  - 브랜치 범위를 벗어난 구현이 없는지 확인한다.
  - 커밋 후 원격 브랜치에 push한다.
  - `main` 대상 PR을 생성한다.
  - PR 본문에는 3단계 범위, 검증 결과, AWS OIDC 전제사항을 적는다.
- 완료 기준
  - `codex/03-sam-http-api-cicd` 브랜치의 결과가 리뷰 가능한 PR 형태로 올라간다.

## 검증 체크리스트
- `infra/sam/template.yaml`이 존재한다.
- `infra/sam/samconfig.toml`이 존재한다.
- `.github/workflows/ci.yml`이 존재한다.
- `.github/workflows/deploy.yml`이 존재한다.
- 누락된 도메인 handler 파일이 모두 존재한다.
- `package.json`의 `sam:*` 스크립트가 placeholder가 아니다.
- `HTTP API` 리소스와 각 함수 route가 명시적으로 연결된다.
- `nodejs24.x`, `arm64`, `esbuild` 기준이 템플릿에 반영된다.
- 로컬에서 `pnpm sam:build`가 통과한다.
- PR용 설명에 OIDC 전제와 미구현 범위가 정리된다.

## 예상 리스크와 대응
- `sam validate`는 credential 요구사항 때문에 로컬/CI 환경 차이가 발생할 수 있다.
  - 대응: CI와 deploy workflow에서 검증 위치를 분리한다.
- placeholder handler가 없으면 `sam build`가 깨질 수 있다.
  - 대응: route를 만들 함수는 모두 실제 파일로 만든다.
- `CodeUri` 상대 경로가 복잡하면 이후 유지보수가 어려워질 수 있다.
  - 대응: 이번 단계는 명시 경로로 두고, 필요하면 후속 단계에서 `--base-dir` 전략을 검토한다.
- OIDC role/region 값이 아직 GitHub에 준비되지 않았을 수 있다.
  - 대응: workflow는 먼저 skeleton으로 두고, 실제 값은 repo 설정 전제로 문서화한다.

## 이번 단계 완료 조건
- `sam build` 가능한 템플릿이 리포지토리에 반영된다.
- `HTTP API + Lambda` 연결이 명시된 SAM 구조가 생긴다.
- CI workflow와 deploy workflow가 분리되어 들어간다.
- `nodejs24.x`, `arm64`, `esbuild`, OIDC 기준이 코드와 문서에 고정된다.
- 브랜치 결과가 PR 가능한 상태가 된다.

## 한 줄 결론
- 3단계 구현은 `handler 보강 -> package script 정리 -> SAM template -> samconfig -> CI -> deploy -> 검증 -> PR` 순서로 진행하면 가장 충돌이 적고, 이후 4단계 도메인 API 구현을 바로 올릴 수 있다.
