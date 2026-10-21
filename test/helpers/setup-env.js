import { beforeAll, afterAll } from 'vitest';
import { applyTestEnv, resetTestEnv } from './test-env.js';

// Pastikan setiap berkas tes memakai env sintetis sendiri, bukan .env pengguna.
beforeAll(() => {
  applyTestEnv();
});

afterAll(() => {
  resetTestEnv();
});
