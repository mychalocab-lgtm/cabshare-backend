// services/msg91Service.js - MSG91 Widget Service with Correct Authentication
const axios = require('axios');

class MSG91Service {
  constructor() {
    // Get credentials from environment
    this.authKey = process.env.MSG91_AUTH_KEY; // Your Auth Key
    this.widgetId = process.env.MSG91_WIDGET_ID; // Your Widget ID
    
    // Validate credentials
    if (!this.authKey || !this.widgetId) {
      console.error('❌ MSG91 credentials missing!');
      console.error('MSG91_AUTH_KEY:', this.authKey ? 'SET' : 'MISSING');
      console.error('MSG91_WIDGET_ID:', this.widgetId ? 'SET' : 'MISSING');
      throw new Error('MSG91 credentials not configured');
    }

    console.log('========================================');
    console.log('✅ MSG91 Widget Service Initialized');
    console.log('========================================');
    console.log('Auth Key:', this.authKey.substring(0, 15) + '...');
    console.log('Widget ID:', this.widgetId);
    console.log('========================================\n');
  }

  /**
   * Verify MSG91 Widget Access Token
   * Called after Flutter app successfully verifies OTP with MSG91 Widget
   * 
   * @param {string} accessToken - The access token from MSG91 widget
   * @returns {Promise<Object>} Verification result with phone number
   */
  async verifyWidgetToken(accessToken) {
    try {
      console.log('\n========================================');
      console.log('🔐 VERIFYING MSG91 WIDGET TOKEN');
      console.log('========================================');
      console.log('Access Token Length:', accessToken ? accessToken.length : 0);
      console.log('Access Token Preview:', accessToken ? `${accessToken.substring(0, 30)}...` : 'MISSING');

      // Validate input
      if (!accessToken || accessToken === 'test') {
        throw new Error('Invalid or test access token provided');
      }

      // MSG91 Widget Verification Endpoint
      const verificationUrl = 'https://control.msg91.com/api/v5/widget/verifyAccessToken';

      const response = await axios.post(
        verificationUrl,
        {
          authkey: this.authKey,
          'access-token': accessToken
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000 // 10 second timeout
        }
      );

      console.log('📨 MSG91 API Response Status:', response.status);
      console.log('📨 MSG91 API Response Data:', JSON.stringify(response.data, null, 2));

      // Check response
      if (response.data && response.data.type === 'success') {
        // Extract phone number from response
        // MSG91 may return it as 'mobile' or 'identifier'
        const phoneNumber = response.data.mobile || response.data.identifier || response.data.phone;

        if (!phoneNumber) {
          console.error('❌ No phone number in successful response:', response.data);
          throw new Error('Phone number not found in verification response');
        }

        console.log('✅ Token Verified Successfully');
        console.log('📱 Phone Number:', phoneNumber);
        console.log('========================================\n');

        return {
          success: true,
          phone: phoneNumber,
          data: response.data,
        };
      } else {
        console.error('❌ MSG91 Verification Failed');
        console.error('Response:', response.data);
        console.error('========================================\n');

        return {
          success: false,
          message: response.data.message || 'Token verification failed',
          code: response.data.code,
        };
      }
    } catch (error) {
      console.error('\n========================================');
      console.error('❌ MSG91 TOKEN VERIFICATION ERROR');
      console.error('========================================');
      console.error('Error Message:', error.message);

      if (error.response) {
        console.error('Response Status:', error.response.status);
        console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        console.error('No Response Received');
        console.error('Request:', error.request);
      }

      console.error('========================================\n');

      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Token verification failed',
        error: error.message,
      };
    }
  }
}

// Export singleton instance
const msg91Service = new MSG91Service();
module.exports = msg91Service;
