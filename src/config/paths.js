import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolusi path runtime Rencanaku.ai.
 *
 * Aturan (lihat ADR 0005 dan ARCHITECTURE §4/§6.8):
 * - Seluruh data runtime (database, file, backup, log, temp, config) berada
 *   di bawah satu akar `DATA_DIR`.
 * - `DATA_DIR` berada di luar root statis publik (`public/`). Fungsi
 *   {@link assertOutsidePublicRoot} dipakai saat boot untuk menolak
 *   konfigurasi yang akan menyajikan data privat lewat `express.static`.
 * - `DATABASE_URL` dan `FILE_STORAGE_PATH` boleh berupa path relatif yang
 *   relatif terhadap `DATA_DIR`, atau path absolut untuk operator server.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

/** Akar repositori hasil resolusi `src/config/paths.js` → `../..`. */
export const REPO_ROOT = path.resolve(here, '..', '..');

/** Root statis publik. Hanya direktori ini yang boleh disajikan Express. */
export const PUBLIC_ROOT = path.join(REPO_ROOT, 'public');

/**
 * Sub-direktori data yang wajib ada. Nama harus sama dengan yang dipakai
 * ARCHITECTURE §4 dan tidak boleh diubah tanpa migrasi dokumentasi.
 */
export const DATA_SUBDIRECTORIES = Object.freeze([
  'files',
  'projects',
  'backups',
  'logs',
  'temp',
  'config',
]);

/** Direktori yang isinya tidak boleh disajikan sebagai aset publik. */
export const PUBLIC_ASSET_SUBPATH = path.join('assets');

/**
 * Normalisasi `DATABASE_URL` menjadi lokasi file database.
 *
 * Nilai yang diterima:
 * - `file::memory:` atau `:memory:` → database in-memory (hanya untuk tes).
 * - `file:app.sqlite` → relatif terhadap `dataDir`.
 * - `file:/srv/rencanaku/app.sqlite` → absolut, dipakai apa adanya.
 *
 * @param {string} databaseUrl Nilai dari konfigurasi tervalidasi.
 * @param {string} dataDir Akar data absolut.
 * @returns {{memory: true, path: string} | {memory: false, path: string}}
 */
export function resolveDatabaseTarget(databaseUrl, dataDir) {
  const raw = String(databaseUrl ?? '').trim();
  const withoutScheme = raw.startsWith('file:') ? raw.slice('file:'.length) : raw;

  if (withoutScheme === ':memory:' || withoutScheme === '') {
    return { memory: true, path: ':memory:' };
  }

  const absolute = path.isAbsolute(withoutScheme)
    ? path.resolve(withoutScheme)
    : path.resolve(dataDir, withoutScheme);

  return { memory: false, path: absolute };
}

/**
 * Resolusi absolut untuk path yang boleh relatif terhadap `dataDir`.
 * @param {string} value
 * @param {string} dataDir
 */
export function resolveDataPath(value, dataDir) {
  const raw = String(value ?? '').trim();
  if (raw === '') {
    throw new Error('Path data tidak boleh kosong.');
  }
  return path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(dataDir, raw);
}

/**
 * Apakah `target` berada di dalam `parent` (termasuk sama dengan parent)?
 * Perbandingan dilakukan secara segment-based agar `/data` tidak dianggap
 * di dalam `/data-lama`.
 *
 * @param {string} parent
 * @param {string} target
 */
export function isPathInside(parent, target) {
  const rel = path.relative(path.resolve(parent), path.resolve(target));
  if (rel === '') return true;
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Pastikan sebuah path privat tidak berada di bawah root statis publik.
 * Melempar error bila konfigurasi berpotensi menyajikan data privat.
 *
 * @param {string} target Path yang diperiksa.
 * @param {string} [publicRoot]
 * @returns {string} `target` bila aman.
 */
export function assertOutsidePublicRoot(target, publicRoot = PUBLIC_ROOT) {
  const resolved = path.resolve(target);
  if (isPathInside(publicRoot, resolved)) {
    throw new Error(
      `Path data berada di dalam root statis publik (${publicRoot}) dan berisiko tersaji ke browser: ${resolved}`,
    );
  }
  return resolved;
}

/**
 * Bangun kumpulan path absolut untuk seluruh kebutuhan runtime.
 *
 * @param {{
 *   DATA_DIR?: string,
 *   DATABASE_URL?: string,
 *   FILE_STORAGE_PATH?: string,
 * }} config Konfigurasi tervalidasi (subset yang relevan).
 * @param {{repoRoot?: string, cwd?: string, publicRoot?: string}} [options]
 * @returns {{
 *   repoRoot: string,
 *   publicRoot: string,
 *   dataDir: string,
 *   database: {memory: boolean, path: string},
 *   directories: {files: string, projects: string, backups: string, logs: string, temp: string, config: string},
 * }}
 */
export function resolveDataPaths(config = {}, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const repoRoot = path.resolve(options.repoRoot ?? REPO_ROOT);
  const publicRoot = path.resolve(options.publicRoot ?? path.join(repoRoot, 'public'));

  const dataDir = path.resolve(cwd, config.DATA_DIR ?? 'data');

  const database = resolveDatabaseTarget(config.DATABASE_URL ?? 'file:app.sqlite', dataDir);
  const filesDir = resolveDataPath(config.FILE_STORAGE_PATH ?? 'files', dataDir);

  const directories = {
    files: filesDir,
    projects: path.join(dataDir, 'projects'),
    backups: path.join(dataDir, 'backups'),
    logs: path.join(dataDir, 'logs'),
    temp: path.join(dataDir, 'temp'),
    config: path.join(dataDir, 'config'),
  };

  return { repoRoot, publicRoot, dataDir, database, directories };
}

/**
 * Validasi keamanan path data sebelum aplikasi dipakai: tidak ada direktori
 * privat yang boleh berada di bawah root statis publik, dan tidak ada direktori
 * data yang boleh saling bersarang (temp wajib terpisah dari root file agar
 * berkas sementara tidak dianggap berkas yatim oleh pemeriksaan integritas).
 *
 * @param {ReturnType<typeof resolveDataPaths>} paths
 * @throws {Error} bila ada path privat di dalam `public/` atau bersarang.
 */
export function assertDataPathsArePrivate(paths) {
  assertOutsidePublicRoot(paths.dataDir, paths.publicRoot);
  if (!paths.database.memory) {
    assertOutsidePublicRoot(paths.database.path, paths.publicRoot);
  }

  const entries = Object.entries(paths.directories);
  for (const [name, dir] of entries) {
    assertOutsidePublicRoot(dir, paths.publicRoot);
  }

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const [nameA, dirA] = entries[i];
      const [nameB, dirB] = entries[j];
      if (isPathInside(dirA, dirB) || isPathInside(dirB, dirA)) {
        throw new Error(
          `Direktori data "${nameA}" dan "${nameB}" tidak boleh bersarang satu sama lain.`,
        );
      }
    }
  }

  return paths;
}