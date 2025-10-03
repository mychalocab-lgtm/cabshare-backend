-- Create users_app table for the CabShare application
-- This table stores user profiles that work with both Supabase Auth and Firebase Auth

CREATE TABLE IF NOT EXISTS users_app (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255) UNIQUE,
    role user_role DEFAULT 'rider',
    
    -- Authentication provider tracking
    auth_provider VARCHAR(20) DEFAULT 'supabase', -- 'supabase', 'firebase', 'manual'
    supabase_uid UUID, -- Links to auth.users.id
    firebase_uid VARCHAR(255), -- Links to Firebase UID
    
    -- Verification status
    is_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    
    -- Profile details
    avatar_url TEXT,
    date_of_birth DATE,
    gender VARCHAR(10),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_suspended BOOLEAN DEFAULT FALSE,
    suspension_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT chk_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT chk_phone_format CHECK (phone ~ '^\+?[1-9]\d{1,14}$'),
    CONSTRAINT chk_auth_provider CHECK (auth_provider IN ('supabase', 'firebase', 'manual'))
);

-- Create wallets table if it doesn't exist
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users_app(id) ON DELETE CASCADE,
    balance_available_inr INTEGER DEFAULT 0 CHECK (balance_available_inr >= 0),
    balance_reserved_inr INTEGER DEFAULT 0 CHECK (balance_reserved_inr >= 0),
    total_earned_inr INTEGER DEFAULT 0 CHECK (total_earned_inr >= 0),
    total_spent_inr INTEGER DEFAULT 0 CHECK (total_spent_inr >= 0),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one wallet per user
    UNIQUE(user_id)
);

-- Create wallet_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users_app(id) ON DELETE CASCADE,
    
    -- Transaction details
    tx_type wallet_tx_type NOT NULL,
    amount_inr INTEGER NOT NULL, -- Can be negative for debits
    description TEXT,
    reference_id UUID, -- Links to booking, ride, etc.
    
    -- Transaction metadata
    balance_before_inr INTEGER,
    balance_after_inr INTEGER,
    
    -- Status
    status VARCHAR(20) DEFAULT 'completed',
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Add note field for compatibility
    note TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_app_email ON users_app(email);
CREATE INDEX IF NOT EXISTS idx_users_app_phone ON users_app(phone);
CREATE INDEX IF NOT EXISTS idx_users_app_supabase_uid ON users_app(supabase_uid);
CREATE INDEX IF NOT EXISTS idx_users_app_firebase_uid ON users_app(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_app_role ON users_app(role);
CREATE INDEX IF NOT EXISTS idx_users_app_created_at ON users_app(created_at);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference_id ON wallet_transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at);

-- Create updated_at trigger for users_app
CREATE OR REPLACE FUNCTION update_users_app_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_app_updated_at
    BEFORE UPDATE ON users_app
    FOR EACH ROW
    EXECUTE FUNCTION update_users_app_updated_at();

-- Create updated_at trigger for wallets
CREATE OR REPLACE FUNCTION update_wallets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_wallets_updated_at
    BEFORE UPDATE ON wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_wallets_updated_at();

-- Insert some sample data for testing
INSERT INTO users_app (id, full_name, phone, email, role, is_verified, auth_provider)
VALUES 
    ('550e8400-e29b-41d4-a716-446655440000', 'Test Driver', '+919000000001', 'driver@test.com', 'driver', true, 'manual'),
    ('550e8400-e29b-41d4-a716-446655440001', 'Test Rider', '+919000000002', 'rider@test.com', 'rider', true, 'manual')
ON CONFLICT (email) DO NOTHING;

-- Create wallets for sample users
INSERT INTO wallets (user_id, balance_available_inr)
SELECT id, 1000 FROM users_app 
WHERE email IN ('driver@test.com', 'rider@test.com')
ON CONFLICT (user_id) DO NOTHING;

-- Display success message
SELECT 'users_app table and related tables created successfully!' as result;
