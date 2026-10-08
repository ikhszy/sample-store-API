import db from '../db/client.js';

// ---------------------------------------------------------------------------
// Helper: fetch a cart with its items for a given user
// ---------------------------------------------------------------------------
function getCartForUser(userId) {
  const cart = db.prepare('SELECT * FROM carts WHERE user_id = ?').get(userId);
  if (!cart) return null;

  const items = db.prepare(`
    SELECT
      ci.id        AS cart_item_id,
      ci.quantity,
      p.id         AS product_id,
      p.name,
      p.category,
      p.price,
      p.stock,
      p.description,
      ROUND(p.price * ci.quantity, 2) AS subtotal
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE ci.cart_id = ?
  `).all(cart.id);

  const total = items.reduce((sum, i) => sum + i.subtotal, 0);
  return { ...cart, items, total: parseFloat(total.toFixed(2)) };
}

// ---------------------------------------------------------------------------
// GET /cart
// Returns the authenticated user's cart (creates one if it doesn't exist yet)
// ---------------------------------------------------------------------------
export function getCart(req, res) {
  let cart = getCartForUser(req.user.id);

  if (!cart) {
    // Auto-create an empty cart on first access
    const result = db.prepare('INSERT INTO carts (user_id) VALUES (?)').run(req.user.id);
    cart = { id: result.lastInsertRowid, user_id: req.user.id, items: [], total: 0 };
  }

  return res.json(cart);
}

// ---------------------------------------------------------------------------
// POST /cart/items
// Body: { product_id, quantity }
// Adds an item or increments quantity if already in cart
// ---------------------------------------------------------------------------
export function addItem(req, res) {
  const { product_id, quantity = 1 } = req.body;

  if (!product_id) {
    return res.status(400).json({ error: 'product_id is required.' });
  }

  const qty = parseInt(quantity, 10);
  if (!Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ error: 'quantity must be a positive integer.' });
  }

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(product_id));
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  if (product.stock < qty) {
    return res.status(409).json({ error: `Only ${product.stock} unit(s) in stock.` });
  }

  // Ensure cart exists
  let cart = db.prepare('SELECT * FROM carts WHERE user_id = ?').get(req.user.id);
  if (!cart) {
    const r = db.prepare('INSERT INTO carts (user_id) VALUES (?)').run(req.user.id);
    cart = { id: r.lastInsertRowid };
  }

  // Upsert: increment if exists, insert if not
  const existing = db.prepare(
    'SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?'
  ).get(cart.id, product.id);

  if (existing) {
    db.prepare(
      'UPDATE cart_items SET quantity = quantity + ? WHERE id = ?'
    ).run(qty, existing.id);
  } else {
    db.prepare(
      'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)'
    ).run(cart.id, product.id, qty);
  }

  // Touch updated_at on cart
  db.prepare(
    `UPDATE carts SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
  ).run(cart.id);

  return res.status(201).json(getCartForUser(req.user.id));
}

// ---------------------------------------------------------------------------
// PATCH /cart/items/:productId
// Body: { quantity }  — sets an absolute quantity (use 0 to remove)
// ---------------------------------------------------------------------------
export function updateItem(req, res) {
  const productId = parseInt(req.params.productId, 10);
  const quantity  = parseInt(req.body.quantity,    10);

  if (!Number.isInteger(quantity) || quantity < 0) {
    return res.status(400).json({ error: 'quantity must be a non-negative integer.' });
  }

  const cart = db.prepare('SELECT * FROM carts WHERE user_id = ?').get(req.user.id);
  if (!cart) return res.status(404).json({ error: 'Cart not found.' });

  const item = db.prepare(
    'SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?'
  ).get(cart.id, productId);
  if (!item) return res.status(404).json({ error: 'Item not in cart.' });

  if (quantity === 0) {
    db.prepare('DELETE FROM cart_items WHERE id = ?').run(item.id);
  } else {
    const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId);
    if (product && product.stock < quantity) {
      return res.status(409).json({ error: `Only ${product.stock} unit(s) in stock.` });
    }
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, item.id);
  }

  db.prepare(
    `UPDATE carts SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
  ).run(cart.id);

  return res.json(getCartForUser(req.user.id));
}

// ---------------------------------------------------------------------------
// DELETE /cart/items/:productId
// Removes a single product from the cart
// ---------------------------------------------------------------------------
export function removeItem(req, res) {
  const productId = parseInt(req.params.productId, 10);

  const cart = db.prepare('SELECT * FROM carts WHERE user_id = ?').get(req.user.id);
  if (!cart) return res.status(404).json({ error: 'Cart not found.' });

  const item = db.prepare(
    'SELECT id FROM cart_items WHERE cart_id = ? AND product_id = ?'
  ).get(cart.id, productId);
  if (!item) return res.status(404).json({ error: 'Item not in cart.' });

  db.prepare('DELETE FROM cart_items WHERE id = ?').run(item.id);
  db.prepare(
    `UPDATE carts SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
  ).run(cart.id);

  return res.json(getCartForUser(req.user.id));
}

// ---------------------------------------------------------------------------
// DELETE /cart
// Clears all items from the cart (keeps the cart record)
// ---------------------------------------------------------------------------
export function clearCart(req, res) {
  const cart = db.prepare('SELECT * FROM carts WHERE user_id = ?').get(req.user.id);
  if (!cart) return res.status(404).json({ error: 'Cart not found.' });

  db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.id);
  db.prepare(
    `UPDATE carts SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
  ).run(cart.id);

  return res.json({ message: 'Cart cleared.', cart: getCartForUser(req.user.id) });
}
