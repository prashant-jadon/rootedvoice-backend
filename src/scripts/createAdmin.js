require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/database');

// Connect to database
connectDB();

async function createAdmin() {
  try {
    // Get admin details from command line arguments or use defaults
    const email = process.argv[2] || 'admin@rootedvoices.com';
    const password = process.argv[3] || 'admin123456';
    const firstName = process.argv[4] || 'Admin';
    const lastName = process.argv[5] || 'User';

    console.log('\n🔐 Creating admin user...\n');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Name:', `${firstName} ${lastName}\n`);

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    
    if (existingUser) {
      if (existingUser.role === 'admin') {
        console.log('❌ Admin user with this email already exists!');
        console.log('   To update existing user, use: node src/scripts/updateUserRole.js');
        process.exit(1);
      } else {
        // Update existing user to admin
        existingUser.role = 'admin';
        existingUser.password = password; // Will be hashed by pre-save hook
        await existingUser.save();
        console.log('✅ Updated existing user to admin role!');
        console.log(`\n📧 Email: ${email}`);
        console.log(`🔑 Password: ${password}`);
        console.log(`👤 Role: admin\n`);
        process.exit(0);
      }
    }

    // Create new admin user
    const admin = await User.create({
      email: email.toLowerCase(),
      password: password, // Will be hashed by pre-save hook
      role: 'admin',
      firstName,
      lastName,
      isActive: true,
      isEmailVerified: true, // Auto-verify admin emails
    });

    console.log('✅ Admin user created successfully!');
    console.log(`\n📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👤 Role: admin`);
    console.log(`🆔 User ID: ${admin._id}\n`);
    
    console.log('🚀 You can now login to the admin panel with these credentials!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  }
}

// Run the script
createAdmin();

