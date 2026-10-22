import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { loadApp, testEnv } from '../helpers/test-env.js';
import { createTestWorkspace } from '../helpers/data.js';
import { PUBLIC_ROOT } from '../../src/config/paths.js';

/**
 * Tes isolasi aset publik.
 *
 * Data privat (SQLite, file pengguna, backup, log) tidak boleh dapat diunduh
 * lewat HTTP. Express hanya menyajikan `public/assets`; tes ini membuktikan
 * batas itu benar-benar berlaku, bukan hanya niat di dokumentasi.
 */
describe('Isolasi aset publik', () => {
  /** @type {ReturnType<typeof createTestWorkspace>} */
  let workspace;
  let app;
  let dataFile;

  beforeAll(async () => {
    workspace = createTestWorkspace();

    // File "rahasia" di dalam direktori data, meniru file pengguna.
    dataFile = path.join(workspace.paths.directories.files, 'rahasia-pengguna.txt');
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, 'isi yang tidak boleh terunduh lewat HTTP');

    ({ app } = await loadApp({ DATA_DIR: workspace.dataDir }));
  });

  afterAll(() => workspace.cleanup());

  describe('Aset yang diizinkan', () => {
    it('menyajikan CSS hasil build', async () => {
      const res = await request(app).get('/assets/app.css');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/css/);
    });

    it('menyajikan JavaScript aplikasi', async () => {
      const res = await request(app).get('/assets/js/main.js');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/javascript/);
    });
  });

  describe('Data privat tidak tersedia lewat HTTP', () => {
    const paths = [
      '/rahasia-pengguna.txt',
      '/data/rahasia-pengguna.txt',
      '/files/rahasia-pengguna.txt',
      `/assets/rahasia-pengguna.txt`,
      '/assets/../rahasia-pengguna.txt',
      '/assets/../../data/files/rahasia-pengguna.txt',
      '/assets/%2e%2e/%2e%2e/data/files/rahasia-pengguna.txt',
      '/assets/..%2f..%2fdata%2ffiles%2frahasia-pengguna.txt',
    ];

    for (const url of paths) {
      it(`menolak ${url}`, async () => {
        const res = await request(app).get(url);
        expect(res.status).not.toBe(200);
        expect(res.text ?? '').not.toContain('tidak boleh terunduh');
      });
    }

    it('tidak menyajikan file database', async () => {
      const res = await request(app).get('/app.sqlite');
      expect(res.status).not.toBe(200);
      expect(res.text ?? '').not.toContain('SQLite format');
    });
  });

  describe('Konfigurasi berbahaya ditolak saat boot', () => {
    it('menolak DATA_DIR di dalam public/', async () => {
      await expect(
        loadApp({ DATA_DIR: path.join(PUBLIC_ROOT, 'data') }),
      ).rejects.toThrow(/root statis publik/);
    });

    it('menolak FILE_STORAGE_PATH absolut di dalam public/', async () => {
      const workspaceLain = createTestWorkspace();
      try {
        await expect(
          loadApp({
            DATA_DIR: workspaceLain.dataDir,
            FILE_STORAGE_PATH: path.join(PUBLIC_ROOT, 'assets', 'files'),
          }),
        ).rejects.toThrow(/root statis publik/);
      } finally {
        workspaceLain.cleanup();
      }
    });

    it('menolak direktori data yang saling bersarang', async () => {
      const workspaceLain = createTestWorkspace();
      try {
        await expect(
          loadApp({
            DATA_DIR: workspaceLain.dataDir,
            FILE_STORAGE_PATH: path.join(workspaceLain.dataDir, 'backups', 'files'),
          }),
        ).rejects.toThrow(/tidak boleh bersarang/);
      } finally {
        workspaceLain.cleanup();
      }
    });

    it('menerima konfigurasi data di luar public/', async () => {
      const workspaceLain = createTestWorkspace();
      try {
        const hasil = await loadApp({ DATA_DIR: workspaceLain.dataDir });
        expect(hasil.app).toBeDefined();
        expect(workspaceLain.dataDir.startsWith(PUBLIC_ROOT)).toBe(false);
      } finally {
        workspaceLain.cleanup();
      }
    });
  });

  describe('Konfigurasi tes', () => {
    it('tidak bergantung pada .env pengembang', async () => {
      expect(testEnv.NODE_ENV).toBe('test');
      expect(process.env.NODE_ENV).toBe('test');
    });
  });
});
