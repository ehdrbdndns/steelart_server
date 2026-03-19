import assert from 'node:assert/strict';
import test from 'node:test';

import { loadEnv } from '../../src/shared/env/server.js';
import { AppError } from '../../src/shared/api/errors.js';

// 환경 변수는 필요한 타입으로 파싱되고 강제 변환되어야 한다.
test('loadEnv parses and coerces environment variables', () => {
  const env = loadEnv({
    APP_ENV: 'local',
    APPLE_CLIENT_ID: 'apple-client',
    AWS_REGION: 'ap-northeast-2',
    DB_HOST: '127.0.0.1',
    DB_NAME: 'steelart',
    DB_PASSWORD: 'password',
    DB_PORT: '3306',
    DB_SSL_CA_PATH: '/var/runtime/ca-cert.pem',
    DB_USER: 'steelart',
    JWT_SECRET: 'secret',
    KAKAO_CLIENT_ID: 'kakao-client',
    LOG_LEVEL: 'debug',
  });

  assert.equal(env.DB_PORT, 3306);
  assert.equal(env.DB_SSL_CA_PATH, '/var/runtime/ca-cert.pem');
  assert.equal(env.LOG_LEVEL, 'debug');
});

// 필수 환경 변수가 없으면 AppError를 던져야 한다.
test('loadEnv throws AppError on missing required variables', () => {
  assert.throws(
    () =>
      loadEnv({
        APP_ENV: 'local',
      }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR',
  );
});
