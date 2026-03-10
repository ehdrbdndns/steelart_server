import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../src/shared/api/errors.js';
import { fail, ok } from '../../src/shared/api/response.js';

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
