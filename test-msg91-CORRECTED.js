// test-msg91-CORRECTED.js - Testing MSG91 Widget OTP (CORRECT METHOD - FINAL FIX)
require('dotenv').config();
const axios = require('axios');

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
const MSG91_WIDGET_ID = process.env.MSG91_WIDGET_ID;

console.log('\n==============================================');
console.log('🧪 MSG91 WIDGET OTP INTEGRATION TEST (CORRECT METHOD)');
console.log('==============================================\n');

// Test Configuration
console.log('📋 Configuration:');
console.log('   Auth Key:', MSG91_AUTH_KEY ? `${MSG91_AUTH_KEY.substring(0, 10)}...` : '❌ MISSING');
console.log('   Widget ID:', MSG91_WIDGET_ID || '❌ MISSING');
console.log('');

if (!MSG91_AUTH_KEY || !MSG91_WIDGET_ID) {
  console.error('❌ ERROR: Missing MSG91 credentials in .env file!');
  console.log('   Please check your .env file has:');
  console.log('   MSG91_AUTH_KEY=...');
  console.log('   MSG91_WIDGET_ID=...');
  process.exit(1);
}

// Test phone number
const TEST_PHONE = '919384809020'; // Must include country code (91 for India)

console.log('📱 Testing with phone:', TEST_PHONE);
console.log('');

console.log('==============================================');
console.log('✅ WIDGET METHOD TEST');
console.log('==============================================\n');

console.log('📖 HOW WIDGET OTP WORKS:\n');
console.log('1. CLIENT gets widget configuration from YOUR backend');
console.log('   POST /api/auth/widget/init');
console.log('   Body: { phone: "9384809020" }');
console.log('   Response: { widgetId, authKey, mobile }\n');

console.log('2. CLIENT uses MSG91 Widget SDK to send OTP');
console.log('   The MSG91 Widget handles OTP sending & verification');
console.log('   Client receives a TOKEN after successful OTP entry\n');

console.log('3. CLIENT sends token to YOUR backend for verification');
console.log('   POST /api/auth/widget/verify');
console.log('   Body: { widgetId, token, fullName? }');
console.log('   YOUR BACKEND verifies token with MSG91 API\n');

console.log('==============================================');
console.log('🔧 BACKEND TESTING FLOW');
console.log('==============================================\n');

async function testBackendFlow() {
  try {
    // STEP 1: Initialize widget session (simulate client request)
    console.log('📤 STEP 1: Initializing Widget Session');
    console.log('   Endpoint: POST /api/auth/widget/init');
    console.log('   This simulates what your Flutter app will call\n');

    const initResponse = await axios.post('http://localhost:3000/api/auth/widget/init', {
      phone: '9384809020'
    });

    console.log('✅ SUCCESS: Widget initialized');
    console.log('   Response:', JSON.stringify(initResponse.data, null, 2));
    console.log('');

    const { widgetId, authKey, mobile } = initResponse.data;

    // STEP 2: Send OTP directly via MSG91 Widget API
    console.log('📤 STEP 2: Sending OTP via MSG91 Widget API');
    console.log('   🔗 CORRECT Endpoint: https://control.msg91.com/api/v5/widget/otp/send');
    console.log('   This simulates what MSG91 SDK does on client side\n');

    const sendOtpResponse = await axios.post(
      'https://control.msg91.com/api/v5/widget/otp/send', // ✅ CORRECT ENDPOINT
      {
        widgetId: widgetId,
        identifier: mobile,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'authkey': authKey,
        },
      }
    );

    console.log('✅ OTP SENT SUCCESSFULLY!');
    console.log('   Response:', JSON.stringify(sendOtpResponse.data, null, 2));
    console.log('');
    console.log('📱 Check phone', TEST_PHONE, 'for OTP SMS!');
    console.log('');

    console.log('==============================================');
    console.log('⏸️  WAITING FOR YOUR INPUT');
    console.log('==============================================\n');

    console.log('Next Steps:');
    console.log('1. Check your phone for the OTP SMS');
    console.log('2. Copy the OTP you received');
    console.log('3. Run: node test-otp-verification.js <OTP>');
    console.log('   Example: node test-otp-verification.js 123456');
    console.log('');

    // Save widget info for verification script
    require('fs').writeFileSync('.widget-test-data.json', JSON.stringify({
      widgetId,
      authKey,
      mobile
    }, null, 2));

    console.log('💾 Widget session data saved to .widget-test-data.json');
    console.log('');

  } catch (error) {
    console.error('❌ TEST FAILED');
    console.error('   Status:', error.response?.status);
    console.error('   Error Data:', JSON.stringify(error.response?.data || error.message, null, 2));
    
    if (error.code) {
      console.error('   Error Code:', error.code);
    }
    
    console.error('');
    
    if (error.response?.status === 400) {
      console.log('💡 TROUBLESHOOTING FOR 400 ERROR:');
      console.log('   1. Verify Widget ID is correct in .env');
      console.log('   2. Verify Auth Key is correct in .env');
      console.log('   3. Check if widget is ACTIVE in MSG91 dashboard');
      console.log('   4. Ensure you have SMS credits in your account');
      console.log('   5. Phone number format should be: 919384809020 (country code + number)');
      console.log('');
      console.log('📍 Check your MSG91 dashboard:');
      console.log('   https://control.msg91.com/app/m/l/otp/widgets/');
      console.log('');
    } else if (error.response?.status === 401) {
      console.log('💡 TROUBLESHOOTING FOR 401 ERROR:');
      console.log('   1. Auth Key is invalid or expired');
      console.log('   2. Get new Auth Key from MSG91 dashboard');
      console.log('   3. Update .env file with correct MSG91_AUTH_KEY');
      console.log('');
    } else if (error.response?.status === 404) {
      console.log('💡 TROUBLESHOOTING FOR 404 ERROR:');
      console.log('   1. Widget ID is incorrect');
      console.log('   2. Widget might have been deleted');
      console.log('   3. Get correct Widget ID from MSG91 dashboard');
      console.log('   4. Update .env file with correct MSG91_WIDGET_ID');
      console.log('');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('💡 TROUBLESHOOTING:');
      console.log('   1. Make sure your backend is running: npm start');
      console.log('   2. Check if port 3000 is available');
      console.log('');
    }
    
    console.log('📞 MSG91 Support:');
    console.log('   Dashboard: https://control.msg91.com');
    console.log('   Docs: https://docs.msg91.com/p/tf9GTextN/e/ROKxNyXGm/MSG91-Widget-APIs');
    console.log('');

    process.exit(1);
  }
}

// Run test
testBackendFlow();
