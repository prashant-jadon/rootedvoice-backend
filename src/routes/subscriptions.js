const express = require('express');
const router = express.Router();
const {
  getPricingTiers,
  subscribeToPlan,
  getCurrentSubscription,
  cancelSubscription,
  getSubscriptionHistory,
  getRemainingSessions,
} = require('../controllers/subscriptionController');
const { protect } = require('../middlewares/auth');

// Public route - get pricing tiers
router.get('/pricing', getPricingTiers);

// Protected routes
router.post('/subscribe', protect, subscribeToPlan);
router.get('/current', protect, getCurrentSubscription);
router.get('/remaining-sessions', protect, getRemainingSessions);
router.delete('/cancel', protect, cancelSubscription);
router.get('/history', protect, getSubscriptionHistory);

module.exports = router;

