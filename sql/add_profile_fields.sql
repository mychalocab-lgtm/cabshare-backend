-- Add missing profile fields to users_app table
DO $$ 
BEGIN
    -- Add bio field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_app' AND column_name='bio') THEN
        ALTER TABLE users_app ADD COLUMN bio TEXT;
    END IF;
    
    -- Add address fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_app' AND column_name='address') THEN
        ALTER TABLE users_app ADD COLUMN address TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_app' AND column_name='city') THEN
        ALTER TABLE users_app ADD COLUMN city VARCHAR(100);
    END IF;
    
    -- Add preference fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_app' AND column_name='gender') THEN
        ALTER TABLE users_app ADD COLUMN gender VARCHAR(10);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_app' AND column_name='chat_preference') THEN
        ALTER TABLE users_app ADD COLUMN chat_preference VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_app' AND column_name='music_preference') THEN
        ALTER TABLE users_app ADD COLUMN music_preference VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_app' AND column_name='pets_preference') THEN
        ALTER TABLE users_app ADD COLUMN pets_preference VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_app' AND column_name='smoking_preference') THEN
        ALTER TABLE users_app ADD COLUMN smoking_preference VARCHAR(20);
    END IF;
    
END $$;

SELECT 'Profile fields added to users_app table!' as result;
