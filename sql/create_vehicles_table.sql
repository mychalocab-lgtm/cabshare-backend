-- Create vehicles table for CabShare application
-- This table stores user vehicle information with verification support

-- Create enum types if they don't exist
DO $$ BEGIN
    CREATE TYPE vehicle_type AS ENUM ('private', 'commercial');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users_app(id) ON DELETE CASCADE,
    
    -- Vehicle Details
    vehicle_type vehicle_type NOT NULL DEFAULT 'private',
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER,
    color VARCHAR(50),
    plate_number VARCHAR(20) NOT NULL,
    
    -- Verification
    is_verified BOOLEAN DEFAULT FALSE,
    verification_status verification_status DEFAULT 'pending',
    verification_notes TEXT,
    verified_by UUID REFERENCES users_app(id),
    verified_at TIMESTAMPTZ,
    
    -- Documents
    rc_document_url TEXT, -- Registration Certificate
    insurance_document_url TEXT,
    permit_document_url TEXT, -- For commercial vehicles
    
    -- Additional Info
    seats INTEGER DEFAULT 4,
    fuel_type VARCHAR(20) DEFAULT 'petrol',
    transmission VARCHAR(20) DEFAULT 'manual',
    ac BOOLEAN DEFAULT TRUE,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_plate_number CHECK (plate_number ~ '^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$' OR plate_number ~ '^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}$'),
    CONSTRAINT chk_year CHECK (year IS NULL OR (year >= 1980 AND year <= EXTRACT(year FROM NOW()) + 1)),
    CONSTRAINT chk_seats CHECK (seats >= 1 AND seats <= 50),
    
    -- Unique constraint
    UNIQUE(plate_number)
);

-- Create KYC documents table for driver verification
CREATE TABLE IF NOT EXISTS kyc_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users_app(id) ON DELETE CASCADE,
    
    -- Document Details
    document_type VARCHAR(50) NOT NULL, -- 'driving_license', 'aadhar', 'pan', 'passport', etc.
    document_number VARCHAR(100) NOT NULL,
    document_url TEXT NOT NULL,
    
    -- Verification
    verification_status verification_status DEFAULT 'pending',
    verification_notes TEXT,
    verified_by UUID REFERENCES users_app(id),
    verified_at TIMESTAMPTZ,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, document_type, document_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_number ON vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_verification_status ON vehicles(verification_status);
CREATE INDEX IF NOT EXISTS idx_vehicles_vehicle_type ON vehicles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_at ON vehicles(created_at);

CREATE INDEX IF NOT EXISTS idx_kyc_documents_user_id ON kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_document_type ON kyc_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_verification_status ON kyc_documents(verification_status);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_vehicles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_vehicles_updated_at
    BEFORE UPDATE ON vehicles
    FOR EACH ROW
    EXECUTE FUNCTION update_vehicles_updated_at();

CREATE OR REPLACE FUNCTION update_kyc_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_kyc_documents_updated_at
    BEFORE UPDATE ON kyc_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_kyc_documents_updated_at();

-- Insert sample vehicles for testing
INSERT INTO vehicles (user_id, vehicle_type, make, model, year, plate_number, color, seats, is_verified, verification_status)
SELECT 
    id,
    'private',
    'Maruti',
    'Swift',
    2020,
    'MH12AB1234',
    'White',
    4,
    true,
    'approved'
FROM users_app 
WHERE email = 'driver@test.com'
ON CONFLICT (plate_number) DO NOTHING;

-- Display success message
SELECT 'vehicles and kyc_documents tables created successfully!' as result;
