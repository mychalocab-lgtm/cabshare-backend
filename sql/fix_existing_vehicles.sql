-- Update existing vehicles table to match new structure
DO $$ 
BEGIN
    -- Add missing columns for verification
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='verification_status') THEN
        ALTER TABLE vehicles ADD COLUMN verification_status VARCHAR(20) DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='verification_notes') THEN
        ALTER TABLE vehicles ADD COLUMN verification_notes TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='verified_by') THEN
        ALTER TABLE vehicles ADD COLUMN verified_by UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='verified_at') THEN
        ALTER TABLE vehicles ADD COLUMN verified_at TIMESTAMPTZ;
    END IF;
    
    -- Add missing vehicle details
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='fuel_type') THEN
        ALTER TABLE vehicles ADD COLUMN fuel_type VARCHAR(20) DEFAULT 'petrol';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='transmission') THEN
        ALTER TABLE vehicles ADD COLUMN transmission VARCHAR(20) DEFAULT 'manual';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='ac') THEN
        ALTER TABLE vehicles ADD COLUMN ac BOOLEAN DEFAULT TRUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='seats') THEN
        ALTER TABLE vehicles ADD COLUMN seats INTEGER DEFAULT 4;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='updated_at') THEN
        ALTER TABLE vehicles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- Rename owner_id to user_id if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='owner_id') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='user_id') THEN
        ALTER TABLE vehicles RENAME COLUMN owner_id TO user_id;
    END IF;
    
    -- Update verification_status based on existing verified column
    UPDATE vehicles 
    SET verification_status = CASE 
        WHEN verified = true OR is_verified = true THEN 'approved'
        ELSE 'pending'
    END
    WHERE verification_status IS NULL;
    
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_verification_status ON vehicles(verification_status);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_number ON vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_vehicle_type ON vehicles(vehicle_type);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_vehicles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_vehicles_updated_at ON vehicles;
CREATE TRIGGER trigger_vehicles_updated_at
    BEFORE UPDATE ON vehicles
    FOR EACH ROW
    EXECUTE FUNCTION update_vehicles_updated_at();

SELECT 'Vehicles table updated successfully!' as result;
