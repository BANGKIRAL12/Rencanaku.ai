import fs from 'node:fs';
import path from 'node:path';
import {
  DATA_SUBDIRECTORIES,
  assertOutsidePublicRoot,
} from '../../config/paths.js';
import { logger } from '../../core/logger/index.js';

/**
 * Pembuatan dan verifikasi direktori data privat.
 *
 * Aturan (implementation_plan.md §7 tugas 11, ARCHITECTURE §4):
 * - `files`, `projects`, `backups`, `logs`, `temp`, dan `config` dibuat
 *   otomatis dengan permission 0700 (hanya pemilik proses yang boleh
 *   membaca/menulis).
 * - Direktori config (berisi `providers.json` dengan API key) tidak boleh
 *   lebih longgar dari 0600 untuk file di dalamnya.
 * - Tidak ada direktori data yang boleh berada di bawah root statis publik.
 */

/** Izin direktori data. */
export const DATA_DIR_MODE = 0o700;
/** Izin file privat (mis. `providers.json`, backup). */
export const DATA_FILE_MODE = 0o600;

/**
 * @typedef {object} DataDirectoryReport
 * @property {boolean} ok
 * @property {Array<{path: string, name: string, ok: boolean, issues: string[]}>} directories
 *   `path` dibatasi nama relatif terhadap akar data untuk pesan aman.
 * @property {string[]} warnings
 */

/**
 * Buat seluruh direktori data beserta izinnya.
 *
 * @param {{dataDir: string, directories: Record<string, string>, publicRoot: string}} paths
 *   Hasil `resolveDataPaths` + `assertDataPathsArePrivate`.
 * @returns {DataDirectoryReport}
 */
export function ensureDataDirectories(paths) {
  const warnings = [];
  assertOutsidePublicRoot(paths.dataDir, paths.publicRoot);

  /** @type {DataDirectoryReport['directories']} */
  const directories = [];

  const targets = [
    { name: '.', dir: paths.dataDir },
    ...DATA_SUBDIRECTORIES.map((name) => ({
      name,
      dir: paths.directories[name] ?? path.join(paths.dataDir, name),
    })),
  ];

  for (const { name, dir } of targets) {
    /** @type {string[]} */
    const issues = [];
    try {
      fs.mkdirSync(dir, { recursive: true, mode: DATA_DIR_MODE });
      // mkdir hormati umask, jadi enforce ulang secara eksplisit.
      fs.chmodSync(dir, DATA_DIR_MODE);
    } catch (cause) {
      issues.push(
        `Gagal membuat direktori (${cause?.code ?? 'UNKNOWN'}). Periksa izin path data.`,
      );
    }

    const exists = fs.existsSync(dir);
    if (!issues.length && !exists) {
      issues.push('Direktori tidak ada setelah pembuatan.');
    }
    if (exists) {
      const stat = fs.statSync(dir);
      if (!stat.isDirectory()) issues.push('Path bukan direktori.');
      if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) {
        issues.push(
          `Izin direktori terlalu longgar (${(stat.mode & 0o777).toString(8)}). Gunakan 700.`,
        );
      }
    }

    directories.push({
      // Hanya nama relatif yang ditampilkan agar path absolut tidak bocor.
      path: name === '.' ? '.' : name,
      name,
      ok: issues.length === 0,
      issues,
    });
  }

  const ok = directories.every((dir) => dir.ok);
  if (!ok) {
    for (const dir of directories.filter((d) => !d.ok)) {
      logger.error('Direktori data tidak siap', { name: dir.name, issues: dir.issues });
    }
  }

  return { ok, directories, warnings };
}

/**
 * Periksa kesiapan menulis pada direktori data tanpa membuat file uji
 * yang tertinggal (hanya `fs.accessSync` W_OK).
 *
 * @param {{dataDir: string, directories: Record<string, string>, publicRoot: string}} paths
 * @returns {DataDirectoryReport}
 */
export function verifyDataDirectories(paths) {
  /** @type {string[]} */
  const issues = [];
  /** @type {DataDirectoryReport['directories']} */
  const directories = [];

  const targets = [
    { name: '.', dir: paths.dataDir },
    ...DATA_SUBDIRECTORIES.map((name) => ({
      name,
      dir: paths.directories[name] ?? path.join(paths.dataDir, name),
    })),
  ];

  for (const { name, dir } of targets) {
    /** @type {string[]} */
    const found = [];
    if (!fs.existsSync(dir)) {
      found.push('Direktori belum dibuat. Jalankan inisialisasi data.');
    } else {
      const stat = fs.statSync(dir);
      if (!stat.isDirectory()) found.push('Path bukan direktori.');
      if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) {
        found.push(
          `Izin direktori terlalu longgar (${(stat.mode & 0o777).toString(8)}).`,
        );
      }
      try {
        fs.accessSync(dir, fs.constants.W_OK);
      } catch {
        found.push('Direktori tidak dapat ditulis oleh proses ini.');
      }
    }
    directories.push({ path: name === '.' ? '.' : name, name, ok: found.length === 0, issues: found });
  }

  return {
    ok: directories.every((d) => d.ok),
    directories,
    warnings: [...issues],
  };
}