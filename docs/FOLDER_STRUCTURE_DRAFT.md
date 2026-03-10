# SteelArt Server 폴더 구조 초안

## 문서 목적
- 이 문서는 `steelart_server`의 첫 코드 구조를 제안한다.
- 도메인 단위 Lambda 소유 구조를 유지하면서 공통 코드를 명시적으로 관리할 수 있도록 설계한다.

## 제안하는 최상위 구조

```text
steelart_server/
  .github/
    pull_request_template.md
    workflows/
      ci.yml
      deploy.yml
  AGENTS.md
  README.md
  docs/
    README.md
    SERVER_ARCHITECTURE_DRAFT.md
    FOLDER_STRUCTURE_DRAFT.md
    MASTER_PLAN.md
    IMPLEMENTATION_SEQUENCE.md
    plan.md
    research.md
  package.json
  tsconfig.json
  .env.example
  pnpm-lock.yaml
  infra/
    sam/
      template.yaml
      samconfig.toml
  src/
    lambdas/
      auth/
        handler.ts
      users/
        handler.ts
      home/
        handler.ts
      search/
        handler.ts
      artworks/
        handler.ts
      map/
        handler.ts
      courses/
        handler.ts
    domains/
      auth/
        service.ts
        repository.ts
        schemas.ts
        mapper.ts
        types.ts
      users/
        service.ts
        repository.ts
        schemas.ts
        mapper.ts
        types.ts
      home/
        service.ts
        repository.ts
        schemas.ts
        mapper.ts
        types.ts
      search/
        service.ts
        repository.ts
        schemas.ts
        mapper.ts
        types.ts
      artworks/
        service.ts
        repository.ts
        schemas.ts
        mapper.ts
        types.ts
      map/
        service.ts
        repository.ts
        schemas.ts
        mapper.ts
        types.ts
      courses/
        service.ts
        repository.ts
        schemas.ts
        mapper.ts
        types.ts
    shared/
      api/
        errors.ts
        response.ts
        route.ts
      auth/
        guard.ts
        token.ts
        providers/
          kakao.ts
          apple.ts
      db/
        pool.ts
        tx.ts
      env/
        server.ts
      geo/
        distance.ts
      logger/
        logger.ts
      utils/
        pagination.ts
        time.ts
      validation/
        parse.ts
  tests/
    unit/
    integration/
  scripts/
    local/
```

## 문서 운영 규칙
- 로컬 문서는 `docs/` 아래에서 관리한다.
- 루트 `AGENTS.md`, 루트 `README.md`는 워크스페이스 진입 문서로만 사용한다.
- 로컬 문서는 한국어로 작성하고 관리한다.
- 문서 경로가 바뀌면 `AGENTS.md`, `README.md`, 관련 참조 문서를 함께 갱신한다.

## 왜 이런 구조인가

### `.github`
- CI/CD 워크플로우를 코드와 같이 명시적으로 관리할 수 있다.
- `AWS SAM` 기반 빌드/배포 자동화 단계를 분리해서 보기 쉽다.

### `docs`
- 설계 문서, 구현 계획, 리서치 메모를 한 위치에서 관리할 수 있다.
- 서버 부트스트랩 전에 문서 기준 합의를 유지하기 쉽다.

### `infra/sam`
- `AWS SAM` 템플릿과 배포 설정을 런타임 코드와 분리한다.
- API Gateway, Lambda, 환경 변수 wiring, 배포 설정을 한 곳에서 관리할 수 있다.

### `src/lambdas`
- 배포 단위를 명확하게 드러낸다.
- 각 폴더는 HTTP 변환 로직만 가진 하나의 Lambda 엔트리포인트를 소유한다.

### `src/domains`
- 기술 레이어만이 아니라 도메인 기준으로 비즈니스 로직을 묶는다.
- 새 라우트가 추가되어도 어느 도메인이 책임지는지 파악하기 쉽다.

### `src/shared`
- 인증, DB, 응답, 검증 같은 공통 코드를 반복 작성하지 않게 한다.
- 여러 도메인에 걸치는 관심사를 한곳에서 통제할 수 있다.

### `tests`
- 단위 테스트는 서비스와 매퍼를 중심으로 검증한다.
- 통합 테스트는 라우트에서 DB까지의 연결 동작을 검증한다.

## Lambda 엔트리포인트 규칙
- Lambda 핸들러는 얇게 유지한다.
- 공통 라우트 헬퍼 호출, 입력 파싱, 서비스 호출, 표준 응답 반환까지만 담당한다.
- raw SQL이나 복잡한 비즈니스 분기는 핸들러에 넣지 않는다.

## 도메인 폴더 규칙
- `service.ts`는 비즈니스 규칙을 담당한다.
- `repository.ts`는 SQL을 담당한다.
- `schemas.ts`는 `zod` 기반 입력 검증을 담당한다.
- `mapper.ts`는 응답 형태 변환을 담당한다.
- `types.ts`는 Lambda 이벤트 타입에 직접 의존하지 않는 도메인 타입을 담당한다.

## 공통 폴더 규칙
- `shared/api`는 `{ data, meta, error }` 응답 형태를 표준화한다.
- `shared/auth`는 토큰 검증과 provider별 인증 로직을 표준화한다.
- `shared/db`는 MySQL 연결과 트랜잭션 처리를 표준화한다.
- `shared/geo`는 지도 거리 계산과 체크인 거리 계산이 어긋나지 않게 한다.

## 라우팅 스타일 권장사항
- HTTP 라우트 정의는 각 Lambda 핸들러 가까이에 둔다.
- 모든 도메인을 한 파일에 모은 거대한 전역 라우터는 만들지 않는다.
- 각 Lambda 안에서는 method와 path segment 기준으로 작고 명시적으로 라우팅한다.

## 처음 바로 만들어야 할 파일
- `package.json`
- `tsconfig.json`
- `.env.example`
- `infra/sam/template.yaml`
- `infra/sam/samconfig.toml`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `src/shared/env/server.ts`
- `src/shared/db/pool.ts`
- `src/shared/api/response.ts`
- `src/shared/api/errors.ts`
- `src/shared/auth/guard.ts`
- `src/lambdas/auth/handler.ts`
- `src/lambdas/users/handler.ts`

## 첫날 필요하지 않은 파일
- 업로드 전용 모듈
- 최근 검색어 영속화 모듈
- 공지사항 관리 모듈
- 외부 링크 관리 모듈
- 위치 권한 상태 저장 모듈
