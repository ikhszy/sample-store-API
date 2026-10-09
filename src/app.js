import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import authRoutes     from './routes/auth.js';
import usersRoutes    from './routes/users.js';
import productsRoutes from './routes/products.js';
import cartRoutes     from './routes/cart.js';
import ordersRoutes   from './routes/orders.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/auth',     authRoutes);
app.use('/users',    usersRoutes);
app.use('/products', productsRoutes);
app.use('/cart',     cartRoutes);
app.use('/orders',   ordersRoutes);

// Health check — useful for Postman / quick verification
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// Central error handler (must be last)
app.use(errorHandler);

export default app;
