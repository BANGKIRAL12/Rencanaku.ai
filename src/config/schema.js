import { z } from 'zod';

/**
 * Schema validasi konfigurasi aplikasi menggunakan Zod
 * Schema ini harus kompatibel dengan `src/config/env.js`
 */
export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3000'),
  HOST: z.string().default('localhost'),
  BASE_URL: z.string().default('http://localhost:3000/'),
  // Security
  SESSION_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  // Database
  DATABASE_URL: z.string().default('file:data/app.sqlite'),
  // File storage
  FILE_STORAGE_PATH: z.string().default('data/files'),
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().regex(/^\d+$/).transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().regex(/^\d+$/).transform(Number).default('100'),
});

/**
 * Type inference untuk konfigurasi
 * @typedef {z.infer<typeof configSchema>} AppConfig
 */
