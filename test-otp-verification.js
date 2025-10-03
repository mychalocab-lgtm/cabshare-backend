// test-otp-verification.js - Test OTP verification after receiving SMS
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

// Get OTP from command line argument
const OTP = process.argv[2];

if (!OTP) {
  console.error('❌ ERROR: Please provide OTP as argument');
  console.log('   Usage: node test-otp-verification.js <OTP>');
  console.log('   Example: node test-otp-verification.js 123456');
  process.exit(1);
}

console.log('\n==============================================');
console.log('🔐 MSG91 OTP VERIFICATION TEST');
console.log('==============================================\n');

async function testOtpVerification() {
  try {
    // Load widget session data
    if (!fs.existsSync('.widget-test-data.json')) {
      console.error('❌ ERROR: Widget session data not found!');
      console.log('   Please run test-msg91-CORRECTED.js first');
      process.exit(1);
    }

    const { widgetId, authKey, mobile } = JSON.parse(
      fs.readFileSync('.widget-test-data.json', 'utf8')
    );

    console.log('📋 Verification Details:');
    console.log('   Widget ID:', widgetId);
    console.log('   Mobile:', mobile);
    console.log('   OTP:', OTP);
    console.log('');

    // Step 1: Verify OTP with MSG91
    console.log('📤 STEP 1: Verifying OTP with MSG91');
    const verifyResponse = await axios.post(
      'https://control.msg91.com/api/v5/widget/otp/verify',
      {
        widgetId: widgetId,
        identifier: mobile,
        otp: OTP,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'authkey': authKey,
        },
      }
    );

    console.log('✅ OTP VERIFIED WITH MSG91!');
    console.log('   Response:', JSON.stringify(verifyResponse.data, null, 2));
    console.log('');

    // Extract token from MSG91 response
    const token = verifyResponse.data.data?.token || verifyResponse.data.token;
    
    if (!token) {
      console.error('❌ ERROR: No token received from MSG91');
      console.log('   Response:', JSON.stringify(verifyResponse.data, null, 2));
      process.exit(1);
    }

    console.log('🎫 Token received:', token.substring(0, 20) + '...');
    console.log('');

    // Step 2: Send token to your backend for authentication
    console.log('📤 STEP 2: Authenticating with Your Backend');
    const authResponse = await axios.post('http://localhost:3000/api/auth/widget/verify', {
      widgetId: widgetId,
      token: token,
      fullName: 'Test User' // Required for new users
    });

    console.log('✅ AUTHENTICATION SUCCESSFUL!');
    console.log('   Response:', JSON.stringify(authResponse.data, null, 2));
    console.log('');

    console.log('==============================================');
    console.log('🎉 COMPLETE SUCCESS!');
    console.log('==============================================\n');

    console.log('MSG91 Widget OTP integration is working correctly!');
    console.log('');
    console.log('Next Steps:');
    console.log('1. Integrate MSG91 Widget SDK in your Flutter app');
    console.log('2. Follow the flow demonstrated in this test');
    console.log('3. Your backend endpoints are ready:');
    console.log('   - POST /api/auth/widget/init');
    console.log('   - POST /api/auth/widget/verify');
    console.log('');

    // Clean up
    fs.unlinkSync('.widget-test-data.json');

  } catch (error) {
    console.error('❌ VERIFICATION FAILED');
    console.error('   Status:', error.response?.status);
    console.error('   Error:', JSON.stringify(error.response?.data || error.message, null, 2));
    console.error('');
    
    if (error.response?.status === 400) {
      console.log('💡 TROUBLESHOOTING:');
      console.log('   1. OTP might be incorrect');
      console.log('   2. OTP might have expired (usually 5 minutes)');
      console.log('   3. Try requesting a new OTP');
      console.log('');
    }

    process.exit(1);
  }
}

testOtpVerification();
