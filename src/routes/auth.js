const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  logout,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const { authLimiter, createAccountLimiter, forgotPasswordLimiter } = require('../middlewares/rateLimiter');

// Public routes with rate limiting
router.post('/register', createAccountLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', authLimiter, refreshAccessToken);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

// Protected routes
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

module.exports = router;
