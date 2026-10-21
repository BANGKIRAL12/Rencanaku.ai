import { randomUUID } from 'node:crypto';

/**
 * Middleware request ID.
 * Memakai `crypto.randomUUID()` bawaan Node sehingga tidak perlu
 * dependency tambahan.
 */
export function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  const id =
    typeof incoming === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(incoming)
      ? incoming
      : randomUUID();

  req.id = id;
  res.setHeader('X-Request-Id', id);
  res.locals.requestId = id;

  next();
}
