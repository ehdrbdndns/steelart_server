import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../src/shared/api/errors.js';
import { fail, ok } from '../../src/shared/api/response.js';

// 성공 응답은 공통 envelope 형식으로 감싸져야 한다.
test('ok returns the shared success envelope', () => {
  const response = ok(
    {
      message: 'hello',
    },
    {
      requestId: 'request-1',
    },
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body as string), {
    data: {
      message: 'hello',
    },
    error: null,
    meta: {
      requestId: 'request-1',
    },
  });
});

// 실패 응답은 공통 error envelope 형식과 상태 코드를 유지해야 한다.
test('fail returns the shared error envelope', () => {
  const response = fail(
    new AppError('NOT_FOUND', {
      message: 'Artwork not found',
    }),
    {
      requestId: 'request-2',
    },
  );

  assert.equal(response.statusCode, 404);
  assert.deepEqual(JSON.parse(response.body as string), {
    data: null,
    error: {
      code: 'NOT_FOUND',
      message: 'Artwork not found',
    },
    meta: {
      requestId: 'request-2',
    },
  });
});
