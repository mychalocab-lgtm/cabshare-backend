-- Force fix the vehicles table column naming
DO $$ 
BEGIN
    -- Check current columns
    RAISE NOTICE 'Current columns in vehicles table:';
    
    -- If owner_id exists and user_id doesn't, rename it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='owner_id') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='user_id') THEN
        ALTER TABLE vehicles RENAME COLUMN owner_id TO user_id;
        RAISE NOTICE 'Renamed owner_id to user_id';
    END IF;
    
    -- If both exist, drop owner_id and keep user_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='owner_id') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='user_id') THEN
        -- Copy data if user_id is null
        UPDATE vehicles SET user_id = owner_id WHERE user_id IS NULL AND owner_id IS NOT NULL;
        ALTER TABLE vehicles DROP COLUMN owner_id;
        RAISE NOTICE 'Dropped owner_id column, kept user_id';
    END IF;
    
    -- Show final columns
    RAISE NOTICE 'Final columns after fix:';
    
END $$;

-- Verify the fix
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vehicles' AND column_name IN ('user_id', 'owner_id')
ORDER BY column_name;
