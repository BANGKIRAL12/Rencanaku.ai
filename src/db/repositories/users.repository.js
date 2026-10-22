import {
  createRepository,
  normalizeUsername,
  requireText,
  toBoolean,
  toCamelCase,
  toCamelCaseAll,
} from './base.js';

/**
 * Repository tabel `users` (ARCHITECTURE §7.1).
 *
 * Catatan keamanan:
 * - `password_hash` hanya boleh berisi hash `crypto.scrypt`. Kolom ini
 *   tidak pernah dikembalikan ke lapisan HTTP; pemanggil HTTP memakai
 *   {@link findAuthRecordById} yang tetap tidak mengembalikan hash pada
 *   respons, dan `toPublicUser` dipakai untuk data yang tampil di UI.
 * - Normalisasi username terjadi di repository sehingga perbandingan
 *   login tidak bergantung pada kapitalisasi input.
 */

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{now?: () => string, newId?: () => string}} [injected]
 */
export function createUsersRepository(db, injected = {}) {
  const repo = createRepository(db, 'users', injected);

  const statements = {
    insert: db.prepare(`
      INSERT INTO users (
        id, username, username_normalized, display_name, password_hash,
        role, status, must_change_password, locale, theme,
        password_changed_at, created_at, updated_at
      ) VALUES (
        @id, @username, @usernameNormalized, @displayName, @passwordHash,
        @role, @status, @mustChangePassword, @locale, @theme,
        @passwordChangedAt, @createdAt, @updatedAt
      )
    `),
    byId: db.prepare('SELECT * FROM users WHERE id = ?'),
    byUsername: db.prepare('SELECT * FROM users WHERE username_normalized = ?'),
    count: db.prepare('SELECT COUNT(*) AS total FROM users'),
    listAll: db.prepare(
      `SELECT * FROM users ORDER BY created_at ASC, id ASC LIMIT ? OFFSET ?`,
    ),
    updateProfile: db.prepare(`
      UPDATE users
         SET display_name = @displayName,
             locale = @locale,
             theme = @theme,
             updated_at = @updatedAt
       WHERE id = @id
    `),
    updatePassword: db.prepare(`
      UPDATE users
         SET password_hash = @passwordHash,
             must_change_password = 0,
             password_changed_at = @passwordChangedAt,
             updated_at = @updatedAt
       WHERE id = @id
    `),
    updateStatus: db.prepare(`
      UPDATE users
         SET status = @status,
             must_change_password = @mustChangePassword,
             updated_at = @updatedAt
       WHERE id = @id
    `),
    updateRole: db.prepare(
      'UPDATE users SET role = @role, updated_at = @updatedAt WHERE id = @id',
    ),
    recordLogin: db.prepare(
      'UPDATE users SET last_login_at = @lastLoginAt, updated_at = @updatedAt WHERE id = @id',
    ),
    delete: db.prepare('DELETE FROM users WHERE id = ?'),
  };

  /**
   * Ubah baris DB menjadi objek pengguna internal.
   * @param {Record<string, unknown> | undefined} row
   */
  function mapUser(row) {
    const user = toCamelCase(row);
    if (!user) return null;
    return { ...user, mustChangePassword: toBoolean(user.mustChangePassword) };
  }

  /**
   * Bentuk pengguna untuk UI/lapisan HTTP (tanpa hash).
   * @param {Record<string, unknown> | null} user
   */
  function toPublicUser(user) {
    if (!user) return null;
    const { passwordHash, password_hash: _ignored, ...rest } = user;
    void _ignored;
    return rest;
  }

  /**
   * Buat pengguna baru.
   *
   * @param {{
   *   username: string,
   *   displayName: string,
   *   passwordHash: string,
   *   role?: 'admin'|'member',
   *   status?: 'active'|'disabled',
   *   mustChangePassword?: boolean,
   *   locale?: 'id'|'en',
   *   theme?: 'light'|'dark'|'system',
   *   id?: string,
   * }} input
   * @returns {object} Pengguna tanpa kolom hash.
   */
  function create(input) {
    const username = requireText(input.username, 'username', { maxLength: 64 });
    const displayName = requireText(input.displayName, 'displayName', { maxLength: 120 });
    const passwordHash = requireText(input.passwordHash, 'passwordHash', { maxLength: 512 });
    const timestamp = repo.now();
    const id = input.id ?? repo.newId();

    return repo.run(() => {
      statements.insert.run({
        id,
        username,
        usernameNormalized: normalizeUsername(username),
        displayName,
        passwordHash,
        role: input.role ?? 'member',
        status: input.status ?? 'active',
        mustChangePassword: input.mustChangePassword ? 1 : 0,
        locale: input.locale ?? 'id',
        theme: input.theme ?? 'system',
        passwordChangedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return toPublicUser(mapUser(statements.byId.get(id)));
    });
  }

  /** @param {string} id */
  function findById(id) {
    // Bentuk publik: hash password tidak boleh ikut ke UI/log.
    return toPublicUser(mapUser(statements.byId.get(id)));
  }

  /** @param {string} id */
  function findAuthRecordById(id) {
    return mapUser(statements.byId.get(id));
  }

  /** @param {string} username */
  function findByUsername(username) {
    return mapUser(statements.byUsername.get(normalizeUsername(username)));
  }

  /** @param {string} username */
  function findAuthRecordByUsername(username) {
    return mapUser(statements.byUsername.get(normalizeUsername(username)));
  }

  /** @returns {number} */
  function count() {
    return statements.count.get().total;
  }

  /**
   * @param {{limit?: number, offset?: number}} [options]
   */
  function list({ limit = 50, offset = 0 } = {}) {
    return toCamelCaseAll(
      statements.listAll.all(Math.min(Math.max(limit, 1), 200), Math.max(offset, 0)),
    ).map(toPublicUser);
  }

  /**
   * @param {string} id
   * @param {{displayName: string, locale?: string, theme?: string}} input
   */
  function updateProfile(id, input) {
    const timestamp = repo.now();
    return repo.run(() => {
      const result = statements.updateProfile.run({
        id,
        displayName: requireText(input.displayName, 'displayName', { maxLength: 120 }),
        locale: input.locale ?? 'id',
        theme: input.theme ?? 'system',
        updatedAt: timestamp,
      });
      return result.changes === 0 ? null : toPublicUser(mapUser(statements.byId.get(id)));
    });
  }

  /**
   * Ganti password (hash) dan bersihkan must_change_password.
   * @param {string} id
   * @param {string} passwordHash
   */
  function updatePassword(id, passwordHash) {
    const timestamp = repo.now();
    return repo.run(() => {
      const result = statements.updatePassword.run({
        id,
        passwordHash: requireText(passwordHash, 'passwordHash', { maxLength: 512 }),
        passwordChangedAt: timestamp,
        updatedAt: timestamp,
      });
      return result.changes === 0 ? null : toPublicUser(mapUser(statements.byId.get(id)));
    });
  }

  /**
   * @param {string} id
   * @param {{status: 'active'|'disabled', mustChangePassword?: boolean}} input
   */
  function updateStatus(id, input) {
    const timestamp = repo.now();
    return repo.run(() => {
      const result = statements.updateStatus.run({
        id,
        status: input.status,
        mustChangePassword: input.mustChangePassword ? 1 : 0,
        updatedAt: timestamp,
      });
      return result.changes === 0 ? null : toPublicUser(mapUser(statements.byId.get(id)));
    });
  }

  /**
   * @param {string} id
   * @param {'admin'|'member'} role
   */
  function updateRole(id, role) {
    const timestamp = repo.now();
    return repo.run(() => {
      const result = statements.updateRole.run({ id, role, updatedAt: timestamp });
      return result.changes === 0 ? null : toPublicUser(mapUser(statements.byId.get(id)));
    });
  }

  /** @param {string} id */
  function recordLogin(id) {
    const timestamp = repo.now();
    return repo.run(
      () =>
        statements.recordLogin.run({ id, lastLoginAt: timestamp, updatedAt: timestamp })
          .changes > 0,
    );
  }

  /**
   * Hapus pengguna. Foreign key `projects.owner_user_id` memakai RESTRICT
   * sehingga penghapusan ditolak bila masih memiliki proyek.
   * @param {string} id
   */
  function remove(id) {
    return repo.run(() => statements.delete.run(id).changes > 0);
  }

  return {
    name: repo.name,
    create,
    findById,
    findByUsername,
    findAuthRecordById,
    findAuthRecordByUsername,
    count,
    list,
    updateProfile,
    updatePassword,
    updateStatus,
    updateRole,
    recordLogin,
    remove,
    toPublicUser,
  };
}