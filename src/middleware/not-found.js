import { wantsJson } from './error-handler.js';

/**
 * Handler 404: render halaman HTML kustom atau JSON sesuai Accept header.
 * Dipasang sebelum error handler.
 */
export function notFoundHandler(req, res) {
  const requestId = res.locals.requestId;

  if (wantsJson(req)) {
    return res.status(404).json({
      error: {
        status: 404,
        message: 'Sumber daya tidak ditemukan.',
        requestId,
      },
    });
  }

  return res.status(404).render(
    'errors/404',
    { title: 'Halaman Tidak Ditemukan', status: 404, requestId },
    (renderErr, html) => {
      if (renderErr) {
        return res
          .status(404)
          .type('text/plain')
          .send('Halaman tidak ditemukan.');
      }
      return res.status(404).send(html);
    },
  );
}
