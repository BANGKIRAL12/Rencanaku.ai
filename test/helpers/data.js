import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO_ROOT, resolveDataPaths } from '../../src/config/paths.js';
import { openDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrate.js';
import { createRepositories } from '../../src/db/repositories/index.js';
import { ensureDataDirectories } from '../../src/modules/storage/data-directory.js';
import { createFileStorage } from '../../src/modules/storage/file-storage.js';

/**
 * Helper pengujian untuk lapisan persistensi (Fase 2).
 *
 * Semua workspace tes memakai direktori sementara di luar repositori dan
 * TIDAK pernah membaca `.env` pengembang. Tidak ada kredensial nyata di
 * fixture: nilai yang dipakai hanya string sintetis.
 */

/** Basis direktori sementara yang diizinkan lingkungan. */
const TEMP_BASE = fs.existsSync('/tmp/opencode') ? '/tmp/opencode' : os.tmpdir();

/**
 * Buat workspace data sementara berisi seluruh direktori data.
 *
 * @param {{migrate?: boolean, prefix?: string}} [options]
 * @returns {{
 *   root: string,
 *   dataDir: string,
 *   paths: ReturnType<typeof resolveDataPaths>,
 *   db: import('better-sqlite3').Database,
 *   repositories: ReturnType<typeof createRepositories>,
 *   fileStorage: ReturnType<typeof createFileStorage>,
 *   cleanup: () => void,
 * }}
 */
export function createTestWorkspace(options = {}) {
  const root = fs.mkdtempSync(path.join(TEMP_BASE, options.prefix ?? 'rencanaku-f2-'));
  const dataDir = path.join(root, 'data');

  const paths = resolveDataPaths(
    { DATA_DIR: dataDir, DATABASE_URL: 'file:app.sqlite', FILE_STORAGE_PATH: 'files' },
    { repoRoot: REPO_ROOT },
  );

  ensureDataDirectories(paths);

  const db = openDatabase({
    databasePath: paths.database.path,
    journalMode: 'wal',
    busyTimeoutMs: 2000,
  });

  if (options.migrate === false) {
    // Tanpa skema, repository tidak dapat disiapkan prepared statement-nya.
    return {
      root,
      dataDir,
      paths,
      db,
      repositories: null,
      fileStorage: null,
      cleanup() {
        if (db.open) db.close();
        fs.rmSync(root, { recursive: true, force: true });
      },
    };
  }

  runMigrations(db);

  const repositories = createRepositories(db);
  const fileStorage = createFileStorage({
    filesDir: paths.directories.files,
    tempDir: paths.directories.temp,
    repositories,
  });

  return {
    root,
    dataDir,
    paths,
    db,
    repositories,
    fileStorage,
    cleanup() {
      if (db.open) db.close();
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

/**
 * Jam deterministik untuk menguji timestamp tanpa menunggu waktu nyata.
 * @param {string} [startIso]
 */
export function fixedClock(startIso = '2026-10-22T09:00:00.000Z') {
  let current = Date.parse(startIso);
  return {
    now: () => {
      const value = new Date(current).toISOString();
      current += 1000;
      return value;
    },
  };
}

/**
 * ID berurutan agar assertion dapat dikunci.
 * @param {string} [prefix]
 */
export function sequentialIds(prefix = '00000000-0000-4000-8000-000000000000') {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix.slice(0, 24)}${String(counter).padStart(12, '0')}`;
  };
}

/**
 * Buat pengguna + proyek + percakapan minimal untuk pengujian yang
 * membutuhkan konteks kepemilikan.
 *
 * @param {ReturnType<typeof createRepositories>} repositories
 * @param {{username?: string, role?: 'admin'|'member'}} [options]
 */
export function seedProjectFixture(repositories, options = {}) {
  const user = repositories.users.create({
    username: options.username ?? 'pemilik',
    displayName: 'Pemilik Proyek',
    passwordHash: 'scrypt$N=16384$r=8$p=1$c2FsdA$aGFzaA',
    role: options.role ?? 'member',
  });

  const project = repositories.projects.create({
    ownerUserId: user.id,
    name: 'Proyek Uji',
    description: 'Proyek untuk pengujian.',
  });

  const conversation = repositories.conversations.create({
    projectId: project.id,
    ownerUserId: user.id,
    title: 'Percakapan awal',
    isDefault: true,
  });

  return { user, project, conversation };
}

/**
 * Hitung SHA-256 dari data untuk membandingkan dengan checksum yang
 * disimpan FileStorageService.
 *
 * @param {string | Buffer} data
 * @returns {string} Hex digest sha256.
 */
export function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}