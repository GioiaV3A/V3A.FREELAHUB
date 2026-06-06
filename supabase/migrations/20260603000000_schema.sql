-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create ENUM Types if they do not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE app_role AS ENUM ('master', 'rh', 'nucleo');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'record_status') THEN
    CREATE TYPE record_status AS ENUM ('active', 'inactive');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'freelancer_status') THEN
    CREATE TYPE freelancer_status AS ENUM ('elegivel', 'em_analise', 'em_onboarding', 'em_observacao', 'bloqueado', 'inativo');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'seniority_level') THEN
    CREATE TYPE seniority_level AS ENUM ('junior', 'pleno', 'senior', 'especialista');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_type') THEN
    CREATE TYPE billing_type AS ENUM ('diaria', 'hora', 'pacote', 'projeto');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'urgency_level') THEN
    CREATE TYPE urgency_level AS ENUM ('baixa', 'media', 'alta', 'critica');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    CREATE TYPE job_status AS ENUM ('oportunidade_criada', 'em_shortlist', 'em_negociacao', 'aguardando_rh', 'bookado', 'em_andamento', 'concluido', 'avaliacao_pendente', 'encerrado', 'cancelado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'candidate_status') THEN
    CREATE TYPE candidate_status AS ENUM ('selecionado', 'em_negociacao', 'indisponivel', 'valor_fora_politica', 'aprovado_rh', 'rejeitado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
    CREATE TYPE approval_status AS ENUM ('pendente', 'aprovado', 'rejeitado', 'ajuste_solicitado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'allocation_status') THEN
    CREATE TYPE allocation_status AS ENUM ('reservado', 'bookado', 'em_andamento', 'concluido', 'avaliacao_pendente', 'encerrado', 'cancelado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('aguardando_conclusao', 'aguardando_avaliacao', 'liberado_para_pagamento', 'bloqueado', 'encerrado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'availability_status') THEN
    CREATE TYPE availability_status AS ENUM ('disponivel', 'conflito_parcial', 'indisponivel', 'sob_consulta');
  END IF;
END$$;

-- 2. Create Core Tables

-- 2.1 nucleos
CREATE TABLE IF NOT EXISTS public.nucleos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  code text UNIQUE,
  head_name text,
  head_email text,
  status record_status DEFAULT 'active',
  observations text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2.2 profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  role app_role NOT NULL,
  nucleo_id uuid REFERENCES public.nucleos(id) ON DELETE SET NULL,
  job_title text,
  status record_status NOT NULL DEFAULT 'active',
  first_login_required boolean NOT NULL DEFAULT true,
  is_seed_master boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT check_nucleo_id CHECK (role != 'nucleo' OR nucleo_id IS NOT NULL)
);

-- 2.3 clients
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  industry text,
  status record_status DEFAULT 'active',
  last_job_name text,
  jobs_count integer DEFAULT 0,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2.4 freela_functions
CREATE TABLE IF NOT EXISTS public.freela_functions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  status record_status DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2.5 industries
CREATE TABLE IF NOT EXISTS public.industries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  status record_status DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2.6 skills
CREATE TABLE IF NOT EXISTS public.skills (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  category text,
  status record_status DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2.7 freelancers
CREATE TABLE IF NOT EXISTS public.freelancers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name text NOT NULL,
  email text,
  whatsapp text,
  city text,
  state text,
  main_function_id uuid REFERENCES public.freela_functions(id) ON DELETE SET NULL,
  seniority seniority_level,
  portfolio_url text,
  linkedin_url text,
  status freelancer_status DEFAULT 'em_analise',
  availability availability_status DEFAULT 'sob_consulta',
  reference_daily_rate numeric(12,2),
  average_score numeric(3,2) DEFAULT 0,
  technical_score numeric(3,2) DEFAULT 0,
  deadline_score numeric(3,2) DEFAULT 0,
  communication_score numeric(3,2) DEFAULT 0,
  behavior_score numeric(3,2) DEFAULT 0,
  evaluations_count integer DEFAULT 0,
  observations text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2.8 freelancer_industries
CREATE TABLE IF NOT EXISTS public.freelancer_industries (
  freelancer_id uuid REFERENCES public.freelancers(id) ON DELETE CASCADE,
  industry_id uuid REFERENCES public.industries(id) ON DELETE CASCADE,
  PRIMARY KEY (freelancer_id, industry_id)
);

-- 2.9 freelancer_skills
CREATE TABLE IF NOT EXISTS public.freelancer_skills (
  freelancer_id uuid REFERENCES public.freelancers(id) ON DELETE CASCADE,
  skill_id uuid REFERENCES public.skills(id) ON DELETE CASCADE,
  level text,
  PRIMARY KEY (freelancer_id, skill_id)
);

-- 2.10 rate_policies
CREATE TABLE IF NOT EXISTS public.rate_policies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  function_id uuid REFERENCES public.freela_functions(id) ON DELETE CASCADE,
  seniority seniority_level NOT NULL,
  billing_type billing_type DEFAULT 'diaria',
  reference_value numeric(12,2) NOT NULL,
  ceiling_value numeric(12,2) NOT NULL,
  status record_status DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2.11 jobs
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_code text UNIQUE NOT NULL,
  title text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text,
  nucleo_id uuid NOT NULL REFERENCES public.nucleos(id) ON DELETE CASCADE,
  requester_id uuid REFERENCES auth.users(id),
  description text,
  start_date date,
  end_date date,
  urgency urgency_level DEFAULT 'media',
  status job_status DEFAULT 'oportunidade_criada',
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2.12 job_freelancer_requests
CREATE TABLE IF NOT EXISTS public.job_freelancer_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_code text UNIQUE NOT NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  function_id uuid REFERENCES public.freela_functions(id) ON DELETE SET NULL,
  seniority seniority_level,
  scope_description text,
  deliverables text,
  start_date date,
  end_date date,
  budget_max numeric(12,2),
  calculated_days integer,
  calculated_daily_rate numeric(12,2),
  policy_reference_value numeric(12,2),
  policy_ceiling_value numeric(12,2),
  is_above_policy boolean DEFAULT false,
  status job_status DEFAULT 'oportunidade_criada',
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2.13 shortlist_candidates
CREATE TABLE IF NOT EXISTS public.shortlist_candidates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.job_freelancer_requests(id) ON DELETE CASCADE,
  freelancer_id uuid NOT NULL REFERENCES public.freelancers(id) ON DELETE CASCADE,
  candidate_status candidate_status DEFAULT 'selecionado',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (request_id, freelancer_id)
);

-- 2.14 negotiations
CREATE TABLE IF NOT EXISTS public.negotiations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.job_freelancer_requests(id) ON DELETE CASCADE,
  freelancer_id uuid NOT NULL REFERENCES public.freelancers(id) ON DELETE CASCADE,
  scope text,
  negotiated_value numeric(12,2),
  billing_type billing_type DEFAULT 'diaria',
  notes text,
  is_above_policy boolean DEFAULT false,
  exception_justification text,
  status candidate_status DEFAULT 'em_negociacao',
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2.15 exception_approvals
CREATE TABLE IF NOT EXISTS public.exception_approvals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  negotiation_id uuid NOT NULL REFERENCES public.negotiations(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.job_freelancer_requests(id) ON DELETE CASCADE,
  freelancer_id uuid NOT NULL REFERENCES public.freelancers(id) ON DELETE CASCADE,
  requested_value numeric(12,2),
  ceiling_value numeric(12,2),
  difference_value numeric(12,2),
  justification text,
  status approval_status DEFAULT 'pendente',
  approved_by uuid REFERENCES auth.users(id),
  decision_notes text,
  decided_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2.16 allocations
CREATE TABLE IF NOT EXISTS public.allocations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  allocation_code text UNIQUE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.job_freelancer_requests(id) ON DELETE CASCADE,
  freelancer_id uuid NOT NULL REFERENCES public.freelancers(id) ON DELETE CASCADE,
  nucleo_id uuid NOT NULL REFERENCES public.nucleos(id) ON DELETE CASCADE,
  negotiation_id uuid REFERENCES public.negotiations(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  approved_value numeric(12,2),
  status allocation_status DEFAULT 'bookado',
  generated_by uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2.17 evaluations
CREATE TABLE IF NOT EXISTS public.evaluations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.job_freelancer_requests(id) ON DELETE CASCADE,
  allocation_id uuid REFERENCES public.allocations(id) ON DELETE SET NULL,
  freelancer_id uuid NOT NULL REFERENCES public.freelancers(id) ON DELETE CASCADE,
  nucleo_id uuid NOT NULL REFERENCES public.nucleos(id) ON DELETE CASCADE,
  evaluator_id uuid NOT NULL REFERENCES auth.users(id),
  technical_quality integer NOT NULL CHECK (technical_quality BETWEEN 1 AND 5),
  deadline integer NOT NULL CHECK (deadline BETWEEN 1 AND 5),
  briefing_adherence integer NOT NULL CHECK (briefing_adherence BETWEEN 1 AND 5),
  communication integer NOT NULL CHECK (communication BETWEEN 1 AND 5),
  autonomy integer NOT NULL CHECK (autonomy BETWEEN 1 AND 5),
  behavior integer NOT NULL CHECK (behavior BETWEEN 1 AND 5),
  final_score numeric(3,2),
  comment text NOT NULL,
  recommendation text CHECK (recommendation IN ('sim', 'sim_com_restricao', 'nao')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2.18 payment_codes
CREATE TABLE IF NOT EXISTS public.payment_codes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  allocation_code text NOT NULL UNIQUE,
  allocation_id uuid NOT NULL REFERENCES public.allocations(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.job_freelancer_requests(id) ON DELETE CASCADE,
  freelancer_id uuid NOT NULL REFERENCES public.freelancers(id) ON DELETE CASCADE,
  nucleo_id uuid NOT NULL REFERENCES public.nucleos(id) ON DELETE CASCADE,
  approved_value numeric(12,2),
  payment_status payment_status DEFAULT 'aguardando_conclusao',
  released_at timestamptz,
  released_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2.19 suggestions
CREATE TABLE IF NOT EXISTS public.suggestions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  freelancer_name text NOT NULL,
  email text NOT NULL,
  whatsapp text,
  suggested_role text,
  portfolio_url text,
  reason text NOT NULL,
  related_project text NOT NULL,
  observations text,
  nucleo_id uuid NOT NULL REFERENCES public.nucleos(id) ON DELETE CASCADE,
  suggested_by text,
  status text DEFAULT 'Pendente de análise RH',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2.20 audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  previous_data jsonb,
  new_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- 3. Security Definer Functions (avoiding RLS recursion)

-- 3.1 current_user_role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS app_role SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT role FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3.2 current_user_nucleo_id
CREATE OR REPLACE FUNCTION public.current_user_nucleo_id()
RETURNS uuid SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT nucleo_id FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3.3 is_master
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT role = 'master' FROM public.profiles WHERE id = auth.uid()),
    false
  );
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3.4 is_rh
CREATE OR REPLACE FUNCTION public.is_rh()
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT role = 'rh' FROM public.profiles WHERE id = auth.uid()),
    false
  );
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3.5 is_master_or_rh
CREATE OR REPLACE FUNCTION public.is_master_or_rh()
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT role IN ('master', 'rh') FROM public.profiles WHERE id = auth.uid()),
    false
  );
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3.6 is_active_user
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT status = 'active' FROM public.profiles WHERE id = auth.uid()),
    false
  );
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3.7 can_access_nucleo
CREATE OR REPLACE FUNCTION public.can_access_nucleo(target_nucleo_id uuid)
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  RETURN (
    public.is_master() OR 
    public.is_rh() OR 
    (public.current_user_role() = 'nucleo' AND target_nucleo_id = public.current_user_nucleo_id())
  );
END;
$$ LANGUAGE plpgsql SET search_path = public;


-- 4. Triggers & Calculations

-- 4.1 Update updated_at automatically
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper to apply updated_at trigger to all relevant tables
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('nucleos', 'profiles', 'clients', 'freela_functions', 'industries', 'skills', 'freelancers', 'rate_policies', 'jobs', 'job_freelancer_requests', 'shortlist_candidates', 'negotiations', 'exception_approvals', 'allocations', 'evaluations', 'payment_codes', 'suggestions')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_update_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER trigger_update_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t);
  END LOOP;
END$$;

-- 4.2 job_freelancer_requests trigger: calculate calculated_days, calculated_daily_rate, fetch policy limits, compare is_above_policy
CREATE OR REPLACE FUNCTION public.calculate_job_request_details()
RETURNS TRIGGER AS $$
DECLARE
  calculated_days_val integer;
  policy_ref numeric(12,2);
  policy_ceil numeric(12,2);
BEGIN
  -- 1. Calculate days
  calculated_days_val := GREATEST(1, NEW.end_date - NEW.start_date);
  NEW.calculated_days := calculated_days_val;
  
  -- 2. Calculate daily rate
  IF NEW.budget_max IS NOT NULL AND calculated_days_val > 0 THEN
    NEW.calculated_daily_rate := NEW.budget_max / calculated_days_val;
  ELSE
    NEW.calculated_daily_rate := 0;
  END IF;
  
  -- 3. Compare with policy limits
  SELECT reference_value, ceiling_value 
  INTO policy_ref, policy_ceil
  FROM public.rate_policies
  WHERE function_id = NEW.function_id
    AND seniority = NEW.seniority
    AND billing_type = 'diaria'
    AND status = 'active'
  LIMIT 1;
  
  NEW.policy_reference_value := policy_ref;
  NEW.policy_ceiling_value := policy_ceil;
  
  IF policy_ceil IS NOT NULL AND NEW.calculated_daily_rate > policy_ceil THEN
    NEW.is_above_policy := true;
  ELSE
    NEW.is_above_policy := false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_job_request_details ON public.job_freelancer_requests;
CREATE TRIGGER trigger_calculate_job_request_details 
BEFORE INSERT OR UPDATE OF start_date, end_date, budget_max, function_id, seniority
ON public.job_freelancer_requests 
FOR EACH ROW 
EXECUTE FUNCTION public.calculate_job_request_details();

-- 4.3 evaluations trigger: calculate final score
CREATE OR REPLACE FUNCTION public.calculate_evaluation_final_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.final_score := NEW.technical_quality * 0.30 +
                     NEW.deadline * 0.20 +
                     NEW.briefing_adherence * 0.15 +
                     NEW.communication * 0.15 +
                     NEW.autonomy * 0.10 +
                     NEW.behavior * 0.10;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_evaluation_final_score ON public.evaluations;
CREATE TRIGGER trigger_calculate_evaluation_final_score
BEFORE INSERT OR UPDATE OF technical_quality, deadline, briefing_adherence, communication, autonomy, behavior
ON public.evaluations
FOR EACH ROW
EXECUTE FUNCTION public.calculate_evaluation_final_score();

-- 4.4 evaluations trigger: update freelancer averages
CREATE OR REPLACE FUNCTION public.update_freelancer_scores_avg()
RETURNS TRIGGER AS $$
DECLARE
  target_freelancer_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_freelancer_id := OLD.freelancer_id;
  ELSE
    target_freelancer_id := NEW.freelancer_id;
  END IF;

  UPDATE public.freelancers
  SET 
    evaluations_count = (SELECT count(*) FROM public.evaluations WHERE freelancer_id = target_freelancer_id),
    average_score = COALESCE((SELECT avg(final_score) FROM public.evaluations WHERE freelancer_id = target_freelancer_id), 0),
    technical_score = COALESCE((SELECT avg(technical_quality) FROM public.evaluations WHERE freelancer_id = target_freelancer_id), 0),
    deadline_score = COALESCE((SELECT avg(deadline) FROM public.evaluations WHERE freelancer_id = target_freelancer_id), 0),
    communication_score = COALESCE((SELECT avg(communication) FROM public.evaluations WHERE freelancer_id = target_freelancer_id), 0),
    behavior_score = COALESCE((SELECT avg(behavior) FROM public.evaluations WHERE freelancer_id = target_freelancer_id), 0)
  WHERE id = target_freelancer_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_freelancer_scores_avg ON public.evaluations;
CREATE TRIGGER trigger_update_freelancer_scores_avg
AFTER INSERT OR UPDATE OR DELETE ON public.evaluations
FOR EACH ROW
EXECUTE FUNCTION public.update_freelancer_scores_avg();

-- 4.5 allocations trigger: generate allocation_code sequentially
CREATE OR REPLACE FUNCTION public.generate_allocation_code_trigger()
RETURNS TRIGGER AS $$
DECLARE
  current_year integer;
  next_seq integer;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Lock to prevent duplicates under heavy load
  SELECT COALESCE(MAX(SUBSTRING(allocation_code FROM 11 FOR 4)::integer), 0) + 1
  INTO next_seq
  FROM public.allocations
  WHERE allocation_code LIKE 'ALOC-' || current_year || '-%';
  
  NEW.allocation_code := 'ALOC-' || current_year || '-' || LPAD(next_seq::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_allocation_code ON public.allocations;
CREATE TRIGGER trigger_generate_allocation_code
BEFORE INSERT ON public.allocations
FOR EACH ROW
WHEN (NEW.allocation_code IS NULL)
EXECUTE FUNCTION public.generate_allocation_code_trigger();

-- 4.6 allocations trigger: create payment_code
CREATE OR REPLACE FUNCTION public.create_payment_code_from_alloc()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.payment_codes (
    allocation_code,
    allocation_id,
    job_id,
    request_id,
    freelancer_id,
    nucleo_id,
    approved_value,
    payment_status
  ) VALUES (
    NEW.allocation_code,
    NEW.id,
    NEW.job_id,
    NEW.request_id,
    NEW.freelancer_id,
    NEW.nucleo_id,
    NEW.approved_value,
    'aguardando_conclusao'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_payment_code_from_alloc ON public.allocations;
CREATE TRIGGER trigger_create_payment_code_from_alloc
AFTER INSERT ON public.allocations
FOR EACH ROW
EXECUTE FUNCTION public.create_payment_code_from_alloc();

-- 4.7 allocations & evaluations: release payment (liberado_para_pagamento) when concluded and evaluated
CREATE OR REPLACE FUNCTION public.check_and_release_payment_trigger()
RETURNS TRIGGER AS $$
DECLARE
  target_allocation_id uuid;
  has_evaluation boolean;
  is_allocation_concluded boolean;
BEGIN
  IF TG_TABLE_NAME = 'evaluations' THEN
    target_allocation_id := NEW.allocation_id;
  ELSIF TG_TABLE_NAME = 'allocations' THEN
    target_allocation_id := NEW.id;
  END IF;

  IF target_allocation_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.evaluations WHERE allocation_id = target_allocation_id) INTO has_evaluation;
  SELECT (status = 'concluido') INTO is_allocation_concluded FROM public.allocations WHERE id = target_allocation_id;

  IF has_evaluation AND is_allocation_concluded THEN
    UPDATE public.payment_codes
    SET payment_status = 'liberado_para_pagamento', released_at = now()
    WHERE allocation_id = target_allocation_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_and_release_payment_eval ON public.evaluations;
CREATE TRIGGER trigger_check_and_release_payment_eval
AFTER INSERT OR UPDATE ON public.evaluations
FOR EACH ROW
EXECUTE FUNCTION public.check_and_release_payment_trigger();

DROP TRIGGER IF EXISTS trigger_check_and_release_payment_alloc ON public.allocations;
CREATE TRIGGER trigger_check_and_release_payment_alloc
AFTER UPDATE OF status ON public.allocations
FOR EACH ROW
WHEN (NEW.status = 'concluido')
EXECUTE FUNCTION public.check_and_release_payment_trigger();


-- 5. Row-Level Security (RLS) Configuration

ALTER TABLE public.nucleos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freela_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancer_industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancer_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_freelancer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortlist_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exception_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 5.1 profiles policies
CREATE POLICY select_profiles ON public.profiles 
  FOR SELECT USING (public.is_active_user() AND (public.is_master_or_rh() OR id = auth.uid()));

CREATE POLICY insert_profiles ON public.profiles 
  FOR INSERT WITH CHECK (public.is_master_or_rh());

CREATE POLICY update_profiles ON public.profiles 
  FOR UPDATE USING (
    public.is_active_user() AND (
      public.is_master() OR 
      (public.is_rh() AND role IN ('rh', 'nucleo') AND id != auth.uid()) OR -- RH can edit others (except Master)
      id = auth.uid() -- Everyone can edit their own profile
    )
  );

-- 5.2 nucleos policies
CREATE POLICY select_nucleos ON public.nucleos 
  FOR SELECT USING (public.is_active_user() AND public.can_access_nucleo(id));

CREATE POLICY insert_update_nucleos ON public.nucleos 
  FOR ALL USING (public.is_active_user() AND public.is_master_or_rh());

-- 5.3 clients policies
CREATE POLICY select_clients ON public.clients 
  FOR SELECT USING (public.is_active_user() AND (public.is_master_or_rh() OR status = 'active'));

CREATE POLICY insert_clients ON public.clients 
  FOR INSERT WITH CHECK (public.is_active_user() AND (public.is_master_or_rh() OR created_by = auth.uid()));

CREATE POLICY update_clients ON public.clients 
  FOR UPDATE USING (public.is_active_user() AND public.is_master_or_rh());

-- 5.4 freela_functions, industries, skills policies
CREATE POLICY select_ff ON public.freela_functions FOR SELECT USING (public.is_active_user());
CREATE POLICY modify_ff ON public.freela_functions FOR ALL USING (public.is_active_user() AND public.is_master_or_rh());

CREATE POLICY select_ind ON public.industries FOR SELECT USING (public.is_active_user());
CREATE POLICY modify_ind ON public.industries FOR ALL USING (public.is_active_user() AND public.is_master_or_rh());

CREATE POLICY select_sk ON public.skills FOR SELECT USING (public.is_active_user());
CREATE POLICY modify_sk ON public.skills FOR ALL USING (public.is_active_user() AND public.is_master_or_rh());

-- 5.5 freelancers policies
CREATE POLICY select_freelancers ON public.freelancers 
  FOR SELECT USING (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      status NOT IN ('bloqueado', 'inativo')
    )
  );

CREATE POLICY modify_freelancers ON public.freelancers 
  FOR ALL USING (public.is_active_user() AND public.is_master_or_rh());

-- 5.6 freelancer_industries / freelancer_skills
CREATE POLICY select_fi ON public.freelancer_industries FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.freelancers f WHERE f.id = freelancer_id)
);
CREATE POLICY modify_fi ON public.freelancer_industries FOR ALL USING (public.is_active_user() AND public.is_master_or_rh());

CREATE POLICY select_fs ON public.freelancer_skills FOR SELECT USING (
  EXISTS(SELECT 1 FROM public.freelancers f WHERE f.id = freelancer_id)
);
CREATE POLICY modify_fs ON public.freelancer_skills FOR ALL USING (public.is_active_user() AND public.is_master_or_rh());

-- 5.7 rate_policies policies
CREATE POLICY select_rp ON public.rate_policies FOR SELECT USING (public.is_active_user());
CREATE POLICY modify_rp ON public.rate_policies FOR ALL USING (public.is_active_user() AND public.is_master_or_rh());

-- 5.8 jobs policies
CREATE POLICY select_jobs ON public.jobs 
  FOR SELECT USING (public.is_active_user() AND public.can_access_nucleo(nucleo_id));

CREATE POLICY insert_jobs ON public.jobs 
  FOR INSERT WITH CHECK (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      nucleo_id = public.current_user_nucleo_id()
    )
  );

CREATE POLICY update_jobs ON public.jobs 
  FOR UPDATE USING (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      nucleo_id = public.current_user_nucleo_id()
    )
  );

-- 5.9 job_freelancer_requests policies
CREATE POLICY select_jfr ON public.job_freelancer_requests 
  FOR SELECT USING (
    public.is_active_user() AND EXISTS (
      SELECT 1 FROM public.jobs j WHERE j.id = job_id AND public.can_access_nucleo(j.nucleo_id)
    )
  );

CREATE POLICY modify_jfr ON public.job_freelancer_requests 
  FOR ALL USING (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.nucleo_id = public.current_user_nucleo_id())
    )
  );

-- 5.10 shortlist_candidates policies
CREATE POLICY select_sc ON public.shortlist_candidates 
  FOR SELECT USING (
    public.is_active_user() AND public.can_access_nucleo(
      (SELECT j.nucleo_id FROM public.jobs j WHERE j.id = job_id)
    )
  );

CREATE POLICY insert_sc ON public.shortlist_candidates 
  FOR INSERT WITH CHECK (
    public.is_active_user() AND 
    NOT EXISTS (SELECT 1 FROM public.freelancers f WHERE f.id = freelancer_id AND f.status = 'bloqueado') AND
    (
      public.is_master_or_rh() OR 
      (SELECT j.nucleo_id FROM public.jobs j WHERE j.id = job_id) = public.current_user_nucleo_id()
    )
  );

CREATE POLICY update_sc ON public.shortlist_candidates 
  FOR UPDATE USING (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      (SELECT j.nucleo_id FROM public.jobs j WHERE j.id = job_id) = public.current_user_nucleo_id()
    )
  );

-- 5.11 negotiations policies
CREATE POLICY select_negotiations ON public.negotiations 
  FOR SELECT USING (
    public.is_active_user() AND public.can_access_nucleo(
      (SELECT j.nucleo_id FROM public.jobs j WHERE j.id = job_id)
    )
  );

CREATE POLICY insert_update_negotiations ON public.negotiations 
  FOR ALL USING (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      (SELECT j.nucleo_id FROM public.jobs j WHERE j.id = job_id) = public.current_user_nucleo_id()
    )
  );

-- 5.12 exception_approvals policies
CREATE POLICY select_ea ON public.exception_approvals 
  FOR SELECT USING (
    public.is_active_user() AND public.can_access_nucleo(
      (SELECT j.nucleo_id FROM public.jobs j WHERE j.id = job_id)
    )
  );

CREATE POLICY insert_ea ON public.exception_approvals 
  FOR INSERT WITH CHECK (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      (SELECT j.nucleo_id FROM public.jobs j WHERE j.id = job_id) = public.current_user_nucleo_id()
    )
  );

CREATE POLICY update_ea ON public.exception_approvals 
  FOR UPDATE USING (public.is_active_user() AND public.is_master_or_rh());

-- 5.13 allocations policies
CREATE POLICY select_alloc ON public.allocations 
  FOR SELECT USING (public.is_active_user() AND public.can_access_nucleo(nucleo_id));

CREATE POLICY modify_alloc ON public.allocations 
  FOR ALL USING (public.is_active_user() AND public.is_master_or_rh());

-- 5.14 evaluations policies
CREATE POLICY select_eval ON public.evaluations 
  FOR SELECT USING (public.is_active_user() AND public.can_access_nucleo(nucleo_id));

CREATE POLICY insert_eval ON public.evaluations 
  FOR INSERT WITH CHECK (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      nucleo_id = public.current_user_nucleo_id()
    )
  );

CREATE POLICY update_eval ON public.evaluations 
  FOR UPDATE USING (public.is_active_user() AND public.is_master_or_rh());

-- 5.15 payment_codes policies
CREATE POLICY select_pay ON public.payment_codes 
  FOR SELECT USING (public.is_active_user() AND public.can_access_nucleo(nucleo_id));

CREATE POLICY modify_pay ON public.payment_codes 
  FOR ALL USING (public.is_active_user() AND public.is_master_or_rh());

-- 5.16 suggestions policies
CREATE POLICY select_sug ON public.suggestions 
  FOR SELECT USING (public.is_active_user() AND public.can_access_nucleo(nucleo_id));

CREATE POLICY insert_sug ON public.suggestions 
  FOR INSERT WITH CHECK (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      nucleo_id = public.current_user_nucleo_id()
    )
  );

CREATE POLICY update_sug ON public.suggestions 
  FOR UPDATE USING (public.is_active_user() AND public.is_master_or_rh());

-- 5.17 audit_logs policies
CREATE POLICY select_audit ON public.audit_logs FOR SELECT USING (public.is_active_user() AND public.is_master_or_rh());
