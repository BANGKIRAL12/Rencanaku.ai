import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config as defaultConfig } from '../config/env.js';
import {
  assertDataPathsArePrivate,
  resolveDataPaths,
} from '../config/paths.js';
import { logger } from '../core/logger/index.js';

/**
 * Pembukaan koneksi SQLite.
 *
 * Invarian yang ditegakkan setiap koneksi (ARCHITECTURE §7.2, ADR 0004):
 * 1. `PRAGMA foreign_keys = ON` — wajib, karena SQLite mengabaikannya
 *    secara default dan nilainya tidak ikut tersimpan di file database.
 * 2. `PRAGMA busy_timeout` — agar penulisan tidak langsung gagal saat ada
 *    pembaca lain (mis. proses CLI `backup`).
 * 3. `PRAGMA journal_mode` — WAL secara default; dapat diubah operator
 *    melalui `SQLITE_JOURNAL_MODE` untuk filesystem jaringan.
 * 4. `PRAGMA synchronous = NORMAL` — cukup untuk WAL dan tetap crash-safe
 *    menurut jaminan SQLite (hanya commit terbaru yang bisa hilang pada
 *    power loss mendadak, konsistensi basis data tetap terjaga).
 *
 * Modul ini TIDAK menjalankan SQL tabel aplikasi. Satu-satunya SQL di sini
 * adalah PRAGMA koneksi dan pembuatan tabel `schema_migrations` yang
 * dilakukan oleh migration runner.
 */

/** Jumlah migrasi yang tersedia pada fase ini; dipakai sanity check DB kosong. */
export const SUPPORTED_SCHEMA_VERSION = 2;

/** @typedef {import('better-sqlite3').Database} SqliteDatabase */

/** @type {SqliteDatabase | null} */
let sharedDatabase = null;

export class DatabaseConnectionError extends Error {
  /**
   * @param {string} message Pesan aman untuk log/CLI (tanpa path absolut sensitif).
   * @param {{cause?: unknown, code?: string}} [options]
   */
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'DatabaseConnectionError';
    this.code = options.code ?? 'DB_CONNECTION_FAILED';
  }
}

/**
 * Terapkan PRAGMA wajib pada setiap koneksi.
 *
 * @param {SqliteDatabase} db
 * @param {{journalMode?: string, busyTimeoutMs?: number}} [options]
 * @returns {{journalMode: string, foreignKeys: boolean, busyTimeoutMs: number, synchronous: string}}
 */
export function applyConnectionPragmas(db, options = {}) {
  const requestedJournal = options.journalMode ?? 'wal';
  const busyTimeoutMs = Number.isInteger(options.busyTimeoutMs)
    ? options.busyTimeoutMs
    : 5000;

  db.pragma('foreign_keys = ON');
  db.pragma(`busy_timeout = ${busyTimeoutMs}`);

  // WAL tidak tersedia pada database in-memory; SQLite otomatis memakai
  // memory journal. Nilai aktual dibaca kembali setelah setter.
  const journalMode = String(db.pragma(`journal_mode = ${requestedJournal}`, {
    simple: true,
  })).toLowerCase();

  if (requestedJournal === 'wal' && !['wal', 'memory'].includes(journalMode)) {
    logger.warn(
      'Journal mode WAL tidak dapat diaktifkan pada filesystem ini; memakai mode alternatif.',
      { requested: requestedJournal, actual: journalMode },
    );
  }

  if (journalMode === 'wal') {
    db.pragma('synchronous = NORMAL');
  }
  db.pragma('temp_store = MEMORY');

  return {
    journalMode,
    foreignKeys: db.pragma('foreign_keys', { simple: true }) === 1,
    busyTimeoutMs: db.pragma('busy_timeout', { simple: true }),
    synchronous: String(db.pragma('synchronous', { simple: true })),
  };
}

/**
 * Buka koneksi SQLite baru yang sudah dikonfigurasi.
 * Tidak memakai cache global; pemanggil bertanggung jawab menutup koneksi.
 *
 * @param {{
 *   databasePath: string,
 *   journalMode?: string,
 *   busyTimeoutMs?: number,
 *   readonly?: boolean,
 *   createParentDirs?: boolean,
 * }} options
 * @returns {SqliteDatabase}
 */
export function openDatabase(options) {
  const { databasePath, readonly = false, createParentDirs = true } = options ?? {};

  if (!databasePath) {
    throw new DatabaseConnectionError('Lokasi database tidak boleh kosong.', {
      code: 'DB_PATH_MISSING',
    });
  }

  const isMemory = databasePath === ':memory:';

  if (!isMemory && createParentDirs && !readonly) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true, mode: 0o700 });
  }

  let db;
  try {
    db = new Database(databasePath, { readonly, fileMustExist: readonly });
  } catch (cause) {
    throw new DatabaseConnectionError(
      `Gagal membuka database pada lokasi yang dikonfigurasi (${isMemory ? 'in-memory' : 'file'}).`,
      { cause, code: 'DB_OPEN_FAILED' },
    );
  }

  try {
    applyConnectionPragmas(db, options);
  } catch (cause) {
    db.close();
    throw new DatabaseConnectionError(
      'Gagal menerapkan pengaturan koneksi database.',
      { cause, code: 'DB_PRAGMA_FAILED' },
    );
  }

  return db;
}

/**
 * Buka koneksi berdasarkan konfigurasi aplikasi yang sudah divalidasi.
 * Path data diverifikasi agar tidak berada di dalam root statis publik.
 *
 * @param {import('../config/schema.js').AppConfig} [config]
 * @param {{cwd?: string, repoRoot?: string}} [options]
 * @returns {SqliteDatabase}
 */
export function openConfiguredDatabase(config = defaultConfig, options = {}) {
  const paths = assertDataPathsArePrivate(
    resolveDataPaths(config, { cwd: options.cwd ?? process.cwd(), repoRoot: options.repoRoot }),
  );

  return openDatabase({
    databasePath: paths.database.path,
    journalMode: config.SQLITE_JOURNAL_MODE,
    busyTimeoutMs: config.SQLITE_BUSY_TIMEOUT_MS,
  });
}

/**
 * Koneksi bersama untuk satu proses. Dibuat sekali lalu dipakai CLI dan
 * HTTP agar hanya ada satu penulis SQLite.
 *
 * @param {import('../config/schema.js').AppConfig} [config]
 * @returns {SqliteDatabase}
 */
export function initDatabase(config = defaultConfig) {
  if (sharedDatabase && sharedDatabase.open) return sharedDatabase;
  sharedDatabase = openConfiguredDatabase(config);
  return sharedDatabase;
}

/**
 * Ambil koneksi bersama. Melempar error bila belum diinisialisasi agar
 * tidak ada kode yang diam-diam membuka koneksi baru.
 *
 * @returns {SqliteDatabase}
 */
export function getDatabase() {
  if (!sharedDatabase || !sharedDatabase.open) {
    throw new DatabaseConnectionError(
      'Koneksi database belum diinisialisasi. Panggil initDatabase() lebih dulu.',
      { code: 'DB_NOT_INITIALIZED' },
    );
  }
  return sharedDatabase;
}

/**
 * @returns {boolean} true bila koneksi bersama tersedia dan masih terbuka.
 */
export function hasDatabase() {
  return Boolean(sharedDatabase && sharedDatabase.open);
}

/** Tutup koneksi bersama bila ada (aman dipanggil berkali-kali). */
export function closeDatabase() {
  if (sharedDatabase && sharedDatabase.open) {
    try {
      // Pastikan WAL di-flush agar file .sqlite/-wal tetap konsisten.
      sharedDatabase.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // Checkpoint hanya optimasi; kegagalan tidak menghalangi penutupan.
    }
    sharedDatabase.close();
  }
  sharedDatabase = null;
}

/**
 * Buat snapshot status koneksi untuk diagnostik/health.
 * Tidak memuat path absolut maupun nilai rahasia.
 *
 * @param {SqliteDatabase} db
 * @returns {{open: boolean, journalMode: string, foreignKeys: boolean, busyTimeoutMs: number, sqliteVersion: string}}
 */
export function describeConnection(db) {
  return {
    open: Boolean(db.open),
    journalMode: String(db.pragma('journal_mode', { simple: true })).toLowerCase(),
    foreignKeys: db.pragma('foreign_keys', { simple: true }) === 1,
    busyTimeoutMs: Number(db.pragma('busy_timeout', { simple: true })),
    sqliteVersion: db.prepare('select sqlite_version() as v').get().v,
  };
}