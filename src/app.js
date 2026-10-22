import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import ejs from 'ejs';
import { config as defaultConfig } from './config/env.js';
import { PUBLIC_ROOT, resolveDataPaths, assertDataPathsArePrivate } from './config/paths.js';
import { createErrorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { requestId } from './middleware/request-id.js';
import { healthRoutes } from './routes/health.js';
import { pageRoutes } from './routes/pages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Membuat instance Express app tanpa memanggil listen(), sehingga dapat
 * diuji dengan supertest.
 *
 * Fail-fast: konfigurasi path data diperiksa saat app dibuat. Bila
 * direktori privat berada di dalam root statis publik, proses berhenti
 * dengan pesan aman alih-alih Diam-diam menyajikan data pengguna lewat
 * `express.static` (ARCHITECTURE §4, §11.5).
 *
 * @param {{
 *   config?: import('./config/schema.js').AppConfig,
 *   extraRoutes?: (app: import('express').Application) => void,
 * }} [options] `extraRoutes` dipakai pengujian untuk mendaftarkan route
 *   sebelum handler 404/error (mis. route yang sengaja melempar error).
 * @returns {import('express').Application}
 */
export function createApp(options = {}) {
  const config = options.config ?? defaultConfig;

  // Resolusi murni (tanpa efek samping filesystem): hanya validasi lokasi.
  assertDataPathsArePrivate(resolveDataPaths(config));

  const app = express();

  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );

  // Batas ukuran body eksplisit.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.use(requestId);

  // EJS: view root adalah src/views agar partial/layout bisa di-include
  // dengan path relatif yang konsisten.
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.engine('ejs', ejs.__express);

  // Aset statis publik. Satu-satunya root yang disajikan ke browser;
  // direktori data privat tidak pernah dimount di sini (lihat ADR 0005).
  app.use('/assets', express.static(path.join(PUBLIC_ROOT, 'assets')));

  app.use('/health', healthRoutes);
  app.use('/', pageRoutes);

  if (typeof options.extraRoutes === 'function') {
    options.extraRoutes(app);
  }

  // 404 harus dipasang sebelum error handler.
  app.use(notFoundHandler);

  // Error handler terakhir.
  app.use(createErrorHandler({ config }));

  return app;
}
