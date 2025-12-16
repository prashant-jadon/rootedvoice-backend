const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const User = require('../models/User');

// Get VAPID public key
router.get('/vapid-public-key', (req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(500).json({
      success: false,
      message: 'VAPID public key not configured',
    });
  }
  res.json({
    success: true,
    publicKey,
  });
});

// Subscribe to push notifications
router.post('/subscribe', protect, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys) {
      return res.status(400).json({
        success: false,
        message: 'Subscription data is required',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.pushSubscription = {
      endpoint,
      keys: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    };

    await user.save();

    res.json({
      success: true,
      message: 'Push subscription saved',
    });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save push subscription',
    });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.pushSubscription = null;
    await user.save();

    res.json({
      success: true,
      message: 'Push subscription removed',
    });
  } catch (error) {
    console.error('Error removing push subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove push subscription',
    });
  }
});

module.exports = router;

