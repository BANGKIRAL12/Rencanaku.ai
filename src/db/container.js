import { config as defaultConfig } from '../config/env.js';
import {
  assertDataPathsArePrivate,
  resolveDataPaths,
} from '../config/paths.js';
import { initDatabase, openConfiguredDatabase } from './connection.js';
import { getMigrationStatus, runMigrations } from './migrate.js';
import { createRepositories } from './repositories/index.js';

/**
 * Container persistensi: satu-satunya tempat yang merangkai koneksi,
 * migrasi, dan repository.
 *
 * Proses aplikasi (HTTP) dan CLI memakai container yang sama sehingga
 * tidak ada duplikasi logika (ARCHITECTURE §5.1 aturan 8).
 */

/**
 * @typedef {object} DatabaseContainer
 * @property {import('better-sqlite3').Database} db
 * @property {ReturnType<typeof createRepositories>} repositories
 * @property {ReturnType<typeof resolveDataPaths>} paths
 * @property {ReturnType<typeof getMigrationStatus>} migrationStatus
 * @property {() => void} close
 */

/**
 * Buka container untuk pengujian/proses pendek: koneksi sendiri yang harus
 * ditutup pemanggil.
 *
 * @param {{
 *   config?: import('../config/schema.js').AppConfig,
 *   cwd?: string,
 *   repoRoot?: string,
 *   migrate?: boolean,
 *   now?: () => string,
 *   newId?: () => string,
 * }} [options]
 * @returns {DatabaseContainer & {close: () => void}}
 */
export function createDatabaseContainer(options = {}) {
  const config = options.config ?? defaultConfig;
  const paths = assertDataPathsArePrivate(
    resolveDataPaths(config, { cwd: options.cwd ?? process.cwd(), repoRoot: options.repoRoot }),
  );

  const db = openConfiguredDatabase(config, { cwd: options.cwd ?? process.cwd(), repoRoot: options.repoRoot });
  let repositories;
  let migrationStatus;

  try {
    if (options.migrate) {
      runMigrations(db, { appVersion: options.appVersion ?? null });
    }
    repositories = createRepositories(db, { now: options.now, newId: options.newId });
    migrationStatus = getMigrationStatus(db);
  } catch (cause) {
    db.close();
    throw cause;
  }

  return {
    db,
    repositories,
    paths,
    migrationStatus,
    close() {
      db.close();
    },
  };
}

/**
 * Container proses: memakai koneksi bersama (`initDatabase`) sehingga
 * hanya ada satu koneksi SQLite di seluruh proses.
 *
 * @param {{config?: import('../config/schema.js').AppConfig, migrate?: boolean}} [options]
 * @returns {DatabaseContainer}
 */
export function getDatabaseContainer(options = {}) {
  const config = options.config ?? defaultConfig;
  const db = initDatabase(config);
  const paths = assertDataPathsArePrivate(resolveDataPaths(config));

  if (options.migrate) {
    runMigrations(db, { appVersion: options.appVersion ?? null });
  }

  return {
    db,
    repositories: createRepositories(db),
    paths,
    migrationStatus: getMigrationStatus(db),
    close() {
      // Ditutup oleh closeDatabase() dari connection.js.
    },
  };
}