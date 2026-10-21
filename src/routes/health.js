import { Router } from 'express';
import { logger } from '../core/logger/index.js';

const router = Router();

/**
 * Health check endpoint - live
 * @route GET /health/live
 * @access Public
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Health check endpoint - ready
 * @route GET /health/ready
 * @access Public
 */
router.get('/ready', (req, res) => {
  // Cek ketersediaan service critical (misalnya database)
  // Untuk sekarang, hanya cek apakah server bisa merespon
  logger.debug('Health check ready endpoint accessed');
  
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export { router as healthRoutes };
