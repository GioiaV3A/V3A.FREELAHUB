export interface Country {
  name_pt: string;
  name_en: string;
  iso2: string;
  dial_code: string;
}

export const countries: Country[] = [
  { name_pt: 'Brasil', name_en: 'Brazil', iso2: 'BR', dial_code: '+55' },
  { name_pt: 'Portugal', name_en: 'Portugal', iso2: 'PT', dial_code: '+351' },
  { name_pt: 'Estados Unidos', name_en: 'United States', iso2: 'US', dial_code: '+1' },
  { name_pt: 'Argentina', name_en: 'Argentina', iso2: 'AR', dial_code: '+54' },
  { name_pt: 'Uruguai', name_en: 'Uruguay', iso2: 'UY', dial_code: '+598' },
  { name_pt: 'Chile', name_en: 'Chile', iso2: 'CL', dial_code: '+56' },
  { name_pt: 'Colômbia', name_en: 'Colombia', iso2: 'CO', dial_code: '+57' },
  { name_pt: 'Espanha', name_en: 'Spain', iso2: 'ES', dial_code: '+34' },
  { name_pt: 'Itália', name_en: 'Italy', iso2: 'IT', dial_code: '+39' },
  { name_pt: 'Alemanha', name_en: 'Germany', iso2: 'DE', dial_code: '+49' },
  { name_pt: 'Reino Unido', name_en: 'United Kingdom', iso2: 'GB', dial_code: '+44' },
  { name_pt: 'França', name_en: 'France', iso2: 'FR', dial_code: '+33' },
  { name_pt: 'Japão', name_en: 'Japan', iso2: 'JP', dial_code: '+81' },
  { name_pt: 'Austrália', name_en: 'Australia', iso2: 'AU', dial_code: '+61' },
  { name_pt: 'Canadá', name_en: 'Canada', iso2: 'CA', dial_code: '+1' },
  { name_pt: 'Angola', name_en: 'Angola', iso2: 'AO', dial_code: '+244' },
  { name_pt: 'Moçambique', name_en: 'Mozambique', iso2: 'MZ', dial_code: '+258' },
  { name_pt: 'Paraguai', name_en: 'Paraguay', iso2: 'PY', dial_code: '+595' },
  { name_pt: 'Bolívia', name_en: 'Bolivia', iso2: 'BO', dial_code: '+591' },
  { name_pt: 'Peru', name_en: 'Peru', iso2: 'PE', dial_code: '+51' },
  { name_pt: 'Equador', name_en: 'Ecuador', iso2: 'EC', dial_code: '+593' },
  { name_pt: 'Venezuela', name_en: 'Venezuela', iso2: 'VE', dial_code: '+58' },
  { name_pt: 'México', name_en: 'Mexico', iso2: 'MX', dial_code: '+52' },
  { name_pt: 'China', name_en: 'China', iso2: 'CN', dial_code: '+86' },
  { name_pt: 'Índia', name_en: 'India', iso2: 'IN', dial_code: '+91' },
  { name_pt: 'África do Sul', name_en: 'South Africa', iso2: 'ZA', dial_code: '+27' },
].sort((a, b) => a.name_pt.localeCompare(b.name_pt));
