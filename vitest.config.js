import { defineConfig } from 'vitest/config';
import { testEnv } from './test/helpers/test-env-values.js';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    setupFiles: ['test/helpers/setup-env.js'],
    // Env tes eksplisit; src/config/env.js tidak membaca .env saat mode test.
    // Dipasang di sini (bukan hanya di beforeAll) karena beberapa modul
    // memvalidasi konfigurasi saat diimpor.
    env: { ...testEnv },
    restoreMocks: true,
  },
});