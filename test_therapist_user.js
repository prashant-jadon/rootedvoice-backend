const mongoose = require('mongoose');

async function main() {
  await mongoose.connect('mongodb://localhost:27017/rooted_voices_test');
  const db = mongoose.connection;
  
  // Find therapist mapped to the assigned evaluation
  const therapistIdStr = '698aa328e42285b9d5d6cd0d';
  const therapist = await db.collection('therapists').findOne({_id: new mongoose.Types.ObjectId(therapistIdStr)});
  
  if (therapist) {
    const user = await db.collection('users').findOne({_id: therapist.userId});
    console.log("Found Therapist User:", user ? user.email : 'No user linked');
    
    // Now simulate getting assignments
    const evals = await db.collection('evaluations').find({
        therapistId: therapist._id,
        status: { $nin: ['cancelled'] }
    }).toArray();
    
    console.log(`Assignments for this therapist: ${evals.length}`);
  } else {
    console.log("Therapist not found");
  }

  process.exit(0);
}

main().catch(console.error);
