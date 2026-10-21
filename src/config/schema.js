import { z } from 'zod';

/**
 * Schema validasi konfigurasi aplikasi (Zod).
 *
 * Catatan:
 * - Nilai numerik dikonversi eksplisit dengan `z.coerce.number()` agar
 *   hasil default maupun input string dari environment sama-sama number.
 * - Pesan validasi ditulis dalam Bahasa Indonesia dan tidak pernah
 *   menyertakan nilai input, sehingga aman dicetak ke log.
 */
export const configSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'], {
      error: 'harus salah satu dari: development, production, test',
    })
    .default('development'),

  PORT: z.coerce
    .number({ error: 'harus berupa angka' })
    .int('harus bilangan bulat')
    .min(1, 'minimal 1')
    .max(65535, 'maksimal 65535')
    .default(3000),

  HOST: z
    .string({ error: 'wajib diisi' })
    .min(1, 'tidak boleh kosong')
    .default('localhost'),

  BASE_URL: z
    .string({ error: 'wajib diisi' })
    .url('harus berupa URL lengkap, mis. http://localhost:3000/')
    .default('http://localhost:3000/'),

  // Keamanan
  SESSION_SECRET: z
    .string({ error: 'wajib diisi (buat secret acak)' })
    .min(32, 'minimal 32 karakter'),
  CSRF_SECRET: z
    .string({ error: 'wajib diisi (buat secret acak berbeda)' })
    .min(32, 'minimal 32 karakter'),

  // Logging
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug'], {
      error: 'harus salah satu dari: error, warn, info, debug',
    })
    .default('info'),

  // Database & penyimpanan
  DATABASE_URL: z
    .string({ error: 'wajib diisi' })
    .min(1, 'tidak boleh kosong')
    .default('file:data/app.sqlite'),
  FILE_STORAGE_PATH: z
    .string({ error: 'wajib diisi' })
    .min(1, 'tidak boleh kosong')
    .default('data/files'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number({ error: 'harus berupa angka' })
    .int('harus bilangan bulat')
    .positive('harus lebih dari 0')
    .default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce
    .number({ error: 'harus berupa angka' })
    .int('harus bilangan bulat')
    .positive('harus lebih dari 0')
    .default(100),
});

/**
 * Ubah error Zod menjadi daftar pesan aman.
 * Hanya nama field + pesan validasi yang dikembalikan; nilai input
 * (yang bisa berupa rahasia) tidak pernah disertakan.
 *
 * @param {import('zod').ZodError} error
 * @returns {Array<{field: string, message: string}>}
 */
export function formatConfigError(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * @typedef {z.infer<typeof configSchema>} AppConfig
 */
