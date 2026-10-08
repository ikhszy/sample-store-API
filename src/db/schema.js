/**
 * Database schema setup.
 * Run once before first start, or any time you want to reset the schema.
 *
 *   node src/db/schema.js
 *   npm run setup   (runs schema + seed)
 */

import 'dotenv/config';
import db from './client.js';

db.exec(`
  -- -------------------------------------------------------------------------
  -- Users
  -- -------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT    NOT NULL UNIQUE,
    email       TEXT    NOT NULL UNIQUE,
    password    TEXT    NOT NULL,             -- bcrypt hash
    first_name  TEXT    NOT NULL,
    last_name   TEXT    NOT NULL,
    role        TEXT    NOT NULL DEFAULT 'customer' CHECK(role IN ('customer', 'admin')),
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  -- -------------------------------------------------------------------------
  -- Refresh tokens (one row per issued token; deleted on logout / rotation)
  -- -------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT    NOT NULL UNIQUE,
    expires_at  TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  -- -------------------------------------------------------------------------
  -- Products
  -- -------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    category    TEXT    NOT NULL,
    price       REAL    NOT NULL CHECK(price >= 0),
    stock       INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
    rating      REAL    NOT NULL DEFAULT 0 CHECK(rating BETWEEN 0 AND 5),
    description TEXT,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  -- -------------------------------------------------------------------------
  -- Carts  (one cart per user)
  -- -------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS carts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    cart_id     INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity    INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
    UNIQUE(cart_id, product_id)
  );

  -- -------------------------------------------------------------------------
  -- Orders
  -- -------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS orders (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status           TEXT    NOT NULL DEFAULT 'pending'
                       CHECK(status IN ('pending','processing','shipped','delivered','cancelled')),
    street           TEXT,
    city             TEXT,
    state            TEXT,
    zip              TEXT,
    total            REAL    NOT NULL DEFAULT 0,
    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id  INTEGER NOT NULL REFERENCES products(id),
    name        TEXT    NOT NULL,   -- snapshot at time of order
    price       REAL    NOT NULL,   -- snapshot at time of order
    quantity    INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0)
  );
`);

console.log('✅  Schema created (or already up to date).');
