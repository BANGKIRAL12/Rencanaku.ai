import express from 'express';
import helmet from 'helmet';
import { config } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestId } from './middleware/request-id.js';
import { logger } from './core/logger/index.js';
import { healthRoutes } from './routes/health.js';

/**
 * Membuat instance Express app tanpa mengeksekusi listen()
 * Ini memungkinkan pengujian dengan supertest
 * @returns {import('express').Application}
 */
export function createApp() {
  const app = express();

  // Middleware dasar
  app.use(helmet({
    // Konfigurasi Helmet yang disesuaikan dengan kebutuhan aplikasi
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "data:"],
      },
    },
  }));
  
  // Body parser
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request ID
  app.use(requestId);

  // Routing
  app.use('/health', healthRoutes);

  // View engine (EJS)
  app.set('view engine', 'ejs');
  app.set('views', './src/views/pages');

  // Static files
  app.use('/assets', express.static('./public/assets'));

  // Route default untuk 404
  app.get('/', (req, res) => {
    res.render('index', {
      title: 'Beranda',
      layout: 'layouts/main',
    });
  });

  // Error handler (harus ditempatkan setelah semua route)
  app.use(errorHandler);

  // Error handler untuk uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  return app;
}
