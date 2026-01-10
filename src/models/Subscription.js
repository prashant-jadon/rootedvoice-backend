const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  tier: {
    type: String,
    enum: ['rooted', 'flourish', 'bloom', 'pay-as-you-go', 'evaluation'],
    required: true,
  },
  tierName: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  billingCycle: {
    type: String,
    enum: ['every-4-weeks', 'pay-as-you-go', 'monthly', 'one-time'],
    required: true,
  },
  sessionsPerMonth: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'cancelled', 'pending'],
    default: 'pending',
  },
  startDate: {
    type: Date,
  },
  endDate: {
    type: Date,
  },
  nextBillingDate: {
    type: Date,
  },
  features: [{
    type: String,
  }],
  // For future Stripe integration
  stripeSubscriptionId: {
    type: String,
  },
  stripeCustomerId: {
    type: String,
  },
  stripePriceId: {
    type: String,
  },
  // Payment tracking
  autoRenew: {
    type: Boolean,
    default: true,
  },
  cancelledAt: {
    type: Date,
  },
  cancellationReason: {
    type: String,
  },
}, {
  timestamps: true,
});

// Indexes
subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ tier: 1 });
subscriptionSchema.index({ nextBillingDate: 1 });

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;

