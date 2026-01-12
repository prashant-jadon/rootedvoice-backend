require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');

// Import models
const User = require('../models/User');
const Therapist = require('../models/Therapist');
const Client = require('../models/Client');
const Session = require('../models/Session');
const Goal = require('../models/Goal');
const Assignment = require('../models/Assignment');
const Resource = require('../models/Resource');

// Seed data
const seedDatabase = async () => {
  try {
    await connectDB();

    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Therapist.deleteMany({});
    await Client.deleteMany({});
    await Session.deleteMany({});
    await Goal.deleteMany({});
    await Assignment.deleteMany({});
    await Resource.deleteMany({});

    console.log('👥 Creating users...');

    // Create therapist users
    const therapistUsers = [];
    const therapistData = [
      {
        email: 'dr.smith@rootedvoices.com',
        password: 'password123',
        firstName: 'Rebecca',
        lastName: 'Smith',
        role: 'therapist',
        phone: '555-0101',
      },
      {
        email: 'dr.johnson@rootedvoices.com',
        password: 'password123',
        firstName: 'Michael',
        lastName: 'Johnson',
        role: 'therapist',
        phone: '555-0102',
      },
      {
        email: 'dr.williams@rootedvoices.com',
        password: 'password123',
        firstName: 'Sarah',
        lastName: 'Williams',
        role: 'therapist',
        phone: '555-0103',
      },
      {
        email: 'dr.brown@rootedvoices.com',
        password: 'password123',
        firstName: 'David',
        lastName: 'Brown',
        role: 'therapist',
        phone: '555-0104',
      },
      {
        email: 'dr.garcia@rootedvoices.com',
        password: 'password123',
        firstName: 'Maria',
        lastName: 'Garcia',
        role: 'therapist',
        phone: '555-0105',
      },
    ];

    for (const data of therapistData) {
      const user = await User.create(data);
      therapistUsers.push(user);
    }

    console.log(`✅ Created ${therapistUsers.length} therapist users`);

    // Create therapist profiles
    const therapists = [];
    const therapistProfiles = [
      {
        userId: therapistUsers[0]._id,
        licenseNumber: 'SLP-12345',
        licensedStates: ['California', 'Nevada', 'Arizona'],
        specializations: ['Articulation & Phonology', 'Language Development', 'Early Intervention'],
        bio: 'Experienced speech-language pathologist with over 10 years of experience working with children and adults.',
        experience: 10,
        hourlyRate: 90,
        rating: 4.9,
        totalReviews: 45,
        totalSessions: 250,
        isVerified: true,
        credentials: 'SLP',
      },
      {
        userId: therapistUsers[1]._id,
        licenseNumber: 'SLP-23456',
        licensedStates: ['New York', 'New Jersey', 'Connecticut'],
        specializations: ['Fluency/Stuttering', 'Voice Therapy', 'Cognitive-Communication'],
        bio: 'Specializing in fluency disorders and voice therapy for over 8 years.',
        experience: 8,
        hourlyRate: 85,
        rating: 4.8,
        totalReviews: 38,
        totalSessions: 180,
        isVerified: true,
        credentials: 'SLP',
      },
      {
        userId: therapistUsers[2]._id,
        licenseNumber: 'SLP-34567',
        licensedStates: ['Texas', 'Oklahoma'],
        specializations: ['AAC', 'Language Development', 'Pediatric'],
        bio: 'Passionate about helping non-verbal children find their voice through AAC.',
        experience: 6,
        hourlyRate: 80,
        rating: 4.9,
        totalReviews: 52,
        totalSessions: 220,
        isVerified: true,
        credentials: 'SLP',
      },
      {
        userId: therapistUsers[3]._id,
        licenseNumber: 'SLP-45678',
        licensedStates: ['Florida', 'Georgia'],
        specializations: ['Neurogenic Disorders', 'Feeding & Swallowing', 'Adult'],
        bio: 'Specializing in adult neurogenic disorders and dysphagia management.',
        experience: 12,
        hourlyRate: 95,
        rating: 4.7,
        totalReviews: 31,
        totalSessions: 160,
        isVerified: true,
        credentials: 'SLP',
      },
      {
        userId: therapistUsers[4]._id,
        licenseNumber: 'SLP-56789',
        licensedStates: ['Illinois', 'Wisconsin', 'Indiana'],
        specializations: ['Gender-Affirming Voice', 'Accent Modification', 'Voice Therapy'],
        bio: 'Helping individuals achieve their voice goals through evidence-based therapy.',
        experience: 5,
        hourlyRate: 85,
        rating: 4.8,
        totalReviews: 28,
        totalSessions: 140,
        isVerified: true,
        credentials: 'SLP',
      },
    ];

    for (const profile of therapistProfiles) {
      const therapist = await Therapist.create(profile);
      therapists.push(therapist);
    }

    console.log(`✅ Created ${therapists.length} therapist profiles`);

    // Create client users
    const clientUsers = [];
    const clientData = [
      {
        email: 'john.doe@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'client',
        phone: '555-0201',
      },
      {
        email: 'jane.smith@example.com',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'client',
        phone: '555-0202',
      },
      {
        email: 'emily.johnson@example.com',
        password: 'password123',
        firstName: 'Emily',
        lastName: 'Johnson',
        role: 'client',
        phone: '555-0203',
      },
      {
        email: 'michael.brown@example.com',
        password: 'password123',
        firstName: 'Michael',
        lastName: 'Brown',
        role: 'client',
        phone: '555-0204',
      },
      {
        email: 'sarah.wilson@example.com',
        password: 'password123',
        firstName: 'Sarah',
        lastName: 'Wilson',
        role: 'client',
        phone: '555-0205',
      },
    ];

    for (const data of clientData) {
      const user = await User.create(data);
      clientUsers.push(user);
    }

    console.log(`✅ Created ${clientUsers.length} client users`);

    // Create client profiles
    const clients = [];
    const clientProfiles = [
      {
        userId: clientUsers[0]._id,
        dateOfBirth: new Date('2015-03-15'),
        guardianName: 'Robert Doe',
        guardianRelation: 'Father',
        assignedTherapist: therapists[0]._id,
        currentDiagnoses: ['Articulation Disorder'],
      },
      {
        userId: clientUsers[1]._id,
        dateOfBirth: new Date('2018-07-22'),
        guardianName: 'Lisa Smith',
        guardianRelation: 'Mother',
        assignedTherapist: therapists[0]._id,
        currentDiagnoses: ['Language Delay'],
      },
      {
        userId: clientUsers[2]._id,
        dateOfBirth: new Date('2012-11-08'),
        guardianName: 'Tom Johnson',
        guardianRelation: 'Father',
        assignedTherapist: therapists[2]._id,
        currentDiagnoses: ['Childhood Apraxia of Speech'],
      },
      {
        userId: clientUsers[3]._id,
        dateOfBirth: new Date('1985-05-20'),
        assignedTherapist: therapists[3]._id,
        currentDiagnoses: ['Stroke Recovery'],
      },
      {
        userId: clientUsers[4]._id,
        dateOfBirth: new Date('2016-09-12'),
        guardianName: 'Karen Wilson',
        guardianRelation: 'Mother',
        assignedTherapist: therapists[1]._id,
        currentDiagnoses: ['Stuttering'],
      },
    ];

    for (const profile of clientProfiles) {
      const client = await Client.create(profile);
      clients.push(client);
    }

    console.log(`✅ Created ${clients.length} client profiles`);

    // Update therapist active clients
    therapists[0].activeClients = [clients[0]._id, clients[1]._id];
    await therapists[0].save();

    therapists[1].activeClients = [clients[4]._id];
    await therapists[1].save();

    therapists[2].activeClients = [clients[2]._id];
    await therapists[2].save();

    therapists[3].activeClients = [clients[3]._id];
    await therapists[3].save();

    console.log('📅 Creating sessions...');

    // Create sessions
    const sessions = [];
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const sessionData = [
      {
        therapistId: therapists[0]._id,
        clientId: clients[0]._id,
        scheduledDate: tomorrow,
        scheduledTime: '10:00 AM',
        duration: 45,
        sessionType: 'follow-up',
        status: 'confirmed',
        price: 90,
      },
      {
        therapistId: therapists[0]._id,
        clientId: clients[1]._id,
        scheduledDate: tomorrow,
        scheduledTime: '2:00 PM',
        duration: 45,
        sessionType: 'follow-up',
        status: 'scheduled',
        price: 90,
      },
      {
        therapistId: therapists[2]._id,
        clientId: clients[2]._id,
        scheduledDate: nextWeek,
        scheduledTime: '11:00 AM',
        duration: 60,
        sessionType: 'assessment',
        status: 'confirmed',
        price: 120,
      },
      {
        therapistId: therapists[1]._id,
        clientId: clients[4]._id,
        scheduledDate: now,
        scheduledTime: '4:30 PM',
        duration: 30,
        sessionType: 'follow-up',
        status: 'completed',
        price: 60,
        paymentStatus: 'completed',
      },
    ];

    for (const data of sessionData) {
      const session = await Session.create(data);
      sessions.push(session);
    }

    console.log(`✅ Created ${sessions.length} sessions`);

    console.log('🎯 Creating goals...');

    // NOTE: Goals in seed data are for DEVELOPMENT/TESTING ONLY
    // In production, goals must NEVER be auto-generated
    // Goals must be created by therapists AFTER diagnostic evaluation
    // Create goals
    const goalData = [
      {
        clientId: clients[0]._id,
        therapistId: therapists[0]._id,
        title: 'Improve /r/ sound production',
        description: 'Client will produce /r/ sound correctly in 80% of trials',
        category: 'articulation',
        targetDate: new Date('2025-03-01'),
        status: 'active',
        progress: 65,
      },
      {
        clientId: clients[1]._id,
        therapistId: therapists[0]._id,
        title: 'Expand vocabulary',
        description: 'Increase expressive vocabulary by 50 new words',
        category: 'language',
        targetDate: new Date('2025-02-15'),
        status: 'active',
        progress: 40,
      },
      {
        clientId: clients[4]._id,
        therapistId: therapists[1]._id,
        title: 'Reduce stuttering frequency',
        description: 'Decrease disfluencies to less than 5% of syllables',
        category: 'fluency',
        targetDate: new Date('2025-04-01'),
        status: 'active',
        progress: 55,
      },
    ];

    for (const data of goalData) {
      await Goal.create(data);
    }

    console.log(`✅ Created ${goalData.length} goals`);

    console.log('📝 Creating assignments...');

    // Create assignments
    const tomorrow2 = new Date(now);
    tomorrow2.setDate(tomorrow2.getDate() + 2);

    const assignmentData = [
      {
        clientId: clients[0]._id,
        therapistId: therapists[0]._id,
        title: 'Daily /r/ practice',
        description: 'Practice /r/ sound in isolation 10 times, 3x daily',
        type: 'daily-practice',
        dueDate: tomorrow2,
        completed: false,
      },
      {
        clientId: clients[1]._id,
        therapistId: therapists[0]._id,
        title: 'Name 5 objects worksheet',
        description: 'Complete the picture naming worksheet',
        type: 'worksheet',
        dueDate: tomorrow2,
        completed: false,
      },
      {
        clientId: clients[4]._id,
        therapistId: therapists[1]._id,
        title: 'Breathing exercises',
        description: 'Practice diaphragmatic breathing before speaking',
        type: 'video-exercise',
        dueDate: tomorrow,
        completed: true,
        completedAt: now,
      },
    ];

    for (const data of assignmentData) {
      await Assignment.create(data);
    }

    console.log(`✅ Created ${assignmentData.length} assignments`);

    console.log('');
    console.log('✅ ================================ ✅');
    console.log('✅  Database seeded successfully!');
    console.log('✅ ================================ ✅');
    console.log('');
    console.log('👥 Credentials:');
    console.log('');
    console.log('Therapist Login:');
    console.log('  Email: dr.smith@rootedvoices.com');
    console.log('  Password: password123');
    console.log('');
    console.log('Client Login:');
    console.log('  Email: john.doe@example.com');
    console.log('  Password: password123');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

// Run seeder
seedDatabase();

