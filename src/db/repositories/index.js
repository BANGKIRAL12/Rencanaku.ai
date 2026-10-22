import { createAuditRepository } from './audit.repository.js';
import { createConversationsRepository } from './conversations.repository.js';
import { createMessagesRepository } from './messages.repository.js';
import { createProjectsRepository } from './projects.repository.js';
import { createSessionsRepository } from './sessions.repository.js';
import { createSettingsRepository } from './settings.repository.js';
import { createStoredFilesRepository } from './stored-files.repository.js';
import { createUsersRepository } from './users.repository.js';

/**
 * Titik masuk tunggal untuk layer persistensi.
 *
 * Route dan modul TIDAK pernah membuat repository sendiri; semuanya
 * menerima `repositories` yang dibuat sekali per proses di
 * `src/db/container.js`. Dengan begitu hanya ada satu kumpulan prepared
 * statement per koneksi dan mudah dipalsukan di tes.
 */

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{now?: () => string, newId?: () => string}} [injected]
 *   Injeksi `now`/`newId` dipakai tes agar timestamp dan ID deterministik.
 */
export function createRepositories(db, injected = {}) {
  return Object.freeze({
    db,
    users: createUsersRepository(db, injected),
    sessions: createSessionsRepository(db, injected),
    projects: createProjectsRepository(db, injected),
    conversations: createConversationsRepository(db, injected),
    messages: createMessagesRepository(db, injected),
    settings: createSettingsRepository(db, injected),
    audit: createAuditRepository(db, injected),
    storedFiles: createStoredFilesRepository(db, injected),
  });
}

export {
  createAuditRepository,
  createConversationsRepository,
  createMessagesRepository,
  createProjectsRepository,
  createSessionsRepository,
  createSettingsRepository,
  createStoredFilesRepository,
  createUsersRepository,
};