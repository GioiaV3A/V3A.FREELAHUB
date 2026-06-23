-- Add CNPJ and tax residency columns to freelancers table if they do not exist
ALTER TABLE public.freelancers ADD COLUMN IF NOT EXISTS cnpj_normalized varchar(14);
ALTER TABLE public.freelancers ADD COLUMN IF NOT EXISTS cnpj_is_mock boolean NOT NULL DEFAULT false;
ALTER TABLE public.freelancers ADD COLUMN IF NOT EXISTS cnpj_mock_batch varchar;
ALTER TABLE public.freelancers ADD COLUMN IF NOT EXISTS cnpj_verified_at timestamp with time zone;
ALTER TABLE public.freelancers ADD COLUMN IF NOT EXISTS cnpj_updated_at timestamp with time zone;
ALTER TABLE public.freelancers ADD COLUMN IF NOT EXISTS cnpj_updated_by uuid;
ALTER TABLE public.freelancers ADD COLUMN IF NOT EXISTS foreign_tax_id varchar;
ALTER TABLE public.freelancers ADD COLUMN IF NOT EXISTS tax_country_code varchar(2) NOT NULL DEFAULT 'BR';
ALTER TABLE public.freelancers ADD COLUMN IF NOT EXISTS cnpj_source varchar;

-- Add foreign key constraint for cnpj_updated_by if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'freelancers' AND constraint_name = 'freelancers_cnpj_updated_by_fkey'
  ) THEN
    ALTER TABLE public.freelancers 
    ADD CONSTRAINT freelancers_cnpj_updated_by_fkey 
    FOREIGN KEY (cnpj_updated_by) REFERENCES public.profiles(id);
  END IF;
END $$;

-- Add check constraint for structural CNPJ validation
ALTER TABLE public.freelancers DROP CONSTRAINT IF EXISTS chk_freelancers_cnpj;
ALTER TABLE public.freelancers DROP CONSTRAINT IF EXISTS check_cnpj_structural;
ALTER TABLE public.freelancers 
ADD CONSTRAINT chk_freelancers_cnpj 
CHECK (
  cnpj_normalized IS NULL 
  OR cnpj_normalized ~ '^[A-Z0-9]{12}[0-9]{2}$'
);

-- Add index on cnpj_normalized if not exists
CREATE INDEX IF NOT EXISTS idx_freelancers_cnpj_normalized ON public.freelancers (cnpj_normalized);

-- Recreate trigger function normalize_freelancer_fields() to include CNPJ normalization
CREATE OR REPLACE FUNCTION public.normalize_freelancer_fields()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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

  NEW.cnpj_normalized := CASE 
    WHEN NEW.cnpj_normalized IS NULL OR TRIM(NEW.cnpj_normalized) = '' THEN NULL 
    ELSE UPPER(REGEXP_REPLACE(NEW.cnpj_normalized, '[^a-zA-Z0-9]', '', 'g')) 
  END;

  RETURN NEW;
END;
$function$;
