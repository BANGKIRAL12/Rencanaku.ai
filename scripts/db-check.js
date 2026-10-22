#!/usr/bin/env node
/**
 * `npm run db:check` — pemeriksaan integritas database dan penyimpanan.
 *
 * Pemeriksaan yang dijalankan:
 * - koneksi terbuka dan `PRAGMA foreign_keys` aktif,
 * - `PRAGMA integrity_check` dan `PRAGMA foreign_key_check`,
 * - status migrasi dan checksum migrasi yang sudah diterapkan,
 * - keberadaan direktori data dan izinnya,
 * - file aktif yang hilang, checksum tidak cocok, file yatim, dan record
 *   `pending` yang menggantung.
 *
 * Exit code: 0 bila tidak ada kegagalan, 1 bila ada.
 */
import process from 'node:process';
import { config } from '../src/config/env.js';
import { assertDataPathsArePrivate, resolveDataPaths } from '../src/config/paths.js';
import { createRepositories } from '../src/db/repositories/index.js';
import { openConfiguredDatabase } from '../src/db/connection.js';
import { ensureDataDirectories } from '../src/modules/storage/data-directory.js';
import { runIntegrityChecks } from '../src/modules/storage/storage-integrity.js';
import { getMigrationStatus } from '../src/db/migrate.js';

const ICONS = { pass: '[OK]  ', warn: '[WARN]', fail: '[FAIL]' };

let exitCode = 0;
let db = null;

try {
  const paths = assertDataPathsArePrivate(resolveDataPaths(config));
  ensureDataDirectories(paths);
  db = openConfiguredDatabase(config);

  const repositories = createRepositories(db);
  const report = await runIntegrityChecks({
    db,
    filesDir: paths.directories.files,
    paths,
    repositories,
    expectedSchemaVersion: getMigrationStatus(db).latestVersion ?? undefined,
  });

  console.log('--- Pemeriksaan integritas Rencanaku.ai ---');
  for (const item of report.checks) {
    console.log(`${ICONS[item.status] ?? '[----]'} ${item.id}: ${item.message}`);
  }
  console.log('--- Ringkasan ---');
  for (const line of report.summary) console.log(line);
  if (!report.ok) exitCode = 1;
} catch (error) {
  console.error(`Pemeriksaan integritas gagal dijalankan: ${error.message}`);
  if (error.cause) console.error(`Penyebab: ${error.cause.message}`);
  exitCode = 1;
} finally {
  if (db?.open) db.close();
}

process.exit(exitCode);