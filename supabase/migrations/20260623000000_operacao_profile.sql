-- Migration to support OPERAÇÃO profile

-- 1. Add 'operacao' to public.app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operacao';

-- 2. Create is_operacao helper function
CREATE OR REPLACE FUNCTION public.is_operacao()
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT role = 'operacao' FROM public.profiles WHERE id = auth.uid()),
    false
  );
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. Update can_access_nucleo helper function
CREATE OR REPLACE FUNCTION public.can_access_nucleo(target_nucleo_id uuid)
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  RETURN (
    public.is_master() OR 
    public.is_rh() OR 
    (public.current_user_role() = 'c_level') OR
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
      public.current_user_role() = 'operacao' OR
      public.current_user_role() = 'nucleo'
    )
  );

-- 12. Create get_profile_nucleo_id security helper to avoid RLS restrictions when checking links
CREATE OR REPLACE FUNCTION public.get_profile_nucleo_id(user_uuid uuid)
RETURNS uuid SECURITY DEFINER AS $$
BEGIN
  RETURN (SELECT nucleo_id FROM public.profiles WHERE id = user_uuid);
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 13. Update public_form_links policies
DROP POLICY IF EXISTS select_public_form_links ON public.public_form_links;
CREATE POLICY select_public_form_links ON public.public_form_links 
  FOR SELECT USING (
    public.is_active_user() AND (
      public.is_master_or_rh() OR
      created_by = auth.uid() OR
      (
        public.current_user_role() = 'nucleo' AND 
        public.get_profile_nucleo_id(created_by) = public.current_user_nucleo_id()
      )
    )
  );

DROP POLICY IF EXISTS insert_public_form_links ON public.public_form_links;
CREATE POLICY insert_public_form_links ON public.public_form_links 
  FOR INSERT WITH CHECK (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      (
        link_type = 'new_freelancer' AND 
        created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS update_public_form_links ON public.public_form_links;
CREATE POLICY update_public_form_links ON public.public_form_links 
  FOR UPDATE USING (public.is_active_user() AND public.is_master_or_rh());

-- 14. Update freelancer_public_submissions policies
DROP POLICY IF EXISTS select_submissions ON public.freelancer_public_submissions;
CREATE POLICY select_submissions ON public.freelancer_public_submissions 
  FOR SELECT USING (public.is_active_user() AND public.is_master_or_rh());

DROP POLICY IF EXISTS modify_submissions ON public.freelancer_public_submissions;
CREATE POLICY modify_submissions ON public.freelancer_public_submissions 
  FOR ALL USING (public.is_active_user() AND public.is_master_or_rh());
