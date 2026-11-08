const { asyncHandler } = require('../middlewares/errorHandler');
const PricingTier = require('../models/PricingTier');
const PlatformConfig = require('../models/PlatformConfig');

// Initial seed data (fallback/default)
const DEFAULT_PRICING_TIERS = {
  rooted: {
    name: 'Rooted Tier',
    price: 229,
    duration: 45,
    billingCycle: 'monthly',
    sessionsPerMonth: 2,
    includesEvaluation: true,
    features: [
      '2 sessions per month (45 minutes each)',
      'Personalized treatment plan',
      'Progress updates every 8-10 weeks',
      'Caregiver tips',
      'HIPAA-compliant platform',
      'Email support',
      'Initial Evaluation Included'
    ]
  },
  flourish: {
    name: 'Flourish Tier',
    price: 439,
    duration: 45,
    billingCycle: 'monthly',
    sessionsPerMonth: 4,
    includesEvaluation: true,
    features: [
      '4 sessions per month (45 minutes each)',
      'Advanced treatment strategies',
      'Detailed monthly progress reports',
      'Monthly family coaching',
      'Priority scheduling',
      'Provider collaboration',
      'Direct messaging',
      'Initial Evaluation Included'
    ],
    popular: true
  },
  bloom: {
    name: 'Bloom (Pay-As-You-Go)',
    price: 125,
    duration: 45,
    billingCycle: 'pay-as-you-go',
    sessionsPerMonth: 0,
    includesEvaluation: false,
    evaluationPrice: 195,
    features: [
      'Pay-as-you-go sessions ($125/session)',
      'Initial Evaluation Required ($195)',
      'Flexible scheduling',
      'Priority access to therapists',
      'Comprehensive progress tracking',
      'Monthly family coaching',
      'Direct messaging access'
    ]
  },
  'pay-as-you-go': {
    name: 'Pay-As-You-Go (Legacy)',
    price: 125,
    duration: 45,
    billingCycle: 'pay-as-you-go',
    sessionsPerMonth: 1,
    includesEvaluation: false,
    features: [
      '1 session (45 minutes)',
      'No subscription required',
      'Flexible scheduling',
      'Pay per session',
      'HIPAA-compliant platform'
    ]
  },
  evaluation: {
    name: 'Initial Evaluation',
    price: 195,
    duration: 60,
    billingCycle: 'one-time',
    sessionsPerMonth: 0,
    includesEvaluation: false,
    features: [
      '60-75 minute comprehensive evaluation',
      'Detailed assessment report',
      'Treatment recommendations',
      'Required before bookings',
      'Included in Subscription Plans'
    ]
  }
};

// Seeding function (called when module loads, purely side-effect safe)
const seedPricingTiers = async () => {
  try {
    const count = await PricingTier.countDocuments();
    if (count === 0) {
      console.log('Seeding pricing tiers...');
      const operations = Object.entries(DEFAULT_PRICING_TIERS).map(([id, data]) => {
        return PricingTier.create({ id, ...data });
      });
      await Promise.all(operations);
      console.log('Pricing tiers seeded successfully');
    }
  } catch (error) {
    console.error('Error seeding pricing tiers:', error);
  }
};

// Seed on startup (non-blocking)
seedPricingTiers();

// NOTE: Payment split configuration is DEPRECATED
// Therapists are now paid a fixed hourly rate based on their tier
// Platform revenue is handled separately and not shown as a "split" to clinicians
// This configuration is kept for backward compatibility with payment processing only
// DO NOT use this for calculating or displaying therapist earnings
let PAYMENT_SPLIT = {
  SLP: {
    platformFeePercent: 45, // Internal use only - not displayed to therapists
    therapistFeePercent: 55, // Internal use only - not displayed to therapists
  },
  SLPA: {
    platformFeePercent: 60, // Internal use only - not displayed to therapists
    therapistFeePercent: 40, // Internal use only - not displayed to therapists
  },
};

// In-memory cache of the admin-editable platform rate configuration.
// Hydrated from the PlatformConfig singleton in MongoDB on module load
// and refreshed after every write — so synchronous helpers like
// getRateCapsForUse() stay sync, but edits persist across restarts
// (including Vercel serverless cold starts).
let RATE_CAPS = { SLP: 75, SLPA: 55 };
let CANCELLATION_FEES = { SLP: 20, SLPA: 15 };
// Flat-rate therapist compensation for a completed diagnostic evaluation.
// Paid per completed eval (intake review + up to 60-min assessment +
// report finalization) and SEPARATE from the hourly treatment progression
// — treatment pay tiers do NOT include evaluation hours.
let EVALUATION_COMPENSATION = { SLP: 85, SLPA: 0 };

const applyPlatformConfigToCache = (cfg) => {
  if (!cfg) return;
  if (cfg.rateCaps) {
    RATE_CAPS = { SLP: cfg.rateCaps.SLP ?? 75, SLPA: cfg.rateCaps.SLPA ?? 55 };
  }
  if (cfg.cancellationFees) {
    CANCELLATION_FEES = {
      SLP: cfg.cancellationFees.SLP ?? 20,
      SLPA: cfg.cancellationFees.SLPA ?? 15,
    };
  }
  if (cfg.evaluationCompensation) {
    EVALUATION_COMPENSATION = {
      SLP: cfg.evaluationCompensation.SLP ?? 85,
      SLPA: cfg.evaluationCompensation.SLPA ?? 0,
    };
  }
};

// Hydrate on module load (fire-and-forget). If the DB is unreachable at
// boot, the cache stays at its defaults and the first write will persist
// them. A failed refresh never crashes the server.
const hydratePlatformConfigFromDb = async () => {
  try {
    const cfg = await PlatformConfig.getConfig();
    applyPlatformConfigToCache(cfg);
  } catch (err) {
    console.error('PlatformConfig hydrate failed:', err.message);
  }
};
hydratePlatformConfigFromDb();

// Write current cache snapshot to the DB singleton. Called after every
// successful admin update so the next cold start sees the new values.
const persistPlatformConfig = async () => {
  await PlatformConfig.findOneAndUpdate(
    { singletonKey: 'platform' },
    {
      $set: {
        rateCaps: { ...RATE_CAPS },
        cancellationFees: { ...CANCELLATION_FEES },
        evaluationCompensation: { ...EVALUATION_COMPENSATION },
      },
      $setOnInsert: { singletonKey: 'platform' },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

// Helper: Convert DB array to Object format for backward compatibility
const formatTiersToObject = (tiersArray) => {
  return tiersArray.reduce((acc, tier) => {
    acc[tier.id] = tier.toObject();
    return acc;
  }, {});
};

// @desc    Get all pricing tiers
// @route   GET /api/admin/pricing
// @access  Private/Admin
const getPricingTiers = asyncHandler(async (req, res) => {
  const tiers = await PricingTier.find({});
  // Convert to object format to match expected frontend structure
  const formattedTiers = formatTiersToObject(tiers);

  res.json({
    success: true,
    data: formattedTiers,
  });
});

// @desc    Update pricing tier
// @route   PUT /api/admin/pricing/:tier
// @access  Private/Admin
const updatePricingTier = asyncHandler(async (req, res) => {
  const { tier: tierId } = req.params;
  const updates = req.body;

  let pricingTier = await PricingTier.findOne({ id: tierId });

  if (!pricingTier) {
    // If not found in DB, try to see if it's in default and creates it (lazy migration)
    if (DEFAULT_PRICING_TIERS[tierId]) {
      pricingTier = await PricingTier.create({ id: tierId, ...DEFAULT_PRICING_TIERS[tierId] });
    } else {
      return res.status(404).json({
        success: false,
        message: 'Pricing tier not found',
      });
    }
  }

  // Update fields
  Object.keys(updates).forEach(key => {
    if (key !== 'id' && key !== '_id') {
      pricingTier[key] = updates[key];
    }
  });

  await pricingTier.save();

  res.json({
    success: true,
    message: 'Pricing tier updated successfully',
    data: pricingTier,
  });
});

// @desc    Delete pricing tier
// @route   DELETE /api/admin/pricing/:tier
// @access  Private/Admin
const deletePricingTier = asyncHandler(async (req, res) => {
  const { tier: tierId } = req.params;

  const result = await PricingTier.findOneAndDelete({ id: tierId });

  if (!result) {
    return res.status(404).json({
      success: false,
      message: 'Pricing tier not found',
    });
  }

  res.json({
    success: true,
    message: 'Pricing tier deleted successfully',
  });
});

// @desc    Create new pricing tier
// @route   POST /api/admin/pricing
// @access  Private/Admin
const createPricingTier = asyncHandler(async (req, res) => {
  const { tier, name, price, duration, billingCycle, sessionsPerMonth, features, description, icon, popular, monthlyPrice, perSessionPrice, durationRange, includesEvaluation, evaluationPrice } = req.body;

  if (!tier || !name || !price) {
    return res.status(400).json({
      success: false,
      message: 'Tier key, name, and price are required',
    });
  }

  const existingTier = await PricingTier.findOne({ id: tier });

  if (existingTier) {
    return res.status(400).json({
      success: false,
      message: 'Pricing tier already exists',
    });
  }

  const newTier = await PricingTier.create({
    id: tier,
    name,
    price,
    duration: duration || 60,
    billingCycle: billingCycle || 'monthly',
    sessionsPerMonth: sessionsPerMonth || 0,
    includesEvaluation: includesEvaluation !== undefined ? includesEvaluation : false,
    evaluationPrice: evaluationPrice || undefined,
    features: features || [],
    description: description || '',
    icon: icon || '',
    popular: popular || false,
    monthlyPrice: monthlyPrice || price,
    perSessionPrice: perSessionPrice || (sessionsPerMonth > 0 ? price / sessionsPerMonth : price),
    durationRange: durationRange || '',
  });

  res.status(201).json({
    success: true,
    message: 'Pricing tier created successfully',
    data: newTier,
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
  // Refresh the cache from the DB singleton on every admin read, so the
  // admin panel always shows the authoritative values even if a cold
  // start fired this request before the module-load hydrate completed.
  try {
    const cfg = await PlatformConfig.getConfig();
    applyPlatformConfigToCache(cfg);
  } catch (err) {
    console.error('PlatformConfig read failed, serving cached values:', err.message);
  }

  res.json({
    success: true,
    data: {
      SLP: RATE_CAPS.SLP,
      SLPA: RATE_CAPS.SLPA,
      cancellationFees: CANCELLATION_FEES,
      evaluationCompensation: EVALUATION_COMPENSATION,
    },
  });
});

// @desc    Update rate caps configuration
// @route   PUT /api/admin/rate-caps
// @access  Private/Admin
const updateRateCaps = asyncHandler(async (req, res) => {
  const {
    SLP,
    SLPA,
    slpCancellationFee,
    slpaCancellationFee,
    slpEvaluationCompensation,
    slpaEvaluationCompensation,
  } = req.body;

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

  if (slpEvaluationCompensation !== undefined) {
    if (slpEvaluationCompensation < 0 || slpEvaluationCompensation > 500) {
      return res.status(400).json({
        success: false,
        message: 'SLP evaluation compensation must be between 0 and 500',
      });
    }
    EVALUATION_COMPENSATION.SLP = slpEvaluationCompensation;
  }

  if (slpaEvaluationCompensation !== undefined) {
    if (slpaEvaluationCompensation < 0 || slpaEvaluationCompensation > 500) {
      return res.status(400).json({
        success: false,
        message: 'SLPA evaluation compensation must be between 0 and 500',
      });
    }
    EVALUATION_COMPENSATION.SLPA = slpaEvaluationCompensation;
  }

  // Persist to MongoDB so the new values survive restarts / cold starts.
  // On DB failure we keep the in-memory change but surface the error so
  // the admin knows the edit won't outlive this process.
  try {
    await persistPlatformConfig();
  } catch (err) {
    console.error('PlatformConfig persist failed:', err.message);
    return res.status(500).json({
      success: false,
      message:
        'Rates updated in memory but failed to save to the database — they will reset on next server restart. Please retry.',
      data: {
        SLP: RATE_CAPS.SLP,
        SLPA: RATE_CAPS.SLPA,
        cancellationFees: CANCELLATION_FEES,
        evaluationCompensation: EVALUATION_COMPENSATION,
      },
    });
  }

  res.json({
    success: true,
    message: 'Rate caps updated successfully',
    data: {
      SLP: RATE_CAPS.SLP,
      SLPA: RATE_CAPS.SLPA,
      cancellationFees: CANCELLATION_FEES,
      evaluationCompensation: EVALUATION_COMPENSATION,
    },
  });
});

// Export pricing tiers for use in subscription controller
// NOTE: This now returns a Promise because it fetches from DB
const getPricingTiersForSubscription = async () => {
  const tiers = await PricingTier.find({});
  // If DB is empty, return defaults (fallback)
  if (tiers.length === 0) {
    return DEFAULT_PRICING_TIERS;
  }
  return formatTiersToObject(tiers);
};

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

// Export evaluation compensation for use in other controllers.
// Returns the flat-rate dollar amount paid to a therapist of this credential
// for a completed diagnostic evaluation (0 if the credential doesn't perform
// evaluations, e.g. SLPA).
const getEvaluationCompensationForUse = (credentialType = 'SLP') => {
  const value = EVALUATION_COMPENSATION[credentialType];
  return typeof value === 'number' ? value : 0;
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
  getEvaluationCompensationForUse,
};

