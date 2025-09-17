-- ChipiPay Invisible Wallet Integration - Complete Database Migration
-- Description: Complete migration for ChipiPay invisible wallet integration
-- This script combines all necessary database changes for the ChipiPay integration
-- Requirements: 6.1, 6.2, 6.3

-- ============================================================================
-- PART 1: Add wallet fields to merchants table
-- ============================================================================

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

-- Add unique constraints for wallet fields to prevent duplicates
ALTER TABLE merchants ADD CONSTRAINT unique_wallet_public_key UNIQUE(wallet_public_key);
ALTER TABLE merchants ADD CONSTRAINT unique_chipipay_external_user_id UNIQUE(chipipay_external_user_id);

-- Add comments for documentation
COMMENT ON COLUMN merchants.wallet_public_key IS 'Public key of the ChipiPay invisible wallet';
COMMENT ON COLUMN merchants.wallet_encrypted_private_key IS 'Encrypted private key of the ChipiPay invisible wallet (encrypted with PIN)';
COMMENT ON COLUMN merchants.wallet_created_at IS 'Timestamp when the ChipiPay wallet was created';
COMMENT ON COLUMN merchants.chipipay_external_user_id IS 'External user ID used for ChipiPay wallet creation';

-- ============================================================================
-- PART 2: Create ChipiPay configuration table
-- ============================================================================

-- Create ChipiPay configuration table
CREATE TABLE chipipay_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment VARCHAR(10) NOT NULL CHECK (environment IN ('testnet', 'mainnet')),
    api_public_key TEXT NOT NULL,
    jwks_endpoint TEXT NOT NULL,
    backend_url TEXT NOT NULL DEFAULT 'https://api.chipipay.com/v1',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure only one config per environment
    CONSTRAINT unique_environment UNIQUE(environment)
);

-- Create indexes for ChipiPay configuration
CREATE INDEX idx_chipipay_config_environment ON chipipay_config(environment);

-- Add update trigger for chipipay_config updated_at
CREATE TRIGGER update_chipipay_config_updated_at
BEFORE UPDATE ON chipipay_config
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add comments for ChipiPay configuration table
COMMENT ON TABLE chipipay_config IS 'Configuration settings for ChipiPay integration by environment';
COMMENT ON COLUMN chipipay_config.environment IS 'Environment type: testnet or mainnet';
COMMENT ON COLUMN chipipay_config.api_public_key IS 'ChipiPay API public key for the environment';
COMMENT ON COLUMN chipipay_config.jwks_endpoint IS 'JWKS endpoint for bearer token generation';
COMMENT ON COLUMN chipipay_config.backend_url IS 'ChipiPay backend API URL';

-- ============================================================================
-- PART 3: Create wallet operations log table for audit trail
-- ============================================================================

-- Create wallet operations log table for audit trail
CREATE TABLE wallet_operations_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    operation_type VARCHAR(50) NOT NULL,
    contract_address TEXT,
    amount DECIMAL(18,8),
    recipient TEXT,
    tx_hash TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    
    -- Add constraint for valid operation types
    CONSTRAINT valid_operation_type CHECK (
        operation_type IN (
            'transfer', 
            'approve', 
            'stake_vesu_usdc', 
            'withdraw_vesu_usdc', 
            'call_contract',
            'wallet_creation'
        )
    ),
    
    -- Add constraint for valid status values
    CONSTRAINT valid_status CHECK (
        status IN ('pending', 'completed', 'failed', 'cancelled')
    )
);

-- Create indexes for optimal performance on wallet operations log
CREATE INDEX idx_wallet_operations_merchant_id ON wallet_operations_log(merchant_id);
CREATE INDEX idx_wallet_operations_operation_type ON wallet_operations_log(operation_type);
CREATE INDEX idx_wallet_operations_status ON wallet_operations_log(status);
CREATE INDEX idx_wallet_operations_created_at ON wallet_operations_log(created_at);
CREATE INDEX idx_wallet_operations_tx_hash ON wallet_operations_log(tx_hash);

-- Create composite indexes for common queries
CREATE INDEX idx_wallet_operations_merchant_status ON wallet_operations_log(merchant_id, status);
CREATE INDEX idx_wallet_operations_merchant_type ON wallet_operations_log(merchant_id, operation_type);

-- Add comments for wallet operations log table
COMMENT ON TABLE wallet_operations_log IS 'Audit trail for all wallet operations performed through ChipiPay SDK';
COMMENT ON COLUMN wallet_operations_log.operation_type IS 'Type of wallet operation performed';
COMMENT ON COLUMN wallet_operations_log.contract_address IS 'Smart contract address involved in the operation';
COMMENT ON COLUMN wallet_operations_log.amount IS 'Amount involved in the operation (if applicable)';
COMMENT ON COLUMN wallet_operations_log.recipient IS 'Recipient address for transfers or operations';
COMMENT ON COLUMN wallet_operations_log.tx_hash IS 'Transaction hash returned from the blockchain';
COMMENT ON COLUMN wallet_operations_log.status IS 'Current status of the operation';
COMMENT ON COLUMN wallet_operations_log.error_message IS 'Error message if operation failed';
COMMENT ON COLUMN wallet_operations_log.metadata IS 'Additional operation metadata in JSON format';
COMMENT ON COLUMN wallet_operations_log.completed_at IS 'Timestamp when operation was completed or failed';

-- ============================================================================
-- PART 4: Insert default configuration (optional)
-- ============================================================================

-- Insert default ChipiPay configuration for testnet and mainnet
-- Note: Replace with actual values from environment variables in production
INSERT INTO chipipay_config (environment, api_public_key, jwks_endpoint, backend_url) VALUES
('testnet', 'pk_test_placeholder', 'https://your-auth-provider.com/.well-known/jwks.json', 'https://api.chipipay.com/v1'),
('mainnet', 'pk_prod_placeholder', 'https://your-auth-provider.com/.well-known/jwks.json', 'https://api.chipipay.com/v1')
ON CONFLICT (environment) DO NOTHING;

-- ============================================================================
-- Migration completed successfully
-- ============================================================================