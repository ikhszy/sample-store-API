import db from '../db/client.js';

// ---------------------------------------------------------------------------
// GET /products
// Query params: category, search, minPrice, maxPrice, page, limit, sort, order
// ---------------------------------------------------------------------------
export function listProducts(req, res) {
  const {
    category,
    search,
    minPrice,
    maxPrice,
    page    = 1,
    limit   = 12,
    sort    = 'id',
    order   = 'asc',
  } = req.query;

  const allowedSorts  = ['id', 'name', 'price', 'rating', 'stock', 'created_at'];
  const allowedOrders = ['asc', 'desc'];
  const safeSort  = allowedSorts.includes(sort)   ? sort  : 'id';
  const safeOrder = allowedOrders.includes(order) ? order : 'asc';

  const conditions = [];
  const params     = [];

  if (category) {
    conditions.push('LOWER(category) = LOWER(?)');
    params.push(category);
  }
  if (search) {
    conditions.push('(LOWER(name) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?))');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (minPrice !== undefined) {
    conditions.push('price >= ?');
    params.push(Number(minPrice));
  }
  if (maxPrice !== undefined) {
    conditions.push('price <= ?');
    params.push(Number(maxPrice));
  }

  const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total  = db.prepare(`SELECT COUNT(*) as count FROM products ${where}`).get(...params).count;

  const pageNum  = Math.max(1, parseInt(page,  10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 12));
  const offset   = (pageNum - 1) * pageSize;

  const rows = db.prepare(
    `SELECT * FROM products ${where} ORDER BY ${safeSort} ${safeOrder} LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset);

  return res.json({
    data: rows,
    pagination: {
      total,
      page:        pageNum,
      limit:       pageSize,
      total_pages: Math.ceil(total / pageSize),
    },
  });
}

// ---------------------------------------------------------------------------
// GET /products/:id
// ---------------------------------------------------------------------------
export function getProduct(req, res) {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  return res.json(product);
}

// ---------------------------------------------------------------------------
// POST /products  [admin only]
// ---------------------------------------------------------------------------
export function createProduct(req, res) {
  const { name, category, price, stock = 0, rating = 0, description = '' } = req.body;

  if (!name || !category || price === undefined) {
    return res.status(400).json({ error: 'name, category, and price are required.' });
  }

  const result = db.prepare(`
    INSERT INTO products (name, category, price, stock, rating, description)
    VALUES (@name, @category, @price, @stock, @rating, @description)
  `).run({ name, category, price: Number(price), stock: Number(stock), rating: Number(rating), description });

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json(product);
}

// ---------------------------------------------------------------------------
// PUT /products/:id  [admin only]
// ---------------------------------------------------------------------------
export function updateProduct(req, res) {
  const { name, category, price, stock, rating, description } = req.body;

  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });

  db.prepare(`
    UPDATE products
    SET name = @name, category = @category, price = @price,
        stock = @stock, rating = @rating, description = @description,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = @id
  `).run({
    id:          existing.id,
    name:        name        ?? existing.name,
    category:    category    ?? existing.category,
    price:       price       !== undefined ? Number(price)   : existing.price,
    stock:       stock       !== undefined ? Number(stock)   : existing.stock,
    rating:      rating      !== undefined ? Number(rating)  : existing.rating,
    description: description ?? existing.description,
  });

  return res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id));
}

// ---------------------------------------------------------------------------
// PATCH /products/:id  [admin only]
// ---------------------------------------------------------------------------
export function patchProduct(req, res) {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });

  const allowed = ['name', 'category', 'price', 'stock', 'rating', 'description'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No updatable fields provided.' });
  }

  const setClauses = Object.keys(updates)
    .map((k) => `${k} = @${k}`)
    .join(', ');

  db.prepare(
    `UPDATE products SET ${setClauses}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = @id`
  ).run({ ...updates, id: existing.id });

  return res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id));
}

// ---------------------------------------------------------------------------
// DELETE /products/:id  [admin only]
// ---------------------------------------------------------------------------
export function deleteProduct(req, res) {
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });

  db.prepare('DELETE FROM products WHERE id = ?').run(existing.id);
  return res.status(200).json({ message: 'Product deleted.' });
}
