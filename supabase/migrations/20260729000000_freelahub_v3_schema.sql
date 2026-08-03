-- Migration for FREELA HUB v3.0 Schema
-- File: 20260729000000_freelahub_v3_schema.sql

-- 1. Ensure jobs.job_code constraint and backfill existing rows
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'job_code'
    ) THEN
        ALTER TABLE public.jobs ADD COLUMN job_code TEXT;
    END IF;
END $$;

-- Backfill legacy job_code values if they don't match XX-XXXX-XXX format
WITH legacy_jobs AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as seq
    FROM public.jobs
    WHERE job_code IS NULL OR job_code NOT SIMILAR TO '[0-9]{2}-[0-9]{4}-[0-9]{3}'
)
UPDATE public.jobs j
SET job_code = '26-0000-' || LPAD(seq::text, 3, '0')
FROM legacy_jobs lj
WHERE j.id = lj.id;

-- Add NOT NULL constraint if not already set
ALTER TABLE public.jobs ALTER COLUMN job_code SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_schema = 'public' AND table_name = 'jobs' AND constraint_name = 'check_job_code_format'
    ) THEN
        ALTER TABLE public.jobs ADD CONSTRAINT check_job_code_format CHECK (job_code ~ '^\d{2}-\d{4}-\d{3}$');
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_job_code ON public.jobs(job_code);


-- 2. Add job_code to allocations table and backfill
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'allocations' AND column_name = 'job_code'
    ) THEN
        ALTER TABLE public.allocations ADD COLUMN job_code TEXT;
    END IF;
END $$;

UPDATE public.allocations a
SET job_code = j.job_code
FROM public.jobs j
WHERE a.job_id = j.id AND (a.job_code IS NULL OR a.job_code NOT SIMILAR TO '[0-9]{2}-[0-9]{4}-[0-9]{3}');

CREATE INDEX IF NOT EXISTS idx_allocations_job_code ON public.allocations(job_code);


-- 3. Create proposal_invitations table
CREATE TABLE IF NOT EXISTS public.proposal_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE RESTRICT,
    job_code TEXT NOT NULL,
    freelancer_id UUID NOT NULL REFERENCES public.freelancers(id) ON DELETE RESTRICT,
    shortlist_candidate_id UUID REFERENCES public.shortlist_candidates(id) ON DELETE SET NULL,
    negotiation_id UUID REFERENCES public.negotiations(id) ON DELETE SET NULL,
    public_link_id UUID REFERENCES public.public_form_links(id) ON DELETE SET NULL,

    status TEXT NOT NULL DEFAULT 'created',
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,

    response_type TEXT,
    refusal_reason TEXT,
    freelancer_notes TEXT,

    ip_address TEXT,
    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES public.profiles(id),

    CONSTRAINT check_proposal_invitation_status CHECK (
        status IN (
            'created', 'sent', 'delivered', 'opened', 'waiting_response', 
            'accepted', 'accepted_with_reservations', 'refused', 'expired', 'cancelled', 'reopened'
        )
    ),
    CONSTRAINT check_proposal_response_type CHECK (
        response_type IS NULL OR response_type IN ('accepted', 'accepted_with_reservations', 'refused')
    ),
    CONSTRAINT check_proposal_job_code_format CHECK (job_code ~ '^\d{2}-\d{4}-\d{3}$')
);

CREATE INDEX IF NOT EXISTS idx_proposal_invitations_job_id ON public.proposal_invitations(job_id);
CREATE INDEX IF NOT EXISTS idx_proposal_invitations_job_code ON public.proposal_invitations(job_code);
CREATE INDEX IF NOT EXISTS idx_proposal_invitations_freelancer_id ON public.proposal_invitations(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_proposal_invitations_status ON public.proposal_invitations(status);
CREATE INDEX IF NOT EXISTS idx_proposal_invitations_public_link_id ON public.proposal_invitations(public_link_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_proposal_invitation_job_freelancer
ON public.proposal_invitations(job_id, freelancer_id)
WHERE deleted_at IS NULL AND status NOT IN ('cancelled', 'expired');


-- 4. Create email_events table
CREATE TABLE IF NOT EXISTS public.email_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    event_type TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    template_key TEXT NOT NULL,

    related_job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    related_job_code TEXT,
    related_freelancer_id UUID REFERENCES public.freelancers(id) ON DELETE SET NULL,
    related_public_link_id UUID REFERENCES public.public_form_links(id) ON DELETE SET NULL,
    related_proposal_invitation_id UUID REFERENCES public.proposal_invitations(id) ON DELETE SET NULL,

    status TEXT NOT NULL DEFAULT 'pending',
    provider_message_id TEXT,
    error_message TEXT,

    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id),
    metadata JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT check_email_events_status CHECK (
        status IN ('pending', 'sent', 'failed', 'error', 'cancelled')
    ),
    CONSTRAINT check_email_events_type CHECK (
        event_type IN ('proposal_dispatch', 'proposal_response_notification', 'reminder', 'evaluation_alert', 'system_notification')
    )
);

CREATE INDEX IF NOT EXISTS idx_email_events_status ON public.email_events(status);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type ON public.email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_related_job_id ON public.email_events(related_job_id);
CREATE INDEX IF NOT EXISTS idx_email_events_related_job_code ON public.email_events(related_job_code);
CREATE INDEX IF NOT EXISTS idx_email_events_recipient_email ON public.email_events(recipient_email);


-- 5. Extend public_form_links table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'public_form_links' AND column_name = 'job_id') THEN
        ALTER TABLE public.public_form_links ADD COLUMN job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'public_form_links' AND column_name = 'job_code') THEN
        ALTER TABLE public.public_form_links ADD COLUMN job_code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'public_form_links' AND column_name = 'shortlist_candidate_id') THEN
        ALTER TABLE public.public_form_links ADD COLUMN shortlist_candidate_id UUID REFERENCES public.shortlist_candidates(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'public_form_links' AND column_name = 'negotiation_id') THEN
        ALTER TABLE public.public_form_links ADD COLUMN negotiation_id UUID REFERENCES public.negotiations(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'public_form_links' AND column_name = 'proposal_invitation_id') THEN
        ALTER TABLE public.public_form_links ADD COLUMN proposal_invitation_id UUID REFERENCES public.proposal_invitations(id) ON DELETE SET NULL;
    END IF;
END $$;


-- 6. Enable RLS on new tables and add policies
ALTER TABLE public.proposal_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_view_proposal_invitations') THEN
        CREATE POLICY "authenticated_view_proposal_invitations" ON public.proposal_invitations
            FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_insert_proposal_invitations') THEN
        CREATE POLICY "authenticated_insert_proposal_invitations" ON public.proposal_invitations
            FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_update_proposal_invitations') THEN
        CREATE POLICY "authenticated_update_proposal_invitations" ON public.proposal_invitations
            FOR UPDATE TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_view_email_events') THEN
        CREATE POLICY "authenticated_view_email_events" ON public.email_events
            FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_insert_email_events') THEN
        CREATE POLICY "authenticated_insert_email_events" ON public.email_events
            FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
END $$;


-- 7. RPC Function to fetch proposal data securely by public token (for anonymous access)
CREATE OR REPLACE FUNCTION get_public_proposal_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_link public.public_form_links%ROWTYPE;
    v_job public.jobs%ROWTYPE;
    v_invitation public.proposal_invitations%ROWTYPE;
    v_freelancer public.freelancers%ROWTYPE;
    v_nucleo public.nucleos%ROWTYPE;
    v_result jsonb;
BEGIN
    SELECT * INTO v_link
    FROM public.public_form_links
    WHERE (token_hash = p_token OR metadata->>'token' = p_token OR id::text = p_token)
      AND link_type = 'proposal_response'
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Link de proposta não encontrado ou inválido.');
    END IF;

    IF v_link.status = 'revoked' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este link foi revogado.');
    END IF;

    IF v_link.expires_at IS NOT NULL AND v_link.expires_at < NOW() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este link de proposta expirou.');
    END IF;

    IF v_link.status = 'used' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Esta proposta já foi respondida anteriormente.');
    END IF;

    SELECT * INTO v_job FROM public.jobs WHERE id = v_link.job_id;
    SELECT * INTO v_freelancer FROM public.freelancers WHERE id = v_link.freelancer_id;
    SELECT * INTO v_nucleo FROM public.nucleos WHERE id = v_job.nucleo_id;
    
    IF v_link.proposal_invitation_id IS NOT NULL THEN
        SELECT * INTO v_invitation FROM public.proposal_invitations WHERE id = v_link.proposal_invitation_id;
    END IF;

    -- Update opened_at if first time opening
    IF v_invitation.id IS NOT NULL AND v_invitation.opened_at IS NULL THEN
        UPDATE public.proposal_invitations
        SET opened_at = NOW(), status = CASE WHEN status = 'sent' THEN 'opened' ELSE status END
        WHERE id = v_invitation.id;
    END IF;

    v_result := jsonb_build_object(
        'success', true,
        'link_id', v_link.id,
        'invitation_id', v_invitation.id,
        'job_id', v_job.id,
        'job_code', v_job.job_code,
        'job_title', v_job.title,
        'client_name', v_job.client_name,
        'nucleo_name', COALESCE(v_nucleo.name, 'V3A'),
        'freelancer_id', v_freelancer.id,
        'freelancer_name', v_freelancer.full_name,
        'start_date', v_job.start_date,
        'end_date', v_job.end_date,
        'description', v_job.description,
        'remuneration_model', v_job.remuneration_model,
        'expected_total_value', v_job.expected_total_value,
        'is_competitive_bid', COALESCE(v_job.is_competitive_bid, false),
        'success_fee_enabled', COALESCE(v_job.success_fee_enabled, false),
        'status', v_link.status,
        'expires_at', v_link.expires_at
    );

    RETURN v_result;
END;
$$;
