const express = require('express');
const router = express.Router();
const {
  getTherapists,
  getTherapist,
  getMyProfile,
  createOrUpdateTherapist,
  updateAvailability,
  getTherapistStats,
} = require('../controllers/therapistController');
const { protect, optionalAuth } = require('../middlewares/auth');
const { isTherapist } = require('../middlewares/roleCheck');

// Public routes
router.get('/', optionalAuth, getTherapists);

// Protected routes - Therapist only
router.get('/me', protect, isTherapist, getMyProfile);
router.post('/', protect, isTherapist, createOrUpdateTherapist);
router.put('/:id/availability', protect, isTherapist, updateAvailability);
router.get('/:id/stats', protect, getTherapistStats);

// Public/shared routes (must be after /me to avoid conflicts)
router.get('/:id', optionalAuth, getTherapist);

module.exports = router;

