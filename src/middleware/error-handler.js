import { logger } from '../core/logger/index.js';

/**
 * Apakah request mengharapkan JSON?
 * @param {import('express').Request} req
 */
export function wantsJson(req) {
  const accept = req.headers.accept || '';
  if (accept.includes('application/json')) return true;
  return req.path.startsWith('/api/');
}

/**
 * Ambil status aman dari error.
 * @param {any} err
 */
function safeStatus(err) {
  const status = Number(err?.status ?? err?.statusCode ?? 500);
  if (!Number.isInteger(status) || status < 400 || status > 599) return 500;
  return status;
}

/**
 * Pesan publik per status. Tidak pernah memuat pesan internal error.
 * @param {number} status
 */
function publicMessage(status) {
  switch (status) {
    case 400:
      return 'Permintaan tidak valid.';
    case 401:
      return 'Anda perlu masuk terlebih dahulu.';
    case 403:
      return 'Anda tidak memiliki izin untuk mengakses sumber daya ini.';
    case 404:
      return 'Sumber daya tidak ditemukan.';
    case 413:
      return 'Data yang dikirim terlalu besar.';
    case 429:
      return 'Terlalu banyak permintaan. Coba lagi nanti.';
    default:
      return 'Terjadi kesalahan pada server.';
  }
}

/**
 * Factory error handler Express (4 argumen) dengan opsi konfigurasi.
 * @param {{config: import('../config/schema.js').AppConfig}} options
 */
export function createErrorHandler({ config }) {
  const isDevelopment = config.NODE_ENV === 'development';

  return function errorHandler(err, req, res, next) {
    // Bila header sudah terkirim, serahkan ke Express.
    if (res.headersSent) return next(err);

    const status = safeStatus(err);
    const requestId = res.locals.requestId;

    logger.error('Permintaan gagal diproses', {
      requestId,
      status,
      method: req.method,
      path: req.path,
      message: err?.message,
      stack: err?.stack,
    });

    if (wantsJson(req)) {
      const body = {
        error: {
          status,
          message: publicMessage(status),
          requestId,
        },
      };
      // Detail teknis hanya pada mode development dan bukan rahasia.
      if (isDevelopment && status >= 500) {
        body.error.detail = err?.message;
      }
      return res.status(status).json(body);
    }

    // Render halaman error HTML tanpa stack trace.
    const template = ['403', '404'].includes(String(status))
      ? `errors/${status}`
      : 'errors/500';

    return res.status(status).render(
      template,
      {
        title: status === 404 ? 'Halaman Tidak Ditemukan' : 'Terjadi Kesalahan',
        status,
        requestId,
      },
      (renderErr, html) => {
        if (renderErr) {
          logger.error('Gagal merender halaman error', {
            requestId,
            message: renderErr.message,
          });
          return res
            .status(status)
            .type('text/plain')
            .send(publicMessage(status));
        }
        return res.status(status).send(html);
      },
    );
  };
}
