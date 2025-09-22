// Simple test script to verify the signup API works
const fetch = require('node-fetch');

async function testSignup() {
  try {
    const response = await fetch('http://localhost:3000/api/merchants/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        business_email: 'test@example.com',
        clerk_user_id: 'test_user_123',
        pin: '123456',
      }),
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('✅ Signup API test passed!');
    } else {
      console.log('❌ Signup API test failed');
    }
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testSignup();