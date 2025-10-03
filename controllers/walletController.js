const { supabase } = require('../supabase');
const { v4: uuidv4 } = require('uuid');

class WalletController {
  
  // Get wallet balance
  async getWalletBalance(req, res) {
    try {
      const userId = req.user?.id || req.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found'
        });
      }

      const { data, error } = await supabase
        .from('wallets')
        .select('balance_available_inr')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Get wallet balance error:', error);
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      const balance = data ? data.balance_available_inr : 0;

      res.json({
        success: true,
        balance: {
          available: balance
        }
      });

    } catch (error) {
      console.error('Get wallet balance error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get wallet details
  async getWalletDetails(req, res) {
    try {
      const userId = req.user?.id || req.userId;
      console.log('💰 Getting wallet for user:', userId);
      
      if (!userId) {
        console.error('❌ No user ID for wallet');
        return res.status(401).json({
          success: false,
          message: 'User ID not found'
        });
      }

      console.log('📊 Querying wallets table...');
      let { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();

      console.log('📊 Wallet query result:', { data, error });

      if (error && error.code === 'PGRST116') {
        // Create wallet if it doesn't exist
        console.log('🆕 Creating new wallet...');
        const { data: newWallet, error: createError } = await supabase
          .from('wallets')
          .insert({
            user_id: userId,
            balance_available_inr: 0,
            balance_reserved_inr: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ Create wallet error:', createError);
          return res.status(400).json({
            success: false,
            message: 'Failed to create wallet: ' + createError.message
          });
        }

        console.log('✅ Wallet created:', newWallet);
        data = newWallet;
      } else if (error) {
        console.error('❌ Get wallet details error:', error);
        return res.status(400).json({
          success: false,
          message: 'Failed to fetch wallet: ' + error.message
        });
      }

      console.log('✅ Returning wallet data:', data);
      
      // Return in exact format expected by Flutter app
      const walletResponse = {
        success: true,
        wallet: {
          id: data.id,
          user_id: data.user_id,
          balance_available_inr: data.balance_available_inr || 0,
          balance_reserved_inr: data.balance_reserved_inr || 0,
          created_at: data.created_at,
          updated_at: data.updated_at
        }
      };
      
      console.log('📤 Sending wallet response:', JSON.stringify(walletResponse));
      res.json(walletResponse);

    } catch (error) {
      console.error('❌ Get wallet details exception:', error);
      console.error('❌ Error stack:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Internal server error: ' + error.message
      });
    }
  }

  // Create deposit intent
  async createDepositIntent(req, res) {
    try {
      const { amount, method = 'razorpay' } = req.body;
      const userId = req.user?.id || req.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found'
        });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid amount'
        });
      }

      // For now, we'll create a mock Razorpay order
      // In production, you would integrate with actual Razorpay API
      const mockOrderId = `order_${Date.now()}`;

      const { data, error } = await supabase
        .from('deposit_intents')
        .insert({
          user_id: userId,
          amount_inr: Math.round(amount),
          method: method,
          razorpay_order_id: mockOrderId,
          status: 'created'
        })
        .select()
        .single();

      if (error) {
        console.error('Create deposit intent error:', error);
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.json({
        success: true,
        intent: data
      });

    } catch (error) {
      console.error('Create deposit intent error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Verify payment and update wallet
  async verifyPayment(req, res) {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      } = req.body;
      const userId = req.user?.id || req.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found'
        });
      }

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: 'Missing payment verification data'
        });
      }

      // Get deposit intent
      const { data: intent, error: intentError } = await supabase
        .from('deposit_intents')
        .select('*')
        .eq('razorpay_order_id', razorpay_order_id)
        .eq('user_id', userId)
        .single();

      if (intentError || !intent) {
        return res.status(404).json({
          success: false,
          message: 'Deposit intent not found'
        });
      }

      if (intent.status !== 'created') {
        return res.status(400).json({
          success: false,
          message: 'Payment already processed'
        });
      }

      // In production, verify signature with Razorpay
      // For now, we'll simulate successful verification
      const isSignatureValid = true;

      if (!isSignatureValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment signature'
        });
      }

      // Update deposit intent
      await supabase
        .from('deposit_intents')
        .update({
          status: 'paid',
          razorpay_payment_id: razorpay_payment_id,
          razorpay_signature: razorpay_signature,
          updated_at: new Date().toISOString()
        })
        .eq('id', intent.id);

      // Update wallet balance
      await supabase
        .rpc('add_wallet_balance', {
          p_user_id: userId,
          p_amount: intent.amount_inr,
          p_note: 'Wallet top-up via Razorpay'
        });

      res.json({
        success: true,
        message: 'Payment verified and wallet updated'
      });

    } catch (error) {
      console.error('Verify payment error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get wallet transactions
  async getTransactions(req, res) {
    try {
      const userId = req.user?.id || req.userId;
      const { page = 1, limit = 20 } = req.query;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found'
        });
      }

      const offset = (page - 1) * limit;

      const { data, error, count } = await supabase
        .from('wallet_transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Get transactions error:', error);
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.json({
        success: true,
        transactions: data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count
        }
      });

    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Request settlement
  async requestSettlement(req, res) {
    try {
      const { amount } = req.body;
      const userId = req.user?.id || req.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found'
        });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid amount'
        });
      }

      // Check wallet balance
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance_available_inr')
        .eq('user_id', userId)
        .single();

      if (walletError || !wallet) {
        return res.status(404).json({
          success: false,
          message: 'Wallet not found'
        });
      }

      if (wallet.balance_available_inr < amount) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient balance'
        });
      }

      // Create settlement request
      const { data, error } = await supabase
        .from('settlements')
        .insert({
          user_id: userId,
          amount_inr: Math.round(amount),
          status: 'requested'
        })
        .select()
        .single();

      if (error) {
        console.error('Create settlement error:', error);
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      // Reserve the amount (move from available to reserved)
      await supabase
        .rpc('reserve_wallet_balance', {
          p_user_id: userId,
          p_amount: Math.round(amount),
          p_note: 'Settlement request - funds reserved'
        });

      res.json({
        success: true,
        settlement: data,
        message: 'Settlement request submitted successfully'
      });

    } catch (error) {
      console.error('Request settlement error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get settlement history
  async getSettlements(req, res) {
    try {
      const userId = req.user?.id || req.userId;
      const { page = 1, limit = 10 } = req.query;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User ID not found'
        });
      }

      const offset = (page - 1) * limit;

      const { data, error, count } = await supabase
        .from('settlements')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('requested_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Get settlements error:', error);
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.json({
        success: true,
        settlements: data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count
        }
      });

    } catch (error) {
      console.error('Get settlements error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

module.exports = new WalletController();
