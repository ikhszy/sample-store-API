import db from '../db/client.js';

// ---------------------------------------------------------------------------
// Helper: fetch a full order with its line items
// ---------------------------------------------------------------------------
function getOrderById(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;

  const items = db.prepare(
    'SELECT * FROM order_items WHERE order_id = ?'
  ).all(orderId);

  return { ...order, items };
}

// ---------------------------------------------------------------------------
// GET /orders
// Customers see only their own orders; admins see all.
// Query params: status, page, limit
// ---------------------------------------------------------------------------
export function listOrders(req, res) {
  const { status, page = 1, limit = 10 } = req.query;

  const conditions = [];
  const params     = [];

  if (req.user.role !== 'admin') {
    conditions.push('o.user_id = ?');
    params.push(req.user.id);
  }
  if (status) {
    conditions.push('o.status = ?');
    params.push(status);
  }

  const where    = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total    = db.prepare(`SELECT COUNT(*) as count FROM orders o ${where}`).get(...params).count;
  const pageNum  = Math.max(1, parseInt(page,  10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const offset   = (pageNum - 1) * pageSize;

  const orders = db.prepare(
    `SELECT o.* FROM orders o ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset);

  // Attach line items to each order
  const data = orders.map((o) => ({
    ...o,
    items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id),
  }));

  return res.json({
    data,
    pagination: {
      total,
      page:        pageNum,
      limit:       pageSize,
      total_pages: Math.ceil(total / pageSize),
    },
  });
}

// ---------------------------------------------------------------------------
// GET /orders/:id
// Customers can only view their own orders.
// ---------------------------------------------------------------------------
export function getOrder(req, res) {
  const order = getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  return res.json(order);
}

// ---------------------------------------------------------------------------
// POST /orders
// Creates an order from the current cart contents, then clears the cart.
// Body: { street, city, state, zip }
// ---------------------------------------------------------------------------
export function createOrder(req, res) {
  const { street, city, state, zip } = req.body;

  if (!street || !city || !state || !zip) {
    return res.status(400).json({ error: 'Shipping address (street, city, state, zip) is required.' });
  }

  const cart = db.prepare('SELECT * FROM carts WHERE user_id = ?').get(req.user.id);
  if (!cart) return res.status(400).json({ error: 'Cart is empty.' });

  const cartItems = db.prepare(`
    SELECT ci.quantity, p.id AS product_id, p.name, p.price, p.stock
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE ci.cart_id = ?
  `).all(cart.id);

  if (!cartItems.length) {
    return res.status(400).json({ error: 'Cart is empty.' });
  }

  // Check stock for all items before committing
  for (const item of cartItems) {
    if (item.stock < item.quantity) {
      return res.status(409).json({
        error: `Insufficient stock for "${item.name}". Available: ${item.stock}.`,
      });
    }
  }

  const total = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // Use a transaction: create order, insert items, decrement stock, clear cart
  const createTransaction = db.transaction(() => {
    const { lastInsertRowid: orderId } = db.prepare(`
      INSERT INTO orders (user_id, status, street, city, state, zip, total)
      VALUES (@user_id, 'pending', @street, @city, @state, @zip, @total)
    `).run({ user_id: req.user.id, street, city, state, zip, total: parseFloat(total.toFixed(2)) });

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, name, price, quantity)
      VALUES (@order_id, @product_id, @name, @price, @quantity)
    `);
    const decrementStock = db.prepare(
      'UPDATE products SET stock = stock - @quantity WHERE id = @product_id'
    );

    for (const item of cartItems) {
      insertItem.run({
        order_id:   orderId,
        product_id: item.product_id,
        name:       item.name,
        price:      item.price,
        quantity:   item.quantity,
      });
      decrementStock.run({ quantity: item.quantity, product_id: item.product_id });
    }

    // Clear the cart
    db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.id);

    return orderId;
  });

  const orderId = createTransaction();
  return res.status(201).json(getOrderById(orderId));
}

// ---------------------------------------------------------------------------
// PATCH /orders/:id/status  [admin only]
// Body: { status }
// ---------------------------------------------------------------------------
export function updateOrderStatus(req, res) {
  const { status } = req.body;
  const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}.` });
  }

  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  db.prepare(`
    UPDATE orders
    SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ?
  `).run(status, order.id);

  return res.json(getOrderById(order.id));
}

// ---------------------------------------------------------------------------
// DELETE /orders/:id  [admin only]
// ---------------------------------------------------------------------------
export function deleteOrder(req, res) {
  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  db.prepare('DELETE FROM orders WHERE id = ?').run(order.id);
  return res.json({ message: 'Order deleted.' });
}
