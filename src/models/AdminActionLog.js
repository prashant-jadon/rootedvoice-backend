const mongoose = require('mongoose');

const adminActionLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      // Therapist actions
      'therapist_approved',
      'therapist_rejected',
      'therapist_status_changed',
      'therapist_paused',
      'therapist_activated',
      'therapist_document_verified',
      'therapist_document_rejected',
      'therapist_credentials_updated',
      'therapist_supervising_updated',
      // User actions
      'user_suspended',
      'user_activated',
      'user_bulk_action',
      // Other actions
      'settings_updated',
      'pricing_updated',
      'payment_split_updated',
      'rate_caps_updated',
    ],
    index: true,
  },
  targetType: {
    type: String,
    required: true,
    enum: ['therapist', 'user', 'client', 'system', 'document'],
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  targetName: {
    type: String,
    // Human-readable name for the target (e.g., therapist name, user email)
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    // Flexible object to store action-specific details
    // Examples:
    // - { oldStatus: 'pending', newStatus: 'active', reason: '...' }
    // - { documentType: 'spaMembership', verified: true }
    // - { oldCredentials: 'SLP', newCredentials: 'SLPA' }
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    // Additional metadata like reason, notes, etc.
  },
}, {
  timestamps: true,
});

// Indexes for efficient querying
adminActionLogSchema.index({ createdAt: -1 });
adminActionLogSchema.index({ adminId: 1, createdAt: -1 });
adminActionLogSchema.index({ targetType: 1, targetId: 1 });
adminActionLogSchema.index({ action: 1, createdAt: -1 });

// Virtual to populate admin details
adminActionLogSchema.virtual('admin', {
  ref: 'User',
  localField: 'adminId',
  foreignField: '_id',
  justOne: true,
});

const AdminActionLog = mongoose.model('AdminActionLog', adminActionLogSchema);

module.exports = AdminActionLog;

