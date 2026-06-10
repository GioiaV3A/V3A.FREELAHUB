-- Database Migration: Reconfigure Shortlist, Negotiation, Approvals, Allocations, and Evaluations Workflow

-- 1. Extend job_freelancer_requests (mapped as Job in UI)
ALTER TABLE public.job_freelancer_requests 
ADD COLUMN IF NOT EXISTS locked_for_allocation boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS allocation_id uuid;

-- 2. Extend shortlist_candidates with operational scoring and negotiation fields
ALTER TABLE public.shortlist_candidates 
ADD COLUMN IF NOT EXISTS added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS source_bucket text CHECK (source_bucket IN ('best_match', 'good_alternative', 'other_option', 'manual')),
ADD COLUMN IF NOT EXISTS match_score integer,
ADD COLUMN IF NOT EXISTS recommendation_reasons jsonb,
ADD COLUMN IF NOT EXISTS shortlist_position integer,
ADD COLUMN IF NOT EXISTS negotiation_status text DEFAULT 'shortlisted',
ADD COLUMN IF NOT EXISTS negotiated_rate numeric(12,2),
ADD COLUMN IF NOT EXISTS remuneration_model text DEFAULT 'diaria',
ADD COLUMN IF NOT EXISTS policy_status text DEFAULT 'pending_check',
ADD COLUMN IF NOT EXISTS schedule_conflict boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_rh_approval boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_head_approval boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS selected_for_allocation boolean DEFAULT false;

-- 3. Create negotiation_history for audit trail
CREATE TABLE IF NOT EXISTS public.negotiation_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.job_freelancer_requests(id) ON DELETE CASCADE,
  shortlist_candidate_id uuid REFERENCES public.shortlist_candidates(id) ON DELETE CASCADE,
  freelancer_id uuid REFERENCES public.freelancers(id) ON DELETE CASCADE,
  previous_status text,
  new_status text,
  previous_rate numeric(12,2),
  new_rate numeric(12,2),
  notes text,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_by_role text,
  created_at timestamptz DEFAULT now()
);

-- 4. Create allocation_approvals to manage RH/Head exceptions
CREATE TABLE IF NOT EXISTS public.allocation_approvals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.job_freelancer_requests(id) ON DELETE CASCADE,
  shortlist_candidate_id uuid REFERENCES public.shortlist_candidates(id) ON DELETE CASCADE,
  freelancer_id uuid REFERENCES public.freelancers(id) ON DELETE CASCADE,
  approval_type text NOT NULL CHECK (approval_type IN ('value_exception', 'schedule_conflict', 'manual_override')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  requested_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approver_role text,
  reason text,
  decision_notes text,
  policy_reference_value numeric(12,2),
  policy_ceiling_value numeric(12,2),
  negotiated_value numeric(12,2),
  created_at timestamptz DEFAULT now(),
  decided_at timestamptz
);

-- 5. Extend allocations and alter status constraint to support custom operational flows
-- Drop depending trigger first
DROP TRIGGER IF EXISTS trigger_check_and_release_payment_alloc ON public.allocations;

ALTER TABLE public.allocations DROP CONSTRAINT IF EXISTS check_allocation_status;
ALTER TABLE public.allocations ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.allocations ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.allocations ALTER COLUMN status SET DEFAULT 'booked';
ALTER TABLE public.allocations 
ADD COLUMN IF NOT EXISTS leader_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS remuneration_model text DEFAULT 'diaria',
ADD COLUMN IF NOT EXISTS policy_status text,
ADD COLUMN IF NOT EXISTS value_approval_id uuid REFERENCES public.allocation_approvals(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS schedule_approval_id uuid REFERENCES public.allocation_approvals(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS completed_at timestamptz,
ADD COLUMN IF NOT EXISTS released_for_payment_at timestamptz,
ADD COLUMN IF NOT EXISTS payment_code text;

-- 6. Extend payment_codes to support exporting and finance tracking
ALTER TABLE public.payment_codes ALTER COLUMN payment_status DROP DEFAULT;
ALTER TABLE public.payment_codes ALTER COLUMN payment_status TYPE text USING payment_status::text;
ALTER TABLE public.payment_codes ALTER COLUMN payment_status SET DEFAULT 'aguardando_conclusao';
ALTER TABLE public.payment_codes 
ADD COLUMN IF NOT EXISTS amount numeric(12,2),
ADD COLUMN IF NOT EXISTS export_batch_id text,
ADD COLUMN IF NOT EXISTS exported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS exported_at timestamptz,
ADD COLUMN IF NOT EXISTS finance_code text,
ADD COLUMN IF NOT EXISTS finance_registered_at timestamptz,
ADD COLUMN IF NOT EXISTS notes text;

UPDATE public.payment_codes SET amount = approved_value WHERE amount IS NULL;

-- 7. Create evaluation_tokens for public anonymous links
CREATE TABLE IF NOT EXISTS public.evaluation_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  allocation_id uuid REFERENCES public.allocations(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.job_freelancer_requests(id) ON DELETE CASCADE,
  freelancer_id uuid REFERENCES public.freelancers(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  evaluation_type text NOT NULL CHECK (evaluation_type IN ('leader_to_freelancer', 'freelancer_to_project')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  expires_at timestamptz,
  used_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 8. Alter and extend evaluations to support delivery_evaluations requirements
ALTER TABLE public.evaluations ALTER COLUMN final_score TYPE numeric(5,2);
ALTER TABLE public.evaluations 
ADD COLUMN IF NOT EXISTS evaluator_role text,
ADD COLUMN IF NOT EXISTS client text,
ADD COLUMN IF NOT EXISTS function_contracted text,
ADD COLUMN IF NOT EXISTS seniority_contracted text,
ADD COLUMN IF NOT EXISTS agreed_rate numeric(12,2),
ADD COLUMN IF NOT EXISTS policy_status text,
ADD COLUMN IF NOT EXISTS collaboration integer CHECK (collaboration BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS flexibility integer CHECK (flexibility BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS cost_benefit integer CHECK (cost_benefit BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS weighted_average numeric(4,3),
ADD COLUMN IF NOT EXISTS score_0_100 numeric(5,2),
ADD COLUMN IF NOT EXISTS would_hire_again text CHECK (would_hire_again IN ('sim', 'talvez', 'nao')),
ADD COLUMN IF NOT EXISTS rework_level text CHECK (rework_level IN ('nao', 'baixa', 'media', 'alta')),
ADD COLUMN IF NOT EXISTS critical_problem boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS conditional_answers jsonb,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved'));

-- 9. Create reverse_evaluations table
CREATE TABLE IF NOT EXISTS public.reverse_evaluations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  allocation_id uuid REFERENCES public.allocations(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.job_freelancer_requests(id) ON DELETE CASCADE,
  freelancer_id uuid REFERENCES public.freelancers(id) ON DELETE CASCADE,
  leader_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  nucleo_id uuid REFERENCES public.nucleos(id) ON DELETE CASCADE,
  client text,
  briefing_clarity integer CHECK (briefing_clarity BETWEEN 1 AND 5),
  scope_alignment integer CHECK (scope_alignment BETWEEN 1 AND 5),
  direct_leadership integer CHECK (direct_leadership BETWEEN 1 AND 5),
  decision_speed integer CHECK (decision_speed BETWEEN 1 AND 5),
  communication integer CHECK (communication BETWEEN 1 AND 5),
  project_organization integer CHECK (project_organization BETWEEN 1 AND 5),
  working_conditions integer CHECK (working_conditions BETWEEN 1 AND 5),
  administrative_flow integer CHECK (administrative_flow BETWEEN 1 AND 5),
  nps_project integer CHECK (nps_project BETWEEN 0 AND 10),
  csat_project integer CHECK (csat_project BETWEEN 1 AND 5),
  ces_operational integer CHECK (ces_operational BETWEEN 1 AND 5),
  observations text,
  project_experience_score numeric(5,2),
  leader_score_component numeric(5,2),
  nucleus_experience_component numeric(5,2),
  status text DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 10. Extend freelancers with 0-100 scoring
ALTER TABLE public.freelancers 
ALTER COLUMN average_score TYPE numeric(5,2),
ALTER COLUMN technical_score TYPE numeric(5,2),
ALTER COLUMN deadline_score TYPE numeric(5,2),
ALTER COLUMN communication_score TYPE numeric(5,2),
ALTER COLUMN behavior_score TYPE numeric(5,2);

ALTER TABLE public.freelancers
ADD COLUMN IF NOT EXISTS consolidated_score numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS recommendation_rate numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS operational_status text DEFAULT 'Elegível';

-- 11. Create freelancer_score_snapshots table
CREATE TABLE IF NOT EXISTS public.freelancer_score_snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  freelancer_id uuid REFERENCES public.freelancers(id) ON DELETE CASCADE,
  consolidated_score numeric(5,2),
  delivery_average_score numeric(5,2),
  recommendation_rate numeric(5,2),
  operational_reliability_score numeric(5,2),
  culture_process_score numeric(5,2),
  operational_status text,
  calculated_at timestamptz DEFAULT now(),
  details jsonb
);

-- 12. Create trigger to compute delivery weighted score (0-100 scale)
CREATE OR REPLACE FUNCTION public.calculate_evaluation_final_score()
RETURNS TRIGGER AS $$
DECLARE
  weighted_avg numeric(4,3);
BEGIN
  weighted_avg := COALESCE(NEW.technical_quality, 5) * 0.25 +
                  COALESCE(NEW.briefing_adherence, 5) * 0.15 +
                  COALESCE(NEW.deadline, 5) * 0.15 +
                  COALESCE(NEW.autonomy, 5) * 0.10 +
                  COALESCE(NEW.communication, 5) * 0.10 +
                  COALESCE(NEW.behavior, 5) * 0.10 +
                  COALESCE(NEW.collaboration, 5) * 0.05 +
                  COALESCE(NEW.flexibility, 5) * 0.05 +
                  COALESCE(NEW.cost_benefit, 5) * 0.05;
  NEW.weighted_average := weighted_avg;
  NEW.final_score := weighted_avg; -- Backwards compatibility
  NEW.score_0_100 := ((weighted_avg - 1) / 4.0) * 100.0;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_evaluation_final_score ON public.evaluations;
CREATE TRIGGER trigger_calculate_evaluation_final_score
BEFORE INSERT OR UPDATE OF technical_quality, deadline, briefing_adherence, communication, autonomy, behavior, collaboration, flexibility, cost_benefit
ON public.evaluations
FOR EACH ROW
EXECUTE FUNCTION public.calculate_evaluation_final_score();

-- 13. Create function to recalculate consolidated scores on new evaluation
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

  -- 4. Operational Reliability (deadline compliance average scaled 0-100)
  SELECT COALESCE(AVG((deadline - 1) / 4.0 * 100.0), 0)
  INTO reliability_score
  FROM public.evaluations
  WHERE freelancer_id = f_id AND status = 'submitted';

  -- 5. Aderência cultural / comportamento average scaled 0-100
  SELECT COALESCE(AVG((behavior - 1) / 4.0 * 100.0), 0)
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

-- Re-apply triggers
DROP TRIGGER IF EXISTS trigger_update_freelancer_scores_avg ON public.evaluations;
CREATE TRIGGER trigger_update_freelancer_scores_avg
AFTER INSERT OR UPDATE OR DELETE ON public.evaluations
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_freelancer_score_history();

-- 14. Reverse Evaluation Trigger (Leader Score, Project Health, Nucleus Experience)
CREATE OR REPLACE FUNCTION public.calculate_reverse_evaluation_scores()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Leader Score Component (Liderança direta + Comunicação + Velocidade de decisão)
  NEW.leader_score_component := (((COALESCE(NEW.direct_leadership, 5) * 0.50 + 
                                  COALESCE(NEW.communication, 5) * 0.25 + 
                                  COALESCE(NEW.decision_speed, 5) * 0.25) - 1.0) / 4.0) * 100.0;
  
  -- 2. Project Health Score (Clareza do briefing + Alinhamento do escopo + Organização + Condições de trabalho)
  NEW.project_experience_score := (((COALESCE(NEW.briefing_clarity, 5) * 0.35 + 
                                    COALESCE(NEW.scope_alignment, 5) * 0.30 + 
                                    COALESCE(NEW.project_organization, 5) * 0.20 + 
                                    COALESCE(NEW.working_conditions, 5) * 0.15) - 1.0) / 4.0) * 100.0;

  -- 3. Nucleus Experience Component (Comunicação + Velocidade de decisão + Fluxo administrative)
  NEW.nucleus_experience_component := (((COALESCE(NEW.communication, 5) * 0.40 + 
                                        COALESCE(NEW.decision_speed, 5) * 0.40 + 
                                        COALESCE(NEW.administrative_flow, 5) * 0.20) - 1.0) / 4.0) * 100.0;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_reverse_scores ON public.reverse_evaluations;
CREATE TRIGGER trigger_calculate_reverse_scores
BEFORE INSERT OR UPDATE ON public.reverse_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.calculate_reverse_evaluation_scores();

-- 15. Setup RLS policies on new tables
ALTER TABLE public.negotiation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocation_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reverse_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancer_score_snapshots ENABLE ROW LEVEL SECURITY;

-- Policies for C-level, RH and Master
DROP POLICY IF EXISTS select_nh ON public.negotiation_history;
CREATE POLICY select_nh ON public.negotiation_history FOR SELECT USING (public.is_active_user());
DROP POLICY IF EXISTS insert_nh ON public.negotiation_history;
CREATE POLICY insert_nh ON public.negotiation_history FOR INSERT WITH CHECK (public.is_active_user());

DROP POLICY IF EXISTS select_aa ON public.allocation_approvals;
CREATE POLICY select_aa ON public.allocation_approvals FOR SELECT USING (public.is_active_user());
DROP POLICY IF EXISTS insert_aa ON public.allocation_approvals;
CREATE POLICY insert_aa ON public.allocation_approvals FOR INSERT WITH CHECK (public.is_active_user());
DROP POLICY IF EXISTS update_aa ON public.allocation_approvals;
CREATE POLICY update_aa ON public.allocation_approvals FOR UPDATE USING (public.is_master_or_rh() OR public.current_user_role() = 'c_level');

DROP POLICY IF EXISTS select_et ON public.evaluation_tokens;
CREATE POLICY select_et ON public.evaluation_tokens FOR SELECT USING (true); -- Public anonymous access
DROP POLICY IF EXISTS insert_et ON public.evaluation_tokens;
CREATE POLICY insert_et ON public.evaluation_tokens FOR INSERT WITH CHECK (public.is_active_user());
DROP POLICY IF EXISTS update_et ON public.evaluation_tokens;
CREATE POLICY update_et ON public.evaluation_tokens FOR UPDATE USING (true);

DROP POLICY IF EXISTS select_re ON public.reverse_evaluations;
CREATE POLICY select_re ON public.reverse_evaluations FOR SELECT USING (public.is_active_user());
DROP POLICY IF EXISTS insert_re ON public.reverse_evaluations;
CREATE POLICY insert_re ON public.reverse_evaluations FOR INSERT WITH CHECK (true); -- Public anonymous access

DROP POLICY IF EXISTS select_fss ON public.freelancer_score_snapshots;
CREATE POLICY select_fss ON public.freelancer_score_snapshots FOR SELECT USING (public.is_active_user());

-- 16. Recreate dropped trigger for allocations
CREATE TRIGGER trigger_check_and_release_payment_alloc
AFTER UPDATE OF status ON public.allocations
FOR EACH ROW
WHEN (NEW.status = 'concluido' OR NEW.status = 'completed')
EXECUTE FUNCTION public.check_and_release_payment_trigger();
