-- ChipiPay Invisible Wallet Integration - Rollback Migration
-- Description: Rollback script to undo all ChipiPay integration database changes
-- Use this script to revert the database to its previous state if needed

-- ============================================================================
-- ROLLBACK PART 1: Drop wallet operations log table
-- ============================================================================

-- Drop wallet operations log table and all its indexes
DROP TABLE IF EXISTS wallet_operations_log CASCADE;

-- ============================================================================
-- ROLLBACK PART 2: Drop ChipiPay configuration table
-- ============================================================================

-- Drop ChipiPay configuration table and all its indexes/triggers
DROP TRIGGER IF EXISTS update_chipipay_config_updated_at ON chipipay_config;
DROP TABLE IF EXISTS chipipay_config CASCADE;

-- ============================================================================
-- ROLLBACK PART 3: Remove wallet fields from merchants table
-- ============================================================================

-- Drop unique constraints for wallet fields
ALTER TABLE merchants DROP CONSTRAINT IF EXISTS unique_wallet_public_key;
ALTER TABLE merchants DROP CONSTRAINT IF EXISTS unique_chipipay_external_user_id;

-- Drop indexes for wallet-related fields
DROP INDEX IF EXISTS idx_merchants_wallet_public_key;
DROP INDEX IF EXISTS idx_merchants_chipipay_external_user_id;
DROP INDEX IF EXISTS idx_merchants_wallet_created_at;

-- Remove wallet-related columns from merchants table
ALTER TABLE merchants 
DROP COLUMN IF EXISTS wallet_public_key,
DROP COLUMN IF EXISTS wallet_encrypted_private_key,
DROP COLUMN IF EXISTS wallet_created_at,
DROP COLUMN IF EXISTS chipipay_external_user_id;

-- Restore wallet_address as NOT NULL (if needed)
-- Note: This will fail if there are existing records with NULL wallet_address
-- ALTER TABLE merchants ALTER COLUMN wallet_address SET NOT NULL;

-- ============================================================================
-- Rollback completed successfully
-- ============================================================================

-- Note: The wallet_address column is left as nullable to prevent data loss.
-- If you need to restore the NOT NULL constraint, ensure all existing records
-- have valid wallet_address values first.