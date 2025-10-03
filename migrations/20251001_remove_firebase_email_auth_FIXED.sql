-- Migration: Remove Firebase and Email Authentication - FIXED VERSION
-- Date: 2025-10-01
-- Description: Clean up Firebase-related columns and email authentication from users_app table

-- Step 1: Update existing auth_provider values FIRST (before adding constraint)
UPDATE users_app 
SET auth_provider = CASE 
    WHEN auth_provider IN ('firebase', 'supabase', 'email', 'phone') THEN 'msg91'
    WHEN auth_provider = 'system' THEN 'admin'
    WHEN auth_provider IS NULL THEN 'msg91'
    ELSE auth_provider
END
WHERE auth_provider NOT IN ('msg91', 'admin');

-- Step 2: Remove old constraint if exists
ALTER TABLE users_app 
DROP CONSTRAINT IF EXISTS users_app_auth_provider_check;

-- Step 3: Remove Firebase-related columns
ALTER TABLE users_app 
DROP COLUMN IF EXISTS firebase_uid,
DROP COLUMN IF EXISTS supabase_uid,
DROP COLUMN IF EXISTS email,
DROP COLUMN IF EXISTS email_verified,
DROP COLUMN IF EXISTS password_hash;

-- Step 4: Add new constraint (after updating data)
ALTER TABLE users_app
ADD CONSTRAINT users_app_auth_provider_check 
CHECK (auth_provider IN ('msg91', 'admin'));

-- Step 5: Handle phone column
-- First, update NULL phone numbers with placeholder (we'll need to fix these manually)
UPDATE users_app 
SET phone = '+91' || lpad(floor(random() * 10000000000)::text, 10, '0')
WHERE phone IS NULL OR phone = '';

-- Make phone NOT NULL
ALTER TABLE users_app 
ALTER COLUMN phone SET NOT NULL;

-- Add unique constraint on phone if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_app_phone_key'
    ) THEN
        ALTER TABLE users_app 
        ADD CONSTRAINT users_app_phone_key UNIQUE (phone);
    END IF;
END $$;

-- Step 6: Add social login columns for future use
ALTER TABLE users_app 
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS google_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS facebook_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS facebook_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS social_verified BOOLEAN DEFAULT FALSE;

-- Step 7: Create indexes for social login columns
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users_app(google_id);
CREATE INDEX IF NOT EXISTS idx_users_facebook_id ON users_app(facebook_id);

-- Step 8: Make auth_provider NOT NULL
ALTER TABLE users_app 
ALTER COLUMN auth_provider SET NOT NULL;

-- Step 9: Remove Supabase auth trigger (if exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 10: Add helpful comments
COMMENT ON TABLE users_app IS 'User accounts - Phone OTP only authentication via MSG91';
COMMENT ON COLUMN users_app.phone IS 'Primary authentication identifier - must be unique and verified';
COMMENT ON COLUMN users_app.auth_provider IS 'Authentication provider - msg91 (phone OTP) or admin (system)';
COMMENT ON COLUMN users_app.google_id IS 'Google account ID - for profile verification only, not login';
COMMENT ON COLUMN users_app.facebook_id IS 'Facebook account ID - for profile verification only, not login';

-- Step 11: Verify migration
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN phone_verified = true THEN 1 END) as verified_users,
    COUNT(CASE WHEN auth_provider = 'msg91' THEN 1 END) as msg91_users,
    COUNT(CASE WHEN auth_provider = 'admin' THEN 1 END) as admin_users
FROM users_app;

-- Migration complete!
