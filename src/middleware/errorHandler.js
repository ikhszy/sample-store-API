/**
 * Central error handling middleware.
 * Catches anything passed to next(err) or unhandled throws in async routes.
 */
export function errorHandler(err, req, res, _next) {
  console.error(`[ERROR] ${req.method} ${req.path}`, err);

  // better-sqlite3 constraint violations
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: 'A record with that value already exists.' });
  }
  if (err.code?.startsWith('SQLITE_CONSTRAINT')) {
    return res.status(400).json({ error: 'Database constraint violation.', detail: err.message });
  }

  const status = err.status || err.statusCode || 500;
  const message = err.expose ? err.message : (status < 500 ? err.message : 'Internal server error.');
  res.status(status).json({ error: message });
}

/**
 * Wraps an async route handler so unhandled promise rejections
 * are forwarded to the error handler automatically.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
