import { logger } from '../core/logger/index.js';

/**
 * Transaction helper untuk repository.
 *
 * Aturan:
 * - Semua penulisan yang menyentuh lebih dari satu tabel wajib dibungkus
 *   `runInTransaction` (ARCHITECTURE §7.2).
 * - Transaksi memakai `BEGIN IMMEDIATE` supaya lock penulis diambil lebih
 *   awal dan tidak menaikkan SQLITE_BUSY di tengah pekerjaan.
 * - Transaksi bersarang memakai SAVEPOINT sehingga repository boleh
 *   memanggil repository lain tanpa saling merusak boundary rollback.
 * - Error apa pun melakukan ROLLBACK; tidak ada "commit sebagian".
 *
 * @typedef {import('better-sqlite3').Database} SqliteDatabase
 */

export class TransactionError extends Error {
  /**
   * @param {string} message
   * @param {{cause?: unknown, code?: string}} [options]
   */
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'TransactionError';
    this.code = options.code ?? 'DB_TRANSACTION_FAILED';
  }
}

const depthByConnection = new WeakMap();

/** @param {SqliteDatabase} db */
function currentDepth(db) {
  return depthByConnection.get(db) ?? 0;
}

/** @param {SqliteDatabase} db @param {number} depth */
function setDepth(db, depth) {
  if (depth <= 0) depthByConnection.delete(db);
  else depthByConnection.set(db, depth);
}

/**
 * Jalankan `fn` di dalam transaksi; rollback otomatis bila `fn` melempar.
 *
 * @template T
 * @param {SqliteDatabase} db
 * @param {() => T} fn Kode yang hanya boleh menjalankan operasi repository.
 * @returns {T} Nilai kembalian dari `fn` bila commit berhasil.
 * @throws {TransactionError} Bila transaksi gagal; error asli menjadi `cause`.
 */
export function runInTransaction(db, fn) {
  if (typeof fn !== 'function') {
    throw new TransactionError('Transaction helper membutuhkan fungsi.', {
      code: 'DB_TRANSACTION_CALLBACK_MISSING',
    });
  }

  const depth = currentDepth(db);

  if (depth > 0) {
    const savepoint = `sp_${depth}_${Date.now().toString(36)}`;
    db.exec(`SAVEPOINT ${savepoint}`);
    setDepth(db, depth + 1);
    try {
      const result = fn();
      db.exec(`RELEASE ${savepoint}`);
      setDepth(db, depth);
      return result;
    } catch (cause) {
      try {
        db.exec(`ROLLBACK TO ${savepoint}`);
        db.exec(`RELEASE ${savepoint}`);
      } catch (rollbackError) {
        logger.error('Gagal rollback savepoint', {
          message: rollbackError?.message,
        });
      }
      setDepth(db, depth);
      throw new TransactionError('Transaksi basis data gagal dan telah dibatalkan.', {
        cause,
        code: 'DB_TRANSACTION_ROLLED_BACK',
      });
    }
  }

  db.exec('BEGIN IMMEDIATE');
  setDepth(db, 1);
  try {
    const result = fn();
    db.exec('COMMIT');
    setDepth(db, 0);
    return result;
  } catch (cause) {
    try {
      db.exec('ROLLBACK');
    } catch (rollbackError) {
      logger.error('Gagal rollback transaksi', { message: rollbackError?.message });
    }
    setDepth(db, 0);
    throw new TransactionError('Transaksi basis data gagal dan telah dibatalkan.', {
      cause,
      code: 'DB_TRANSACTION_ROLLED_BACK',
    });
  }
}

/**
 * Apakah `db` sedang berada di dalam transaksi yang dikelola helper ini?
 * @param {SqliteDatabase} db
 */
export function isInTransaction(db) {
  return currentDepth(db) > 0 || db.inTransaction === true;
}