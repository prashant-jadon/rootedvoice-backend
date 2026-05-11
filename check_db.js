const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Therapist = require('./src/models/Therapist.js');
  const therapists = await Therapist.find().populate('userId', 'firstName lastName email').limit(5);
  console.log(JSON.stringify(therapists.map(t => ({ id: t._id, name: t.userId?.firstName, status: t.status, onboardingStatus: t.onboardingStatus, isVerified: t.isVerified })), null, 2));
  mongoose.disconnect();
}).catch(console.error);
