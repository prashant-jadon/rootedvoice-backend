const mongoose = require('mongoose');

const therapistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  licenseNumber: {
    type: String,
    required: [true, 'License number is required'],
    trim: true,
  },
  licensedStates: [{
    type: String,
    required: true,
  }],
  specializations: [{
    type: String,
    enum: [
      'Early Intervention',
      'Articulation & Phonology',
      'Language Development',
      'Fluency/Stuttering',
      'Voice Therapy',
      'Feeding & Swallowing',
      'AAC',
      'Cognitive-Communication',
      'Neurogenic Disorders',
      'Accent Modification',
      'Gender-Affirming Voice',
      'Pediatric',
      'Adult',
      'Geriatric',
    ],
  }],
  bio: {
    type: String,
    maxlength: [2000, 'Bio cannot exceed 2000 characters'],
  },
  location: {
    type: String,
    trim: true,
  },
  education: [{
    degree: String,
    institution: String,
    year: Number,
  }],
  certifications: [{
    name: String,
    issuer: String,
    year: Number,
  }],
  workExperience: [{
    position: String,
    company: String,
    startDate: Date,
    endDate: Date,
    isCurrent: {
      type: Boolean,
      default: false,
    },
    description: String,
  }],
  experience: {
    type: Number,
    default: 0,
    min: 0,
  },
  hourlyRate: {
    type: Number,
    required: [true, 'Hourly rate is required'],
    min: [0, 'Hourly rate must be positive'],
    validate: {
      validator: function(value) {
        // Rate cap validation will be handled in controller
        // This allows flexibility for admin to set caps
        return value >= 0;
      },
      message: 'Hourly rate must be a positive number',
    },
  },
  availability: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
    startTime: String,
    endTime: String,
  }],
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  totalReviews: {
    type: Number,
    default: 0,
  },
  totalSessions: {
    type: Number,
    default: 0,
  },
  activeClients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
  }],
  isVerified: {
    type: Boolean,
    default: false,
  },
  stripeAccountId: {
    type: String,
  },
  credentials: {
    type: String,
    enum: ['SLP', 'SLPA'],
    default: 'SLP',
  },
  spokenLanguages: [{
    type: String,
    enum: ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'pt', 'ru', 'it', 'hi', 'nl', 'pl', 'tr', 'vi', 'asl'],
  }],
  bilingualTherapy: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Indexes
therapistSchema.index({ userId: 1 });
therapistSchema.index({ licensedStates: 1 });
therapistSchema.index({ specializations: 1 });
therapistSchema.index({ rating: -1 });
therapistSchema.index({ isVerified: 1 });

// Virtual for active client count
therapistSchema.virtual('activeClientCount').get(function() {
  return this.activeClients.length;
});

const Therapist = mongoose.model('Therapist', therapistSchema);

module.exports = Therapist;

