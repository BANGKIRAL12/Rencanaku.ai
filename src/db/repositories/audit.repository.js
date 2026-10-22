import {
  RepositoryError,
  createRepository,
  requireText,
  toCamelCase,
  toCamelCaseAll,
} from './base.js';

/**
 * Repository tabel `audit_events` (ARCHITECTURE §11.2, §7.1).
 *
 * Aturan isi (ARCHITECTURE §10.3 dan §11.3):
 * - Hanya metadata minimum: siapa, apa, kapan, hasil.
 * - Tidak boleh ada isi percakapan, isi attachment, password, API key,
 *   token sesi, atau path rahasia pada `metadata`.
 * - Nilai `ip_hash` harus berupa hash, bukan alamat IP mentah.
 */

const FORBIDDEN_METADATA_KEY =
  /(pass(word)?|secret|token|api[-_]?key|authorization|cookie|session|csrf|credential|private[-_]?key)/i;

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{now?: () => string, newId?: () => string}} [injected]
 */
export function createAuditRepository(db, injected = {}) {
  const repo = createRepository(db, 'audit_events', injected);

  const statements = {
    insert: db.prepare(`
      INSERT INTO audit_events (
        id, actor_user_id, actor_role, action, target_type, target_id,
        project_id, outcome, ip_hash, request_id, metadata, created_at
      ) VALUES (
        @id, @actorUserId, @actorRole, @action, @targetType, @targetId,
        @projectId, @outcome, @ipHash, @requestId, @metadata, @createdAt
      )
    `),
    listByActor: db.prepare(`
      SELECT * FROM audit_events
       WHERE actor_user_id = ?
       ORDER BY created_at DESC, id ASC
       LIMIT ? OFFSET ?
    `),
    listByAction: db.prepare(`
      SELECT * FROM audit_events
       WHERE action = ?
       ORDER BY created_at DESC, id ASC
       LIMIT ? OFFSET ?
    `),
    listByProject: db.prepare(`
      SELECT * FROM audit_events
       WHERE project_id = ?
       ORDER BY created_at DESC, id ASC
       LIMIT ? OFFSET ?
    `),
    byId: db.prepare('SELECT * FROM audit_events WHERE id = ?'),
    countAll: db.prepare('SELECT COUNT(*) AS total FROM audit_events'),
  };

  /**
   * @param {Record<string, unknown> | undefined} row
   */
  function mapEvent(row) {
    const event = toCamelCase(row);
    if (!event) return null;
    let metadata = null;
    if (event.metadata) {
      try {
        metadata = JSON.parse(event.metadata);
      } catch {
        metadata = null;
      }
    }
    return { ...event, metadata };
  }

  /**
   * Tolak kunci metadata yang terlihat seperti rahasia (pengaman kedua
   * setelah redaksi logger).
   * @param {Record<string, unknown> | null | undefined} metadata
   */
  function assertMetadataSafe(metadata) {
    if (!metadata || typeof metadata !== 'object') return;
    for (const key of Object.keys(metadata)) {
      if (FORBIDDEN_METADATA_KEY.test(key)) {
        throw new RepositoryError(
          'Metadata audit tidak boleh memuat kunci yang menyerupai rahasia.',
          { code: 'AUDIT_METADATA_FORBIDDEN', status: 400 },
        );
      }
    }
  }

  /**
   * Catat peristiwa audit.
   *
   * @param {{
   *   action: string,
   *   actorUserId?: string | null,
   *   actorRole?: string | null,
   *   targetType?: string | null,
   *   targetId?: string | null,
   *   projectId?: string | null,
   *   outcome?: 'success'|'failure',
   *   ipHash?: string | null,
   *   requestId?: string | null,
   *   metadata?: Record<string, unknown> | null,
   *   createdAt?: string,
   *   id?: string,
   * }} input
   */
  function record(input) {
    assertMetadataSafe(input.metadata);
    const timestamp = repo.now();
    return repo.run(() => {
      const id = input.id ?? repo.newId();
      statements.insert.run({
        id,
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole ?? null,
        action: requireText(input.action, 'action', { maxLength: 120 }),
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        projectId: input.projectId ?? null,
        outcome: input.outcome ?? 'success',
        ipHash: input.ipHash ?? null,
        requestId: input.requestId ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        createdAt: input.createdAt ?? timestamp,
      });
      return mapEvent(statements.byId.get(id));
    });
  }

  /**
   * @param {string} actorUserId
   * @param {{limit?: number, offset?: number}} [options]
   */
  function listByActor(actorUserId, options = {}) {
    return toCamelCaseAll(
      statements.listByActor.all(actorUserId, options.limit ?? 100, options.offset ?? 0),
    ).map((row) => ({ ...row, metadata: mapEvent(row).metadata }));
  }

  /**
   * @param {string} action
   * @param {{limit?: number, offset?: number}} [options]
   */
  function listByAction(action, options = {}) {
    return toCamelCaseAll(
      statements.listByAction.all(action, options.limit ?? 100, options.offset ?? 0),
    ).map((row) => ({ ...row, metadata: mapEvent(row).metadata }));
  }

  /**
   * @param {string} projectId
   * @param {{limit?: number, offset?: number}} [options]
   */
  function listByProject(projectId, options = {}) {
    return toCamelCaseAll(
      statements.listByProject.all(projectId, options.limit ?? 100, options.offset ?? 0),
    ).map((row) => ({ ...row, metadata: mapEvent(row).metadata }));
  }

  /** @returns {number} */
  function count() {
    return statements.countAll.get().total;
  }

  return { name: repo.name, record, listByActor, listByAction, listByProject, count };
}