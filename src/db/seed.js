/**
 * Seed script — populates the database with demo data.
 * Safe to re-run: existing rows are skipped via INSERT OR IGNORE.
 *
 *   node src/db/seed.js
 *   npm run seed
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import db from './client.js';

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
const SALT_ROUNDS = 10;

const users = [
  { username: 'alice',  email: 'alice@example.com',  password: 'Password1!', first_name: 'Alice', last_name: 'Johnson', role: 'customer' },
  { username: 'bob',    email: 'bob@example.com',    password: 'Password1!', first_name: 'Bob',   last_name: 'Smith',   role: 'customer' },
  { username: 'carol',  email: 'carol@example.com',  password: 'Password1!', first_name: 'Carol', last_name: 'Williams',role: 'customer' },
  { username: 'dave',   email: 'dave@example.com',   password: 'Password1!', first_name: 'Dave',  last_name: 'Brown',   role: 'customer' },
  { username: 'admin',  email: 'admin@example.com',  password: 'Admin1234!', first_name: 'Admin', last_name: 'User',    role: 'admin'    },
];

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (username, email, password, first_name, last_name, role)
  VALUES (@username, @email, @password, @first_name, @last_name, @role)
`);

for (const u of users) {
  insertUser.run({ ...u, password: bcrypt.hashSync(u.password, SALT_ROUNDS) });
}
console.log('✅  Users seeded.');

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
const products = [
  { name: 'Wireless Headphones',  category: 'Electronics',  price: 79.99,  stock: 150, rating: 4.5, description: 'Over-ear wireless headphones with active noise cancellation and 30-hour battery life.' },
  { name: 'Mechanical Keyboard',  category: 'Electronics',  price: 129.99, stock: 80,  rating: 4.7, description: 'Compact TKL mechanical keyboard with RGB backlighting and tactile switches.' },
  { name: 'USB-C Hub',            category: 'Electronics',  price: 39.99,  stock: 200, rating: 4.3, description: '7-in-1 USB-C hub with HDMI, USB 3.0, SD card reader, and 100W PD passthrough.' },
  { name: 'Smart Watch',          category: 'Electronics',  price: 199.99, stock: 45,  rating: 4.7, description: 'Fitness tracker smart watch with heart rate monitor, GPS, and 5-day battery.' },
  { name: 'Bluetooth Speaker',    category: 'Electronics',  price: 59.99,  stock: 110, rating: 4.4, description: 'Portable waterproof speaker with 360° sound and 12-hour playtime.' },
  { name: 'Running Shoes',        category: 'Sports',       price: 94.99,  stock: 60,  rating: 4.6, description: 'Lightweight breathable running shoes with responsive foam sole.' },
  { name: 'Yoga Mat',             category: 'Sports',       price: 24.99,  stock: 300, rating: 4.4, description: 'Non-slip eco-friendly yoga mat, 6mm thick, includes carry strap.' },
  { name: 'Water Bottle',         category: 'Sports',       price: 19.99,  stock: 500, rating: 4.8, description: 'Insulated stainless steel water bottle, 32oz, keeps cold 24h / hot 12h.' },
  { name: 'Resistance Bands',     category: 'Sports',       price: 14.99,  stock: 400, rating: 4.5, description: 'Set of 5 resistance bands for home workouts, ranging from 10 to 50 lbs.' },
  { name: 'Protein Powder',       category: 'Sports',       price: 44.99,  stock: 350, rating: 4.4, description: 'Whey protein isolate, 2lb, chocolate flavour, 25g protein per serving.' },
  { name: 'Desk Lamp',            category: 'Home',         price: 34.99,  stock: 120, rating: 4.2, description: 'LED desk lamp with adjustable brightness, colour temperature, and USB charging port.' },
  { name: 'Coffee Maker',         category: 'Home',         price: 59.99,  stock: 90,  rating: 4.5, description: '12-cup programmable drip coffee maker with thermal carafe and auto-shutoff.' },
  { name: 'Air Purifier',         category: 'Home',         price: 89.99,  stock: 70,  rating: 4.6, description: 'True HEPA air purifier covering up to 300 sq ft, ultra-quiet sleep mode.' },
  { name: 'Backpack',             category: 'Accessories',  price: 49.99,  stock: 175, rating: 4.6, description: '30L laptop backpack with USB charging port and anti-theft hidden pocket.' },
  { name: 'Sunglasses',           category: 'Accessories',  price: 29.99,  stock: 250, rating: 4.3, description: 'Polarized UV400 sunglasses with lightweight TR90 frame.' },
  { name: 'Leather Wallet',       category: 'Accessories',  price: 39.99,  stock: 180, rating: 4.5, description: 'Slim genuine leather bifold wallet with RFID blocking.' },
];

const insertProduct = db.prepare(`
  INSERT OR IGNORE INTO products (name, category, price, stock, rating, description)
  VALUES (@name, @category, @price, @stock, @rating, @description)
`);

for (const p of products) {
  insertProduct.run(p);
}
console.log('✅  Products seeded.');

// ---------------------------------------------------------------------------
// Carts  (alice and bob get pre-populated carts)
// ---------------------------------------------------------------------------
const getUser = db.prepare('SELECT id FROM users WHERE username = ?');
const getProduct = db.prepare('SELECT id, price FROM products WHERE name = ?');

const insertCart = db.prepare(`
  INSERT OR IGNORE INTO carts (user_id) VALUES (?)
`);
const insertCartItem = db.prepare(`
  INSERT OR IGNORE INTO cart_items (cart_id, product_id, quantity)
  VALUES (@cart_id, @product_id, @quantity)
`);
const getCart = db.prepare('SELECT id FROM carts WHERE user_id = ?');

function seedCart(username, items) {
  const user = getUser.get(username);
  if (!user) return;
  insertCart.run(user.id);
  const cart = getCart.get(user.id);
  for (const { name, quantity } of items) {
    const product = getProduct.get(name);
    if (product) {
      insertCartItem.run({ cart_id: cart.id, product_id: product.id, quantity });
    }
  }
}

seedCart('alice', [
  { name: 'Wireless Headphones', quantity: 1 },
  { name: 'USB-C Hub',           quantity: 2 },
]);

seedCart('bob', [
  { name: 'Running Shoes', quantity: 1 },
  { name: 'Yoga Mat',      quantity: 1 },
  { name: 'Water Bottle',  quantity: 2 },
]);

console.log('✅  Carts seeded.');

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
const insertOrder = db.prepare(`
  INSERT OR IGNORE INTO orders (id, user_id, status, street, city, state, zip, total)
  VALUES (@id, @user_id, @status, @street, @city, @state, @zip, @total)
`);
const insertOrderItem = db.prepare(`
  INSERT OR IGNORE INTO order_items (order_id, product_id, name, price, quantity)
  VALUES (@order_id, @product_id, @name, @price, @quantity)
`);

function seedOrder(orderId, username, status, address, items) {
  const user = getUser.get(username);
  if (!user) return;

  const resolvedItems = items.map(({ name, quantity }) => {
    const p = getProduct.get(name);
    return p ? { product_id: p.id, name, price: p.price, quantity } : null;
  }).filter(Boolean);

  const total = resolvedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  insertOrder.run({
    id: orderId,
    user_id: user.id,
    status,
    ...address,
    total: parseFloat(total.toFixed(2)),
  });

  for (const item of resolvedItems) {
    insertOrderItem.run({ order_id: orderId, ...item });
  }
}

seedOrder(1, 'alice', 'delivered',
  { street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701' },
  [{ name: 'Mechanical Keyboard', quantity: 1 }, { name: 'Water Bottle', quantity: 2 }]
);

seedOrder(2, 'bob', 'shipped',
  { street: '456 Oak Ave', city: 'Shelbyville', state: 'IL', zip: '62565' },
  [{ name: 'Smart Watch', quantity: 1 }]
);

seedOrder(3, 'carol', 'processing',
  { street: '789 Pine Rd', city: 'Capital City', state: 'IL', zip: '62702' },
  [{ name: 'Desk Lamp', quantity: 1 }, { name: 'Backpack', quantity: 1 }]
);

seedOrder(4, 'alice', 'cancelled',
  { street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701' },
  [{ name: 'Sunglasses', quantity: 2 }]
);

seedOrder(5, 'dave', 'delivered',
  { street: '321 Elm St', city: 'Springfield', state: 'IL', zip: '62703' },
  [{ name: 'Protein Powder', quantity: 2 }, { name: 'Yoga Mat', quantity: 1 }]
);

console.log('✅  Orders seeded.');
console.log('\n🎉  Database ready. Run `npm run dev` to start the server.');
