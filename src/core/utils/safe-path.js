import fs from 'node:fs';
import path from 'node:path';

/**
 * Resolusi path aman untuk penyimpanan file.
 *
 * Threat model: path traversal saat upload/download
 * (ARCHITECTURE §11.5). Aturan yang ditegakkan:
 * - Path harus relatif dan tidak boleh mengandung byte NUL.
 * - Segmen `..`, `.`, segment kosong, dan drive Windows ditolak.
 * - Hasil resolusi WAJIB berada di dalam root; perbandingan dilakukan
 *   segment-based agar `/data/files-old` tidak dianggap di dalam
 *   `/data/files`.
 * - Path yang sudah ada diverifikasi lagi dengan `realpath` untuk
 *   menangkap symlink yang mengarah keluar root.
 */

export class UnsafePathError extends Error {
  /**
   * @param {string} message Pesan aman (tidak memuat path lengkap).
   * @param {{code?: string}} [options]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'UnsafePathError';
    this.code = options.code ?? 'STORAGE_PATH_UNSAFE';
  }
}

const WINDOWS_DRIVE_PATTERN = /^[a-zA-Z]:/;

/**
 * Apakah `candidate` berada di dalam `root`?
 * @param {string} root
 * @param {string} candidate
 */
export function isInside(root, candidate) {
  const rel = path.relative(path.resolve(root), path.resolve(candidate));
  if (rel === '') return true;
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Normalisasi path relatif yang dipakai storage service.
 * @param {string} relativePath
 * @returns {string} Path relatif dengan separator `/`.
 */
export function normalizeRelativePath(relativePath) {
  const raw = String(relativePath ?? '');
  if (raw.trim() === '') {
    throw new UnsafePathError('Path file tidak boleh kosong.', { code: 'STORAGE_PATH_EMPTY' });
  }
  if (raw.includes('\0')) {
    throw new UnsafePathError('Path file tidak valid.', { code: 'STORAGE_PATH_INVALID' });
  }

  const unified = raw.replace(/\\/g, '/');
  if (path.isAbsolute(raw) || unified.startsWith('/') || WINDOWS_DRIVE_PATTERN.test(raw)) {
    throw new UnsafePathError('Path file harus relatif terhadap root penyimpanan.', {
      code: 'STORAGE_PATH_ABSOLUTE',
    });
  }

  const segments = unified.split('/').filter((segment) => segment !== '' && segment !== '.');
  if (segments.length === 0 || segments.some((segment) => segment.trim() === '')) {
    throw new UnsafePathError('Path file tidak valid.', { code: 'STORAGE_PATH_INVALID' });
  }
  if (segments.some((segment) => segment === '..')) {
    throw new UnsafePathError('Path file tidak boleh keluar dari root penyimpanan.', {
      code: 'STORAGE_PATH_TRAVERSAL',
    });
  }

  return segments.join('/');
}

/**
 * Resolusi path absolut di dalam root. Melempar {@link UnsafePathError}
 * bila path tidak aman.
 *
 * @param {string} root
 * @param {string} relativePath
 * @returns {string} Path absolut.
 */
export function resolveWithinRoot(root, relativePath) {
  const rootResolved = path.resolve(root);
  const safeRelative = normalizeRelativePath(relativePath);
  const absolute = path.resolve(rootResolved, safeRelative);

  if (!isInside(rootResolved, absolute)) {
    throw new UnsafePathError('Path file berada di luar root penyimpanan.', {
      code: 'STORAGE_PATH_OUTSIDE_ROOT',
    });
  }

  return absolute;
}

/**
 * Resolusi path yang sudah ada di disk, dengan verifikasi symlink.
 * Bila target adalah symlink, `realpath` harus tetap berada di dalam root.
 *
 * @param {string} root
 * @param {string} relativePath
 * @returns {string} Path absolut hasil realpath.
 */
export function resolveExistingWithinRoot(root, relativePath) {
  const absolute = resolveWithinRoot(root, relativePath);
  const rootResolved = fs.existsSync(root) ? fs.realpathSync(root) : path.resolve(root);
  const real = fs.realpathSync(absolute);

  if (!isInside(rootResolved, real)) {
    throw new UnsafePathError('Path file menunjuk ke luar root penyimpanan.', {
      code: 'STORAGE_PATH_SYMLINK_ESCAPE',
    });
  }
  return real;
}

/**
 * Sanitasi nama file yang berasal dari input pengguna.
 * Dipakai untuk menentukan EKSTENSI dan metadata; nama yang disimpan
 * selalu berasal dari ID internal, bukan dari nama asli.
 *
 * @param {string} originalName
 * @returns {{safeName: string, extension: string}}
 */
export function sanitizeFileName(originalName) {
  const raw = String(originalName ?? '').trim();
  const base = raw.split(/[\\/]/).pop() ?? '';
  const withoutControl = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();

  if (withoutControl === '') {
    return { safeName: 'file', extension: '.bin' };
  }

  const dotIndex = withoutControl.lastIndexOf('.');
  const rawExt = dotIndex > 0 ? withoutControl.slice(dotIndex + 1).toLowerCase() : '';
  const extension = /^[a-z0-9]{1,10}$/.test(rawExt) ? `.${rawExt}` : '.bin';

  const stem = (dotIndex > 0 ? withoutControl.slice(0, dotIndex) : withoutControl)
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);

  return {
    safeName: stem === '' ? 'file' : `${stem}${extension}`,
    extension,
  };
}