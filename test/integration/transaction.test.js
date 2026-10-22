import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestWorkspace } from '../helpers/data.js';
import {
  TransactionError,
  isInTransaction,
  runInTransaction,
} from '../../src/db/transaction.js';

describe('Transaction helper', () => {
  let workspace;

  beforeAll(() => {
    workspace = createTestWorkspace();
  });

  afterAll(() => workspace.cleanup());

  /**
   * @param {string} username
   */
  function insertUser(username) {
    return workspace.repositories.users.create({
      username,
      displayName: `Pengguna ${username}`,
      passwordHash: 'scrypt$fake$hash',
    });
  }

  it('melakukan commit bila callback selesai tanpa error', () => {
    const user = runInTransaction(workspace.db, () => insertUser('commit-ok'));

    expect(user.username).toBe('commit-ok');
    expect(workspace.repositories.users.findByUsername('commit-ok')).not.toBeNull();
  });

  it('melakukan rollback seluruh perubahan bila callback melempar error', () => {
    const before = workspace.repositories.users.count();

    expect(() =>
      runInTransaction(workspace.db, () => {
        insertUser('rollback-a');
        insertUser('rollback-b');
        throw new Error('kegagalan yang disengaja');
      }),
    ).toThrow(TransactionError);

    expect(workspace.repositories.users.count()).toBe(before);
    expect(workspace.repositories.users.findByUsername('rollback-a')).toBeNull();
    expect(workspace.repositories.users.findByUsername('rollback-b')).toBeNull();
  });

  it('meneruskan error asli sebagai cause agar dapat didiagnosis', () => {
    const cause = new Error('penyebab asli');

    try {
      runInTransaction(workspace.db, () => {
        throw cause;
      });
      expect.unreachable('transaksi seharusnya melempar');
    } catch (error) {
      expect(error).toBeInstanceOf(TransactionError);
      expect(error.code).toBe('DB_TRANSACTION_ROLLED_BACK');
      expect(error.cause).toBe(cause);
    }
  });

  it('transaksi bersarang memakai SAVEPOINT dan hanya membatalkan bagian dalam', () => {
    const result = runInTransaction(workspace.db, () => {
      insertUser('luar-ok');

      try {
        runInTransaction(workspace.db, () => {
          insertUser('dalam-gagal');
          throw new Error('gagal di dalam');
        });
      } catch {
        // Bagian dalam dibatalkan, bagian luar tetap lanjut.
      }

      insertUser('luar-lanjut');
      return true;
    });

    expect(result).toBe(true);
    expect(workspace.repositories.users.findByUsername('luar-ok')).not.toBeNull();
    expect(workspace.repositories.users.findByUsername('luar-lanjut')).not.toBeNull();
    expect(workspace.repositories.users.findByUsername('dalam-gagal')).toBeNull();
  });

  it('kegagalan luar membatalkan juga perubahan savepoint yang sudah released', () => {
    expect(() =>
      runInTransaction(workspace.db, () => {
        insertUser('luar-dibatalkan');
        runInTransaction(workspace.db, () => insertUser('savepoint-released'));
        throw new Error('batalkan semuanya');
      }),
    ).toThrow(TransactionError);

    expect(workspace.repositories.users.findByUsername('luar-dibatalkan')).toBeNull();
    expect(workspace.repositories.users.findByUsername('savepoint-released')).toBeNull();
  });

  it('melaporkan status transaksi dengan benar', () => {
    expect(isInTransaction(workspace.db)).toBe(false);

    runInTransaction(workspace.db, () => {
      expect(isInTransaction(workspace.db)).toBe(true);
      runInTransaction(workspace.db, () => {
        expect(isInTransaction(workspace.db)).toBe(true);
      });
    });

    expect(isInTransaction(workspace.db)).toBe(false);
  });

  it('menolak callback yang bukan fungsi', () => {
    expect(() => runInTransaction(workspace.db, null)).toThrow(/membutuhkan fungsi/);
  });

  it('koneksi tetap dapat dipakai setelah rollback', () => {
    expect(() =>
      runInTransaction(workspace.db, () => {
        throw new Error('gagal');
      }),
    ).toThrow(TransactionError);

    const user = insertUser('setelah-rollback');
    expect(user.username).toBe('setelah-rollback');
    expect(workspace.db.pragma('integrity_check', { simple: true })).toBe('ok');
  });

  it('rollback juga membatalkan perubahan lintas tabel', () => {
    const usersBefore = workspace.repositories.users.count();
    const projectsBefore = workspace.repositories.projects.listByOwner(
      workspace.repositories.users.findById(1)?.id ?? 'tidak-ada',
    );

    expect(() =>
      runInTransaction(workspace.db, () => {
        const user = insertUser('lintas-tabel');
        workspace.repositories.projects.create({
          ownerUserId: user.id,
          name: 'Proyek yang dibatalkan',
        });
        throw new Error('batalkan semuanya');
      }),
    ).toThrow(TransactionError);

    expect(workspace.repositories.users.count()).toBe(usersBefore);
    expect(projectsBefore).toEqual([]);
    expect(workspace.repositories.users.findByUsername('lintas-tabel')).toBeNull();
  });
});