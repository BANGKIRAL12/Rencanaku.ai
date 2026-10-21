#!/usr/bin/env node

import { createApp } from './app.js';
import { config } from './config/env.js';
import { logger } from './core/logger/index.js';

const app = createApp();

const server = app.listen(config.PORT, config.HOST, () => {
  logger.info(`Server berjalan di http://${config.HOST}:${config.PORT}`, {
    environment: config.NODE_ENV,
  });
});

let shuttingDown = false;

/**
 * Tutup server dengan rapi.
 * @param {string} signal
 */
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`Menerima sinyal ${signal}, menutup server...`);

  const forceExit = setTimeout(() => {
    logger.error('Timeout saat menutup server, keluar paksa.');
    process.exit(1);
  }, 5000);
  forceExit.unref();

  server.close((closeErr) => {
    clearTimeout(forceExit);
    if (closeErr) {
      logger.error('Gagal menutup server', { message: closeErr.message });
      process.exit(1);
    }
    logger.info('Server ditutup dengan sukses');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handler proses level aplikasi: hanya dipasang di entry point,
// bukan di createApp() agar tidak terdaftar berulang saat pengujian.
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { message: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', {
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  process.exit(1);
});
