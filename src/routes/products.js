import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validateId } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  patchProduct,
  deleteProduct,
} from '../controllers/productsController.js';

const router = Router();

// Public routes
router.get('/',    asyncHandler(listProducts));
router.get('/:id', validateId(), asyncHandler(getProduct));

// Admin-only write routes
router.post('/',
  authenticate, requireAdmin,
  asyncHandler(createProduct)
);
router.put('/:id',
  authenticate, requireAdmin, validateId(),
  asyncHandler(updateProduct)
);
router.patch('/:id',
  authenticate, requireAdmin, validateId(),
  asyncHandler(patchProduct)
);
router.delete('/:id',
  authenticate, requireAdmin, validateId(),
  asyncHandler(deleteProduct)
);

export default router;
