const mongoose = require('mongoose');

async function main() {
  await mongoose.connect('mongodb://localhost:27017/rooted_voices_test');
  const db = mongoose.connection;
  
  const evals = await db.collection('evaluations').find({}).sort({createdAt: -1}).limit(5).toArray();
  console.log("Recent evaluations count:", evals.length);
  
  evals.forEach(e => {
    console.log(`- Status: ${e.status}, Therapist: ${e.therapistId}, Client: ${e.clientId}`);
  });
  
  process.exit(0);
}

main().catch(console.error);
