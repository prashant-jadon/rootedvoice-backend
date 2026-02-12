const mongoose = require('mongoose');

const pricingTierSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    duration: {
        type: Number,
        default: 45
    },
    billingCycle: {
        type: String,
        enum: ['monthly', 'every-4-weeks', 'pay-as-you-go', 'one-time'],
        default: 'monthly'
    },
    sessionsPerMonth: {
        type: Number,
        default: 0
    },
    includesEvaluation: {
        type: Boolean,
        default: false
    },
    features: [{
        type: String
    }],
    description: {
        type: String
    },
    icon: {
        type: String
    },
    popular: {
        type: Boolean,
        default: false
    },
    monthlyPrice: {
        type: Number
    },
    perSessionPrice: {
        type: Number
    },
    durationRange: {
        type: String
    },
    evaluationPrice: {
        type: Number
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp on save
pricingTierSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('PricingTier', pricingTierSchema);
