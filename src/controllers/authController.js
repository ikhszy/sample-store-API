import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../db/client.js';

const SALT_ROUNDS = 10;

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { id: user.id, jti: crypto.randomUUID() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}

/** Persist a refresh token to the DB so we can revoke it on logout. */
function storeRefreshToken(userId, token) {
  const decoded = jwt.decode(token);
  const expiresAt = new Date(decoded.exp * 1000).toISOString();
  db.prepare(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
  ).run(userId, token, expiresAt);
}

// ---------------------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------------------
export async function register(req, res) {
  const { username, email, password, first_name, last_name } = req.body;

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const result = db.prepare(`
    INSERT INTO users (username, email, password, first_name, last_name)
    VALUES (@username, @email, @password, @first_name, @last_name)
  `).run({ username, email, password: hashedPassword, first_name, last_name });

  const user = db.prepare('SELECT id, username, email, first_name, last_name, role, created_at FROM users WHERE id = ?')
    .get(result.lastInsertRowid);

  const accessToken  = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  storeRefreshToken(user.id, refreshToken);

  return res.status(201).json({ user, access_token: accessToken, refresh_token: refreshToken });
}

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------
export async function login(req, res) {
  const { username, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const accessToken  = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  storeRefreshToken(user.id, refreshToken);

  const { password: _pw, ...safeUser } = user;
  return res.json({ user: safeUser, access_token: accessToken, refresh_token: refreshToken });
}

// ---------------------------------------------------------------------------
// POST /auth/refresh
// ---------------------------------------------------------------------------
export function refresh(req, res) {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ error: 'refresh_token is required.' });
  }

  // Verify signature & expiry first (cheap check, no DB hit)
  let payload;
  try {
    payload = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }

  // Atomically delete the token and retrieve it in one statement.
  // If two concurrent requests race here, only one will get a row back —
  // the other gets null and is rejected. This closes the SELECT-then-DELETE
  // race condition that allowed token reuse.
  const deleted = db.prepare(
    'DELETE FROM refresh_tokens WHERE token = ? RETURNING id'
  ).get(refresh_token);

  if (!deleted) {
    return res.status(401).json({ error: 'Refresh token has been revoked.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
  if (!user) {
    return res.status(401).json({ error: 'User not found.' });
  }

  // Issue a new token pair
  const newAccessToken  = signAccessToken(user);
  const newRefreshToken = signRefreshToken(user);
  storeRefreshToken(user.id, newRefreshToken);

  return res.json({ access_token: newAccessToken, refresh_token: newRefreshToken });
}

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------
export function logout(req, res) {
  const { refresh_token } = req.body;
  if (refresh_token) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refresh_token);
  }
  return res.json({ message: 'Logged out successfully.' });
}

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------
export function me(req, res) {
  const user = db.prepare(
    'SELECT id, username, email, first_name, last_name, role, created_at, updated_at FROM users WHERE id = ?'
  ).get(req.user.id);

  if (!user) return res.status(404).json({ error: 'User not found.' });
  return res.json(user);
}
