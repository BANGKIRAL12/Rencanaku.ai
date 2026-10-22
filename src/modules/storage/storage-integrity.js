import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { logger } from '../../core/logger/index.js';
import { describeConnection } from '../../db/connection.js';
import { getMigrationStatus, listAppliedMigrations } from '../../db/migrate.js';
import { verifyDataDirectories } from './data-directory.js';

/**
 * Pemeriksaan integritas database dan penyimpanan.
 *
 * Dipakai oleh `scripts/db-check.js`, `npm run doctor`, dan akan dipakai
 * lagi oleh restore (Fase 9) serta health monitor.
 *
 * Prinsip output:
 * - Hanya nilai yang aman ditampilkan. Path absolut tidak pernah ikut,
 *   laporan memakai nama relatif atau label.
 * - Setiap pemeriksaan punya `id` stabil agar tes dapat mengunci perilakunya.
 * - Tidak ada pemeriksaan yang memperbaiki data secara diam-diam; laporan
 *   hanya memberi status dan saran tindakan.
 *
 * @typedef {object} IntegrityCheck
 * @property {string} id
 * @property {'pass'|'warn'|'fail'} status
 * @property {string} message Pesan aman dalam Bahasa Indonesia.
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {object} IntegrityReport
 * @property {boolean} ok
 * @property {string[]} checkedAt
 * @property {IntegrityCheck[]} checks
 * @property {string[]} summary
 */

function reportFromChecks(checks, checkedAt) {
  const failures = checks.filter((c) => c.status === 'fail');
  const warnings = checks.filter((c) => c.status === 'warn');
  return {
    ok: failures.length === 0,
    checkedAt,
    checks,
    summary: [
      `${checks.length} pemeriksaan dijalankan.`,
      `${checks.filter((c) => c.status === 'pass').length} lulus, ${warnings.length} peringatan, ${failures.length} gagal.`,
    ],
  };
}

/**
 * @param {string} id
 * @param {'pass'|'warn'|'fail'} status
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {IntegrityCheck}
 */
function check(id, status, message, details) {
  return { id, status, message, ...(details ? { details } : {}) };
}

/**
 * Periksa integritas database: PRAGMA, foreign key, skema, dan migrasi.
 *
 * @param {{
 *   db: import('better-sqlite3').Database,
 *   expectedSchemaVersion?: string,
 * }} options
 * @returns {Promise<IntegrityReport>}
 */
export function checkDatabaseIntegrity(options) {
  const { db, expectedSchemaVersion } = options;
  /** @type {IntegrityCheck[]} */
  const checks = [];
  const checkedAt = new Date().toISOString();

  try {
    checks.push(
      check(
        'db.open',
        db.open ? 'pass' : 'fail',
        db.open ? 'Koneksi database terbuka.' : 'Koneksi database tertutup.',
      ),
    );
  } catch (cause) {
    checks.push(check('db.open', 'fail', 'Koneksi database tidak dapat diperiksa.'));
    logger.error('Pemeriksaan koneksi database gagal', { message: cause?.message });
    return Promise.resolve(reportFromChecks(checks, checkedAt));
  }

  // Koneksi tertutup tidak boleh dipakai untuk PRAGMA apa pun.
  if (!db.open) {
    return Promise.resolve(reportFromChecks(checks, checkedAt));
  }

  const connection = describeConnection(db);
  checks.push(
    check(
      'db.foreign_keys',
      connection.foreignKeys ? 'pass' : 'fail',
      connection.foreignKeys
        ? 'PRAGMA foreign_keys aktif pada koneksi ini.'
        : 'PRAGMA foreign_keys tidak aktif. Buka koneksi melalui src/db/connection.js.',
      { foreignKeys: connection.foreignKeys },
    ),
  );

  let integrity = 'tidak diketahui';
  let integrityOk = false;
  try {
    const rows = db.pragma('integrity_check');
    integrity = rows.map((row) => Object.values(row)[0]).join('; ');
    integrityOk = integrity.toLowerCase() === 'ok';
  } catch (cause) {
    logger.error('PRAGMA integrity_check gagal', { message: cause?.message });
  }
  checks.push(
    check(
      'db.integrity_check',
      integrityOk ? 'pass' : 'fail',
      integrityOk
        ? 'PRAGMA integrity_check lulus.'
        : 'PRAGMA integrity_check melaporkan masalah pada file database.',
      { result: integrityOk ? 'ok' : 'failed' },
    ),
  );

  try {
    const violations = db.pragma('foreign_key_check');
    checks.push(
      check(
        'db.foreign_key_check',
        violations.length === 0 ? 'pass' : 'fail',
        violations.length === 0
          ? 'Tidak ada pelanggaran foreign key.'
          : `Ditemukan ${violations.length} pelanggaran foreign key.`,
        { violations: violations.length },
      ),
    );
  } catch (cause) {
    logger.error('PRAGMA foreign_key_check gagal', { message: cause?.message });
    checks.push(check('db.foreign_key_check', 'fail', 'Pemeriksaan foreign key gagal dijalankan.'));
  }

  try {
    const applied = listAppliedMigrations(db);
    checks.push(
      check('db.migrations_applied', 'pass', `${applied.length} migrasi tercatat.`, {
        applied: applied.map((row) => row.id),
      }),
    );

    const status = getMigrationStatus(db);
    checks.push(
      check(
        'db.schema_up_to_date',
        status.upToDate ? 'pass' : 'fail',
        status.upToDate
          ? `Skema database pada versi ${status.latestVersion}.`
          : `Ada ${status.pending.length} migrasi yang belum diterapkan. Jalankan "npm run db:migrate".`,
        {
          currentVersion: status.currentVersion,
          latestVersion: status.latestVersion,
          pending: status.pending.map((m) => m.id),
        },
      ),
    );

    if (expectedSchemaVersion) {
      checks.push(
        check(
          'db.schema_version_matches_app',
          status.currentVersion === expectedSchemaVersion ? 'pass' : 'warn',
          status.currentVersion === expectedSchemaVersion
            ? `Versi skema database sesuai aplikasi (${expectedSchemaVersion}).`
            : `Versi skema database (${status.currentVersion ?? 'kosong'}) berbeda dari yang diharapkan aplikasi (${expectedSchemaVersion}).`,
        ),
      );
    }
  } catch (cause) {
    logger.error('Pemeriksaan riwayat migrasi gagal', { message: cause?.message });
    checks.push(
      check('db.schema_up_to_date', 'fail', 'Riwayat migrasi tidak dapat diverifikasi.'),
    );
  }

  checks.push(
    check('db.journal_mode', 'pass', `Mode jurnal: ${connection.journalMode}.`, {
      journalMode: connection.journalMode,
      sqliteVersion: connection.sqliteVersion,
    }),
  );

  return Promise.resolve(reportFromChecks(checks, checkedAt));
}

/**
 * Daftar seluruh file di root penyimpanan secara rekursif.
 * @param {string} root
 * @returns {Promise<string[]>} Path relatif.
 */
async function listFilesRecursively(root) {
  /** @type {string[]} */
  const found = [];

  /** @param {string} dir @param {string} prefix */
  async function walk(dir, prefix) {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name), relative);
      } else if (entry.isFile()) {
        found.push(relative);
      }
    }
  }

  await walk(root, '');
  return found;
}

/**
 * Periksa konsistensi penyimpanan file terhadap metadata database.
 *
 * @param {{
 *   filesDir: string,
 *   repositories: ReturnType<typeof import('../../db/repositories/index.js').createRepositories>,
 *   hashLimit?: number,
 * }} options
 *   `hashLimit` membatasi jumlah file yang di-hash agar pemeriksaan cepat
 *   pada storage besar (default: semua file).
 * @returns {Promise<IntegrityReport & {missingFiles: string[], orphanFiles: string[], hashMismatches: string[]}>}
 */
export async function checkStorageIntegrity(options) {
  const { filesDir, repositories } = options;
  const hashLimit = options.hashLimit ?? Number.POSITIVE_INFINITY;
  const checkedAt = new Date().toISOString();
  /** @type {IntegrityCheck[]} */
  const checks = [];

  const missingFiles = [];
  const hashMismatches = [];
  const storedFiles = repositories.storedFiles;
  const filesRoot = path.resolve(filesDir);

  if (!fs.existsSync(filesRoot)) {
    checks.push(
      check(
        'storage.root_exists',
        'fail',
        'Root penyimpanan file belum ada. Jalankan inisialisasi direktori data.',
      ),
    );
    return {
      ...reportFromChecks(checks, checkedAt),
      missingFiles,
      hashMismatches,
      orphanFiles: [],
    };
  }
  checks.push(check('storage.root_exists', 'pass', 'Root penyimpanan file tersedia.'));

  // 1. Record aktif/pending harus menunjuk file yang benar-benar ada.
  const liveRecords = [
    ...storedFiles.listByState('active'),
    ...storedFiles.listByState('pending'),
  ];

  let hashed = 0;
  for (const record of liveRecords) {
    const absolutePath = path.resolve(filesRoot, record.relativePath);
    if (!absolutePath.startsWith(`${filesRoot}${path.sep}`) || !fs.existsSync(absolutePath)) {
      if (record.state === 'active') missingFiles.push(record.id);
      continue;
    }
    if (hashed >= hashLimit) continue;
    hashed += 1;
    const { hash, size } = await hashFileWithNode(absolutePath);
    if (hash !== record.contentHash || size !== Number(record.sizeBytes)) {
      hashMismatches.push(record.id);
    }
  }

  checks.push(
    check(
      'storage.active_files_present',
      missingFiles.length === 0 ? 'pass' : 'fail',
      missingFiles.length === 0
        ? `${liveRecords.length} record file punya byte yang tersimpan.`
        : `${missingFiles.length} record aktif menunjuk file yang tidak ada. Jalankan pemulihan atau restore backup.`,
      { checked: liveRecords.length, missing: missingFiles.length },
    ),
  );

  checks.push(
    check(
      'storage.checksum_matches',
      hashMismatches.length === 0 ? 'pass' : 'fail',
      hashMismatches.length === 0
        ? `Checksum ${hashed} file cocok dengan metadata.`
        : `${hashMismatches.length} file berubah di luar aplikasi (checksum tidak cocok).`,
      { hashed, mismatches: hashMismatches.length },
    ),
  );

  // 2. File di disk yang tidakpunyarecord = yatim (aman dihapus manual).
  const onDisk = await listFilesRecursively(filesRoot);
  const knownPaths = new Set([
    ...storedFiles.listByState('active'),
    ...storedFiles.listByState('pending'),
    ...storedFiles.listByState('deleted'),
  ].map((record) => record.relativePath));
  const orphanFiles = onDisk.filter((relative) => !knownPaths.has(relative));

  checks.push(
    check(
      'storage.no_orphan_files',
      orphanFiles.length === 0 ? 'pass' : 'warn',
      orphanFiles.length === 0
        ? 'Tidak ada file di storage yang tanpa metadata.'
        : `${orphanFiles.length} file di storage tidak punya metadata (file yatim). Aman dihapus setelah ditinjau.`,
      { count: orphanFiles.length, sample: orphanFiles.slice(0, 5) },
    ),
  );

  // 3. Record `pending` yang menggantung menandakan upload gagal.
  const pendingRecords = storedFiles.listByState('pending');
  checks.push(
    check(
      'storage.no_pending_records',
      pendingRecords.length === 0 ? 'pass' : 'warn',
      pendingRecords.length === 0
        ? 'Tidak ada record file yang menggantung pada status pending.'
        : `${pendingRecords.length} record file masih berstatus pending. Periksa upload yang gagal.`,
      { count: pendingRecords.length },
    ),
  );

  return {
    ...reportFromChecks(checks, checkedAt),
    missingFiles,
    hashMismatches,
    orphanFiles,
  };
}

/**
 * @param {string} absolutePath
 * @returns {Promise<{hash: string, size: number}>}
 */
async function hashFileWithNode(absolutePath) {
  const hash = createHash('sha256');
  let size = 0;
  const stream = fs.createReadStream(absolutePath);
  for await (const chunk of stream) {
    hash.update(chunk);
    size += chunk.length;
  }
  return { hash: hash.digest('hex'), size };
}

/**
 * Periksa kesiapan direktori data.
 *
 * @param {{dataDir: string, directories: Record<string, string>, publicRoot: string}} paths
 * @returns {Promise<IntegrityReport>}
 */
export async function checkDataDirectory(paths) {
  const result = verifyDataDirectories(paths);
  const checks = result.directories.map((dir) => {
    const label = dir.name === '.' ? 'root' : dir.name;
    return check(
      `data.dir.${label}`,
      dir.ok ? 'pass' : 'fail',
      dir.ok
        ? `Direktori data ${label} siap.`
        : `Direktori data ${label} bermasalah: ${dir.issues.join(' ')}`,
      { directory: dir.path },
    );
  });
  return reportFromChecks(checks, new Date().toISOString());
}

/**
 * Jalankan seluruh pemeriksaan integritas.
 *
 * @param {{
 *   db: import('better-sqlite3').Database,
 *   filesDir: string,
 *   paths: {dataDir: string, directories: Record<string, string>, publicRoot: string},
 *   repositories: ReturnType<typeof import('../../db/repositories/index.js').createRepositories>,
 *   expectedSchemaVersion?: string,
 *   hashLimit?: number,
 * }} options
 * @returns {Promise<IntegrityReport>}
 */
export async function runIntegrityChecks(options) {
  const [dbReport, storageReport, dirReport] = await Promise.all([
    checkDatabaseIntegrity({
      db: options.db,
      expectedSchemaVersion: options.expectedSchemaVersion,
    }),
    checkStorageIntegrity({
      filesDir: options.filesDir,
      repositories: options.repositories,
      hashLimit: options.hashLimit,
    }),
    checkDataDirectory(options.paths),
  ]);

  const combined = [dbReport, storageReport, dirReport];
  const checks = combined.flatMap((report) => report.checks);
  const failures = checks.filter((c) => c.status === 'fail').length;
  const warnings = checks.filter((c) => c.status === 'warn').length;

  return {
    ok: failures === 0,
    checkedAt: new Date().toISOString(),
    checks,
    summary: [
      `${checks.length} pemeriksaan dijalankan.`,
      `${checks.filter((c) => c.status === 'pass').length} lulus, ${warnings} peringatan, ${failures} gagal.`,
    ],
    storage: storageReport,
  };
}