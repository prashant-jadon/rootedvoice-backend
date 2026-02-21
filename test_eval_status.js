const mongoose = require('mongoose');

async function main() {
  await mongoose.connect('mongodb://localhost:27017/rooted_voices_test');
  const db = mongoose.connection;
  
  const therapistIdStr = '698aa328e42285b9d5d6cd0d';
  const therapist = await db.collection('therapists').findOne({_id: new mongoose.Types.ObjectId(therapistIdStr)});
  
  if (therapist) {
    const evals = await db.collection('evaluations').find({
        therapistId: therapist._id,
        status: { $nin: ['cancelled'] }
    }).toArray();
    
    if (evals.length > 0) {
      console.log(`Evaluation ID: ${evals[0]._id}`);
      console.log(`Current Status: ${evals[0].status}`);
    } else {
      console.log("No assigned evaluations");
    }
  }

  process.exit(0);
}

main().catch(console.error);
