const Subscription = require('../models/Subscription');
const User = require('../models/User');
const { asyncHandler } = require('../middlewares/errorHandler');
const { getPricingTiersForSubscription } = require('./pricingController');

// Get pricing tiers from pricing controller
const getPRICING_TIERS = () => getPricingTiersForSubscription();

// @desc    Get all pricing tiers
// @route   GET /api/subscriptions/pricing
// @access  Public
const getPricingTiers = asyncHandler(async (req, res) => {
  const PRICING_TIERS = getPRICING_TIERS();
  res.json({
    success: true,
    data: PRICING_TIERS,
  });
});

// @desc    Subscribe to a tier
// @route   POST /api/subscriptions/subscribe
// @access  Private
const subscribeToPlan = asyncHandler(async (req, res) => {
  const { tier } = req.body;
  const userId = req.user._id;
  const PRICING_TIERS = getPRICING_TIERS();

  // Validate tier
  if (!PRICING_TIERS[tier]) {
    return res.status(400).json({
      success: false,
      message: 'Invalid pricing tier',
    });
  }

  const tierInfo = PRICING_TIERS[tier];

  // Check if user already has an active subscription
  const existingSubscription = await Subscription.findOne({
    userId,
    status: 'active',
  });

  if (existingSubscription) {
    // Cancel existing subscription
    existingSubscription.status = 'cancelled';
    existingSubscription.cancelledAt = new Date();
    existingSubscription.cancellationReason = 'Switched to different plan';
    await existingSubscription.save();
  }

  // Calculate billing dates
  const startDate = new Date();
  let nextBillingDate = new Date();
  
  if (tierInfo.billingCycle === 'every-4-weeks') {
    nextBillingDate.setDate(nextBillingDate.getDate() + 28); // 4 weeks
  } else if (tierInfo.billingCycle === 'monthly') {
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
  } else if (tierInfo.billingCycle === 'one-time') {
    // Evaluation - no recurring billing
    nextBillingDate = null;
  } else {
    // pay-as-you-go
    nextBillingDate = null;
  }

  // Create new subscription
  const subscription = await Subscription.create({
    userId,
    tier,
    tierName: tierInfo.name,
    price: tierInfo.price,
    billingCycle: tierInfo.billingCycle,
    sessionsPerMonth: tierInfo.sessionsPerMonth,
    status: 'active',
    startDate,
    nextBillingDate,
    features: tierInfo.features,
    autoRenew: true,
  });

  res.status(201).json({
    success: true,
    message: `Successfully subscribed to ${tierInfo.name}!`,
    data: subscription,
  });
});

// @desc    Get user's current subscription
// @route   GET /api/subscriptions/current
// @access  Private
const getCurrentSubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findOne({
    userId: req.user._id,
    status: 'active',
  }).sort({ createdAt: -1 });

  if (!subscription) {
    return res.json({
      success: true,
      data: null,
      message: 'No active subscription',
    });
  }

  res.json({
    success: true,
    data: subscription,
  });
});

// @desc    Cancel subscription
// @route   DELETE /api/subscriptions/cancel
// @access  Private
const cancelSubscription = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const subscription = await Subscription.findOne({
    userId: req.user._id,
    status: 'active',
  });

  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'No active subscription found',
    });
  }

  subscription.status = 'cancelled';
  subscription.cancelledAt = new Date();
  subscription.cancellationReason = reason || 'User requested cancellation';
  subscription.autoRenew = false;

  await subscription.save();

  res.json({
    success: true,
    message: 'Subscription cancelled successfully',
    data: subscription,
  });
});

// @desc    Get subscription history
// @route   GET /api/subscriptions/history
// @access  Private
const getSubscriptionHistory = asyncHandler(async (req, res) => {
  const subscriptions = await Subscription.find({
    userId: req.user._id,
  }).sort({ createdAt: -1 });

  res.json({
    success: true,
    data: subscriptions,
  });
});

// @desc    Get remaining sessions for current user
// @route   GET /api/subscriptions/remaining-sessions
// @access  Private
const getRemainingSessions = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const Session = require('../models/Session');
  const Client = require('../models/Client');

  // Get active subscription
  const subscription = await Subscription.findOne({
    userId,
    status: 'active',
  }).sort({ createdAt: -1 });

  if (!subscription) {
    return res.json({
      success: true,
      data: {
        totalSessions: 0,
        usedSessions: 0,
        remainingSessions: 0,
        hasUnlimited: false,
        subscription: null,
      },
    });
  }

  // Get client profile
  const client = await Client.findOne({ userId });
  if (!client) {
    return res.json({
      success: true,
      data: {
        totalSessions: subscription.sessionsPerMonth || 0,
        usedSessions: 0,
        remainingSessions: subscription.sessionsPerMonth || 0,
        hasUnlimited: subscription.sessionsPerMonth === 0 || subscription.sessionsPerMonth === -1,
        subscription: {
          tier: subscription.tier,
          tierName: subscription.tierName,
          sessionsPerMonth: subscription.sessionsPerMonth,
        },
      },
    });
  }

  // Calculate billing period (from subscription start date or current month)
  const now = new Date();
  let periodStart, periodEnd;
  
  if (subscription.startDate) {
    // Calculate based on billing cycle
    if (subscription.billingCycle === 'every-4-weeks') {
      // Find which 4-week period we're in
      const weeksSinceStart = Math.floor((now - subscription.startDate) / (7 * 24 * 60 * 60 * 1000));
      const periodNumber = Math.floor(weeksSinceStart / 4);
      periodStart = new Date(subscription.startDate);
      periodStart.setDate(periodStart.getDate() + (periodNumber * 28));
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 28);
    } else if (subscription.billingCycle === 'monthly') {
      // Monthly billing - use calendar month
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else {
      // Pay-as-you-go or other - use subscription start date
      periodStart = subscription.startDate;
      periodEnd = subscription.nextBillingDate || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }
  } else {
    // Fallback to current month
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  // Count sessions used in current billing period
  // Count scheduled, confirmed, in-progress, and completed sessions
  const usedSessions = await Session.countDocuments({
    clientId: client._id,
    scheduledDate: {
      $gte: periodStart,
      $lte: periodEnd,
    },
    status: {
      $in: ['scheduled', 'confirmed', 'in-progress', 'completed'],
    },
  });

  const totalSessions = subscription.sessionsPerMonth || 0;
  const hasUnlimited = totalSessions === 0 || totalSessions === -1;
  const remainingSessions = hasUnlimited ? -1 : Math.max(0, totalSessions - usedSessions);

  res.json({
    success: true,
    data: {
      totalSessions,
      usedSessions,
      remainingSessions,
      hasUnlimited,
      periodStart,
      periodEnd,
      subscription: {
        tier: subscription.tier,
        tierName: subscription.tierName,
        sessionsPerMonth: subscription.sessionsPerMonth,
        billingCycle: subscription.billingCycle,
        nextBillingDate: subscription.nextBillingDate,
      },
    },
  });
});

module.exports = {
  getPricingTiers,
  subscribeToPlan,
  getCurrentSubscription,
  cancelSubscription,
  getSubscriptionHistory,
  getRemainingSessions,
};

