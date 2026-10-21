import { Router } from 'express';

const router = Router();

/** Halaman beranda. */
router.get('/', (req, res) => {
  res.render('pages/index', {
    title: 'Beranda',
    requestId: res.locals.requestId,
  });
});

export { router as pageRoutes };
