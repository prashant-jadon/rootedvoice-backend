require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/database');

// Connect to database
connectDB();

async function updateUserRole() {
  try {
    const email = process.argv[2];
    const newRole = process.argv[3] || 'admin';

    if (!email) {
      console.log('\n❌ Usage: node src/scripts/updateUserRole.js <email> [role]');
      console.log('   Example: node src/scripts/updateUserRole.js admin@example.com admin\n');
      process.exit(1);
    }

    if (!['admin', 'therapist', 'client'].includes(newRole)) {
      console.log('\n❌ Invalid role. Must be: admin, therapist, or client\n');
      process.exit(1);
    }

    console.log(`\n🔄 Updating user role...\n`);
    console.log('Email:', email);
    console.log('New Role:', newRole, '\n');

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.log('❌ User not found with email:', email);
      process.exit(1);
    }

    const oldRole = user.role;
    user.role = newRole;
    await user.save();

    console.log('✅ User role updated successfully!');
    console.log(`\n📧 Email: ${email}`);
    console.log(`👤 Old Role: ${oldRole}`);
    console.log(`👤 New Role: ${newRole}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating user role:', error.message);
    process.exit(1);
  }
}

// Run the script
updateUserRole();

