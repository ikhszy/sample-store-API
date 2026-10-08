import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireFields } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  register,
  login,
  refresh,
  logout,
  me,
} from '../controllers/authController.js';

const router = Router();

// POST /auth/register
router.post('/register',
  requireFields('username', 'email', 'password', 'first_name', 'last_name'),
  asyncHandler(register)
);

// POST /auth/login
router.post('/login',
  requireFields('username', 'password'),
  asyncHandler(login)
);

// POST /auth/refresh
router.post('/refresh', asyncHandler(refresh));

// POST /auth/logout
router.post('/logout', logout);

// GET /auth/me  (protected)
router.get('/me', authenticate, asyncHandler(me));

export default router;
