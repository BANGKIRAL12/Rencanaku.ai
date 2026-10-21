import { configSchema } from './schema.js';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

/**
 * Validasi dan parsing environment variables menggunakan Zod
 * @returns {import('./schema.js').AppConfig}
 */
export function validateEnv() {
  const parsed = configSchema.safeParse(process.env);
  
  if (!parsed.success) {
    console.error('❌ Konfigurasi tidak valid:', parsed.error.flatten().fieldErrors);
    console.error('💡 Periksa file .env dan pastikan semua variabel didefinisikan dengan benar.');
    process.exit(1);
  }

  return parsed.data;
}

/**
 * Instance konfigurasi aplikasi yang telah divalidasi
 */
export const config = validateEnv();
