--
-- PostgreSQL database dump
--

\restrict BvwtGqkFOq5Q2ipzuJSpQLawvVyCRhxxXcqvIPT8t3p14g4AfGY3MYIQISCAs5H

-- Dumped from database version 17.6 (Ubuntu 17.6-1.pgdg25.04+1)
-- Dumped by pg_dump version 17.6 (Ubuntu 17.6-1.pgdg25.04+1)

-- Started on 2025-08-23 00:10:20 WAT

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 4 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- TOC entry 3514 (class 0 OID 0)
-- Dependencies: 4
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- TOC entry 223 (class 1255 OID 74644)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 218 (class 1259 OID 74601)
-- Name: api_keys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    merchant_id uuid NOT NULL,
    secret_key text NOT NULL,
    public_key text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.api_keys OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 74630)
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    merchant_id uuid NOT NULL,
    payment_ref text NOT NULL,
    secondary_ref text,
    access_code text,
    status text NOT NULL,
    local_amount numeric(18,8) NOT NULL,
    usdc_amount numeric(18,8),
    token_amount numeric(18,8),
    payment_token text,
    local_currency text,
    chains text,
    receipt_number text,
    secondary_endpoint text,
    paid_at timestamp without time zone,
    ip_address text,
    metadata jsonb,
    channel text,
    created_at timestamp without time zone DEFAULT now(),
    description text,
    "txHash" text,
    environment character varying,
    qr_url text,
    payment_endpoint text
);


ALTER TABLE public.invoices OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 74715)
-- Name: merchant_activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.merchant_activity_logs (
    id integer NOT NULL,
    merchant_id uuid NOT NULL,
    activity_type character varying(100) NOT NULL,
    description text,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.merchant_activity_logs OWNER TO postgres;

--
-- TOC entry 3515 (class 0 OID 0)
-- Dependencies: 222
-- Name: TABLE merchant_activity_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.merchant_activity_logs IS 'Audit trail for merchant activities including contract registrations';


--
-- TOC entry 3516 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN merchant_activity_logs.activity_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.merchant_activity_logs.activity_type IS 'Type of activity (e.g., CONTRACT_STATUS_UPDATE, REGISTRATION, etc.)';


--
-- TOC entry 3517 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN merchant_activity_logs.metadata; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.merchant_activity_logs.metadata IS 'Additional data about the activity in JSON format';


--
-- TOC entry 221 (class 1259 OID 74714)
-- Name: merchant_activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.merchant_activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.merchant_activity_logs_id_seq OWNER TO postgres;

--
-- TOC entry 3518 (class 0 OID 0)
-- Dependencies: 221
-- Name: merchant_activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.merchant_activity_logs_id_seq OWNED BY public.merchant_activity_logs.id;


--
-- TOC entry 217 (class 1259 OID 74590)
-- Name: merchants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.merchants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wallet_address text NOT NULL,
    business_name text NOT NULL,
    business_logo text,
    business_email text NOT NULL,
    webhook text,
    local_currency text NOT NULL,
    supported_currencies text[] DEFAULT '{}'::text[],
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    business_type character varying,
    monthly_volume character varying,
    contract_registered boolean DEFAULT false,
    contract_transaction_hash character varying(255),
    contract_registration_data jsonb,
    contract_updated_at timestamp without time zone,
    is_verified boolean,
    phone character varying
);


ALTER TABLE public.merchants OWNER TO postgres;

--
-- TOC entry 3519 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN merchants.contract_registered; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.merchants.contract_registered IS 'Whether the merchant is registered on the smart contract';


--
-- TOC entry 3520 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN merchants.contract_transaction_hash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.merchants.contract_transaction_hash IS 'Transaction hash of the contract registration';


--
-- TOC entry 3521 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN merchants.contract_updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.merchants.contract_updated_at IS 'Timestamp when contract status was last updated';


--
-- TOC entry 219 (class 1259 OID 74615)
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    merchant_id uuid NOT NULL,
    currency_amount numeric(18,8) NOT NULL,
    wallet_amount numeric(18,8) NOT NULL,
    alt_amount numeric(18,8),
    to_address text NOT NULL,
    status text NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    "gasSponsored" character varying,
    "txHash" text
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- TOC entry 3337 (class 2604 OID 74718)
-- Name: merchant_activity_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_activity_logs ALTER COLUMN id SET DEFAULT nextval('public.merchant_activity_logs_id_seq'::regclass);


--
-- TOC entry 3349 (class 2606 OID 74609)
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- TOC entry 3353 (class 2606 OID 74638)
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- TOC entry 3358 (class 2606 OID 74723)
-- Name: merchant_activity_logs merchant_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_activity_logs
    ADD CONSTRAINT merchant_activity_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 3343 (class 2606 OID 74600)
-- Name: merchants merchants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchants
    ADD CONSTRAINT merchants_pkey PRIMARY KEY (id);


--
-- TOC entry 3351 (class 2606 OID 74624)
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- TOC entry 3345 (class 2606 OID 82905)
-- Name: merchants unique_business_email; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchants
    ADD CONSTRAINT unique_business_email UNIQUE (business_email);


--
-- TOC entry 3347 (class 2606 OID 82903)
-- Name: merchants unique_wallet_address; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchants
    ADD CONSTRAINT unique_wallet_address UNIQUE (wallet_address);


--
-- TOC entry 3354 (class 1259 OID 74730)
-- Name: idx_merchant_activity_logs_activity_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_merchant_activity_logs_activity_type ON public.merchant_activity_logs USING btree (activity_type);


--
-- TOC entry 3355 (class 1259 OID 74731)
-- Name: idx_merchant_activity_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_merchant_activity_logs_created_at ON public.merchant_activity_logs USING btree (created_at);


--
-- TOC entry 3356 (class 1259 OID 74729)
-- Name: idx_merchant_activity_logs_merchant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_merchant_activity_logs_merchant_id ON public.merchant_activity_logs USING btree (merchant_id);


--
-- TOC entry 3339 (class 1259 OID 74712)
-- Name: idx_merchants_contract_registered; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_merchants_contract_registered ON public.merchants USING btree (contract_registered);


--
-- TOC entry 3340 (class 1259 OID 74713)
-- Name: idx_merchants_contract_tx_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_merchants_contract_tx_hash ON public.merchants USING btree (contract_transaction_hash);


--
-- TOC entry 3341 (class 1259 OID 74711)
-- Name: idx_merchants_wallet_address; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_merchants_wallet_address ON public.merchants USING btree (wallet_address);


--
-- TOC entry 3363 (class 2620 OID 74645)
-- Name: merchants update_merchant_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_merchant_updated_at BEFORE UPDATE ON public.merchants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3359 (class 2606 OID 74610)
-- Name: api_keys api_keys_merchant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE CASCADE;


--
-- TOC entry 3361 (class 2606 OID 74639)
-- Name: invoices invoices_merchant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE CASCADE;


--
-- TOC entry 3362 (class 2606 OID 74724)
-- Name: merchant_activity_logs merchant_activity_logs_merchant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.merchant_activity_logs
    ADD CONSTRAINT merchant_activity_logs_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE CASCADE;


--
-- TOC entry 3360 (class 2606 OID 74625)
-- Name: transactions transactions_merchant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE CASCADE;


-- Completed on 2025-08-23 00:10:20 WAT

--
-- PostgreSQL database dump complete
--

\unrestrict BvwtGqkFOq5Q2ipzuJSpQLawvVyCRhxxXcqvIPT8t3p14g4AfGY3MYIQISCAs5H

