// test-routes-debug.js - Debug Routes API Issue
const axios = require('axios');

const BASE_URL = 'http://3.7.6.250';

async function testRoutes() {
  console.log('\n🔍 DEBUGGING ROUTES API\n');
  console.log('='.repeat(60));
  
  // Test 1: Direct routes endpoint
  console.log('\n📍 Test 1: GET /api/routes');
  try {
    const response = await axios.get(`${BASE_URL}/api/routes`, {
      timeout: 30000
    });
    console.log('✅ Status:', response.status);
    console.log('📋 Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.response?.data || error.message);
    console.log('📋 Full error:', error.toJSON());
  }
  
  // Test 2: Routes search with params
  console.log('\n📍 Test 2: GET /api/routes/search?from=Mumbai&to=Pune');
  try {
    const response = await axios.get(`${BASE_URL}/api/routes/search`, {
      params: { from: 'Mumbai', to: 'Pune' },
      timeout: 30000
    });
    console.log('✅ Status:', response.status);
    console.log('📋 Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.response?.data || error.message);
    console.log('📋 Full error:', error.toJSON());
  }
  
  // Test 3: Routes without params
  console.log('\n📍 Test 3: GET /routes/search (no API prefix)');
  try {
    const response = await axios.get(`${BASE_URL}/routes/search`, {
      params: { from: 'Mumbai', to: 'Pune' },
      timeout: 30000
    });
    console.log('✅ Status:', response.status);
    console.log('📋 Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.response?.data || error.message);
  }
  
  // Test 4: Get stops for a route
  console.log('\n📍 Test 4: GET /api/routes/:id/stops');
  try {
    // First get a route
    const routesResponse = await axios.get(`${BASE_URL}/api/routes/search`, {
      params: { from: 'Mumbai', to: 'Pune' },
      timeout: 30000
    });
    
    if (routesResponse.data?.data?.[0]?.id) {
      const routeId = routesResponse.data.data[0].id;
      console.log(`   Using route ID: ${routeId}`);
      
      const stopsResponse = await axios.get(`${BASE_URL}/api/routes/${routeId}/stops`, {
        timeout: 30000
      });
      console.log('✅ Status:', stopsResponse.status);
      console.log('📋 Stops data:', JSON.stringify(stopsResponse.data, null, 2));
    } else {
      console.log('⚠️  No route found to test stops');
    }
  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.response?.data || error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n💡 DIAGNOSTICS:\n');
  console.log('If you see errors above, the issue could be:');
  console.log('1. Database connection to Supabase');
  console.log('2. Routes table missing or empty');
  console.log('3. API endpoint routing issue');
  console.log('4. CORS or network issue');
  console.log('\nCheck Render logs at: https://dashboard.render.com/logs');
  console.log('');
}

testRoutes().catch(console.error);
