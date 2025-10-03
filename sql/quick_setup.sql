-- Quick Vehicle Tables Setup (paste in Supabase SQL Editor)

-- Create vehicle types enum
CREATE TYPE vehicle_type AS ENUM ('private', 'commercial');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');

-- Create vehicles table
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    vehicle_type vehicle_type DEFAULT 'private',
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER,
    color VARCHAR(50),
    plate_number VARCHAR(20) NOT NULL UNIQUE,
    seats INTEGER DEFAULT 4,
    fuel_type VARCHAR(20) DEFAULT 'petrol',
    transmission VARCHAR(20) DEFAULT 'manual',
    ac BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_status verification_status DEFAULT 'pending',
    verification_notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create KYC documents table
CREATE TABLE kyc_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    document_number VARCHAR(100) NOT NULL,
    document_url TEXT NOT NULL,
    verification_status verification_status DEFAULT 'pending',
    verification_notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX idx_vehicles_verification_status ON vehicles(verification_status);
CREATE INDEX idx_kyc_documents_user_id ON kyc_documents(user_id);

SELECT 'Tables created successfully!' as result;
