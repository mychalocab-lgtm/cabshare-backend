// test-production.js - Test Production Backend on Render.com
const axios = require('axios');

// Configuration
const BASE_URL = 'http://3.7.6.250';
const LOCAL_URL = 'http://localhost:3000';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function separator() {
  console.log('\n' + '='.repeat(60) + '\n');
}

// Test function with retry logic
async function testEndpoint(name, method, endpoint, data = null, headers = {}, retries = 3) {
  log(`\n🧪 Testing: ${name}`, 'cyan');
  log(`   Method: ${method} ${endpoint}`, 'blue');
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const config = {
        method,
        url: `${BASE_URL}${endpoint}`,
        headers,
        timeout: 30000, // 30 second timeout for cold starts
      };
      
      if (data) {
        config.data = data;
      }
      
      log(`   Attempt ${attempt}/${retries}...`, 'yellow');
      const startTime = Date.now();
      
      const response = await axios(config);
      const duration = Date.now() - startTime;
      
      log(`   ✅ SUCCESS (${duration}ms)`, 'green');
      log(`   Status: ${response.status}`, 'green');
      
      // Show response data (truncated if too long)
      const dataStr = JSON.stringify(response.data, null, 2);
      if (dataStr.length > 500) {
        log(`   Response: ${dataStr.substring(0, 500)}...`, 'green');
      } else {
        log(`   Response: ${dataStr}`, 'green');
      }
      
      return { success: true, data: response.data, duration };
      
    } catch (error) {
      const duration = Date.now();
      
      if (attempt < retries) {
        log(`   ⚠️  Failed, retrying in 2 seconds...`, 'yellow');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        log(`   ❌ FAILED after ${retries} attempts`, 'red');
        if (error.response) {
          log(`   Status: ${error.response.status}`, 'red');
          log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
        } else if (error.code === 'ECONNABORTED') {
          log(`   Error: Request timeout (server might be starting up)`, 'red');
        } else {
          log(`   Error: ${error.message}`, 'red');
        }
        
        return { success: false, error: error.message };
      }
    }
  }
}

// Main test suite
async function runTests() {
  log('\n🚀 CHALOCAB BACKEND PRODUCTION TESTS', 'cyan');
  log(`📍 Testing: ${BASE_URL}`, 'blue');
  separator();
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };
  
  // Test 1: Health Check
  separator();
  const health = await testEndpoint(
    'Health Check',
    'GET',
    '/health'
  );
  results.total++;
  if (health.success) results.passed++; else results.failed++;
  results.tests.push({ name: 'Health Check', ...health });
  
  // Test 2: Root endpoint
  separator();
  const root = await testEndpoint(
    'Root Endpoint',
    'GET',
    '/'
  );
  results.total++;
  if (root.success) results.passed++; else results.failed++;
  results.tests.push({ name: 'Root Endpoint', ...root });
  
  // Test 3: Cities endpoint (public)
  separator();
  const cities = await testEndpoint(
    'Cities List (Public)',
    'GET',
    '/api/cities'
  );
  results.total++;
  if (cities.success) results.passed++; else results.failed++;
  results.tests.push({ name: 'Cities List', ...cities });
  
  // Test 4: Routes endpoint (public)
  separator();
  const routes = await testEndpoint(
    'Routes Search (Public)',
    'GET',
    '/api/routes?from=Mumbai&to=Pune'
  );
  results.total++;
  if (routes.success) results.passed++; else results.failed++;
  results.tests.push({ name: 'Routes Search', ...routes });
  
  // Test 5: Rides search (public)
  separator();
  const rides = await testEndpoint(
    'Rides Search (Public)',
    'GET',
    '/api/rides/search?from=Mumbai&to=Pune'
  );
  results.total++;
  if (rides.success) results.passed++; else results.failed++;
  results.tests.push({ name: 'Rides Search', ...rides });
  
  // Test 6: Profile endpoint (should fail without auth - expected)
  separator();
  const profile = await testEndpoint(
    'Profile Endpoint (Should Fail - No Auth)',
    'GET',
    '/api/profile/me',
    null,
    {},
    1  // Only try once since we expect it to fail
  );
  results.total++;
  // This should fail - that's correct behavior
  if (!profile.success && profile.error.includes('401')) {
    log('   ℹ️  Correctly rejected (no authentication)', 'yellow');
    results.passed++;
  } else {
    results.failed++;
  }
  results.tests.push({ name: 'Profile Auth Check', ...profile });
  
  // Test 7: MSG91 Widget Verification (mock test - requires actual phone)
  separator();
  log('   ℹ️  MSG91 widget test requires actual phone OTP', 'yellow');
  log('   ⏭️  Skipping (manual test required)', 'yellow');
  
  // Summary
  separator();
  log('\n📊 TEST SUMMARY', 'cyan');
  log(`   Total Tests: ${results.total}`, 'blue');
  log(`   ✅ Passed: ${results.passed}`, 'green');
  log(`   ❌ Failed: ${results.failed}`, 'red');
  log(`   Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`, 
      results.passed === results.total ? 'green' : 'yellow');
  
  // Detailed results
  separator();
  log('\n📋 DETAILED RESULTS:', 'cyan');
  results.tests.forEach((test, index) => {
    const icon = test.success ? '✅' : '❌';
    const color = test.success ? 'green' : 'red';
    const duration = test.duration ? ` (${test.duration}ms)` : '';
    log(`   ${icon} ${index + 1}. ${test.name}${duration}`, color);
  });
  
  // Recommendations
  separator();
  log('\n💡 RECOMMENDATIONS:', 'cyan');
  
  if (results.failed > 0) {
    log('   ⚠️  Some tests failed. Please check:', 'yellow');
    log('   1. Render.com environment variables are set correctly', 'yellow');
    log('   2. JWT_SECRET matches your local .env file', 'yellow');
    log('   3. Database connection is working', 'yellow');
    log('   4. Service is fully deployed (check Render dashboard)', 'yellow');
  } else {
    log('   ✅ All tests passed! Backend is working correctly.', 'green');
    log('   ✅ Environment variables are configured properly.', 'green');
    log('   ✅ Database connection is working.', 'green');
    log('   ℹ️  You can now test the mobile app.', 'blue');
  }
  
  separator();
  log('\n🔍 NEXT STEPS:', 'cyan');
  log('   1. If tests failed: Check Render.com environment variables', 'blue');
  log('   2. If tests passed: Test mobile app login & data loading', 'blue');
  log('   3. Monitor Render logs: https://dashboard.render.com/logs', 'blue');
  log('   4. If still issues: Try AWS Lightsail migration', 'blue');
  separator();
}

// Run the tests
log('\n⏳ Starting tests... (First request may take 30+ seconds if server is cold)\n', 'yellow');
runTests()
  .then(() => {
    log('\n✅ Test suite completed!', 'green');
    process.exit(0);
  })
  .catch((error) => {
    log(`\n❌ Test suite failed: ${error.message}`, 'red');
    process.exit(1);
  });
