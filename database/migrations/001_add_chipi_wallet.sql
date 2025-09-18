-- Migration to add chipi_wallet_address to merchants table
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS chipi_wallet_address TEXT;