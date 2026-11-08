// Singleton document storing admin-editable platform rate configuration
// (rate caps, cancellation fees, evaluation compensation).
//
// Historically these lived as module-level JS variables in
// pricingController.js — which meant edits were lost on serverless cold
// starts. This model is the durable store; pricingController hydrates
// its in-memory cache from here on boot and writes through on every
// admin update, so synchronous helpers (getRateCapsForUse, …) still work
// without becoming async.
//
// There is always exactly ONE document in this collection, identified by
// `singletonKey: 'platform'` (the unique index enforces that).

const mongoose = require('mongoose');

const platformConfigSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      required: true,
      unique: true,
      default: 'platform',
    },
    rateCaps: {
      SLP: { type: Number, default: 75 },
      SLPA: { type: Number, default: 55 },
    },
    cancellationFees: {
      SLP: { type: Number, default: 20 },
      SLPA: { type: Number, default: 15 },
    },
    evaluationCompensation: {
      SLP: { type: Number, default: 85 },
      SLPA: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

// Fetch (and lazily create) the singleton. Returns a plain object.
platformConfigSchema.statics.getConfig = async function () {
  const doc = await this.findOneAndUpdate(
    { singletonKey: 'platform' },
    { $setOnInsert: { singletonKey: 'platform' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return doc.toObject();
};

module.exports = mongoose.model('PlatformConfig', platformConfigSchema);
