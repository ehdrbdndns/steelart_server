# Dev Login Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모바일 앱의 `/dev/auth` 화면이 dev/staging/local 서버에서 발급한 실제 access token과 refresh token을 저장하고, 이후 기존 `/v1/auth/me`, `/v1/auth/refresh`, 인증 middleware 흐름을 그대로 사용할 수 있게 한다.

**Architecture:** `POST /v1/dev/auth/login`은 기존 `auth` Lambda가 소유한다. production에서는 handler 초입에서 차단하고, 허용 환경에서는 `AuthService`가 실제 `users` row와 `user_refresh_tokens` row를 기준으로 기존 `mapLoginResponse`, `signAccessToken`, `createRefreshToken` 흐름을 재사용한다.

**Tech Stack:** Node.js 24, TypeScript, AWS SAM HTTP API, mysql2 raw SQL, zod, node:test.

---

## 현재 코드 기준 요약

- 라우팅:
  - `template.yaml`의 `AuthFunction`은 현재 `/v1/auth/{proxy+}`만 받는다.
  - `src/lambdas/auth/handler.ts`는 `request.path`로 `/v1/auth/kakao`, `/v1/auth/apple`, `/v1/auth/refresh`, `/v1/auth/me`를 분기한다.
- 토큰:
  - `src/shared/auth/token.ts`의 `signAccessToken`, `createRefreshToken`, `getRefreshTokenExpiresAt`가 실제 앱 토큰을 발급한다.
  - access token은 JWT `type: 'access'`, refresh token은 `user_refresh_tokens` 저장 row다.
- 응답:
  - 기존 소셜 로그인 응답은 `src/domains/auth/mapper.ts`의 `mapLoginResponse(user, token, refreshToken)`가 만든다.
  - 따라서 dev login도 이 mapper를 그대로 사용해야 응답 shape이 유지된다.
- 인증 후속 흐름:
  - `/v1/auth/me`는 `requireAuth`로 access token을 검증한 뒤 `usersRepository.findUserById`를 조회한다.
  - `/v1/auth/refresh`는 `authRepository.findRefreshToken`으로 refresh token row를 조회한다.
  - dev login은 반드시 `users`와 `user_refresh_tokens`를 실제로 만들어야 한다.

## 확정 동작

- Endpoint: `POST /v1/dev/auth/login`
- production 비활성화:
  - `APP_ENV === 'production'` 또는 `APP_ENV === 'prod'`이면 `404 NOT_FOUND`를 반환한다.
  - 존재 노출을 줄이기 위해 `403` 대신 `404`를 기본 정책으로 한다. 요구사항은 `404 또는 403`을 허용한다.
- 허용 환경:
  - `local`, `dev`, `staging`, `test`, `integration`에서만 동작한다.
  - `test`, `integration`은 자동 테스트 실행을 위한 값이다.
- 요청 body:
```ts
{
  userId?: number;
}
```
- `userId`가 있으면 해당 기존 사용자의 실제 token pair를 발급한다.
- `userId`가 없으면 dev 기본 사용자를 조회하거나 생성한 뒤 token pair를 발급한다.
- dev 기본 사용자는 온보딩 완료 상태로 만든다.
```ts
{
  nickname: 'dev-user',
  residency: 'POHANG',
  age_group: '30S',
  language: 'ko',
  notifications_enabled: true
}
```
- dev 기본 사용자는 `user_auth_providers` row를 만들지 않는다.
  - provider enum/DDL 변경을 피한다.
  - 이후 인증 흐름은 `users`와 `user_refresh_tokens`만 필요하다.
- 응답 data shape은 기존 소셜 로그인과 동일하다.
```ts
{
  token: string;
  refreshToken: string;
  onboardingCompleted: boolean;
  user: {
    id: number;
    nickname: string | null;
    residency: string | null;
    age_group: string | null;
    language: string;
    notifications_enabled: boolean;
  };
}
```

## 파일별 변경 책임

- Modify: `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
  - dev/staging/local 전용 API 계약을 인증 섹션에 추가한다.
- Modify: `template.yaml`
  - `AuthFunction`에 `/v1/dev/auth/login` HttpApi route를 추가한다.
- Modify: `src/shared/env/server.ts`
  - dev login 허용 환경 판별 helper를 추가한다.
- Modify: `src/domains/auth/schemas.ts`
  - `devLoginSchema`를 추가한다.
- Modify: `src/domains/auth/types.ts`
  - `DevLoginInput` 타입을 추가한다.
- Modify: `src/domains/auth/repository.ts`
  - `findUserById`, `findDefaultDevUser`, `createDefaultDevUser`를 `AuthRepository`에 추가한다.
- Modify: `src/domains/auth/service.ts`
  - `loginForDev(input)`을 `AuthService`에 추가한다.
  - 기존 refresh token 저장과 login 응답 mapper를 재사용한다.
- Modify: `src/lambdas/auth/handler.ts`
  - `/v1/dev/auth/login` route 분기를 추가한다.
  - production 차단을 service 호출 전 수행한다.
- Modify: `tests/unit/env.test.ts`
  - 환경 판별 helper 테스트를 추가한다.
- Modify: `tests/unit/auth/auth-schemas.test.ts`
  - dev login schema 테스트를 추가한다.
- Modify: `tests/unit/auth/auth-refresh.test.ts`
  - service 레벨 dev login 토큰 발급 테스트를 추가한다.
- Modify: `tests/unit/auth/auth-handler.test.ts`
  - dev login handler 성공과 production 차단 테스트를 추가한다.
- Modify: `tests/integration/auth/auth-handler.integration.test.ts`
  - 실제 DB에 사용자와 refresh token row가 생기는지 검증한다.

## Task 1: API 계약 문서 갱신

**Files:**
- Modify: `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`

- [ ] **Step 1: 인증 섹션에 dev login API를 추가한다**

`1. 인증 / 세션 API` 아래, 소셜 로그인/refresh/me와 같은 레벨에 다음 섹션을 추가한다.

````md
### 1-5. 개발용 로그인
- `POST /v1/dev/auth/login`
- 구현 상태: `구현 필요`
- 목적:
  - 모바일 앱의 개발 화면에서 dev/staging/local 서버가 발급한 실제 access token과 refresh token을 받아 저장한다.
- 환경 제한:
  - `local`, `dev`, `staging`에서만 동작한다.
  - `production` 또는 `prod`에서는 `404 NOT_FOUND`를 반환한다.
- 요청 예시:
```json
{
  "userId": 1
}
```
- 요청 body는 생략 가능하다.
  - `userId`가 있으면 해당 기존 사용자로 로그인한다.
  - `userId`가 없으면 서버가 dev 기본 사용자를 조회하거나 생성한다.
- 응답 형태:
  - 카카오 로그인과 동일
- 실제 `data` 타입:
  - `1-1. 카카오 로그인`과 동일
- 주의:
  - mock token을 반환하지 않는다.
  - refresh token은 `user_refresh_tokens`에 실제 저장한다.
  - 운영 환경에서는 배포되어 있어도 사용할 수 없다.
````

- [ ] **Step 2: 문서에서 production 차단 정책을 검색한다**

Run: `rg -n "dev/auth/login|개발용 로그인|production|prod" /Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`

Expected: 새 섹션과 `production` 차단 설명이 검색된다.

## Task 2: SAM route 연결

**Files:**
- Modify: `template.yaml`

- [ ] **Step 1: `AuthFunction`에 명시 route를 추가한다**

`AuthFunction.Properties.Events` 아래에 추가한다.

```yaml
        DevAuthLoginRoute:
          Type: HttpApi
          Properties:
            ApiId: !Ref SteelArtHttpApi
            Method: POST
            Path: /v1/dev/auth/login
            PayloadFormatVersion: '2.0'
```

- [ ] **Step 2: SAM template 검증을 실행한다**

Run: `pnpm sam:validate`

Expected: `template.yaml is a valid SAM Template` 또는 동등한 성공 출력.

## Task 3: 환경 판별 helper 추가

**Files:**
- Modify: `src/shared/env/server.ts`
- Test: `tests/unit/env.test.ts`

- [ ] **Step 1: 실패 테스트를 먼저 추가한다**

`tests/unit/env.test.ts`에 추가한다.

```ts
import {
  isDevLoginEnabled,
} from '../../src/shared/env/server.js';

test('isDevLoginEnabled allows only non-production development environments', () => {
  assert.equal(isDevLoginEnabled('local'), true);
  assert.equal(isDevLoginEnabled('dev'), true);
  assert.equal(isDevLoginEnabled('staging'), true);
  assert.equal(isDevLoginEnabled('test'), true);
  assert.equal(isDevLoginEnabled('integration'), true);
  assert.equal(isDevLoginEnabled('production'), false);
  assert.equal(isDevLoginEnabled('prod'), false);
  assert.equal(isDevLoginEnabled(''), false);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm test -- tests/unit/env.test.ts`

Expected: `isDevLoginEnabled` export가 없어 실패한다.

- [ ] **Step 3: helper를 구현한다**

`src/shared/env/server.ts` 하단에 추가한다.

```ts
const DEV_LOGIN_ENABLED_APP_ENVS = new Set([
  'local',
  'dev',
  'staging',
  'test',
  'integration',
]);

export function isDevLoginEnabled(appEnv: string): boolean {
  return DEV_LOGIN_ENABLED_APP_ENVS.has(appEnv.trim().toLowerCase());
}
```

- [ ] **Step 4: 테스트를 통과시킨다**

Run: `pnpm test -- tests/unit/env.test.ts`

Expected: env unit test 통과.

## Task 4: dev login 입력 스키마 추가

**Files:**
- Modify: `src/domains/auth/schemas.ts`
- Modify: `src/domains/auth/types.ts`
- Test: `tests/unit/auth/auth-schemas.test.ts`

- [ ] **Step 1: 실패 테스트를 먼저 추가한다**

`tests/unit/auth/auth-schemas.test.ts`에 추가한다.

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { devLoginSchema } from '../../../src/domains/auth/schemas.js';

test('devLoginSchema accepts an empty body as default dev login', () => {
  assert.deepEqual(devLoginSchema.parse(undefined), {});
});

test('devLoginSchema accepts a positive integer userId', () => {
  assert.deepEqual(devLoginSchema.parse({ userId: 12 }), {
    userId: 12,
  });
});

test('devLoginSchema rejects non-positive userId values', () => {
  assert.throws(() => devLoginSchema.parse({ userId: 0 }));
  assert.throws(() => devLoginSchema.parse({ userId: -1 }));
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm test -- tests/unit/auth/auth-schemas.test.ts`

Expected: `devLoginSchema` export가 없어 실패한다.

- [ ] **Step 3: 타입과 스키마를 구현한다**

`src/domains/auth/types.ts`에 추가한다.

```ts
export interface DevLoginInput {
  userId?: number;
}
```

`src/domains/auth/schemas.ts`에 추가한다.

```ts
export const devLoginSchema = z.object({
  userId: z.number().int().positive().optional(),
}).strict().default({});
```

- [ ] **Step 4: 테스트를 통과시킨다**

Run: `pnpm test -- tests/unit/auth/auth-schemas.test.ts`

Expected: auth schema unit test 통과.

## Task 5: auth repository에 dev 사용자 조회/생성 추가

**Files:**
- Modify: `src/domains/auth/repository.ts`
- Test: `tests/integration/auth/auth-handler.integration.test.ts`

- [ ] **Step 1: `AuthRepository` interface를 확장한다**

```ts
export interface AuthRepository {
  createDefaultDevUser(): Promise<UserRecord>;
  createUserWithIdentityAndRefreshToken(input: CreateUserWithIdentityInput): Promise<UserRecord>;
  createRefreshTokenRecord(userId: number, refreshToken: string, expiresAt: Date): Promise<void>;
  findDefaultDevUser(): Promise<UserRecord | null>;
  findRefreshToken(refreshToken: string): Promise<RefreshTokenRecord | null>;
  findUserById(userId: number): Promise<UserRecord | null>;
  findUserByProviderIdentity(provider: AuthProvider, providerUserId: string): Promise<UserRecord | null>;
}
```

- [ ] **Step 2: 기본 dev 사용자 상수를 추가한다**

`USER_SELECT_COLUMNS` 아래에 추가한다.

```ts
const DEFAULT_DEV_USER = {
  ageGroup: '30S',
  language: 'ko',
  nickname: 'dev-user',
  notificationsEnabled: true,
  residency: 'POHANG',
} as const;
```

- [ ] **Step 3: `findUserById`를 구현한다**

```ts
  async findUserById(userId) {
    return withConnection(async (connection) => {
      const [rows] = await connection.execute<UserRow[]>(
        `SELECT ${USER_SELECT_COLUMNS}
          FROM users u
          WHERE u.id = ?
          LIMIT 1`,
        [userId],
      );

      return rows[0] ? mapUserRow(rows[0]) : null;
    });
  },
```

- [ ] **Step 4: `findDefaultDevUser`를 구현한다**

```ts
  async findDefaultDevUser() {
    return withConnection(async (connection) => {
      const [rows] = await connection.execute<UserRow[]>(
        `SELECT ${USER_SELECT_COLUMNS}
          FROM users u
          WHERE u.nickname = ?
            AND u.residency = ?
            AND u.age_group = ?
          ORDER BY u.id ASC
          LIMIT 1`,
        [
          DEFAULT_DEV_USER.nickname,
          DEFAULT_DEV_USER.residency,
          DEFAULT_DEV_USER.ageGroup,
        ],
      );

      return rows[0] ? mapUserRow(rows[0]) : null;
    });
  },
```

- [ ] **Step 5: `createDefaultDevUser`를 구현한다**

```ts
  async createDefaultDevUser() {
    return withConnection(async (connection) => {
      const now = new Date();
      const [userInsertResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO users (
            nickname,
            residency,
            age_group,
            language,
            notifications_enabled,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          DEFAULT_DEV_USER.nickname,
          DEFAULT_DEV_USER.residency,
          DEFAULT_DEV_USER.ageGroup,
          DEFAULT_DEV_USER.language,
          DEFAULT_DEV_USER.notificationsEnabled ? 1 : 0,
          now,
          now,
        ],
      );

      const [rows] = await connection.execute<UserRow[]>(
        `SELECT ${USER_SELECT_COLUMNS}
          FROM users u
          WHERE u.id = ?
          LIMIT 1`,
        [userInsertResult.insertId],
      );
      const user = rows[0] ? mapUserRow(rows[0]) : null;

      if (!user) {
        throw new AppError('INTERNAL_ERROR', {
          message: 'Created dev user could not be reloaded',
        });
      }

      return user;
    });
  },
```

## Task 6: AuthService dev login 구현

**Files:**
- Modify: `src/domains/auth/service.ts`
- Modify: `tests/unit/auth/auth-refresh.test.ts`

- [ ] **Step 1: 실패 테스트를 먼저 추가한다**

`tests/unit/auth/auth-refresh.test.ts`에 추가한다.

```ts
test('loginForDev issues real tokens for an existing user', async () => {
  applyServerTestEnv();
  const user = createUser({
    id: 12,
    nickname: 'dev-existing',
  });
  let storedRefreshToken: string | null = null;
  const authRepository: AuthRepository = {
    async createDefaultDevUser() {
      throw new Error('not used');
    },
    async createUserWithIdentityAndRefreshToken() {
      throw new Error('not used');
    },
    async createRefreshTokenRecord(userId, refreshToken) {
      assert.equal(userId, 12);
      storedRefreshToken = refreshToken;
    },
    async findDefaultDevUser() {
      throw new Error('not used');
    },
    async findRefreshToken() {
      throw new Error('not used');
    },
    async findUserById() {
      return user;
    },
    async findUserByProviderIdentity() {
      throw new Error('not used');
    },
  };
  const usersRepository: Pick<UsersRepository, 'findUserById'> = {
    async findUserById() {
      return user;
    },
  };
  const service = createAuthService({
    appleProvider: createUnusedAppleProvider(),
    authRepository,
    kakaoProvider: createUnusedKakaoProvider(),
    usersRepository,
  });

  const result = await service.loginForDev({
    userId: 12,
  });

  assert.equal(result.refreshToken, storedRefreshToken);
  assert.equal(result.user.id, 12);
  assert.equal(result.user.nickname, 'dev-existing');
  assert.equal(result.onboardingCompleted, true);

  const claims = verifyAccessToken(result.token, {
    secret: 'test-secret',
  });
  assert.equal(claims.sub, 12);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm test -- tests/unit/auth/auth-refresh.test.ts`

Expected: `loginForDev`가 `AuthService`에 없어 실패한다.

- [ ] **Step 3: `AuthService` interface를 확장한다**

`src/domains/auth/service.ts`의 imports와 interface를 수정한다.

```ts
import type {
  AppleAuthProviderClient,
  AppleLoginInput,
  DevLoginInput,
  KakaoAuthProviderClient,
  KakaoLoginInput,
  LoginResponseData,
  RefreshResponseData,
  SocialIdentity,
  SessionResponseData,
} from './types.js';
```

```ts
export interface AuthService {
  getSession(userId: number): Promise<SessionResponseData>;
  loginForDev(input: DevLoginInput): Promise<LoginResponseData>;
  loginWithApple(input: AppleLoginInput): Promise<LoginResponseData>;
  loginWithKakao(input: KakaoLoginInput): Promise<LoginResponseData>;
  refreshAccessToken(refreshToken: string): Promise<RefreshResponseData>;
}
```

- [ ] **Step 4: token 발급 helper를 service 내부에 추가한다**

`loginWithIdentity` 바로 아래에 추가한다.

```ts
  async function issueLoginResponseForUser(user: UserRecord): Promise<LoginResponseData> {
    const currentTime = new Date();
    const refreshToken = createRefreshToken();
    const refreshTokenExpiresAt = getRefreshTokenExpiresAt(currentTime);

    await dependencies.authRepository.createRefreshTokenRecord(
      user.id,
      refreshToken,
      refreshTokenExpiresAt,
    );

    return mapLoginResponse(
      user,
      signAccessToken(user.id, { now: currentTime }),
      refreshToken,
    );
  }
```

`UserRecord` import를 추가한다.

```ts
import type {
  UserRecord,
} from '../users/types.js';
```

- [ ] **Step 5: 기존 social login 저장 흐름을 유지한다**

기존 `loginWithIdentity`는 새 사용자 생성 시 이미 refresh token을 저장하므로, `issueLoginResponseForUser`를 적용하지 않고 다음 형태로 유지한다.

```ts
  async function loginWithIdentity(identity: SocialIdentity): Promise<LoginResponseData> {
    const currentTime = new Date();
    const refreshToken = createRefreshToken();
    const refreshTokenExpiresAt = getRefreshTokenExpiresAt(currentTime);
    const existingUser = await dependencies.authRepository.findUserByProviderIdentity(
      identity.provider,
      identity.providerUserId,
    );
    const user = existingUser
      ?? await dependencies.authRepository.createUserWithIdentityAndRefreshToken({
        identity,
        refreshToken,
        refreshTokenExpiresAt,
      });

    if (existingUser) {
      await dependencies.authRepository.createRefreshTokenRecord(
        user.id,
        refreshToken,
        refreshTokenExpiresAt,
      );
    }

    return mapLoginResponse(
      user,
      signAccessToken(user.id, { now: currentTime }),
      refreshToken,
    );
  }
```

- [ ] **Step 6: `loginForDev`를 구현한다**

return 객체 안에 추가한다.

```ts
    async loginForDev(input) {
      if (input.userId) {
        const user = await dependencies.authRepository.findUserById(input.userId);

        if (!user) {
          throw new AppError('NOT_FOUND', {
            message: 'Dev login user not found',
          });
        }

        return issueLoginResponseForUser(user);
      }

      const user = await dependencies.authRepository.findDefaultDevUser()
        ?? await dependencies.authRepository.createDefaultDevUser();

      return issueLoginResponseForUser(user);
    },
```

- [ ] **Step 7: 기존 `AuthRepository` 테스트 stub을 새 interface에 맞춘다**

`tests/unit/auth/auth-refresh.test.ts` 안의 기존 `AuthRepository` stub마다 아래 세 메서드를 추가한다. 해당 테스트에서 호출하지 않는 메서드는 명시적으로 실패하게 둔다.

```ts
    async createDefaultDevUser() {
      throw new Error('not used');
    },
    async findDefaultDevUser() {
      throw new Error('not used');
    },
    async findUserById() {
      throw new Error('not used');
    },
```

이미 `findUserById`를 사용하는 dev login 테스트 stub에서는 위 실패 구현 대신 실제 user를 반환한다.

- [ ] **Step 8: 테스트를 통과시킨다**

Run: `pnpm test -- tests/unit/auth/auth-refresh.test.ts`

Expected: auth service unit test 통과.

## Task 7: Auth handler route와 production 차단 구현

**Files:**
- Modify: `src/lambdas/auth/handler.ts`
- Test: `tests/unit/auth/auth-handler.test.ts`

- [ ] **Step 1: `AuthService` stub에 `loginForDev`를 추가한다**

`tests/unit/auth/auth-handler.test.ts`의 `createAuthServiceStub`에 추가한다.

```ts
    async loginForDev() {
      return {
        onboardingCompleted: true,
        refreshToken: 'refresh-token',
        token: 'access-token',
        user: {
          age_group: '30S',
          id: 99,
          language: 'ko',
          nickname: 'dev-user',
          notifications_enabled: true,
          residency: 'POHANG',
        },
      };
    },
```

- [ ] **Step 2: 성공 테스트를 추가한다**

```ts
test('auth handler returns real-shaped login response for POST /v1/dev/auth/login in dev env', async () => {
  applyServerTestEnv();
  process.env.APP_ENV = 'dev';
  resetEnvForTests();

  const response = await handleAuthRequest(
    createEvent({
      body: JSON.stringify({
        userId: 99,
      }),
      rawPath: '/v1/dev/auth/login',
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          method: 'POST',
          path: '/v1/dev/auth/login',
        },
      },
    }),
    {} as never,
    createAuthServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body as string).data, {
    onboardingCompleted: true,
    refreshToken: 'refresh-token',
    token: 'access-token',
    user: {
      age_group: '30S',
      id: 99,
      language: 'ko',
      nickname: 'dev-user',
      notifications_enabled: true,
      residency: 'POHANG',
    },
  });
});
```

- [ ] **Step 3: production 차단 테스트를 추가한다**

```ts
test('auth handler hides POST /v1/dev/auth/login in production env', async () => {
  applyServerTestEnv();
  process.env.APP_ENV = 'production';
  resetEnvForTests();

  const response = await handleAuthRequest(
    createEvent({
      rawPath: '/v1/dev/auth/login',
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          method: 'POST',
          path: '/v1/dev/auth/login',
        },
      },
    }),
    {} as never,
    createAuthServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 404);
  assert.equal(JSON.parse(response.body as string).error.code, 'NOT_FOUND');
});
```

- [ ] **Step 4: 실패를 확인한다**

Run: `pnpm test -- tests/unit/auth/auth-handler.test.ts`

Expected: handler route가 없어 dev login 성공 테스트가 실패한다.

- [ ] **Step 5: handler imports를 추가한다**

`src/lambdas/auth/handler.ts`에 추가한다.

```ts
import { getEnv, isDevLoginEnabled } from '../../shared/env/server.js';
```

`schemas` import에 추가한다.

```ts
  devLoginSchema,
```

- [ ] **Step 6: `/v1/dev/auth/login` 분기를 추가한다**

`try` 블록의 기존 `/v1/auth/kakao` 분기보다 앞에 둔다.

```ts
    if (request.path === '/v1/dev/auth/login') {
      assertMethod(request.method, ['POST']);

      if (!isDevLoginEnabled(getEnv().APP_ENV)) {
        throw new AppError('NOT_FOUND', {
          message: 'Auth route not found',
        });
      }

      const input = parseInput({
        schema: devLoginSchema,
        input: request.parseJsonBody(),
        message: 'Dev login payload is invalid',
      });
      const result = await service.loginForDev(input);

      return ok(result, {
        requestId: request.requestId ?? null,
      });
    }
```

- [ ] **Step 7: 테스트를 통과시킨다**

Run: `pnpm test -- tests/unit/auth/auth-handler.test.ts`

Expected: auth handler unit test 통과.

## Task 8: 통합 테스트 추가

**Files:**
- Modify: `tests/integration/auth/auth-handler.integration.test.ts`

- [ ] **Step 1: test env cache reset import를 추가한다**

`tests/integration/auth/auth-handler.integration.test.ts` imports에 추가한다.

```ts
import { resetEnvForTests } from '../../../src/shared/env/server.js';
```

- [ ] **Step 2: default dev login 통합 테스트를 추가한다**

```ts
test('dev auth login creates default dev user and persisted refresh token outside production', { skip: integrationSkipReason }, async () => {
  process.env.APP_ENV = 'dev';
  resetEnvForTests();

  const response = await handleAuthRequest(
    createEvent({
      rawPath: '/v1/dev/auth/login',
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          method: 'POST',
          path: '/v1/dev/auth/login',
        },
      },
    }),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body as string) as {
    data: {
      onboardingCompleted: boolean;
      refreshToken: string;
      token: string;
      user: {
        age_group: string | null;
        id: number;
        language: string;
        nickname: string | null;
        notifications_enabled: boolean;
        residency: string | null;
      };
    };
  };

  assert.equal(body.data.onboardingCompleted, true);
  assert.deepEqual(body.data.user, {
    age_group: '30S',
    id: body.data.user.id,
    language: 'ko',
    nickname: 'dev-user',
    notifications_enabled: true,
    residency: 'POHANG',
  });

  const claims = verifyAccessToken(body.data.token);
  assert.equal(claims.sub, body.data.user.id);

  const refreshTokenRows = await queryRows<RefreshTokenRow>(
    `SELECT user_id, refresh_token
      FROM user_refresh_tokens
      WHERE user_id = ?`,
    [body.data.user.id],
  );

  assert.equal(refreshTokenRows.length, 1);
  assert.equal(refreshTokenRows[0]?.refresh_token, body.data.refreshToken);
});
```

- [ ] **Step 3: 기존 userId 통합 테스트를 추가한다**

```ts
test('dev auth login can issue tokens for an existing user id', { skip: integrationSkipReason }, async () => {
  process.env.APP_ENV = 'staging';
  resetEnvForTests();
  const now = new Date();
  const [insertResult] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO users (
        nickname,
        residency,
        age_group,
        language,
        notifications_enabled,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['seed-dev-user', 'POHANG', '20S', 'ko', 1, now, now],
  );

  const response = await handleAuthRequest(
    createEvent({
      body: JSON.stringify({
        userId: insertResult.insertId,
      }),
      rawPath: '/v1/dev/auth/login',
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          method: 'POST',
          path: '/v1/dev/auth/login',
        },
      },
    }),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body as string) as {
    data: {
      refreshToken: string;
      token: string;
      user: {
        id: number;
      };
    };
  };
  const claims = verifyAccessToken(body.data.token);

  assert.equal(body.data.user.id, insertResult.insertId);
  assert.equal(claims.sub, insertResult.insertId);
});
```

- [ ] **Step 4: 통합 테스트를 실행한다**

Run: `pnpm test:integration -- tests/integration/auth/auth-handler.integration.test.ts`

Expected:
- 통합 DB 환경이 있으면 auth integration test 통과.
- 통합 DB 환경이 없으면 기존 helper 기준으로 skip 된다.

## Task 9: 전체 검증

**Files:**
- All modified files

- [ ] **Step 1: 타입 검사를 실행한다**

Run: `pnpm typecheck`

Expected: TypeScript error 없음.

- [ ] **Step 2: 단위 테스트를 실행한다**

Run: `pnpm test`

Expected: unit test 전체 통과.

- [ ] **Step 3: SAM validate를 실행한다**

Run: `pnpm sam:validate`

Expected: SAM template validate 통과.

- [ ] **Step 4: 통합 테스트를 실행한다**

Run: `pnpm test:integration`

Expected:
- 통합 DB 환경이 있으면 integration test 전체 통과.
- 통합 DB 환경이 없으면 skip 사유가 출력되고 테스트 프로세스가 정상 종료된다.

## 구현 시 주의사항

- production 차단은 handler에서 service 호출과 DB 조회보다 먼저 수행한다.
- dev endpoint에서 `signAccessToken`을 직접 새 방식으로 만들지 않는다. 기존 token utility를 그대로 쓴다.
- refresh token은 반드시 `authRepository.createRefreshTokenRecord`로 저장한다.
- response wrapper는 기존처럼 `ok(result, { requestId })`를 사용한다.
- `user_auth_providers`에는 dev provider를 추가하지 않는다. provider enum/운영 데이터 계약 변경을 피한다.
- 이 변경은 앱의 `/v1/auth/me`, `/v1/auth/refresh`, 보호 API 인증 middleware 계약을 바꾸지 않는다.
- root API draft를 함께 수정한다. 새 API 계약이므로 서버 로컬 문서만 수정하면 안 된다.
