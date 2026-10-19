-- gen_random_uuid() is built-in in PostgreSQL 13+
DO $$ BEGIN CREATE TYPE staff_role AS ENUM ('SUPER_ADMIN','SUPERVISOR','SUPPORT_AGENT','AUDITOR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE call_status AS ENUM ('RINGING','IN_PROGRESS','COMPLETED','FAILED','REJECTED','TRANSFERRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ticket_status AS ENUM ('OPEN','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE article_status AS ENUM ('DRAFT','PUBLISHED','ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS staff_users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
 password_hash TEXT NOT NULL, role staff_role NOT NULL DEFAULT 'SUPPORT_AGENT', active BOOLEAN NOT NULL DEFAULT TRUE,
 failed_login_count INT NOT NULL DEFAULT 0, locked_until TIMESTAMPTZ, last_login_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS calls (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), provider_call_id TEXT UNIQUE, provider TEXT NOT NULL DEFAULT 'openai_sip',
 from_number_masked TEXT, to_number_masked TEXT, status call_status NOT NULL DEFAULT 'RINGING', language TEXT,
 started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), answered_at TIMESTAMPTZ, ended_at TIMESTAMPTZ,
 duration_seconds INT, resolution TEXT, escalation_reason TEXT, transcript_storage_enabled BOOLEAN NOT NULL DEFAULT FALSE,
 metadata JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS calls_started_at_idx ON calls (started_at DESC);
CREATE INDEX IF NOT EXISTS calls_status_idx ON calls (status);
CREATE TABLE IF NOT EXISTS call_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
 provider_event_id TEXT UNIQUE, event_type TEXT NOT NULL, outcome TEXT NOT NULL DEFAULT 'SUCCESS',
 detail JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS call_events_call_idx ON call_events (call_id, created_at);
CREATE TABLE IF NOT EXISTS knowledge_articles (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT NOT NULL, category TEXT NOT NULL,
 content TEXT NOT NULL, status article_status NOT NULL DEFAULT 'DRAFT', version INT NOT NULL DEFAULT 1,
 created_by UUID REFERENCES staff_users(id), updated_by UUID REFERENCES staff_users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS knowledge_published_idx ON knowledge_articles (status, category);
CREATE TABLE IF NOT EXISTS support_tickets (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), reference_code TEXT NOT NULL UNIQUE,
 customer_reference TEXT, call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
 category TEXT NOT NULL, subject TEXT NOT NULL, description TEXT NOT NULL,
 status ticket_status NOT NULL DEFAULT 'OPEN', priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
 assigned_to UUID REFERENCES staff_users(id), created_by UUID REFERENCES staff_users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON support_tickets (status, priority, created_at DESC);
CREATE TABLE IF NOT EXISTS audit_logs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), actor_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
 actor_type TEXT NOT NULL DEFAULT 'STAFF', action TEXT NOT NULL, resource_type TEXT NOT NULL,
 resource_id TEXT, outcome TEXT NOT NULL DEFAULT 'SUCCESS', ip_address INET,
 details JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_logs (created_at DESC);
CREATE TABLE IF NOT EXISTS processed_webhook_events (
 event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), customer_reference TEXT NOT NULL UNIQUE,
 display_name TEXT NOT NULL, masked_phone TEXT NOT NULL, data_classification TEXT NOT NULL DEFAULT 'SYNTHETIC' CHECK (data_classification='SYNTHETIC'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS synthetic_accounts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_reference TEXT NOT NULL UNIQUE,
 customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
 account_type TEXT NOT NULL, currency CHAR(3) NOT NULL DEFAULT 'INR', available_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
 account_status TEXT NOT NULL DEFAULT 'ACTIVE', data_classification TEXT NOT NULL DEFAULT 'SYNTHETIC' CHECK (data_classification='SYNTHETIC'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS call_transcripts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
 sequence_no INT NOT NULL, speaker TEXT NOT NULL CHECK (speaker IN ('CUSTOMER','AI','AGENT','SYSTEM')),
 content TEXT NOT NULL, retention_until TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(call_id, sequence_no)
);
CREATE INDEX IF NOT EXISTS transcript_retention_idx ON call_transcripts (retention_until) WHERE retention_until IS NOT NULL;
CREATE TABLE IF NOT EXISTS integration_status (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), provider TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'NOT_CONFIGURED' CHECK (status IN ('NOT_CONFIGURED','CONFIGURED','DEGRADED','DISABLED')),
 public_metadata JSONB NOT NULL DEFAULT '{}', last_checked_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
