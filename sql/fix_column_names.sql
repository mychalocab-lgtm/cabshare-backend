-- Fix column naming issues in vehicles table
DO $$ 
BEGIN
    -- Check if we need to rename owner_id to user_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='owner_id') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='user_id') THEN
        ALTER TABLE vehicles RENAME COLUMN owner_id TO user_id;
    END IF;
    
    -- If both exist, copy data from owner_id to user_id and drop owner_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='owner_id') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='user_id') THEN
        UPDATE vehicles SET user_id = owner_id WHERE user_id IS NULL;
        ALTER TABLE vehicles DROP COLUMN owner_id;
    END IF;
    
    -- Ensure plate_number is populated from plate if empty
    UPDATE vehicles SET plate_number = plate WHERE plate_number IS NULL AND plate IS NOT NULL;
    
END $$;

SELECT 'Column naming fixed!' as result;
