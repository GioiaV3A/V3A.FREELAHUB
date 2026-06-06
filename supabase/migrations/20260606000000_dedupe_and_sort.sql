-- 1. Alter public.freelancers to add dedupe and merge columns
ALTER TABLE public.freelancers ADD COLUMN IF NOT EXISTS email_normalized text;
ALTER TABLE public.freelancers ADD COLUMN IF NOT EXISTS whatsapp_normalized text;
ALTER TABLE public.freelancers ADD COLUMN IF NOT EXISTS full_name_normalized text;
ALTER TABLE public.freelancers ADD COLUMN IF NOT EXISTS merged_into_freelancer_id uuid references public.freelancers(id);
ALTER TABLE public.freelancers ADD COLUMN IF NOT EXISTS merged_at timestamptz;
ALTER TABLE public.freelancers ADD COLUMN IF NOT EXISTS merged_by uuid references auth.users(id);

-- 2. Create index on normalized columns
CREATE INDEX IF NOT EXISTS idx_freelancers_email_normalized ON public.freelancers(email_normalized);
CREATE INDEX IF NOT EXISTS idx_freelancers_whatsapp_normalized ON public.freelancers(whatsapp_normalized);
CREATE INDEX IF NOT EXISTS idx_freelancers_full_name_normalized ON public.freelancers(full_name_normalized);
CREATE INDEX IF NOT EXISTS idx_freelancers_merged_into ON public.freelancers(merged_into_freelancer_id);

-- 3. Create normalization helper function and trigger
CREATE OR REPLACE FUNCTION public.normalize_freelancer_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_normalized := CASE 
    WHEN NEW.email IS NULL OR TRIM(NEW.email) = '' THEN NULL 
    ELSE LOWER(TRIM(NEW.email)) 
  END;

  NEW.whatsapp_normalized := CASE 
    WHEN NEW.whatsapp IS NULL OR TRIM(NEW.whatsapp) = '' THEN NULL 
    ELSE REGEXP_REPLACE(NEW.whatsapp, '\D', '', 'g') 
  END;

  NEW.full_name_normalized := CASE 
    WHEN NEW.full_name IS NULL OR TRIM(NEW.full_name) = '' THEN NULL 
    ELSE translate(upper(trim(regexp_replace(NEW.full_name, '\s+', ' ', 'g'))), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÝ', 'AAAAAEEEEIIIIOOOOOUUUUCY') 
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_freelancer_fields ON public.freelancers;
CREATE TRIGGER trg_normalize_freelancer_fields
BEFORE INSERT OR UPDATE ON public.freelancers
FOR EACH ROW
EXECUTE FUNCTION public.normalize_freelancer_fields();

-- 4. Update existing records
UPDATE public.freelancers
SET 
  email_normalized = CASE WHEN email IS NULL OR TRIM(email) = '' THEN NULL ELSE LOWER(TRIM(email)) END,
  whatsapp_normalized = CASE WHEN whatsapp IS NULL OR TRIM(whatsapp) = '' THEN NULL ELSE REGEXP_REPLACE(whatsapp, '\D', '', 'g') END,
  full_name_normalized = CASE WHEN full_name IS NULL OR TRIM(full_name) = '' THEN NULL ELSE translate(upper(trim(regexp_replace(full_name, '\s+', ' ', 'g'))), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÝ', 'AAAAAEEEEIIIIOOOOOUUUUCY') END;

-- 5. Create freelancer_merge_logs table
CREATE TABLE IF NOT EXISTS public.freelancer_merge_logs (
    id uuid primary key default gen_random_uuid(),
    canonical_freelancer_id uuid references public.freelancers(id) ON DELETE CASCADE,
    merged_freelancer_id uuid,
    merged_by uuid references auth.users(id) ON DELETE SET NULL,
    reason text,
    previous_data jsonb,
    merged_data jsonb,
    created_at timestamptz default now()
);

-- 6. Enable RLS on freelancer_merge_logs
ALTER TABLE public.freelancer_merge_logs ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policy for select_merge_logs
DROP POLICY IF EXISTS select_merge_logs ON public.freelancer_merge_logs;
CREATE POLICY select_merge_logs ON public.freelancer_merge_logs
  FOR SELECT USING (public.is_active_user() AND public.is_master_or_rh());
