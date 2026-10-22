import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  DATA_SUBDIRECTORIES,
  PUBLIC_ROOT,
  REPO_ROOT,
  assertDataPathsArePrivate,
  assertOutsidePublicRoot,
  isPathInside,
  resolveDataPaths,
  resolveDatabaseTarget,
} from '../../src/config/paths.js';
import { configSchema, formatConfigError } from '../../src/config/schema.js';
import { testEnv } from '../helpers/test-env.js';

describe('Resolusi path data', () => {
  it('DATA_DIR relatif dihitung dari folder kerja aplikasi', () => {
    const paths = resolveDataPaths({ DATA_DIR: 'data', DATABASE_URL: 'file:app.sqlite' }, {
      cwd: '/srv/app',
      repoRoot: '/srv/app',
    });

    expect(paths.dataDir).toBe('/srv/app/data');
    expect(paths.database).toEqual({ memory: false, path: '/srv/app/data/app.sqlite' });
    expect(paths.directories.files).toBe('/srv/app/data/files');
    expect(paths.directories.config).toBe('/srv/app/data/config');
  });

  it('DATABASE_URL absolut dipakai apa adanya (deployment server)', () => {
    const paths = resolveDataPaths({
      DATA_DIR: '/srv/rencanaku/data',
      DATABASE_URL: 'file:/var/lib/rencanaku/app.sqlite',
      FILE_STORAGE_PATH: 'berkas',
    });

    expect(paths.database.path).toBe('/var/lib/rencanaku/app.sqlite');
    expect(paths.directories.files).toBe('/srv/rencanaku/data/berkas');
  });

  it('menyelesaikan seluruh subdirektori data yang diwajibkan', () => {
    const paths = resolveDataPaths({ DATA_DIR: '/tmp/data-x' }, { repoRoot: REPO_ROOT });

    for (const name of DATA_SUBDIRECTORIES) {
      expect(paths.directories[name]).toBe(`/tmp/data-x/${name}`);
    }
  });

  it('mengenali database in-memory untuk pengujian', () => {
    expect(resolveDatabaseTarget('file::memory:', '/tmp/data-x')).toEqual({
      memory: true,
      path: ':memory:',
    });
    expect(resolveDatabaseTarget(':memory:', '/tmp/data-x').memory).toBe(true);
  });

  it('perbandingan path bersifat segment-based', () => {
    expect(isPathInside('/data/files', '/data/files/ab/cd/file.png')).toBe(true);
    expect(isPathInside('/data/files', '/data/files')).toBe(true);
    expect(isPathInside('/data/files', '/data/files-old/x.png')).toBe(false);
    expect(isPathInside('/data/files', '/data/backup')).toBe(false);
  });

  it('env pengujian memakai database in-memory dan tetap privat', () => {
    const parsed = configSchema.safeParse(testEnv);
    expect(parsed.success).toBe(true);
    const paths = resolveDataPaths(parsed.data, { cwd: '/tmp/kerja', repoRoot: REPO_ROOT });

    expect(paths.database.memory).toBe(true);
    expect(isPathInside(PUBLIC_ROOT, paths.dataDir)).toBe(false);
    expect(paths.publicRoot).toBe(path.join(REPO_ROOT, 'public'));
  });

  it('akhiran file ganda bukan berarti direktori data berubah', () => {
    const paths = resolveDataPaths({ DATA_DIR: 'data/files' }, { cwd: '/tmp/kerja' });
    expect(paths.dataDir).toBe('/tmp/kerja/data/files');
  });
});

describe('Perlindungan root statis publik', () => {
  it('menolak path yang berada di dalam public/', () => {
    expect(() => assertOutsidePublicRoot(path.join(PUBLIC_ROOT, 'assets'))).toThrow(
      /root statis publik/,
    );
    expect(() => assertOutsidePublicRoot(path.join(PUBLIC_ROOT, 'assets/../data'))).toThrow(
      /root statis publik/,
    );
  });

  it('menerima path yang berada di luar public/', () => {
    expect(() => assertOutsidePublicRoot(path.join(REPO_ROOT, 'data'))).not.toThrow();
    expect(() => assertOutsidePublicRoot('/var/lib/rencanaku/data')).not.toThrow();
  });

  it('menolak konfigurasi data yang menunjuk ke public/assets', () => {
    expect(() =>
      assertDataPathsArePrivate(
        resolveDataPaths(
          { DATA_DIR: path.join(PUBLIC_ROOT, 'assets'), DATABASE_URL: 'file:app.sqlite' },
          { repoRoot: REPO_ROOT },
        ),
      ),
    ).toThrow(/root statis publik/);
  });

  it('menolak database yang diletakkan di dalam root statis publik', () => {
    expect(() =>
      assertDataPathsArePrivate(
        resolveDataPaths(
          {
            DATA_DIR: '/tmp/data-aman',
            DATABASE_URL: `file:${path.join(PUBLIC_ROOT, 'assets/app.sqlite')}`,
          },
          { repoRoot: REPO_ROOT },
        ),
      ),
    ).toThrow(/root statis publik/);
  });

  it('menolak direktori data yang saling bersarang', () => {
    const paths = resolveDataPaths(
      { DATA_DIR: '/tmp/data-nested', FILE_STORAGE_PATH: 'files' },
      { repoRoot: REPO_ROOT },
    );
    // Simulasikan operator yang menempatkan temp di dalam root file.
    paths.directories.temp = path.join(paths.directories.files, 'tmp');

    expect(() => assertDataPathsArePrivate(paths)).toThrow(/tidak boleh bersarang/);
  });

  it('konfigurasi bawaan aman untuk seluruh path data', () => {
    expect(() =>
      assertDataPathsArePrivate(resolveDataPaths({ DATA_DIR: 'data' }, { repoRoot: REPO_ROOT })),
    ).not.toThrow();
  });
});

describe('Validasi konfigurasi penyimpanan', () => {
  /**
   * Membungkus configSchema agar assertion sama seperti parseConfig()
   * tanpa memuat modul `src/config/env.js` yang memiliki efek samping.
   * @param {Record<string, unknown>} env
   */
  function parse(env) {
    const result = configSchema.safeParse(env);
    return result.success
      ? { ok: true, data: result.data }
      : { ok: false, errors: formatConfigError(result.error) };
  }

  it('menyediakan nilai default yang konsisten', () => {
    const {
      DATA_DIR: _a,
      DATABASE_URL: _b,
      FILE_STORAGE_PATH: _c,
      SQLITE_JOURNAL_MODE: _d,
      SQLITE_BUSY_TIMEOUT_MS: _e,
      ...rest
    } = testEnv;

    const { data } = parse(rest);

    expect(data.DATA_DIR).toBe('data');
    expect(data.DATABASE_URL).toBe('file:app.sqlite');
    expect(data.FILE_STORAGE_PATH).toBe('files');
    expect(data.SQLITE_JOURNAL_MODE).toBe('wal');
    expect(data.SQLITE_BUSY_TIMEOUT_MS).toBe(5000);
  });

  it('menolak mode jurnal yang tidak dikenal', () => {
    const result = parse({ ...testEnv, SQLITE_JOURNAL_MODE: 'acak' });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'SQLITE_JOURNAL_MODE')).toBe(true);
  });

  it('menolak busy timeout di luar rentang wajar', () => {
    expect(parse({ ...testEnv, SQLITE_BUSY_TIMEOUT_MS: '999999' }).ok).toBe(false);
    expect(parse({ ...testEnv, SQLITE_BUSY_TIMEOUT_MS: '-1' }).ok).toBe(false);
  });

  it('menerima mode jurnal alternatif untuk filesystem jaringan', () => {
    for (const mode of ['wal', 'delete', 'truncate', 'persist']) {
      expect(parse({ ...testEnv, SQLITE_JOURNAL_MODE: mode }).ok).toBe(true);
    }
  });
});