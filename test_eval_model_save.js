const mongoose = require('mongoose');

async function main() {
  await mongoose.connect('mongodb://localhost:27017/rooted_voices_test');
  const db = mongoose.connection;
  
  const Evaluation = require('./src/models/Evaluation');
  
  const evalId = '69992d07fa731fba9c7810dc';
  try {
    const evaluation = await Evaluation.findById(evalId);
    console.log(`Original status: ${evaluation.status}`);
    
    evaluation.status = 'therapist_reviewing';
    await evaluation.save();
    console.log(`Saved successfully. New status: ${evaluation.status}`);
  } catch (err) {
    console.error("Mongoose validation error:");
    console.error(err);
  }

  process.exit(0);
}

main().catch(console.error);
