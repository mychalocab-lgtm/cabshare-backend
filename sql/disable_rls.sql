-- Check and fix Row Level Security on vehicles table
-- Run this in Supabase SQL Editor

-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'vehicles';

-- Disable RLS for development (you can enable it later with proper policies)
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;

-- Also check kyc_documents table
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'kyc_documents';

-- Disable RLS for kyc_documents too
ALTER TABLE kyc_documents DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('vehicles', 'kyc_documents');

SELECT 'RLS disabled for vehicles and kyc_documents tables' as result;
