-- Migration: Create logging and audit trail tables
-- Description: Creates tables for system logs, security events, and enhanced wallet operations logging

-- System logs table for general application logging
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    level VARCHAR(20) NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL')),
    category VARCHAR(50) NOT NULL CHECK (category IN ('AUTHENTICATION', 'WALLET_OPERATION', 'API_REQUEST', 'DATABASE', 'CHIPIPAY', 'SECURITY', 'SYSTEM')),
    message TEXT NOT NULL,
    correlation_id UUID NOT NULL,
    request_id UUID,
    merchant_id UUID REFERENCES merchants(id),
    environment VARCHAR(10) CHECK (environment IN ('testnet', 'mainnet')),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Security events table for audit trail
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'INVALID_API_KEY', 'PIN_FAILURE', 
        'PIN_LOCKOUT', 'SUSPICIOUS_ACTIVITY', 'RATE_LIMIT_EXCEEDED', 'UNAUTHORIZED_ACCESS'
    )),
    message TEXT NOT NULL,
    merchant_id UUID REFERENCES merchants(id),
    ip_address INET,
    user_agent TEXT,
    api_key_masked VARCHAR(100), -- Masked API key for security
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    correlation_id UUID NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Enhance existing wallet_operations_log table if it exists
-- Add columns that might be missing for comprehensive logging
DO $$ 
BEGIN
    -- Add correlation_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'wallet_operations_log' AND column_name = 'correlation_id') THEN
        ALTER TABLE wallet_operations_log ADD COLUMN correlation_id UUID;
    END IF;
    
    -- Add environment if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'wallet_operations_log' AND column_name = 'environment') THEN
        ALTER TABLE wallet_operations_log ADD COLUMN environment VARCHAR(10) CHECK (environment IN ('testnet', 'mainnet'));
    END IF;
    
    -- Add request_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'wallet_operations_log' AND column_name = 'request_id') THEN
        ALTER TABLE wallet_operations_log ADD COLUMN request_id UUID;
    END IF;
    
    -- Ensure operation_type has all possible values
    ALTER TABLE wallet_operations_log DROP CONSTRAINT IF EXISTS wallet_operations_log_operation_type_check;
    ALTER TABLE wallet_operations_log ADD CONSTRAINT wallet_operations_log_operation_type_check 
        CHECK (operation_type IN ('WALLET_CREATION', 'TRANSFER', 'APPROVE', 'STAKE_VESU_USDC', 'WITHDRAW_VESU_USDC', 'CONTRACT_CALL', 'transfer', 'approve', 'stake-vesu-usdc', 'withdraw-vesu-usdc', 'call-contract'));
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_correlation_id ON system_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_merchant_id ON system_logs(merchant_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_level_category ON system_logs(level, category);

CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_merchant_id ON security_events(merchant_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_correlation_id ON security_events(correlation_id);

CREATE INDEX IF NOT EXISTS idx_wallet_operations_correlation_id ON wallet_operations_log(correlation_id);
CREATE INDEX IF NOT EXISTS idx_wallet_operations_environment ON wallet_operations_log(environment);
CREATE INDEX IF NOT EXISTS idx_wallet_operations_request_id ON wallet_operations_log(request_id);

-- Create a view for comprehensive audit trail
CREATE OR REPLACE VIEW audit_trail AS
SELECT 
    'SYSTEM_LOG' as source,
    id,
    timestamp as event_time,
    level as severity,
    category,
    message,
    correlation_id,
    merchant_id,
    environment,
    metadata
FROM system_logs
UNION ALL
SELECT 
    'SECURITY_EVENT' as source,
    id,
    timestamp as event_time,
    severity,
    'SECURITY' as category,
    message,
    correlation_id,
    merchant_id,
    NULL as environment,
    metadata
FROM security_events
UNION ALL
SELECT 
    'WALLET_OPERATION' as source,
    id,
    created_at as event_time,
    CASE 
        WHEN status = 'failed' THEN 'ERROR'
        WHEN status = 'completed' THEN 'INFO'
        ELSE 'INFO'
    END as severity,
    'WALLET_OPERATION' as category,
    CONCAT(operation_type, ' - ', status, COALESCE(' (tx: ' || tx_hash || ')', '')) as message,
    correlation_id,
    merchant_id,
    environment,
    metadata
FROM wallet_operations_log
ORDER BY event_time DESC;

-- Log retention policy (optional - can be implemented via cron job)
-- This is a placeholder for future log rotation implementation
COMMENT ON TABLE system_logs IS 'System logs with configurable retention policy';
COMMENT ON TABLE security_events IS 'Security events for audit and compliance';
COMMENT ON VIEW audit_trail IS 'Comprehensive audit trail combining all log sources';