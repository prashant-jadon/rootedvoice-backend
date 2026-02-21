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

// Webhook route (raw body is handled in server.js)
router.post('/webhook', handleWebhook);

// Public routes
router.get('/config', getStripeConfig);

// Protected routes
router.use(protect);
router.post('/create-checkout-session', createCheckoutSession);
router.post('/create-evaluation-checkout', createEvaluationCheckout);
router.post('/verify-evaluation-payment', verifyEvaluationPayment);
router.post('/create-upgrade-checkout', createUpgradeCheckout);
router.post('/create-payment-intent', createPaymentIntent);
router.post('/create-cancellation-payment', createCancellationPayment);
router.post('/confirm-payment', confirmPayment);
router.post('/process-session-payment', processSessionPayment);
router.post('/verify-checkout', verifyCheckoutSession);
router.post('/refund', isAdmin, refundPayment);
router.post('/create-session-payment', createSessionPaymentCheckout);
router.post('/verify-session-payment', verifySessionPayment);

module.exports = router;
