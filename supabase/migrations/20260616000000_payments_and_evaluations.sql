-- Migration: Alocação Recorrente, Faturamento e Avaliação 360°

-- 1. Alterations on allocations table
ALTER TABLE public.allocations
ADD COLUMN IF NOT EXISTS payment_model text DEFAULT 'one_time' CHECK (payment_model IN ('one_time', 'monthly_recurring', 'milestone')),
ADD COLUMN IF NOT EXISTS contract_start_date date,
ADD COLUMN IF NOT EXISTS contract_end_date date,
ADD COLUMN IF NOT EXISTS recurrence_frequency text DEFAULT 'none' CHECK (recurrence_frequency IN ('none', 'monthly', 'custom')),
ADD COLUMN IF NOT EXISTS recurring_amount numeric(12,2),
ADD COLUMN IF NOT EXISTS total_contract_value numeric(12,2),
ADD COLUMN IF NOT EXISTS payment_terms text,
ADD COLUMN IF NOT EXISTS payment_notes text,
ADD COLUMN IF NOT EXISTS payment_request_status text DEFAULT 'not_requested' CHECK (payment_request_status IN ('not_requested', 'partially_requested', 'requested', 'completed', 'cancelled')),
ADD COLUMN IF NOT EXISTS evaluation_status text DEFAULT 'locked' CHECK (evaluation_status IN ('locked', 'available', 'pending', 'completed')),
ADD COLUMN IF NOT EXISTS reverse_evaluation_status text DEFAULT 'not_generated' CHECK (reverse_evaluation_status IN ('not_generated', 'generated', 'sent', 'completed', 'expired')),
ADD COLUMN IF NOT EXISTS evaluated_freelancer boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS evaluated_delivery boolean DEFAULT false;

-- 2. Create allocation_payment_schedules table
CREATE TABLE IF NOT EXISTS public.allocation_payment_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NOT NULL REFERENCES public.allocations(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  freelancer_id uuid NOT NULL REFERENCES public.freelancers(id) ON DELETE CASCADE,
  nucleo_id uuid NOT NULL REFERENCES public.nucleos(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  reference_period_start date NOT NULL,
  reference_period_end date NOT NULL,
  due_date date,
  amount numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'payment_request_generated', 'exported', 'sent_to_finance', 'finance_code_received', 'paid', 'cancelled')),
  payment_request_id uuid, -- Reference to payment_requests table, added as FK after creating the table
  finance_code text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Create payment_requests table
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code text UNIQUE NOT NULL,
  allocation_id uuid NOT NULL REFERENCES public.allocations(id) ON DELETE CASCADE,
  payment_schedule_id uuid REFERENCES public.allocation_payment_schedules(id) ON DELETE SET NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  freelancer_id uuid NOT NULL REFERENCES public.freelancers(id) ON DELETE CASCADE,
  nucleo_id uuid NOT NULL REFERENCES public.nucleos(id) ON DELETE CASCADE,
  issued_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  issued_by_role text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('one_time', 'recurring_installment', 'milestone')),
  payment_number integer,
  total_payments integer,
  reference_period_start date,
  reference_period_end date,
  amount numeric(12,2) NOT NULL,
  payment_due_date date,
  payment_description text,
  payment_justification text,
  document_status text NOT NULL DEFAULT 'generated' CHECK (document_status IN ('generated', 'exported', 'sent_to_finance', 'finance_code_registered', 'paid', 'cancelled')),
  exported_at timestamptz,
  exported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  document_url text,
  document_file_name text,
  finance_code text,
  finance_code_registered_at timestamptz,
  finance_code_registered_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add Foreign Key to allocation_payment_schedules referencing payment_requests
ALTER TABLE public.allocation_payment_schedules
ADD CONSTRAINT fk_schedule_payment_request FOREIGN KEY (payment_request_id) REFERENCES public.payment_requests(id) ON DELETE SET NULL;

-- 4. Create reverse_evaluation_links table
CREATE TABLE IF NOT EXISTS public.reverse_evaluation_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  allocation_id uuid NOT NULL REFERENCES public.allocations(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  freelancer_id uuid NOT NULL REFERENCES public.freelancers(id) ON DELETE CASCADE,
  nucleo_id uuid NOT NULL REFERENCES public.nucleos(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  expires_at timestamptz,
  used_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Extend evaluations table with new criteria
ALTER TABLE public.evaluations
ADD COLUMN IF NOT EXISTS reliability integer CHECK (reliability BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS culture_processes integer CHECK (culture_processes BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS rework integer CHECK (rework BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS scope_adherence integer CHECK (scope_adherence BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS materials_quality integer CHECK (materials_quality BETWEEN 1 AND 5);

-- 6. Extend reverse_evaluations table
ALTER TABLE public.reverse_evaluations
ADD COLUMN IF NOT EXISTS reverse_evaluation_link_id uuid REFERENCES public.reverse_evaluation_links(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS leadership_quality integer CHECK (leadership_quality BETWEEN 1 AND 5);

-- 7. Update calculate_evaluation_final_score function for new weights
CREATE OR REPLACE FUNCTION public.calculate_evaluation_final_score()
RETURNS TRIGGER AS $$
DECLARE
  delivery_score numeric(4,3);
  freelancer_score numeric(4,3);
  weighted_avg numeric(4,3);
BEGIN
  -- Delivery score (60%):
  -- technical_quality (25%), briefing_adherence (20%), deadline (15%), rework (10%), scope_adherence (10%), cost_benefit (10%), materials_quality (10%)
  delivery_score := COALESCE(NEW.technical_quality, 5) * 0.25 +
                    COALESCE(NEW.briefing_adherence, 5) * 0.20 +
                    COALESCE(NEW.deadline, 5) * 0.15 +
                    COALESCE(NEW.rework, 5) * 0.10 +
                    COALESCE(NEW.scope_adherence, 5) * 0.10 +
                    COALESCE(NEW.cost_benefit, 5) * 0.10 +
                    COALESCE(NEW.materials_quality, 5) * 0.10;

  -- Freelancer behavior score (40%):
  -- communication (20%), autonomy (15%), reliability (20%), collaboration (15%), flexibility (10%), behavior (10%), culture_processes (10%)
  freelancer_score := COALESCE(NEW.communication, 5) * 0.20 +
                      COALESCE(NEW.autonomy, 5) * 0.15 +
                      COALESCE(NEW.reliability, 5) * 0.20 +
                      COALESCE(NEW.collaboration, 5) * 0.15 +
                      COALESCE(NEW.flexibility, 5) * 0.10 +
                      COALESCE(NEW.behavior, 5) * 0.10 +
                      COALESCE(NEW.culture_processes, 5) * 0.10;

  weighted_avg := (delivery_score * 0.60) + (freelancer_score * 0.40);

  NEW.weighted_average := weighted_avg;
  NEW.final_score := weighted_avg; -- Backwards compatibility
  NEW.score_0_100 := ((weighted_avg - 1.0) / 4.0) * 100.0;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Reapply triggers for evaluations score calculations
DROP TRIGGER IF EXISTS trigger_calculate_evaluation_final_score ON public.evaluations;
CREATE TRIGGER trigger_calculate_evaluation_final_score
BEFORE INSERT OR UPDATE OF 
  technical_quality, briefing_adherence, deadline, rework, scope_adherence, cost_benefit, materials_quality,
  communication, autonomy, reliability, collaboration, flexibility, behavior, culture_processes
ON public.evaluations
FOR EACH ROW
EXECUTE FUNCTION public.calculate_evaluation_final_score();

-- 8. Update recalculate_freelancer_score_history trigger function
CREATE OR REPLACE FUNCTION public.recalculate_freelancer_score_history()
RETURNS TRIGGER AS $$
DECLARE
  f_id uuid;
  eval_count integer;
  recency_score numeric(5,2);
  rec_rate numeric(5,2);
  reliability_score numeric(5,2);
  culture_score numeric(5,2);
  final_consolidated numeric(5,2);
  op_status text;
  r RECORD;
  i integer := 0;
  w_sum numeric(5,2) := 0;
  v_sum numeric(5,2) := 0;
  w numeric(5,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    f_id := OLD.freelancer_id;
  ELSE
    f_id := NEW.freelancer_id;
  END IF;

  -- 1. Count evaluations
  SELECT COUNT(*) INTO eval_count FROM public.evaluations WHERE freelancer_id = f_id AND status = 'submitted';

  IF eval_count = 0 THEN
    UPDATE public.freelancers
    SET consolidated_score = 0, average_score = 0, recommendation_rate = 0, operational_status = 'Elegível'
    WHERE id = f_id;
    RETURN NULL;
  END IF;

  -- 2. Recency calculations
  -- Last evaluation: 40%
  -- Penultimate: 25%
  -- Antepenultimate: 15%
  -- Remaining: 20% distributed equally
  FOR r IN (
    SELECT e.score_0_100, e.evaluator_id, p.role as evaluator_role
    FROM public.evaluations e
    LEFT JOIN public.profiles p ON e.evaluator_id = p.id
    WHERE e.freelancer_id = f_id AND e.status = 'submitted'
    ORDER BY e.created_at DESC
  ) LOOP
    i := i + 1;
    IF i = 1 THEN
      w := 40.0;
    ELSIF i = 2 THEN
      w := 25.0;
    ELSIF i = 3 THEN
      w := 15.0;
    ELSE
      w := 20.0 / GREATEST(1, eval_count - 3);
    END IF;

    v_sum := v_sum + (r.score_0_100 * w);
    w_sum := w_sum + w;
  END LOOP;

  recency_score := v_sum / w_sum;

  -- 3. Leader Recommendation Rate
  SELECT COALESCE(COUNT(CASE WHEN would_hire_again IN ('sim', 'talvez') THEN 1 END)::numeric / COUNT(*)::numeric * 100.0, 0)
  INTO rec_rate
  FROM public.evaluations
  WHERE freelancer_id = f_id AND status = 'submitted';

  -- 4. Operational Reliability (reliability average scaled 0-100)
  SELECT COALESCE(AVG((COALESCE(reliability, deadline) - 1) / 4.0 * 100.0), 0)
  INTO reliability_score
  FROM public.evaluations
  WHERE freelancer_id = f_id AND status = 'submitted';

  -- 5. Aderência cultural / comportamento average scaled 0-100
  SELECT COALESCE(AVG((COALESCE(culture_processes, behavior) - 1) / 4.0 * 100.0), 0)
  INTO culture_score
  FROM public.evaluations
  WHERE freelancer_id = f_id AND status = 'submitted';

  -- 6. Consolidated Formula
  -- Média ponderada recency: 70%
  -- Taxa de recomendação: 15%
  -- Confiabilidade operacional: 10%
  -- Aderência cultural: 5%
  final_consolidated := (recency_score * 0.70) + (rec_rate * 0.15) + (reliability_score * 0.10) + (culture_score * 0.05);

  -- 7. Determine operational status
  IF final_consolidated >= 90.0 THEN
    op_status := 'Preferencial';
  ELSIF final_consolidated >= 80.0 THEN
    op_status := 'Recomendado';
  ELSIF final_consolidated >= 65.0 THEN
    op_status := 'Elegível';
  ELSIF final_consolidated >= 50.0 THEN
    op_status := 'Em observação';
  ELSIF final_consolidated >= 35.0 THEN
    op_status := 'Restrito';
  ELSE
    op_status := 'Não recomendado';
  END IF;

  -- 8. Save snapshot
  INSERT INTO public.freelancer_score_snapshots (
    freelancer_id,
    consolidated_score,
    delivery_average_score,
    recommendation_rate,
    operational_reliability_score,
    culture_process_score,
    operational_status,
    details
  ) VALUES (
    f_id,
    final_consolidated,
    recency_score,
    rec_rate,
    reliability_score,
    culture_score,
    op_status,
    json_build_object('eval_count', eval_count)
  );

  -- 9. Update freelancer record
  UPDATE public.freelancers
  SET 
    consolidated_score = final_consolidated,
    average_score = final_consolidated,
    recommendation_rate = rec_rate,
    operational_status = op_status,
    status = CASE WHEN final_consolidated < 35.0 THEN 'bloqueado'::freelancer_status ELSE 'elegivel'::freelancer_status END
  WHERE id = f_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Reapply triggers for evaluations history recalculation
DROP TRIGGER IF EXISTS trigger_update_freelancer_scores_avg ON public.evaluations;
CREATE TRIGGER trigger_update_freelancer_scores_avg
AFTER INSERT OR UPDATE OR DELETE ON public.evaluations
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_freelancer_score_history();

-- 9. Update calculate_reverse_evaluation_scores function to utilize leadership_quality
CREATE OR REPLACE FUNCTION public.calculate_reverse_evaluation_scores()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Leader Score Component (Liderança direta + Comunicação + Velocidade de decisão)
  NEW.leader_score_component := (((COALESCE(NEW.leadership_quality, NEW.direct_leadership, 5) * 0.50 + 
                                  COALESCE(NEW.communication, 5) * 0.25 + 
                                  COALESCE(NEW.decision_speed, 5) * 0.25) - 1.0) / 4.0) * 100.0;
  
  -- 2. Project Health Score (Clareza do briefing + Alinhamento do escopo + Organização + Condições de trabalho)
  NEW.project_experience_score := (((COALESCE(NEW.briefing_clarity, 5) * 0.35 + 
                                    COALESCE(NEW.scope_alignment, 5) * 0.30 + 
                                    COALESCE(NEW.project_organization, 5) * 0.20 + 
                                    COALESCE(NEW.working_conditions, 5) * 0.15) - 1.0) / 4.0) * 100.0;

  -- 3. Nucleus Experience Component (Comunicação + Velocidade de decisão + Fluxo administrativo)
  NEW.nucleus_experience_component := (((COALESCE(NEW.communication, 5) * 0.40 + 
                                        COALESCE(NEW.decision_speed, 5) * 0.40 + 
                                        COALESCE(NEW.administrative_flow, 5) * 0.20) - 1.0) / 4.0) * 100.0;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Reapply triggers for reverse evaluations scores calculations
DROP TRIGGER IF EXISTS trigger_calculate_reverse_scores ON public.reverse_evaluations;
CREATE TRIGGER trigger_calculate_reverse_scores
BEFORE INSERT OR UPDATE ON public.reverse_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.calculate_reverse_evaluation_scores();

-- 10. Row Level Security (RLS) Policies Setup

-- Enable RLS on new tables
ALTER TABLE public.allocation_payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reverse_evaluation_links ENABLE ROW LEVEL SECURITY;

-- A. allocation_payment_schedules Policies
DROP POLICY IF EXISTS select_aps ON public.allocation_payment_schedules;
CREATE POLICY select_aps ON public.allocation_payment_schedules FOR SELECT
  USING (public.is_active_user() AND public.can_access_nucleo(nucleo_id));

DROP POLICY IF EXISTS insert_aps ON public.allocation_payment_schedules;
CREATE POLICY insert_aps ON public.allocation_payment_schedules FOR INSERT
  WITH CHECK (public.is_active_user() AND public.can_access_nucleo(nucleo_id) AND public.current_user_role() != 'rh');

DROP POLICY IF EXISTS update_aps ON public.allocation_payment_schedules;
CREATE POLICY update_aps ON public.allocation_payment_schedules FOR UPDATE
  USING (public.is_active_user() AND public.can_access_nucleo(nucleo_id) AND public.current_user_role() != 'rh');

-- B. payment_requests Policies
DROP POLICY IF EXISTS select_pr ON public.payment_requests;
CREATE POLICY select_pr ON public.payment_requests FOR SELECT
  USING (public.is_active_user() AND public.can_access_nucleo(nucleo_id));

DROP POLICY IF EXISTS insert_pr ON public.payment_requests;
CREATE POLICY insert_pr ON public.payment_requests FOR INSERT
  WITH CHECK (public.is_active_user() AND public.can_access_nucleo(nucleo_id) AND public.current_user_role() != 'rh');

DROP POLICY IF EXISTS update_pr ON public.payment_requests;
CREATE POLICY update_pr ON public.payment_requests FOR UPDATE
  USING (public.is_active_user() AND public.can_access_nucleo(nucleo_id) AND public.current_user_role() != 'rh');

-- C. reverse_evaluation_links Policies
DROP POLICY IF EXISTS select_rel ON public.reverse_evaluation_links;
CREATE POLICY select_rel ON public.reverse_evaluation_links FOR SELECT
  USING (true); -- Public anonymous access to validate tokens

DROP POLICY IF EXISTS insert_rel ON public.reverse_evaluation_links;
CREATE POLICY insert_rel ON public.reverse_evaluation_links FOR INSERT
  WITH CHECK (public.is_active_user() AND public.can_access_nucleo(nucleo_id) AND public.current_user_role() != 'rh');

DROP POLICY IF EXISTS update_rel ON public.reverse_evaluation_links;
CREATE POLICY update_rel ON public.reverse_evaluation_links FOR UPDATE
  USING (true); -- Allow anonymous users to set status to 'used' on submission
