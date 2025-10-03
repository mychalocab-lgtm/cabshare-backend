-- Clean up old email-based user data
-- Run this to start fresh with phone-only authentication

-- 1. Delete all users except the one that just logged in
-- Replace 'KEEP_THIS_USER_ID' with the actual user ID you want to keep
-- From logs: 62fc0f83-818f-46d0-9660-759e15b93b62

-- First, let's see what we have
SELECT id, full_name, phone, auth_provider, created_at 
FROM users_app 
ORDER BY created_at DESC;

-- Delete old demo/test users but keep real phone authenticated users
DELETE FROM users_app 
WHERE auth_provider IN ('firebase', 'supabase', 'demo', 'local', 'email')
AND id != '62fc0f83-818f-46d0-9660-759e15b93b62'; -- Keep the user who just logged in

-- Or if you want to keep ONLY msg91 users and delete everything else:
-- DELETE FROM users_app WHERE auth_provider != 'msg91';

-- 2. Clean up orphaned data
-- Delete wallets for deleted users
DELETE FROM wallets 
WHERE user_id NOT IN (SELECT id FROM users_app);

-- Delete rides for deleted users  
DELETE FROM rides 
WHERE driver_id NOT IN (SELECT id FROM users_app);

-- Delete bookings for deleted users
DELETE FROM bookings 
WHERE rider_id NOT IN (SELECT id FROM users_app);

-- Delete wallet transactions for deleted users
DELETE FROM wallet_transactions 
WHERE user_id NOT IN (SELECT id FROM users_app);

-- 3. Verify cleanup
SELECT 
    'users_app' as table_name,
    COUNT(*) as count,
    string_agg(DISTINCT auth_provider, ', ') as auth_providers
FROM users_app
UNION ALL
SELECT 
    'wallets' as table_name,
    COUNT(*) as count,
    NULL
FROM wallets
UNION ALL
SELECT 
    'rides' as table_name,
    COUNT(*) as count,
    NULL
FROM rides
UNION ALL
SELECT 
    'bookings' as table_name,
    COUNT(*) as count,
    NULL
FROM bookings;

-- 4. Show current users
SELECT 
    id,
    full_name,
    phone,
    auth_provider,
    phone_verified,
    is_verified,
    created_at
FROM users_app
ORDER BY created_at DESC;
