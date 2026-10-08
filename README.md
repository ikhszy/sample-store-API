# Express + SQLite REST API Showcase

A fully self-contained REST API built with **Node.js / Express** and **SQLite** (`better-sqlite3`). Clone it, install, and run — no external database or cloud service required.

Covers four domains: **Products**, **Cart**, **Orders**, and **Auth (JWT)**.

---

## Requirements

- Node.js ≥ 18
- npm ≥ 9

---

## Getting Started

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd <repo-folder>

# 2. Install dependencies
npm install

# 3. Create your .env file
cp .env.example .env
# Edit .env — change the JWT secrets at minimum

# 4. Seed the database
npm run setup

# 5. Start the dev server (auto-restarts on file changes)
npm run dev

# Or start without auto-restart
npm start
```

The server runs at **http://localhost:3001** by default.

---

## Seed Accounts

| Username | Password    | Role     |
|----------|-------------|----------|
| alice    | Password1!  | customer |
| bob      | Password1!  | customer |
| carol    | Password1!  | customer |
| dave     | Password1!  | customer |
| admin    | Admin1234!  | admin    |

---

## Authentication Flow

This API uses a **JWT access + refresh token** pair.

1. `POST /auth/login` → receive `access_token` (15 min) and `refresh_token` (7 days)
2. Include the access token on protected requests:
   ```
   Authorization: Bearer <access_token>
   ```
3. When the access token expires, call `POST /auth/refresh` with your `refresh_token` to get a new pair (token rotation — the old refresh token is invalidated).
4. `POST /auth/logout` revokes the refresh token server-side.

---

## API Reference

### Health

| Method | Path      | Auth | Description        |
|--------|-----------|------|--------------------|
| GET    | /health   | —    | Server health check |

---

### Auth  `/auth`

| Method | Path             | Auth     | Body fields                                          | Description               |
|--------|------------------|----------|------------------------------------------------------|---------------------------|
| POST   | /auth/register   | —        | `username`, `email`, `password`, `first_name`, `last_name` | Register a new user |
| POST   | /auth/login      | —        | `username`, `password`                               | Login, receive tokens     |
| POST   | /auth/refresh    | —        | `refresh_token`                                      | Rotate tokens             |
| POST   | /auth/logout     | —        | `refresh_token`                                      | Revoke refresh token      |
| GET    | /auth/me         | ✅ Bearer | —                                                   | Get current user profile  |

**Login response:**
```json
{
  "user": { "id": 1, "username": "alice", "role": "customer", ... },
  "access_token": "<jwt>",
  "refresh_token": "<jwt>"
}
```

---

### Products  `/products`

| Method | Path              | Auth          | Description                          |
|--------|-------------------|---------------|--------------------------------------|
| GET    | /products         | —             | List products (filterable, paginated) |
| GET    | /products/:id     | —             | Get single product                   |
| POST   | /products         | ✅ Admin       | Create product                       |
| PUT    | /products/:id     | ✅ Admin       | Full update                          |
| PATCH  | /products/:id     | ✅ Admin       | Partial update                       |
| DELETE | /products/:id     | ✅ Admin       | Delete product                       |

**Query parameters for `GET /products`:**

| Param    | Example                     | Description                        |
|----------|-----------------------------|------------------------------------|
| category | `?category=Electronics`     | Filter by category                 |
| search   | `?search=keyboard`          | Search name + description          |
| minPrice | `?minPrice=20`              | Price range (lower bound)          |
| maxPrice | `?maxPrice=100`             | Price range (upper bound)          |
| sort     | `?sort=price`               | `id`, `name`, `price`, `rating`, `stock` |
| order    | `?order=desc`               | `asc` or `desc`                    |
| page     | `?page=2`                   | Page number (default: 1)           |
| limit    | `?limit=6`                  | Items per page (default: 12, max: 100) |

---

### Cart  `/cart`

All cart endpoints require a valid Bearer token (each user has one cart).

| Method | Path                     | Description                                  |
|--------|--------------------------|----------------------------------------------|
| GET    | /cart                    | View cart (auto-created on first access)     |
| POST   | /cart/items              | Add item `{ product_id, quantity }`          |
| PATCH  | /cart/items/:productId   | Set quantity `{ quantity }` (0 = remove)     |
| DELETE | /cart/items/:productId   | Remove single item                           |
| DELETE | /cart                    | Clear entire cart                            |

---

### Orders  `/orders`

| Method | Path                     | Auth           | Description                                 |
|--------|--------------------------|----------------|---------------------------------------------|
| GET    | /orders                  | ✅ Bearer      | List orders (own for customers, all for admin) |
| GET    | /orders/:id              | ✅ Bearer      | Get order detail                            |
| POST   | /orders                  | ✅ Bearer      | Checkout: create order from cart `{ street, city, state, zip }` |
| PATCH  | /orders/:id/status       | ✅ Admin       | Update status `{ status }`                  |
| DELETE | /orders/:id              | ✅ Admin       | Delete order                                |

**Order statuses:** `pending` → `processing` → `shipped` → `delivered` | `cancelled`

**Checkout behaviour:** Creates the order from the current cart, decrements product stock, and clears the cart — all in a single transaction.

---

## Project Structure

```
├── src/
│   ├── app.js                  # Express app (middleware + routes)
│   ├── server.js               # HTTP server entry point + graceful shutdown
│   ├── db/
│   │   ├── client.js           # better-sqlite3 singleton
│   │   ├── schema.js           # Table definitions (run once)
│   │   └── seed.js             # Demo data
│   ├── middleware/
│   │   ├── auth.js             # JWT verify, requireAdmin, requireOwnerOrAdmin
│   │   ├── errorHandler.js     # Central error handler + asyncHandler wrapper
│   │   └── validate.js         # requireFields, validateId
│   ├── routes/
│   │   ├── auth.js
│   │   ├── products.js
│   │   ├── cart.js
│   │   └── orders.js
│   └── controllers/
│       ├── authController.js
│       ├── productsController.js
│       ├── cartController.js
│       └── ordersController.js
├── data/                       # SQLite DB file (git-ignored, created at runtime)
├── .env.example
├── .gitignore
└── package.json
```

---

## npm Scripts

| Script          | Description                                  |
|-----------------|----------------------------------------------|
| `npm start`     | Start server (production)                    |
| `npm run dev`   | Start with nodemon (auto-restart)            |
| `npm run seed`  | Seed the database only                       |
| `npm run setup` | Create schema + seed (run on fresh clone)    |

---

## Resetting the Database

```bash
rm -rf data/
npm run setup
```

---

## Using with Postman

1. Create an environment variable `baseUrl = http://localhost:3001`
2. Call `POST {{baseUrl}}/auth/login` and save the `access_token` to an env variable
3. Set the collection Authorization to **Bearer Token → `{{access_token}}`**
4. Use `POST {{baseUrl}}/auth/refresh` with the `refresh_token` when the access token expires

---

## End-to-End Flows

These flows show the full lifecycle of common use cases using `curl`. Replace `localhost:3001` with your base URL if needed.

---

### Flow 1 — Customer: Browse, Shop, and Checkout

#### Step 1: Register a new account

```bash
curl -s -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john",
    "email": "john@example.com",
    "password": "Password1!",
    "first_name": "John",
    "last_name": "Doe"
  }'
```

Response includes `access_token` and `refresh_token`. Save both.

---

#### Step 2: Login (or reuse tokens from register)

```bash
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "john", "password": "Password1!"}'
```

Save the `access_token` for subsequent requests:

```bash
TOKEN="<paste access_token here>"
```

---

#### Step 3: Browse products

```bash
# List all products (paginated)
curl -s "http://localhost:3001/products?page=1&limit=5"

# Filter by category
curl -s "http://localhost:3001/products?category=Electronics"

# Search by keyword
curl -s "http://localhost:3001/products?search=keyboard"

# Sort by price ascending
curl -s "http://localhost:3001/products?sort=price&order=asc"

# Get a single product
curl -s http://localhost:3001/products/1
```

---

#### Step 4: Add items to cart

```bash
# Add Wireless Headphones (product 1), qty 1
curl -s -X POST http://localhost:3001/cart/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product_id": 1, "quantity": 1}'

# Add USB-C Hub (product 3), qty 2
curl -s -X POST http://localhost:3001/cart/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product_id": 3, "quantity": 2}'
```

---

#### Step 5: View and update the cart

```bash
# View cart with subtotals and total
curl -s http://localhost:3001/cart \
  -H "Authorization: Bearer $TOKEN"

# Change USB-C Hub quantity to 1
curl -s -X PATCH http://localhost:3001/cart/items/3 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 1}'

# Remove an item (set quantity to 0)
curl -s -X PATCH http://localhost:3001/cart/items/3 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quantity": 0}'

# Or remove it directly
curl -s -X DELETE http://localhost:3001/cart/items/3 \
  -H "Authorization: Bearer $TOKEN"
```

---

#### Step 6: Checkout (create an order from the cart)

```bash
curl -s -X POST http://localhost:3001/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "street": "123 Main St",
    "city": "Springfield",
    "state": "IL",
    "zip": "62701"
  }'
```

This creates the order, decrements product stock, and clears the cart in a single transaction. The order starts with status `pending`.

---

#### Step 7: View your orders

```bash
# List all your orders
curl -s http://localhost:3001/orders \
  -H "Authorization: Bearer $TOKEN"

# Get a specific order by ID
curl -s http://localhost:3001/orders/1 \
  -H "Authorization: Bearer $TOKEN"
```

---

#### Step 8: Refresh the access token when it expires

```bash
curl -s -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "<paste refresh_token here>"}'
```

Returns a new `access_token` and a new `refresh_token`. The old refresh token is invalidated immediately.

---

#### Step 9: Logout

```bash
curl -s -X POST http://localhost:3001/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "<paste refresh_token here>"}'
```

---

### Flow 2 — Admin: Manage Products and Orders

#### Step 1: Login as admin

```bash
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin1234!"}'
```

```bash
ADMIN_TOKEN="<paste admin access_token here>"
```

---

#### Step 2: Create a new product

```bash
curl -s -X POST http://localhost:3001/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mechanical Mouse",
    "category": "Electronics",
    "price": 49.99,
    "stock": 120,
    "rating": 4.6,
    "description": "Ergonomic gaming mouse with adjustable DPI and RGB lighting."
  }'
```

---

#### Step 3: Update a product (full replace)

```bash
curl -s -X PUT http://localhost:3001/products/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Wireless Headphones Pro",
    "category": "Electronics",
    "price": 89.99,
    "stock": 140,
    "rating": 4.7,
    "description": "Upgraded model with better noise cancellation and 40-hour battery."
  }'
```

---

#### Step 4: Partially update a product

```bash
# Just update the stock and price
curl -s -X PATCH http://localhost:3001/products/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"stock": 200, "price": 84.99}'
```

---

#### Step 5: Advance an order through its lifecycle

```bash
# View all orders (admins see everyone's)
curl -s http://localhost:3001/orders \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Move order 1 through statuses
curl -s -X PATCH http://localhost:3001/orders/1/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "processing"}'

curl -s -X PATCH http://localhost:3001/orders/1/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "shipped"}'

curl -s -X PATCH http://localhost:3001/orders/1/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "delivered"}'
```

Valid statuses: `pending` → `processing` → `shipped` → `delivered` | `cancelled`

---

#### Step 6: Delete a product

```bash
curl -s -X DELETE http://localhost:3001/products/17 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

### Flow 3 — Token Rotation (Security)

This shows how the refresh token rotation works to keep sessions secure.

```bash
# 1. Login — get initial token pair
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "Password1!"}'

# 2. After 15 minutes, the access token expires.
#    Use the refresh token to get a new pair:
curl -s -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "<original_refresh_token>"}'
# → returns new access_token + new refresh_token
# → the original refresh_token is now invalid

# 3. Using the old refresh token again returns 401:
curl -s -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "<original_refresh_token>"}'
# → {"error": "Refresh token has been revoked."}
```
