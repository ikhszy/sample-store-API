import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
} from '../controllers/cartController.js';

const router = Router();

// All cart routes require authentication
router.use(authenticate);

// GET  /cart           — view cart
router.get('/', asyncHandler(getCart));

// POST /cart/items     — add item (or increment quantity)
router.post('/items', asyncHandler(addItem));

// PATCH /cart/items/:productId  — set absolute quantity (0 = remove)
router.patch('/items/:productId', asyncHandler(updateItem));

// DELETE /cart/items/:productId — remove a single item
router.delete('/items/:productId', asyncHandler(removeItem));

// DELETE /cart         — clear entire cart
router.delete('/', asyncHandler(clearCart));

export default router;
