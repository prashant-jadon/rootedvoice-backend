#!/usr/bin/env node

/**
 * Comprehensive API Testing Script
 * Tests all endpoints in the Rooted Voices API
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:5001';
let authToken = null;
let adminToken = null;
let testUserId = null;
let testTherapistId = null;
let testClientId = null;
let testSessionId = null;
let testAssignmentId = null;

// Test user credentials
const testUsers = {
  client: {
    email: 'testclient@example.com',
    password: 'Test123!',
    firstName: 'Test',
    lastName: 'Client',
    role: 'client',
  },
  therapist: {
    email: 'testtherapist@example.com',
    password: 'Test123!',
    firstName: 'Test',
    lastName: 'Therapist',
    role: 'therapist',
  },
  admin: {
    email: 'admin@example.com',
    password: 'Admin123!',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
  },
};

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

let passedTests = 0;
let failedTests = 0;
let skippedTests = 0;

// Helper function to make API calls
async function apiCall(method, endpoint, data = null, token = null, expectedStatus = 200) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500,
    };
  }
}

// Test runner
async function runTest(name, testFn) {
  process.stdout.write(`\n${colors.cyan}Testing: ${name}${colors.reset}... `);
  try {
    const result = await testFn();
    if (result.success) {
      console.log(`${colors.green}✓ PASSED${colors.reset}`);
      passedTests++;
      return result.data;
    } else {
      console.log(`${colors.red}✗ FAILED${colors.reset}`);
      console.log(`  Error: ${JSON.stringify(result.error)}`);
      failedTests++;
      return null;
    }
  } catch (error) {
    console.log(`${colors.red}✗ FAILED${colors.reset}`);
    console.log(`  Exception: ${error.message}`);
    failedTests++;
    return null;
  }
}

// ============================================
// TEST SUITE
// ============================================

async function testHealthCheck() {
  return await runTest('Health Check', async () => {
    return await apiCall('GET', '/api/health');
  });
}

async function testAuth() {
  console.log(`\n${colors.blue}=== AUTHENTICATION TESTS ===${colors.reset}`);

  // Test Register Client
  await runTest('Register Client', async () => {
    return await apiCall('POST', '/api/auth/register', testUsers.client);
  });

  // Test Register Therapist
  await runTest('Register Therapist', async () => {
    return await apiCall('POST', '/api/auth/register', testUsers.therapist);
  });

  // Test Login Client
  const loginResult = await runTest('Login Client', async () => {
    return await apiCall('POST', '/api/auth/login', {
      email: testUsers.client.email,
      password: testUsers.client.password,
    });
  });
  if (loginResult?.data?.accessToken) {
    authToken = loginResult.data.accessToken;
    testUserId = loginResult.data.user?._id || loginResult.data.user?.id;
  }

  // Test Login Admin
  const adminLoginResult = await runTest('Login Admin', async () => {
    return await apiCall('POST', '/api/auth/login', {
      email: testUsers.admin.email,
      password: testUsers.admin.password,
    });
  });
  if (adminLoginResult?.data?.accessToken) {
    adminToken = adminLoginResult.data.accessToken;
  }

  // Test Get Me
  await runTest('Get Current User', async () => {
    return await apiCall('GET', '/api/auth/me', null, authToken);
  });
}

async function testTherapists() {
  console.log(`\n${colors.blue}=== THERAPIST TESTS ===${colors.reset}`);

  // Get All Therapists
  const therapistsResult = await runTest('Get All Therapists', async () => {
    return await apiCall('GET', '/api/therapists');
  });
  if (therapistsResult?.data?.data?.therapists?.[0]?._id) {
    testTherapistId = therapistsResult.data.data.therapists[0]._id;
  }

  // Get Therapist by ID
  if (testTherapistId) {
    await runTest('Get Therapist by ID', async () => {
      return await apiCall('GET', `/api/therapists/${testTherapistId}`);
    });
  }

  // Get My Therapist Profile
  await runTest('Get My Therapist Profile', async () => {
    return await apiCall('GET', '/api/therapists/me', null, authToken);
  });
}

async function testClients() {
  console.log(`\n${colors.blue}=== CLIENT TESTS ===${colors.reset}`);

  // Get My Client Profile
  const clientResult = await runTest('Get My Client Profile', async () => {
    return await apiCall('GET', '/api/clients/me', null, authToken);
  });
  if (clientResult?.data?.data?._id) {
    testClientId = clientResult.data.data._id;
  }

  // Update Client Profile
  await runTest('Update Client Profile', async () => {
    return await apiCall('POST', '/api/clients', {
      dateOfBirth: '1990-01-01',
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'CA',
        zipCode: '12345',
      },
    }, authToken);
  });
}

async function testSessions() {
  console.log(`\n${colors.blue}=== SESSION TESTS ===${colors.reset}`);

  if (!testClientId || !testTherapistId) {
    console.log(`${colors.yellow}⚠ Skipping session tests - missing IDs${colors.reset}`);
    skippedTests += 5;
    return;
  }

  // Create Session
  const sessionResult = await runTest('Create Session', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return await apiCall('POST', '/api/sessions', {
      clientId: testClientId,
      therapistId: testTherapistId,
      scheduledDate: tomorrow.toISOString().split('T')[0],
      scheduledTime: '10:00 AM',
      duration: 45,
      sessionType: 'follow-up',
      price: 75,
    }, authToken);
  });
  if (sessionResult?.data?.data?._id) {
    testSessionId = sessionResult.data.data._id;
  }

  // Get All Sessions
  await runTest('Get All Sessions', async () => {
    return await apiCall('GET', '/api/sessions', null, authToken);
  });

  // Get Session by ID
  if (testSessionId) {
    await runTest('Get Session by ID', async () => {
      return await apiCall('GET', `/api/sessions/${testSessionId}`, null, authToken);
    });
  }
}

async function testSubscriptions() {
  console.log(`\n${colors.blue}=== SUBSCRIPTION TESTS ===${colors.reset}`);

  // Get Pricing Tiers
  await runTest('Get Pricing Tiers', async () => {
    return await apiCall('GET', '/api/subscriptions/pricing');
  });

  // Get Current Subscription
  await runTest('Get Current Subscription', async () => {
    return await apiCall('GET', '/api/subscriptions/current', null, authToken);
  });
}

async function testAssignments() {
  console.log(`\n${colors.blue}=== ASSIGNMENT TESTS ===${colors.reset}`);

  if (!testClientId || !testTherapistId) {
    console.log(`${colors.yellow}⚠ Skipping assignment tests - missing IDs${colors.reset}`);
    skippedTests += 3;
    return;
  }

  // Get All Assignments
  await runTest('Get All Assignments', async () => {
    return await apiCall('GET', '/api/assignments', null, authToken);
  });

  // Create Assignment (requires therapist token)
  const assignmentResult = await runTest('Create Assignment', async () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    return await apiCall('POST', '/api/assignments', {
      clientId: testClientId,
      title: 'Test Assignment',
      description: 'This is a test assignment',
      dueDate: dueDate.toISOString(),
      instructions: 'Complete the exercises',
    }, authToken);
  });
  if (assignmentResult?.data?.data?._id) {
    testAssignmentId = assignmentResult.data.data._id;
  }
}

async function testResources() {
  console.log(`\n${colors.blue}=== RESOURCE TESTS ===${colors.reset}`);

  // Get All Resources
  await runTest('Get All Resources', async () => {
    return await apiCall('GET', '/api/resources');
  });

  // AI Search Resources
  await runTest('AI Search Resources', async () => {
    return await apiCall('GET', '/api/resources/ai-search?query=articulation%20exercises%20for%20children');
  });
}

async function testTranslation() {
  console.log(`\n${colors.blue}=== TRANSLATION TESTS ===${colors.reset}`);

  // Get Supported Languages
  await runTest('Get Supported Languages', async () => {
    return await apiCall('GET', '/api/translation/languages');
  });

  // Get Language Preferences
  await runTest('Get Language Preferences', async () => {
    return await apiCall('GET', '/api/translation/preferences', null, authToken);
  });
}

async function testCalendar() {
  console.log(`\n${colors.blue}=== CALENDAR TESTS ===${colors.reset}`);

  // Get Calendar Status
  await runTest('Get Calendar Status', async () => {
    return await apiCall('GET', '/api/calendar/status', null, authToken);
  });

  // Get Calendar Event URL
  if (testSessionId) {
    await runTest('Get Calendar Event URL', async () => {
      return await apiCall('GET', `/api/calendar/event-url/${testSessionId}`, null, authToken);
    });
  }
}

async function testForum() {
  console.log(`\n${colors.blue}=== FORUM TESTS ===${colors.reset}`);

  // Get Forum Posts
  await runTest('Get Forum Posts', async () => {
    return await apiCall('GET', '/api/forum/posts');
  });

  // Create Forum Post
  const postResult = await runTest('Create Forum Post', async () => {
    return await apiCall('POST', '/api/forum/posts', {
      title: 'Test Forum Post',
      content: 'This is a test forum post',
      category: 'general',
    }, authToken);
  });
}

async function testMessages() {
  console.log(`\n${colors.blue}=== MESSAGE TESTS ===${colors.reset}`);

  // Get Conversations
  await runTest('Get Conversations', async () => {
    return await apiCall('GET', '/api/messages/conversations', null, authToken);
  });
}

async function testAdmin() {
  console.log(`\n${colors.blue}=== ADMIN TESTS ===${colors.reset}`);

  if (!adminToken) {
    console.log(`${colors.yellow}⚠ Skipping admin tests - no admin token${colors.reset}`);
    skippedTests += 5;
    return;
  }

  // Get All Users
  await runTest('Get All Users (Admin)', async () => {
    return await apiCall('GET', '/api/admin/users', null, adminToken);
  });

  // Get All Therapists (Admin)
  await runTest('Get All Therapists (Admin)', async () => {
    return await apiCall('GET', '/api/admin/therapists', null, adminToken);
  });

  // Get All Clients (Admin)
  await runTest('Get All Clients (Admin)', async () => {
    return await apiCall('GET', '/api/admin/clients', null, adminToken);
  });

  // Get Dashboard Stats
  await runTest('Get Dashboard Stats', async () => {
    return await apiCall('GET', '/api/admin/stats', null, adminToken);
  });

  // Get Pricing Tiers (Admin)
  await runTest('Get Pricing Tiers (Admin)', async () => {
    return await apiCall('GET', '/api/admin/pricing', null, adminToken);
  });
}

// Main test runner
async function runAllTests() {
  console.log(`\n${colors.blue}╔══════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║     ROOTED VOICES API TEST SUITE                              ║${colors.reset}`);
  console.log(`${colors.blue}╚══════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\nTesting API at: ${BASE_URL}\n`);

  try {
    // Health check first
    await testHealthCheck();

    // Run all test suites
    await testAuth();
    await testTherapists();
    await testClients();
    await testSessions();
    await testSubscriptions();
    await testAssignments();
    await testResources();
    await testTranslation();
    await testCalendar();
    await testForum();
    await testMessages();
    await testAdmin();

    // Print summary
    console.log(`\n${colors.blue}╔══════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.blue}║                    TEST SUMMARY                                ║${colors.reset}`);
    console.log(`${colors.blue}╚══════════════════════════════════════════════════════════════╝${colors.reset}`);
    console.log(`\n${colors.green}✓ Passed: ${passedTests}${colors.reset}`);
    console.log(`${colors.red}✗ Failed: ${failedTests}${colors.reset}`);
    console.log(`${colors.yellow}⚠ Skipped: ${skippedTests}${colors.reset}`);
    console.log(`\nTotal Tests: ${passedTests + failedTests + skippedTests}`);
    console.log(`Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%\n`);

    if (failedTests === 0) {
      console.log(`${colors.green}🎉 All tests passed!${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(`${colors.red}❌ Some tests failed. Please review the errors above.${colors.reset}\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run tests
runAllTests();

