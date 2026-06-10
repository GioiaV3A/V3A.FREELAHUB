-- Database Migration: Refine Schedule Conflict Approvals and RLS Policies

-- 1. Add approval reference columns to shortlist_candidates if they do not exist
ALTER TABLE public.shortlist_candidates
ADD COLUMN IF NOT EXISTS schedule_approval_id uuid REFERENCES public.allocation_approvals(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS value_approval_id uuid REFERENCES public.allocation_approvals(id) ON DELETE SET NULL;

-- 2. Create partial unique index to prevent duplicate pending approvals
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_schedule_conflict_approval
ON public.allocation_approvals (job_id, shortlist_candidate_id, freelancer_id, approval_type)
WHERE status = 'pending';

-- 3. Update RLS policies on allocation_approvals
ALTER TABLE public.allocation_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_aa ON public.allocation_approvals;
CREATE POLICY select_aa ON public.allocation_approvals
  FOR SELECT USING (
    public.is_active_user() AND (
      public.is_master_or_rh() OR
      public.current_user_role() = 'c_level' OR
      (SELECT j.nucleo_id FROM public.jobs j WHERE j.id = job_id) = public.current_user_nucleo_id()
    )
  );

DROP POLICY IF EXISTS insert_aa ON public.allocation_approvals;
CREATE POLICY insert_aa ON public.allocation_approvals
  FOR INSERT WITH CHECK (
    public.is_active_user() AND
    requested_by = auth.uid() AND
    (
      public.is_master_or_rh() OR
      public.current_user_role() = 'c_level' OR
      (SELECT j.nucleo_id FROM public.jobs j WHERE j.id = job_id) = public.current_user_nucleo_id()
    )
  );

DROP POLICY IF EXISTS update_aa ON public.allocation_approvals;
CREATE POLICY update_aa ON public.allocation_approvals
  FOR UPDATE USING (
    public.is_active_user() AND (
      public.is_master_or_rh() OR (
        public.current_user_role() = 'c_level' AND approval_type = 'value_exception'
      )
    )
  );

-- 4. Update RLS policies on negotiation_history
ALTER TABLE public.negotiation_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS insert_nh ON public.negotiation_history;
CREATE POLICY insert_nh ON public.negotiation_history
  FOR INSERT WITH CHECK (
    public.is_active_user() AND (
      public.is_master_or_rh() OR
      public.current_user_role() = 'c_level' OR
      (SELECT j.nucleo_id FROM public.jobs j WHERE j.id = job_id) = public.current_user_nucleo_id()
    )
  );
