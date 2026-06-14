# 회원 탈퇴 API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `DELETE /v1/users/me` 회원 탈퇴 API를 추가하고, 앱 탈퇴 CTA와 대시보드 탈퇴 사용자 표시까지 end-to-end로 연결한다.

**Architecture:** 서버는 기존 `users` 도메인의 handler-service-repository 구조를 유지한다. 탈퇴는 hard delete가 아니라 `users.withdrawn_at` 기록, 프로필 익명화, refresh token revoke, social provider 연결 삭제를 하나의 DB transaction으로 처리한다. 앱은 성공 시 로컬 세션을 삭제하고 로그인 화면으로 이동하며, 대시보드는 탈퇴 사용자를 숨기지 않고 `탈퇴` 상태로 표시한다.

**Tech Stack:** Node.js 24, TypeScript, AWS Lambda HTTP API, mysql2 raw SQL, node:test, Expo Router, Jest, React Native Testing Library, Next.js dashboard, MySQL.

---

## Scope Check

이 작업은 `steelart_server`, `steelart_app`, `steelart_dashboard`를 모두 건드린다. 세 시스템은 독립 배포 단위지만, 이번 기능은 하나의 API 계약을 중심으로 순차 의존성이 있다. 따라서 한 계획 안에서 다루되, 서버 API가 독립적으로 통과한 뒤 앱/대시보드 task를 진행한다.

## File Structure

### Workspace Root

- Modify: `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
  - `DELETE /v1/users/me` 계약과 탈퇴 정책을 루트 API 초안에 추가한다.
- Modify: `/Users/donggyunyang/code/steelart/STEELART_DB_TABLES.md`
  - `users.withdrawn_at`과 탈퇴 사용자 운영 규칙을 schema reference에 추가한다.
- Modify: `/Users/donggyunyang/code/steelart/CONTEXT.md`
  - 이미 추가된 `회원 탈퇴`, `탈퇴 후 재가입`, `탈퇴 사용자` 용어가 구현 정책과 맞는지 확인한다.

### Server

- Create: `/Users/donggyunyang/code/steelart/steelart_server/docs/sql/2026-06-14-add-users-withdrawn-at.sql`
  - 실제 DB에 적용할 `users.withdrawn_at` DDL을 문서화한다.
- Modify: `/Users/donggyunyang/code/steelart/steelart_server/src/lambdas/users/handler.ts`
  - `DELETE /v1/users/me` 라우팅을 추가한다.
- Modify: `/Users/donggyunyang/code/steelart/steelart_server/src/domains/users/types.ts`
  - `WithdrawAccountResponse` 타입을 추가한다.
- Modify: `/Users/donggyunyang/code/steelart/steelart_server/src/domains/users/service.ts`
  - `withdrawAccount(userId)` service method를 추가한다.
- Modify: `/Users/donggyunyang/code/steelart/steelart_server/src/domains/users/repository.ts`
  - transaction 기반 탈퇴 처리 SQL을 추가한다.
- Modify: `/Users/donggyunyang/code/steelart/steelart_server/tests/unit/users/users-handler.test.ts`
  - handler 라우팅/응답 단위 테스트를 추가한다.
- Modify: `/Users/donggyunyang/code/steelart/steelart_server/tests/integration/users/users-handler.integration.test.ts`
  - 실제 DB 탈퇴 persistence 통합 테스트를 추가한다.

### App

- Modify: `/Users/donggyunyang/code/steelart/steelart_app/src/api/auth.ts`
  - `withdrawAccount()` API wrapper를 추가한다.
- Modify: `/Users/donggyunyang/code/steelart/steelart_app/tests/api/auth-user-settings.test.ts`
  - 탈퇴 API wrapper test를 추가한다.
- Modify: `/Users/donggyunyang/code/steelart/steelart_app/src/features/mypage/constants.ts`
  - 탈퇴 실패 toast 문구를 추가한다.
- Modify: `/Users/donggyunyang/code/steelart/steelart_app/src/features/mypage/screens/WithdrawScreen.tsx`
  - 준비 중 toast 대신 API 호출, 세션 삭제, 로그인 이동을 수행한다.
- Modify: `/Users/donggyunyang/code/steelart/steelart_app/tests/features/mypage/screens/withdraw-screen.test.tsx`
  - 성공/실패/뒤로가기 테스트를 갱신한다.

### Dashboard

- Modify: `/Users/donggyunyang/code/steelart/steelart_dashboard/src/app/api/admin/users/route.ts`
  - 사용자 목록 API에 `withdrawn_at`을 포함한다.
- Modify: `/Users/donggyunyang/code/steelart/steelart_dashboard/src/app/admin/users/page.tsx`
  - 목록에 상태 컬럼을 추가하고 nullable residency/age group을 표시한다.
- Modify: `/Users/donggyunyang/code/steelart/steelart_dashboard/src/app/api/admin/users/[id]/route.ts`
  - 사용자 상세 API에 `withdrawn_at`을 포함한다.
- Modify: `/Users/donggyunyang/code/steelart/steelart_dashboard/src/app/admin/users/[id]/page.tsx`
  - 상세 기본 정보에 `탈퇴` 상태와 탈퇴 일시를 표시한다.

---

### Task 1: Contract And Schema Docs

**Files:**
- Modify: `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
- Modify: `/Users/donggyunyang/code/steelart/STEELART_DB_TABLES.md`
- Create: `/Users/donggyunyang/code/steelart/steelart_server/docs/sql/2026-06-14-add-users-withdrawn-at.sql`
- Verify: `/Users/donggyunyang/code/steelart/steelart_server/docs/adr/0001-withdrawal-access-token-grace.md`

- [ ] **Step 1: Add the SQL script**

Create `/Users/donggyunyang/code/steelart/steelart_server/docs/sql/2026-06-14-add-users-withdrawn-at.sql`:

```sql
ALTER TABLE users
  ADD COLUMN withdrawn_at datetime DEFAULT NULL,
  ADD KEY idx_users_withdrawn_at (withdrawn_at);
```

- [ ] **Step 2: Update the API draft**

In `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`, add this section after `8-3. 언어 설정 수정`:

```md
### 8-4. 회원 탈퇴
- `DELETE /v1/users/me`
- 구현 상태: `구현 완료`
- 목적:
  - 현재 로그인한 사용자를 탈퇴 처리한다.
- 요청 body:
  - 없음
- 처리 규칙:
  - 사용자 row는 hard delete하지 않는다.
  - `users.withdrawn_at`을 현재 시각으로 기록한다.
  - `users.nickname`은 `unknown`으로 변경한다.
  - `users.residency`, `users.age_group`은 `NULL`로 변경한다.
  - `users.notifications_enabled`는 `false`로 변경한다.
  - `users.language`는 `ko`로 변경한다.
  - 해당 사용자의 refresh token은 모두 revoke한다.
  - 해당 사용자의 카카오/애플 provider 연결은 삭제한다.
  - 사용자가 만든 코스, 체크인, 좋아요 데이터는 삭제하지 않는다.
  - 같은 카카오/애플 계정으로 다시 로그인하면 기존 탈퇴 계정을 복구하지 않고 신규 가입으로 처리한다.
  - 이미 탈퇴 처리된 사용자가 같은 access token으로 다시 호출해도 멱등하게 성공한다.
  - 이미 발급된 access token은 즉시 차단하지 않고 만료 시점까지 둔다.
- 응답 예시:
```json
{
  "data": {
    "withdrawn": true
  },
  "meta": {
    "requestId": "aws-request-id"
  },
  "error": null
}
```
- 실제 `data` 타입:
```ts
{
  withdrawn: true;
}
```
```

Then renumber the current `8-4. 공지사항 제공 방식` to `8-5`, and `8-5. 외부 링크 제공 방식` to `8-6`.

- [ ] **Step 3: Update the DB table reference**

In `/Users/donggyunyang/code/steelart/STEELART_DB_TABLES.md`, add `withdrawn_at` to the `users` known columns:

```md
  - `withdrawn_at` datetime nullable
```

Add this note under the `users` notes:

```md
  - 회원 탈퇴 시 user row는 삭제하지 않고 `withdrawn_at`을 기록하며, nickname은 `unknown`, residency와 age_group은 `NULL`, notifications_enabled는 `0`, language는 `ko`로 익명화한다.
  - 탈퇴 사용자가 만든 코스, 체크인, 좋아요 데이터는 보존한다.
  - 탈퇴 사용자는 대시보드 사용자 목록/상세에서 숨기지 않고 탈퇴 상태로 표시한다.
```

- [ ] **Step 4: Verify ADR still matches the contract**

Run:

```bash
sed -n '1,160p' /Users/donggyunyang/code/steelart/steelart_server/docs/adr/0001-withdrawal-access-token-grace.md
```

Expected: the ADR states that refresh tokens are revoked, existing access tokens are not immediately blocked, and immediate blocking can be added by checking `users.withdrawn_at IS NULL` in auth.

- [ ] **Step 5: Commit docs**

```bash
cd /Users/donggyunyang/code/steelart
git add STEELART_SERVER_API_DRAFT.md STEELART_DB_TABLES.md steelart_server/docs/sql/2026-06-14-add-users-withdrawn-at.sql steelart_server/docs/adr/0001-withdrawal-access-token-grace.md
git commit -m "docs: define member withdrawal contract"
```

---

### Task 2: Server Handler Contract

**Files:**
- Modify: `/Users/donggyunyang/code/steelart/steelart_server/tests/unit/users/users-handler.test.ts`
- Modify: `/Users/donggyunyang/code/steelart/steelart_server/src/domains/users/types.ts`
- Modify: `/Users/donggyunyang/code/steelart/steelart_server/src/domains/users/service.ts`
- Modify: `/Users/donggyunyang/code/steelart/steelart_server/src/lambdas/users/handler.ts`

- [ ] **Step 1: Write the failing handler test**

In `/Users/donggyunyang/code/steelart/steelart_server/tests/unit/users/users-handler.test.ts`, update `createUsersServiceStub()` to include `withdrawAccount`:

```ts
function createUsersServiceStub(): UsersService {
  return {
    async getProfile() {
      throw new Error('not used');
    },
    async updateLanguage(userId, input) {
      return {
        onboardingCompleted: true,
        user: {
          age_group: '30S',
          id: userId,
          language: input.language,
          nickname: 'steelwalker',
          notifications_enabled: true,
          residency: 'POHANG',
        },
      };
    },
    async updateNotifications() {
      throw new Error('not used');
    },
    async updateOnboarding() {
      throw new Error('not used');
    },
    async updateProfile() {
      throw new Error('not used');
    },
    async withdrawAccount() {
      return {
        withdrawn: true,
      };
    },
  };
}
```

Append this test:

```ts
// 인증된 사용자가 회원 탈퇴를 요청하면 200 응답과 withdrawn=true를 반환해야 한다.
test('users handler withdraws authenticated account', async () => {
  applyServerTestEnv();
  const issuedAt = new Date();

  const token = signAccessToken(5, {
    now: issuedAt,
    secret: 'test-secret',
  });
  const response = await handleUsersRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/users/me',
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          method: 'DELETE',
          path: '/v1/users/me',
        },
      },
    }),
    {} as never,
    createUsersServiceStub(),
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body as string), {
    data: {
      withdrawn: true,
    },
    error: null,
    meta: {
      requestId: 'request-id',
    },
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd /Users/donggyunyang/code/steelart/steelart_server
pnpm test tests/unit/users/users-handler.test.ts
```

Expected: FAIL because `DELETE /v1/users/me` currently returns `METHOD_NOT_ALLOWED` instead of `200`.

- [ ] **Step 3: Add the response type**

In `/Users/donggyunyang/code/steelart/steelart_server/src/domains/users/types.ts`, append:

```ts
export interface WithdrawAccountResponse {
  withdrawn: true;
}
```

- [ ] **Step 4: Add the service method**

In `/Users/donggyunyang/code/steelart/steelart_server/src/domains/users/service.ts`, update the imports:

```ts
import type {
  LanguageUpdateInput,
  NotificationsUpdateInput,
  OnboardingUpdateInput,
  ProfileUpdateInput,
  UserProfileResponse,
  WithdrawAccountResponse,
} from './types.js';
```

Update `UsersService`:

```ts
export interface UsersService {
  getProfile(userId: number): Promise<UserProfileResponse>;
  updateLanguage(userId: number, input: LanguageUpdateInput): Promise<UserProfileResponse>;
  updateNotifications(userId: number, input: NotificationsUpdateInput): Promise<UserProfileResponse>;
  updateOnboarding(userId: number, input: OnboardingUpdateInput): Promise<UserProfileResponse>;
  updateProfile(userId: number, input: ProfileUpdateInput): Promise<UserProfileResponse>;
  withdrawAccount(userId: number): Promise<WithdrawAccountResponse>;
}
```

Add the method inside `createUsersService()`:

```ts
    async withdrawAccount(userId) {
      await dependencies.usersRepository.withdrawAccount(userId);

      return {
        withdrawn: true,
      };
    },
```

- [ ] **Step 5: Add the handler route**

In `/Users/donggyunyang/code/steelart/steelart_server/src/lambdas/users/handler.ts`, replace the `/v1/users/me` block with:

```ts
    if (request.path === '/v1/users/me') {
      assertMethod(request.method, ['GET', 'PATCH', 'DELETE']);

      if (request.method === 'GET') {
        const result = await service.getProfile(auth.userId);

        return ok(result, {
          requestId: request.requestId ?? null,
        });
      }

      if (request.method === 'PATCH') {
        const input = parseInput({
          schema: profileUpdateSchema,
          input: request.parseJsonBody(),
          message: 'Profile payload is invalid',
        });
        const result = await service.updateProfile(auth.userId, input);

        return ok(result, {
          requestId: request.requestId ?? null,
        });
      }

      if (request.method === 'DELETE') {
        const result = await service.withdrawAccount(auth.userId);

        return ok(result, {
          requestId: request.requestId ?? null,
        });
      }
    }
```

- [ ] **Step 6: Run the handler test**

Run:

```bash
cd /Users/donggyunyang/code/steelart/steelart_server
pnpm test tests/unit/users/users-handler.test.ts
```

Expected: PASS for both `users handler updates language with authenticated request` and `users handler withdraws authenticated account`.

- [ ] **Step 7: Commit server handler contract**

```bash
cd /Users/donggyunyang/code/steelart/steelart_server
git add tests/unit/users/users-handler.test.ts src/domains/users/types.ts src/domains/users/service.ts src/lambdas/users/handler.ts
git commit -m "feat: route member withdrawal request"
```

---

### Task 3: Server Withdrawal Transaction

**Files:**
- Modify: `/Users/donggyunyang/code/steelart/steelart_server/tests/integration/users/users-handler.integration.test.ts`
- Modify: `/Users/donggyunyang/code/steelart/steelart_server/src/domains/users/repository.ts`

- [ ] **Step 1: Write the failing integration test**

In `/Users/donggyunyang/code/steelart/steelart_server/tests/integration/users/users-handler.integration.test.ts`, extend `UserRow`:

```ts
interface UserRow extends RowDataPacket {
  age_group: string | null;
  id: number;
  language?: string;
  nickname: string | null;
  notifications_enabled?: number;
  residency: string | null;
  withdrawn_at?: Date | string | null;
}
```

Append this test:

```ts
// 회원 탈퇴 handler는 사용자 row를 익명화하고 토큰/provider를 정리하되 작성 데이터는 보존해야 한다.
test('users handler withdraws account and preserves user activity data', { skip: integrationSkipReason }, async () => {
  const now = new Date();
  const [userInsertResult] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO users (
        nickname,
        residency,
        age_group,
        language,
        notifications_enabled,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['steelwalker', 'POHANG', '30S', 'en', 1, now, now],
  );
  const userId = userInsertResult.insertId;

  await getPool().execute(
    `INSERT INTO user_auth_providers (
        user_id,
        provider,
        provider_user_id,
        created_at
      ) VALUES (?, ?, ?, ?)`,
    [userId, 'KAKAO', 'kakao-user-1', now],
  );

  await getPool().execute(
    `INSERT INTO user_refresh_tokens (
        user_id,
        refresh_token,
        expires_at,
        revoked_at,
        created_at,
        updated_at
      ) VALUES (?, ?, DATE_ADD(?, INTERVAL 30 DAY), NULL, ?, ?)`,
    [userId, 'refresh-token-active', now, now, now],
  );

  const [courseInsertResult] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO courses (
        title_ko,
        title_en,
        description_ko,
        description_en,
        is_official,
        created_by_user_id,
        likes_count,
        deleted_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, 0, ?, 0, NULL, ?, ?)`,
    [
      '내 코스',
      'My Course',
      '탈퇴 후에도 남는 코스',
      'Course kept after withdrawal',
      userId,
      now,
      now,
    ],
  );

  const token = signAccessToken(userId);

  const response = await handleUsersRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/users/me',
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          method: 'DELETE',
          path: '/v1/users/me',
        },
      },
    }),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body as string).data, {
    withdrawn: true,
  });

  const userRows = await queryRows<UserRow>(
    `SELECT id, nickname, residency, age_group, language, notifications_enabled, withdrawn_at
      FROM users
      WHERE id = ?`,
    [userId],
  );

  assert.equal(userRows.length, 1);
  assert.equal(userRows[0]?.nickname, 'unknown');
  assert.equal(userRows[0]?.residency, null);
  assert.equal(userRows[0]?.age_group, null);
  assert.equal(userRows[0]?.language, 'ko');
  assert.equal(userRows[0]?.notifications_enabled, 0);
  assert.notEqual(userRows[0]?.withdrawn_at, null);

  const refreshRows = await queryRows<RowDataPacket & { revoked_at: Date | string | null }>(
    `SELECT revoked_at
      FROM user_refresh_tokens
      WHERE user_id = ?`,
    [userId],
  );
  assert.equal(refreshRows.length, 1);
  assert.notEqual(refreshRows[0]?.revoked_at, null);

  const providerRows = await queryRows<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total
      FROM user_auth_providers
      WHERE user_id = ?`,
    [userId],
  );
  assert.equal(Number(providerRows[0]?.total ?? 0), 0);

  const courseRows = await queryRows<RowDataPacket & { created_by_user_id: number | null }>(
    `SELECT created_by_user_id
      FROM courses
      WHERE id = ?`,
    [courseInsertResult.insertId],
  );
  assert.equal(courseRows[0]?.created_by_user_id, userId);
});
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run:

```bash
cd /Users/donggyunyang/code/steelart/steelart_server
pnpm test:integration tests/integration/users/users-handler.integration.test.ts
```

Expected: FAIL when the integration DB has no `users.withdrawn_at` column, or FAIL because `usersRepository.withdrawAccount` is not implemented. If integration DB env vars are missing, the test is skipped with `integration DB 설정이 없어 건너뜁니다`.

- [ ] **Step 3: Add the repository interface method**

In `/Users/donggyunyang/code/steelart/steelart_server/src/domains/users/repository.ts`, add the import:

```ts
import { withTransaction } from '../../shared/db/tx.js';
```

Update `UsersRepository`:

```ts
export interface UsersRepository {
  findUserById(userId: number): Promise<UserRecord | null>;
  updateLanguage(userId: number, input: LanguageUpdateInput): Promise<UserRecord>;
  updateNotifications(userId: number, input: NotificationsUpdateInput): Promise<UserRecord>;
  updateOnboarding(userId: number, input: OnboardingUpdateInput): Promise<UserRecord>;
  updateProfile(userId: number, input: ProfileUpdateInput): Promise<UserRecord>;
  withdrawAccount(userId: number): Promise<void>;
}
```

- [ ] **Step 4: Add the transaction implementation**

Add this method at the end of `usersRepository`, before the closing `};`:

```ts
  async withdrawAccount(userId) {
    await withTransaction(async (connection) => {
      const now = new Date();

      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE users
            SET nickname = ?,
                residency = NULL,
                age_group = NULL,
                language = ?,
                notifications_enabled = ?,
                withdrawn_at = COALESCE(withdrawn_at, ?),
                updated_at = ?
          WHERE id = ?`,
        ['unknown', 'ko', 0, now, now, userId],
      );

      if (result.affectedRows === 0) {
        throw new AppError('NOT_FOUND', {
          message: 'User not found',
        });
      }

      await connection.execute<ResultSetHeader>(
        `UPDATE user_refresh_tokens
            SET revoked_at = COALESCE(revoked_at, ?),
                updated_at = ?
          WHERE user_id = ?
            AND revoked_at IS NULL`,
        [now, now, userId],
      );

      await connection.execute<ResultSetHeader>(
        `DELETE FROM user_auth_providers
          WHERE user_id = ?`,
        [userId],
      );
    });
  },
```

- [ ] **Step 5: Apply schema to the integration DB**

Run against the integration DB used by `.env.integration`:

```bash
cd /Users/donggyunyang/code/steelart/steelart_server
mysql \
  --host="$INTEGRATION_DB_HOST" \
  --port="${INTEGRATION_DB_PORT:-3306}" \
  --user="$INTEGRATION_DB_USER" \
  --password="$INTEGRATION_DB_PASSWORD" \
  "$INTEGRATION_DB_NAME" \
  < docs/sql/2026-06-14-add-users-withdrawn-at.sql
```

Expected: MySQL returns `Query OK` for the `ALTER TABLE`.

- [ ] **Step 6: Run the integration test**

Run:

```bash
cd /Users/donggyunyang/code/steelart/steelart_server
pnpm test:integration tests/integration/users/users-handler.integration.test.ts
```

Expected: PASS, including `users handler withdraws account and preserves user activity data`.

- [ ] **Step 7: Run server checks**

Run:

```bash
cd /Users/donggyunyang/code/steelart/steelart_server
pnpm typecheck
pnpm test
```

Expected: PASS for TypeScript and unit tests.

- [ ] **Step 8: Commit server transaction**

```bash
cd /Users/donggyunyang/code/steelart/steelart_server
git add src/domains/users/repository.ts tests/integration/users/users-handler.integration.test.ts
git commit -m "feat: anonymize account withdrawal"
```

---

### Task 4: Server Idempotency Verification

**Files:**
- Modify: `/Users/donggyunyang/code/steelart/steelart_server/tests/integration/users/users-handler.integration.test.ts`

- [ ] **Step 1: Write the idempotency test**

Append this test:

```ts
// 이미 탈퇴된 사용자가 같은 access token으로 다시 탈퇴를 요청해도 멱등하게 성공해야 한다.
test('users handler returns withdrawn true when account is already withdrawn', { skip: integrationSkipReason }, async () => {
  const now = new Date();
  const [insertResult] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO users (
        nickname,
        residency,
        age_group,
        language,
        notifications_enabled,
        withdrawn_at,
        created_at,
        updated_at
      ) VALUES (?, NULL, NULL, ?, ?, ?, ?, ?)`,
    ['unknown', 'ko', 0, now, now, now],
  );
  const token = signAccessToken(insertResult.insertId);

  const response = await handleUsersRequest(
    createEvent({
      headers: {
        authorization: `Bearer ${token}`,
      },
      rawPath: '/v1/users/me',
      requestContext: {
        ...createEvent().requestContext,
        http: {
          ...createEvent().requestContext.http,
          method: 'DELETE',
          path: '/v1/users/me',
        },
      },
    }),
    {} as never,
  ) as APIGatewayProxyStructuredResultV2;

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body as string).data, {
    withdrawn: true,
  });

  const rows = await queryRows<UserRow>(
    `SELECT nickname, residency, age_group, language, notifications_enabled, withdrawn_at
      FROM users
      WHERE id = ?`,
    [insertResult.insertId],
  );

  assert.equal(rows[0]?.nickname, 'unknown');
  assert.equal(rows[0]?.residency, null);
  assert.equal(rows[0]?.age_group, null);
  assert.equal(rows[0]?.language, 'ko');
  assert.equal(rows[0]?.notifications_enabled, 0);
  assert.notEqual(rows[0]?.withdrawn_at, null);
});
```

- [ ] **Step 2: Run the integration test**

Run:

```bash
cd /Users/donggyunyang/code/steelart/steelart_server
pnpm test:integration tests/integration/users/users-handler.integration.test.ts
```

Expected: PASS. The existing repository implementation uses `COALESCE(withdrawn_at, ?)` and already satisfies this test.

- [ ] **Step 3: Commit idempotency test**

```bash
cd /Users/donggyunyang/code/steelart/steelart_server
git add tests/integration/users/users-handler.integration.test.ts
git commit -m "test: cover idempotent member withdrawal"
```

---

### Task 5: App API Wrapper

**Files:**
- Modify: `/Users/donggyunyang/code/steelart/steelart_app/tests/api/auth-user-settings.test.ts`
- Modify: `/Users/donggyunyang/code/steelart/steelart_app/src/api/auth.ts`

- [ ] **Step 1: Write the failing API test**

In `/Users/donggyunyang/code/steelart/steelart_app/tests/api/auth-user-settings.test.ts`, update the import:

```ts
import {
  updateUserLanguage,
  updateUserNotifications,
  updateUserProfile,
  withdrawAccount,
} from '@/api/auth';
```

Append this test inside `describe('사용자 설정 API 요청', () => { ... })`:

```ts
  it('회원 탈퇴 요청을 인증 DELETE로 보낸다', async () => {
    apiFetchMock.mockResolvedValueOnce({
      data: {
        withdrawn: true,
      },
      error: null,
      meta: null,
    });

    const result = await withdrawAccount();

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/v1/users/me',
      {
        method: 'DELETE',
      },
      { auth: true }
    );
    expect(result).toEqual({
      withdrawn: true,
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd /Users/donggyunyang/code/steelart/steelart_app
pnpm test tests/api/auth-user-settings.test.ts
```

Expected: FAIL with an export/import error for `withdrawAccount`.

- [ ] **Step 3: Add the API function**

In `/Users/donggyunyang/code/steelart/steelart_app/src/api/auth.ts`, add the type near the other response types:

```ts
export type WithdrawAccountResponseData = {
  withdrawn: true;
};
```

Append the API function:

```ts
export async function withdrawAccount() {
  const response = await apiFetch<ApiResponse<WithdrawAccountResponseData>>(
    '/v1/users/me',
    {
      method: 'DELETE',
    },
    {
      auth: true,
    }
  );

  return response.data;
}
```

- [ ] **Step 4: Run the API test**

Run:

```bash
cd /Users/donggyunyang/code/steelart/steelart_app
pnpm test tests/api/auth-user-settings.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit app API wrapper**

```bash
cd /Users/donggyunyang/code/steelart/steelart_app
git add src/api/auth.ts tests/api/auth-user-settings.test.ts
git commit -m "feat: add account withdrawal API client"
```

---

### Task 6: App Withdrawal Screen Flow

**Files:**
- Modify: `/Users/donggyunyang/code/steelart/steelart_app/src/features/mypage/constants.ts`
- Modify: `/Users/donggyunyang/code/steelart/steelart_app/src/features/mypage/screens/WithdrawScreen.tsx`
- Modify: `/Users/donggyunyang/code/steelart/steelart_app/tests/features/mypage/screens/withdraw-screen.test.tsx`

- [ ] **Step 1: Write the failing screen tests**

Replace `/Users/donggyunyang/code/steelart/steelart_app/tests/features/mypage/screens/withdraw-screen.test.tsx` with:

```tsx
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { withdrawAccount } from '@/api/auth';
import { WithdrawScreen } from '@/features/mypage/screens/WithdrawScreen';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockShowToast = jest.fn();
const mockClearSession = jest.fn<() => Promise<void>>();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
}));

jest.mock('@/api/auth', () => ({
  withdrawAccount: jest.fn(),
}));

jest.mock('@/providers/session-provider', () => ({
  useSession: () => ({ clearSession: mockClearSession }),
}));

jest.mock('@/providers/toast-provider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const withdrawAccountMock = jest.mocked(withdrawAccount);

describe('회원 탈퇴 화면', () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockReplace.mockReset();
    mockShowToast.mockReset();
    mockClearSession.mockReset();
    mockClearSession.mockResolvedValue();
    withdrawAccountMock.mockReset();
    withdrawAccountMock.mockResolvedValue({ withdrawn: true });
  });

  it('탈퇴 안내와 실제 탈퇴 CTA를 렌더링한다', () => {
    const { getAllByText, getByText, getByTestId } = renderWithSafeArea(
      <WithdrawScreen />
    );

    expect(getAllByText('탈퇴하기')).toHaveLength(2);
    expect(
      getByText('포항스틸아트 탈퇴 전 하단 내용을 확인해주세요')
    ).toBeTruthy();
    expect(getByText('처음부터 다시 가입 🔐')).toBeTruthy();
    expect(getByText('등록된 코스는 자동 삭제되지 않습니다 📍')).toBeTruthy();
    expect(getByTestId('withdraw-button')).toBeTruthy();
  });

  it('탈퇴 성공 시 API 호출 후 세션을 삭제하고 로그인 화면으로 이동한다', async () => {
    const { getByTestId } = renderWithSafeArea(<WithdrawScreen />);

    fireEvent.press(getByTestId('withdraw-button'));

    await waitFor(() => {
      expect(withdrawAccountMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockClearSession).toHaveBeenCalledTimes(1);
    });
    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it('탈퇴 실패 시 세션을 유지하고 실패 toast를 표시한다', async () => {
    withdrawAccountMock.mockRejectedValueOnce(new Error('network'));
    const { getByTestId } = renderWithSafeArea(<WithdrawScreen />);

    fireEvent.press(getByTestId('withdraw-button'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith({
        icon: 'alertCircle',
        message: '탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      });
    });
    expect(mockClearSession).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('상단 back 버튼으로 이전 화면에 돌아간다', () => {
    const { getByLabelText } = renderWithSafeArea(<WithdrawScreen />);

    fireEvent.press(getByLabelText('뒤로가기'));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockShowToast).not.toHaveBeenCalled();
  });
});

function renderWithSafeArea(ui: ReactElement) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { height: 812, width: 375, x: 0, y: 0 },
        insets: { bottom: 0, left: 0, right: 0, top: 0 },
      }}
    >
      {ui}
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd /Users/donggyunyang/code/steelart/steelart_app
pnpm test tests/features/mypage/screens/withdraw-screen.test.tsx
```

Expected: FAIL because `WithdrawScreen` still uses `withdraw-preparing-button`, does not call `withdrawAccount`, and does not call `clearSession`.

- [ ] **Step 3: Add the failure toast message**

In `/Users/donggyunyang/code/steelart/steelart_app/src/features/mypage/constants.ts`, make sure `myPageToastMessages` includes:

```ts
export const myPageToastMessages = {
  externalLinkFailed: '링크를 열지 못했습니다.',
  locationPermissionDenied:
    '위치 권한이 꺼져 있습니다. 설정에서 권한을 허용해 주세요.',
  profileUpdateFailed: '내 정보를 저장하지 못했습니다.',
  settingsUpdateFailed: '설정을 저장하지 못했습니다.',
  withdrawalFailed: '탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  withdrawalPreparing: '회원 탈퇴 기능은 준비 중입니다.',
} as const;
```

This keeps the current keys and inserts `withdrawalFailed`.

- [ ] **Step 4: Replace the screen behavior**

In `/Users/donggyunyang/code/steelart/steelart_app/src/features/mypage/screens/WithdrawScreen.tsx`, update imports:

```ts
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { withdrawAccount } from '@/api/auth';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { myPageToastMessages } from '@/features/mypage/constants';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/providers/toast-provider';
import { aliasColors } from '@/theme/alias-colors';
import { primitiveColors } from '@/theme/primitive-colors';
import { radius } from '@/theme/radius';
import { spacing } from '@/theme/spacing';
```

Replace the top of `WithdrawScreen()` with:

```tsx
export function WithdrawScreen() {
  const router = useRouter();
  const { clearSession } = useSession();
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBackPress = useCallback(() => {
    router.back();
  }, [router]);

  const handleWithdrawPress = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      await withdrawAccount();
      await clearSession();
      router.replace('/login' as never);
    } catch {
      setIsSubmitting(false);
      showToast({
        icon: 'alertCircle',
        message: myPageToastMessages.withdrawalFailed,
      });
    }
  }, [clearSession, isSubmitting, router, showToast]);
```

Replace the bottom button with:

```tsx
        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={handleWithdrawPress}
          style={[
            styles.withdrawButton,
            isSubmitting ? styles.withdrawButtonDisabled : null,
          ]}
          testID="withdraw-button"
        >
          <AppText color="textOnDark" variant="b1SemiBold">
            탈퇴하기
          </AppText>
        </Pressable>
```

Add this style:

```ts
  withdrawButtonDisabled: {
    opacity: 0.6,
  },
```

- [ ] **Step 5: Run the screen test**

Run:

```bash
cd /Users/donggyunyang/code/steelart/steelart_app
pnpm test tests/features/mypage/screens/withdraw-screen.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run app checks**

Run:

```bash
cd /Users/donggyunyang/code/steelart/steelart_app
pnpm test tests/api/auth-user-settings.test.ts tests/features/mypage/screens/withdraw-screen.test.tsx
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit app flow**

```bash
cd /Users/donggyunyang/code/steelart/steelart_app
git add src/api/auth.ts tests/api/auth-user-settings.test.ts src/features/mypage/constants.ts src/features/mypage/screens/WithdrawScreen.tsx tests/features/mypage/screens/withdraw-screen.test.tsx
git commit -m "feat: connect withdrawal screen to API"
```

---

### Task 7: Dashboard Users API Status Fields

**Files:**
- Modify: `/Users/donggyunyang/code/steelart/steelart_dashboard/src/app/api/admin/users/route.ts`
- Modify: `/Users/donggyunyang/code/steelart/steelart_dashboard/src/app/api/admin/users/[id]/route.ts`

- [ ] **Step 1: Update the list API row type and SELECT**

In `/Users/donggyunyang/code/steelart/steelart_dashboard/src/app/api/admin/users/route.ts`, replace `UserListRow` with:

```ts
type UserListRow = RowDataPacket & {
  id: number;
  nickname: string;
  residency: "POHANG" | "NON_POHANG" | null;
  age_group: "TEEN" | "20S" | "30S" | "40S" | "50S" | "60S" | "70_PLUS" | null;
  language: "ko" | "en";
  notifications_enabled: number;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
};
```

Replace the rows query SELECT with:

```ts
      `SELECT u.id, u.nickname, u.residency, u.age_group, u.language,
              u.notifications_enabled, u.withdrawn_at, u.created_at, u.updated_at
       FROM users u
       ${where.join(" ")}
       ORDER BY u.created_at DESC, u.id DESC
       LIMIT ? OFFSET ?`,
```

- [ ] **Step 2: Update the detail API row type and SELECT**

In `/Users/donggyunyang/code/steelart/steelart_dashboard/src/app/api/admin/users/[id]/route.ts`, replace `UserProfileRow` with:

```ts
type UserProfileRow = RowDataPacket & {
  id: number;
  nickname: string;
  residency: "POHANG" | "NON_POHANG" | null;
  age_group: "TEEN" | "20S" | "30S" | "40S" | "50S" | "60S" | "70_PLUS" | null;
  language: "ko" | "en";
  notifications_enabled: number;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
};
```

Replace the user query with:

```ts
    const userRows = await query<UserProfileRow[]>(
      `SELECT id, nickname, residency, age_group, language, notifications_enabled, withdrawn_at, created_at, updated_at
       FROM users
       WHERE id = ?`,
      [userId],
    );
```

- [ ] **Step 3: Run dashboard typecheck/build**

Run:

```bash
cd /Users/donggyunyang/code/steelart/steelart_dashboard
pnpm build
```

Expected: FAIL until UI types handle nullable residency/age group and `withdrawn_at`.

- [ ] **Step 4: Commit API status fields after Task 8 passes**

Do not commit yet. Commit this task together with Task 8 so dashboard API and UI stay consistent.

---

### Task 8: Dashboard Users UI Status Display

**Files:**
- Modify: `/Users/donggyunyang/code/steelart/steelart_dashboard/src/app/admin/users/page.tsx`
- Modify: `/Users/donggyunyang/code/steelart/steelart_dashboard/src/app/admin/users/[id]/page.tsx`

- [ ] **Step 1: Update the users list page types and helpers**

In `/Users/donggyunyang/code/steelart/steelart_dashboard/src/app/admin/users/page.tsx`, replace `User` with:

```ts
type User = {
  id: number;
  nickname: string;
  residency: "POHANG" | "NON_POHANG" | null;
  age_group: "TEEN" | "20S" | "30S" | "40S" | "50S" | "60S" | "70_PLUS" | null;
  language: "ko" | "en";
  notifications_enabled: number;
  withdrawn_at: string | null;
  created_at: string;
};
```

Replace the residency and age map types:

```ts
const residencyLabelMap: Record<NonNullable<User["residency"]>, string> = {
  POHANG: "포항",
  NON_POHANG: "포항 외",
};

const ageGroupLabelMap: Record<NonNullable<User["age_group"]>, string> = {
  TEEN: "10대",
  "20S": "20대",
  "30S": "30대",
  "40S": "40대",
  "50S": "50대",
  "60S": "60대",
  "70_PLUS": "70대 이상",
};
```

Add helper functions below `formatDateTime`:

```ts
function formatResidency(value: User["residency"]) {
  return value ? residencyLabelMap[value] : "-";
}

function formatAgeGroup(value: User["age_group"]) {
  return value ? ageGroupLabelMap[value] : "-";
}

function formatUserStatus(user: Pick<User, "withdrawn_at">) {
  return user.withdrawn_at ? "탈퇴" : "활성";
}
```

- [ ] **Step 2: Add the status column to the users list**

In the table header, add status after nickname:

```tsx
              <th className="px-3 py-2 text-left">상태</th>
```

Change the loading and empty `colSpan` values from `8` to `9`:

```tsx
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
```

Replace the user row cells for nickname/residency/age group:

```tsx
                  <td className="px-3 py-2">{user.nickname}</td>
                  <td className="px-3 py-2">{formatUserStatus(user)}</td>
                  <td className="px-3 py-2">{formatResidency(user.residency)}</td>
                  <td className="px-3 py-2">{formatAgeGroup(user.age_group)}</td>
```

- [ ] **Step 3: Update the detail page types and helpers**

In `/Users/donggyunyang/code/steelart/steelart_dashboard/src/app/admin/users/[id]/page.tsx`, replace `UserProfile` with:

```ts
type UserProfile = {
  id: number;
  nickname: string;
  residency: "POHANG" | "NON_POHANG" | null;
  age_group: "TEEN" | "20S" | "30S" | "40S" | "50S" | "60S" | "70_PLUS" | null;
  language: "ko" | "en";
  notifications_enabled: number;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
};
```

Replace the residency and age map types:

```ts
const residencyLabelMap: Record<NonNullable<UserProfile["residency"]>, string> = {
  POHANG: "포항",
  NON_POHANG: "포항 외",
};

const ageGroupLabelMap: Record<NonNullable<UserProfile["age_group"]>, string> = {
  TEEN: "10대",
  "20S": "20대",
  "30S": "30대",
  "40S": "40대",
  "50S": "50대",
  "60S": "60대",
  "70_PLUS": "70대 이상",
};
```

Add helper functions below `formatDateTime`:

```ts
function formatResidency(value: UserProfile["residency"]) {
  return value ? residencyLabelMap[value] : "-";
}

function formatAgeGroup(value: UserProfile["age_group"]) {
  return value ? ageGroupLabelMap[value] : "-";
}

function formatUserStatus(user: Pick<UserProfile, "withdrawn_at">) {
  return user.withdrawn_at ? "탈퇴" : "활성";
}
```

- [ ] **Step 4: Add status to the detail page**

In the basic info `<dl>`, insert this block after nickname:

```tsx
          <div>
            <dt className="text-muted-foreground">상태</dt>
            <dd>{formatUserStatus(user)}</dd>
          </div>
```

Replace residency and age group display:

```tsx
            <dd>{formatResidency(user.residency)}</dd>
```

```tsx
            <dd>{formatAgeGroup(user.age_group)}</dd>
```

Insert withdrawal timestamp after 가입 일시:

```tsx
          <div>
            <dt className="text-muted-foreground">탈퇴 일시</dt>
            <dd>{user.withdrawn_at ? formatDateTime(user.withdrawn_at) : "-"}</dd>
          </div>
```

- [ ] **Step 5: Run dashboard build**

Run:

```bash
cd /Users/donggyunyang/code/steelart/steelart_dashboard
pnpm build
```

Expected: PASS.

- [ ] **Step 6: Commit dashboard status display**

```bash
cd /Users/donggyunyang/code/steelart/steelart_dashboard
git add src/app/api/admin/users/route.ts 'src/app/api/admin/users/[id]/route.ts' src/app/admin/users/page.tsx 'src/app/admin/users/[id]/page.tsx'
git commit -m "feat: show withdrawn users in admin"
```

---

### Task 9: End-To-End Verification

**Files:**
- Verify: `/Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md`
- Verify: `/Users/donggyunyang/code/steelart/STEELART_DB_TABLES.md`
- Verify: `/Users/donggyunyang/code/steelart/steelart_server/src/lambdas/users/handler.ts`
- Verify: `/Users/donggyunyang/code/steelart/steelart_app/src/features/mypage/screens/WithdrawScreen.tsx`
- Verify: `/Users/donggyunyang/code/steelart/steelart_dashboard/src/app/admin/users/page.tsx`

- [ ] **Step 1: Run server checks**

```bash
cd /Users/donggyunyang/code/steelart/steelart_server
pnpm typecheck
pnpm test
pnpm test:integration tests/integration/users/users-handler.integration.test.ts
```

Expected:
- `pnpm typecheck`: PASS
- `pnpm test`: PASS
- integration test: PASS when DB env vars and `users.withdrawn_at` exist, or SKIP with `integration DB 설정이 없어 건너뜁니다` when env vars are absent.

- [ ] **Step 2: Run app checks**

```bash
cd /Users/donggyunyang/code/steelart/steelart_app
pnpm test tests/api/auth-user-settings.test.ts tests/features/mypage/screens/withdraw-screen.test.tsx
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Run dashboard checks**

```bash
cd /Users/donggyunyang/code/steelart/steelart_dashboard
pnpm build
```

Expected: PASS.

- [ ] **Step 4: Verify contract strings**

```bash
rg -n "DELETE /v1/users/me|withdrawn|회원 탈퇴|탈퇴 사용자|unknown" /Users/donggyunyang/code/steelart/STEELART_SERVER_API_DRAFT.md /Users/donggyunyang/code/steelart/STEELART_DB_TABLES.md /Users/donggyunyang/code/steelart/CONTEXT.md /Users/donggyunyang/code/steelart/steelart_server/src /Users/donggyunyang/code/steelart/steelart_app/src /Users/donggyunyang/code/steelart/steelart_dashboard/src
```

Expected:
- API draft contains `DELETE /v1/users/me`.
- DB reference contains `withdrawn_at`.
- Server repository contains `nickname = ?` with `'unknown'`.
- App `WithdrawScreen` calls `withdrawAccount`.
- Dashboard user list/detail include `withdrawn_at`.

- [ ] **Step 5: Manual API smoke test**

After deploying or running the server against a DB that has `users.withdrawn_at`, call:

```bash
curl -i \
  -X DELETE \
  -H "Authorization: Bearer $STEELART_ACCESS_TOKEN" \
  "$STEELART_API_BASE_URL/v1/users/me"
```

Expected response:

```http
HTTP/2 200
```

Expected body:

```json
{
  "data": {
    "withdrawn": true
  },
  "meta": {
    "requestId": "..."
  },
  "error": null
}
```

- [ ] **Step 6: Commit final verification notes if any docs changed**

If verification updates only documentation, commit the changed docs:

```bash
cd /Users/donggyunyang/code/steelart
git status --short
git add STEELART_SERVER_API_DRAFT.md STEELART_DB_TABLES.md CONTEXT.md
git commit -m "docs: align withdrawal verification notes"
```

If `git status --short` shows no documentation changes, do not create an empty commit.

---

## Self-Review

### Spec Coverage

- Existing API absence is addressed by adding `DELETE /v1/users/me` to the root API draft and server handler.
- Hard delete is avoided by the repository transaction that updates `users` and leaves user row/activity data intact.
- `nickname = unknown`, nullable residency/age group, disabled notifications, and language reset are covered in Task 3 integration assertions.
- Refresh token revoke and social provider deletion are covered in Task 3 integration assertions.
- Same social account signup as a new user is enabled by deleting `user_auth_providers`; the integration test verifies provider rows are removed.
- Dashboard visibility is covered by Tasks 7 and 8.
- App CTA replacement is covered by Tasks 5 and 6.
- Access token grace policy is documented in ADR `0001-withdrawal-access-token-grace.md`.

### Placeholder Scan

The plan contains concrete file paths, code snippets, commands, expected failures, and expected passes. It does not rely on open-ended implementation instructions.

### Type Consistency

- Server response type is `WithdrawAccountResponse`.
- Server service method is `withdrawAccount(userId)`.
- Server repository method is `withdrawAccount(userId)`.
- App API function is `withdrawAccount()`.
- API response field is consistently `withdrawn: true`.
- Dashboard status field is consistently `withdrawn_at`.

---

Plan complete and saved to `docs/superpowers/plans/2026-06-14-member-withdrawal-api.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
