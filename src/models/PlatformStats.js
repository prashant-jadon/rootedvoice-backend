const mongoose = require('mongoose');

const platformStatsSchema = new mongoose.Schema({
  // Who We Are page stats
  whoWeAreStats: {
    licensedTherapists: {
      number: { type: String, default: '50+' },
      label: { type: String, default: 'Licensed Therapists' },
      context: { type: String, default: 'Licensed and verified therapists across multiple states' }
    },
    yearsExperience: {
      number: { type: String, default: '15+' },
      label: { type: String, default: 'Years Combined Experience' },
      context: { type: String, default: 'Combined years of clinical experience from our team' }
    },
    sessionsCompleted: {
      number: { type: String, default: '10,000+' },
      label: { type: String, default: 'Sessions Completed' },
      context: { type: String, default: 'Total therapy sessions completed on our platform' }
    },
    clientSatisfaction: {
      number: { type: String, default: '95%' },
      label: { type: String, default: 'Client Satisfaction Rate' },
      context: { type: String, default: 'Based on post-session surveys from clients across all service tiers' }
    }
  },
  // Landing page stats
  landingPageStats: {
    activeTherapists: {
      number: { type: String, default: '10,000+' },
      label: { type: String, default: 'Active Therapists' },
      icon: { type: String, default: '🎯' }
    },
    sessionsCompleted: {
      number: { type: String, default: '50,000+' },
      label: { type: String, default: 'Sessions Completed' },
      icon: { type: String, default: '⚡' }
    },
    platformUptime: {
      number: { type: String, default: '99.9%' },
      label: { type: String, default: 'Platform Uptime' },
      icon: { type: String, default: '⭐' }
    },
    clientRating: {
      number: { type: String, default: '4.9/5' },
      label: { type: String, default: 'Client Rating' },
      icon: { type: String, default: '⭐' }
    }
  }
}, {
  timestamps: true,
});

// Ensure only one document exists
platformStatsSchema.statics.getStats = async function() {
  let stats = await this.findOne();
  if (!stats) {
    stats = await this.create({});
  }
  return stats;
};

module.exports = mongoose.model('PlatformStats', platformStatsSchema);

