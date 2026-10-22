import {
  RepositoryError,
  createRepository,
  requireText,
  toBoolean,
  toCamelCase,
  toCamelCaseAll,
} from './base.js';

/**
 * Repository tabel `app_settings` (ARCHITECTURE §7.1, §6.4, §11.4).
 *
 *_ATURAN KERAS_: tabel ini hanya untuk preferensi/pengaturan non-rahasia.
 * API key provider disimpan di `data/config/providers.json` dengan
 * permission ketat, bukan di database. Repository menolak nilai
 * `is_secret` yang bernilai 1 sebagai pengaman lapisan kedua.
 */

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{now?: () => string, newId?: () => string}} [injected]
 */
export function createSettingsRepository(db, injected = {}) {
  const repo = createRepository(db, 'app_settings', injected);

  const statements = {
    upsertInstance: db.prepare(`
      INSERT INTO app_settings (
        id, scope, owner_user_id, key, value, value_type, is_secret,
        updated_by_user_id, created_at, updated_at
      ) VALUES (
        @id, 'instance', NULL, @key, @value, @valueType, 0,
        @updatedByUserId, @createdAt, @updatedAt
      )
      ON CONFLICT (scope, IFNULL(owner_user_id, ''), key)
      DO UPDATE SET
        value = excluded.value,
        value_type = excluded.value_type,
        is_secret = 0,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = excluded.updated_at
    `),
    upsertUser: db.prepare(`
      INSERT INTO app_settings (
        id, scope, owner_user_id, key, value, value_type, is_secret,
        updated_by_user_id, created_at, updated_at
      ) VALUES (
        @id, 'user', @ownerUserId, @key, @value, @valueType, 0,
        @updatedByUserId, @createdAt, @updatedAt
      )
      ON CONFLICT (scope, IFNULL(owner_user_id, ''), key)
      DO UPDATE SET
        value = excluded.value,
        value_type = excluded.value_type,
        is_secret = 0,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = excluded.updated_at
    `),
    getInstance: db.prepare(
      "SELECT * FROM app_settings WHERE scope = 'instance' AND key = ?",
    ),
    getUser: db.prepare(
      "SELECT * FROM app_settings WHERE scope = 'user' AND owner_user_id = ? AND key = ?",
    ),
    listInstance: db.prepare(
      "SELECT * FROM app_settings WHERE scope = 'instance' ORDER BY key ASC",
    ),
    listUser: db.prepare(
      "SELECT * FROM app_settings WHERE scope = 'user' AND owner_user_id = ? ORDER BY key ASC",
    ),
    deleteInstance: db.prepare(
      "DELETE FROM app_settings WHERE scope = 'instance' AND key = ?",
    ),
    deleteUser: db.prepare(
      "DELETE FROM app_settings WHERE scope = 'user' AND owner_user_id = ? AND key = ?",
    ),
  };

  /**
   * @param {Record<string, unknown> | undefined} row
   */
  function mapSetting(row) {
    const setting = toCamelCase(row);
    if (!setting) return null;
    let value = setting.value;
    if (setting.valueType === 'json') {
      try {
        value = JSON.parse(setting.value);
      } catch {
        value = null;
      }
    } else if (setting.valueType === 'boolean') {
      value = setting.value === '1' || setting.value === 'true';
    } else if (setting.valueType === 'number') {
      value = Number(setting.value);
    }
    return { ...setting, value, isSecret: toBoolean(setting.isSecret) };
  }

  /**
   * @param {unknown} value
   * @returns {{serialized: string, valueType: string}}
   */
  function serialize(value) {
    if (typeof value === 'string') return { serialized: value, valueType: 'string' };
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new RepositoryError('Nilai pengaturan angka tidak valid.', {
          code: 'VALIDATION_FAILED',
          status: 400,
        });
      }
      return { serialized: String(value), valueType: 'number' };
    }
    if (typeof value === 'boolean') {
      return { serialized: value ? 'true' : 'false', valueType: 'boolean' };
    }
    return { serialized: JSON.stringify(value ?? null), valueType: 'json' };
  }

  function assertNotSecret(input) {
    if (input?.isSecret) {
      throw new RepositoryError(
        'app_settings tidak boleh menyimpan rahasia. Simpan API key pada berkas konfigurasi privat di data/config.',
        { code: 'SETTINGS_SECRET_FORBIDDEN', status: 400 },
      );
    }
  }

  /**
   * Simpan pengaturan instance (tanpa pemilik).
   * @param {{key: string, value: unknown, isSecret?: boolean, updatedByUserId?: string | null}} input
   */
  function setInstance(input) {
    assertNotSecret(input);
    const timestamp = repo.now();
    const key = requireText(input.key, 'key', { maxLength: 120 });
    const { serialized, valueType } = serialize(input.value);
    return repo.run(() => {
      statements.upsertInstance.run({
        id: repo.newId(),
        key,
        value: serialized,
        valueType,
        updatedByUserId: input.updatedByUserId ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return mapSetting(statements.getInstance.get(key));
    });
  }

  /**
   * Simpan pengaturan milik seorang pengguna.
   * @param {{ownerUserId: string, key: string, value: unknown, isSecret?: boolean, updatedByUserId?: string | null}} input
   */
  function setForUser(input) {
    assertNotSecret(input);
    const timestamp = repo.now();
    const key = requireText(input.key, 'key', { maxLength: 120 });
    const ownerUserId = requireText(input.ownerUserId, 'ownerUserId');
    const { serialized, valueType } = serialize(input.value);
    return repo.run(() => {
      statements.upsertUser.run({
        id: repo.newId(),
        ownerUserId,
        key,
        value: serialized,
        valueType,
        updatedByUserId: input.updatedByUserId ?? ownerUserId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return mapSetting(statements.getUser.get(ownerUserId, key));
    });
  }

  /** @param {string} key */
  function getInstance(key) {
    return mapSetting(statements.getInstance.get(String(key)));
  }

  /**
   * @param {string} ownerUserId
   * @param {string} key
   */
  function getForUser(ownerUserId, key) {
    return mapSetting(statements.getUser.get(String(ownerUserId), String(key)));
  }

  function listInstance() {
    return toCamelCaseAll(statements.listInstance.all()).map((row) => ({
      ...row,
      value: mapSetting(row).value,
    }));
  }

  /** @param {string} ownerUserId */
  function listForUser(ownerUserId) {
    return toCamelCaseAll(statements.listUser.all(ownerUserId)).map((row) => ({
      ...row,
      value: mapSetting(row).value,
    }));
  }

  /** @param {string} key */
  function removeInstance(key) {
    return repo.run(() => statements.deleteInstance.run(String(key)).changes > 0);
  }

  /**
   * @param {string} ownerUserId
   * @param {string} key
   */
  function removeForUser(ownerUserId, key) {
    return repo.run(() => statements.deleteUser.run(String(ownerUserId), String(key)).changes > 0);
  }

  return {
    name: repo.name,
    setInstance,
    setForUser,
    getInstance,
    getForUser,
    listInstance,
    listForUser,
    removeInstance,
    removeForUser,
  };
}