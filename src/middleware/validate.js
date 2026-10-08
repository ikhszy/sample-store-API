/**
 * Lightweight field validation helpers.
 * Returns a 400 response if validation fails, otherwise calls next().
 */

/**
 * Builds a middleware that checks required fields are present and non-empty.
 * @param {...string} fields - field names to require in req.body
 */
export function requireFields(...fields) {
  return (req, res, next) => {
    const missing = fields.filter(
      (f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === ''
    );
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}.` });
    }
    next();
  };
}

/**
 * Validates that a numeric route param is a positive integer.
 * @param {string} param - e.g. 'id'
 */
export function validateId(param = 'id') {
  return (req, res, next) => {
    const val = Number(req.params[param]);
    if (!Number.isInteger(val) || val < 1) {
      return res.status(400).json({ error: `Invalid ${param}: must be a positive integer.` });
    }
    next();
  };
}
