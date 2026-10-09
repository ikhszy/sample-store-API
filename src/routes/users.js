import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { requireFields, validateId } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  patchUser,
  deleteUser,
} from '../controllers/usersController.js';

const router = Router();

// All /users routes require a valid token AND admin role
router.use(authenticate, requireAdmin);

// GET  /users          — list all users (filterable, paginated)
router.get('/', asyncHandler(listUsers));

// GET  /users/:id      — get a single user
router.get('/:id', validateId(), asyncHandler(getUser));

// POST /users          — create a user (admin can set role directly)
router.post('/',
  requireFields('username', 'email', 'password', 'first_name', 'last_name'),
  asyncHandler(createUser)
);

// PUT  /users/:id      — full update
router.put('/:id', validateId(), asyncHandler(updateUser));

// PATCH /users/:id     — partial update (e.g. promote to admin)
router.patch('/:id', validateId(), asyncHandler(patchUser));

// DELETE /users/:id    — delete a user (cannot delete self)
router.delete('/:id', validateId(), asyncHandler(deleteUser));

export default router;
