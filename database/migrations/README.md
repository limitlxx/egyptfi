# ChipiPay Wallet Integration Database Migrations

This directory contains database migration scripts for the ChipiPay invisible wallet integration feature.

## Migration Files

### 1. Individual Migration Files
- `001_add_wallet_fields_to_merchants.sql` - Adds wallet-related columns to the merchants table
- `002_create_chipipay_config_and_logging_tables.sql` - Creates ChipiPay configuration and audit logging tables

### 2. Combined Migration File
- `chipipay_wallet_integration_migration.sql` - Complete migration script that applies all changes at once

### 3. Rollback File
- `rollback_chipipay_wallet_integration.sql` - Rollback script to undo all changes

## How to Apply Migrations

### Option 1: Apply Individual Migrations
```bash
# Apply migrations in order
psql -d your_database -f database/migrations/001_add_wallet_fields_to_merchants.sql
psql -d your_database -f database/migrations/002_create_chipipay_config_and_logging_tables.sql
```

### Option 2: Apply Complete Migration
```bash
# Apply all changes at once
psql -d your_database -f database/migrations/chipipay_wallet_integration_migration.sql
```

## How to Rollback

```bash
# Rollback all changes
psql -d your_database -f database/migrations/rollback_chipipay_wallet_integration.sql
```

## Changes Made

### Merchants Table Updates
- Added `wallet_public_key` (TEXT) - Public key of ChipiPay invisible wallet
- Added `wallet_encrypted_private_key` (TEXT) - Encrypted private key (encrypted with PIN)
- Added `wallet_created_at` (TIMESTAMP) - Wallet creation timestamp
- Added `chipipay_external_user_id` (TEXT) - External user ID for ChipiPay
- Made `wallet_address` nullable since ChipiPay wallets will be used
- Added unique constraints and indexes for performance

### New Tables Created

#### chipipay_config
Configuration table for ChipiPay integration settings:
- `id` (UUID) - Primary key
- `environment` (VARCHAR) - 'testnet' or 'mainnet'
- `api_public_key` (TEXT) - ChipiPay API public key
- `jwks_endpoint` (TEXT) - JWKS endpoint for bearer tokens
- `backend_url` (TEXT) - ChipiPay backend API URL
- `created_at`, `updated_at` (TIMESTAMP) - Audit timestamps

#### wallet_operations_log
Audit trail table for wallet operations:
- `id` (UUID) - Primary key
- `merchant_id` (UUID) - Reference to merchants table
- `operation_type` (VARCHAR) - Type of operation performed
- `contract_address` (TEXT) - Smart contract address
- `amount` (DECIMAL) - Amount involved in operation
- `recipient` (TEXT) - Recipient address
- `tx_hash` (TEXT) - Transaction hash
- `status` (VARCHAR) - Operation status
- `error_message` (TEXT) - Error details if failed
- `metadata` (JSONB) - Additional operation data
- `created_at`, `completed_at` (TIMESTAMP) - Timing information

## Environment Configuration

After applying the migrations, update the ChipiPay configuration with your actual values:

```sql
-- Update testnet configuration
UPDATE chipipay_config 
SET api_public_key = 'your_actual_testnet_key',
    jwks_endpoint = 'your_actual_jwks_endpoint'
WHERE environment = 'testnet';

-- Update mainnet configuration
UPDATE chipipay_config 
SET api_public_key = 'your_actual_mainnet_key',
    jwks_endpoint = 'your_actual_jwks_endpoint'
WHERE environment = 'mainnet';
```

## Verification

After applying migrations, verify the changes:

```sql
-- Check merchants table structure
\d merchants

-- Check new tables exist
\dt chipipay_config
\dt wallet_operations_log

-- Check indexes were created
\di idx_merchants_wallet_public_key
\di idx_wallet_operations_merchant_id

-- Check constraints
\d+ merchants
```

## Notes

- The `wallet_address` column in the merchants table is made nullable to support ChipiPay wallets
- All new columns have appropriate indexes for performance
- Unique constraints prevent duplicate wallet keys and external user IDs
- The audit log table includes comprehensive tracking for all wallet operations
- Configuration table supports both testnet and mainnet environments