-- Migration to support C-LEVEL profile

-- 1. Create is_c_level helper function
CREATE OR REPLACE FUNCTION public.is_c_level()
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT role = 'c_level' FROM public.profiles WHERE id = auth.uid()),
    false
  );
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. Update can_access_nucleo helper function
CREATE OR REPLACE FUNCTION public.can_access_nucleo(target_nucleo_id uuid)
RETURNS boolean SECURITY DEFINER AS $$
BEGIN
  RETURN (
    public.is_master() OR 
    public.is_rh() OR 
    (public.current_user_role() = 'c_level') OR
    (public.current_user_role() = 'nucleo' AND target_nucleo_id = public.current_user_nucleo_id())
  );
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. Update nucleos policies
DROP POLICY IF EXISTS insert_update_nucleos ON public.nucleos;
CREATE POLICY insert_update_nucleos ON public.nucleos 
  FOR ALL USING (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      public.current_user_role() = 'c_level'
    )
  );

-- 4. Update jobs policies
DROP POLICY IF EXISTS insert_jobs ON public.jobs;
CREATE POLICY insert_jobs ON public.jobs 
  FOR INSERT WITH CHECK (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      public.current_user_role() = 'c_level' OR
      nucleo_id = public.current_user_nucleo_id()
    )
  );

DROP POLICY IF EXISTS update_jobs ON public.jobs;
CREATE POLICY update_jobs ON public.jobs 
  FOR UPDATE USING (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      public.current_user_role() = 'c_level' OR
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
      (SELECT j.nucleo_id FROM public.jobs j WHERE j.id = job_id) = public.current_user_nucleo_id()
    )
  );

DROP POLICY IF EXISTS update_sc ON public.shortlist_candidates;
CREATE POLICY update_sc ON public.shortlist_candidates 
  FOR UPDATE USING (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      public.current_user_role() = 'c_level' OR
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
      (SELECT j.nucleo_id FROM public.jobs j WHERE j.id = job_id) = public.current_user_nucleo_id()
    )
  );

-- 9. Update allocations policies
DROP POLICY IF EXISTS modify_alloc ON public.allocations;
CREATE POLICY modify_alloc ON public.allocations 
  FOR ALL USING (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      public.current_user_role() = 'c_level'
    )
  );

-- 10. Update evaluations policies
DROP POLICY IF EXISTS insert_eval ON public.evaluations;
CREATE POLICY insert_eval ON public.evaluations 
  FOR INSERT WITH CHECK (
    public.is_active_user() AND (
      public.is_master_or_rh() OR 
      public.current_user_role() = 'c_level' OR
      nucleo_id = public.current_user_nucleo_id()
    )
  );

-- 11. Update users
UPDATE public.profiles
SET role = 'c_level',
    nucleo_id = NULL,
    updated_at = now()
WHERE email IN ('alexandre@v3a.ag', 'leo@v3a.ag');
