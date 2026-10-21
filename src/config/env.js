import dotenv from 'dotenv';
import { configSchema, formatConfigError } from './schema.js';

/**
 * Muat file .env bila ada. Pada mode test file .env tidak dibaca agar
 * pengujian tidak bergantung pada konfigurasi lokal pengembang.
 * `ENV_FILE` dapat diarahkan ke path lain (dipakai tes untuk memastikan
 * tidak ada fallback ke .env).
 */
function loadDotenv() {
  if (process.env.NODE_ENV === 'test') return;
  dotenv.config({
    path: process.env.ENV_FILE || '.env',
    quiet: true,
  });
}

/**
 * Validasi environment tanpa efek samping (tidak memanggil process.exit).
 * @param {NodeJS.ProcessEnv} [rawEnv]
 * @returns {{ok: true, data: import('./schema.js').AppConfig} | {ok: false, errors: Array<{field: string, message: string}>}}
 */
export function parseConfig(rawEnv = process.env) {
  const parsed = configSchema.safeParse(rawEnv);

  if (!parsed.success) {
    return { ok: false, errors: formatConfigError(parsed.error) };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Cetak ringkasan konfigurasi yang gagal ke stderr.
 * Aman: hanya nama field dan pesan validasi, tanpa nilai input.
 * @param {Array<{field: string, message: string}>} errors
 */
export function printConfigErrors(errors) {
  const lines = [
    'Konfigurasi aplikasi tidak valid. Perbaiki variabel berikut lalu jalankan ulang:',
    ...errors.map((e) => `  - ${e.field}: ${e.message}`),
    'Lihat .env.example untuk daftar variabel yang dibutuhkan.',
  ];
  console.error(lines.join('\n'));
}

/**
 * Muat konfigurasi dan hentikan proses bila tidak valid (fail fast).
 * @returns {import('./schema.js').AppConfig}
 */
export function loadConfig(rawEnv = process.env) {
  const result = parseConfig(rawEnv);

  if (!result.ok) {
    printConfigErrors(result.errors);
    process.exit(1);
  }

  return result.data;
}

loadDotenv();

/** Konfigurasi aplikasi yang sudah divalidasi. */
export const config = loadConfig();
