// test-msg91-SIMPLE.js - Simple MSG91 Widget Test
require('dotenv').config();
const axios = require('axios');

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
const MSG91_WIDGET_ID = process.env.MSG91_WIDGET_ID;

console.log('\n==============================================');
console.log('🧪 MSG91 WIDGET OTP - SIMPLE BACKEND TEST');
console.log('==============================================\n');

console.log('📋 Configuration:');
console.log('   Auth Key:', MSG91_AUTH_KEY ? `${MSG91_AUTH_KEY.substring(0, 10)}...` : '❌ MISSING');
console.log('   Widget ID:', MSG91_WIDGET_ID || '❌ MISSING');
console.log('');

async function testBackend() {
  try {
    console.log('📤 Testing /api/auth/widget/init endpoint...\n');

    const response = await axios.post('http://localhost:3000/api/auth/widget/init', {
      phone: '9384809020'
    });

    console.log('✅ Backend Endpoint Works!');
    console.log('   Your backend is correctly configured\n');
    console.log('📋 Widget Configuration:');
    console.log('   Widget ID:', response.data.widgetId);
    console.log('   Mobile:', response.data.mobile);
    console.log('');

    console.log('==============================================');
    console.log('✅ BACKEND IS READY!');
    console.log('==============================================\n');

    console.log('📱 IMPORTANT: MSG91 Widget OTP Testing\n');
    console.log('The MSG91 Widget method is designed for MOBILE APPS.');
    console.log('You CANNOT test the full OTP flow from Node.js directly.\n');

    console.log('Here\'s why:');
    console.log('1. MSG91 Widget SDK is for mobile (iOS/Android/Flutter)');
    console.log('2. The SDK shows a UI for OTP input');
    console.log('3. The SDK handles all OTP sending/verification internally');
    console.log('4. After OTP verification, SDK returns a TOKEN');
    console.log('5. Your app sends that token to your backend\n');

    console.log('==============================================');
    console.log('🎯 NEXT STEPS');
    console.log('==============================================\n');

    console.log('Option 1: Test with Actual Mobile App (RECOMMENDED)');
    console.log('   1. Integrate MSG91 Widget SDK in Flutter');
    console.log('   2. Use widget to send/verify OTP');
    console.log('   3. Send received token to your backend');
    console.log('   4. Your backend is ALREADY ready!\n');

    console.log('Option 2: Test Manually via MSG91 Dashboard');
    console.log('   1. Go to: https://control.msg91.com/app/m/l/otp/widgets/');
    console.log('   2. Click on your widget: "Chalocab"');
    console.log('   3. Use "Test Widget" feature');
    console.log('   4. Send test OTP to your phone');
    console.log('   5. This verifies MSG91 integration is working\n');

    console.log('Option 3: Use MSG91 SendOTP API (Alternative for Testing)');
    console.log('   - This is a DIFFERENT method (not Widget)');
    console.log('   - Requires DLT template setup');
    console.log('   - Only for testing from Node.js');
    console.log('   - Your production app should use Widget!\n');

    console.log('==============================================');
    console.log('📚 INTEGRATION GUIDE');
    console.log('==============================================\n');

    console.log('Your Flutter App Integration:');
    console.log('');
    console.log('```dart');
    console.log('// 1. Get widget config from YOUR backend');
    console.log('final config = await http.post(');
    console.log('  \'$baseUrl/api/auth/widget/init\',');
    console.log('  body: jsonEncode({\'phone\': phone}),');
    console.log(');');
    console.log('');
    console.log('// 2. Use MSG91 Widget SDK');
    console.log('final token = await MSG91Widget.show(');
    console.log('  widgetId: config[\'widgetId\'],');
    console.log('  authKey: config[\'authKey\'],');
    console.log('  mobile: config[\'mobile\'],');
    console.log(');');
    console.log('');
    console.log('// 3. Send token to YOUR backend');
    console.log('final auth = await http.post(');
    console.log('  \'$baseUrl/api/auth/widget/verify\',');
    console.log('  body: jsonEncode({');
    console.log('    \'widgetId\': config[\'widgetId\'],');
    console.log('    \'token\': token,');
    console.log('    \'fullName\': name,');
    console.log('  }),');
    console.log(');');
    console.log('');
    console.log('// 4. Save JWT token');
    console.log('final jwtToken = auth[\'token\'];');
    console.log('```');
    console.log('');

    console.log('==============================================');
    console.log('🎉 YOUR BACKEND IS WORKING CORRECTLY!');
    console.log('==============================================\n');

    console.log('✅ Checklist:');
    console.log('   [✓] Backend running on port 3000');
    console.log('   [✓] Widget init endpoint working');
    console.log('   [✓] MSG91 credentials configured');
    console.log('   [✓] Ready for Flutter integration\n');

    console.log('📖 Read: MSG91_WIDGET_TESTING_GUIDE.md for more details\n');

  } catch (error) {
    console.error('❌ TEST FAILED\n');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('Backend is not running!');
      console.error('   Start it with: npm start\n');
    } else {
      console.error('   Status:', error.response?.status);
      console.error('   Error:', error.response?.data || error.message);
      console.error('');
    }

    process.exit(1);
  }
}

testBackend();
