-- Migration: Store OTP in Supabase (for production scalability)
-- This replaces in-memory storage with database storage

-- Create OTP storage table
CREATE TABLE IF NOT EXISTS public.otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) NOT NULL,
    otp VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Index for fast lookups
    CONSTRAINT unique_active_phone UNIQUE (phone)
);

-- Create index for fast phone lookups
CREATE INDEX IF NOT EXISTS idx_otp_phone ON public.otp_verifications(phone);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON public.otp_verifications(expires_at);

-- Create function to clean up expired OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.otp_verifications 
    WHERE expires_at < NOW();
END;
$$;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_otp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER otp_updated_at_trigger
    BEFORE UPDATE ON public.otp_verifications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_otp_updated_at();

-- Enable RLS (Row Level Security)
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- Create policy - only service role can access
CREATE POLICY "Service role can manage OTPs"
    ON public.otp_verifications
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.otp_verifications TO service_role;

-- Comments
COMMENT ON TABLE public.otp_verifications IS 'Stores OTP verification codes for phone authentication';
COMMENT ON COLUMN public.otp_verifications.phone IS 'Phone number in international format (+91...)';
COMMENT ON COLUMN public.otp_verifications.otp IS 'One-time password code';
COMMENT ON COLUMN public.otp_verifications.expires_at IS 'When the OTP expires';
COMMENT ON COLUMN public.otp_verifications.attempts IS 'Number of verification attempts';
COMMENT ON COLUMN public.otp_verifications.is_verified IS 'Whether OTP has been successfully verified';
