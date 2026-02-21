const axios = require('axios');

async function testTherapistEvals() {
  try {
    console.log('Logging in as therapist...');
    // Replace with a known therapist email and password if needed
    const loginRes = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'therapist@demo.com', // fallback credentials or try typical ones
      password: 'password123'
    });
    
    const token = loginRes.data.token;
    console.log('Login successful. Token:', token ? 'Exists' : 'Missing');

    const evalsRes = await axios.get('http://localhost:5001/api/evaluations/my-assignments', {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Evaluations count:', evalsRes.data.data.length);
    if(evalsRes.data.data.length > 0) {
      console.log('Sample evaluation status:', evalsRes.data.data[0].status);
    }
  } catch (error) {
    if (error.response) {
      console.log('API Error:', error.response.status, error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

testTherapistEvals();
