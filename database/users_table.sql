-- Create users table for user authentication
CREATE TABLE IF NOT EXISTS public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    email_verified boolean DEFAULT false,
    email_verification_token text,
    password_reset_token text,
    password_reset_expires timestamp without time zone,
    last_login timestamp without time zone,
    login_attempts integer DEFAULT 0,
    locked_until timestamp without time zone
);

-- Add primary key constraint
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

-- Add unique constraint on email
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users USING btree (email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users USING btree (is_active);

-- Add trigger for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
ALTER TABLE public.users OWNER TO postgres;