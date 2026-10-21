import { vi } from 'vitest';

/**
 * Environment minimal untuk pengujian. Nilai secret di sini adalah
 * nilai sintetis khusus tes, bukan rahasia nyata.
 */
export const testEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  HOST: '127.0.0.1',
  BASE_URL: 'http://127.0.0.1:3000/',
  SESSION_SECRET: 'test-session-secret-value-000000000000',
  CSRF_SECRET: 'test-csrf-secret-value-00000000000000',
  LOG_LEVEL: 'error',
  DATABASE_URL: 'file::memory:',
  FILE_STORAGE_PATH: 'data/test-files',
  RATE_LIMIT_WINDOW_MS: '900000',
  RATE_LIMIT_MAX_REQUESTS: '100',
};

/**
 * Pasang env tes pada process.env. `src/config/env.js` tidak membaca
 * `.env` saat NODE_ENV=test, sehingga tes tidak bergantung pada file
 * konfigurasi pengguna.
 */
export function applyTestEnv(overrides = {}) {
  Object.assign(process.env, testEnv, overrides);
}

/** Hapus env tes setelah selesai. */
export function resetTestEnv() {
  for (const key of Object.keys(testEnv)) {
    delete process.env[key];
  }
}

/**
 * Buat modul app dengan env tes yang terisolasi.
 * Modul di-reset agar `config` dievaluasi ulang dengan env baru.
 * @param {Record<string, string>} [envOverrides]
 * @param {{extraRoutes?: (app: import('express').Application) => void}} [appOptions]
 */
export async function loadApp(envOverrides = {}, appOptions = {}) {
  applyTestEnv(envOverrides);
  vi.resetModules();
  const { createApp } = await import('../../src/app.js');
  const { config } = await import('../../src/config/env.js');
  return { app: createApp({ config, ...appOptions }), config };
}
