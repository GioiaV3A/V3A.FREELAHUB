-- Migration to add financial columns and constraints to public.jobs table

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS payment_model text DEFAULT 'single',
ADD COLUMN IF NOT EXISTS expected_total_value numeric(14,2),
ADD COLUMN IF NOT EXISTS expected_daily_value numeric(14,2),
ADD COLUMN IF NOT EXISTS expected_monthly_value numeric(14,2),
ADD COLUMN IF NOT EXISTS expected_closed_value numeric(14,2),
ADD COLUMN IF NOT EXISTS payment_day integer,
ADD COLUMN IF NOT EXISTS installments_count integer,
ADD COLUMN IF NOT EXISTS suggested_installments_count integer,
ADD COLUMN IF NOT EXISTS payment_dates jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS selected_payment_dates jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS deselected_payment_dates jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS policy_reference_value numeric(14,2),
ADD COLUMN IF NOT EXISTS policy_cap_value numeric(14,2),
ADD COLUMN IF NOT EXISTS policy_reference_total numeric(14,2),
ADD COLUMN IF NOT EXISTS policy_cap_total numeric(14,2),
ADD COLUMN IF NOT EXISTS policy_discount_percent numeric(8,4),
ADD COLUMN IF NOT EXISTS policy_discount_amount_reference numeric(14,2),
ADD COLUMN IF NOT EXISTS policy_discount_amount_cap numeric(14,2),
ADD COLUMN IF NOT EXISTS policy_exceeded boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS policy_excess_amount numeric(14,2),
ADD COLUMN IF NOT EXISTS policy_excess_percent numeric(8,4),
ADD COLUMN IF NOT EXISTS policy_status text DEFAULT 'not_evaluated',
ADD COLUMN IF NOT EXISTS policy_calc_memory jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS requires_head_approval boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'not_required',
ADD COLUMN IF NOT EXISTS approval_reason text,
ADD COLUMN IF NOT EXISTS created_by_user_id uuid,
ADD COLUMN IF NOT EXISTS created_by_profile text,
ADD COLUMN IF NOT EXISTS created_by_nucleo_id uuid;

ALTER TABLE public.jobs ALTER COLUMN remuneration_model SET DEFAULT 'daily';

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS check_payment_model;
ALTER TABLE public.jobs ADD CONSTRAINT check_payment_model CHECK (payment_model IN ('single', 'recurring'));

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS check_remuneration_model;
ALTER TABLE public.jobs ADD CONSTRAINT check_remuneration_model CHECK (remuneration_model IN ('daily', 'hourly', 'monthly', 'closed_package') OR remuneration_model IS NULL);

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS check_policy_status;
ALTER TABLE public.jobs ADD CONSTRAINT check_policy_status CHECK (policy_status IN ('not_evaluated', 'within_policy', 'above_policy', 'missing_policy'));

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS check_approval_status;
ALTER TABLE public.jobs ADD CONSTRAINT check_approval_status CHECK (approval_status IN ('not_required', 'pending_head_approval', 'approved', 'rejected'));
