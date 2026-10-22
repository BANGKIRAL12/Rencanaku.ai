#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import Database from 'better-sqlite3';
import { config } from '../src/config/env.js';
import {
  assertDataPathsArePrivate,
  resolveDataPaths,
} from '../src/config/paths.js';
import { openConfiguredDatabase } from '../src/db/connection.js';
import { getMigrationStatus, verifyAppliedMigrations } from '../src/db/migrate.js';
import { createRepositories } from '../src/db/repositories/index.js';
import { ensureDataDirectories } from '../src/modules/storage/data-directory.js';
import { runIntegrityChecks } from '../src/modules/storage/storage-integrity.js';

console.log('--- Menjalankan Doctor Rencanaku.ai ---');

// 1. Verifikasi Versi Node
const currentVersion = process.version.replace(/^v/, '');
const nvmrcPath = path.resolve('.nvmrc');
if (fs.existsSync(nvmrcPath)) {
  const targetVersion = fs.readFileSync(nvmrcPath, 'utf8').trim();
  if (currentVersion === targetVersion) {
    console.log(`[OK] Versi Node (${process.version}) cocok dengan .nvmrc (${targetVersion})`);
  } else {
    console.warn(`[WARN] Versi Node (${process.version}) berbeda dengan .nvmrc (${targetVersion})`);
  }
} else {
  console.warn('[WARN] File .nvmrc tidak ditemukan');
}

// 2. Verifikasi better-sqlite3 Native Addon
try {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE doctor_test (id INTEGER PRIMARY KEY, item TEXT)');
  const insert = db.prepare('INSERT INTO doctor_test (item) VALUES (?)');
  insert.run('koneksi_db_sukses');
  const row = db.prepare('SELECT item FROM doctor_test WHERE id = 1').get();
  db.close();
  if (row && row.item === 'koneksi_db_sukses') {
    console.log('[OK] better-sqlite3 berjalan normal (in-memory test lulus)');
  } else {
    throw new Error('Hasil query in-memory tidak sesuai');
  }
} catch (err) {
  console.error('[FAIL] better-sqlite3 gagal dijalankan:', err.message);
  process.exit(1);
}

// 3. Verifikasi ESM Mode
if (import.meta.url) {
  console.log('[OK] ESM runtime aktif');
}

// 4. Verifikasi konfigurasi path data (tidak boleh di dalam root statis publik)
let paths;
try {
  paths = assertDataPathsArePrivate(resolveDataPaths(config));
  const label = path.relative(process.cwd(), paths.dataDir) || '.';
  console.log(`[OK] Path data tervalidasi (akar data: ${label})`);
} catch (err) {
  console.error('[FAIL] Konfigurasi path data tidak aman:', err.message);
  process.exit(1);
}

// 5. Verifikasi direktori data beserta izinnya
const directoryReport = ensureDataDirectories(paths);
if (directoryReport.ok) {
  console.log('[OK] Direktori data siap dengan izin 700');
} else {
  for (const dir of directoryReport.directories.filter((d) => !d.ok)) {
    console.error(`[FAIL] Direktori ${dir.path}: ${dir.issues.join(' ')}`);
  }
  process.exit(1);
}

// 6. Verifikasi koneksi, skema, migrasi, dan integritas penyimpanan
let db = null;
try {
  db = openConfiguredDatabase(config);
  const repositories = createRepositories(db);
  const status = getMigrationStatus(db);
  verifyAppliedMigrations(db);

  const journalMode = db.pragma('journal_mode', { simple: true });
  const foreignKeys = db.pragma('foreign_keys', { simple: true });
  console.log(
    `[OK] Koneksi database terbuka (mode jurnal: ${journalMode}, foreign_keys: ${foreignKeys})`,
  );

  if (status.upToDate) {
    console.log(`[OK] Skema database terbaru (${status.latestVersion})`);
  } else {
    console.warn(
      `[WARN] Ada ${status.pending.length} migrasi belum diterapkan. Jalankan "npm run db:migrate".`,
    );
  }

  const report = await runIntegrityChecks({
    db,
    filesDir: paths.directories.files,
    paths,
    repositories,
  });

  for (const item of report.checks.filter((c) => c.status !== 'pass')) {
    console.error(`${item.status === 'fail' ? '[FAIL]' : '[WARN]'} ${item.id}: ${item.message}`);
  }

  if (!report.ok) {
    process.exit(1);
  }
  console.log('[OK] Integritas database dan penyimpanan lulus');
} catch (err) {
  console.error('[FAIL] Pemeriksaan database gagal:', err.message);
  process.exit(1);
} finally {
  if (db?.open) db.close();
}

console.log('--- Doctor selesai: Lingkungan siap digunakan ---');