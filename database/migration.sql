-- Migration script to fix existing database issues
-- Run this if you already have a database set up

-- Add missing columns
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT true;

-- Create missing table
CREATE TABLE IF NOT EXISTS merchant_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_merchants_wallet_address ON merchants(wallet_address);
CREATE INDEX IF NOT EXISTS idx_merchants_email ON merchants(business_email);
CREATE INDEX IF NOT EXISTS idx_api_keys_merchant_id ON api_keys(merchant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_id ON transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_merchant_id ON invoices(merchant_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_merchant_id ON merchant_activity_logs(merchant_id);

-- Add unique constraints (only if they don't exist)
DO $$ 
BEGIN
    BEGIN
        ALTER TABLE merchants ADD CONSTRAINT unique_wallet_address UNIQUE(wallet_address);
    EXCEPTION
        WHEN duplicate_table THEN -- ignore if constraint already exists
    END;
    
    BEGIN
        ALTER TABLE merchants ADD CONSTRAINT unique_business_email UNIQUE(business_email);
    EXCEPTION
        WHEN duplicate_table THEN -- ignore if constraint already exists
    END;
END $$;