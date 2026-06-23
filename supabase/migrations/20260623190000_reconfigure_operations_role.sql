-- Migration to support operations profile (reconfigured canonical name)

-- 1. Add 'operations' to public.app_role enum if it does not exist
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operations';

-- 2. Create/update is_operations helper function
CREATE OR REPLACE FUNCTION public.is_operations()
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT role = 'operations' FROM public.profiles WHERE id = auth.uid()),
    false
  );
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Recreate is_operacao to support operations (backward compatibility / fallback)
CREATE OR REPLACE FUNCTION public.is_operacao()
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT role IN ('operations', 'operacao') FROM public.profiles WHERE id = auth.uid()),
    false
  );
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. Update can_access_nucleo helper function to support 'operations'
CREATE OR REPLACE FUNCTION public.can_access_nucleo(target_nucleo_id uuid)
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  RETURN (
    public.is_master() OR 
    public.is_rh() OR 
    (public.current_user_role() = 'c_level') OR
    (public.current_user_role() = 'operations') OR
    (public.current_user_role() = 'operacao') OR
    (public.current_user_role() = 'nucleo' AND target_nucleo_id = public.current_user_nucleo_id())
  );
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 4. Update jobs policies
DROP POLICY IF EXISTS insert_jobs ON public.jobs;
CREATE POLICY insert_jobs ON public.jobs 
  FOR INSERT WITH CHECK (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      public.current_user_role() = 'c_level' OR
      public.current_user_role() = 'operations' OR
      public.current_user_role() = 'operacao' OR
      nucleo_id = public.current_user_nucleo_id()
    )
  );

DROP POLICY IF EXISTS update_jobs ON public.jobs;
CREATE POLICY update_jobs ON public.jobs 
  FOR UPDATE USING (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      public.current_user_role() = 'c_level' OR
      public.current_user_role() = 'operations' OR
      public.current_user_role() = 'operacao' OR
      nucleo_id = public.current_user_nucleo_id()
    )
  );

-- 5. Update job_freelancer_requests policies
DROP POLICY IF EXISTS modify_jfr ON public.job_freelancer_requests;
CREATE POLICY modify_jfr ON public.job_freelancer_requests 
  FOR ALL USING (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      public.current_user_role() = 'c_level' OR
      public.current_user_role() = 'operations' OR
      public.current_user_role() = 'operacao' OR
      EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.nucleo_id = public.current_user_nucleo_id())
    )
  );

-- 6. Update shortlist_candidates policies
DROP POLICY IF EXISTS insert_sc ON public.shortlist_candidates;
CREATE POLICY insert_sc ON public.shortlist_candidates 
  FOR INSERT WITH CHECK (
    public.is_active_user() AND 
    NOT EXISTS (SELECT 1 FROM public.freelancers f WHERE f.id = freelancer_id AND f.status = 'bloqueado') AND
    (
      public.is_master_or_rh() OR 
      public.current_user_role() = 'c_level' OR
      public.current_user_role() = 'operations' OR
      public.current_user_role() = 'operacao' OR
      (SELECT j.nucleo_id FROM public.jobs j WHERE j.id = job_id) = public.current_user_nucleo_id()
    )
  );

DROP POLICY IF EXISTS update_sc ON public.shortlist_candidates;
CREATE POLICY update_sc ON public.shortlist_candidates 
  FOR UPDATE USING (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      public.current_user_role() = 'c_level' OR
      public.current_user_role() = 'operations' OR
      public.current_user_role() = 'operacao' OR
      (SELECT j.nucleo_id FROM public.jobs j WHERE j.id = job_id) = public.current_user_nucleo_id()
    )
  );

-- 7. Update negotiations policies
DROP POLICY IF EXISTS insert_update_negotiations ON public.negotiations;
CREATE POLICY insert_update_negotiations ON public.negotiations 
  FOR ALL USING (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      public.current_user_role() = 'c_level' OR
      public.current_user_role() = 'operations' OR
      public.current_user_role() = 'operacao' OR
      (SELECT j.nucleo_id FROM public.jobs j WHERE j.id = job_id) = public.current_user_nucleo_id()
    )
  );

-- 8. Update exception_approvals policies
DROP POLICY IF EXISTS insert_ea ON public.exception_approvals;
CREATE POLICY insert_ea ON public.exception_approvals 
  FOR INSERT WITH CHECK (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      public.current_user_role() = 'c_level' OR
      public.current_user_role() = 'operations' OR
      public.current_user_role() = 'operacao' OR
      (SELECT j.nucleo_id FROM public.jobs j WHERE j.id = job_id) = public.current_user_nucleo_id()
    )
  );

-- 9. Update allocations policies
DROP POLICY IF EXISTS modify_alloc ON public.allocations;
CREATE POLICY modify_alloc ON public.allocations 
  FOR ALL USING (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      public.current_user_role() = 'c_level' OR
      public.current_user_role() = 'operations' OR
      public.current_user_role() = 'operacao'
    )
  );

-- 10. Update evaluations policies
DROP POLICY IF EXISTS insert_eval ON public.evaluations;
CREATE POLICY insert_eval ON public.evaluations 
  FOR INSERT WITH CHECK (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      public.current_user_role() = 'c_level' OR
      public.current_user_role() = 'operations' OR
      public.current_user_role() = 'operacao' OR
      nucleo_id = public.current_user_nucleo_id()
    )
  );

-- 11. Update allocation_approvals policies
DROP POLICY IF EXISTS select_aa ON public.allocation_approvals;
CREATE POLICY select_aa ON public.allocation_approvals
  FOR SELECT USING (
    public.is_active_user() AND (
      public.is_master_or_rh() OR
      public.is_c_level() OR
      public.current_user_role() = 'operations' OR
      public.current_user_role() = 'operacao' OR
      (
        public.current_user_role() = 'nucleo' AND (
          requested_by = auth.uid() OR
          nucleus_id = public.current_user_nucleo_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS insert_aa ON public.allocation_approvals;
CREATE POLICY insert_aa ON public.allocation_approvals
  FOR INSERT WITH CHECK (
    public.is_active_user() AND (
      public.is_master_or_rh() OR
      public.is_c_level() OR
      public.current_user_role() = 'operations' OR
      public.current_user_role() = 'operacao' OR
      public.current_user_role() = 'nucleo'
    )
  );

-- 12. Update profiles creation policy to enforce operations creator restriction
DROP POLICY IF EXISTS insert_profiles ON public.profiles;
CREATE POLICY insert_profiles ON public.profiles
  FOR INSERT WITH CHECK (
    -- If creating operations profile, creator must be master, rh, or c_level
    (NEW.role = 'operations' AND (public.is_master_or_rh() OR public.current_user_role() = 'c_level'))
    -- Otherwise, follow existing rule (master or rh only)
    OR (NEW.role != 'operations' AND public.is_master_or_rh())
  );

DROP POLICY IF EXISTS update_profiles ON public.profiles;
CREATE POLICY update_profiles ON public.profiles
  FOR UPDATE USING (
    public.is_active_user() AND (
      public.is_master()
      OR (public.is_rh() AND (role = 'nucleo'::public.app_role OR role = 'operations'::public.app_role OR role = 'operacao'::public.app_role OR role = 'rh'::public.app_role))
      OR (public.current_user_role() = 'c_level' AND (role = 'operations'::public.app_role OR role = 'operacao'::public.app_role))
      OR (id = auth.uid())
    )
  );
