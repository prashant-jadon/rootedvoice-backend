const { asyncHandler } = require('../middlewares/errorHandler');

// In-memory pricing storage (in production, use database)
// This will be replaced with database model later
let PRICING_TIERS = {
  rooted: {
    name: 'Rooted Tier',
    price: 50,
    duration: 30,
    billingCycle: 'every-4-weeks',
    sessionsPerMonth: 4,
    features: [
      '2-4 sessions per month',
      'Personalized treatment plan',
      'Progress updates every 8-10 weeks',
      'Caregiver tips',
      'HIPAA-compliant platform',
      'Email support'
    ]
  },
  flourish: {
    name: 'Flourish Tier',
    price: 85,
    duration: 60,
    billingCycle: 'every-4-weeks',
    sessionsPerMonth: 4,
    features: [
      'Weekly or bi-weekly sessions',
      'Advanced treatment strategies',
      'Detailed monthly progress reports',
      'Monthly family coaching',
      'Priority scheduling',
      'Provider collaboration',
      'Direct messaging'
    ],
    popular: true
  },
  bloom: {
    name: 'Bloom Tier',
    price: 90,
    duration: 60,
    billingCycle: 'pay-as-you-go',
    sessionsPerMonth: 3,
    features: [
      '2-3 sessions monthly',
      'Flexible scheduling',
      'Focus on skill maintenance',
      'No long-term commitment',
      'Month-to-month flexibility'
    ]
  }
};

// Payment split configuration (platform fee %)
let PAYMENT_SPLIT = {
  platformFeePercent: 20, // Platform gets 20%
  therapistFeePercent: 80, // Therapist gets 80%
};

// Rate caps configuration (hourly rate maximums)
let RATE_CAPS = {
  SLP: 75, // SLP (Full License) max hourly rate: $75
  SLPA: 55, // SLPA (Assistant) max hourly rate: $55
};

// SLPA cancellation fee (flat rate when patient cancels)
let SLPA_CANCELLATION_FEE = 15; // $15 flat rate for SLPA cancellations

// @desc    Get all pricing tiers
// @route   GET /api/admin/pricing
// @access  Private/Admin
const getPricingTiers = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: PRICING_TIERS,
  });
});

// @desc    Update pricing tier
// @route   PUT /api/admin/pricing/:tier
// @access  Private/Admin
const updatePricingTier = asyncHandler(async (req, res) => {
  const { tier } = req.params;
  const updates = req.body;

  if (!PRICING_TIERS[tier]) {
    return res.status(404).json({
      success: false,
      message: 'Pricing tier not found',
    });
  }

  PRICING_TIERS[tier] = {
    ...PRICING_TIERS[tier],
    ...updates,
  };

  res.json({
    success: true,
    message: 'Pricing tier updated successfully',
    data: PRICING_TIERS[tier],
  });
});

// @desc    Delete pricing tier
// @route   DELETE /api/admin/pricing/:tier
// @access  Private/Admin
const deletePricingTier = asyncHandler(async (req, res) => {
  const { tier } = req.params;

  if (!PRICING_TIERS[tier]) {
    return res.status(404).json({
      success: false,
      message: 'Pricing tier not found',
    });
  }

  delete PRICING_TIERS[tier];

  res.json({
    success: true,
    message: 'Pricing tier deleted successfully',
  });
});

// @desc    Create new pricing tier
// @route   POST /api/admin/pricing
// @access  Private/Admin
const createPricingTier = asyncHandler(async (req, res) => {
  const { tier, name, price, duration, billingCycle, sessionsPerMonth, features } = req.body;

  if (!tier || !name || !price) {
    return res.status(400).json({
      success: false,
      message: 'Tier key, name, and price are required',
    });
  }

  if (PRICING_TIERS[tier]) {
    return res.status(400).json({
      success: false,
      message: 'Pricing tier already exists',
    });
  }

  PRICING_TIERS[tier] = {
    name,
    price,
    duration: duration || 60,
    billingCycle: billingCycle || 'monthly',
    sessionsPerMonth: sessionsPerMonth || 0,
    features: features || [],
  };

  res.status(201).json({
    success: true,
    message: 'Pricing tier created successfully',
    data: PRICING_TIERS[tier],
  });
});

// @desc    Get payment split configuration
// @route   GET /api/admin/payment-split
// @access  Private/Admin
const getPaymentSplit = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: PAYMENT_SPLIT,
  });
});

// @desc    Update payment split configuration
// @route   PUT /api/admin/payment-split
// @access  Private/Admin
const updatePaymentSplit = asyncHandler(async (req, res) => {
  const { platformFeePercent } = req.body;

  if (platformFeePercent < 0 || platformFeePercent > 100) {
    return res.status(400).json({
      success: false,
      message: 'Platform fee must be between 0 and 100',
    });
  }

  PAYMENT_SPLIT = {
    platformFeePercent,
    therapistFeePercent: 100 - platformFeePercent,
  };

  res.json({
    success: true,
    message: 'Payment split updated successfully',
    data: PAYMENT_SPLIT,
  });
});

// @desc    Get rate caps configuration
// @route   GET /api/admin/rate-caps
// @access  Private/Admin
const getRateCaps = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      SLP: RATE_CAPS.SLP,
      SLPA: RATE_CAPS.SLPA,
      slpaCancellationFee: SLPA_CANCELLATION_FEE,
    },
  });
});

// @desc    Update rate caps configuration
// @route   PUT /api/admin/rate-caps
// @access  Private/Admin
const updateRateCaps = asyncHandler(async (req, res) => {
  const { SLP, SLPA, slpaCancellationFee } = req.body;

  if (SLP !== undefined) {
    if (SLP < 0 || SLP > 200) {
      return res.status(400).json({
        success: false,
        message: 'SLP rate cap must be between 0 and 200',
      });
    }
    RATE_CAPS.SLP = SLP;
  }

  if (SLPA !== undefined) {
    if (SLPA < 0 || SLPA > 200) {
      return res.status(400).json({
        success: false,
        message: 'SLPA rate cap must be between 0 and 200',
      });
    }
    RATE_CAPS.SLPA = SLPA;
  }

  if (slpaCancellationFee !== undefined) {
    if (slpaCancellationFee < 0 || slpaCancellationFee > 100) {
      return res.status(400).json({
        success: false,
        message: 'SLPA cancellation fee must be between 0 and 100',
      });
    }
    SLPA_CANCELLATION_FEE = slpaCancellationFee;
  }

  res.json({
    success: true,
    message: 'Rate caps updated successfully',
    data: {
      SLP: RATE_CAPS.SLP,
      SLPA: RATE_CAPS.SLPA,
      slpaCancellationFee: SLPA_CANCELLATION_FEE,
    },
  });
});

// Export pricing tiers for use in subscription controller
const getPricingTiersForSubscription = () => PRICING_TIERS;

// Export payment split for use in other controllers
const getPaymentSplitForUse = () => PAYMENT_SPLIT;

// Export rate caps for use in other controllers
const getRateCapsForUse = () => RATE_CAPS;

// Export SLPA cancellation fee for use in other controllers
const getSLPACancellationFee = () => SLPA_CANCELLATION_FEE;

module.exports = {
  getPricingTiers,
  updatePricingTier,
  deletePricingTier,
  createPricingTier,
  getPaymentSplit,
  updatePaymentSplit,
  getRateCaps,
  updateRateCaps,
  getPricingTiersForSubscription,
  getPaymentSplitForUse,
  getRateCapsForUse,
  getSLPACancellationFee,
};

