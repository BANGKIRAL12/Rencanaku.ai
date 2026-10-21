import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

/**
 * Jalankan `node src/server.js` dengan environment terkontrol dan
 * kembalikan hasil proses.
 * @param {Record<string, string>} extraEnv
 */
function runServer(extraEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/server.js'], {
      cwd: repoRoot,
      // Env minimal: tidak mewarisi .env pengguna.
      env: {
        PATH: process.env.PATH,
        // Arahkan dotenv ke file yang tidak ada agar .env repo tidak terbaca.
        ENV_FILE: path.join(repoRoot, 'tidak-ada.env'),
        ...extraEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Proses tidak berhenti dalam 10 detik'));
    }, 10000);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

describe('Startup dengan konfigurasi tidak valid', () => {
  it('keluar dengan kode 1 dan pesan aman saat secret wajib hilang', async () => {
    const { code, stdout, stderr } = await runServer({
      NODE_ENV: 'development',
      PORT: '0',
      HOST: '127.0.0.1',
      BASE_URL: 'http://127.0.0.1:3000/',
      LOG_LEVEL: 'error',
      // SESSION_SECRET dan CSRF_SECRET sengaja tidak diisi.
    });

    const output = `${stdout}\n${stderr}`;
    expect(code).toBe(1);
    expect(output).toContain('SESSION_SECRET');
    expect(output).toContain('CSRF_SECRET');
    expect(output).toContain('Konfigurasi aplikasi tidak valid');
    // Tidak boleh ada stack trace mentah.
    expect(output).not.toMatch(/\bat .*\.js:\d+:\d+/);
  });

  it('tidak mencetak nilai secret ke output saat validasi gagal', async () => {
    const shortSecret = 'rahasia-pendek-jangan-dicetak';
    const { code, stdout, stderr } = await runServer({
      NODE_ENV: 'development',
      PORT: '0',
      SESSION_SECRET: shortSecret,
      CSRF_SECRET: 'c'.repeat(32),
    });

    const output = `${stdout}\n${stderr}`;
    expect(code).toBe(1);
    expect(output).not.toContain(shortSecret);
  });

  it('keluar dengan kode 1 saat PORT tidak valid', async () => {
    const { code, stdout, stderr } = await runServer({
      NODE_ENV: 'development',
      PORT: 'bukan-angka',
      SESSION_SECRET: 'a'.repeat(32),
      CSRF_SECRET: 'b'.repeat(32),
    });

    const output = `${stdout}\n${stderr}`;
    expect(code).toBe(1);
    expect(output).toContain('PORT');
  });
});
