const mongoose = require('mongoose');

async function main() {
  await mongoose.connect('mongodb://localhost:27017/rooted_voices_test');
  const db = mongoose.connection;
  
  const evalId = new mongoose.Types.ObjectId('69992d07fa731fba9c7810dc');
  const evaluation = await db.collection('evaluations').findOne({_id: evalId});
  console.log(`Evaluation status: ${evaluation.status}`);

  process.exit(0);
}

main().catch(console.error);
