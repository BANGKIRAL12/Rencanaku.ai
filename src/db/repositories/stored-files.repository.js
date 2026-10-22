import {
  createRepository,
  requireText,
  toCamelCase,
  toCamelCaseAll,
} from './base.js';

/**
 * Repository tabel `stored_files` (migrasi 002).
 *
 * Tabel ini adalah sisi database dari invariant file/DB:
 *
 * 1. Record `active` HANYA boleh dibuat setelah byte file sudah ada di disk
 *    (FileStorageService menulis file dulu, baru menyimpan record).
 * 2. Penghapusan menandai record `deleted` lebih dulu, baru menghapus byte
 *    di disk. Kegagalan hapus byte menghasilkan file yatim (aman, dideteksi
 *    pemeriksaan integritas), bukan record aktif yang menunjuk file hilang.
 * 3. `relative_path` selalu relatif terhadap root penyimpanan file dan
 *    sudah divalidasi resolver aman; path dari input pengguna tidak pernah
 *    disimpan apa adanya.
 */

/** @typedef {'pending'|'active'|'deleted'} StoredFileState */

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{now?: () => string, newId?: () => string}} [injected]
 */
export function createStoredFilesRepository(db, injected = {}) {
  const repo = createRepository(db, 'stored_files', injected);

  const statements = {
    insert: db.prepare(`
      INSERT INTO stored_files (
        id, owner_user_id, project_id, scope, state, original_name,
        relative_path, size_bytes, hash_algorithm, content_hash, mime_type,
        extension, created_at, updated_at
      ) VALUES (
        @id, @ownerUserId, @projectId, @scope, @state, @originalName,
        @relativePath, @sizeBytes, @hashAlgorithm, @contentHash, @mimeType,
        @extension, @createdAt, @updatedAt
      )
    `),
    insertPending: db.prepare(`
      INSERT INTO stored_files (
        id, owner_user_id, project_id, scope, state, original_name,
        relative_path, size_bytes, content_hash, mime_type, extension,
        created_at, updated_at
      ) VALUES (
        @id, @ownerUserId, @projectId, @scope, 'pending', @originalName,
        @relativePath, @sizeBytes, @contentHash, @mimeType, @extension,
        @createdAt, @updatedAt
      )
    `),
    activate: db.prepare(`
      UPDATE stored_files
         SET state = 'active',
             size_bytes = @sizeBytes,
             content_hash = @contentHash,
             updated_at = @updatedAt
       WHERE id = @id AND state = 'pending'
    `),
    byIdAndOwner: db.prepare(
      'SELECT * FROM stored_files WHERE id = ? AND owner_user_id = ?',
    ),
    byIdForSystem: db.prepare('SELECT * FROM stored_files WHERE id = ?'),
    listByOwner: db.prepare(`
      SELECT * FROM stored_files
       WHERE owner_user_id = @ownerUserId
         AND state = @state
       ORDER BY created_at DESC, id ASC
       LIMIT @limit OFFSET @offset
    `),
    listByProject: db.prepare(`
      SELECT * FROM stored_files
       WHERE project_id = @projectId
         AND owner_user_id = @ownerUserId
         AND state = 'active'
       ORDER BY created_at DESC
    `),
    listByState: db.prepare(`
      SELECT * FROM stored_files
       WHERE state = ?
       ORDER BY created_at ASC
    `),
    markDeleted: db.prepare(`
      UPDATE stored_files
         SET state = 'deleted',
             deleted_at = @deletedAt,
             updated_at = @updatedAt
       WHERE id = @id
         AND owner_user_id = @ownerUserId
         AND state <> 'deleted'
    `),
    deletePending: db.prepare(
      "DELETE FROM stored_files WHERE id = ? AND state = 'pending'",
    ),
    pathExists: db.prepare(
      'SELECT COUNT(*) AS total FROM stored_files WHERE relative_path = ?',
    ),
    usageByOwner: db.prepare(`
      SELECT COALESCE(SUM(size_bytes), 0) AS total_bytes, COUNT(*) AS total_files
        FROM stored_files
       WHERE owner_user_id = ?
         AND state = 'active'
    `),
  };

  /**
   * @param {Record<string, unknown> | undefined} row
   */
  function mapFile(row) {
    return toCamelCase(row);
  }

  /**
   * Catat file yang byte-nya sudah terverifikasi ada di disk.
   * Dipanggil setelah `rename` temp → final succeed.
   *
   * @param {{
   *   id: string,
   *   ownerUserId: string,
   *   projectId?: string | null,
   *   scope?: 'attachment'|'document_version'|'trial_artifact'|'export'|'other',
   *   originalName: string,
   *   relativePath: string,
   *   sizeBytes: number,
   *   contentHash: string,
   *   hashAlgorithm?: 'sha256',
   *   mimeType?: string,
   *   extension?: string | null,
   * }} input
   */
  function recordActive(input) {
    const timestamp = repo.now();
    return repo.run(() => {
      statements.insert.run({
        id: input.id,
        ownerUserId: requireText(input.ownerUserId, 'ownerUserId'),
        projectId: input.projectId ?? null,
        scope: input.scope ?? 'attachment',
        state: 'active',
        originalName: requireText(input.originalName, 'originalName', { maxLength: 255 }),
        relativePath: requireText(input.relativePath, 'relativePath', { maxLength: 512 }),
        sizeBytes: Number(input.sizeBytes),
        hashAlgorithm: input.hashAlgorithm ?? 'sha256',
        contentHash: requireText(input.contentHash, 'contentHash', { maxLength: 128 }),
        mimeType: input.mimeType ?? 'application/octet-stream',
        extension: input.extension ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return mapFile(statements.byIdForSystem.get(input.id));
    });
  }

  /**
   * Catat file yang masih disalin (state pending). Dipakai alur streaming
   * panjang; record pending tidak pernah dianggap tersedia sampai diaktifkan.
   *
   * @param {{
   *   id: string,
   *   ownerUserId: string,
   *   projectId?: string | null,
   *   scope?: string,
   *   originalName: string,
   *   relativePath: string,
   * sizeBytes?: number,
   *   contentHash: string,
   *   mimeType?: string,
   *   extension?: string | null,
   * }} input
   */
  function recordPending(input) {
    const timestamp = repo.now();
    return repo.run(() => {
      statements.insertPending.run({
        id: input.id,
        ownerUserId: requireText(input.ownerUserId, 'ownerUserId'),
        projectId: input.projectId ?? null,
        scope: input.scope ?? 'attachment',
        originalName: requireText(input.originalName, 'originalName', { maxLength: 255 }),
        relativePath: requireText(input.relativePath, 'relativePath', { maxLength: 512 }),
        sizeBytes: Number(input.sizeBytes ?? 0),
        contentHash: requireText(input.contentHash, 'contentHash', { maxLength: 128 }),
        mimeType: input.mimeType ?? 'application/octet-stream',
        extension: input.extension ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return mapFile(statements.byIdForSystem.get(input.id));
    });
  }

  /**
   * Aktifkan record pending setelah file selesai ditulis.
   * @param {{id: string, sizeBytes: number, contentHash: string}} input
   */
  function activate(input) {
    const timestamp = repo.now();
    return repo.run(() => {
      const result = statements.activate.run({
        id: input.id,
        sizeBytes: Number(input.sizeBytes),
        contentHash: requireText(input.contentHash, 'contentHash', { maxLength: 128 }),
        updatedAt: timestamp,
      });
      if (result.changes === 0) return null;
      return mapFile(statements.byIdForSystem.get(input.id));
    });
  }

  /**
   * @param {string} id
   * @param {string} ownerUserId Wajib: dari server.
   */
  function findOwned(id, ownerUserId) {
    return mapFile(statements.byIdAndOwner.get(id, ownerUserId));
  }

  /**
   * Pencarian tanpa filter owner. HANYA untuk use case sistem yang sudah
   * memvalidasi izin (pemeriksaan integritas, backup, restore, trash
   * cleanup). Jangan pernah dipakai dari route sebagai pengganti
   * pemeriksaan ownership.
   *
   * @param {string} id
   */
  function findByIdForSystem(id) {
    return mapFile(statements.byIdForSystem.get(id));
  }

  /**
   * @param {string} ownerUserId
   * @param {{state?: StoredFileState, limit?: number, offset?: number}} [options]
   */
  function listByOwner(ownerUserId, options = {}) {
    return toCamelCaseAll(
      statements.listByOwner.all({
        ownerUserId,
        state: options.state ?? 'active',
        limit: Math.min(Math.max(options.limit ?? 50, 1), 200),
        offset: Math.max(options.offset ?? 0, 0),
      }),
    );
  }

  /**
   * @param {string} projectId
   * @param {string} ownerUserId
   */
  function listActiveByProject(projectId, ownerUserId) {
    return toCamelCaseAll(
      statements.listByProject.all({ projectId, ownerUserId }),
    );
  }

  /**
   * @param {StoredFileState} state
   */
  function listByState(state) {
    return toCamelCaseAll(statements.listByState.all(state));
  }

  /**
   * Tandai file terhapus (record lebih dulu, byte lalu dihapus).
   * @param {string} id
   * @param {string} ownerUserId
   */
  function markDeleted(id, ownerUserId) {
    const timestamp = repo.now();
    return repo.run(() =>
      statements.markDeleted.run({ id, ownerUserId, deletedAt: timestamp, updatedAt: timestamp }).changes > 0,
    );
  }

  /**
   * Buang record pending yang gagal (mis. upload dibatalkan).
   * @param {string} id
   */
  function removePending(id) {
    return repo.run(() => statements.deletePending.run(id).changes > 0);
  }

  /** @param {string} relativePath */
  function pathTaken(relativePath) {
    return statements.pathExists.get(relativePath).total > 0;
  }

  /**
   * @param {string} ownerUserId
   * @returns {{totalBytes: number, totalFiles: number}}
   */
  function usageByOwner(ownerUserId) {
    const row = statements.usageByOwner.get(ownerUserId);
    return { totalBytes: Number(row.total_bytes), totalFiles: Number(row.total_files) };
  }

  return {
    name: repo.name,
    recordActive,
    recordPending,
    activate,
    findOwned,
    findByIdForSystem,
    listByOwner,
    listActiveByProject,
    listByState,
    markDeleted,
    removePending,
    pathTaken,
    usageByOwner,
  };
}