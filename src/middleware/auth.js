import jwt from 'jsonwebtoken';

/**
 * Verifies the Bearer access token in the Authorization header.
 * Attaches the decoded payload to req.user on success.
 */
export function authenticate(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = payload; // { id, username, role, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid access token.' });
  }
}

/**
 * Restricts a route to users with the 'admin' role.
 * Must be used after authenticate().
 */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

/**
 * Allows access only if the authenticated user owns the resource,
 * or is an admin.
 *
 * @param {function} getOwnerId - (req) => ownerUserId (number or string)
 */
export function requireOwnerOrAdmin(getOwnerId) {
  return (req, res, next) => {
    const ownerId = Number(getOwnerId(req));
    if (req.user?.role === 'admin' || req.user?.id === ownerId) {
      return next();
    }
    return res.status(403).json({ error: 'Access denied.' });
  };
}
