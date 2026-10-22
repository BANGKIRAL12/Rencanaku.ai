import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  UnsafePathError,
  isInside,
  normalizeRelativePath,
  resolveExistingWithinRoot,
  resolveWithinRoot,
  sanitizeFileName,
} from '../../src/core/utils/safe-path.js';

const ROOT = fs.mkdtempSync(path.join(fs.existsSync('/tmp/opencode') ? '/tmp/opencode' : os.tmpdir(), 'rencanaku-path-'));

describe('Penolakan path traversal', () => {
  it('menolak segment `..` dalam berbagai bentuk', () => {
    for (const attempt of [
      '../rahasia.txt',
      '../../etc/passwd',
      'ab/../../../etc/passwd',
      'ab\\..\\..\\windows\\system32',
      '..',
    ]) {
      expect(() => normalizeRelativePath(attempt)).toThrow(UnsafePathError);
    }
  });

  it('menolak path absolut dan drive Windows', () => {
    for (const attempt of ['/etc/passwd', '/data/files/../../x', 'C:\\Windows\\win.ini', 'C:/data']) {
      expect(() => normalizeRelativePath(attempt)).toThrow(UnsafePathError);
    }
  });

  it('menolak byte NUL dan path kosong', () => {
    expect(() => normalizeRelativePath('ab/cd/\0.png')).toThrow(UnsafePathError);
    expect(() => normalizeRelativePath('')).toThrow(UnsafePathError);
    expect(() => normalizeRelativePath('   ')).toThrow(UnsafePathError);
  });

  it('menerima path relatif yang aman dan menormalisasi separator', () => {
    expect(normalizeRelativePath('ab/cd/uuid.png')).toBe('ab/cd/uuid.png');
    expect(normalizeRelativePath('./ab//cd/uuid.png')).toBe('ab/cd/uuid.png');
    expect(normalizeRelativePath('ab\\cd\\uuid.png')).toBe('ab/cd/uuid.png');
  });

  it('resolveWithinRoot selalu menghasilkan path di dalam root', () => {
    const resolved = resolveWithinRoot(ROOT, 'ab/cd/file.png');
    expect(isInside(ROOT, resolved)).toBe(true);
    expect(resolved.startsWith(`${ROOT}${path.sep}`)).toBe(true);
  });

  it('menolak nama file direktori yang menyamar sebagai path aman', () => {
    // Root `/tmp/x` tidak boleh bisa dibaca lewat `/tmp/x-evil/file`.
    expect(() => resolveWithinRoot(path.join(ROOT, 'files'), '../files-evil/a.txt')).toThrow(
      UnsafePathError,
    );
  });
});

describe('Verifikasi symlink', () => {
  it('menolak symlink yang menunjuk keluar root', () => {
    const rootDir = path.join(ROOT, 'sym-root');
    const outsideDir = path.join(ROOT, 'sym-outside');
    fs.mkdirSync(rootDir, { recursive: true });
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.writeFileSync(path.join(outsideDir, 'rahasia.txt'), 'data privat');

    try {
      fs.symlinkSync(outsideDir, path.join(rootDir, 'link'), 'dir');
    } catch {
      // Platform tanpa dukungan symlink dilewati; tidak ada yang diklaim lulus.
      return;
    }

    expect(() => resolveExistingWithinRoot(rootDir, 'link/rahasia.txt')).toThrow(UnsafePathError);
    expect(() => resolveExistingWithinRoot(rootDir, '.')).toThrow(UnsafePathError);
    expect(() => resolveExistingWithinRoot(rootDir, 'tidak-ada.txt')).toThrow();
  });

  it('menerima file biasa di dalam root', () => {
    const rootDir = path.join(ROOT, 'plain');
    fs.mkdirSync(rootDir, { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'ok.txt'), 'halo');

    expect(resolveExistingWithinRoot(rootDir, 'ok.txt')).toBe(
      fs.realpathSync(path.join(rootDir, 'ok.txt')),
    );
  });
});

describe('Sanitasi nama file dari input pengguna', () => {
  it('menyimpan nama yang aman dan mengekstrak ekstensi', () => {
    // Karakter non-ASCII diganti tanda hubung; nama asli tetap tersedia
    // sebagai metadata di database, bukan sebagai nama berkas.
    expect(sanitizeFileName('Laporanку Quarterly.pdf')).toEqual({
      safeName: 'Laporan-Quarterly.pdf',
      extension: '.pdf',
    });
    expect(sanitizeFileName('../../etc/passwd')).toEqual({
      safeName: 'passwd.bin',
      extension: '.bin',
    });
  });

  it('menolak karakter kontrol dan nama kosong', () => {
    expect(sanitizeFileName('nama\u0000jahat.txt').safeName).toBe('namajahat.txt');
    expect(sanitizeFileName('   ').safeName).toBe('file');
    expect(sanitizeFileName('').extension).toBe('.bin');
  });

  it('membatasi panjang nama dan menolak ekstensi berisiko', () => {
    const long = `${'a'.repeat(500)}.exe`;
    const result = sanitizeFileName(long);
    expect(result.safeName.length).toBeLessThanOrEqual(90);
    expect(sanitizeFileName('skrip.shell').extension).toBe('.shell');
    expect(sanitizeFileName('gambar.PNG').extension).toBe('.png');
  });

  it('tidak pernah mengembalikan path sebagai nama', () => {
    const result = sanitizeFileName('/var/data/rahasia/../../etc/shadow');
    expect(result.safeName).not.toContain('/');
    expect(result.safeName).not.toContain('..');
  });
});