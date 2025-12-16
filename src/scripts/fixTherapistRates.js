const mongoose = require('mongoose');
const Therapist = require('../models/Therapist');
const { getRateCapsForUse } = require('../controllers/pricingController');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcareapp', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const fixTherapistRates = async () => {
  try {
    await connectDB();
    
    const rateCaps = getRateCapsForUse();
    console.log('Rate caps:', rateCaps);
    
    // Find all therapists
    const therapists = await Therapist.find({});
    console.log(`Found ${therapists.length} therapists`);
    
    let fixedCount = 0;
    
    for (const therapist of therapists) {
      const maxRate = rateCaps[therapist.credentials] || rateCaps.SLP;
      
      if (therapist.hourlyRate > maxRate) {
        console.log(`Fixing therapist ${therapist._id}: ${therapist.credentials} rate ${therapist.hourlyRate} -> ${maxRate}`);
        therapist.hourlyRate = maxRate;
        await therapist.save();
        fixedCount++;
      }
    }
    
    console.log(`\n✅ Fixed ${fixedCount} therapist rates`);
    console.log('All therapist rates are now within limits');
    
    process.exit(0);
  } catch (error) {
    console.error('Error fixing therapist rates:', error);
    process.exit(1);
  }
};

fixTherapistRates();

