-- Add clerk_user_id column to merchants table
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_merchants_clerk_user_id ON merchants(clerk_user_id);

-- Add unique constraint to ensure one merchant per Clerk user
ALTER TABLE merchants ADD CONSTRAINT unique_clerk_user_id UNIQUE (clerk_user_id);