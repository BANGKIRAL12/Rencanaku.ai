import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runInTransaction } from './transaction.js';

/**
 * Migration runner.
 *
 * Kebijakan (ARCHITECTURE §7.2 dan implementation_plan.md §7):
 * - Sumber kebenaran skema adalah berkas `.sql` immutable di
 *   `src/db/migrations/`, diurutkan berdasarkan nama.
 * - Setiap migrasi berjalan dalam satu transaksi: bila SQL di tengah file
 *   gagal, tidak ada perubahan yang tertinggal dan `schema_migrations`
 *   tidak berisi baris untuk migrasi tersebut.
 * - Tiap migrasi yang sudah diterapkan diverifikasi lewat checksum SHA-256.
 *   Perubahan isi file setelah rilis dianggap kesalahan, bukan diperbaiki
 *   diam-diam.
 * - Tidak ada migrasi "down"/rollback otomatis. Pemulihan dilakukan dengan
 *   restore backup (Fase 9); transaksi yang gagal sudah otomatis rollback.
 *
 * Migrasi pada fase ini:
 * @typedef {import('better-sqlite3').Database} SqliteDatabase
 */

const MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
);

/** Pola nama file migrasi: `NNN_nama_snake_case.sql`. */
const MIGRATION_FILE_PATTERN = /^(\d{3})_[a-z0-9_]+\.sql$/;

export class MigrationError extends Error {
  /**
   * @param {string} message Pesan aman untuk log/CLI.
   * @param {{cause?: unknown, code?: string}} [options]
   */
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'MigrationError';
    this.code = options.code ?? 'MIGRATION_FAILED';
  }
}

export class MigrationChecksumError extends MigrationError {
  /**
   * @param {string} migrationId
   */
  constructor(migrationId) {
    super(
      `Isi migrasi "${migrationId}" berbeda dari versi yang sudah diterapkan. Migrasi bersifat immutable setelah rilis; buat migrasi baru alih-alih mengubahnya.`,
      { code: 'MIGRATION_CHECKSUM_MISMATCH' },
    );
    this.migrationId = migrationId;
  }
}

/**
 * @typedef {object} Migration
 * @property {string} id Nama file migrasi tanpa ekstensi.
 * @property {string} file Nama file lengkap.
 * @property {string} absolutePath
 * @property {string} sql Isi file.
 * @property {string} checksum SHA-256 isi file.
 */

/**
 * Baca dan validasi seluruh berkas migrasi pada direktori tertentu.
 *
 * @param {string} [dir]
 * @returns {Migration[]} Migrasi terurut menaik berdasarkan id.
 */
export function loadMigrations(dir = MIGRATIONS_DIR) {
  if (!fs.existsSync(dir)) {
    throw new MigrationError(`Direktori migrasi tidak ditemukan: ${dir}`, {
      code: 'MIGRATIONS_DIR_MISSING',
    });
  }

  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  /** @type {Map<string, string>} */
  const seenNumbers = new Map();
  const migrations = [];

  for (const file of files) {
    const match = MIGRATION_FILE_PATTERN.exec(file);
    if (!match) {
      throw new MigrationError(
        `Nama file migrasi tidak valid: "${file}". Gunakan format NNN_nama_snake_case.sql`,
        { code: 'MIGRATION_NAME_INVALID' },
      );
    }

    const number = match[1];
    if (seenNumbers.has(number)) {
      throw new MigrationError(
        `Nomor migrasi ${number} dipakai ganda oleh "${seenNumbers.get(number)}" dan "${file}".`,
        { code: 'MIGRATION_NUMBER_DUPLICATE' },
      );
    }
    seenNumbers.set(number, file);

    const absolutePath = path.join(dir, file);
    const sql = fs.readFileSync(absolutePath, 'utf8');
    migrations.push({
      id: file.replace(/\.sql$/, ''),
      file,
      absolutePath,
      sql,
      checksum: createHash('sha256').update(sql).digest('hex'),
    });
  }

  return migrations;
}

/**
 * Pastikan tabel `schema_migrations` ada.
 * Tabel dibuat runner (bukan migrasi) agar tetap ada walau belum ada
 * migrasi yang diterapkan.
 *
 * @param {SqliteDatabase} db
 */
export function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id            TEXT PRIMARY KEY,
      checksum      TEXT NOT NULL,
      applied_at    TEXT NOT NULL,
      execution_ms  INTEGER NOT NULL,
      app_version   TEXT
    )
  `);
}

/**
 * Daftar migrasi yang sudah diterapkan.
 *
 * @param {SqliteDatabase} db
 * @returns {Array<{id: string, checksum: string, applied_at: string, execution_ms: number, app_version: string | null}>}
 */
export function listAppliedMigrations(db) {
  ensureMigrationsTable(db);
  return db
    .prepare(
      `SELECT id, checksum, applied_at, execution_ms, app_version
         FROM schema_migrations
        ORDER BY id ASC`,
    )
    .all();
}

/**
 * Verifikasi checksum migrasi yang sudah diterapkan.
 *
 * @param {SqliteDatabase} db
 * @param {Migration[]} [migrations]
 * @throws {MigrationChecksumError} bila ada file yang berubah atau hilang.
 */
export function verifyAppliedMigrations(db, migrations = loadMigrations()) {
  const byId = new Map(migrations.map((m) => [m.id, m]));
  const applied = listAppliedMigrations(db);

  for (const record of applied) {
    const migration = byId.get(record.id);
    if (!migration) {
      throw new MigrationError(
        `Migrasi "${record.id}" sudah diterapkan tetapi berkas migrasinya tidak ditemukan. Jangan menghapus berkas migrasi yang pernah dirilis.`,
        { code: 'MIGRATION_FILE_MISSING' },
      );
    }
    if (migration.checksum !== record.checksum) {
      throw new MigrationChecksumError(record.id);
    }
  }

  return applied;
}

/**
 * Status skema saat ini tanpa mengubah apa pun.
 *
 * @param {SqliteDatabase} db
 * @param {{migrationsDir?: string}} [options]
 * @returns {{pending: Migration[], applied: ReturnType<typeof listAppliedMigrations>, upToDate: boolean, currentVersion: string | null, latestVersion: string | null}}
 */
export function getMigrationStatus(db, options = {}) {
  const migrations = loadMigrations(options.migrationsDir ?? MIGRATIONS_DIR);
  const applied = listAppliedMigrations(db);
  const appliedIds = new Set(applied.map((row) => row.id));
  const pending = migrations.filter((m) => !appliedIds.has(m.id));

  return {
    pending,
    applied,
    upToDate: pending.length === 0,
    currentVersion: applied.at(-1)?.id ?? null,
    latestVersion: migrations.at(-1)?.id ?? null,
  };
}

/**
 * Jalankan seluruh migrasi yang belum diterapkan.
 *
 * @param {SqliteDatabase} db
 * @param {{migrationsDir?: string, upTo?: string, appVersion?: string, now?: () => string}} [options]
 *   `upTo` membatasi migrasi yang dijalankan (dipakai tes upgrade bertahap).
 * @returns {{applied: string[], skipped: string[], total: number}}
 */
export function runMigrations(db, options = {}) {
  const migrationsDir = options.migrationsDir ?? MIGRATIONS_DIR;
  const now = options.now ?? (() => new Date().toISOString());
  const migrations = loadMigrations(migrationsDir);

  ensureMigrationsTable(db);
  verifyAppliedMigrations(db, migrations);

  let candidates = migrations;
  if (options.upTo) {
    const index = migrations.findIndex((m) => m.id === options.upTo);
    if (index === -1) {
      throw new MigrationError(
        `Migrasi tujuan "${options.upTo}" tidak ditemukan pada ${migrationsDir}.`,
        { code: 'MIGRATION_TARGET_MISSING' },
      );
    }
    candidates = migrations.slice(0, index + 1);
  }

  const appliedIds = new Set(listAppliedMigrations(db).map((row) => row.id));
  const insertRecord = db.prepare(
    `INSERT INTO schema_migrations (id, checksum, applied_at, execution_ms, app_version)
     VALUES (@id, @checksum, @applied_at, @execution_ms, @app_version)`,
  );

  const applied = [];
  const skipped = [];

  for (const migration of candidates) {
    if (appliedIds.has(migration.id)) {
      skipped.push(migration.id);
      continue;
    }

    const startedAt = process.hrtime.bigint();
    try {
      runInTransaction(db, () => {
        db.exec(migration.sql);
        const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        insertRecord.run({
          id: migration.id,
          checksum: migration.checksum,
          applied_at: now(),
          execution_ms: Math.round(elapsedMs),
          app_version: options.appVersion ?? null,
        });
      });
      applied.push(migration.id);
    } catch (cause) {
      throw new MigrationError(
        `Migrasi "${migration.id}" gagal dan seluruh perubahan dibatalkan. Periksa berkas migrasi lalu jalankan ulang.`,
        { cause, code: 'MIGRATION_APPLY_FAILED' },
      );
    }
  }

  return { applied, skipped, total: candidates.length };
}

export { MIGRATIONS_DIR };