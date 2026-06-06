-- 1. Create Tables
CREATE TABLE IF NOT EXISTS public.public_form_links (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_hash text NOT NULL UNIQUE,
  link_type text NOT NULL CHECK (link_type IN ('new_freelancer', 'update_freelancer')),
  freelancer_id uuid NULL REFERENCES public.freelancers(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'revoked')),
  expires_at timestamptz NULL,
  used_at timestamptz NULL,
  revoked_at timestamptz NULL,
  revoked_by uuid NULL REFERENCES auth.users(id),
  submitted_submission_id uuid NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT check_freelancer_id_type CHECK (
    (link_type = 'new_freelancer' AND freelancer_id IS NULL) OR 
    (link_type = 'update_freelancer' AND freelancer_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.freelancer_public_submissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id uuid NOT NULL REFERENCES public.public_form_links(id) ON DELETE CASCADE,
  submission_type text NOT NULL CHECK (submission_type IN ('new_freelancer', 'update_freelancer')),
  freelancer_id uuid NULL REFERENCES public.freelancers(id) ON DELETE CASCADE,
  submitted_data jsonb NOT NULL,
  current_data_snapshot jsonb NULL,
  diff_data jsonb NULL,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'under_review', 'approved', 'rejected', 'converted')),
  reviewed_by uuid NULL REFERENCES auth.users(id),
  reviewed_at timestamptz NULL,
  review_notes text NULL,
  converted_freelancer_id uuid NULL REFERENCES public.freelancers(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add foreign key constraint to link_id after both tables are created
ALTER TABLE public.public_form_links 
  DROP CONSTRAINT IF EXISTS fk_submitted_submission;

ALTER TABLE public.public_form_links 
  ADD CONSTRAINT fk_submitted_submission 
  FOREIGN KEY (submitted_submission_id) 
  REFERENCES public.freelancer_public_submissions(id) ON DELETE SET NULL;

-- 2. Add updated_at trigger to both tables
DROP TRIGGER IF EXISTS trigger_update_updated_at ON public.public_form_links;
CREATE TRIGGER trigger_update_updated_at BEFORE UPDATE ON public.public_form_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_updated_at ON public.freelancer_public_submissions;
CREATE TRIGGER trigger_update_updated_at BEFORE UPDATE ON public.freelancer_public_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Enable RLS on both tables
ALTER TABLE public.public_form_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancer_public_submissions ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
DROP POLICY IF EXISTS select_public_form_links ON public.public_form_links;
CREATE POLICY select_public_form_links ON public.public_form_links 
  FOR SELECT USING (public.is_active_user() AND public.is_master_or_rh());

DROP POLICY IF EXISTS insert_public_form_links ON public.public_form_links;
CREATE POLICY insert_public_form_links ON public.public_form_links 
  FOR INSERT WITH CHECK (public.is_active_user() AND public.is_master_or_rh());

DROP POLICY IF EXISTS update_public_form_links ON public.public_form_links;
CREATE POLICY update_public_form_links ON public.public_form_links 
  FOR UPDATE USING (public.is_active_user() AND public.is_master_or_rh());

DROP POLICY IF EXISTS select_submissions ON public.freelancer_public_submissions;
CREATE POLICY select_submissions ON public.freelancer_public_submissions 
  FOR SELECT USING (public.is_active_user() AND public.is_master_or_rh());

DROP POLICY IF EXISTS modify_submissions ON public.freelancer_public_submissions;
CREATE POLICY modify_submissions ON public.freelancer_public_submissions 
  FOR ALL USING (public.is_active_user() AND public.is_master_or_rh());
