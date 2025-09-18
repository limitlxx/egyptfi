-- Migration: Add wallet fields to merchants table
-- Description: Add ChipiPay wallet-related columns to merchants table and make wallet_address nullable
-- Requirements: 6.1

-- Add wallet-related columns to merchants table
ALTER TABLE merchants 
ADD COLUMN wallet_public_key TEXT,
ADD COLUMN wallet_encrypted_private_key TEXT,
ADD COLUMN wallet_created_at TIMESTAMP,
ADD COLUMN chipipay_external_user_id TEXT;

-- Make wallet_address nullable since ChipiPay wallets will be used
ALTER TABLE merchants ALTER COLUMN wallet_address DROP NOT NULL;

-- Create indexes for performance optimization on wallet-related queries
CREATE INDEX idx_merchants_wallet_public_key ON merchants(wallet_public_key);
CREATE INDEX idx_merchants_chipipay_external_user_id ON merchants(chipipay_external_user_id);
CREATE INDEX idx_merchants_wallet_created_at ON merchants(wallet_created_at);

-- Add unique constraint for wallet public key to prevent duplicates
ALTER TABLE merchants ADD CONSTRAINT unique_wallet_public_key UNIQUE(wallet_public_key);

-- Add unique constraint for ChipiPay external user ID to prevent duplicates
ALTER TABLE merchants ADD CONSTRAINT unique_chipipay_external_user_id UNIQUE(chipipay_external_user_id);

-- Add comments for documentation
COMMENT ON COLUMN merchants.wallet_public_key IS 'Public key of the ChipiPay invisible wallet';
COMMENT ON COLUMN merchants.wallet_encrypted_private_key IS 'Encrypted private key of the ChipiPay invisible wallet (encrypted with PIN)';
COMMENT ON COLUMN merchants.wallet_created_at IS 'Timestamp when the ChipiPay wallet was created';
COMMENT ON COLUMN merchants.chipipay_external_user_id IS 'External user ID used for ChipiPay wallet creation';