import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware untuk menambahkan request ID ke setiap request
 * @param {import('express').Request} req - Request object
 * @param {import('express').Response} res - Response object
 * @param {import('express').NextFunction} next - Next function
 */
export function requestId(req, res, next) {
  // Buat request ID jika belum ada
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = uuidv4();
  }
  
  // Simpan di locals untuk bisa digunakan di view
  res.locals.requestId = req.headers['x-request-id'];
  
  next();
}
