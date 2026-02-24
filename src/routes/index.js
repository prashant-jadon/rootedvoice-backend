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
const evaluationRoutes = require('./evaluations');
const notificationRoutes = require('./notifications');

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
router.use('/evaluations', evaluationRoutes);
router.use('/notifications', notificationRoutes);

// Public routes
router.get('/public/platform-stats', getPlatformStats);

// Health check
router.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  const dbState = mongoose.connection.readyState;
  const dbStates = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

  const healthData = {
    success: dbState === 1,
    message: dbState === 1 ? 'API is running' : 'API is running but database is not connected',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + 's',
    database: dbStates[dbState] || 'unknown',
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
    },
  };

  res.status(dbState === 1 ? 200 : 503).json(healthData);
});

module.exports = router;

