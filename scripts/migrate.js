#!/usr/bin/env node
/**
 * `npm run db:migrate` — menjalankan migrasi skema.
 *
 * Pilihan:
 * - `--status` hanya menampilkan status tanpa mengubah apa pun.
 * - `--verify` hanya memverifikasi checksum migrasi yang sudah diterapkan.
 * - `--to=<id>` menjalankan migrasi sampai ID tertentu (dipakai prosedur
 *   update bertahap, bukan untuk rollback).
 *
 * Exit code: 0 sukses, 1 gagal. Tidak pernah mencetak nilai rahasia.
 */
import process from 'node:process';
import { config } from '../src/config/env.js';
import { assertDataPathsArePrivate, resolveDataPaths } from '../src/config/paths.js';
import { describeConnection, openConfiguredDatabase } from '../src/db/connection.js';
import {
  getMigrationStatus,
  runMigrations,
  verifyAppliedMigrations,
} from '../src/db/migrate.js';
import { ensureDataDirectories } from '../src/modules/storage/data-directory.js';

const args = process.argv.slice(2);
const wantsStatus = args.includes('--status');
const wantsVerify = args.includes('--verify');
const upToArg = args.find((arg) => arg.startsWith('--to='));
const upTo = upToArg ? upToArg.slice('--to='.length) : undefined;

function printStatus(status) {
  console.log('Status skema database:');
  console.log(`  versi saat ini : ${status.currentVersion ?? '(belum ada migrasi)'}`);
  console.log(`  versi terbaru  : ${status.latestVersion ?? '(tidak ada migrasi)'}`);
  console.log(`  sudah diterapkan: ${status.applied.length}`);
  console.log(`  belum diterapkan: ${status.pending.length}`);
  for (const migration of status.pending) {
    console.log(`    - ${migration.id}`);
  }
}

let exitCode = 0;
let db = null;

try {
  const paths = assertDataPathsArePrivate(resolveDataPaths(config));

  if (wantsStatus) {
    db = openConfiguredDatabase(config);
    const status = getMigrationStatus(db);
    printStatus(status);
    const connection = describeConnection(db);
    console.log(
      `  mode jurnal     : ${connection.journalMode} (sqlite ${connection.sqliteVersion})`,
    );
    if (!status.upToDate) {
      console.log('\nJalankan "npm run db:migrate" untuk menerapkan migrasi.');
      exitCode = 1;
    }
  } else if (wantsVerify) {
    db = openConfiguredDatabase(config);
    const applied = verifyAppliedMigrations(db);
    console.log(
      `Checksum ${applied.length} migrasi sudah sesuai dengan berkas aslinya.`,
    );
  } else {
    const directoryReport = ensureDataDirectories(paths);
    if (!directoryReport.ok) {
      console.error('Direktori data tidak dapat disiapkan. Perbaiki izin lalu jalankan ulang.');
      process.exit(1);
    }

    db = openConfiguredDatabase(config);
    const result = runMigrations(db, {
      upTo,
      appVersion: process.env.npm_package_version ?? null,
    });

    if (result.applied.length === 0) {
      console.log('Skema database sudah terbaru. Tidak ada migrasi yang diterapkan.');
    } else {
      console.log(`Migrasi diterapkan: ${result.applied.length}`);
      for (const id of result.applied) console.log(`  + ${id}`);
    }
    printStatus(getMigrationStatus(db));
  }
} catch (error) {
  console.error(`Migrasi gagal: ${error.message}`);
  if (error.cause) console.error(`Penyebab: ${error.cause.message}`);
  exitCode = 1;
} finally {
  if (db?.open) db.close();
}

process.exit(exitCode);