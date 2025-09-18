-- Migration: Create ChipiPay configuration and wallet operations logging tables
-- Description: Create tables for ChipiPay configuration management and wallet operations audit trail
-- Requirements: 6.2, 6.3

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

-- Create indexes for optimal performance
CREATE INDEX idx_chipipay_config_environment ON chipipay_config(environment);
CREATE INDEX idx_wallet_operations_merchant_id ON wallet_operations_log(merchant_id);
CREATE INDEX idx_wallet_operations_operation_type ON wallet_operations_log(operation_type);
CREATE INDEX idx_wallet_operations_status ON wallet_operations_log(status);
CREATE INDEX idx_wallet_operations_created_at ON wallet_operations_log(created_at);
CREATE INDEX idx_wallet_operations_tx_hash ON wallet_operations_log(tx_hash);

-- Create composite index for common queries
CREATE INDEX idx_wallet_operations_merchant_status ON wallet_operations_log(merchant_id, status);
CREATE INDEX idx_wallet_operations_merchant_type ON wallet_operations_log(merchant_id, operation_type);

-- Add update trigger for chipipay_config updated_at
CREATE TRIGGER update_chipipay_config_updated_at
BEFORE UPDATE ON chipipay_config
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE chipipay_config IS 'Configuration settings for ChipiPay integration by environment';
COMMENT ON COLUMN chipipay_config.environment IS 'Environment type: testnet or mainnet';
COMMENT ON COLUMN chipipay_config.api_public_key IS 'ChipiPay API public key for the environment';
COMMENT ON COLUMN chipipay_config.jwks_endpoint IS 'JWKS endpoint for bearer token generation';
COMMENT ON COLUMN chipipay_config.backend_url IS 'ChipiPay backend API URL';

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