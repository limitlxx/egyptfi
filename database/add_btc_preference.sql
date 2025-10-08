-- Add BTC preference column to merchants table
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS preferred_btc_flow TEXT DEFAULT 'l1';

-- Add check constraint for preferred_btc_flow values
ALTER TABLE merchants ADD CONSTRAINT preferred_btc_flow_check CHECK (preferred_btc_flow IN ('l1', 'l2'));

-- Create index for preferred_btc_flow
CREATE INDEX IF NOT EXISTS idx_merchants_preferred_btc_flow ON merchants(preferred_btc_flow);