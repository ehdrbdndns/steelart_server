# RDS TLS 옵션 1 상세 실행 계획

## 문서 목적
- 이 문서는 [research.md](./research.md)에 정리한 `옵션 A. /var/runtime/ca-cert.pem 사용`을 실제 구현으로 옮기기 위한 상세 플랜이다.
- 현재 문제는 `Amazon RDS for MySQL`이 `require_secure_transport=ON`인데, 배포된 Lambda가 TLS 없이 접속하려고 해서 로그인 API가 `500 INTERNAL_ERROR`로 실패하는 것이다.
- 이번 플랜은 기능 추가가 아니라 운영 장애를 해소하기 위한 인프라/런타임 wiring 수정에 집중한다.

## 대상 브랜치
- 권장 브랜치명: `codex/fix-rds-tls-runtime-ca`

## 기준 문서
- [research.md](./research.md)
- [SERVER_ARCHITECTURE_DRAFT.md](./SERVER_ARCHITECTURE_DRAFT.md)
- [MASTER_PLAN.md](./MASTER_PLAN.md)
- [IMPLEMENTATION_SEQUENCE.md](./IMPLEMENTATION_SEQUENCE.md)
- [template.yaml](../template.yaml)
- [deploy.yml](../.github/workflows/deploy.yml)
- [pool.ts](../src/shared/db/pool.ts)
- [server.ts](../src/shared/env/server.ts)

## 목표
- 운영 Lambda가 `DB_SSL_CA_PATH=/var/runtime/ca-cert.pem`를 사용해 `mysql2` TLS 연결을 수립하도록 만든다.
- 카카오 로그인, 애플 로그인처럼 DB write가 포함되는 auth flow에서 더 이상 `Connections using insecure transport are prohibited while --require_secure_transport=ON.` 오류가 나지 않게 한다.
- 로컬 개발 환경과 운영 배포 환경의 DB SSL 설정 방식을 문서와 스크립트 기준으로 명확하게 분리한다.

## 이번 변경에 포함하는 범위
- `template.yaml`에 `DbSslCaPath` parameter 및 Lambda env wiring 추가
- `deploy.yml`에 `DB_SSL_CA_PATH` GitHub Actions variable wiring 추가
- `package.json` 또는 배포 스크립트 문구 중 필요한 범위의 설명 정리
- `.env.example`에 운영 권장값 설명 추가
- 필요 시 `README.md` 또는 로컬 문서에 운영 배포 변수 안내 추가
- 최소 단위 테스트 또는 env 파서 테스트 추가

## 이번 변경에서 제외하는 범위
- 별도 RDS CA PEM 파일을 repo에 추가하는 방식
- `NODE_EXTRA_CA_CERTS` 기반 전역 trust store 전환
- `RDS Proxy` 도입
- DB의 `require_secure_transport` 설정 변경
- `rejectUnauthorized: false` 같은 우회
- 인증/사용자 도메인 로직 변경

## 구현 전 고정 결정
- 1차 해결책은 `/var/runtime/ca-cert.pem`를 사용한다.
- 현재 [pool.ts](../src/shared/db/pool.ts)의 `DB_SSL_CA_PATH -> readFileSync -> ssl.ca` 구조는 유지한다.
- 로컬 개발 환경에서는 `DB_SSL_CA_PATH`를 필수로 강제하지 않는다.
- 운영 배포 환경에서는 GitHub Actions variable `DB_SSL_CA_PATH`를 통해 `/var/runtime/ca-cert.pem`를 주입한다.
- 이번 단계에서는 애플리케이션 레벨에서 `ssl.rejectUnauthorized=false`를 허용하지 않는다.

## 수정 대상 파일

### 반드시 수정할 파일
- [template.yaml](../template.yaml)
- [deploy.yml](../.github/workflows/deploy.yml)
- [.env.example](../.env.example)
- [plan.md](./plan.md)
- [research.md](./research.md)

### 필요 시 수정할 파일
- [package.json](../package.json)
- [README.md](../README.md)
- [docs/README.md](./README.md)
- [server.ts](../src/shared/env/server.ts)
- `tests/unit/env.test.ts`

## 상세 실행 순서

### 0단계. 현재 배포/런타임 기준 재확인
- 상태: 완료
- 작업
  - 현재 운영 로그의 MySQL 에러가 `insecure transport`인지 다시 확인한다.
  - [pool.ts](../src/shared/db/pool.ts)가 `DB_SSL_CA_PATH`를 읽을 때만 `ssl.ca`를 세팅한다는 점을 기준 동작으로 재확인한다.
  - 배포 템플릿과 workflow에 `DB_SSL_CA_PATH` wiring이 없는지 다시 확인한다.
- 완료 기준
  - 이번 수정이 DB TLS wiring 문제 해결이라는 점이 명확해진다.

### 1단계. SAM template에 TLS parameter 추가
- 상태: 완료
- 작업
  - [template.yaml](../template.yaml)에 `DbSslCaPath` parameter를 추가한다.
  - 기본값은 `/var/runtime/ca-cert.pem`로 둔다.
  - `Globals.Function.Environment.Variables`에 `DB_SSL_CA_PATH: !Ref DbSslCaPath`를 추가한다.
- 고려사항
  - 모든 Lambda가 공통 DB pool을 쓰므로 `Globals.Function`에 두는 것이 자연스럽다.
  - `DbSslCaPath`는 secret 값은 아니므로 `NoEcho`는 필요 없다.
- 완료 기준
  - 빌드된 템플릿에 모든 Lambda의 `DB_SSL_CA_PATH` env가 반영된다.

### 2단계. GitHub Actions 배포 변수 wiring 추가
- 상태: 완료
- 작업
  - [deploy.yml](../.github/workflows/deploy.yml) `env:` 블록에 `DB_SSL_CA_PATH`를 추가한다.
  - 기본값은 `/var/runtime/ca-cert.pem`로 둔다.
  - `sam deploy --parameter-overrides`에 `DbSslCaPath="${DB_SSL_CA_PATH}"`를 추가한다.
- 고려사항
  - 기존 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`와 같은 수준의 운영 variable로 다룬다.
  - built template 사용과 `../../samconfig.toml` 경로 수정은 유지한다.
- 완료 기준
  - GitHub Actions만으로도 운영 Lambda에 TLS 경로가 주입될 수 있다.

### 3단계. 로컬 환경 문서와 예시값 정리
- 상태: 완료
- 작업
  - [.env.example](../.env.example)에 `DB_SSL_CA_PATH` 설명을 보강한다.
  - 필요하면 예시값 또는 주석으로 `운영 Lambda 권장값: /var/runtime/ca-cert.pem`를 명시한다.
  - 로컬 DB가 TLS를 강제하지 않는 경우 비워둘 수 있다는 점도 같이 적는다.
- 완료 기준
  - 개발자가 `DB_SSL_CA_PATH`의 의미와 운영/로컬 차이를 문서만 보고 이해할 수 있다.

### 4단계. 필요 시 env 파서/유닛 테스트 보강
- 상태: 완료
- 작업
  - 현재 `server.ts`는 `DB_SSL_CA_PATH`를 optional로 받고 있으므로, 꼭 수정이 필요하지는 않다.
  - 대신 `env.test.ts` 또는 별도 테스트에서 `DB_SSL_CA_PATH`가 있을 때도 정상 파싱되는지 확인한다.
  - 템플릿 변경 자체는 unit test가 아니라 `sam validate`, `sam build`로 검증한다.
- 완료 기준
  - env parser가 TLS 경로를 포함한 운영 env에서도 문제 없이 동작한다.

### 5단계. SAM 검증 및 빌드 확인
- 상태: 완료
- 작업
  - `pnpm sam:validate`
  - `pnpm sam:build`
  - 필요 시 `sam validate --lint --template-file template.yaml --config-file samconfig.toml --config-env default`
- 확인 포인트
  - `DbSslCaPath` parameter 선언 오류가 없는지
  - `Globals.Function.Environment.Variables.DB_SSL_CA_PATH`가 템플릿 문법상 유효한지
  - built template에 env가 반영되는지
- 완료 기준
  - 템플릿과 빌드가 모두 통과한다.

### 6단계. 배포 후 운영 검증 계획 실행
- 상태: 완료
- 작업
  - GitHub Actions variable `DB_SSL_CA_PATH=/var/runtime/ca-cert.pem`를 저장소에 등록했다.
  - 운영 계정 로컬 프로필(`AWS_PROFILE=steelart`)로 `sam build`, `sam deploy`를 직접 수행해 `steelart-server-dev` 스택을 업데이트했다.
  - 배포 후 `AuthFunction`, `UsersFunction`의 Lambda 환경변수에 `DB_SSL_CA_PATH=/var/runtime/ca-cert.pem`가 실제로 반영된 것을 확인했다.
  - 운영 API `GET /v1/auth/me`를 실제로 호출해 `200` 응답을 확인했고, 이 경로가 JWT 검증 이후 RDS 조회까지 정상 동작하는 것을 확인했다.
  - 최근 `AuthFunction` CloudWatch 로그에서 `Connections using insecure transport ...` 문자열이 더 이상 나타나지 않는 것을 확인했다.
- 완료 기준
  - 운영 Lambda가 TLS 경로를 실제로 사용하고, DB를 조회하는 인증 경로에서 `require_secure_transport` 관련 오류가 재현되지 않는다.

### 7단계. 문서 마무리 및 변경 정리
- 상태: 완료
- 작업
  - 관련 문서 경로와 배포 변수 설명을 정리한다.
  - 변경 파일을 커밋한다.
- 완료 기준
  - 변경 이유와 운영 영향 범위가 문서와 커밋 메시지만으로도 이해 가능하다.

## 검증 체크리스트
- `pnpm test`
- `pnpm sam:validate`
- `pnpm sam:build`
- 배포 후 Lambda 환경변수에 `DB_SSL_CA_PATH` 존재 확인
- `POST /v1/auth/kakao` 재시도
- `POST /v1/auth/apple` 재시도
- CloudWatch에서 `Connections using insecure transport ...` 오류 제거 확인

## 리스크와 대응

### 리스크 1. `/var/runtime/ca-cert.pem`가 기대와 다를 수 있음
- 대응
  - AWS 공식 문서 기준 경로를 사용한다.
  - 서울 리전은 신규 리전이 아니므로 1차 운영 대응으로는 충분하다.

### 리스크 2. GitHub Actions variable 미설정
- 대응
  - workflow 기본값을 `/var/runtime/ca-cert.pem`로 둔다.
  - 저장소 variable이 없더라도 기본 동작은 유지되게 한다.

### 리스크 3. DB TLS 오류 외 다른 오류가 뒤이어 드러날 수 있음
- 대응
  - 이번 수정 후에는 적어도 TLS 오류는 사라져야 한다.
  - 이후 발생하는 오류는 현재 개선된 구조화 로그로 분리 추적한다.

## 완료 기준
- 모든 Lambda가 `DB_SSL_CA_PATH` 환경변수를 받는다.
- 운영 배포가 built template 기준으로 TLS 경로까지 포함해 완료된다.
- 카카오/애플 로그인에서 `require_secure_transport` 관련 DB 오류가 사라진다.
- 문서와 배포 설정이 현재 런타임 동작과 일치한다.

## 한 줄 결론
- 이번 변경은 `pool.ts`의 기존 SSL 구조를 유지한 채, `template.yaml`과 `deploy.yml`에 `DB_SSL_CA_PATH=/var/runtime/ca-cert.pem`를 실제로 주입해 운영 RDS TLS 연결을 복구하는 작업이다.
