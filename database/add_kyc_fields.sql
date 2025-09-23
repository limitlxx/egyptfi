-- Create kyc_documents table for storing encrypted KYC documents
CREATE TABLE IF NOT EXISTS public.kyc_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    merchant_id uuid NOT NULL,
    document_type text NOT NULL,
    encrypted_document text NOT NULL, -- Base64 encoded encrypted document
    document_hash text NOT NULL, -- Hash of original document for integrity
    status text DEFAULT 'pending' NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT kyc_documents_pkey PRIMARY KEY (id),
    CONSTRAINT kyc_documents_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE CASCADE,
    CONSTRAINT kyc_documents_status_check CHECK ((status)::text = ANY ((ARRAY['pending'::character varying, 'verified'::character varying, 'rejected'::character varying])::text[]))
);

-- Create indexes for kyc_documents
CREATE INDEX IF NOT EXISTS idx_kyc_documents_merchant_id ON kyc_documents(merchant_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_status ON kyc_documents(status);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_created_at ON kyc_documents(created_at);

-- Add KYC fields to merchants table
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'pending';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS kyc_proof_hash TEXT;

-- Add check constraint for kyc_status values
ALTER TABLE merchants ADD CONSTRAINT kyc_status_check CHECK (kyc_status IN ('pending', 'verified', 'rejected'));

-- Create index for kyc_status for faster queries
CREATE INDEX IF NOT EXISTS idx_merchants_kyc_status ON merchants(kyc_status);

-- Create index for kyc_proof_hash if needed for lookups
CREATE INDEX IF NOT EXISTS idx_merchants_kyc_proof_hash ON merchants(kyc_proof_hash);