-- Add missing profile fields to users_app table
-- Run this in Supabase SQL Editor

DO $$ 
BEGIN
    -- Add bio field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_app' AND column_name='bio') THEN
        ALTER TABLE users_app ADD COLUMN bio TEXT;
        RAISE NOTICE 'Added bio column';
    END IF;
    
    -- Add address fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_app' AND column_name='address') THEN
        ALTER TABLE users_app ADD COLUMN address TEXT;
        RAISE NOTICE 'Added address column';
    END IF;
    
    -- Note: city column might already exist, check first
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_app' AND column_name='city') THEN
        ALTER TABLE users_app ADD COLUMN city VARCHAR(100);
        RAISE NOTICE 'Added city column';
    ELSE
        RAISE NOTICE 'City column already exists';
    END IF;
    
    -- Add preference fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_app' AND column_name='gender') THEN
        ALTER TABLE users_app ADD COLUMN gender VARCHAR(10);
        RAISE NOTICE 'Added gender column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_app' AND column_name='chat_preference') THEN
        ALTER TABLE users_app ADD COLUMN chat_preference VARCHAR(20) DEFAULT 'talkative';
        RAISE NOTICE 'Added chat_preference column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_app' AND column_name='music_preference') THEN
        ALTER TABLE users_app ADD COLUMN music_preference VARCHAR(20) DEFAULT 'depends';
        RAISE NOTICE 'Added music_preference column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_app' AND column_name='pets_preference') THEN
        ALTER TABLE users_app ADD COLUMN pets_preference VARCHAR(20) DEFAULT 'depends';
        RAISE NOTICE 'Added pets_preference column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_app' AND column_name='smoking_preference') THEN
        ALTER TABLE users_app ADD COLUMN smoking_preference VARCHAR(20) DEFAULT 'no';
        RAISE NOTICE 'Added smoking_preference column';
    END IF;
    
END $$;

-- Verify the new columns
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'users_app' 
AND column_name IN ('bio', 'address', 'city', 'gender', 'chat_preference', 'music_preference', 'pets_preference', 'smoking_preference')
ORDER BY column_name;

SELECT 'Profile fields added successfully!' as result;
