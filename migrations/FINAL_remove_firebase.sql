-- Migration: Remove Firebase and Email Authentication - WORKING VERSION
-- Date: 2025-10-01

-- Step 1: DROP OLD CONSTRAINT FIRST (before updating data)
ALTER TABLE users_app 
DROP CONSTRAINT IF EXISTS users_app_auth_provider_check;

-- Step 2: Update existing auth_provider values
UPDATE users_app 
SET auth_provider = CASE 
    WHEN auth_provider IN ('firebase', 'supabase', 'email', 'phone', 'demo', 'local') THEN 'msg91'
    WHEN auth_provider = 'system' THEN 'admin'
    WHEN auth_provider IS NULL THEN 'msg91'
    ELSE 'msg91'  -- Default everything else to msg91
END;

-- Step 3: NOW add the new constraint (after data is clean)
ALTER TABLE users_app
ADD CONSTRAINT users_app_auth_provider_check 
CHECK (auth_provider IN ('msg91', 'admin'));

-- Step 4: Remove Firebase-related columns
ALTER TABLE users_app 
DROP COLUMN IF EXISTS firebase_uid,
DROP COLUMN IF EXISTS supabase_uid,
DROP COLUMN IF EXISTS email,
DROP COLUMN IF EXISTS email_verified,
DROP COLUMN IF EXISTS password_hash;

-- Step 5: Handle phone column - add temporary random phones for NULL values
UPDATE users_app 
SET phone = '+91' || lpad(floor(random() * 10000000000)::text, 10, '0')
WHERE phone IS NULL OR phone = '';

-- Step 6: Make phone NOT NULL
ALTER TABLE users_app 
ALTER COLUMN phone SET NOT NULL;

-- Step 7: Remove duplicate phone constraint if exists, then add unique
DO $$
BEGIN
    -- Drop existing constraint if present
    ALTER TABLE users_app DROP CONSTRAINT IF EXISTS users_app_phone_key;
    
    -- Try to add unique constraint
    BEGIN
        ALTER TABLE users_app ADD CONSTRAINT users_app_phone_key UNIQUE (phone);
    EXCEPTION 
        WHEN unique_violation THEN
            -- If there are duplicates, add suffix to make them unique
            WITH duplicates AS (
                SELECT phone, ROW_NUMBER() OVER (PARTITION BY phone ORDER BY created_at) as rn
                FROM users_app
            )
            UPDATE users_app u
            SET phone = u.phone || '_' || d.rn
            FROM duplicates d
            WHERE u.phone = d.phone AND d.rn > 1;
            
            -- Now add the constraint
            ALTER TABLE users_app ADD CONSTRAINT users_app_phone_key UNIQUE (phone);
    END;
END $$;

-- Step 8: Add social login columns
ALTER TABLE users_app 
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS google_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS facebook_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS facebook_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS social_verified BOOLEAN DEFAULT FALSE;

-- Step 9: Create indexes
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users_app(google_id);
CREATE INDEX IF NOT EXISTS idx_users_facebook_id ON users_app(facebook_id);

-- Step 10: Make auth_provider NOT NULL
ALTER TABLE users_app 
ALTER COLUMN auth_provider SET NOT NULL;

-- Step 11: Remove Supabase auth trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Verify the migration
SELECT 
    'Migration Complete!' as status,
    COUNT(*) as total_users,
    COUNT(CASE WHEN auth_provider = 'msg91' THEN 1 END) as msg91_users,
    COUNT(CASE WHEN auth_provider = 'admin' THEN 1 END) as admin_users
FROM users_app;
