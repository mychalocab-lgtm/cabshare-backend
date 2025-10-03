-- Add missing columns to existing vehicles table
DO $$ 
BEGIN
    -- Add verification columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='verification_status') THEN
        ALTER TABLE vehicles ADD COLUMN verification_status VARCHAR(20) DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='is_verified') THEN
        ALTER TABLE vehicles ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
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
    
    -- Add vehicle details if missing
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
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicles' AND column_name='is_active') THEN
        ALTER TABLE vehicles ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- Create KYC documents table if it doesn't exist
CREATE TABLE IF NOT EXISTS kyc_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    document_number VARCHAR(100) NOT NULL,
    document_url TEXT NOT NULL,
    verification_status VARCHAR(20) DEFAULT 'pending',
    verification_notes TEXT,
    verified_by UUID,
    verified_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, document_type, document_number)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_verification_status ON vehicles(verification_status);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_user_id ON kyc_documents(user_id);

SELECT 'Database updated successfully!' as result;
