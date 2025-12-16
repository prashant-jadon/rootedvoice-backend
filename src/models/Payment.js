const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
  },
  therapistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Therapist',
    required: true,
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Amount must be positive'],
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true,
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'bank', 'insurance', 'cash', 'other'],
    default: 'card',
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'disputed'],
    default: 'pending',
  },
  stripePaymentId: {
    type: String,
  },
  stripePaymentIntentId: {
    type: String,
  },
  refundAmount: {
    type: Number,
    default: 0,
  },
  refundReason: {
    type: String,
  },
  refundedAt: {
    type: Date,
  },
  invoiceUrl: {
    type: String,
  },
  invoiceNumber: {
    type: String,
    unique: true,
    sparse: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
  errorMessage: {
    type: String,
  },
}, {
  timestamps: true,
});

// Indexes
paymentSchema.index({ clientId: 1, createdAt: -1 });
paymentSchema.index({ therapistId: 1, createdAt: -1 });
paymentSchema.index({ sessionId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ invoiceNumber: 1 });
paymentSchema.index({ stripePaymentId: 1 });

// Generate invoice number before save
paymentSchema.pre('save', async function(next) {
  if (this.isNew && !this.invoiceNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const count = await mongoose.model('Payment').countDocuments();
    this.invoiceNumber = `INV-${year}${month}-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;

