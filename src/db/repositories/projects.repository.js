import {
  createRepository,
  requireText,
  slugify,
  toCamelCase,
  toCamelCaseAll,
} from './base.js';

/**
 * Repository tabel `projects` (ARCHITECTURE §7.1).
 *
 * Ini adalah batas privasi utama aplikasi. Setiap query yang dapat
 * menyentuh proyek wajib menyertakan `ownerUserId` milik server
 * (dari sesi), bukan ID yang dikirim browser. Tidak ada satu pun method
 * di sini yang menerima `projectId` tanpa owner.
 */

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{now?: () => string, newId?: () => string}} [injected]
 */
export function createProjectsRepository(db, injected = {}) {
  const repo = createRepository(db, 'projects', injected);

  const statements = {
    insert: db.prepare(`
      INSERT INTO projects (
        id, owner_user_id, name, slug, description, status, lifecycle_state,
        source_project_id, created_at, updated_at
      ) VALUES (
        @id, @ownerUserId, @name, @slug, @description, @status, @lifecycleState,
        @sourceProjectId, @createdAt, @updatedAt
      )
    `),
    byIdAndOwner: db.prepare(
      'SELECT * FROM projects WHERE id = ? AND owner_user_id = ?',
    ),
    byId: db.prepare('SELECT * FROM projects WHERE id = ?'),
    slugExists: db.prepare(
      'SELECT COUNT(*) AS total FROM projects WHERE owner_user_id = @ownerUserId AND slug = @slug',
    ),
    listByOwner: db.prepare(`
      SELECT * FROM projects
       WHERE owner_user_id = @ownerUserId
         AND lifecycle_state = @lifecycleState
         AND (@status IS NULL OR status = @status)
       ORDER BY updated_at DESC, id ASC
       LIMIT @limit OFFSET @offset
    `),
    searchByOwner: db.prepare(`
      SELECT * FROM projects
       WHERE owner_user_id = @ownerUserId
         AND lifecycle_state = 'active'
         AND (name LIKE @pattern ESCAPE '\\' OR IFNULL(description, '') LIKE @pattern ESCAPE '\\')
       ORDER BY updated_at DESC, id ASC
       LIMIT @limit
    `),
    updateMeta: db.prepare(`
      UPDATE projects
         SET name = @name,
             slug = @slug,
             description = @description,
             updated_at = @updatedAt
       WHERE id = @id AND owner_user_id = @ownerUserId
    `),
    updateStatus: db.prepare(`
      UPDATE projects
         SET status = @status,
             archived_at = @archivedAt,
             completed_at = @completedAt,
             updated_at = @updatedAt
       WHERE id = @id AND owner_user_id = @ownerUserId
    `),
    updateLifecycle: db.prepare(`
      UPDATE projects
         SET lifecycle_state = @lifecycleState,
             trashed_at = @trashedAt,
             purge_after = @purgeAfter,
             updated_at = @updatedAt
       WHERE id = @id AND owner_user_id = @ownerUserId
    `),
    countByOwner: db.prepare(`
      SELECT COUNT(*) AS total
        FROM projects
       WHERE owner_user_id = ?
         AND lifecycle_state = 'active'
    `),
    deleteOwned: db.prepare(
      'DELETE FROM projects WHERE id = ? AND owner_user_id = ?',
    ),
    listTrashDue: db.prepare(`
      SELECT id FROM projects
       WHERE lifecycle_state = 'trashed'
         AND purge_after IS NOT NULL
         AND purge_after <= @now
       ORDER BY purge_after ASC
       LIMIT @limit
    `),
  };

  /**
   * @param {Record<string, unknown> | undefined} row
   */
  function mapProject(row) {
    return toCamelCase(row);
  }

  /**
   * Buat proyek baru milik `ownerUserId`.
   *
   * @param {{
   *   ownerUserId: string,
   *   name: string,
   *   description?: string | null,
   *   sourceProjectId?: string | null,
   *   id?: string,
   * }} input
   */
  function create(input) {
    const timestamp = repo.now();
    const id = input.id ?? repo.newId();
    const ownerUserId = requireText(input.ownerUserId, 'ownerUserId');
    const name = requireText(input.name, 'name', { maxLength: 160 });

    return repo.run(() => {
      const slug = uniqueSlug(name, id, ownerUserId);
      statements.insert.run({
        id,
        ownerUserId,
        name,
        slug,
        description: input.description ?? null,
        status: 'active',
        lifecycleState: 'active',
        sourceProjectId: input.sourceProjectId ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return mapProject(statements.byId.get(id));
    });
  }

  /**
   * Slug unik per owner. Konflik ditambahkan sufiks numerik, bukan error,
   * agar pembuatan proyek dari chat kosong tidak pernah gagal karena nama.
   */
  function uniqueSlug(name, id, ownerUserId) {
    const base = slugify(name, id.slice(0, 8));
    if (statements.slugExists.get({ ownerUserId, slug: base }).total === 0) return base;

    let suffix = 2;
    while (suffix < 1000) {
      const candidate = `${base}-${suffix}`;
      if (statements.slugExists.get({ ownerUserId, slug: candidate }).total === 0) {
        return candidate;
      }
      suffix += 1;
    }
    return `${base}-${id.slice(0, 8)}`;
  }

  /**
   * Ambil proyek milik owner tertentu.
   * @param {string} projectId
   * @param {string} ownerUserId Wajib: ID dari server, bukan dari request.
   */
  function findOwned(projectId, ownerUserId) {
    return mapProject(statements.byIdAndOwner.get(projectId, ownerUserId));
  }

  /**
   * Hanya untuk use case sistem yang sudah memvalidasi izin
   * (mis. diagnostics/backup). Jangan pernah dipanggil dari route
   * tanpa pemeriksaan ownership terpisah.
   * @param {string} projectId
   */
  function findByIdForSystem(projectId) {
    return mapProject(statements.byId.get(projectId));
  }

  /**
   * @param {string} ownerUserId
   * @param {{lifecycleState?: 'active'|'trashed', status?: string, limit?: number, offset?: number}} [options]
   */
  function listByOwner(ownerUserId, options = {}) {
    const rows = statements.listByOwner.all({
      ownerUserId,
      lifecycleState: options.lifecycleState ?? 'active',
      status: options.status ?? null,
      limit: Math.min(Math.max(options.limit ?? 50, 1), 200),
      offset: Math.max(options.offset ?? 0, 0),
    });
    return toCamelCaseAll(rows);
  }

  /**
   * Pencarian metadata sederhana (ARCHITECTURE §17: bukan full-text search).
   * @param {string} ownerUserId
   * @param {string} query
   * @param {{limit?: number}} [options]
   */
  function searchByOwner(ownerUserId, query, options = {}) {
    const raw = String(query ?? '').trim();
    if (raw === '') return [];
    const escaped = raw.replace(/[\\%_]/g, (c) => `\\${c}`);
    const rows = statements.searchByOwner.all({
      ownerUserId,
      pattern: `%${escaped}%`,
      limit: Math.min(Math.max(options.limit ?? 50, 1), 200),
    });
    return toCamelCaseAll(rows);
  }

  /**
   * @param {string} projectId
   * @param {string} ownerUserId
   * @param {{name: string, description?: string | null}} input
   */
  function rename(projectId, ownerUserId, input) {
    const timestamp = repo.now();
    return repo.run(() => {
      const existing = statements.byIdAndOwner.get(projectId, ownerUserId);
      if (!existing) return null;
      const name = requireText(input.name, 'name', { maxLength: 160 });
      // Slug hanya dihitung ulang bila nama benar-benar berubah.
      const slug =
        name === existing.name ? existing.slug : uniqueSlug(name, projectId, ownerUserId);
      const result = statements.updateMeta.run({
        id: projectId,
        ownerUserId,
        name,
        slug,
        description: input.description ?? toCamelCase(existing).description ?? null,
        updatedAt: timestamp,
      });
      return result.changes === 0 ? null : mapProject(statements.byIdAndOwner.get(projectId, ownerUserId));
    });
  }

  /**
   * Ubah status proyek. `archived_at` harus konsisten dengan status karena
   * database punya CHECK constraint untuk itu.
   *
   * @param {string} projectId
   * @param {string} ownerUserId
   * @param {'active'|'completed'|'archived'} status
   */
  function setStatus(projectId, ownerUserId, status) {
    const timestamp = repo.now();
    return repo.run(() => {
      const existing = mapProject(statements.byIdAndOwner.get(projectId, ownerUserId));
      if (!existing) return null;
      const result = statements.updateStatus.run({
        id: projectId,
        ownerUserId,
        status,
        archivedAt: status === 'archived' ? timestamp : null,
        completedAt: status === 'completed' ? timestamp : null,
        updatedAt: timestamp,
      });
      return result.changes === 0 ? null : mapProject(statements.byIdAndOwner.get(projectId, ownerUserId));
    });
  }

  /**
   * Pindahkan proyek ke trash atau pulihkan dari trash.
   * @param {string} projectId
   * @param {string} ownerUserId
   * @param {'active'|'trashed'} lifecycleState
   * @param {{purgeAfter?: string | null}} [options]
   */
  function setLifecycleState(projectId, ownerUserId, lifecycleState, options = {}) {
    const timestamp = repo.now();
    return repo.run(() => {
      const result = statements.updateLifecycle.run({
        id: projectId,
        ownerUserId,
        lifecycleState,
        trashedAt: lifecycleState === 'trashed' ? timestamp : null,
        purgeAfter: lifecycleState === 'trashed' ? options.purgeAfter ?? null : null,
        updatedAt: timestamp,
      });
      return result.changes === 0 ? null : mapProject(statements.byIdAndOwner.get(projectId, ownerUserId));
    });
  }

  /** @param {string} ownerUserId */
  function countActiveByOwner(ownerUserId) {
    return statements.countByOwner.get(ownerUserId).total;
  }

  /**
   * Hapus proyek secara permanen. Hanya untuk trash yang sudah melewati
   * retensi atau untuk use case duplikasi/pemulihan yang disetujui.
   * @param {string} projectId
   * @param {string} ownerUserId
   */
  function remove(projectId, ownerUserId) {
    return repo.run(() => statements.deleteOwned.run(projectId, ownerUserId).changes > 0);
  }

  /**
   * Daftar proyek dalam trash yang sudah melewati waktu retensi.
   * @param {{now?: string, limit?: number}} [options]
   */
  function listTrashDue(options = {}) {
    return statements.listTrashDue.all({
      now: options.now ?? repo.now(),
      limit: Math.min(Math.max(options.limit ?? 100, 1), 500),
    });
  }

  return {
    name: repo.name,
    create,
    findOwned,
    findByIdForSystem,
    listByOwner,
    searchByOwner,
    rename,
    setStatus,
    setLifecycleState,
    countActiveByOwner,
    remove,
    listTrashDue,
  };
}