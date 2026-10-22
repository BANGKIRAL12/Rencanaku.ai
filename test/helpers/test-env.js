import { vi } from 'vitest';
import { testEnv } from './test-env-values.js';

/**
 * Environment minimal untuk pengujian. Nilai secret di sini adalah
 * nilai sintetis khusus tes, bukan rahasia nyata.
 *
 * Env yang sama sudah dipasang oleh `vitest.config.js` SEBELUM modul
 * apa pun diimpor, sehingga modul yang membaca konfigurasi saat import
 * (mis. `src/config/env.js`, logger, dan lapisan database) tidak pernah
 * memanggil `process.exit` di dalam worker tes. Helper ini tetap
 * diperlukan untuk override spesifik per tes.
 */
export { testEnv };

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