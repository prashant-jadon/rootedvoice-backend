const { asyncHandler } = require('../middlewares/errorHandler');

// In-memory pricing storage (in production, use database)
// This will be replaced with database model later
let PRICING_TIERS = {
  rooted: {
    name: 'Rooted Tier',
    price: 229,
    duration: 45,
    billingCycle: 'monthly',
    sessionsPerMonth: 2,
    features: [
      '2 sessions per month (45 minutes each)',
      'Personalized treatment plan',
      'Progress updates every 8-10 weeks',
      'Caregiver tips',
      'HIPAA-compliant platform',
      'Email support'
    ]
  },
  flourish: {
    name: 'Flourish Tier',
    price: 439,
    duration: 45,
    billingCycle: 'monthly',
    sessionsPerMonth: 4,
    features: [
      '4 sessions per month (45 minutes each)',
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
    price: 749,
    duration: 45,
    billingCycle: 'monthly',
    sessionsPerMonth: 8,
    features: [
      '8 sessions per month (45 minutes each)',
      'Intensive therapy support',
      'Flexible scheduling',
      'Priority access to therapists',
      'Comprehensive progress tracking',
      'Monthly family coaching',
      'Direct messaging access'
    ]
  },
  'pay-as-you-go': {
    name: 'Pay-As-You-Go',
    price: 125,
    duration: 45,
    billingCycle: 'pay-as-you-go',
    sessionsPerMonth: 1,
    features: [
      '1 session (45 minutes)',
      'No subscription required',
      'Flexible scheduling',
      'Pay per session',
      'Perfect for occasional support',
      'HIPAA-compliant platform'
    ]
  },
  evaluation: {
    name: 'Evaluation',
    price: 260,
    duration: 75,
    billingCycle: 'one-time',
    sessionsPerMonth: 0,
    features: [
      '60-75 minute comprehensive evaluation',
      'Detailed assessment report',
      'Treatment recommendations',
      'No subscription required',
      'One-time payment'
    ]
  }
};

// Payment split configuration (platform fee %) - differentiated by credential type
// Therapist gets 55%, Rooted Voices (Platform) gets 45%
let PAYMENT_SPLIT = {
  SLP: {
    platformFeePercent: 45, // Rooted Voices gets 45%
    therapistFeePercent: 55, // Therapist gets 55%
  },
  SLPA: {
    platformFeePercent: 45, // Rooted Voices gets 45%
    therapistFeePercent: 55, // Therapist gets 55%
  },
};

// Rate caps configuration (hourly rate maximums)
let RATE_CAPS = {
  SLP: 75, // SLP (Full License) max hourly rate: $75
  SLPA: 55, // SLPA (Assistant) max hourly rate: $55
};

// Cancellation fees by credential type (flat rate when patient cancels)
let CANCELLATION_FEES = {
  SLPA: 15, // $15 flat rate for SLPA cancellations
  SLP: 20,  // $20 flat rate for SLP cancellations
};

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
  const { credentialType, platformFeePercent } = req.body;

  if (platformFeePercent < 0 || platformFeePercent > 100) {
    return res.status(400).json({
      success: false,
      message: 'Platform fee must be between 0 and 100',
    });
  }

  // If credentialType is specified, update that specific split
  if (credentialType && ['SLP', 'SLPA'].includes(credentialType)) {
    PAYMENT_SPLIT[credentialType] = {
      platformFeePercent,
      therapistFeePercent: 100 - platformFeePercent,
    };
  } else {
    // Update both if no credential type specified (backward compatibility)
    PAYMENT_SPLIT.SLP = {
      platformFeePercent,
      therapistFeePercent: 100 - platformFeePercent,
    };
    PAYMENT_SPLIT.SLPA = {
    platformFeePercent,
    therapistFeePercent: 100 - platformFeePercent,
  };
  }

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
      cancellationFees: CANCELLATION_FEES,
    },
  });
});

// @desc    Update rate caps configuration
// @route   PUT /api/admin/rate-caps
// @access  Private/Admin
const updateRateCaps = asyncHandler(async (req, res) => {
  const { SLP, SLPA, slpCancellationFee, slpaCancellationFee } = req.body;

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

  if (slpCancellationFee !== undefined) {
    if (slpCancellationFee < 0 || slpCancellationFee > 100) {
      return res.status(400).json({
        success: false,
        message: 'SLP cancellation fee must be between 0 and 100',
      });
    }
    CANCELLATION_FEES.SLP = slpCancellationFee;
  }

  if (slpaCancellationFee !== undefined) {
    if (slpaCancellationFee < 0 || slpaCancellationFee > 100) {
      return res.status(400).json({
        success: false,
        message: 'SLPA cancellation fee must be between 0 and 100',
      });
    }
    CANCELLATION_FEES.SLPA = slpaCancellationFee;
  }

  res.json({
    success: true,
    message: 'Rate caps updated successfully',
    data: {
      SLP: RATE_CAPS.SLP,
      SLPA: RATE_CAPS.SLPA,
      cancellationFees: CANCELLATION_FEES,
    },
  });
});

// Export pricing tiers for use in subscription controller
const getPricingTiersForSubscription = () => PRICING_TIERS;

// Export payment split for use in other controllers
// Returns split based on credential type, defaults to SLP if not specified
const getPaymentSplitForUse = (credentialType = 'SLP') => {
  return PAYMENT_SPLIT[credentialType] || PAYMENT_SPLIT.SLP;
};

// Export rate caps for use in other controllers
const getRateCapsForUse = () => RATE_CAPS;

// Export cancellation fee for use in other controllers
// Returns fee based on credential type
const getCancellationFee = (credentialType = 'SLPA') => {
  return CANCELLATION_FEES[credentialType] || CANCELLATION_FEES.SLPA;
};

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
  getCancellationFee,
};

