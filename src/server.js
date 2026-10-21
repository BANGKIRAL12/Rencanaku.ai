#!/usr/bin/env node

import { createApp } from './app.js';
import { config } from './config/env.js';
import { logger } from './core/logger/index.js';

// Buat aplikasi Express
const app = createApp();

// Jalankan server
const server = app.listen(config.PORT, config.HOST, () => {
  logger.info(`🚀 Server berjalan di http://${config.HOST}:${config.PORT}`);
  logger.info(`⚙️  Environment: ${config.NODE_ENV}`);
});

// Graceful shutdown
const shutdown = (signal) => {
  logger.info(`🛑 Menerima sinyal ${signal}, menutup server...`);
  server.close(() => {
    logger.info('🔒 Server ditutup dengan sukses');
    process.exit(0);
  });

  // Timeout jika server tidak menutup dalam 5 detik
  setTimeout(() => {
    logger.error('⏰ Timeout saat menutup server');
    process.exit(1);
  }, 5000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
