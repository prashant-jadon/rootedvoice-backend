const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { isAdmin } = require('../middlewares/roleCheck');
const {
  getAllUsers,
  getAllTherapists,
  getAllClients,
  getAllPayments,
  getAllSessions,
  getReports,
  getSettings,
  updateSettings,
  updateTherapistCredentials,
  bulkUpdateTherapistCredentials,
  getDashboardStats,
  getTherapistEarnings,
  getAllTherapistsEarnings,
  updateTherapistStatus,
  updateTherapistSupervising,
  verifyTherapistCompliance,
  getTherapistActivity,
  getIncompleteTherapistProfiles,
  suspendUser,
  activateUser,
  bulkUserAction,
  getAdminActionLogs,
} = require('../controllers/adminController');
const {
  getPricingTiers,
  updatePricingTier,
  deletePricingTier,
  createPricingTier,
  getPaymentSplit,
  updatePaymentSplit,
  getRateCaps,
  updateRateCaps,
} = require('../controllers/pricingController');

// All admin routes require authentication and admin role
router.use(protect);
router.use(isAdmin);

// Dashboard stats
router.get('/stats', getDashboardStats);

// User management
router.get('/users', getAllUsers);
router.post('/users/:id/suspend', suspendUser);
router.post('/users/:id/activate', activateUser);
router.post('/users/bulk-action', bulkUserAction);

// Therapist management
router.get('/therapists', getAllTherapists);
router.put('/therapists/:id/credentials', updateTherapistCredentials);
router.put('/therapists/credentials/bulk', bulkUpdateTherapistCredentials);
router.get('/therapists/earnings', getAllTherapistsEarnings);
router.get('/therapists/:id/earnings', getTherapistEarnings);
router.put('/therapists/:id/status', updateTherapistStatus);
router.put('/therapists/:id/supervising', updateTherapistSupervising);
router.put('/therapists/:id/verify-compliance', verifyTherapistCompliance);
router.get('/therapists/:id/activity', getTherapistActivity);
router.get('/therapists/incomplete', getIncompleteTherapistProfiles);

// Client management
router.get('/clients', getAllClients);

// Payment management
router.get('/payments', getAllPayments);

// Session management
router.get('/sessions', getAllSessions);

// Reports/Analytics
router.get('/reports', getReports);

// Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// Pricing management
router.get('/pricing', getPricingTiers);
router.post('/pricing', createPricingTier);
router.put('/pricing/:tier', updatePricingTier);
router.delete('/pricing/:tier', deletePricingTier);

// Payment split configuration
router.get('/payment-split', getPaymentSplit);
router.put('/payment-split', updatePaymentSplit);

// Rate caps configuration
router.get('/rate-caps', getRateCaps);
router.put('/rate-caps', updateRateCaps);

// Admin action logs
router.get('/action-logs', getAdminActionLogs);

module.exports = router;

