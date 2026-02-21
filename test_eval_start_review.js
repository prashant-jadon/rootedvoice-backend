const axios = require('axios');

async function testStartReview() {
  try {
    console.log('Logging in as therapist...');
    const loginRes = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'therapisttest@gmail.com',
      password: 'password123'
    });
    
    const token = loginRes.data.token;
    
    const evalsRes = await axios.get('http://localhost:5001/api/evaluations/my-assignments', {
      headers: { Authorization: `Bearer ${token}` }
    });

    const evalId = evalsRes.data.data[0]._id;
    console.log(`Trying to start review for evaluation: ${evalId}`);

    const startRes = await axios.post(`http://localhost:5001/api/evaluations/${evalId}/start-review`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Success:', startRes.data);
  } catch (error) {
    if (error.response) {
      console.log('API Error:', error.response.status, error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

testStartReview();
