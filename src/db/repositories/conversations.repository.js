import { createRepository, requireText, toCamelCase, toCamelCaseAll } from './base.js';

/**
 * Repository tabel `conversations` (ARCHITECTURE §6.2).
 *
 * Percakapan selalu punya satu proyek dan satu owner. Trigger database
 * (`trg_conversations_owner_matches_project_*`) menolak INSERT/UPDATE yang
 * owner-nya tidak sama dengan owner proyek, sehingga kesalahan pada
 * lapisan use case tidak dapat bocor lintas akun.
 */

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{now?: () => string, newId?: () => string}} [injected]
 */
export function createConversationsRepository(db, injected = {}) {
  const repo = createRepository(db, 'conversations', injected);

  const statements = {
    insert: db.prepare(`
      INSERT INTO conversations (
        id, project_id, owner_user_id, title, status, is_default,
        created_at, updated_at
      ) VALUES (
        @id, @projectId, @ownerUserId, @title, @status, @isDefault,
        @createdAt, @updatedAt
      )
    `),
    byIdAndOwner: db.prepare(
      'SELECT * FROM conversations WHERE id = ? AND owner_user_id = ?',
    ),
    byId: db.prepare('SELECT * FROM conversations WHERE id = ?'),
    byProject: db.prepare(`
      SELECT * FROM conversations
       WHERE project_id = ? AND owner_user_id = ?
       ORDER BY is_default DESC, last_message_at DESC, created_at ASC
    `),
    defaultByProject: db.prepare(`
      SELECT * FROM conversations
       WHERE project_id = ? AND owner_user_id = ? AND is_default = 1
    `),
    updateMeta: db.prepare(`
      UPDATE conversations
         SET title = @title, status = @status, updated_at = @updatedAt
       WHERE id = @id AND owner_user_id = @ownerUserId
    `),
    bumpStats: db.prepare(`
      UPDATE conversations
         SET message_count = message_count + @delta,
             last_message_at = @lastMessageAt,
             updated_at = @updatedAt
       WHERE id = @id
    `),
    deleteOwned: db.prepare(
      'DELETE FROM conversations WHERE id = ? AND owner_user_id = ?',
    ),
    countByProject: db.prepare(
      'SELECT COUNT(*) AS total FROM conversations WHERE project_id = ? AND owner_user_id = ?',
    ),
  };

  /**
   * @param {Record<string, unknown> | undefined} row
   */
  function mapConversation(row) {
    const conversation = toCamelCase(row);
    if (!conversation) return null;
    return { ...conversation, isDefault: conversation.isDefault === 1 };
  }

  /**
   * Buat percakapan. `ownerUserId` harus sama dengan owner proyek; bila
   * tidak, trigger database menolak dengan pesan yang aman.
   *
   * @param {{projectId: string, ownerUserId: string, title?: string | null, isDefault?: boolean, id?: string}} input
   */
  function create(input) {
    const timestamp = repo.now();
    const id = input.id ?? repo.newId();
    return repo.run(() => {
      const projectId = requireText(input.projectId, 'projectId');
      const ownerUserId = requireText(input.ownerUserId, 'ownerUserId');

      if (input.isDefault) {
        // Hanya satu percakapan default per proyek (uniksi parsial di migrasi).
        const current = statements.defaultByProject.get(projectId, ownerUserId);
        if (current) {
          db.prepare(
            'UPDATE conversations SET is_default = 0, updated_at = ? WHERE id = ?',
          ).run(timestamp, current.id);
        }
      }

      statements.insert.run({
        id,
        projectId,
        ownerUserId,
        title: input.title ?? null,
        status: 'active',
        isDefault: input.isDefault ? 1 : 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return mapConversation(statements.byId.get(id));
    });
  }

  /**
   * Ambil percakapan default proyek; buat bila belum ada.
   * Ini jalur "proyek dimulai dari chat kosong" (Fase 4).
   *
   * @param {string} projectId
   * @param {string} ownerUserId
   * @param {{title?: string | null}} [options]
   */
  function ensureDefault(projectId, ownerUserId, options = {}) {
    const existing = statements.defaultByProject.get(projectId, ownerUserId);
    if (existing) return mapConversation(existing);
    return create({
      projectId,
      ownerUserId,
      title: options.title ?? null,
      isDefault: true,
    });
  }

  /**
   * @param {string} conversationId
   * @param {string} ownerUserId
   */
  function findOwned(conversationId, ownerUserId) {
    return mapConversation(statements.byIdAndOwner.get(conversationId, ownerUserId));
  }

  /**
   * @param {string} projectId
   * @param {string} ownerUserId
   */
  function listByProject(projectId, ownerUserId) {
    return toCamelCaseAll(statements.byProject.all(projectId, ownerUserId)).map(
      (row) => ({ ...row, isDefault: row.isDefault === 1 }),
    );
  }

  /**
   * @param {string} conversationId
   * @param {string} ownerUserId
   * @param {{title?: string | null, status?: 'active'|'archived'}} input
   */
  function update(conversationId, ownerUserId, input) {
    const timestamp = repo.now();
    return repo.run(() => {
      const existing = mapConversation(statements.byIdAndOwner.get(conversationId, ownerUserId));
      if (!existing) return null;
      const result = statements.updateMeta.run({
        id: conversationId,
        ownerUserId,
        title: input.title === undefined ? existing.title : input.title,
        status: input.status ?? existing.status,
        updatedAt: timestamp,
      });
      return result.changes === 0
        ? null
        : mapConversation(statements.byIdAndOwner.get(conversationId, ownerUserId));
    });
  }

  /**
   * Perbarui penghitung pesan. Dipanggil di dalam transaksi yang sama
   * dengan INSERT messages supaya statistik tidak melenceng.
   *
   * @param {string} conversationId
   * @param {{delta?: number, lastMessageAt?: string}} [options]
   */
  function bumpMessageStats(conversationId, options = {}) {
    const timestamp = repo.now();
    return repo.run(() =>
      statements.bumpStats.run({
        id: conversationId,
        delta: options.delta ?? 1,
        lastMessageAt: options.lastMessageAt ?? timestamp,
        updatedAt: timestamp,
      }).changes > 0,
    );
  }

  /**
   * @param {string} conversationId
   * @param {string} ownerUserId
   */
  function remove(conversationId, ownerUserId) {
    return repo.run(() => statements.deleteOwned.run(conversationId, ownerUserId).changes > 0);
  }

  /**
   * @param {string} projectId
   * @param {string} ownerUserId
   */
  function countByProject(projectId, ownerUserId) {
    return statements.countByProject.get(projectId, ownerUserId).total;
  }

  return {
    name: repo.name,
    create,
    ensureDefault,
    findOwned,
    listByProject,
    update,
    bumpMessageStats,
    remove,
    countByProject,
  };
}