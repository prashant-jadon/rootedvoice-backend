const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const Session = require('../models/Session');
const Client = require('../models/Client');
const Therapist = require('../models/Therapist');
const Evaluation = require('../models/Evaluation');
const { asyncHandler } = require('../middlewares/errorHandler');
const { getPricingTiersForSubscription, getPaymentSplitForUse, getCancellationFee } = require('./pricingController');

// @desc    Create Stripe checkout session
// @route   POST /api/stripe/create-checkout-session
// @access  Private
const createCheckoutSession = asyncHandler(async (req, res) => {
  const { tier } = req.body;
  const userId = req.user._id;

  const PRICING_TIERS = await getPricingTiersForSubscription();
  const tierInfo = PRICING_TIERS[tier];

  if (!tierInfo) {
    return res.status(400).json({
      success: false,
      message: 'Invalid pricing tier',
    });
  }

  // Check for existing active subscription
  const existingSubscription = await Subscription.findOne({
    userId,
    status: 'active',
  });

  if (existingSubscription) {
    return res.status(400).json({
      success: false,
      message: 'You already have an active subscription',
    });
  }

  // Check if client has already paid evaluation fee
  const client = await Client.findOne({ userId });
  const hasPaidEvaluation = client?.hasPaidEvaluationFee || false;

  // Create Stripe checkout session
  const isPayAsYouGo = tierInfo.billingCycle === 'pay-as-you-go';

  // Build price_data object conditionally
  let unitAmount = tierInfo.price * 100; // Default price
  let description = `${tierInfo.sessionsPerMonth} sessions per month`;

  // BLOOM LOGIC: If Bloom tier AND hasn't paid eval fee, charge the Evaluation Price ($195)
  // The monthly/session price ($125) will be charged when they book later
  // This initial payment sets them up as a "Bloom" client with eval paid
  if (tier === 'bloom' && !hasPaidEvaluation) {
    unitAmount = (tierInfo.evaluationPrice || 195) * 100;
    description = 'Initial Evaluation Fee + Bloom Access';
  }

  const priceData = {
    currency: 'usd',
    product_data: {
      name: tierInfo.name,
      description: description,
    },
    unit_amount: unitAmount,
  };

  // Only add recurring for subscription mode (not pay-as-you-go or one-time)
  // Bloom is "pay-as-you-go" so it will be ONE-TIME payment here for the Eval Fee
  const isBloomInitial = tier === 'bloom' && !hasPaidEvaluation;

  const isOneTime = tierInfo.billingCycle === 'one-time' ||
    isBloomInitial ||
    tierInfo.billingCycle === 'pay-as-you-go';

  if (!isOneTime) {
    priceData.recurring = {
      interval: tierInfo.billingCycle === 'every-4-weeks' ? 'month' : 'month',
      interval_count: tierInfo.billingCycle === 'every-4-weeks' ? 1 : 1,
    };
  }

  const sessionMode = (isPayAsYouGo || isBloomInitial) ? 'payment' : 'subscription';

  console.log('Creating Stripe Session:', {
    tier,
    isPayAsYouGo,
    isBloomInitial,
    isOneTime,
    mode: sessionMode,
    unitAmount
  });

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: priceData,
        quantity: 1,
      },
    ],
    mode: sessionMode,
    success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing?success=true`,
    cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing?canceled=true`,
    client_reference_id: userId.toString(),
    metadata: {
      tier,
      userId: userId.toString(),
    },
  });

  res.json({
    success: true,
    data: {
      sessionId: session.id,
      url: session.url,
    },
  });
});

// @desc    Create payment intent for session
// @route   POST /api/stripe/create-payment-intent
// @access  Private
const createPaymentIntent = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  const userId = req.user._id;

  // Get session details
  const session = await Session.findById(sessionId)
    .populate('clientId', 'userId')
    .populate('therapistId', 'userId hourlyRate credentials');

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }

  // Check if payment already exists
  const existingPayment = await Payment.findOne({
    sessionId: session._id,
    status: { $in: ['completed', 'processing'] },
  });

  if (existingPayment) {
    return res.status(400).json({
      success: false,
      message: 'Payment already exists for this session',
    });
  }

  // Calculate amount (use session price or therapist's hourly rate)
  const amount = session.price || session.therapistId.hourlyRate || 100;
  const amountInCents = Math.round(amount * 100);

  // Get payment split based on therapist credentials
  const credentialType = session.therapistId.credentials || 'SLP';
  const splitConfig = getPaymentSplitForUse(credentialType);
  const platformFee = Math.round(amountInCents * (splitConfig.platformFeePercent / 100));
  const therapistFee = amountInCents - platformFee;

  // Get or create Stripe customer for client
  let customerId = null;
  try {
    const client = await Client.findById(session.clientId._id).populate('userId');
    // In production, store stripeCustomerId in User or Client model
    // For now, create customer on-the-fly
    const customer = await stripe.customers.create({
      email: client.userId.email,
      name: `${client.userId.firstName} ${client.userId.lastName}`,
      metadata: {
        userId: client.userId._id.toString(),
        clientId: client._id.toString(),
      },
    });
    customerId = customer.id;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
  }

  // Create payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: 'usd',
    customer: customerId,
    payment_method_types: ['card'],
    metadata: {
      sessionId: sessionId.toString(),
      clientId: session.clientId._id.toString(),
      therapistId: session.therapistId._id.toString(),
      platformFee: platformFee.toString(),
      therapistFee: therapistFee.toString(),
      type: 'session_payment',
    },
  });

  // Create pending payment record
  await Payment.create({
    sessionId: session._id,
    clientId: session.clientId._id,
    therapistId: session.therapistId._id,
    amount: amountInCents,
    currency: 'USD',
    status: 'processing',
    paymentMethod: 'card',
    stripePaymentIntentId: paymentIntent.id,
    metadata: {
      platformFee,
      therapistFee,
      type: 'session_payment',
    },
  });

  res.json({
    success: true,
    data: {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amountInCents,
      platformFee,
      therapistFee,
    },
  });
});

// @desc    Create payment intent for SLPA cancellation fee
// @route   POST /api/stripe/create-cancellation-payment
// @access  Private
const createCancellationPayment = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  const userId = req.user._id;

  // Get session details
  const session = await Session.findById(sessionId)
    .populate('clientId', 'userId')
    .populate('therapistId', 'userId credentials');

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }

  // Verify therapist has valid credentials for cancellation fee
  const credentialType = session.therapistId.credentials;
  if (!credentialType || !['SLP', 'SLPA'].includes(credentialType)) {
    return res.status(400).json({
      success: false,
      message: 'Therapist must have valid credentials (SLP or SLPA) for cancellation fee',
    });
  }

  if (session.status !== 'cancelled') {
    return res.status(400).json({
      success: false,
      message: 'Session must be cancelled first',
    });
  }

  // Check if payment already exists
  const existingPayment = await Payment.findOne({
    sessionId: session._id,
    'metadata.type': 'cancellation_fee',
    status: { $in: ['completed', 'processing'] },
  });

  if (existingPayment) {
    return res.status(400).json({
      success: false,
      message: 'Cancellation fee payment already exists',
    });
  }

  // Get cancellation fee based on therapist credentials
  const cancellationFee = getCancellationFee(credentialType);
  const amountInCents = Math.round(cancellationFee * 100);

  // Get payment split based on therapist credentials
  const splitConfig = getPaymentSplitForUse(credentialType);
  const platformFee = Math.round(amountInCents * (splitConfig.platformFeePercent / 100));
  const therapistFee = amountInCents - platformFee;

  // Get or create Stripe customer
  let customerId = null;
  try {
    const client = await Client.findById(session.clientId._id).populate('userId');
    const customer = await stripe.customers.create({
      email: client.userId.email,
      name: `${client.userId.firstName} ${client.userId.lastName}`,
      metadata: {
        userId: client.userId._id.toString(),
        clientId: client._id.toString(),
      },
    });
    customerId = customer.id;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
  }

  // Create payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: 'usd',
    customer: customerId,
    payment_method_types: ['card'],
    metadata: {
      sessionId: sessionId.toString(),
      clientId: session.clientId._id.toString(),
      therapistId: session.therapistId._id.toString(),
      platformFee: platformFee.toString(),
      therapistFee: therapistFee.toString(),
      type: 'cancellation_fee',
    },
  });

  // Create pending payment record
  await Payment.create({
    sessionId: session._id,
    clientId: session.clientId._id,
    therapistId: session.therapistId._id,
    amount: amountInCents,
    currency: 'USD',
    status: 'processing',
    paymentMethod: 'card',
    stripePaymentIntentId: paymentIntent.id,
    metadata: {
      platformFee,
      therapistFee,
      type: 'cancellation_fee',
    },
  });

  res.json({
    success: true,
    data: {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amountInCents,
      platformFee,
      therapistFee,
    },
  });
});

// @desc    Confirm payment (after client confirms on frontend)
// @route   POST /api/stripe/confirm-payment
// @access  Private
const confirmPayment = asyncHandler(async (req, res) => {
  const { paymentIntentId } = req.body;

  if (!paymentIntentId) {
    return res.status(400).json({
      success: false,
      message: 'Payment intent ID is required',
    });
  }

  // Retrieve payment intent from Stripe
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (paymentIntent.status === 'succeeded') {
    // Payment already succeeded (webhook may have processed it)
    const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });

    if (payment && payment.status === 'completed') {
      return res.json({
        success: true,
        message: 'Payment already confirmed',
        data: payment,
      });
    }
  }

  res.json({
    success: true,
    data: {
      status: paymentIntent.status,
      paymentIntentId: paymentIntent.id,
    },
  });
});

// @desc    Process payment for completed session
// @route   POST /api/stripe/process-session-payment
// @access  Private
const processSessionPayment = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  const userId = req.user._id;

  // Get session details
  const session = await Session.findById(sessionId)
    .populate('clientId', 'userId')
    .populate('therapistId', 'userId hourlyRate credentials');

  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found',
    });
  }

  // Check if session is completed
  if (session.status !== 'completed') {
    return res.status(400).json({
      success: false,
      message: 'Session must be completed before processing payment',
    });
  }

  // Check if payment already exists
  const existingPayment = await Payment.findOne({
    sessionId: session._id,
    'metadata.type': 'session_payment',
    status: 'completed',
  });

  if (existingPayment) {
    return res.status(400).json({
      success: false,
      message: 'Payment already processed for this session',
    });
  }

  // Calculate amount
  const amount = session.price || session.therapistId.hourlyRate || 100;
  const amountInCents = Math.round(amount * 100);

  // Get payment split based on therapist credentials
  const credentialType = session.therapistId.credentials || 'SLP';
  const splitConfig = getPaymentSplitForUse(credentialType);
  const platformFee = Math.round(amountInCents * (splitConfig.platformFeePercent / 100));
  const therapistFee = amountInCents - platformFee;

  // Create payment intent
  const paymentIntent = await createPaymentIntentForSession(session, amountInCents, platformFee, therapistFee);

  res.json({
    success: true,
    message: 'Payment intent created. Client needs to confirm payment.',
    data: {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amountInCents,
      platformFee,
      therapistFee,
    },
  });
});

// Helper: Create payment intent for session
async function createPaymentIntentForSession(session, amountInCents, platformFee, therapistFee) {
  // Get or create Stripe customer
  let customerId = null;
  try {
    const client = await Client.findById(session.clientId._id).populate('userId');
    const customer = await stripe.customers.create({
      email: client.userId.email,
      name: `${client.userId.firstName} ${client.userId.lastName}`,
      metadata: {
        userId: client.userId._id.toString(),
        clientId: client._id.toString(),
      },
    });
    customerId = customer.id;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
  }

  // Create payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: 'usd',
    customer: customerId,
    payment_method_types: ['card'],
    metadata: {
      sessionId: session._id.toString(),
      clientId: session.clientId._id.toString(),
      therapistId: session.therapistId._id.toString(),
      platformFee: platformFee.toString(),
      therapistFee: therapistFee.toString(),
      type: 'session_payment',
    },
  });

  // Create pending payment record
  await Payment.create({
    sessionId: session._id,
    clientId: session.clientId._id,
    therapistId: session.therapistId._id,
    amount: amountInCents,
    currency: 'USD',
    status: 'processing',
    paymentMethod: 'card',
    stripePaymentIntentId: paymentIntent.id,
    metadata: {
      platformFee,
      therapistFee,
      type: 'session_payment',
    },
  });

  return paymentIntent;
}

// @desc    Handle Stripe webhook
// @route   POST /api/stripe/webhook
// @access  Public (Stripe signature verification)
const handleWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      await handleCheckoutCompleted(session);
      break;

    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      await handlePaymentSucceeded(paymentIntent);
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      await handlePaymentFailed(failedPayment);
      break;

    case 'payment_intent.canceled':
      const canceledPayment = event.data.object;
      await handlePaymentCanceled(canceledPayment);
      break;

    case 'charge.refunded':
      const refundedCharge = event.data.object;
      await handleChargeRefunded(refundedCharge);
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// Helper: Handle checkout session completed
async function handleCheckoutCompleted(session) {
  const userId = session.metadata.userId;
  const tier = session.metadata.tier;

  if (!userId || !tier) return;

  const PRICING_TIERS = await getPricingTiersForSubscription();
  const tierInfo = PRICING_TIERS[tier];

  if (!tierInfo) return;

  // Cancel existing subscription
  await Subscription.updateMany(
    { userId, status: 'active' },
    { status: 'cancelled', cancelledAt: new Date() }
  );

  // Create new subscription
  const startDate = new Date();
  let nextBillingDate = new Date();

  if (tierInfo.billingCycle === 'every-4-weeks') {
    nextBillingDate.setDate(nextBillingDate.getDate() + 28);
  } else if (tierInfo.billingCycle === 'monthly') {
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
  } else {
    nextBillingDate = null;
  }

  // Create evaluation record using userId (Evaluation.clientId refs User model)
  const existingEval = await Evaluation.findOne({ clientId: userId });
  if (!existingEval) {
    await Evaluation.create({
      clientId: userId, // userId = User._id (Evaluation model refs User)
      status: 'pending_creation',
      questions: []
    });
    console.log(`✅ Evaluation record created for user ${userId}`);
  }

  // Update client's paid evaluation status if Bloom tier
  if (tier === 'bloom') {
    await Client.findOneAndUpdate(
      { userId },
      { hasPaidEvaluationFee: true }
    );
  }

  await Subscription.create({
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
    stripeSubscriptionId: session.subscription || null,
    stripeCustomerId: session.customer || null,
    autoRenew: true,
  });
}

// Helper: Handle payment succeeded
async function handlePaymentSucceeded(paymentIntent) {
  const { sessionId, clientId, therapistId, platformFee, therapistFee, type } = paymentIntent.metadata;

  if (!sessionId) return;

  // Find existing payment record or create new one
  let payment = await Payment.findOne({ stripePaymentIntentId: paymentIntent.id });

  if (!payment) {
    payment = await Payment.create({
      sessionId,
      clientId,
      therapistId,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'completed',
      paymentMethod: 'card',
      stripePaymentId: paymentIntent.id,
      stripePaymentIntentId: paymentIntent.id,
      metadata: {
        platformFee: parseInt(platformFee || 0),
        therapistFee: parseInt(therapistFee || 0),
        type: type || 'session_payment',
      },
    });
  } else {
    // Update existing payment
    payment.status = 'completed';
    payment.stripePaymentId = paymentIntent.id;
    await payment.save();
  }

  // Update session payment status
  await Session.findByIdAndUpdate(sessionId, {
    paymentStatus: 'paid',
  });
}

// Helper: Handle payment failed
async function handlePaymentFailed(paymentIntent) {
  const { sessionId } = paymentIntent.metadata;

  if (!sessionId) return;

  // Find existing payment or create new one
  let payment = await Payment.findOne({ stripePaymentIntentId: paymentIntent.id });

  if (!payment) {
    payment = await Payment.create({
      sessionId,
      clientId: paymentIntent.metadata.clientId,
      therapistId: paymentIntent.metadata.therapistId,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'failed',
      paymentMethod: 'card',
      stripePaymentId: paymentIntent.id,
      stripePaymentIntentId: paymentIntent.id,
      errorMessage: paymentIntent.last_payment_error?.message || 'Payment failed',
    });
  } else {
    payment.status = 'failed';
    payment.errorMessage = paymentIntent.last_payment_error?.message || 'Payment failed';
    await payment.save();
  }
}

// Helper: Handle payment canceled
async function handlePaymentCanceled(paymentIntent) {
  const { sessionId } = paymentIntent.metadata;

  if (!sessionId) return;

  const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntent.id });
  if (payment) {
    payment.status = 'failed';
    payment.errorMessage = 'Payment was canceled';
    await payment.save();
  }
}

// Helper: Handle charge refunded
async function handleChargeRefunded(charge) {
  const paymentIntentId = charge.payment_intent;

  if (!paymentIntentId) return;

  const payment = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });
  if (payment) {
    payment.status = 'refunded';
    payment.refundAmount = charge.amount_refunded;
    payment.refundedAt = new Date();
    payment.refundReason = 'Refunded via Stripe';
    await payment.save();

    // Update session payment status
    await Session.findByIdAndUpdate(payment.sessionId, {
      paymentStatus: 'refunded',
    });
  }
}

// @desc    Verify and sync checkout session (for manual verification when webhook fails)
// @route   POST /api/stripe/verify-checkout
// @access  Private
const verifyCheckoutSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  const userId = req.user._id;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: 'Session ID is required',
    });
  }

  try {
    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Payment not completed',
        paymentStatus: session.payment_status,
      });
    }

    // Check if this session belongs to the current user
    if (session.metadata.userId !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'This checkout session does not belong to you',
      });
    }

    // Check if subscription already exists
    // For subscriptions, we check stripeSubscriptionId.
    // For one-time/Bloom, we might check if they already have an active subscription of that tier?
    let existingSubscription = null;

    if (session.subscription) {
      existingSubscription = await Subscription.findOne({
        userId,
        stripeSubscriptionId: session.subscription,
        status: 'active',
      });
    } else {
      // For Bloom/One-time, check if they are already on this tier locally.
      const tier = session.metadata.tier;
      existingSubscription = await Subscription.findOne({
        userId,
        tier,
        status: 'active'
      });
    }

    if (existingSubscription) {
      // Even if subscription already exists, ensure evaluation record exists
      const tier = session.metadata.tier;
      const existingEval = await Evaluation.findOne({ clientId: userId });
      if (!existingEval) {
        await Evaluation.create({
          clientId: userId,
          status: 'pending_creation',
          questions: []
        });
        console.log(`✅ Evaluation record created for user ${userId} (existing subscription path)`);
      }
      // Update hasPaidEvaluationFee if Bloom
      if (tier === 'bloom') {
        await Client.findOneAndUpdate(
          { userId },
          { hasPaidEvaluationFee: true }
        );
      }
      return res.json({
        success: true,
        message: 'Subscription already exists',
        data: existingSubscription,
      });
    }

    // Create subscription (same logic as webhook handler)
    const tier = session.metadata.tier;
    if (!tier) {
      return res.status(400).json({
        success: false,
        message: 'Tier information not found in session',
      });
    }

    const PRICING_TIERS = await getPricingTiersForSubscription();
    const tierInfo = PRICING_TIERS[tier];

    if (!tierInfo) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tier information',
      });
    }

    // Cancel existing subscription
    await Subscription.updateMany(
      { userId, status: 'active' },
      { status: 'cancelled', cancelledAt: new Date() }
    );

    // Create new subscription
    const startDate = new Date();
    let nextBillingDate = new Date();

    if (tierInfo.billingCycle === 'every-4-weeks') {
      nextBillingDate.setDate(nextBillingDate.getDate() + 28);
    } else if (tierInfo.billingCycle === 'monthly') {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    } else {
      nextBillingDate = null;
    }

    // Create evaluation record using userId (Evaluation.clientId refs User model)
    const existingEval = await Evaluation.findOne({ clientId: userId });
    if (!existingEval) {
      await Evaluation.create({
        clientId: userId, // userId = User._id (Evaluation model refs User)
        status: 'pending_creation',
        questions: []
      });
      console.log(`✅ Evaluation record created for user ${userId} (verify-checkout)`);
    }

    // Update client's paid evaluation status if Bloom tier
    if (tier === 'bloom') {
      await Client.findOneAndUpdate(
        { userId },
        { hasPaidEvaluationFee: true }
      );
    }

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
      stripeSubscriptionId: session.subscription || null,
      stripeCustomerId: session.customer || null,
      autoRenew: !!session.subscription,
    });

    res.json({
      success: true,
      message: 'Subscription created successfully',
      data: subscription,
    });
  } catch (error) {
    console.error('Error verifying checkout session:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify checkout session',
    });
  }
});

// @desc    Get Stripe publishable key
// @route   GET /api/stripe/config
// @access  Public
const getStripeConfig = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    },
  });
});

// @desc    Refund a payment
// @route   POST /api/stripe/refund
// @access  Private/Admin
const refundPayment = asyncHandler(async (req, res) => {
  const { paymentId, amount, reason } = req.body;

  if (!paymentId) {
    return res.status(400).json({
      success: false,
      message: 'Payment ID is required',
    });
  }

  // Find payment record
  const payment = await Payment.findById(paymentId);

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment not found',
    });
  }

  if (!payment.stripePaymentIntentId) {
    return res.status(400).json({
      success: false,
      message: 'Payment does not have a Stripe payment intent',
    });
  }

  // Retrieve payment intent
  const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);

  if (!paymentIntent.charges.data.length) {
    return res.status(400).json({
      success: false,
      message: 'No charge found for this payment',
    });
  }

  const chargeId = paymentIntent.charges.data[0].id;
  const refundAmount = amount ? Math.round(amount * 100) : null; // Convert to cents if partial refund

  // Create refund
  const refund = await stripe.refunds.create({
    charge: chargeId,
    amount: refundAmount,
    reason: reason || 'requested_by_customer',
    metadata: {
      paymentId: payment._id.toString(),
      sessionId: payment.sessionId.toString(),
    },
  });

  // Update payment record
  payment.status = 'refunded';
  payment.refundAmount = refund.amount;
  payment.refundedAt = new Date();
  payment.refundReason = reason || 'Refunded by admin';
  await payment.save();

  // Update session payment status
  await Session.findByIdAndUpdate(payment.sessionId, {
    paymentStatus: 'refunded',
  });

  res.json({
    success: true,
    message: 'Refund processed successfully',
    data: {
      refundId: refund.id,
      amount: refund.amount,
      payment: payment,
    },
  });
});

// @desc    Create Stripe checkout session for a single therapy session (Bloom/Pay-as-you-go)
// @route   POST /api/stripe/create-session-payment
// @access  Private
const createSessionPaymentCheckout = asyncHandler(async (req, res) => {
  const { therapistId, date, time, duration, sessionType, amount } = req.body;
  const userId = req.user._id;

  if (!therapistId || !date || !time || !amount) {
    return res.status(400).json({
      success: false,
      message: 'Missing required session details',
    });
  }

  // Double check amount prevents frontend manipulation, but for now we trust the passed amount 
  // or (better) we should verify it against the tier/therapist rate here. 
  // For MVP, we will use the passed amount but ensure it's at least the minimum.
  const unitAmount = Math.max(amount, 10) * 100; // Minimum 10 cents to avoid errors, convert to cents

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Therapy Session (${sessionType})`,
            description: `Session with Therapist on ${date} at ${time}`,
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/book-session?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/book-session?canceled=true`,
    client_reference_id: userId.toString(),
    metadata: {
      type: 'session_booking',
      userId: userId.toString(),
      therapistId,
      date,
      time,
      duration,
      sessionType,
    },
  });

  res.json({
    success: true,
    data: {
      sessionId: session.id,
      url: session.url,
    },
  });
});

// @desc    Verify session payment and create booking
// @route   POST /api/stripe/verify-session-payment
// @access  Private
const verifySessionPayment = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  const userId = req.user._id;

  if (!sessionId) {
    return res.status(400).json({ success: false, message: 'Session ID is required' });
  }

  // Retrieve the checkout session from Stripe
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (!session) {
    return res.status(404).json({ success: false, message: 'Stripe session not found' });
  }

  if (session.payment_status !== 'paid') {
    return res.status(400).json({ success: false, message: 'Payment not completed' });
  }

  // Check if session booking already exists to avoid duplicates
  // We can use the checkout session ID as a unique identifier if we stored it, 
  // but Session model might not have it.
  // Instead, we check for a session with same therapist, date, time and client.
  const { therapistId, date, time, duration, sessionType } = session.metadata;

  if (!therapistId || !date || !time) {
    return res.status(400).json({ success: false, message: 'Invalid session metadata' });
  }

  // Retrieve client ID for the user
  const client = await Client.findOne({ userId });
  if (!client) {
    return res.status(404).json({ success: false, message: 'Client profile not found' });
  }

  const existingSession = await Session.findOne({
    therapistId,
    clientId: client._id,
    scheduledDate: date,
    scheduledTime: time,
    status: { $ne: 'cancelled' }
  });

  if (existingSession) {
    return res.json({
      success: true,
      message: 'Session already booked',
      data: existingSession,
    });
  }

  // Create the session
  const newSession = await Session.create({
    therapistId,
    clientId: client._id,
    scheduledDate: date,
    scheduledTime: time,
    duration: parseInt(duration || '45'),
    sessionType: sessionType || 'regular',
    price: session.amount_total / 100,
    status: 'scheduled',
    paymentStatus: 'paid', // Mark as paid immediately
    stripePaymentId: session.payment_intent, // Store payment intent ID
  });

  res.json({
    success: true,
    data: newSession,
  });
});

module.exports = {
  createCheckoutSession,
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
};

