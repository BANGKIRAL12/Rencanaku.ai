import { randomUUID } from 'node:crypto';

/**
 * Utilitas bersama repository.
 *
 * Aturan keras (ARCHITECTURE §5.1):
 * - Hanya berkas di `src/db/repositories/` yang menyusun SQL.
 * - Semua query memakai prepared statement; nilai input tidak pernah
 *   dirangkai ke string SQL.
 * - Repository tidak tahu tentang Express/HTTP maupun template view.
 */

/** @typedef {import('better-sqlite3').Database} SqliteDatabase */

/** Kode error SQLite yang sering ditangani aplikasi. */
export const SQLITE_ERROR_CODES = Object.freeze({
  CONSTRAINT_UNIQUE: 'SQLITE_CONSTRAINT_UNIQUE',
  CONSTRAINT_FOREIGNKEY: 'SQLITE_CONSTRAINT_FOREIGNKEY',
  CONSTRAINT_CHECK: 'SQLITE_CONSTRAINT_CHECK',
  CONSTRAINT_NOTNULL: 'SQLITE_CONSTRAINT_NOTNULL',
  BUSY: 'SQLITE_BUSY',
  READONLY: 'SQLITE_READONLY',
});

export class RepositoryError extends Error {
  /**
   * @param {string} message Pesan aman untuk log dan pesan pengguna.
   * @param {{code?: string, cause?: unknown, status?: number, details?: unknown}} [options]
   */
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'RepositoryError';
    this.code = options.code ?? 'DB_ERROR';
    this.status = options.status ?? 500;
    this.details = options.details ?? null;
  }
}

/**
 * Ubah error better-sqlite3 menjadi RepositoryError yang stabil.
 * Pesan asli SQLite tetap tersedia pada `cause` untuk log diagnostik.
 *
 * @param {unknown} cause
 * @param {string} [message]
 * @returns {RepositoryError}
 */
export function wrapDbError(cause, message = 'Operasi basis data gagal.') {
  const rawCode =
    cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : 'UNKNOWN';
  const rawMessage =
    cause && typeof cause === 'object' && 'message' in cause ? String(cause.message) : '';

  // SQLite memakai kode berbeda tergantung jalur yang memicu kegagalan:
  // mis. pelanggaran foreign key akibat RESTRICT dilaporkan sebagai
  // SQLITE_CONSTRAINT_TRIGGER dengan pesan standar. Pesan SQLite dipakai
  // sebagai sinyal utama, kode sebagai cadangan.
  const CONSTRAINT_SIGNALS = [
    [/FOREIGN KEY constraint failed/i, 'SQLITE_CONSTRAINT_FOREIGNKEY'],
    [/UNIQUE constraint failed/i, 'SQLITE_CONSTRAINT_UNIQUE'],
    [/CHECK constraint failed/i, 'SQLITE_CONSTRAINT_CHECK'],
    [/NOT NULL constraint failed/i, 'SQLITE_CONSTRAINT_NOTNULL'],
    [/constraint failed/i, 'SQLITE_CONSTRAINT'],
  ];

  const code =
    CONSTRAINT_SIGNALS.find(([pattern]) => pattern.test(rawMessage))?.[1] ?? rawCode;

  const mapping = {
    SQLITE_CONSTRAINT_UNIQUE: { status: 409, message: 'Data sudah ada (duplikat).' },
    SQLITE_CONSTRAINT_FOREIGNKEY: {
      status: 409,
      message: 'Data masih terkait dengan data lain.',
    },
    SQLITE_CONSTRAINT_CHECK: { status: 400, message: 'Nilai data tidak valid.' },
    SQLITE_CONSTRAINT_NOTNULL: { status: 400, message: 'Wajib isi data belum lengkap.' },
    SQLITE_CONSTRAINT: { status: 400, message: 'Data melanggar aturan integritas.' },
    SQLITE_BUSY: { status: 503, message: 'Basis data sedang sibuk. Coba lagi.' },
    SQLITE_READONLY: { status: 503, message: 'Basis data hanya dapat dibaca.' },
  };
  const mapped = mapping[code];
  return new RepositoryError(mapped?.message ?? message, {
    code,
    status: mapped?.status ?? 500,
    cause,
  });
}

/**
 * Buat repository baru di atas koneksi SQLite.
 *
 * @param {SqliteDatabase} db
 * @param {string} name Nama repository untuk pesan diagnostik.
 * @param {{now?: () => string, newId?: () => string}} [injected]
 *   Injeksi `now`/`newId` dipakai tes agar timestamp dan ID deterministik.
 */
export function createRepository(db, name, injected = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new RepositoryError('Koneksi database tidak valid.', {
      code: 'DB_NOT_INITIALIZED',
    });
  }

  const now = injected.now ?? (() => new Date().toISOString());
  const newId = injected.newId ?? (() => randomUUID());

  return {
    name,
    db,
    now,
    newId,
    /** Jalankan query dan bungkus error SQLite menjadi RepositoryError. */
    run(fn) {
      try {
        return fn();
      } catch (cause) {
        // Kesalahan validasi/izin sudah berupa RepositoryError dengan pesan
        // aman dan status yang tepat; jangan ditutupi pesan generik.
        if (cause instanceof RepositoryError) throw cause;
        throw wrapDbError(cause, `Operasi repository "${name}" gagal.`);
      }
    },
  };
}

/**
 * Ubah baris SQLite (snake_case) menjadi objek JS (camelCase).
 * @param {Record<string, unknown> | undefined} row
 */
export function toCamelCase(row) {
  if (!row) return null;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())] = value;
  }
  return out;
}

/**
 * Sama seperti {@link toCamelCase} untuk banyak baris.
 * @param {Array<Record<string, unknown>>} rows
 */
export function toCamelCaseAll(rows) {
  return rows.map((row) => toCamelCase(row));
}

/**
 * Ubah kolom 0/1 SQLite menjadi boolean.
 * @param {unknown} value
 */
export function toBoolean(value) {
  return value === 1 || value === true || value === '1';
}

/**
 * Normalisasi username untuk penyimpanan dan perbandingan.
 * Aturan: lowercase, tanpa spasi di tepi.
 * @param {string} username
 */
export function normalizeUsername(username) {
  return String(username ?? '').trim().toLowerCase();
}

/**
 * Buat slug aman dari nama bebas.
 * Menghasilkan nilai yang hanya berisi [a-z0-9-]; input non-latin
 * menghasilkan slug cadangan bertimestamp agar tetap unik.
 *
 * @param {string} value
 * @param {string} [fallbackSeed]
 */
export function slugify(value, fallbackSeed = 'item') {
  const base = String(value ?? '')
    .normalize('NFKD')
    .replace(/[^\p{ASCII}]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || `${fallbackSeed}-${Date.now().toString(36)}`;
}

/**
 * Wajibkan string tidak kosong pada batas repository agar tidak ada NULL
 * tak disengaja yang lolos ke database.
 *
 * @param {string} value
 * @param {string} field Nama field untuk pesan error.
 * @param {{maxLength?: number}} [options]
 */
export function requireText(value, field, options = {}) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '') {
    throw new RepositoryError(`Nilai "${field}" wajib diisi.`, {
      code: 'VALIDATION_FAILED',
      status: 400,
    });
  }
  if (options.maxLength && text.length > options.maxLength) {
    throw new RepositoryError(`Nilai "${field}" terlalu panjang.`, {
      code: 'VALIDATION_FAILED',
      status: 400,
    });
  }
  return text;
}