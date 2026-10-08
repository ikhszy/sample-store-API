import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validateId } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  listOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  deleteOrder,
} from '../controllers/ordersController.js';

const router = Router();

// All order routes require authentication
router.use(authenticate);

// GET  /orders          — list (own orders for customers, all for admin)
router.get('/', asyncHandler(listOrders));

// GET  /orders/:id      — get one (own order for customers, any for admin)
router.get('/:id', validateId(), asyncHandler(getOrder));

// POST /orders          — checkout: create order from cart
router.post('/', asyncHandler(createOrder));

// PATCH /orders/:id/status  [admin only]
router.patch('/:id/status', requireAdmin, validateId(), asyncHandler(updateOrderStatus));

// DELETE /orders/:id    [admin only]
router.delete('/:id', requireAdmin, validateId(), asyncHandler(deleteOrder));

export default router;
