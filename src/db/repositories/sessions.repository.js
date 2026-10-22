import { createHash } from 'node:crypto';
import { createRepository, toCamelCase } from './base.js';

/**
 * Repository tabel `sessions` (ARCHITECTURE §6.1, §11.1).
 *
 * Kontrak:
 * - Nilai cookie sesi (session id) tidak pernah disimpan apa adanya.
 *   Repository menerima token mentah, menyimpan SHA-256-nya, dan semua
 *   pencarian kembali menggunakan hash yang sama.
 * - `data` menyimpan payload JSON untuk adapter express-session.
 * - Ekspresi memakai waktu ISO-8601 UTC; `expires_at_unix` disimpan agar
 *   prune tidak perlu mengonversi string.
 */

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{now?: () => string, newId?: () => string}} [injected]
 */
export function createSessionsRepository(db, injected = {}) {
  const repo = createRepository(db, 'sessions', injected);

  const statements = {
    insert: db.prepare(`
      INSERT INTO sessions (
        id, token_hash, user_id, data, ip_hash, user_agent,
        expires_at, expires_at_unix, last_seen_at, created_at, updated_at
      ) VALUES (
        @id, @tokenHash, @userId, @data, @ipHash, @userAgent,
        @expiresAt, @expiresAtUnix, @lastSeenAt, @createdAt, @updatedAt
      )
    `),
    byTokenHash: db.prepare('SELECT * FROM sessions WHERE token_hash = ?'),
    byId: db.prepare('SELECT * FROM sessions WHERE id = ?'),
    touch: db.prepare(
      'UPDATE sessions SET last_seen_at = @lastSeenAt, updated_at = @updatedAt WHERE id = @id',
    ),
    updateData: db.prepare(
      'UPDATE sessions SET data = @data, updated_at = @updatedAt WHERE id = @id',
    ),
    attachUser: db.prepare(`
      UPDATE sessions
         SET user_id = @userId,
             data = @data,
             last_seen_at = @lastSeenAt,
             updated_at = @updatedAt
       WHERE id = @id
    `),
    revoke: db.prepare(
      'UPDATE sessions SET revoked_at = @revokedAt, updated_at = @updatedAt WHERE id = @id',
    ),
    revokeByTokenHash: db.prepare(`
      UPDATE sessions
         SET revoked_at = @revokedAt, updated_at = @updatedAt
       WHERE token_hash = @tokenHash
    `),
    revokeAllForUser: db.prepare(`
      UPDATE sessions
         SET revoked_at = @revokedAt, updated_at = @updatedAt
       WHERE user_id = @userId
         AND revoked_at IS NULL
    `),
    deleteExpired: db.prepare(
      'DELETE FROM sessions WHERE expires_at_unix <= @nowUnix OR revoked_at IS NOT NULL',
    ),
    countActive: db.prepare(`
      SELECT COUNT(*) AS total
        FROM sessions
       WHERE revoked_at IS NULL
         AND expires_at_unix > @nowUnix
    `),
  };

  /**
   * @param {string} token
   */
  function hashToken(token) {
    return createHash('sha256').update(String(token)).digest('hex');
  }

  /**
   * @param {Record<string, unknown> | undefined} row
   */
  function mapSession(row) {
    const session = toCamelCase(row);
    if (!session) return null;
    let parsed = {};
    try {
      parsed = JSON.parse(session.data ?? '{}');
    } catch {
      parsed = {};
    }
    return { ...session, data: parsed };
  }

  /**
   * Buat sesi baru.
   *
   * @param {{
   *   token: string,
   *   userId?: string | null,
   *   data?: object,
   *   expiresAt: string,
   *   expiresAtUnix: number,
   *   ipHash?: string | null,
   *   userAgent?: string | null,
   *   id?: string,
   * }} input
   */
  function create(input) {
    const timestamp = repo.now();
    const id = input.id ?? repo.newId();
    return repo.run(() => {
      statements.insert.run({
        id,
        tokenHash: hashToken(input.token),
        userId: input.userId ?? null,
        data: JSON.stringify(input.data ?? {}),
        ipHash: input.ipHash ?? null,
        userAgent: input.userAgent ? String(input.userAgent).slice(0, 255) : null,
        expiresAt: input.expiresAt,
        expiresAtUnix: input.expiresAtUnix,
        lastSeenAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return mapSession(statements.byId.get(id));
    });
  }

  /**
   * Cari sesi aktif berdasarkan token mentah. Sesi kedaluwarsa atau yang
   * sudah dicabut otomatis dihapus agar tidak menumpuk.
   *
   * @param {string} token
   * @param {{nowUnix?: number}} [options]
   */
  function findActiveByToken(token, options = {}) {
    const nowUnix = options.nowUnix ?? Math.floor(Date.now() / 1000);
    return repo.run(() => {
      const row = statements.byTokenHash.get(hashToken(token));
      if (!row) return null;
      const session = toCamelCase(row);
      if (session.revokedAt || Number(session.expiresAtUnix) <= nowUnix) {
        statements.deleteExpired.run({ nowUnix });
        return null;
      }
      return mapSession(row);
    });
  }

  /** @param {string} id */
  function findById(id) {
    return mapSession(statements.byId.get(id));
  }

  /**
   * Perbarui payload sesi.
   * @param {string} id
   * @param {object} data
   */
  function updateData(id, data) {
    const timestamp = repo.now();
    return repo.run(() => {
      const result = statements.updateData.run({
        id,
        data: JSON.stringify(data ?? {}),
        updatedAt: timestamp,
      });
      return result.changes === 0 ? null : mapSession(statements.byId.get(id));
    });
  }

  /**
   * Tempelkan sesi ke user (dipakai setelah login berhasil) dan perbarui
   * waktu terakhir dipakai.
   * @param {string} id
   * @param {string} userId
   * @param {object} [data]
   */
  function attachUser(id, userId, data) {
    const timestamp = repo.now();
    return repo.run(() => {
      const current = statements.byId.get(id);
      if (!current) return null;
      const payload = data ?? toCamelCase(current).data ?? {};
      statements.attachUser.run({
        id,
        userId,
        data: JSON.stringify(payload),
        lastSeenAt: timestamp,
        updatedAt: timestamp,
      });
      return mapSession(statements.byId.get(id));
    });
  }

  /** @param {string} token */
  function touchByToken(token) {
    const timestamp = repo.now();
    return repo.run(() => {
      const row = statements.byTokenHash.get(hashToken(token));
      if (!row) return false;
      statements.touch.run({ id: row.id, lastSeenAt: timestamp, updatedAt: timestamp });
      return true;
    });
  }

  /** @param {string} token */
  function revokeByToken(token) {
    const timestamp = repo.now();
    return repo.run(
      () => statements.revokeByTokenHash.run({ tokenHash: hashToken(token), revokedAt: timestamp, updatedAt: timestamp }).changes > 0,
    );
  }

  /** @param {string} id */
  function revoke(id) {
    const timestamp = repo.now();
    return repo.run(() => statements.revoke.run({ id, revokedAt: timestamp, updatedAt: timestamp }).changes > 0);
  }

  /**
   * Cabut seluruh sesi milik pengguna — dipakai saat reset password,
   * perubahan password, dan penonaktifan akun (Fase 3).
   * @param {string} userId
   */
  function revokeAllForUser(userId) {
    const timestamp = repo.now();
    return repo.run(() => statements.revokeAllForUser.run({ userId, revokedAt: timestamp, updatedAt: timestamp }).changes);
  }

  /**
   * Hapus sesi kedaluwarsa/tercabut.
   * @param {{nowUnix?: number}} [options]
   */
  function prune(options = {}) {
    const nowUnix = options.nowUnix ?? Math.floor(Date.now() / 1000);
    return repo.run(() => statements.deleteExpired.run({ nowUnix }).changes);
  }

  /** @returns {number} */
  function countActive(options = {}) {
    const nowUnix = options.nowUnix ?? Math.floor(Date.now() / 1000);
    return repo.run(() => statements.countActive.get({ nowUnix }).total);
  }

  return {
    name: repo.name,
    hashToken,
    create,
    findActiveByToken,
    findById,
    updateData,
    attachUser,
    touchByToken,
    revoke,
    revokeByToken,
    revokeAllForUser,
    prune,
    countActive,
  };
}