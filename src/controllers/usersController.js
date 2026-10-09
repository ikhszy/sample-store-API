import bcrypt from 'bcryptjs';
import db from '../db/client.js';

const SALT_ROUNDS = 10;

// ---------------------------------------------------------------------------
// GET /users
// Query params: role, search, page, limit
// ---------------------------------------------------------------------------
export function listUsers(req, res) {
  const { role, search, page = 1, limit = 10 } = req.query;

  const conditions = [];
  const params     = [];

  if (role) {
    conditions.push('role = ?');
    params.push(role);
  }
  if (search) {
    conditions.push('(LOWER(username) LIKE LOWER(?) OR LOWER(email) LIKE LOWER(?) OR LOWER(first_name) LIKE LOWER(?) OR LOWER(last_name) LIKE LOWER(?))');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where    = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total    = db.prepare(`SELECT COUNT(*) as count FROM users ${where}`).get(...params).count;
  const pageNum  = Math.max(1, parseInt(page,  10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const offset   = (pageNum - 1) * pageSize;

  const users = db.prepare(
    `SELECT id, username, email, first_name, last_name, role, created_at, updated_at
     FROM users ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset);

  return res.json({
    data: users,
    pagination: {
      total,
      page:        pageNum,
      limit:       pageSize,
      total_pages: Math.ceil(total / pageSize),
    },
  });
}

// ---------------------------------------------------------------------------
// GET /users/:id
// ---------------------------------------------------------------------------
export function getUser(req, res) {
  const user = db.prepare(
    'SELECT id, username, email, first_name, last_name, role, created_at, updated_at FROM users WHERE id = ?'
  ).get(req.params.id);

  if (!user) return res.status(404).json({ error: 'User not found.' });
  return res.json(user);
}

// ---------------------------------------------------------------------------
// POST /users  — admin creates a user directly (no token issued)
// Body: username, email, password, first_name, last_name, role
// ---------------------------------------------------------------------------
export async function createUser(req, res) {
  const { username, email, password, first_name, last_name, role = 'customer' } = req.body;

  const validRoles = ['customer', 'admin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}.` });
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const result = db.prepare(`
    INSERT INTO users (username, email, password, first_name, last_name, role)
    VALUES (@username, @email, @password, @first_name, @last_name, @role)
  `).run({ username, email, password: hashedPassword, first_name, last_name, role });

  const user = db.prepare(
    'SELECT id, username, email, first_name, last_name, role, created_at FROM users WHERE id = ?'
  ).get(result.lastInsertRowid);

  return res.status(201).json(user);
}

// ---------------------------------------------------------------------------
// PUT /users/:id  — full update
// ---------------------------------------------------------------------------
export async function updateUser(req, res) {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found.' });

  const { username, email, password, first_name, last_name, role } = req.body;

  const validRoles = ['customer', 'admin'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}.` });
  }

  const hashedPassword = password
    ? await bcrypt.hash(password, SALT_ROUNDS)
    : existing.password;

  db.prepare(`
    UPDATE users
    SET username   = @username,
        email      = @email,
        password   = @password,
        first_name = @first_name,
        last_name  = @last_name,
        role       = @role,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = @id
  `).run({
    id:         existing.id,
    username:   username   ?? existing.username,
    email:      email      ?? existing.email,
    password:   hashedPassword,
    first_name: first_name ?? existing.first_name,
    last_name:  last_name  ?? existing.last_name,
    role:       role       ?? existing.role,
  });

  return res.json(
    db.prepare(
      'SELECT id, username, email, first_name, last_name, role, created_at, updated_at FROM users WHERE id = ?'
    ).get(existing.id)
  );
}

// ---------------------------------------------------------------------------
// PATCH /users/:id  — partial update
// ---------------------------------------------------------------------------
export async function patchUser(req, res) {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found.' });

  const allowed = ['username', 'email', 'password', 'first_name', 'last_name', 'role'];
  const updates = {};

  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No updatable fields provided.' });
  }

  if (updates.role && !['customer', 'admin'].includes(updates.role)) {
    return res.status(400).json({ error: 'role must be one of: customer, admin.' });
  }

  if (updates.password) {
    updates.password = await bcrypt.hash(updates.password, SALT_ROUNDS);
  }

  const setClauses = Object.keys(updates).map((k) => `${k} = @${k}`).join(', ');

  db.prepare(
    `UPDATE users SET ${setClauses}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = @id`
  ).run({ ...updates, id: existing.id });

  return res.json(
    db.prepare(
      'SELECT id, username, email, first_name, last_name, role, created_at, updated_at FROM users WHERE id = ?'
    ).get(existing.id)
  );
}

// ---------------------------------------------------------------------------
// DELETE /users/:id
// Prevents admin from deleting their own account.
// ---------------------------------------------------------------------------
export function deleteUser(req, res) {
  const targetId = parseInt(req.params.id, 10);

  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!existing) return res.status(404).json({ error: 'User not found.' });

  // Cascade in schema handles refresh_tokens, carts, and orders
  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  return res.json({ message: 'User deleted.' });
}
