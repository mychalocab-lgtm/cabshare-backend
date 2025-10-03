-- Migration: Remove Firebase and Email Authentication
-- Date: 2025-10-01
-- Description: Clean up Firebase-related columns and email authentication from users_app table

-- 1. Backup existing data (optional - if you want to keep references)
-- CREATE TABLE users_app_backup_20251001 AS SELECT * FROM users_app;

-- 2. Remove Firebase-related columns
ALTER TABLE users_app 
DROP COLUMN IF EXISTS firebase_uid,
DROP COLUMN IF EXISTS supabase_uid,
DROP COLUMN IF EXISTS email,
DROP COLUMN IF EXISTS email_verified,
DROP COLUMN IF EXISTS password_hash;

-- 3. Update auth_provider to only allow 'msg91'
ALTER TABLE users_app 
DROP CONSTRAINT IF EXISTS users_app_auth_provider_check;

ALTER TABLE users_app
ADD CONSTRAINT users_app_auth_provider_check 
CHECK (auth_provider IN ('msg91', 'admin'));

-- 4. Make phone NOT NULL and add unique constraint
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

-- 5. Add social login columns for future use (Google/Facebook verification)
ALTER TABLE users_app 
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS google_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS facebook_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS facebook_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS social_verified BOOLEAN DEFAULT FALSE;

-- 6. Create indexes for social login columns
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users_app(google_id);
CREATE INDEX IF NOT EXISTS idx_users_facebook_id ON users_app(facebook_id);

-- 7. Update existing users to set auth_provider to 'msg91' if NULL
UPDATE users_app 
SET auth_provider = 'msg91' 
WHERE auth_provider IS NULL OR auth_provider NOT IN ('msg91', 'admin');

-- 8. Make auth_provider NOT NULL
ALTER TABLE users_app 
ALTER COLUMN auth_provider SET NOT NULL;

-- 9. Remove Supabase auth trigger (if exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 10. Create helpful view for active users
CREATE OR REPLACE VIEW active_users AS
SELECT 
    id,
    full_name,
    phone,
    role,
    is_verified,
    phone_verified,
    social_verified,
    google_id IS NOT NULL as has_google,
    facebook_id IS NOT NULL as has_facebook,
    created_at,
    updated_at
FROM users_app
WHERE is_active = TRUE
ORDER BY created_at DESC;

-- 11. Add comment to table
COMMENT ON TABLE users_app IS 'User accounts - Phone OTP only authentication via MSG91. Social logins (Google/Facebook) for verification only.';
COMMENT ON COLUMN users_app.phone IS 'Primary authentication identifier - must be unique and verified';
COMMENT ON COLUMN users_app.auth_provider IS 'Authentication provider - msg91 (phone OTP) or admin (system)';
COMMENT ON COLUMN users_app.google_id IS 'Google account ID - for profile verification only, not login';
COMMENT ON COLUMN users_app.facebook_id IS 'Facebook account ID - for profile verification only, not login';

-- 12. Verify migration
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN phone_verified = true THEN 1 END) as verified_users,
    COUNT(CASE WHEN google_id IS NOT NULL THEN 1 END) as google_linked,
    COUNT(CASE WHEN facebook_id IS NOT NULL THEN 1 END) as facebook_linked
FROM users_app;

-- Migration complete!
-- All Firebase and email authentication removed
-- Phone is now the sole authentication method
