import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  UnsafePathError,
  isInside,
  resolveExistingWithinRoot,
  resolveWithinRoot,
  sanitizeFileName,
} from '../../core/utils/safe-path.js';
import { logger } from '../../core/logger/index.js';
import { runInTransaction } from '../../db/transaction.js';

/**
 * FileStorageService — satu-satunya modul yang menulis dan menghapus byte
 * di filesystem (ARCHITECTURE §5.1 aturan 7, §6.8).
 *
 * Invariant file/DB (dijaga repository `stored_files`, lihat ADR 0005):
 *
 * 1. **Tidak ada record aktif yang menunjuk file yang tidak ada.**
 *    Urutan saat penyimpanan: tulis ke `data/temp` → hash+ukuran dihitung
 *    → `rename` ke path final → baru simpan record `active` di database.
 *    Bila langkah database gagal, file final dihapus (kompensasi).
 * 2. **Penghapusan menandai record lebih dulu.** Record diubah menjadi
 *    `deleted` sebelum byte dihapus; kegagalan menghapus byte menghasilkan
 *    file yatim yang aman (ditemukan pemeriksaan integritas), bukan record
 *    aktif yang menggantung.
 * 3. **Tidak ada path dari input pengguna.** Nama yang disimpan di disk
 *    diturunkan dari UUID internal; nama asli hanya metadata.
 * 4. **Penulisan atomik.** Tidak ada proses yang pernah melihat file
 *    setengah tertulis karena rename bersifat atomik pada filesystem yang
 *    sama.
 */

export class FileStorageError extends Error {
  /**
   * @param {string} message Pesan aman untuk log dan pesan pengguna.
   * @param {{code?: string, status?: number, cause?: unknown}} [options]
   */
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'FileStorageError';
    this.code = options.code ?? 'FILE_STORAGE_FAILED';
    this.status = options.status ?? 500;
  }
}

/** Batas ukuran default satu file (bukan quota total; lihat Fase 6/9). */
export const DEFAULT_MAX_FILE_BYTES = 25 * 1024 * 1024;

/** MIME yang selalu diperlakukan sebagai data, tidak pernah dieksekusi. */
const FALLBACK_MIME = 'application/octet-stream';

/**
 * @param {{
 *   filesDir: string,
 *   tempDir: string,
 *   repositories: import('../../db/repositories/index.js').createRepositories extends (...a: any) => infer R ? R : never,
 *   maxFileBytes?: number,
 *   hashAlgorithm?: 'sha256',
 *   newId?: () => string,
 * }} options
 */
export function createFileStorage(options) {
  const { filesDir, tempDir, repositories } = options;
  if (!filesDir || !tempDir || !repositories?.storedFiles) {
    throw new FileStorageError('FileStorageService tidak dikonfigurasi dengan lengkap.', {
      code: 'FILE_STORAGE_MISCONFIGURED',
    });
  }

  const filesRoot = path.resolve(filesDir);
  const tempRoot = path.resolve(tempDir);
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const hashAlgorithm = options.hashAlgorithm ?? 'sha256';
  const newId = options.newId ?? (() => randomUUID());
  const filesRepo = repositories.storedFiles;

  if (!isInside(filesRoot, tempRoot) && isInside(tempRoot, filesRoot)) {
    throw new FileStorageError(
      'Root penyimpanan file tidak boleh berada di dalam direktori temp.',
      { code: 'FILE_STORAGE_ROOT_INSIDE_TEMP' },
    );
  }

  // `data/temp` dan `data/files` sengaja dipisah (lihat ADR 0005) tetapi
  // harus berada pada filesystem yang sama agar rename tetap atomik.
  // Bila berbeda device, moveAtomically() memakai fallback salin+rename.
  try {
    if (fs.statSync(filesRoot).dev !== fs.statSync(tempRoot).dev) {
      logger.warn(
        'Direktori temp dan root file berbeda filesystem; penulisan file memakai fallback salin+rename.',
      );
    }
  } catch {
    // Direktori belum dibuat; pemeriksaan ini hanya informasi.
  }

  /**
   * Path relatif file: dua shard agar satu direktori tidak menampung
   * ratusan ribu entri.
   * @param {string} fileId
   * @param {string} extension
   */
  function buildRelativePath(fileId, extension) {
    return `${fileId.slice(0, 2)}/${fileId.slice(2, 4)}/${fileId}${extension}`;
  }

  /**
   * @param {string} relativePath
   */
  function resolve(relativePath) {
    return resolveWithinRoot(filesRoot, relativePath);
  }

  /**
   * Hitung SHA-256 dari sebuah file.
   * @param {string} absolutePath
   * @returns {Promise<{hash: string, size: number}>}
   */
  async function hashFile(absolutePath) {
    const hash = createHash(hashAlgorithm);
    let size = 0;
    const stream = fs.createReadStream(absolutePath);
    for await (const chunk of stream) {
      hash.update(chunk);
      size += chunk.length;
    }
    return { hash: hash.digest('hex'), size };
  }

  /**
   * @param {number} size
   */
  function tooLargeError(size) {
    return new FileStorageError(
      `Ukuran file melebihi batas ${maxFileBytes} byte (diterima ${size} byte).`,
      { code: 'FILE_TOO_LARGE', status: 413 },
    );
  }

  /**
   * Tulis byte ke file sementara sambil menghitung hash dan ukuran.
   *
   * Catatan: `flush: true` memaksa fsync sebelum `close`, sehingga file
   * sementara benar-benar tahan crash sebelum di-rename. `autoClose` harus
   * dibiarkan aktif agar `pipeline()` menerima event `close`.
   *
   * @param {Buffer|import('node:stream').Readable} data
   * @param {string} targetPath
   * @returns {Promise<{hash: string, size: number}>}
   */
  async function writeTempFile(data, targetPath) {
    const hash = createHash(hashAlgorithm);

    if (Buffer.isBuffer(data)) {
      if (data.length > maxFileBytes) throw tooLargeError(data.length);
      hash.update(data);
      const handle = await fsp.open(targetPath, 'wx', 0o600);
      try {
        await handle.writeFile(data);
        await handle.sync();
      } finally {
        await handle.close();
      }
      return { hash: hash.digest('hex'), size: data.length };
    }

    let size = 0;
    const counter = new Transform({
      transform(chunk, _encoding, callback) {
        size += chunk.length;
        if (size > maxFileBytes) {
          callback(tooLargeError(size));
          return;
        }
        hash.update(chunk);
        callback(null, chunk);
      },
    });

    const writable = fs.createWriteStream(targetPath, {
      flags: 'wx',
      mode: 0o600,
      flush: true,
    });
    await pipeline(data, counter, writable);

    return { hash: hash.digest('hex'), size };
  }

  /**
   * Pindahkan file sementara ke path final secara atomik. Bila temporary
   * directory berada di filesystem berbeda (EXDEV), salin ke file
   * sementara di direktori tujuan lalu rename.
   *
   * @param {string} fromPath
   * @param {string} toPath
   */
  async function moveAtomically(fromPath, toPath) {
    await fsp.mkdir(path.dirname(toPath), { recursive: true, mode: 0o700 });
    try {
      await fsp.rename(fromPath, toPath);
    } catch (cause) {
      if (cause?.code !== 'EXDEV') {
        throw new FileStorageError('Gagal menyimpan file ke penyimpanan.', {
          code: 'FILE_MOVE_FAILED',
          cause,
        });
      }
      const stagingPath = `${toPath}.tmp`;
      try {
        await fsp.copyFile(fromPath, stagingPath);
        await fsp.rename(stagingPath, toPath);
      } catch (copyError) {
        await fsp.rm(stagingPath, { force: true });
        throw new FileStorageError('Gagal menyimpan file ke penyimpanan.', {
          code: 'FILE_MOVE_FAILED',
          cause: copyError,
        });
      }
    }

    // Sinkron direktori tujuan supaya entry rename tahan crash.
    try {
      const dirHandle = await fsp.open(path.dirname(toPath), 'r');
      await dirHandle.sync();
      await dirHandle.close();
    } catch {
      // Tidak semua platform mendukung fsync pada direktori.
    }
  }

  /**
   * Simpan satu file.
   *
   * @param {{
   *   data: Buffer|import('node:stream').Readable,
   *   originalName: string,
   *   mimeType?: string,
   *   ownerUserId: string,
   *   projectId?: string | null,
   *   scope?: 'attachment'|'document_version'|'trial_artifact'|'export'|'other',
   * }} input
   * @returns {Promise<object>} Metadata file (tanpa path absolut).
   */
  async function store(input) {
    const ownerUserId = String(input?.ownerUserId ?? '').trim();
    if (ownerUserId === '') {
      throw new FileStorageError('Pemilik file wajib diisi.', {
        code: 'FILE_OWNER_REQUIRED',
        status: 400,
      });
    }

    const { extension } = sanitizeFileName(input.originalName);
    const fileId = newId();
    const relativePath = buildRelativePath(fileId, extension);
    const absolutePath = resolve(relativePath);

    if (filesRepo.pathTaken(relativePath)) {
      throw new FileStorageError('Konflik nama file internal.', {
        code: 'FILE_PATH_CONFLICT',
        status: 409,
      });
    }

    const tempPath = path.join(tempRoot, `${fileId}.part`);
    await fsp.mkdir(tempRoot, { recursive: true, mode: 0o700 });

    /** @type {{hash: string, size: number}} */
    let written;
    try {
      written = await writeTempFile(input.data, tempPath);
    } catch (cause) {
      await fsp.rm(tempPath, { force: true });
      if (cause instanceof FileStorageError) throw cause;
      throw new FileStorageError('Gagal menulis file ke penyimpanan sementara.', {
        code: 'FILE_WRITE_FAILED',
        cause,
      });
    }

    if (written.size === 0) {
      await fsp.rm(tempPath, { force: true });
      throw new FileStorageError('File kosong tidak disimpan.', {
        code: 'FILE_EMPTY',
        status: 400,
      });
    }

    try {
      await moveAtomically(tempPath, absolutePath);
    } catch (cause) {
      await fsp.rm(tempPath, { force: true });
      throw cause;
    }

    try {
      return runInTransaction(repositories.db, () =>
        filesRepo.recordActive({
          id: fileId,
          ownerUserId,
          projectId: input.projectId ?? null,
          scope: input.scope ?? 'attachment',
          originalName: String(input.originalName ?? 'file').slice(0, 255),
          relativePath,
          sizeBytes: written.size,
          contentHash: written.hash,
          hashAlgorithm,
          mimeType: normalizeMime(input.mimeType),
          extension,
        }),
      );
    } catch (cause) {
      // Kompensasi: file tidak boleh tersisa tanpa record.
      await fsp.rm(absolutePath, { force: true });
      throw new FileStorageError(
        'File gagal didaftarkan sehingga tidak disimpan. Silakan coba lagi.',
        { code: 'FILE_REGISTER_FAILED', cause },
      );
    }
  }

  /**
   * @param {unknown} mimeType
   */
  function normalizeMime(mimeType) {
    const value = String(mimeType ?? '').trim().toLowerCase();
    if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(value)) return FALLBACK_MIME;
    return value;
  }

  /**
   * Ambil record + path absolut untuk dibaca. Wajib memakai owner dari
   * server; ID dari browser tidak pernah dipercaya tanpa pengecekan ini.
   *
   * @param {string} fileId
   * @param {string} ownerUserId
   * @returns {Promise<{record: object, absolutePath: string}>}
   */
  async function resolveForRead(fileId, ownerUserId) {
    const record = filesRepo.findOwned(fileId, ownerUserId);
    if (!record) {
      throw new FileStorageError('File tidak ditemukan.', {
        code: 'FILE_NOT_FOUND',
        status: 404,
      });
    }
    if (record.state !== 'active') {
      throw new FileStorageError('File tidak tersedia.', {
        code: 'FILE_UNAVAILABLE',
        status: 410,
      });
    }

    let absolutePath;
    try {
      absolutePath = resolveExistingWithinRoot(filesRoot, record.relativePath);
    } catch (cause) {
      if (cause instanceof UnsafePathError) throw cause;
      throw new FileStorageError('Berkas file hilang di penyimpanan.', {
        code: 'FILE_CONTENT_MISSING',
        status: 500,
        cause,
      });
    }
    return { record, absolutePath };
  }

  /**
   * @param {string} fileId
   * @param {string} ownerUserId
   * @returns {Promise<Buffer>}
   */
  async function read(fileId, ownerUserId) {
    const { absolutePath } = await resolveForRead(fileId, ownerUserId);
    return fsp.readFile(absolutePath);
  }

  /**
   * @param {string} fileId
   * @param {string} ownerUserId
   * @returns {Promise<import('node:fs').ReadStream>}
   */
  async function createReadStream(fileId, ownerUserId) {
    const { absolutePath } = await resolveForRead(fileId, ownerUserId);
    return fs.createReadStream(absolutePath);
  }

  /**
   * Verifikasi bahwa byte file masih cocok dengan checksum yang tercatat.
   * Ini yang dipakai untuk mendeteksi file yang berubah di luar aplikasi
   * (PRD §5.4).
   *
   * @param {string} fileId
   * @returns {Promise<{record: object|null, exists: boolean, hashMatches: boolean|null, sizeMatches: boolean|null, reason?: string}>}
   */
  async function verify(fileId) {
    const found = filesRepo.findByIdForSystem(fileId);
    if (!found) {
      return { record: null, exists: false, hashMatches: null, sizeMatches: null, reason: 'FILE_NOT_FOUND' };
    }

    let absolutePath;
    try {
      absolutePath = resolveWithinRoot(filesRoot, found.relativePath);
    } catch (cause) {
      return {
        record: found,
        exists: false,
        hashMatches: false,
        sizeMatches: false,
        reason: cause?.code ?? 'FILE_PATH_UNSAFE',
      };
    }

    if (!fs.existsSync(absolutePath)) {
      return { record: found, exists: false, hashMatches: false, sizeMatches: false, reason: 'FILE_CONTENT_MISSING' };
    }

    const { hash, size } = await hashFile(absolutePath);
    return {
      record: found,
      exists: true,
      hashMatches: hash === found.contentHash,
      sizeMatches: size === Number(found.sizeBytes),
      reason: hash === found.contentHash ? undefined : 'FILE_HASH_MISMATCH',
    };
  }

  /**
   * Tandai terhapus lalu hapus byte. Record di database berubah lebih dulu
   * sehingga tidak pernah ada record aktif yang menunjuk file hilang.
   *
   * @param {string} fileId
   * @param {string} ownerUserId
   * @returns {Promise<{marked: boolean, fileRemoved: boolean}>}
   */
  async function remove(fileId, ownerUserId) {
    const record = filesRepo.findOwned(fileId, ownerUserId);
    if (!record) {
      throw new FileStorageError('File tidak ditemukan.', {
        code: 'FILE_NOT_FOUND',
        status: 404,
      });
    }

    if (record.state !== 'deleted') {
      runInTransaction(repositories.db, () => filesRepo.markDeleted(fileId, ownerUserId));
    }

    let fileRemoved = true;
    try {
      const absolutePath = resolveWithinRoot(filesRoot, record.relativePath);
      await fsp.rm(absolutePath, { force: true });
    } catch {
      // File yatim akan dilaporkan pemeriksaan integritas.
      fileRemoved = false;
    }

    return { marked: true, fileRemoved };
  }

  /**
   * Daftar seluruh file milik pengguna (metadata saja).
   * @param {string} ownerUserId
   * @param {{state?: 'pending'|'active'|'deleted', limit?: number, offset?: number}} [options]
   */
  function listByOwner(ownerUserId, options = {}) {
    return filesRepo.listByOwner(ownerUserId, options);
  }

  return {
    filesRoot,
    tempRoot,
    maxFileBytes,
    hashAlgorithm,
    resolve,
    hashFile,
    store,
    resolveForRead,
    read,
    createReadStream,
    verify,
    remove,
    listByOwner,
  };
}
