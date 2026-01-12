const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const therapistRoutes = require('./therapists');
const clientRoutes = require('./clients');
const sessionRoutes = require('./sessions');
const subscriptionRoutes = require('./subscriptions');
const adminRoutes = require('./admin');
const { getPlatformStats } = require('../controllers/publicController');
const stripeRoutes = require('./stripe');
const assignmentRoutes = require('./assignments');
const forumRoutes = require('./forum');
const messageRoutes = require('./messages');
const resourceRoutes = require('./resources');
const translationRoutes = require('./translation');
const calendarRoutes = require('./calendar');
const familyCoachingRoutes = require('./familyCoaching');
const pushRoutes = require('./push');

// Mount routes
router.use('/auth', authRoutes);
router.use('/therapists', therapistRoutes);
router.use('/clients', clientRoutes);
router.use('/sessions', sessionRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/admin', adminRoutes);
router.use('/stripe', stripeRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/forum', forumRoutes);
router.use('/messages', messageRoutes);
router.use('/resources', resourceRoutes);
router.use('/translation', translationRoutes);
router.use('/calendar', calendarRoutes);
router.use('/family-coaching', familyCoachingRoutes);
router.use('/push', pushRoutes);

// Public routes
router.get('/public/platform-stats', getPlatformStats);

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;

