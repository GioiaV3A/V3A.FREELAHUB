-- ============================================================
-- Migration: Política de Valores, Aprovação Head do Núcleo, RLS
-- ============================================================

-- 1. Adicionar is_nucleus_head em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_nucleus_head boolean DEFAULT false;

-- 2. Adicionar head_user_id em nucleos (caso não exista)
ALTER TABLE public.nucleos
  ADD COLUMN IF NOT EXISTS head_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Adicionar campos de política em job_freelancer_requests
ALTER TABLE public.job_freelancer_requests
  ADD COLUMN IF NOT EXISTS policy_status text DEFAULT 'inside_policy',
  ADD COLUMN IF NOT EXISTS policy_exceeded_at_creation boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS policy_exceeded_reason text,
  ADD COLUMN IF NOT EXISTS approval_required boolean DEFAULT false;

-- Atualizar policy_status baseado no campo is_above_policy existente
UPDATE public.job_freelancer_requests
SET policy_status = 'outside_policy'
WHERE is_above_policy = true AND policy_status = 'inside_policy';

-- 4. Estender allocation_approvals com campos faltantes para exceções de valor
ALTER TABLE public.allocation_approvals
  ADD COLUMN IF NOT EXISTS nucleus_id uuid REFERENCES public.nucleos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requested_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS remuneration_model text,
  ADD COLUMN IF NOT EXISTS calculated_policy_reference numeric(12,2),
  ADD COLUMN IF NOT EXISTS calculated_policy_limit numeric(12,2),
  ADD COLUMN IF NOT EXISTS excess_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS excess_percent numeric(12,4),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_comment text,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_comment text;

-- Migrar campos existentes para novos nomes (backwards compat)
UPDATE public.allocation_approvals
SET
  requested_amount = COALESCE(requested_amount, negotiated_value),
  calculated_policy_limit = COALESCE(calculated_policy_limit, policy_ceiling_value),
  calculated_policy_reference = COALESCE(calculated_policy_reference, policy_reference_value),
  excess_amount = CASE 
    WHEN negotiated_value IS NOT NULL AND policy_ceiling_value IS NOT NULL 
    THEN GREATEST(0, negotiated_value - policy_ceiling_value)
    ELSE NULL
  END
WHERE approval_type = 'value_exception';

-- 5. Preencher nucleus_id em allocation_approvals baseado no job
UPDATE public.allocation_approvals aa
SET nucleus_id = j.nucleo_id
FROM public.job_freelancer_requests jfr
JOIN public.jobs j ON j.id = jfr.job_id
WHERE aa.request_id = jfr.id AND aa.nucleus_id IS NULL;

-- 6. Adicionar índices
CREATE INDEX IF NOT EXISTS idx_aa_nucleus_id ON public.allocation_approvals(nucleus_id);
CREATE INDEX IF NOT EXISTS idx_aa_status ON public.allocation_approvals(status);
CREATE INDEX IF NOT EXISTS idx_aa_approval_type ON public.allocation_approvals(approval_type);
CREATE INDEX IF NOT EXISTS idx_jfr_policy_status ON public.job_freelancer_requests(policy_status);
CREATE INDEX IF NOT EXISTS idx_jfr_policy_exceeded ON public.job_freelancer_requests(policy_exceeded_at_creation);

-- 7. Corrigir núcleo N21: Head = TESTE HEAD N21
-- Atualizar head_user_id do N21 para apontar para TESTE HEAD N21
UPDATE public.nucleos
SET 
  head_user_id = 'e97a217b-da64-4cd0-b255-8a9d8608d5a6',
  updated_at = now()
WHERE id = '8340e400-cfb9-4874-be81-ddc5136a6d65'
  AND (head_user_id IS DISTINCT FROM 'e97a217b-da64-4cd0-b255-8a9d8608d5a6');

-- Marcar TESTE HEAD N21 como Head do Núcleo
UPDATE public.profiles
SET 
  is_nucleus_head = true,
  updated_at = now()
WHERE id = 'e97a217b-da64-4cd0-b255-8a9d8608d5a6';

-- 8. Função auxiliar: verificar se usuário é Head de um núcleo específico
CREATE OR REPLACE FUNCTION public.is_nucleus_head_of(target_nucleus_id uuid)
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT p.is_nucleus_head = true AND p.nucleo_id = target_nucleus_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
    ),
    false
  );
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Função auxiliar: verificar se usuário pode aprovar exceções de valor
CREATE OR REPLACE FUNCTION public.can_approve_value_exception(target_nucleus_id uuid)
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  RETURN (
    public.is_master() OR
    public.is_rh() OR
    public.is_c_level() OR
    public.is_nucleus_head_of(target_nucleus_id)
  );
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 9. Corrigir RLS em allocation_approvals

-- 9.1 SELECT: MASTER/RH/C_LEVEL veem tudo; Núcleo vê seu próprio núcleo ou criados por ele
DROP POLICY IF EXISTS select_aa ON public.allocation_approvals;
CREATE POLICY select_aa ON public.allocation_approvals
  FOR SELECT USING (
    public.is_active_user() AND (
      public.is_master_or_rh() OR
      public.is_c_level() OR
      (
        public.current_user_role() = 'nucleo' AND (
          requested_by = auth.uid() OR
          nucleus_id = public.current_user_nucleo_id()
        )
      )
    )
  );

-- 9.2 INSERT: MASTER/RH/C_LEVEL e Núcleo (para seu núcleo)
DROP POLICY IF EXISTS insert_aa ON public.allocation_approvals;
CREATE POLICY insert_aa ON public.allocation_approvals
  FOR INSERT WITH CHECK (
    public.is_active_user() AND (
      public.is_master_or_rh() OR
      public.is_c_level() OR
      public.current_user_role() = 'nucleo'
    )
  );

-- 9.3 UPDATE: MASTER/RH/C_LEVEL e Head do Núcleo vinculado
DROP POLICY IF EXISTS update_aa ON public.allocation_approvals;
CREATE POLICY update_aa ON public.allocation_approvals
  FOR UPDATE USING (
    public.is_active_user() AND (
      public.is_master_or_rh() OR
      public.is_c_level() OR
      (
        public.current_user_role() = 'nucleo' AND
        public.can_approve_value_exception(nucleus_id)
      )
    )
  );

-- 10. Verificar se app_role enum tem c_level, senão adicionar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'public.app_role'::regtype 
      AND enumlabel = 'c_level'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'c_level';
  END IF;
END$$;

-- 11. Adicionar trigger de updated_at em allocation_approvals se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_update_updated_at' 
      AND tgrelid = 'public.allocation_approvals'::regclass
  ) THEN
    CREATE TRIGGER trigger_update_updated_at
    BEFORE UPDATE ON public.allocation_approvals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;
