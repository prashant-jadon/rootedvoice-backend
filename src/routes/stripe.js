const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
  createCheckoutSession,
  createEvaluationCheckout,
  verifyEvaluationPayment,
  createUpgradeCheckout,
  createPaymentIntent,
  createCancellationPayment,
  confirmPayment,
  processSessionPayment,
  refundPayment,
  verifyCheckoutSession,
  handleWebhook,
  getStripeConfig,
  createSessionPaymentCheckout,
  verifySessionPayment,
} = require('../controllers/stripeController');
const { isAdmin } = require('../middlewares/roleCheck');
const { sensitiveOpLimiter } = require('../middlewares/rateLimiter');

// Webhook route (raw body is handled in server.js)
router.post('/webhook', handleWebhook);

// Public routes
router.get('/config', getStripeConfig);

// Protected routes
router.use(protect);
router.post('/create-checkout-session', sensitiveOpLimiter, createCheckoutSession);
router.post('/create-evaluation-checkout', sensitiveOpLimiter, createEvaluationCheckout);
router.post('/verify-evaluation-payment', verifyEvaluationPayment);
router.post('/create-upgrade-checkout', sensitiveOpLimiter, createUpgradeCheckout);
router.post('/create-payment-intent', sensitiveOpLimiter, createPaymentIntent);
router.post('/create-cancellation-payment', sensitiveOpLimiter, createCancellationPayment);
router.post('/confirm-payment', confirmPayment);
router.post('/process-session-payment', sensitiveOpLimiter, processSessionPayment);
router.post('/verify-checkout', verifyCheckoutSession);
router.post('/refund', isAdmin, sensitiveOpLimiter, refundPayment);
router.post('/create-session-payment', sensitiveOpLimiter, createSessionPaymentCheckout);
router.post('/verify-session-payment', verifySessionPayment);

module.exports = router;
