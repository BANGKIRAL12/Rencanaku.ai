import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { loadApp } from '../helpers/test-env.js';

describe('Aplikasi Express', () => {
  let app;
  let config;

  beforeAll(async () => {
    ({ app, config } = await loadApp());
  });

  describe('Konfigurasi', () => {
    it('memakai konfigurasi env tes dan PORT bertipe number', () => {
      expect(config.NODE_ENV).toBe('test');
      expect(typeof config.PORT).toBe('number');
      expect(typeof config.RATE_LIMIT_MAX_REQUESTS).toBe('number');
    });
  });

  describe('Health endpoint', () => {
    it('GET /health/live mengembalikan 200', async () => {
      const res = await request(app).get('/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('alive');
      expect(typeof res.body.uptime).toBe('number');
      expect(typeof res.body.timestamp).toBe('string');
    });

    it('GET /health/ready mengembalikan 200', async () => {
      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
    });

    it('menyertakan header X-Request-Id', async () => {
      const res = await request(app).get('/health/live');
      expect(res.headers['x-request-id']).toMatch(/[A-Za-z0-9._:-]{1,128}/);
    });
  });

  describe('Halaman beranda', () => {
    it('GET / merender halaman dengan tautan CSS dan JS', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Rencanaku.ai');
      expect(res.text).toContain('href="/assets/app.css"');
      expect(res.text).toContain('src="/assets/js/main.js"');
      // Header tidak boleh terduplikasi karena layout dipakai satu kali.
      expect(res.text.match(/<header/g) || []).toHaveLength(1);
    });
  });

  describe('Aset statis', () => {
    it('GET /assets/app.css mengembalikan 200', async () => {
      const res = await request(app).get('/assets/app.css');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/css/);
    });

    it('GET /assets/js/main.js mengembalikan 200', async () => {
      const res = await request(app).get('/assets/js/main.js');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/javascript/);
    });
  });

  describe('404', () => {
    it('merender halaman 404 HTML kustom, bukan "Cannot GET"', async () => {
      const res = await request(app).get('/nope').set('Accept', 'text/html');
      expect(res.status).toBe(404);
      expect(res.text).toContain('Halaman Tidak Ditemukan');
      expect(res.text).toContain('404');
      expect(res.text).not.toContain('Cannot GET');
    });

    it('mengembalikan JSON 404 untuk Accept: application/json', async () => {
      const res = await request(app)
        .get('/nope')
        .set('Accept', 'application/json');
      expect(res.status).toBe(404);
      expect(res.body.error.status).toBe(404);
      expect(res.body.error.message).toBe('Sumber daya tidak ditemukan.');
      expect(res.body.error.requestId).toBeTruthy();
    });
  });

  describe('Error handler 500', () => {
    let errorApp;

    beforeAll(async () => {
      ({ app: errorApp } = await loadApp({}, {
        extraRoutes: (app) => {
          app.get('/boom', () => {
            throw new Error('rahasia-internal-jangan-bocor');
          });
        },
      }));
    });

    it('merender halaman 500 HTML tanpa stack trace', async () => {
      const res = await request(errorApp).get('/boom').set('Accept', 'text/html');
      expect(res.status).toBe(500);
      expect(res.text).toContain('Terjadi Kesalahan pada Server');
      expect(res.text).not.toContain('rahasia-internal-jangan-bocor');
      expect(res.text).not.toMatch(/\bat .*\.js:\d+:\d+/);
      expect(res.text).not.toContain('Error:');
    });

    it('mengembalikan JSON 500 tanpa detail internal', async () => {
      const res = await request(errorApp)
        .get('/boom')
        .set('Accept', 'application/json');
      expect(res.status).toBe(500);
      expect(res.body.error.status).toBe(500);
      expect(res.body.error.message).toBe('Terjadi kesalahan pada server.');
      expect(JSON.stringify(res.body)).not.toContain(
        'rahasia-internal-jangan-bocor',
      );
    });
  });
});
