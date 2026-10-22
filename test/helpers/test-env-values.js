/**
 * Environment sintetis untuk pengujian.
 *
 * File ini SENGAJA tidak mengimpor `vitest` agar bisa dipakai oleh
 * `vitest.config.js` (konfigurasi runner) sekaligus oleh test helper.
 * Nilai `SESSION_SECRET`/`CSRF_SECRET` di sini adalah nilai sintetis
 * khusus pengujian, bukan rahasia nyata.
 */
export const testEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  HOST: '127.0.0.1',
  BASE_URL: 'http://127.0.0.1:3000/',
  SESSION_SECRET: 'test-session-secret-value-000000000000',
  CSRF_SECRET: 'test-csrf-secret-value-00000000000000',
  LOG_LEVEL: 'error',
  DATA_DIR: 'data',
  DATABASE_URL: 'file::memory:',
  FILE_STORAGE_PATH: 'files',
  SQLITE_JOURNAL_MODE: 'wal',
  SQLITE_BUSY_TIMEOUT_MS: '5000',
  RATE_LIMIT_WINDOW_MS: '900000',
  RATE_LIMIT_MAX_REQUESTS: '100',
};