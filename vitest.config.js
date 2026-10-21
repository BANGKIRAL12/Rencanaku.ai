import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    setupFiles: ['test/helpers/setup-env.js'],
    // Env tes eksplisit; src/config/env.js tidak membaca .env saat mode test.
    env: {
      NODE_ENV: 'test',
    },
    restoreMocks: true,
  },
});
