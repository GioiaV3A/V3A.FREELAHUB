'use client';

import React, { useState } from 'react';
import { 
  validatePublicLinkAction, 
  submitPublicFormAction, 
  uploadPublicPortfolioAction,
  checkPublicDuplicateAction 
} from '@/app/actions/publicForm';
import { 
  UserSquare2, 
  Contact, 
  MapPin, 
  Briefcase, 
  Layers, 
  CheckSquare, 
  Upload, 
  Link as LinkIcon, 
  Instagram, 
  Linkedin, 
  Check, 
  AlertCircle,
  FileText,
  Trash2,
  Loader2
} from 'lucide-react';
import { countries } from '@/lib/countries';
import PhoneInputWithCountryCode from './PhoneInputWithCountryCode';
import CityAutocomplete from './CityAutocomplete';
import CnpjInput from './CnpjInput';
import { validateCnpj } from '@/lib/cnpj';


interface PublicFreelancerFormProps {
  token: string;
  linkType: 'new_freelancer' | 'update_freelancer';
  linkId: string;
  functions: Array<{ id: string; name: string }>;
  industries: Array<{ id: string; name: string }>;
  initialData?: any;
}

export default function PublicFreelancerForm({
  token,
  linkType,
  linkId,
  functions,
  industries,
  initialData
}: PublicFreelancerFormProps) {
  // Form step controls (1: Basic Info, 2: Professional Profile, 3: V3A Experience, 4: Portfolios & Redes, 5: Submit)
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Find initial country code based on initialData location or default to BR
  const getInitialCountry = () => {
    if (!initialData) return countries.find(c => c.iso2 === 'BR')!;
    const match = countries.find(c => 
      c.name_pt.toLowerCase() === initialData.location_text?.toLowerCase() ||
      c.name_en.toLowerCase() === initialData.location_text?.toLowerCase() ||
      c.iso2.toLowerCase() === initialData.location_text?.toLowerCase()
    );
    return match || countries.find(c => c.iso2 === 'BR')!;
  };
  
  const initialCountry = getInitialCountry();

  // Form values state
  const [formData, setFormData] = useState({
    full_name: initialData?.full_name || '',
    email: initialData?.email || '',
    whatsapp: initialData?.whatsapp || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    main_function_id: initialData?.main_function_id || '',
    seniority: initialData?.seniority || 'pleno',
    availability: initialData?.availability || 'sob_consulta',
    portfolio_url: initialData?.portfolio_url || '',
    linkedin_url: initialData?.linkedin_url || '',
    instagram_url: initialData?.instagram_url || '',
    has_worked_with_v3a: initialData?.has_worked_with_v3a || 'Nunca',
    v3a_projects: initialData?.v3a_projects || '',
    current_situation: initialData?.current_situation || '100% Freela',
    brands_worked: initialData?.brands_worked || '',
    observations: initialData?.observations || '',
    portfolio_file_url: initialData?.portfolio_file_url || '',
    portfolio_file_name: initialData?.portfolio_file_name || '',
    portfolio_file_path: initialData?.portfolio_file_path || '',
    industries: (initialData?.industries as string[]) || [],
    location_text: initialData?.location_text || initialCountry.name_pt,
    // New fields
    country_name: initialData?.country_name || initialCountry.name_en,
    country_code: initialData?.country_code || initialCountry.iso2,
    phone_country_code: initialData?.phone_country_code || initialCountry.dial_code,
    whatsapp_raw_digits: initialData?.whatsapp_raw_digits || '',
    whatsapp_dial_code: initialData?.whatsapp_dial_code || initialCountry.dial_code,
    whatsapp_formatted: initialData?.whatsapp_formatted || '',
    whatsapp_country_code: initialData?.whatsapp_country_code || initialCountry.iso2,
    cnpj_normalized: initialData?.cnpj_normalized || '',
    foreign_tax_id: initialData?.foreign_tax_id || '',
    tax_country_code: initialData?.tax_country_code || initialCountry.iso2,
  });

  // Consent checkbox
  const [consentChecked, setConsentChecked] = useState(false);
  const [lgpdChecked, setLgpdChecked] = useState(false);

  // Handle Country Selection Change
  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    const selected = countries.find(c => c.iso2 === code);
    if (selected) {
      setFormData(prev => ({
        ...prev,
        country_code: selected.iso2,
        country_name: selected.name_en,
        phone_country_code: selected.dial_code,
        location_text: selected.name_pt,
        whatsapp: selected.dial_code + ' ', // Pre-fill dial code
        whatsapp_dial_code: selected.dial_code,
        whatsapp_country_code: selected.iso2,
        tax_country_code: selected.iso2,
        // Reset city/state on country change to avoid mismatch
        city: '',
        state: ''
      }));
    }
  };

  // Handle text input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'state' ? value.toUpperCase() : value
    }));
  };

  // Handle industry checkbox selection
  const handleIndustryChange = (industryId: string) => {
    setFormData(prev => {
      const selected = prev.industries.includes(industryId)
        ? prev.industries.filter(id => id !== industryId)
        : [...prev.industries, industryId];
      return { ...prev, industries: selected };
    });
  };

  // Handle Portfolio File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg(null);

    try {
      const uploadData = new FormData();
      uploadData.append('file', file);

      const result = await uploadPublicPortfolioAction(token, uploadData);
      if (!result.success) {
        setErrorMsg(result.error || 'Falha ao fazer upload do portfólio.');
      } else {
        setFormData(prev => ({
          ...prev,
          portfolio_file_url: result.url || '',
          portfolio_file_path: result.path || '',
          portfolio_file_name: result.name || '',
        }));
      }
    } catch (err: any) {
      setErrorMsg('Erro de conexão ao realizar upload.');
    } finally {
      setIsUploading(false);
    }
  };

  // Clear Uploaded File
  const handleRemoveFile = () => {
    setFormData(prev => ({
      ...prev,
      portfolio_file_url: '',
      portfolio_file_path: '',
      portfolio_file_name: '',
    }));
  };

  // Field validation for each step
  const validateStep = (s: number) => {
    setErrorMsg(null);
    if (s === 1) {
      if (!formData.full_name.trim()) return 'Nome completo é obrigatório.';
      if (!formData.email.trim()) return 'E-mail é obrigatório.';
      if (!formData.whatsapp.trim()) return 'WhatsApp é obrigatório.';
      
      const rawDigits = formData.whatsapp.replace(/\D/g, '');
      const dialDigits = formData.phone_country_code.replace(/\D/g, '');
      const localDigits = rawDigits.slice(dialDigits.length);
      
      if (formData.country_code === 'BR') {
        if (localDigits.length < 10) return 'WhatsApp inválido. Certifique-se de preencher o DDD e número completo.';
      } else {
        if (localDigits.length < 6) return 'WhatsApp inválido. Número muito curto.';
      }

      if (!formData.country_code) return 'País de residência é obrigatório.';

      if (formData.country_code === 'BR') {
        const cnpjVal = validateCnpj(formData.cnpj_normalized);
        if (!cnpjVal.valid) {
          return cnpjVal.errorMessage || 'CNPJ inválido.';
        }
      } else {
        if (!formData.foreign_tax_id || !formData.foreign_tax_id.trim()) {
          return 'Identificador Fiscal Estrangeiro é obrigatório para residentes fora do Brasil.';
        }
      }

      if (!formData.city.trim() || !formData.state.trim()) return 'Cidade e Estado/UF são obrigatórios.';
    }
    if (s === 2) {
      if (!formData.main_function_id) return 'Selecione a sua função principal.';
      if (!formData.seniority) return 'Selecione o seu nível de senioridade.';
      if (!formData.availability) return 'Selecione a sua disponibilidade atual.';
    }
    return null;
  };

  // Go to next step
  const handleNext = async () => {
    const validationError = validateStep(step);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    if (step === 1 && formData.country_code === 'BR') {
      setIsSubmitting(true);
      try {
        const excludeId = linkType === 'update_freelancer' ? initialData?.id : undefined;
        const result = await checkPublicDuplicateAction(formData.cnpj_normalized, excludeId);
        if (result && result.hasDuplicate) {
          setErrorMsg('Este CNPJ já está associado a um profissional em nossa base. O RH analisará os registros antes da aprovação.');
          setIsSubmitting(false);
          return;
        }
      } catch (err) {
        console.error('Error checking duplicate CNPJ:', err);
      } finally {
        setIsSubmitting(false);
      }
    }

    setStep(prev => prev + 1);
  };

  // Go to previous step
  const handleBack = () => {
    setErrorMsg(null);
    setStep(prev => prev - 1);
  };

  // Submit the form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!consentChecked) {
      setErrorMsg('Você precisa autorizar o uso das informações para enviar o cadastro.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitPublicFormAction(token, formData);
      if (!result.success) {
        setErrorMsg(result.error || 'Erro ao submeter o formulário.');
      } else {
        setSuccessMsg(result.message || 'Informações enviadas com sucesso!');
      }
    } catch (err: any) {
      setErrorMsg('Erro interno de conexão. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success Screen
  if (successMsg) {
    return (
      <div className="text-center py-12 space-y-6 animate-fade-in">
        <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/5">
          <Check className="w-10 h-10 text-emerald-400" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-extrabold text-white">Sucesso!</h3>
          <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
            {successMsg}
          </p>
        </div>
        <p className="text-xs text-slate-500 pt-6 border-t border-white/5 uppercase tracking-wider">
          Este link foi invalidado por motivos de segurança.
        </p>
      </div>
    );
  }

  // Progress Bar Header
  const stepsCount = 5;
  const progressPercent = (step / stepsCount) * 100;

  return (
    <div className="space-y-6">
      {/* Progress display */}
      <div className="space-y-2 select-none">
        <div className="flex justify-between text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
          <span>Passo {step} de {stepsCount}</span>
          <span className="text-action-cyan">{Math.round(progressPercent)}% Concluído</span>
        </div>
        <div className="w-full h-1.5 bg-[#081528] rounded-full overflow-hidden">
          <div 
            className="h-full bg-action-cyan transition-all duration-300 rounded-full shadow-sm shadow-action-cyan/30"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 text-rose-200 p-3.5 rounded-xl text-xs flex gap-2.5 animate-shake">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 text-xs leading-relaxed">
        {/* STEP 1: DADOS BÁSICOS */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
              <Contact className="w-4 h-4 text-action-cyan" />
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Dados Básicos de Contato</h3>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Nome Completo *</label>
              <input
                type="text"
                name="full_name"
                required
                value={formData.full_name}
                onChange={handleInputChange}
                className="w-full bg-[#0B1E38] border border-white/10 p-3 rounded-xl text-white outline-none focus:border-action-cyan transition-colors"
                placeholder="Insira seu nome completo"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">E-mail *</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full bg-[#0B1E38] border border-white/10 p-3 rounded-xl text-white outline-none focus:border-action-cyan transition-colors"
                  placeholder="exemplo@email.com"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">WhatsApp *</label>
                <PhoneInputWithCountryCode
                  selectedCountry={countries.find(c => c.iso2 === formData.country_code) || countries.find(c => c.iso2 === 'BR')!}
                  value={formData.whatsapp}
                  onChange={(formatted, raw) => {
                    setFormData(prev => ({
                      ...prev,
                      whatsapp: formatted,
                      whatsapp_formatted: formatted,
                      whatsapp_raw_digits: raw
                    }));
                  }}
                />
              </div>
            </div>

            {/* CNPJ / Foreign Tax ID */}
            {formData.country_code === 'BR' ? (
              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">CNPJ *</label>
                <CnpjInput
                  value={formData.cnpj_normalized}
                  onChange={(val) => setFormData(prev => ({ ...prev, cnpj_normalized: val }))}
                  required
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Identificador Fiscal Estrangeiro *</label>
                <input
                  type="text"
                  name="foreign_tax_id"
                  required
                  value={formData.foreign_tax_id}
                  onChange={handleInputChange}
                  className="w-full bg-[#0B1E38] border border-white/10 p-3 rounded-xl text-white outline-none focus:border-action-cyan transition-colors"
                  placeholder="ID fiscal ou equivalente estrangeiro"
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Cidade *</label>
                <CityAutocomplete
                  value={formData.city}
                  onChange={(val) => setFormData(prev => ({ ...prev, city: val }))}
                  stateValue={formData.state}
                  onStateChange={(val) => setFormData(prev => ({ ...prev, state: val }))}
                  countryCode={formData.country_code}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Estado *</label>
                <input
                  type="text"
                  name="state"
                  required
                  maxLength={2}
                  value={formData.state}
                  onChange={handleInputChange}
                  className="w-full bg-[#0B1E38] border border-white/10 p-3 rounded-xl text-white outline-none focus:border-action-cyan uppercase text-center"
                  placeholder="UF"
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">País de Residência *</label>
              <select
                name="country_code"
                required
                value={formData.country_code}
                onChange={handleCountryChange}
                className="w-full bg-[#0B1E38] border border-white/10 p-3 rounded-xl text-slate-200 outline-none focus:border-action-cyan cursor-pointer"
              >
                <option value="">Selecione seu país...</option>
                {countries.map(c => (
                  <option key={c.iso2} value={c.iso2}>{c.name_pt}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* STEP 2: PERFIL PROFISSIONAL */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
              <Briefcase className="w-4 h-4 text-action-cyan" />
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Perfil Profissional</h3>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Função Principal *</label>
              <select
                name="main_function_id"
                required
                value={formData.main_function_id}
                onChange={handleInputChange}
                className="w-full bg-[#0B1E38] border border-white/10 p-3 rounded-xl text-slate-200 outline-none focus:border-action-cyan cursor-pointer"
              >
                <option value="">Selecione sua função...</option>
                {functions.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Senioridade *</label>
                <select
                  name="seniority"
                  required
                  value={formData.seniority}
                  onChange={handleInputChange}
                  className="w-full bg-[#0B1E38] border border-white/10 p-3 rounded-xl text-slate-200 outline-none focus:border-action-cyan cursor-pointer"
                >
                  <option value="junior">Júnior</option>
                  <option value="pleno">Pleno</option>
                  <option value="senior">Sênior</option>
                  <option value="especialista">Especialista</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Disponibilidade *</label>
                <select
                  name="availability"
                  required
                  value={formData.availability}
                  onChange={handleInputChange}
                  className="w-full bg-[#0B1E38] border border-white/10 p-3 rounded-xl text-slate-200 outline-none focus:border-action-cyan cursor-pointer"
                >
                  <option value="disponivel">Imediata</option>
                  <option value="conflito_parcial">15 dias</option>
                  <option value="sob_consulta">30+ dias</option>
                  <option value="indisponivel">Indisponível</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Situação Atual *</label>
                <select
                  name="current_situation"
                  required
                  value={formData.current_situation}
                  onChange={handleInputChange}
                  className="w-full bg-[#0B1E38] border border-white/10 p-3 rounded-xl text-slate-200 outline-none focus:border-action-cyan cursor-pointer"
                >
                  <option value="100% Freela">100% Freelancer</option>
                  <option value="CLT com disponibilidade">CLT com disponibilidade</option>
                  <option value="Contratado atualmente">Contratado atualmente</option>
                  <option value="Sem disponibilidade">Sem disponibilidade</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">Segmentos / Indústrias de Experiência</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#0B1E38] p-4 rounded-2xl border border-white/5 max-h-48 overflow-y-auto">
                {industries.map(ind => {
                  const isChecked = formData.industries.includes(ind.id);
                  return (
                    <label 
                      key={ind.id} 
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition select-none
                        ${isChecked ? 'bg-action-cyan/10 text-action-cyan font-bold' : 'text-slate-300 hover:bg-white/5'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleIndustryChange(ind.id)}
                        className="rounded border-white/10 text-action-cyan focus:ring-action-cyan bg-[#0B1E38]"
                      />
                      <span className="truncate">{ind.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: EXPERIÊNCIA V3A */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
              <Layers className="w-4 h-4 text-action-cyan" />
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Experiência com Eventos & V3A</h3>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Já trabalhou com a agência V3A?</label>
              <select
                name="has_worked_with_v3a"
                value={formData.has_worked_with_v3a}
                onChange={handleInputChange}
                className="w-full bg-[#0B1E38] border border-white/10 p-3 rounded-xl text-slate-200 outline-none focus:border-action-cyan cursor-pointer"
              >
                <option value="Nunca">Nunca trabalhei</option>
                <option value="Uma vez">Já trabalhei uma vez</option>
                <option value="Mais de uma vez">Já trabalhei mais de uma vez</option>
                <option value="Atualmente contratado">Estou alocado em projeto ativo</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">Se sim, quais projetos da V3A realizou?</label>
              <textarea
                name="v3a_projects"
                rows={3}
                value={formData.v3a_projects}
                onChange={handleInputChange}
                className="w-full bg-[#0B1E38] border border-white/10 p-3 rounded-xl text-white outline-none focus:border-action-cyan resize-none"
                placeholder="Ex: Coca-Cola Rock in Rio, Lançamento AutoCorp, etc."
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">Principais marcas atendidas na carreira</label>
              <textarea
                name="brands_worked"
                rows={2}
                value={formData.brands_worked}
                onChange={handleInputChange}
                className="w-full bg-[#0B1E38] border border-white/10 p-3 rounded-xl text-white outline-none focus:border-action-cyan resize-none"
                placeholder="Ex: Samsung, Red Bull, Ambev, etc."
              />
            </div>
          </div>
        )}

        {/* STEP 4: PORTFÓLIO E REDES */}
        {step === 4 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
              <LinkIcon className="w-4 h-4 text-action-cyan" />
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Portfólio & Redes Sociais</h3>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Website ou Portfólio Online (URL)</label>
              <div className="relative">
                <LinkIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="url"
                  name="portfolio_url"
                  value={formData.portfolio_url}
                  onChange={handleInputChange}
                  className="w-full bg-[#0B1E38] border border-white/10 p-3 pl-10 rounded-xl text-white outline-none focus:border-action-cyan"
                  placeholder="https://behance.net/seu-perfil"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">LinkedIn URL</label>
                <div className="relative">
                  <Linkedin className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="url"
                    name="linkedin_url"
                    value={formData.linkedin_url}
                    onChange={handleInputChange}
                    className="w-full bg-[#0B1E38] border border-white/10 p-3 pl-10 rounded-xl text-white outline-none focus:border-action-cyan"
                    placeholder="https://linkedin.com/in/seu-perfil"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Instagram URL</label>
                <div className="relative">
                  <Instagram className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="url"
                    name="instagram_url"
                    value={formData.instagram_url}
                    onChange={handleInputChange}
                    className="w-full bg-[#0B1E38] border border-white/10 p-3 pl-10 rounded-xl text-white outline-none focus:border-action-cyan"
                    placeholder="https://instagram.com/seu-perfil"
                  />
                </div>
              </div>
            </div>

            {/* Upload de arquivo portfólio */}
            <div className="space-y-2 pt-2">
              <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">Upload de Portfólio (PDF ou ZIP - Máx 20MB)</label>
              
              {!formData.portfolio_file_url ? (
                <label className={`border border-dashed border-white/10 hover:border-action-cyan/40 bg-[#0B1E38] rounded-2xl p-6 text-center cursor-pointer block transition duration-200 select-none
                  ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input
                    type="file"
                    accept=".pdf,.zip,.rar"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-action-cyan animate-spin" />
                      <span className="text-[11px] text-slate-300">Enviando arquivo seguro para a nuvem...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-7 h-7 text-action-cyan" />
                      <span className="text-[11px] text-slate-200 font-bold">Escolha um arquivo</span>
                      <span className="text-[10px] text-slate-400">Arraste ou clique para selecionar</span>
                    </div>
                  )}
                </label>
              ) : (
                <div className="flex items-center justify-between bg-[#0B1E38] border border-white/10 p-4 rounded-2xl select-none animate-fade-in">
                  <div className="flex items-center gap-3 truncate">
                    <div className="w-9 h-9 rounded-xl bg-action-cyan/10 border border-action-cyan/20 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-action-cyan" />
                    </div>
                    <div className="truncate">
                      <p className="font-bold text-slate-200 truncate">{formData.portfolio_file_name}</p>
                      <span className="text-[9px] text-[#A2E9F2]">Upload seguro realizado</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-rose-300 hover:text-white rounded-xl transition cursor-pointer"
                    title="Excluir arquivo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 5: OBSERVAÇÕES E CONFIRMAÇÃO */}
        {step === 5 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
              <CheckSquare className="w-4 h-4 text-action-cyan" />
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Observações e Confirmação</h3>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">Observações adicionais ou comentários</label>
              <textarea
                name="observations"
                rows={4}
                value={formData.observations}
                onChange={handleInputChange}
                className="w-full bg-[#0B1E38] border border-white/10 p-3 rounded-xl text-white outline-none focus:border-action-cyan"
                placeholder="Informações adicionais que julgar pertinentes..."
              />
            </div>

            {/* Checklist items summary for review */}
            <div className="bg-[#0B1E38]/50 border border-white/5 p-4 rounded-2xl space-y-2 select-none">
              <h4 className="text-[10px] text-slate-300 font-extrabold uppercase tracking-wider">Resumo do Perfil</h4>
              <ul className="space-y-1.5 text-[11px] text-slate-300">
                <li>&bull; <strong>Nome:</strong> {formData.full_name}</li>
                <li>&bull; <strong>E-mail:</strong> {formData.email}</li>
                <li>&bull; <strong>Contato:</strong> {formData.whatsapp}</li>
                <li>&bull; <strong>Localização:</strong> {formData.city}/{formData.state}</li>
                <li>
                  &bull; <strong>Função:</strong> {functions.find(f => f.id === formData.main_function_id)?.name || 'Não selecionada'}
                  <span className="bg-action-cyan/15 text-action-cyan text-[9px] font-bold px-1.5 py-0.5 rounded-md ml-2 uppercase">
                    {formData.seniority}
                  </span>
                </li>
              </ul>
            </div>

            {/* Consent checks */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 bg-action-cyan/5 border border-action-cyan/20 p-4 rounded-2xl cursor-pointer select-none">
                <input
                  type="checkbox"
                  required
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 rounded border-white/10 text-action-cyan focus:ring-action-cyan bg-[#0B1E38]"
                />
                <span className="text-[10px] sm:text-[11px] text-slate-350 leading-relaxed font-semibold">
                  Confirmo que as informações fornecidas são verdadeiras e autorizo a V3A a analisá-las para fins de cadastro em sua base de freelancers.
                </span>
              </label>

              <label className="flex items-start gap-3 bg-action-cyan/5 border border-action-cyan/20 p-4 rounded-2xl cursor-pointer select-none">
                <input
                  type="checkbox"
                  required
                  checked={lgpdChecked}
                  onChange={(e) => setLgpdChecked(e.target.checked)}
                  className="mt-0.5 rounded border-white/10 text-action-cyan focus:ring-action-cyan bg-[#0B1E38]"
                />
                <span className="text-[10px] sm:text-[11px] text-slate-350 leading-relaxed font-semibold">
                  Li e concordo com a{' '}
                  <a
                    href="/politica-privacidade.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-action-cyan underline hover:text-action-cyan/80 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Política Corporativa de Privacidade e Proteção de Dados Pessoais (LGPD)
                  </a>
                  {' '}da V3A.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Step Buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-white/5">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={isSubmitting}
              className="px-5 py-3 border border-white/10 hover:bg-white/5 text-slate-300 font-bold rounded-xl cursor-pointer transition select-none disabled:opacity-50"
            >
              Voltar
            </button>
          ) : (
            <div></div>
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="bg-action-cyan hover:bg-action-cyan/90 text-[#0A192F] px-6 py-3 font-extrabold rounded-xl cursor-pointer transition select-none shadow-sm"
            >
              Continuar
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting || !consentChecked || !lgpdChecked}
              className="bg-action-cyan hover:bg-action-cyan/90 text-[#0A192F] px-8 py-3 font-extrabold rounded-xl cursor-pointer transition select-none shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {linkType === 'new_freelancer' ? 'Enviar informações para análise' : 'Enviar atualização para análise'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
