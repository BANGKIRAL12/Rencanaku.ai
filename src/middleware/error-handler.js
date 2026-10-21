import { logger } from '../core/logger/index.js';

/**
 * Error handler khusus untuk Express
 * @param {Error} err - Error yang terjadi
 * @param {import('express').Request} req - Request object
 * @param {import('express').Response} res - Response object
 * @param {import('express').NextFunction} next - Next function
 */
export function errorHandler(err, req, res, next) {
  // Log error dengan detail
  const errorInfo = {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  };

  logger.error('Express Error:', errorInfo);

  // Kirim response error sesuai dengan tipe request
  if (req.headers.accept?.includes('application/json') || req.xhr) {
    // JSON response
    res.status(err.status || 500).json({
      error: {
        message: process.env.NODE_ENV === 'development' ? err.message : 'Terjadi kesalahan pada server',
        status: err.status || 500,
      },
    });
  } else {
    // HTML response
    const status = err.status || 500;
    res.status(status).render('errors/' + status, {
      title: `Error ${status}`,
      layout: 'layouts/main',
      error: process.env.NODE_ENV === 'development' ? err : undefined,
    });
  }
}
