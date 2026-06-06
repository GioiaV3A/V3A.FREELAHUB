-- Create Cities Table for Autocomplete/Standardization
CREATE TABLE IF NOT EXISTS public.cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code TEXT NOT NULL,
    state_code TEXT NOT NULL,
    city_name TEXT NOT NULL,
    city_name_normalized TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

-- Create Policies
DROP POLICY IF EXISTS select_cities ON public.cities;
CREATE POLICY select_cities ON public.cities 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS modify_cities ON public.cities;
CREATE POLICY modify_cities ON public.cities 
    FOR ALL USING (public.is_active_user() AND public.is_master_or_rh());

-- Insert initial cities
INSERT INTO public.cities (country_code, state_code, city_name, city_name_normalized) VALUES
('BR', 'RJ', 'RIO DE JANEIRO', 'RIO DE JANEIRO'),
('BR', 'SP', 'SÃO PAULO', 'SAO PAULO'),
('BR', 'MG', 'BELO HORIZONTE', 'BELO HORIZONTE'),
('BR', 'DF', 'BRASÍLIA', 'BRASILIA'),
('BR', 'PR', 'CURITIBA', 'CURITIBA'),
('BR', 'RS', 'PORTO ALEGRE', 'PORTO ALEGRE'),
('BR', 'BA', 'SALVADOR', 'SALVADOR'),
('BR', 'PE', 'RECIFE', 'RECIFE'),
('BR', 'CE', 'FORTALEZA', 'FORTALEZA'),
('BR', 'GO', 'GOIÂNIA', 'GOIANIA'),
('BR', 'SC', 'FLORIANÓPOLIS', 'FLORIANOPOLIS'),
('BR', 'SP', 'CAMPINAS', 'CAMPINAS'),
('BR', 'RJ', 'NITERÓI', 'NITEROI'),
('BR', 'SP', 'SANTOS', 'SANTOS'),
('BR', 'SP', 'BARUERI', 'BARUERI'),
('BR', 'SP', 'OSASCO', 'OSASCO'),
('BR', 'SP', 'GUARULHOS', 'GUARULHOS')
ON CONFLICT DO NOTHING;
