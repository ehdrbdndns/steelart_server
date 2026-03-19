# RDS TLS 연결 리서치

## 문서 목적
- 이 문서는 `AWS RDS`가 `require_secure_transport=ON`인 상태에서 `steelart_server`의 Lambda가 `mysql2`로 안전하게 접속하도록 구현하기 전에 필요한 정보를 정리한 리서치 문서다.
- 현재 대상은 카카오/애플 로그인 시 발생한 DB 연결 오류다.
- 대상 런타임은 `AWS Lambda nodejs24.x`, 배포 방식은 `AWS SAM`, DB는 `Amazon RDS for MySQL`이다.

## 현재 문제

### 실제 에러
- 현재 운영 로그에는 아래 오류가 남아 있다.
- `Connections using insecure transport are prohibited while --require_secure_transport=ON.`

### 에러 의미
- RDS MySQL 인스턴스가 `require_secure_transport=ON` 상태라서, TLS 없는 평문 연결을 거부하고 있다는 뜻이다.
- AWS 공식 문서 기준으로 `require_secure_transport=ON`이면 클라이언트는 반드시 암호화된 연결을 수립해야 한다.

## 현재 코드 기준 진단

### 이미 준비된 부분
- [pool.ts](../src/shared/db/pool.ts)
  - `DB_SSL_CA_PATH`가 있을 때만 `mysql2` `ssl.ca`를 설정한다.
  - `readFileSync(env.DB_SSL_CA_PATH, 'utf8')`로 PEM 내용을 읽어 메모리에 넣는 방식이다.
- [server.ts](../src/shared/env/server.ts)
  - `DB_SSL_CA_PATH` 환경변수를 이미 파싱할 수 있다.
- [.env.example](../.env.example)
  - `DB_SSL_CA_PATH` 항목이 이미 존재한다.

### 아직 빠진 부분
- [template.yaml](../template.yaml)
  - `DbSslCaPath` parameter가 없다.
  - Lambda 환경변수에 `DB_SSL_CA_PATH`를 주입하지 않는다.
- [deploy.yml](../.github/workflows/deploy.yml)
  - GitHub Actions 배포 시 `DB_SSL_CA_PATH`를 parameter override로 넘기지 않는다.
- 결과적으로 현재 운영 Lambda는 `DB_SSL_CA_PATH`가 비어 있고, `mysql2`는 평문 연결을 시도한다.

## 공식 문서 조사 결과

### 1. RDS MySQL에서 `require_secure_transport=ON`이면 TLS가 필수다
- Amazon RDS MySQL 문서상 `require_secure_transport`를 `ON`으로 두면 모든 사용자 연결은 SSL/TLS를 사용해야 한다.
- 그렇지 않으면 지금과 같은 `MySQL Error 3159 (HY000)`가 반환된다.

### 2. Lambda `nodejs20.x` 이상은 RDS CA를 자동으로 로드하지 않는다
- AWS Lambda Node.js 문서상 `Node.js 20` 이상에서는 Amazon 전용 CA 인증서를 더 이상 자동으로 로드하지 않는다.
- 대신 런타임 내부에 `/var/runtime/ca-cert.pem` 파일이 존재한다.
- 과거 Node.js 18 이하와 같은 동작을 원하면 `NODE_EXTRA_CA_CERTS=/var/runtime/ca-cert.pem`를 설정할 수 있다.

### 3. AWS는 RDS 연결 시 서버 인증서 검증을 요구한다
- AWS Lambda + RDS 문서상, Lambda가 RDS에 안전하게 접속하려면 신뢰 가능한 인증서로 DB 서버 인증서를 검증해야 한다.
- Node.js 예제에서도 `readFileSync()`로 PEM 파일 내용을 읽어 `ssl.ca`에 넣는 방식을 사용한다.
- 이 방식은 현재 [pool.ts](../src/shared/db/pool.ts)의 구현과 일치한다.

### 4. RDS는 지역별/전역 CA 번들을 제공한다
- RDS SSL 문서상 상용 리전은 `global-bundle.pem`을 사용할 수 있다.
- 다만 애플리케이션 trust store에는 중간 인증서가 아니라 root CA만 등록해야 하며, 그렇지 않으면 자동 인증서 회전 시 문제가 생길 수 있다.
- 현재 서울 리전(`ap-northeast-2`)은 상용 리전이므로 `global-bundle.pem` 사용이 가능하다.

### 5. `mysql2`는 `ssl.ca`에 PEM 내용을 넣는 방식을 공식 예제로 안내한다
- `mysql2` 공식 문서상 `createPool({ ssl: { ca: fs.readFileSync(...) } })` 형태를 기본 예제로 안내한다.
- 또한 Amazon RDS용으로 `ssl: awsCaBundle` 같은 대안도 소개하지만, 이 repo에는 해당 의존성이 없다.
- 현재 코드 구조에서는 `ssl.ca + DB_SSL_CA_PATH`가 가장 자연스럽다.

## 구현 옵션 비교

### 옵션 A. 즉시 적용: `/var/runtime/ca-cert.pem`를 그대로 사용
- 방식
  - Lambda 환경변수 `DB_SSL_CA_PATH=/var/runtime/ca-cert.pem`
  - [pool.ts](../src/shared/db/pool.ts)는 그대로 둔다.
- 장점
  - 코드 변경이 가장 작다.
  - 별도 PEM 파일을 repo에 추가할 필요가 없다.
  - 현재 `mysql2` 구현과 바로 맞는다.
- 단점
  - AWS 문서상 신규 리전의 RDS 인증서가 Lambda managed runtime에 반영되기까지 최대 4주가 걸릴 수 있다.
  - 필요한 인증서보다 더 큰 CA 묶음을 읽는다.

### 옵션 B. 장기 권장: 필요한 RDS CA만 Lambda 패키지에 포함
- 방식
  - 예: `certificates/rds.pem` 파일을 repo에 추가
  - Lambda 환경변수 `DB_SSL_CA_PATH=/var/task/certificates/rds.pem`
  - 필요하면 `NODE_EXTRA_CA_CERTS=/var/task/certificates/rds.pem`도 함께 설정
- 장점
  - AWS Lambda Node.js 문서가 권장하는 방식과 가장 가깝다.
  - 필요한 CA만 사용하므로 trust 범위가 좁고 cold start 관점에서도 유리하다.
- 단점
  - 현재 SAM `esbuild` 출력물에는 정적 PEM 파일이 자동 포함되지 않을 가능성이 높다.
  - 현재 로컬 빌드 결과를 보면 `.aws-sam/build/*` 안에 `handler.js`와 map 파일만 있어, 정적 자산 복사 방식을 추가로 설계해야 한다.
- 주의
  - 이 판단은 현재 repo의 로컬 빌드 결과를 본 구현 추론이다.
  - 공식 문서가 “현재 설정에서 PEM이 자동 복사된다/안 된다”고 직접 말하는 것은 아니다.

### 옵션 C. 비권장 우회
- DB에서 `require_secure_transport=OFF`
- `rejectUnauthorized: false`
- 둘 다 운영 기준으로는 피하는 것이 맞다.

## 현재 코드베이스 기준 권장안

### 1차 권장안
- 우선 `옵션 A`로 간다.
- 이유
  - 현재 [pool.ts](../src/shared/db/pool.ts)가 이미 `DB_SSL_CA_PATH -> readFileSync -> ssl.ca` 흐름을 지원한다.
  - 운영 장애를 가장 빨리 해소할 수 있다.
  - 추가 패키지나 정적 자산 복사 설계가 필요 없다.

### 권장 구현 형태
- [template.yaml](../template.yaml)
  - `DbSslCaPath` parameter 추가
  - `Globals.Function.Environment.Variables.DB_SSL_CA_PATH` wiring 추가
  - 값 기본값은 `/var/runtime/ca-cert.pem`로 두는 것이 가장 실용적이다.
- [deploy.yml](../.github/workflows/deploy.yml)
  - `DB_SSL_CA_PATH`를 GitHub Actions variable로 읽고 parameter override에 전달
- [.env.example](../.env.example)
  - 설명상 기본 권장값을 `/var/runtime/ca-cert.pem`로 문서화
- 필요 시 [README.md](../README.md) 또는 로컬 문서에 운영 배포 변수 추가

## 구현 시 구체적으로 확인할 것

### Lambda 환경변수
- `DB_SSL_CA_PATH=/var/runtime/ca-cert.pem`
- 현재 `NODE_OPTIONS='--enable-source-maps'`는 TLS와 직접 관련이 없다.
- 이번 1차 수정에서는 `NODE_EXTRA_CA_CERTS`가 없어도 된다.
  - 이유: 현재 `mysql2`는 Node 전역 trust store가 아니라 `ssl.ca`에 직접 PEM 내용을 받는다.

### GitHub Actions Variables
- 새로 필요한 값
  - `DB_SSL_CA_PATH`
- 권장 기본값
  - `/var/runtime/ca-cert.pem`

### 로컬/통합 테스트
- 로컬 DB가 TLS를 강제하지 않으면 `DB_SSL_CA_PATH`를 비워도 된다.
- 운영/배포 환경만 TLS를 강제하는 구조라면, 로컬 테스트와 운영 배포 변수는 분리해도 무방하다.

## 구현 후 검증 시나리오

### 1. 배포 직후 환경변수 확인
- Lambda Console 또는 `aws lambda get-function-configuration`로 `DB_SSL_CA_PATH`가 실제로 들어갔는지 확인

### 2. 카카오 로그인 재시도
- `POST /v1/auth/kakao`
- 기대 결과
  - 더 이상 `Connections using insecure transport ...` 오류가 나오지 않는다.
  - DB 연결이 성공하면 로그인/회원가입 로직까지 진행된다.

### 3. 애플 로그인 재시도
- `POST /v1/auth/apple`
- 기대 결과
  - 동일하게 DB 연결 오류가 사라진다.

### 4. 필요 시 DB 측 확인
- RDS/MySQL 세션에서 `SHOW STATUS LIKE 'Ssl_cipher';`로 실제 TLS cipher가 잡히는지 확인 가능
- 이는 애플리케이션 코드보다는 운영 확인용이다.

## 장기 후속 과제

### 1. 최소 인증서 번들 방식으로 고도화
- 운영 안정화 후에는 `/var/runtime/ca-cert.pem` 대신 필요한 RDS root CA만 번들링하는 방식으로 바꾸는 것이 더 깔끔하다.
- 이 경우 SAM `esbuild` 빌드 결과에 PEM 파일을 포함시키는 방식도 같이 정해야 한다.

### 2. RDS Proxy 사용 여부 재검토
- AWS 문서상 RDS Proxy는 ACM 인증서를 사용하므로, 프록시 연결 시 RDS 인증서 다운로드 요구사항이 달라진다.
- 현재는 직접 RDS에 붙고 있으므로 이번 범위는 아니다.

## 최종 결론
- 현재 장애의 직접 원인은 `RDS가 TLS를 강제하는데 Lambda가 SSL 없이 접속하고 있기 때문`이다.
- 이 repo는 이미 `DB_SSL_CA_PATH -> ssl.ca` 구조를 갖고 있으므로, 가장 작은 수정은 `template.yaml`과 `deploy.yml`에 `DB_SSL_CA_PATH=/var/runtime/ca-cert.pem`를 실제로 배포하는 것이다.
- 이후 필요하면 별도 RDS CA 파일을 `/var/task/...`에 번들링하는 방식으로 고도화한다.

## 참고 자료
- [Using AWS Lambda with Amazon RDS](https://docs.aws.amazon.com/lambda/latest/dg/services-rds.html)
- [Building Lambda functions with Node.js](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html)
- [Using SSL/TLS to encrypt a connection to a DB instance or cluster](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html)
- [Requiring SSL/TLS for all connections to a MySQL DB instance on Amazon RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/mysql-ssl-connections.require-ssl.html)
- [mysql2 createPool SSL examples](https://sidorares.github.io/node-mysql2/docs/examples/connections/create-pool)
