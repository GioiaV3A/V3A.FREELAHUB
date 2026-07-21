-- Migration: FreelaHUB v2.0 Database Schema
-- Incremental adaptation of schema for success fees, terça-feira payment projections, and evaluation reminders.

-- 1. Alterations on existing tables
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS is_competitive_bid boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS success_fee_enabled boolean DEFAULT false;

ALTER TABLE public.allocations
ADD COLUMN IF NOT EXISTS success_fee_enabled boolean DEFAULT false;

ALTER TABLE public.rate_policies
ADD COLUMN IF NOT EXISTS success_fee_max_percent numeric(5,2);

-- 2. Create system_settings table if not exists
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

-- Seed system_settings
INSERT INTO public.system_settings (key, value, description) VALUES
('evaluation_reminder_days', '3'::jsonb, 'Prazo inicial em dias corridos para o primeiro lembrete de avaliação após a conclusão.'),
('evaluation_escalation_multiplier', '2'::jsonb, 'Multiplicador do prazo para escalonamento da avaliação pendente ao Head.'),
('rc_lead_days', '10'::jsonb, 'Dias de antecedência exigidos para a abertura de RC no ERP de Supply.'),
('success_fee_requires_head_approval', 'true'::jsonb, 'Indica se negociações de success fee exigem aprovação do Head.')
ON CONFLICT (key) DO NOTHING;

-- 3. Create job_success_fee_rules table
CREATE TABLE IF NOT EXISTS public.job_success_fee_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  fee_type text CHECK (fee_type IN ('fixed', 'percentage')),
  fixed_amount numeric(12,2),
  percentage_rate numeric(5,2),
  percentage_base text,
  trigger_type text DEFAULT 'v3a_wins_bid',
  terms text,
  requires_approval boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  version integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_success_fee_rules_active_job 
ON public.job_success_fee_rules(job_id) WHERE is_active = true;

-- 4. Create negotiation_success_fees table
CREATE TABLE IF NOT EXISTS public.negotiation_success_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_id uuid NOT NULL REFERENCES public.negotiations(id) ON DELETE CASCADE,
  enabled boolean DEFAULT false,
  fee_type text CHECK (fee_type IN ('fixed', 'percentage')),
  fixed_amount numeric(12,2),
  percentage_rate numeric(5,2),
  percentage_base text,
  calculated_potential_amount numeric(12,2),
  trigger_type text DEFAULT 'v3a_wins_bid',
  terms text,
  accepted_by_freelancer boolean DEFAULT false,
  accepted_at timestamptz,
  approval_request_id uuid, -- Will be set if there is a value_policy/exception approval needed
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Create allocation_success_fees table
CREATE TABLE IF NOT EXISTS public.allocation_success_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NOT NULL REFERENCES public.allocations(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  freelancer_id uuid NOT NULL REFERENCES public.freelancers(id) ON DELETE CASCADE,
  fee_type text CHECK (fee_type IN ('fixed', 'percentage')),
  fixed_amount numeric(12,2),
  percentage_rate numeric(5,2),
  percentage_base text,
  potential_amount numeric(12,2),
  trigger_type text DEFAULT 'v3a_wins_bid',
  terms_snapshot text,
  status text NOT NULL DEFAULT 'pending_competition_result' CHECK (status IN ('not_applicable', 'pending_competition_result', 'eligible', 'not_eligible', 'cancelled')),
  eligible_at timestamptz,
  eligibility_confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ineligibility_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. Create job_competition_results table
CREATE TABLE IF NOT EXISTS public.job_competition_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE UNIQUE,
  result text NOT NULL CHECK (result IN ('pending', 'won', 'lost', 'cancelled')),
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz DEFAULT now(),
  evidence_reference text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. Create payment_policy_rules table
CREATE TABLE IF NOT EXISTS public.payment_policy_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text UNIQUE NOT NULL,
  min_duration_days integer,
  max_duration_days integer,
  rule_type text CHECK (rule_type IN ('after_end', 'within_period', 'monthly_cycle')),
  offset_days integer,
  payment_weekday text DEFAULT 'Tuesday',
  rc_lead_days integer DEFAULT 10,
  valid_from date NOT NULL,
  valid_until date,
  is_active boolean DEFAULT true,
  rule_payload jsonb,
  created_at timestamptz DEFAULT now()
);

-- 8. Create allocation_payment_projections table
CREATE TABLE IF NOT EXISTS public.allocation_payment_projections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NOT NULL REFERENCES public.allocations(id) ON DELETE CASCADE,
  cycle_number integer NOT NULL,
  cycle_start_date date NOT NULL,
  cycle_end_date date NOT NULL,
  suggested_payment_date date NOT NULL,
  suggested_rc_deadline date NOT NULL,
  alert_level text NOT NULL CHECK (alert_level IN ('informational', 'attention', 'urgent', 'critical')),
  policy_rule_id uuid REFERENCES public.payment_policy_rules(id) ON DELETE SET NULL,
  policy_version text,
  calculation_memory jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'recalculated', 'superseded', 'cancelled')),
  replaced_by_id uuid REFERENCES public.allocation_payment_projections(id) ON DELETE SET NULL,
  calculated_at timestamptz DEFAULT now(),
  calculation_source text CHECK (calculation_source IN ('system', 'recalculation', 'legacy')),
  triggered_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 9. Create evaluation_answers table
CREATE TABLE IF NOT EXISTS public.evaluation_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  criterion_key text NOT NULL,
  score numeric(2,1) NOT NULL,
  weight numeric(3,2) NOT NULL,
  comment text,
  created_at timestamptz DEFAULT now()
);

-- 10. Create evaluation_reminders table
CREATE TABLE IF NOT EXISTS public.evaluation_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NOT NULL REFERENCES public.allocations(id) ON DELETE CASCADE,
  evaluation_type text NOT NULL,
  first_due_at timestamptz NOT NULL,
  next_notification_at timestamptz NOT NULL,
  notification_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'waived', 'cancelled')),
  resolved_at timestamptz,
  waiver_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 11. Helper functions & routines

-- 11.1 calculate_alert_level
CREATE OR REPLACE FUNCTION public.calculate_alert_level(deadline date, start_date date)
RETURNS text SECURITY DEFINER AS $$
DECLARE
  days_to_deadline integer := deadline - CURRENT_DATE;
BEGIN
  IF days_to_deadline < 0 OR deadline < start_date THEN
    RETURN 'critical';
  ELSIF days_to_deadline <= 3 OR (deadline >= start_date AND deadline <= (start_date + 3)) THEN
    RETURN 'urgent';
  ELSIF days_to_deadline <= 10 THEN
    RETURN 'attention';
  ELSE
    RETURN 'informational';
  END IF;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 11.2 calculate_payment_projections_for_allocation
CREATE OR REPLACE FUNCTION public.calculate_payment_projections_for_allocation(alloc_id uuid)
RETURNS void SECURITY DEFINER AS $$
DECLARE
  v_start date;
  v_end date;
  v_duration integer;
  v_cycle_start date;
  v_cycle_end date;
  v_cycle_number integer := 1;
  v_proj_date date;
  v_deadline date;
  v_alert text;
  v_rule_version text := 'v1.0';
BEGIN
  -- Fetch start & end dates
  SELECT start_date, end_date INTO v_start, v_end FROM public.allocations WHERE id = alloc_id;
  IF v_start IS NULL OR v_end IS NULL THEN
    RETURN;
  END IF;
  
  v_duration := v_end - v_start + 1;
  
  -- Mark current active projections as superseded
  UPDATE public.allocation_payment_projections
  SET status = 'superseded'
  WHERE allocation_id = alloc_id AND status = 'active';
  
  -- Faixa 1: 1 a 15 dias
  IF v_duration <= 15 THEN
    v_proj_date := (v_end + 15) - ((extract(dow from v_end + 15)::integer - 2 + 7) % 7);
    -- Ensure it is strictly posterior to end_date
    IF v_proj_date <= v_end THEN
      v_proj_date := v_proj_date + 7;
    END IF;
    
    v_deadline := v_proj_date - 10;
    v_alert := public.calculate_alert_level(v_deadline, v_start);
    
    INSERT INTO public.allocation_payment_projections (
      allocation_id, cycle_number, cycle_start_date, cycle_end_date,
      suggested_payment_date, suggested_rc_deadline, alert_level,
      policy_version, calculation_memory, status, calculation_source
    ) VALUES (
      alloc_id, 1, v_start, v_end,
      v_proj_date, v_deadline, v_alert,
      v_rule_version, jsonb_build_object('faixa', '1-15 dias', 'duration', v_duration), 'active', 'system'
    );
    
  -- Faixa 2: 16 a 21 dias
  ELSIF v_duration <= 21 THEN
    v_proj_date := (v_end + 7) - ((extract(dow from v_end + 7)::integer - 2 + 7) % 7);
    -- Ensure strictly posterior
    IF v_proj_date <= v_end THEN
      v_proj_date := v_proj_date + 7;
    END IF;
    
    v_deadline := v_proj_date - 10;
    v_alert := public.calculate_alert_level(v_deadline, v_start);
    
    INSERT INTO public.allocation_payment_projections (
      allocation_id, cycle_number, cycle_start_date, cycle_end_date,
      suggested_payment_date, suggested_rc_deadline, alert_level,
      policy_version, calculation_memory, status, calculation_source
    ) VALUES (
      alloc_id, 1, v_start, v_end,
      v_proj_date, v_deadline, v_alert,
      v_rule_version, jsonb_build_object('faixa', '16-21 dias', 'duration', v_duration), 'active', 'system'
    );
    
  -- Faixa 3: 22 a 30 dias
  ELSIF v_duration <= 30 THEN
    v_proj_date := v_end - ((extract(dow from v_end)::integer - 2 + 7) % 7);
    -- Handle edge case: if no Tuesday in period (highly unlikely for 22+ days, but for safety)
    IF v_proj_date < v_start THEN
      v_proj_date := v_start + ((2 - extract(dow from v_start)::integer + 7) % 7);
    END IF;
    
    v_deadline := v_proj_date - 10;
    v_alert := public.calculate_alert_level(v_deadline, v_start);
    
    INSERT INTO public.allocation_payment_projections (
      allocation_id, cycle_number, cycle_start_date, cycle_end_date,
      suggested_payment_date, suggested_rc_deadline, alert_level,
      policy_version, calculation_memory, status, calculation_source
    ) VALUES (
      alloc_id, 1, v_start, v_end,
      v_proj_date, v_deadline, v_alert,
      v_rule_version, jsonb_build_object('faixa', '22-30 dias', 'duration', v_duration), 'active', 'system'
    );
    
  -- Faixa 4: Acima de 30 dias (ciclos mensais)
  ELSE
    v_cycle_start := v_start;
    WHILE v_cycle_start <= v_end LOOP
      v_cycle_end := v_cycle_start + interval '1 month' - interval '1 day';
      
      -- Check if residual is <= 15 days, if so incorporate it
      IF (v_end - v_cycle_end) <= 15 THEN
        v_cycle_end := v_end;
      END IF;
      
      v_proj_date := v_cycle_end - ((extract(dow from v_cycle_end)::integer - 2 + 7) % 7);
      
      IF v_proj_date < v_cycle_start THEN
        v_proj_date := v_cycle_start + ((2 - extract(dow from v_cycle_start)::integer + 7) % 7);
      END IF;
      
      v_deadline := v_proj_date - 10;
      v_alert := public.calculate_alert_level(v_deadline, v_start);
      
      INSERT INTO public.allocation_payment_projections (
        allocation_id, cycle_number, cycle_start_date, cycle_end_date,
        suggested_payment_date, suggested_rc_deadline, alert_level,
        policy_version, calculation_memory, status, calculation_source
      ) VALUES (
        alloc_id, v_cycle_number, v_cycle_start, v_cycle_end,
        v_proj_date, v_deadline, v_alert,
        v_rule_version, jsonb_build_object('faixa', '31+ dias', 'cycle_duration', v_cycle_end - v_cycle_start + 1), 'active', 'system'
      );
      
      v_cycle_number := v_cycle_number + 1;
      v_cycle_start := v_cycle_end + 1;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 12. Triggers for Projections & Success Fee

-- 12.1 trigger_on_allocation_modified
CREATE OR REPLACE FUNCTION public.on_allocation_modified_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.calculate_payment_projections_for_allocation(NEW.id);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Recalculate if dates change
    IF OLD.start_date != NEW.start_date OR OLD.end_date != NEW.end_date THEN
      PERFORM public.calculate_payment_projections_for_allocation(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_on_allocation_modified ON public.allocations;
CREATE TRIGGER trigger_on_allocation_modified
AFTER INSERT OR UPDATE OF start_date, end_date ON public.allocations
FOR EACH ROW
EXECUTE FUNCTION public.on_allocation_modified_trigger();

-- 12.2 trigger_snapshot_success_fee_on_alloc
CREATE OR REPLACE FUNCTION public.snapshot_success_fee_on_allocation()
RETURNS TRIGGER AS $$
DECLARE
  v_negotiation_fee RECORD;
BEGIN
  IF NEW.success_fee_enabled THEN
    -- Find and snapshot the negotiated success fee conditions
    SELECT * INTO v_negotiation_fee 
    FROM public.negotiation_success_fees 
    WHERE negotiation_id = NEW.negotiation_id 
      AND enabled = true;
      
    IF FOUND THEN
      INSERT INTO public.allocation_success_fees (
        allocation_id, job_id, freelancer_id, fee_type,
        fixed_amount, percentage_rate, percentage_base, potential_amount,
        trigger_type, terms_snapshot, status
      ) VALUES (
        NEW.id, NEW.job_id, NEW.freelancer_id, v_negotiation_fee.fee_type,
        v_negotiation_fee.fixed_amount, v_negotiation_fee.percentage_rate, v_negotiation_fee.percentage_base, v_negotiation_fee.calculated_potential_amount,
        v_negotiation_fee.trigger_type, v_negotiation_fee.terms, 'pending_competition_result'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_snapshot_success_fee_on_alloc ON public.allocations;
CREATE TRIGGER trigger_snapshot_success_fee_on_alloc
AFTER INSERT ON public.allocations
FOR EACH ROW
EXECUTE FUNCTION public.snapshot_success_fee_on_allocation();

-- 12.3 trigger_on_competition_result_confirmed
CREATE OR REPLACE FUNCTION public.on_competition_result_confirmed_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.result = 'won' THEN
    UPDATE public.allocation_success_fees
    SET status = 'eligible', eligible_at = NEW.confirmed_at, eligibility_confirmed_by = NEW.confirmed_by
    WHERE job_id = NEW.job_id AND status = 'pending_competition_result';
  ELSIF NEW.result = 'lost' THEN
    UPDATE public.allocation_success_fees
    SET status = 'not_eligible'
    WHERE job_id = NEW.job_id AND status = 'pending_competition_result';
  ELSIF NEW.result = 'cancelled' THEN
    UPDATE public.allocation_success_fees
    SET status = 'cancelled'
    WHERE job_id = NEW.job_id AND status = 'pending_competition_result';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_on_competition_result_confirmed ON public.job_competition_results;
CREATE TRIGGER trigger_on_competition_result_confirmed
AFTER INSERT OR UPDATE OF result ON public.job_competition_results
FOR EACH ROW
EXECUTE FUNCTION public.on_competition_result_confirmed_trigger();

-- 12.4 trigger_create_evaluation_reminder_on_completion
CREATE OR REPLACE FUNCTION public.create_evaluation_reminder_on_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_reminder_days integer := 3;
BEGIN
  IF NEW.status = 'concluido' OR NEW.status = 'completed' OR NEW.status = 'delivered' THEN
    -- Read from system_settings
    SELECT COALESCE((value->>0)::integer, 3) INTO v_reminder_days 
    FROM public.system_settings 
    WHERE key = 'evaluation_reminder_days';
    
    -- Create reminder for freelancer evaluation
    INSERT INTO public.evaluation_reminders (
      allocation_id, evaluation_type, first_due_at, next_notification_at, status
    ) VALUES (
      NEW.id, 'final_freelancer', now() + (v_reminder_days || ' days')::interval, now() + (v_reminder_days || ' days')::interval, 'pending'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_evaluation_reminder_on_completion ON public.allocations;
CREATE TRIGGER trigger_create_evaluation_reminder_on_completion
AFTER UPDATE OF status ON public.allocations
FOR EACH ROW
EXECUTE FUNCTION public.create_evaluation_reminder_on_completion();

-- 13. Block writes on payment_requests (Compliance)
CREATE OR REPLACE FUNCTION public.block_payment_requests_writes()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'A criação ou alteração de solicitações de pagamento (payment_requests) foi desativada na v2.0 do FreelaHUB.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_block_payment_requests_writes ON public.payment_requests;
CREATE TRIGGER trigger_block_payment_requests_writes
BEFORE INSERT OR UPDATE ON public.payment_requests
FOR EACH ROW
EXECUTE FUNCTION public.block_payment_requests_writes();
