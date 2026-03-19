import assert from 'node:assert/strict';
import test from 'node:test';

import { serializeErrorForLog } from '../../src/shared/api/errors.js';

// 원본 Error는 message, name, stack과 cause까지 로그용 객체로 직렬화되어야 한다.
test('serializeErrorForLog serializes nested error causes', () => {
  const rootCause = new Error('root cause');
  const error = new Error('top level', {
    cause: rootCause,
  });

  const serialized = serializeErrorForLog(error);

  assert.deepEqual(serialized, {
    cause: {
      message: 'root cause',
      name: 'Error',
      stack: rootCause.stack,
    },
    message: 'top level',
    name: 'Error',
    stack: error.stack,
  });
});

// Error가 아닌 값은 가공하지 않고 그대로 로그 payload로 넘겨야 한다.
test('serializeErrorForLog returns non-error values as-is', () => {
  const value = {
    code: 'unexpected',
  };

  assert.equal(serializeErrorForLog(value), value);
});
