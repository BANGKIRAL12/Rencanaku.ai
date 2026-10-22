import { createRepository, requireText, toCamelCase, toCamelCaseAll } from './base.js';

/**
 * Repository tabel `messages` (ARCHITECTURE §6.2, §7.1).
 *
 * - Penulisan pesan dan pembaruan statistik percakapan selalu dalam satu
 *   transaksi (lihat `createWithSequence`).
 * - `sequence` dihitung dari nilai maksimum percakapan sehingga urutan
 *   stabil dan tidak bentrok (dijaga UNIQUE (conversation_id, sequence)).
 * - Setiap pembacaan wajib melalui `findOwned`/`listByConversation`
 *   dengan `ownerUserId` dari server.
 */

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{now?: () => string, newId?: () => string}} [injected]
 */
export function createMessagesRepository(db, injected = {}) {
  const repo = createRepository(db, 'messages', injected);

  const statements = {
    insert: db.prepare(`
      INSERT INTO messages (
        id, conversation_id, project_id, owner_user_id, role, status,
        content, content_format, sequence, job_id, error_code,
        safe_error_message, created_at, updated_at
      ) VALUES (
        @id, @conversationId, @projectId, @ownerUserId, @role, @status,
        @content, @contentFormat, @sequence, @jobId, @errorCode,
        @safeErrorMessage, @createdAt, @updatedAt
      )
    `),
    nextSequence: db.prepare(`
      SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence
        FROM messages
       WHERE conversation_id = ?
    `),
    byIdAndOwner: db.prepare(
      'SELECT * FROM messages WHERE id = ? AND owner_user_id = ?',
    ),
    byConversation: db.prepare(`
      SELECT * FROM messages
       WHERE conversation_id = ? AND owner_user_id = ?
       ORDER BY sequence ASC
       LIMIT @limit OFFSET @offset
    `),
    updateStatus: db.prepare(`
      UPDATE messages
         SET status = @status,
             error_code = @errorCode,
             safe_error_message = @safeErrorMessage,
             updated_at = @updatedAt
       WHERE id = @id AND owner_user_id = @ownerUserId
    `),
    appendContent: db.prepare(`
      UPDATE messages
         SET content = @content,
             status = @status,
             updated_at = @updatedAt
       WHERE id = @id AND owner_user_id = @ownerUserId
    `),
    deleteOwned: db.prepare(
      'DELETE FROM messages WHERE id = ? AND owner_user_id = ?',
    ),
    countByConversation: db.prepare(
      'SELECT COUNT(*) AS total FROM messages WHERE conversation_id = ?',
    ),
  };

  /**
   * @param {Record<string, unknown> | undefined} row
   */
  function mapMessage(row) {
    return toCamelCase(row);
  }

  /**
   * Simpan pesan baru dengan urutan otomatis.
   * Wajib dipanggil di dalam `runInTransaction` bersama pembaruan statistik
   * percakapan; pemanggil bertanggung jawab menjaga atomicitas.
   *
   * @param {{
   *   conversationId: string,
   *   projectId: string,
   *   ownerUserId: string,
   *   role: 'user'|'assistant'|'system'|'tool',
   *   content?: string,
   *   contentFormat?: 'markdown'|'text'|'json',
   *   status?: 'pending'|'streaming'|'complete'|'failed'|'cancelled',
   *   jobId?: string | null,
   *   errorCode?: string | null,
   *   safeErrorMessage?: string | null,
   *   id?: string,
   * }} input
   */
  function createWithSequence(input) {
    const timestamp = repo.now();
    const id = input.id ?? repo.newId();
    return repo.run(() => {
      const conversationId = requireText(input.conversationId, 'conversationId');
      const sequence = statements.nextSequence.get(conversationId).next_sequence;
      statements.insert.run({
        id,
        conversationId,
        projectId: requireText(input.projectId, 'projectId'),
        ownerUserId: requireText(input.ownerUserId, 'ownerUserId'),
        role: input.role,
        status: input.status ?? 'complete',
        content: input.content ?? '',
        contentFormat: input.contentFormat ?? 'markdown',
        sequence,
        jobId: input.jobId ?? null,
        errorCode: input.errorCode ?? null,
        safeErrorMessage: input.safeErrorMessage ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return mapMessage(statements.byIdAndOwner.get(id, input.ownerUserId));
    });
  }

  /**
   * @param {string} messageId
   * @param {string} ownerUserId
   */
  function findOwned(messageId, ownerUserId) {
    return mapMessage(statements.byIdAndOwner.get(messageId, ownerUserId));
  }

  /**
   * @param {string} conversationId
   * @param {string} ownerUserId
   * @param {{limit?: number, offset?: number}} [options]
   */
  function listByConversation(conversationId, ownerUserId, options = {}) {
    return toCamelCaseAll(
      statements.byConversation.all(conversationId, ownerUserId, {
        limit: Math.min(Math.max(options.limit ?? 100, 1), 500),
        offset: Math.max(options.offset ?? 0, 0),
      }),
    );
  }

  /**
   * @param {string} messageId
   * @param {string} ownerUserId
   * @param {{status: string, errorCode?: string | null, safeErrorMessage?: string | null}} input
   */
  function updateStatus(messageId, ownerUserId, input) {
    const timestamp = repo.now();
    return repo.run(() => {
      const result = statements.updateStatus.run({
        id: messageId,
        ownerUserId,
        status: input.status,
        errorCode: input.errorCode ?? null,
        safeErrorMessage: input.safeErrorMessage ?? null,
        updatedAt: timestamp,
      });
      return result.changes === 0 ? null : mapMessage(statements.byIdAndOwner.get(messageId, ownerUserId));
    });
  }

  /**
   * Ganti konten pesan (mis. streaming AI yang sudah selesai).
   * @param {string} messageId
   * @param {string} ownerUserId
   * @param {{content: string, status?: string}} input
   */
  function replaceContent(messageId, ownerUserId, input) {
    const timestamp = repo.now();
    return repo.run(() => {
      const result = statements.appendContent.run({
        id: messageId,
        ownerUserId,
        content: input.content ?? '',
        status: input.status ?? 'complete',
        updatedAt: timestamp,
      });
      return result.changes === 0 ? null : mapMessage(statements.byIdAndOwner.get(messageId, ownerUserId));
    });
  }

  /**
   * @param {string} messageId
   * @param {string} ownerUserId
   */
  function remove(messageId, ownerUserId) {
    return repo.run(() => statements.deleteOwned.run(messageId, ownerUserId).changes > 0);
  }

  /**
   * @param {string} conversationId
   * @param {string} ownerUserId
   */
  function countByConversation(conversationId, ownerUserId) {
    void ownerUserId;
    return statements.countByConversation.get(conversationId).total;
  }

  return {
    name: repo.name,
    createWithSequence,
    findOwned,
    listByConversation,
    updateStatus,
    replaceContent,
    remove,
    countByConversation,
  };
}