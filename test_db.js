const mongoose = require('mongoose');

async function main() {
  await mongoose.connect('mongodb://localhost:27017/rooted_voices_test');
  const db = mongoose.connection;
  
  const therapists = await db.collection('therapists').find({}).toArray();
  console.log("Total Therapists:", therapists.length);
  
  const slpActiveVerified = therapists.filter(t => t.credentials === 'SLP' && t.status === 'active' && t.isVerified);
  console.log("SLP, active, verified:", slpActiveVerified.length);
  
  if (therapists.length > 0) {
    console.log("Sample Therapist Data:");
    console.log("Credentials:", therapists[0].credentials);
    console.log("Status:", therapists[0].status);
    console.log("isVerified:", therapists[0].isVerified);
  }
  
  process.exit(0);
}

main().catch(console.error);
