const mongoose = require('mongoose');

async function main() {
  await mongoose.connect('mongodb://localhost:27017/rooted_voices_test');
  const db = mongoose.connection;
  
  const therapists = await db.collection('therapists').find({status: 'active'}).toArray();
  console.log("Active therapists:", therapists.length);
  
  const evals = await db.collection('evaluations').find({}).toArray();
  console.log("Total evals:", evals.length);
  
  const assigned = evals.filter(e => e.therapistId);
  console.log("Assigned evals:", assigned.length);
  if (assigned.length > 0) {
      console.log("First assigned therapistId:", assigned[0].therapistId);
      
      const match = therapists.find(t => t._id.toString() === assigned[0].therapistId.toString());
      console.log("Does therapist exist:", !!match);
  }
  
  process.exit(0);
}

main().catch(console.error);
