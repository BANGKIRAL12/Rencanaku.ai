#!/usr/bin/env node

import { createApp } from './app.js';
import { config } from './config/env.js';
import { logger } from './core/logger/index.js';
import { closeDatabase, initDatabase } from './db/connection.js';
import { getMigrationStatus, verifyAppliedMigrations } from './db/migrate.js';

/**
 * Buka database dan pastikan skema sudah mutakhir.
 *
 * Server sengaja TIDAK menjalankan migrasi otomatis: perubahan skema harus
 * menjadi keputusan operator (`npm run db:migrate`). Bila skema tertinggal
 * atau berkas migrasi yang sudah dirilis berubah, server berhenti sebelum
 * menerima permintaan agar tidak berjalan di atas skema yang salah.
 *
 * @returns {import('better-sqlite3').Database}
 */
function openDatabaseForServer() {
  let db;
  try {
    db = initDatabase(config);
    verifyAppliedMigrations(db);

    const status = getMigrationStatus(db);
    if (!status.upToDate) {
      logger.error(
        'Skema database belum mutakhir. Jalankan "npm run db:migrate" sebelum memulai server.',
        {
          currentVersion: status.currentVersion,
          latestVersion: status.latestVersion,
          pending: status.pending.map((migration) => migration.id),
        },
      );
      closeDatabase();
      process.exit(1);
    }

    logger.info('Database siap', {
      schemaVersion: status.currentVersion,
      journalMode: db.pragma('journal_mode', { simple: true }),
    });
    return db;
  } catch (error) {
    logger.error('Gagal menyiapkan database', {
      message: error?.message,
      code: error?.code,
    });
    if (db?.open) closeDatabase();
    process.exit(1);
  }
}

openDatabaseForServer();

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

    // Checkpoint WAL lalu tutup koneksi agar berkas -wal tidak tertinggal.
    try {
      closeDatabase();
    } catch (error) {
      logger.error('Gagal menutup database', { message: error?.message });
      process.exit(1);
    }

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
  try {
    closeDatabase();
  } catch {
    // Koneksi mungkin memang belum terbuka.
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', {
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  process.exit(1);
});
