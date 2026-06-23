'use client';

import React, { useState, useCallback } from 'react';
import { DatabaseProps } from '@/app/page';
import {
  getRoleLabel, mapSeniorityToDB, mapFreelancerStatusToDB,
  mapAvailabilityToDB, mapFreelancerToUI, mapJobToUI, mapUrgencyToDB
} from '@/lib/dbMapper';
import { calculateInclusiveDays, calculatePolicyLimitForJob, formatCurrencyBR, parseCurrencyBR, maskCurrencyBRL } from '@/lib/financial';
import {
  Sparkles, Save, Briefcase, Plus, Scale, Building,
  RefreshCw, Check, X, ChevronDown, ChevronUp, HelpCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { countries } from '@/lib/countries';
import CnpjInput from './CnpjInput';
import { validateCnpj, normalizeCnpj } from '@/lib/cnpj';


// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaymentDateEntry {
  /** ISO string "YYYY-MM-DD" */
  date: string;
  selected: boolean;
  manuallyExcluded: boolean;
}

// ─── Utility: format ISO date to DD/MM/AAAA ──────────────────────────────────
function isoToBR(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// ─── Utility: compute payment schedule as PaymentDateEntry[] ─────────────────
/**
 * Generates all monthly payment dates in [startDate, endDate]
 * on `paymentDay`, clamping to the last day of the month if needed.
 * All dates start selected=true.
 *
 * Preserves manuallyExcluded state if the date already exists in `previous`.
 */
function buildPaymentDates(
  startDate: string,
  endDate: string,
  paymentDay: number,
  previous: PaymentDateEntry[] = []
): PaymentDateEntry[] {
  const startParts = startDate.split('-');
  const endParts = endDate.split('-');
  if (startParts.length !== 3 || endParts.length !== 3) return [];

  const sYear = parseInt(startParts[0], 10);
  const sMonth = parseInt(startParts[1], 10) - 1;
  const sDay = parseInt(startParts[2], 10);
  const eYear = parseInt(endParts[0], 10);
  const eMonth = parseInt(endParts[1], 10) - 1;
  const eDay = parseInt(endParts[2], 10);

  const start = new Date(sYear, sMonth, sDay);
  const end = new Date(eYear, eMonth, eDay);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];

  const day = Math.max(1, Math.min(31, Math.round(paymentDay)));
  const previousMap = new Map<string, PaymentDateEntry>(previous.map(e => [e.date, e]));
  const result: PaymentDateEntry[] = [];

  let curYear = sYear;
  let curMonth = sMonth;

  while (true) {
    const lastDayOfMonth = new Date(curYear, curMonth + 1, 0).getDate();
    const actualDay = Math.min(day, lastDayOfMonth);
    const candidate = new Date(curYear, curMonth, actualDay);
    if (candidate > end) break;

    if (candidate >= start && candidate <= end) {
      // ISO "YYYY-MM-DD"
      const mm = String(curMonth + 1).padStart(2, '0');
      const dd = String(actualDay).padStart(2, '0');
      const isoDate = `${curYear}-${mm}-${dd}`;

      const prev = previousMap.get(isoDate);
      result.push({
        date: isoDate,
        selected: prev ? prev.selected : true,
        manuallyExcluded: prev ? prev.manuallyExcluded : false,
      });
    }

    curMonth += 1;
    if (curMonth > 11) { curMonth = 0; curYear += 1; }
    if (result.length > 120) break;
  }

  return result;
}

/** Derive summary numbers from current paymentDates list */
function derivePaymentSummary(
  paymentDates: PaymentDateEntry[],
  budget: number,
  manualMonthlyRate: number | null
): {
  selectedCount: number;
  totalCount: number;
  suggestedMonthlyAmount: number;
  effectiveMonthlyAmount: number;
  totalExpectedCompensation: number;
} {
  const selectedCount = paymentDates.filter(d => d.selected).length;
  const totalCount = paymentDates.length;
  const suggestedMonthlyAmount =
    selectedCount > 0 && budget > 0
      ? Math.round((budget / selectedCount) * 100) / 100
      : 0;
  const effectiveMonthlyAmount = manualMonthlyRate ?? suggestedMonthlyAmount;
  const totalExpectedCompensation = effectiveMonthlyAmount * selectedCount;
  return { selectedCount, totalCount, suggestedMonthlyAmount, effectiveMonthlyAmount, totalExpectedCompensation };
}

// ─── Form 1: Cadastrar Freelancer (Master & RH) ───────────────────────────────
export function FormFreela({ db, onCancel }: { db: DatabaseProps; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [mainRole, setMainRole] = useState('Diretor de Arte');
  const [seniority, setSeniority] = useState<'Júnior' | 'Pleno' | 'Sênior' | 'Especialista'>('Pleno');
  const [industries, setIndustries] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [referenceValue, setReferenceValue] = useState(500);
  const [referenceValueVisual, setReferenceValueVisual] = useState(() => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(500));
  const [observations, setObservations] = useState('');
  const [countryCode, setCountryCode] = useState('BR');
  const [cnpjNormalized, setCnpjNormalized] = useState('');
  const [foreignTaxId, setForeignTaxId] = useState('');


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !whatsapp || !city || !state) {
      alert('Por favor preencha os campos obrigatórios (Nome, E-mail, Celular, Cidade e Estado).');
      return;
    }

    if (countryCode === 'BR') {
      const cnpjVal = validateCnpj(cnpjNormalized);
      if (!cnpjVal.valid) {
        alert(cnpjVal.errorMessage || 'CNPJ inválido.');
        return;
      }
    } else {
      if (!foreignTaxId.trim()) {
        alert('Identificador Fiscal Estrangeiro é obrigatório para residentes fora do Brasil.');
        return;
      }
    }

    try {
      // Check CNPJ duplicate manually
      if (countryCode === 'BR') {
        const { data: dupCnpj } = await supabase
          .from('freelancers')
          .select('id, full_name, email, whatsapp, status, created_at, main_function:freela_functions(name)')
          .eq('cnpj_normalized', cnpjNormalized)
          .is('merged_into_freelancer_id', null)
          .maybeSingle();

        if (dupCnpj) {
          const roleName = (dupCnpj.main_function as any)?.name || 'N/A';
          const confirmCreate = window.confirm(
            `Possível duplicidade por CNPJ!\n\n` +
            `Já existe um freelancer com este CNPJ:\n` +
            `- Nome: ${dupCnpj.full_name}\n` +
            `- E-mail: ${dupCnpj.email}\n` +
            `- Celular: ${dupCnpj.whatsapp}\n` +
            `- Função: ${roleName}\n` +
            `- Status: ${dupCnpj.status}\n` +
            `- Data de cadastro: ${new Date(dupCnpj.created_at).toLocaleDateString('pt-BR')}\n\n` +
            `Deseja cadastrar o mesmo CNPJ mesmo assim? Esta ação exige justificativa administrativa.`
          );

          if (!confirmCreate) {
            return;
          }

          const justification = window.prompt('Informe a justificativa administrativa para criação forçada com CNPJ duplicado:');
          if (!justification || !justification.trim()) {
            alert('Justificativa obrigatória. Cadastro cancelado.');
            return;
          }

          // Insert audit log
          await supabase.from('audit_logs').insert({
            action: 'manual_rh_duplicate_override',
            entity: 'freelancers',
            new_data: { cnpj: cnpjNormalized, name, justification }
          });
        }
      }

      const { data: funcData } = await supabase.from('freela_functions').select('id').eq('name', mainRole).maybeSingle();
      let funcId = funcData?.id;
      if (!funcId) {
        const { data: newFunc } = await supabase.from('freela_functions').insert({ name: mainRole }).select('id').single();
        funcId = newFunc?.id;
      }
      const { data: created, error } = await supabase
        .from('freelancers')
        .insert({
          full_name: name,
          email: email.trim().toLowerCase(),
          whatsapp: whatsapp.trim(),
          city,
          state,
          main_function_id: funcId,
          seniority: mapSeniorityToDB(seniority),
          portfolio_url: portfolioUrl,
          status: mapFreelancerStatusToDB('Elegível'),
          availability: mapAvailabilityToDB('Imediata'),
          reference_daily_rate: parseCurrencyBR(referenceValueVisual),
          observations: observations || 'Onboarding inicial efetuado no banco.',
          cnpj_normalized: countryCode === 'BR' ? cnpjNormalized : null,
          foreign_tax_id: countryCode !== 'BR' ? foreignTaxId : null,
          tax_country_code: countryCode,
          cnpj_source: 'manual_rh',
          cnpj_is_mock: false,
        })
        .select('*, main_function:freela_functions(name), freelancer_industries(industry:industries(name))')
        .single();
      if (error || !created) throw error || new Error('Erro ao criar freelancer.');
      const industryList = industries ? industries.split(',').map(s => s.trim()) : ['Bebidas'];
      for (const indName of industryList) {
        const { data: indData } = await supabase.from('industries').select('id').eq('name', indName).maybeSingle();
        let indId = indData?.id;
        if (!indId) {
          const { data: newInd } = await supabase.from('industries').insert({ name: indName }).select('id').single();
          indId = newInd?.id;
        }
        if (indId) await supabase.from('freelancer_industries').insert({ freelancer_id: created.id, industry_id: indId });
      }
      const { data: finalCreated } = await supabase
        .from('freelancers')
        .select('*, main_function:freela_functions(name), freelancer_industries(industry:industries(name))')
        .eq('id', created.id)
        .single();
      if (finalCreated) {
        const mappedFreela = mapFreelancerToUI(finalCreated);
        if (db.setFreelancersState) db.setFreelancersState(prev => [mappedFreela, ...prev]);
        else db.setFreelancers(prev => [mappedFreela, ...prev]);
        alert(`Success: Freelancer "${name}" cadastrado com sucesso!`);
        db.setActiveTab('Banco de Freelancers');
      }
    } catch (err: any) {
      console.error('Error inserting manual freelancer:', err);
      alert(`Erro ao cadastrar freelancer: ${err.message || err}`);
    }
  };

  return (
    <div className="bg-white border border-border-subtle p-6 rounded-2xl shadow-xs max-w-2xl mx-auto space-y-6">
      <div>
        <h3 className="font-bold text-text-primary text-base">Cadastrar Novo Freelancer</h3>
        <p className="text-xs text-text-secondary mt-0.5">Cadastre um profissional diretamente no banco central como elegível.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-text-secondary block mb-1">Nome Completo *</label>
            <input type="text" placeholder="Ex: Pedro Alvares" value={name} onChange={e => setName(e.target.value)} className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan" required />
          </div>
          <div>
            <label className="font-bold text-text-secondary block mb-1">E-mail *</label>
            <input type="email" placeholder="Ex: pedro@outlook.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan" required />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-text-secondary block mb-1">País de Residência *</label>
            <select value={countryCode} onChange={e => {
              setCountryCode(e.target.value);
              if (e.target.value !== 'BR') {
                setCnpjNormalized('');
              } else {
                setForeignTaxId('');
              }
            }} className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white">
              {countries.map(c => (
                <option key={c.iso2} value={c.iso2}>{c.name_pt}</option>
              ))}
            </select>
          </div>
          <div>
            {countryCode === 'BR' ? (
              <div className="flex flex-col">
                <label className="font-bold text-text-secondary block mb-1">CNPJ *</label>
                <CnpjInput
                  value={cnpjNormalized}
                  onChange={setCnpjNormalized}
                  required
                  showValidationStatus={true}
                />
              </div>
            ) : (
              <div>
                <label className="font-bold text-text-secondary block mb-1">Identificador Fiscal Estrangeiro *</label>
                <input type="text" placeholder="ID Fiscal ou equivalente" value={foreignTaxId} onChange={e => setForeignTaxId(e.target.value)} className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan" required />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="font-bold text-text-secondary block mb-1">Celular / WhatsApp *</label>
            <input type="text" placeholder="Ex: (11) 99123-1122" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan" required />
          </div>
          <div>
            <label className="font-bold text-text-secondary block mb-1">Cidade *</label>
            <input type="text" placeholder="Ex: São Paulo" value={city} onChange={e => setCity(e.target.value)} className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan" required />
          </div>
          <div>
            <label className="font-bold text-text-secondary block mb-1">Estado (UF) *</label>
            <input type="text" placeholder="Ex: SP" value={state} maxLength={2} onChange={e => setState(e.target.value)} className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan uppercase" required />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="font-bold text-text-secondary block mb-1">Função Primária</label>
            <select value={mainRole} onChange={e => setMainRole(e.target.value)} className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white">
              <option value="Diretor de Arte">Diretor de Arte</option>
              <option value="Designer 3D">Designer 3D</option>
              <option value="Planejamento">Planejamento</option>
              <option value="Produtor Executivo">Produtor Executivo</option>
              <option value="Produtor de Campo">Produtor de Campo</option>
              <option value="Atendimento">Atendimento</option>
              <option value="Redator">Redator</option>
              <option value="Motion Designer">Motion Designer</option>
              <option value="Cenógrafo">Cenógrafo</option>
              <option value="Conteúdo">Conteúdo</option>
            </select>
          </div>
          <div>
            <label className="font-bold text-text-secondary block mb-1">Senioridade</label>
            <select value={seniority} onChange={e => setSeniority(e.target.value as any)} className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white">
              <option value="Júnior">Júnior</option>
              <option value="Pleno">Pleno</option>
              <option value="Sênior">Sênior</option>
              <option value="Especialista">Especialista</option>
            </select>
          </div>
          <div>
            <label className="font-bold text-text-secondary block mb-1">Valor Referência de Diária (R$)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-text-secondary select-none">R$</span>
              <input
                type="text"
                inputMode="decimal"
                value={referenceValueVisual}
                onChange={e => {
                  const rawVal = e.target.value;
                  const masked = maskCurrencyBRL(rawVal);
                  setReferenceValueVisual(masked);
                  setReferenceValue(parseCurrencyBR(masked));
                }}
                onBlur={() => {
                  const numeric = parseCurrencyBR(referenceValueVisual);
                  if (numeric > 0) {
                    setReferenceValueVisual(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric));
                  }
                }}
                className="w-full border border-border-subtle p-2 pl-8 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-text-secondary block mb-1">URL Portfólio</label>
            <input type="text" placeholder="Ex: behance.net/nome" value={portfolioUrl} onChange={e => setPortfolioUrl(e.target.value)} className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan" />
          </div>
          <div>
            <label className="font-bold text-text-secondary block mb-1">Niches industriais (Separado por vírgula)</label>
            <input type="text" placeholder="Ex: Bebidas, Automotivo, Beleza" value={industries} onChange={e => setIndustries(e.target.value)} className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan" />
          </div>
        </div>
        <div>
          <label className="font-bold text-text-secondary block mb-1">Observações de onboarding</label>
          <textarea placeholder="Anotações internas..." value={observations} onChange={e => setObservations(e.target.value)} rows={3} className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan" />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button type="button" onClick={onCancel} className="border border-border-subtle p-2 px-4 rounded-xl hover:bg-surface font-semibold text-text-primary">Cancelar</button>
          <button type="submit" className="bg-action-cyan hover:bg-action-cyan/90 text-white font-bold p-2 px-5 rounded-xl flex items-center gap-1 shadow-sm">
            <Save className="w-4 h-4" /> Cadastrar Profissional
          </button>
        </div>
      </form>
    </div>
  );
}



// ─── Form 3: Criar Oportunidade (Job) ────────────────────────────────────────
export function FormOportunidade({ db, onCancel }: { db: DatabaseProps; onCancel: () => void }) {
  const userRole = getRoleLabel(db.currentUser.profile);
  const canSelectNucleo = userRole === 'MASTER' || userRole === 'RH' || userRole === 'C-LEVEL';

  // ── Section 1: Job basics ─────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [roleNeeded, setRoleNeeded] = useState('Diretor de Arte');
  const [seniorityNeeded, setSeniorityNeeded] = useState<'Júnior' | 'Pleno' | 'Sênior' | 'Especialista'>('Sênior');
  const [description, setDescription] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [startDate, setStartDate] = useState('2026-07-01');
  const [endDate, setEndDate] = useState('2026-10-31');
  const [budget, setBudget] = useState(10000);
  const [urgency, setUrgency] = useState<'Alta' | 'Média' | 'Baixa'>('Média');
  const [selectedNucleoId, setSelectedNucleoId] = useState(
    canSelectNucleo ? '' : (db.currentUser.nucleoId || '')
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Section 2: Payment flow ───────────────────────────────────────────────
  const [paymentFlow, setPaymentFlow] = useState<'one_time' | 'recurring'>('one_time');
  const [remunerationModel, setRemunerationModel] = useState<'daily' | 'hourly' | 'fixed_job' | 'monthly_salary'>('daily');

  // One-time payment fields
  const [expectedHours, setExpectedHours] = useState<number>(0);
  const [oneTimeRate, setOneTimeRate] = useState<number>(0);

  // Recurring payment fields
  const [expectedPaymentDay, setExpectedPaymentDay] = useState<number>(5);
  // The rich date list — source of truth for recurring
  const [paymentDates, setPaymentDates] = useState<PaymentDateEntry[]>([]);
  const [datesUpdatedMsg, setDatesUpdatedMsg] = useState<string | null>(null);
  // Manual monthly amount override: null = auto (budget/selectedCount)
  const [manualMonthlyRate, setManualMonthlyRate] = useState<number | null>(null);

  // Visual currency formatting states
  const [budgetVisual, setBudgetVisual] = useState(() => budget > 0 ? maskCurrencyBRL(budget.toString()) : '');
  const [oneTimeRateVisual, setOneTimeRateVisual] = useState(() => oneTimeRate > 0 ? maskCurrencyBRL(oneTimeRate.toString()) : '');
  const [manualMonthlyRateVisual, setManualMonthlyRateVisual] = useState(() => manualMonthlyRate !== null ? maskCurrencyBRL(manualMonthlyRate.toString()) : '');
  const [isMemoryOpenManual, setIsMemoryOpenManual] = useState<boolean | null>(null);

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const masked = maskCurrencyBRL(rawVal);
    setBudgetVisual(masked);
    const numeric = parseCurrencyBR(masked);
    setBudget(numeric);
    setManualMonthlyRate(null);
    setManualMonthlyRateVisual('');
  };

  const handleBudgetBlur = () => {
    if (budget > 0) {
      setBudgetVisual(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(budget));
    } else {
      setBudgetVisual('');
    }
  };

  const handleOneTimeRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const masked = maskCurrencyBRL(rawVal);
    setOneTimeRateVisual(masked);
    const numeric = parseCurrencyBR(masked);
    setOneTimeRate(numeric);
  };

  const handleOneTimeRateBlur = () => {
    if (oneTimeRate > 0) {
      setOneTimeRateVisual(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(oneTimeRate));
    } else {
      setOneTimeRateVisual('');
    }
  };

  const handleManualMonthlyRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const masked = maskCurrencyBRL(rawVal);
    setManualMonthlyRateVisual(masked);
    const numeric = parseCurrencyBR(masked);
    setManualMonthlyRate(numeric || null);
  };

  const handleManualMonthlyRateBlur = () => {
    if (manualMonthlyRate !== null && manualMonthlyRate > 0) {
      setManualMonthlyRateVisual(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(manualMonthlyRate));
    } else {
      setManualMonthlyRateVisual('');
    }
  };

  const activeNucleos = db.nucleos.filter((n: any) => n.status === 'Ativo');

  // ── Derived summary from paymentDates ────────────────────────────────────
  const summary = React.useMemo(
    () => derivePaymentSummary(paymentDates, budget, manualMonthlyRate),
    [paymentDates, budget, manualMonthlyRate]
  );

  // ── Rebuild dates when schedule parameters change (recurring only) ────────
  const rebuildDates = useCallback((
    sd: string,
    ed: string,
    pDay: number,
    prev: PaymentDateEntry[]
  ) => {
    const newDates = buildPaymentDates(sd, ed, pDay, prev);
    setPaymentDates(newDates);
    setManualMonthlyRate(null); // reset manual override

    // Show update notification if dates actually changed
    const prevKeys = new Set(prev.map(p => p.date));
    const newKeys = new Set(newDates.map(n => n.date));
    const changed = newDates.some(d => !prevKeys.has(d.date)) || prev.some(p => !newKeys.has(p.date));
    if (changed && prev.length > 0) {
      setDatesUpdatedMsg('As datas foram atualizadas conforme o novo período informado.');
      setTimeout(() => setDatesUpdatedMsg(null), 5000);
    }
  }, []);

  // ── Initialize / rebuild dates when entering recurring mode or changing params
  React.useEffect(() => {
    if (paymentFlow !== 'recurring') return;
    if (!startDate || !endDate) return;
    rebuildDates(startDate, endDate, expectedPaymentDay, paymentDates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentFlow, startDate, endDate, expectedPaymentDay]);

  // ── Toggle a single payment date ─────────────────────────────────────────
  const togglePaymentDate = useCallback((isoDate: string) => {
    setPaymentDates(prev => {
      const selectedCount = prev.filter(d => d.selected).length;
      const target = prev.find(d => d.date === isoDate);
      if (!target) return prev;

      // Block: cannot deselect the last selected date
      if (target.selected && selectedCount <= 1) {
        alert('É necessário manter pelo menos uma data de pagamento ativa.');
        return prev;
      }

      return prev.map(d =>
        d.date === isoDate
          ? { ...d, selected: !d.selected, manuallyExcluded: d.selected }
          : d
      );
    });
    // When a date is toggled manually, clear the manual monthly rate
    // so the suggestion recalculates automatically
    setManualMonthlyRate(null);
  }, []);

  // ── Switch payment flow ───────────────────────────────────────────────────
  const handlePaymentFlowChange = (val: 'one_time' | 'recurring') => {
    setPaymentFlow(val);
    setManualMonthlyRate(null);
    setManualMonthlyRateVisual('');
    setOneTimeRate(0);
    setOneTimeRateVisual('');
    if (val === 'recurring') {
      setRemunerationModel('monthly_salary');
      // Immediately build dates
      const newDates = buildPaymentDates(startDate, endDate, expectedPaymentDay, []);
      setPaymentDates(newDates);
    } else {
      setRemunerationModel('daily');
      setPaymentDates([]);
    }
  };

  // ── Recalculate button (resets manual rate) ───────────────────────────────
  const handleRecalculate = () => {
    setManualMonthlyRate(null);
    setManualMonthlyRateVisual('');
    // Restore all dates to selected
    setPaymentDates(prev => prev.map(d => ({ ...d, selected: true, manuallyExcluded: false })));
  };

  // ── Financial totals for one_time ────────────────────────────────────────
  const days = calculateInclusiveDays(startDate, endDate);
  let oneTimeTotal = 0;
  if (remunerationModel === 'daily') {
    oneTimeTotal = oneTimeRate * Math.max(0, days);
  } else if (remunerationModel === 'hourly') {
    oneTimeTotal = oneTimeRate * (expectedHours || 0);
  } else if (remunerationModel === 'fixed_job') {
    oneTimeTotal = oneTimeRate;
  }

  // Unified expected total compensation
  const expectedTotalCompensation =
    paymentFlow === 'recurring' ? summary.totalExpectedCompensation : oneTimeTotal;
  const expectedRate = paymentFlow === 'recurring' ? summary.effectiveMonthlyAmount : oneTimeRate;
  const expectedPaymentCount = paymentFlow === 'recurring' ? summary.selectedCount : 1;

  // ── Policy match using calculatePolicyLimitForJob ──────────────────────────
  const billingTypeForMatch =
    remunerationModel === 'daily' ? 'Diária' :
    remunerationModel === 'hourly' ? 'Hora' :
    remunerationModel === 'fixed_job' ? 'Job Fechado' : 'Mensal / Salário';

  const matchedPolicy = db.policies.find((p: any) =>
    p.role === roleNeeded &&
    p.seniority === seniorityNeeded &&
    p.billingType === billingTypeForMatch
  );

  // Full policy calculation with discount for fixed jobs
  const policyResult = React.useMemo(() => {
    if (!roleNeeded || !seniorityNeeded || !remunerationModel || !startDate || !endDate) return null;
    const proposedAmt = paymentFlow === 'recurring' ? summary.effectiveMonthlyAmount : oneTimeRate;
    if (!proposedAmt || proposedAmt <= 0) return null;
    return calculatePolicyLimitForJob({
      role: roleNeeded,
      seniority: seniorityNeeded,
      remunerationModel,
      startDate,
      endDate,
      proposedAmount: proposedAmt,
      policies: db.policies,
      installmentsCount: paymentFlow === 'recurring' ? summary.selectedCount : undefined
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleNeeded, seniorityNeeded, remunerationModel, startDate, endDate, oneTimeRate, summary.effectiveMonthlyAmount, summary.selectedCount, db.policies, paymentFlow]);

  const policyStatus: 'within_policy' | 'above_policy_requires_approval' | 'no_policy_found' =
    !policyResult || policyResult.policyStatus === 'policy_missing' ? 'no_policy_found' :
    policyResult.policyStatus === 'above_policy' ? 'above_policy_requires_approval' : 'within_policy';

  const formatBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  // ── Check if any dates were manually excluded ─────────────────────────────
  const hasManuallyExcluded = paymentDates.some(d => d.manuallyExcluded);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (policyStatus === 'no_policy_found') {
      const confirmCreate = confirm('Não existe política cadastrada para esta combinação. A contratação exigirá validação. Deseja prosseguir com a criação da oportunidade?');
      if (!confirmCreate) return;
    }

    if (!name || !client || !description) {
      alert('Preencha os campos obrigatórios: Título do Job, Cliente e Descrição Técnica.');
      return;
    }
    if (canSelectNucleo && !selectedNucleoId) {
      alert('Selecione o Núcleo Responsável para este job.');
      return;
    }
    const nucleoId = canSelectNucleo ? selectedNucleoId : (db.currentUser.nucleoId || '');
    if (!nucleoId) { alert('Núcleo não identificado. Verifique seu perfil.'); return; }
    if ((userRole === 'NÚCLEO' || userRole === 'NUCLEO') && nucleoId !== db.currentUser.nucleoId) {
      alert('Usuário de núcleo só pode criar oportunidades para o próprio núcleo.');
      return;
    }
    if (!startDate || !endDate) { alert('Informe a data de início e término.'); return; }
    if (days < 1) { alert('A data de fim deve ser igual ou posterior à data de início.'); return; }
    if (!budget || budget <= 0) { alert('Informe o budget com um valor maior que zero.'); return; }

    if (paymentFlow === 'recurring') {
      if (summary.selectedCount <= 0) {
        alert('É necessário manter pelo menos uma data de pagamento ativa.');
        return;
      }
      if (summary.effectiveMonthlyAmount <= 0) {
        alert('Informe um valor previsto mensal maior que zero.');
        return;
      }
    } else {
      if (oneTimeRate <= 0) { alert('Informe um valor previsto de remuneração maior que zero.'); return; }
      if (remunerationModel === 'hourly' && expectedHours <= 0) {
        alert('Informe a quantidade de horas previstas maior que zero.');
        return;
      }
    }

    const savingAmount = budget - expectedTotalCompensation;
    const savingPercentage = budget > 0 ? (savingAmount / budget) * 100 : 0;

    // Prepare date arrays for DB
    const allGeneratedISO = paymentDates.map(d => d.date);
    const selectedISO = paymentDates.filter(d => d.selected).map(d => d.date);
    const excludedISO = paymentDates.filter(d => d.manuallyExcluded).map(d => d.date);

    let jobPayload: any = null;
    let requestPayload: any = null;

    setIsSubmitting(true);
    try {
      const { data: funcData } = await supabase
        .from('freela_functions').select('id').eq('name', roleNeeded).maybeSingle();
      let funcId = funcData?.id;
      if (!funcId) {
        const { data: newFunc } = await supabase
          .from('freela_functions').insert({ name: roleNeeded }).select('id').single();
        funcId = newFunc?.id;
      }

      const urgencyDb = mapUrgencyToDB(urgency);
      const statusDb = 'oportunidade_criada';

      const isAbove = policyResult?.policyStatus === 'above_policy';
      const isMissing = !policyResult || policyResult.policyStatus === 'policy_missing';
      const isWithin = policyResult?.policyStatus === 'inside_policy';

      const dbPolicyStatus = isWithin ? 'within_policy' : isAbove ? 'above_policy' : isMissing ? 'missing_policy' : 'not_evaluated';
      const dbPolicyExceeded = isAbove;
      const dbRequiresHeadApproval = isAbove || isMissing;
      const dbApprovalStatus = (isAbove || isMissing) ? 'pending_head_approval' : 'not_required';
      const dbPolicyCalcMemory = policyResult ? {
        calculatedDays: policyResult.calculatedDays,
        appliedDiscount: policyResult.appliedDiscount,
        baseModel: policyResult.baseModel,
        dailyCeilingUnit: policyResult.dailyCeilingUnit,
        monthlyCeilingUnit: policyResult.monthlyCeilingUnit,
        referenceAmount: policyResult.referenceAmount,
        limitAmount: policyResult.limitAmount,
        proposedTotal: policyResult.proposedTotal,
        excessAmount: policyResult.excessAmount,
        excessPercent: policyResult.excessPercent,
        message: policyResult.message
      } : {};

      const mapRemunerationModelToDB = (model: string): string => {
        if (model === 'fixed_job') return 'closed_package';
        if (model === 'monthly_salary') return 'monthly';
        return model;
      };

      jobPayload = {
        job_code: `JOB-${Date.now().toString().slice(-6)}`,
        title: name,
        client_name: client,
        nucleo_id: nucleoId,
        requester_id: db.currentUser.id,
        description,
        urgency: urgencyDb,
        status: statusDb,
        start_date: startDate,
        end_date: endDate,
        payment_flow: paymentFlow,
        payment_model: paymentFlow === 'one_time' ? 'single' : 'recurring',
        remuneration_model: mapRemunerationModelToDB(remunerationModel),
        expected_rate: expectedRate,
        expected_hours: remunerationModel === 'hourly' ? expectedHours : null,
        expected_payment_day: paymentFlow === 'recurring' ? expectedPaymentDay : null,
        expected_payment_count: expectedPaymentCount,
        expected_total_compensation: expectedTotalCompensation,
        expected_budget_saving_amount: savingAmount,
        expected_budget_saving_percentage: savingPercentage,
        payment_policy_status: policyStatus,
        
        // New financial columns in jobs
        expected_total_value: expectedTotalCompensation,
        expected_daily_value: remunerationModel === 'daily' ? oneTimeRate : null,
        expected_monthly_value: (remunerationModel === 'monthly_salary' || paymentFlow === 'recurring') ? summary.effectiveMonthlyAmount : null,
        expected_closed_value: remunerationModel === 'fixed_job' ? oneTimeRate : null,
        payment_day: paymentFlow === 'recurring' ? expectedPaymentDay : null,
        installments_count: paymentFlow === 'recurring' ? summary.selectedCount : 1,
        suggested_installments_count: paymentFlow === 'recurring' ? summary.totalCount : 1,
        payment_dates: allGeneratedISO,
        selected_payment_dates: selectedISO,
        deselected_payment_dates: excludedISO,
        payment_dates_generated: allGeneratedISO,
        payment_dates_selected: selectedISO,
        payment_dates_excluded: excludedISO,

        // Policy columns in jobs
        policy_reference_value: matchedPolicy ? Number(matchedPolicy.referenceValue) : null,
        policy_cap_value: matchedPolicy ? Number(matchedPolicy.ceilingValue) : null,
        policy_reference_total: policyResult ? policyResult.referenceAmount : null,
        policy_cap_total: policyResult ? policyResult.limitAmount : null,
        policy_discount_percent: policyResult ? (policyResult.appliedDiscount * 100) : 0,
        policy_discount_amount_reference: (policyResult && policyResult.appliedDiscount > 0)
          ? (matchedPolicy ? Number(matchedPolicy.referenceValue) : 0) * days * policyResult.appliedDiscount
          : 0,
        policy_discount_amount_cap: (policyResult && policyResult.appliedDiscount > 0)
          ? (matchedPolicy ? Number(matchedPolicy.ceilingValue) : 0) * days * policyResult.appliedDiscount
          : 0,
        policy_exceeded: dbPolicyExceeded,
        policy_excess_amount: policyResult ? policyResult.excessAmount : 0,
        policy_excess_percent: policyResult ? policyResult.excessPercent : 0,
        policy_status: dbPolicyStatus,
        policy_calc_memory: dbPolicyCalcMemory,
        requires_head_approval: dbRequiresHeadApproval,
        approval_status: dbApprovalStatus,
        created_by_user_id: db.currentUser.id,
        created_by_profile: db.currentUser.role,
        created_by_nucleo_id: db.currentUser.nucleoId || nucleoId
      };

      const { data: parentJob, error: jobErr } = await supabase
        .from('jobs')
        .insert(jobPayload)
        .select('id')
        .single();

      if (jobErr || !parentJob) throw jobErr || new Error('Erro ao criar job.');

      requestPayload = {
        request_code: `REQ-${Date.now().toString().slice(-6)}`,
        job_id: parentJob.id,
        function_id: funcId,
        seniority: mapSeniorityToDB(seniorityNeeded),
        scope_description: description,
        deliverables,
        start_date: startDate,
        end_date: endDate,
        budget_max: budget,
        status: statusDb,
        payment_flow: paymentFlow,
        remuneration_model: mapRemunerationModelToDB(remunerationModel),
        expected_rate: expectedRate,
        expected_hours: remunerationModel === 'hourly' ? expectedHours : null,
        expected_payment_day: paymentFlow === 'recurring' ? expectedPaymentDay : null,
        expected_payment_count: expectedPaymentCount,
        expected_total_compensation: expectedTotalCompensation,
        expected_budget_saving_amount: savingAmount,
        expected_budget_saving_percentage: savingPercentage,
        payment_policy_status: policyStatus,
        payment_dates_generated: allGeneratedISO,
        payment_dates_selected: selectedISO,
        payment_dates_excluded: excludedISO,
        
        // Policy fields in requests
        policy_reference_value: matchedPolicy ? Number(matchedPolicy.referenceValue) : null,
        policy_ceiling_value: matchedPolicy ? Number(matchedPolicy.ceilingValue) : null,
        is_above_policy: dbPolicyExceeded,
        policy_status: dbPolicyStatus,
        policy_exceeded_at_creation: dbPolicyExceeded,
        policy_exceeded_reason: policyResult ? policyResult.message : null,
        approval_required: dbRequiresHeadApproval,
      };

      const { data: requestJob, error: reqErr } = await supabase
        .from('job_freelancer_requests')
        .insert(requestPayload)
        .select('*, jobs(*), freela_functions(*)')
        .single();

      if (reqErr || !requestJob) {
        await supabase.from('jobs').delete().eq('id', parentJob.id);
        throw reqErr || new Error('Erro ao criar requisição do job.');
      }

      const mappedJob = mapJobToUI(requestJob);
      db.setJobs(prev => [mappedJob, ...prev]);
      alert(`Demanda "${name}" registrada com sucesso! Prossiga para a shortlist.`);
      db.setSelectedJobId(mappedJob.id);
      db.setActiveTab('Shortlist');
    } catch (error: any) {
      console.error('Error creating opportunity:', error);
      console.error('Error payload details:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        payload: jobPayload
      });

      alert(
        `Erro ao criar oportunidade: ${
          error?.message ||
          error?.details ||
          error?.hint ||
          'Erro desconhecido. Verifique o console.'
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Shared style atoms ────────────────────────────────────────────────────
  const inputCls = [
    'w-full border border-border-subtle rounded-xl px-4 py-3 text-sm',
    'text-text-primary bg-white dark:bg-slate-800',
    'focus:outline-none focus:ring-2 focus:ring-action-cyan/30 focus:border-action-cyan',
    'transition-colors duration-150 min-h-[44px]',
  ].join(' ');
  const selectCls = inputCls + ' cursor-pointer';
  const labelCls = 'block text-[11px] font-bold text-text-secondary mb-1.5 uppercase tracking-wide';
  const sectionCls = 'bg-white dark:bg-slate-900 border border-border-subtle rounded-2xl p-6 shadow-xs space-y-5';

  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-6 pb-10">

      {/* ── Page header ── */}
      <div className="flex gap-3 items-center mb-6 pt-1">
        <div className="w-10 h-10 rounded-2xl bg-action-cyan/10 flex items-center justify-center shrink-0">
          <Briefcase className="w-5 h-5 text-action-cyan" />
        </div>
        <div>
          <h2 className="font-extrabold text-text-primary text-lg leading-tight">
            Registrar Nova Demanda de Freelancer
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Configure o job, defina o fluxo de pagamento e inicie a shortlist automaticamente.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 1 — Dados Principais
        ═══════════════════════════════════════════════════════════════ */}
        <div className={sectionCls}>
          <h3 className="font-bold text-action-cyan text-xs uppercase tracking-wider border-b border-border-subtle pb-3">
            1. Dados Principais do Job
          </h3>

          {/* Núcleo */}
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 space-y-2">
            <label className={labelCls + ' text-amber-800 dark:text-amber-400 flex items-center gap-1.5'}>
              <Building className="w-3.5 h-3.5" />
              Núcleo Responsável pelo Job *
            </label>
            <select
              required disabled={!canSelectNucleo}
              value={selectedNucleoId} onChange={e => setSelectedNucleoId(e.target.value)}
              className={selectCls + ' border-amber-300 dark:border-amber-700 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-text-secondary disabled:cursor-not-allowed'}
            >
              <option value="">— Selecione o núcleo responsável —</option>
              {activeNucleos.map((n: any) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            {activeNucleos.length === 0 && canSelectNucleo && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">Nenhum núcleo ativo cadastrado no sistema.</p>
            )}
          </div>

          {/* Título + Cliente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Título do Projeto / Job *</label>
              <input type="text" placeholder="Ex: Arena Real Gamer – Stand CCXP 2026" value={name} onChange={e => setName(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Cliente Solicitante *</label>
              <input type="text" placeholder="Ex: Coca-Cola Inc." value={client} onChange={e => setClient(e.target.value)} className={inputCls} required />
            </div>
          </div>

          {/* Função + Senioridade + Urgência */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className={labelCls}>Função Requerida</label>
              <select value={roleNeeded} onChange={e => setRoleNeeded(e.target.value)} className={selectCls}>
                {['Diretor de Arte','Designer 3D','Planejamento','Produtor Executivo','Produtor de Campo','Atendimento','Redator','Motion Designer','Cenógrafo','Conteúdo'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Senioridade Requerida</label>
              <select value={seniorityNeeded} onChange={e => setSeniorityNeeded(e.target.value as any)} className={selectCls}>
                {['Júnior','Pleno','Sênior','Especialista'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Regime de Urgência</label>
              <select value={urgency} onChange={e => setUrgency(e.target.value as any)} className={selectCls}>
                <option value="Baixa">Baixa (Padrão)</option>
                <option value="Média">Média (Atenção)</option>
                <option value="Alta">Alta (Imediato)</option>
              </select>
            </div>
          </div>

          {/* Início + Fim + Budget */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className={labelCls}>Início Estimado</label>
              <input type="date" value={startDate}
                onChange={e => {
                  const v = e.target.value;
                  setStartDate(v);
                  if (paymentFlow === 'recurring') rebuildDates(v, endDate, expectedPaymentDay, paymentDates);
                }}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Fim Estimado</label>
              <input type="date" value={endDate}
                onChange={e => {
                  const v = e.target.value;
                  setEndDate(v);
                  if (paymentFlow === 'recurring') rebuildDates(startDate, v, expectedPaymentDay, paymentDates);
                }}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Budget Previsto Máximo (Valor Total do Job) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-text-secondary select-none">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={budgetVisual}
                  onChange={handleBudgetChange}
                  onBlur={handleBudgetBlur}
                  className={inputCls + ' pl-9 font-semibold'}
                  required
                />
              </div>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className={labelCls}>Descrição Técnica / Escopo da Atividade *</label>
            <textarea rows={4} placeholder="Descreva as tarefas, responsabilidades e contexto do freelancer..." value={description} onChange={e => setDescription(e.target.value)} className={inputCls + ' resize-y'} required />
          </div>

          {/* Entregáveis */}
          <div>
            <label className={labelCls}>Entregáveis (Milestones para quitação financeira)</label>
            <input type="text" placeholder="Ex: Arquivo 3D FBX do stand, manual de aplicação visual, arquivos PSD abertos" value={deliverables} onChange={e => setDeliverables(e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 2 — Fluxo de Pagamento
        ═══════════════════════════════════════════════════════════════ */}
        <div className={sectionCls}>
          <div className="border-b border-border-subtle pb-3">
            <h3 className="font-bold text-action-cyan text-xs uppercase tracking-wider flex items-center gap-2">
              <Scale className="w-4 h-4" />
              2. Fluxo de Pagamento da Alocação
            </h3>
            <p className="text-xs text-text-secondary mt-1.5">
              Defina se o pagamento será único ou recorrente durante o período contratado.
            </p>
          </div>

          {/* Modelo de pagamento + Modelo de remuneração */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Modelo de Pagamento *</label>
              <select value={paymentFlow} onChange={e => handlePaymentFlowChange(e.target.value as 'one_time' | 'recurring')} className={selectCls} required>
                <option value="one_time">Pagamento único</option>
                <option value="recurring">Pagamento recorrente durante o período de alocação</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Modelo de Remuneração *</label>
              {paymentFlow === 'recurring' ? (
                <>
                  <div className="w-full border border-action-cyan/40 bg-action-cyan/5 dark:bg-action-cyan/10 rounded-xl px-4 py-3 min-h-[44px] text-sm text-text-primary flex items-center gap-2.5 select-none">
                    <span className="w-2 h-2 rounded-full bg-action-cyan shrink-0" />
                    <span className="font-semibold">Mensal / salário por período</span>
                    <span className="ml-auto text-[9px] font-bold text-action-cyan bg-action-cyan/15 px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap">
                      Obrigatório
                    </span>
                  </div>
                  <p className="text-[10px] text-text-secondary mt-1.5">
                    Para pagamento recorrente, o modelo é sempre Mensal / Salário por período.
                  </p>
                </>
              ) : (
                <select value={remunerationModel} onChange={e => setRemunerationModel(e.target.value as any)} className={selectCls} required>
                  <option value="daily">Diária</option>
                  <option value="hourly">Hora</option>
                  <option value="fixed_job">Job fechado (pacote)</option>
                </select>
              )}
            </div>
          </div>

          {/* ── One-time fields ── */}
          {paymentFlow === 'one_time' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className={remunerationModel === 'hourly' ? '' : 'md:col-span-2'}>
                <label className={labelCls}>
                  {remunerationModel === 'daily' && 'Valor Previsto por Dia (R$) *'}
                  {remunerationModel === 'hourly' && 'Valor Previsto por Hora (R$) *'}
                  {remunerationModel === 'fixed_job' && 'Valor Total Fechado (R$) *'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-text-secondary select-none">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={oneTimeRateVisual}
                    onChange={handleOneTimeRateChange}
                    onBlur={handleOneTimeRateBlur}
                    className={inputCls + ' pl-9 font-semibold'}
                    required
                  />
                </div>
              </div>
              {remunerationModel === 'hourly' && (
                <div>
                  <label className={labelCls}>Horas Previstas *</label>
                  <input type="number" value={expectedHours || ''} placeholder="0" min={1} onChange={e => setExpectedHours(Number(e.target.value))} className={inputCls} required />
                </div>
              )}
            </div>
          )}

          {/* ── Recurring configuration block ── */}
          {paymentFlow === 'recurring' && (
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-border-subtle rounded-xl p-5 space-y-5">

              {/* Header + recalculate button */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                  Configuração de Parcelas Recorrentes
                </h4>
                <button
                  type="button"
                  onClick={handleRecalculate}
                  title="Restaurar todas as datas e recalcular valor mensal sugerido"
                  className="text-[11px] font-bold text-action-cyan hover:text-white bg-action-cyan/10 hover:bg-action-cyan px-3 py-1.5 rounded-lg transition-colors duration-150 cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  Recalcular sugestão
                </button>
              </div>

              {/* Date update message */}
              {datesUpdatedMsg && (
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-lg px-3.5 py-2.5 text-[11px] text-blue-700 dark:text-blue-400 font-medium">
                  ℹ️ {datesUpdatedMsg}
                </div>
              )}

              {/* Dia preferencial + Qtd parcelas (derived) + Valor mensal */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                {/* Dia preferencial */}
                <div>
                  <label className={labelCls}>Dia Preferencial de Pagamento *</label>
                  <select
                    value={expectedPaymentDay}
                    onChange={e => {
                      const d = Number(e.target.value);
                      setExpectedPaymentDay(d);
                      rebuildDates(startDate, endDate, d, paymentDates);
                    }}
                    className={selectCls} required
                  >
                    {[1,2,3,4,5,6,7,8,9,10,12,15,20,25,28,30].map(d => (
                      <option key={d} value={d}>Dia {d}</option>
                    ))}
                  </select>
                </div>

                {/* Quantidade de parcelas — derived, read-only display */}
                <div>
                  <label className={labelCls}>
                    Quantidade de Parcelas
                    {hasManuallyExcluded && (
                      <span className="ml-2 text-[9px] font-bold text-amber-200 bg-amber-700 dark:bg-amber-600 px-1.5 py-0.5 rounded-full uppercase">
                        Ajustado manualmente
                      </span>
                    )}
                  </label>
                  <div className={inputCls + ' bg-slate-100 dark:bg-slate-700/60 font-bold text-lg select-none flex items-center justify-between'}>
                    <span>{summary.selectedCount > 0 ? summary.selectedCount : '—'}</span>
                    {summary.totalCount > 0 && (
                      <span className="text-[11px] font-normal text-text-secondary">
                        de {summary.totalCount} geradas
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-text-secondary mt-1">
                    A quantidade acompanha as datas selecionadas abaixo.
                  </p>
                </div>

                {/* Valor previsto mensal */}
                <div>
                  <label className={labelCls}>
                    Valor Previsto Mensal (R$) *
                    {manualMonthlyRate !== null && (
                      <span className="ml-2 text-[9px] font-bold text-amber-200 bg-amber-700 dark:bg-amber-600 px-1.5 py-0.5 rounded-full uppercase">
                        Editado
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-text-secondary select-none">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={manualMonthlyRate !== null ? manualMonthlyRateVisual : ''}
                      placeholder={summary.suggestedMonthlyAmount > 0 ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(summary.suggestedMonthlyAmount) : "Calculado automaticamente"}
                      onChange={handleManualMonthlyRateChange}
                      onBlur={handleManualMonthlyRateBlur}
                      className={inputCls + ' pl-9 font-semibold'}
                      required={manualMonthlyRate !== null}
                    />
                  </div>
                  {manualMonthlyRate === null && budget > 0 && summary.selectedCount > 0 && (
                    <p className="text-[10px] text-text-secondary mt-1">
                      Sugestão: {formatBRL(budget)} ÷ {summary.selectedCount} parcela{summary.selectedCount !== 1 ? 's' : ''} selecionada{summary.selectedCount !== 1 ? 's' : ''}
                    </p>
                  )}
                  {manualMonthlyRate !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setManualMonthlyRate(null);
                        setManualMonthlyRateVisual('');
                      }}
                      className="text-[10px] text-action-cyan hover:underline mt-1 cursor-pointer"
                    >
                      ↺ Usar sugestão automática
                    </button>
                  )}
                </div>
              </div>

              {/* ── Interactive payment dates ── */}
              {paymentDates.length > 0 ? (
                <div className="bg-white dark:bg-slate-800 border border-border-subtle rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                      Datas de Pagamento Previstas
                    </p>
                    <p className="text-[11px] text-text-secondary">
                      <span className="font-bold text-text-primary">{summary.selectedCount}</span> de{' '}
                      <span className="font-bold">{summary.totalCount}</span> datas selecionadas para pagamento.
                    </p>
                  </div>

                  {/* Date chips — toggleable */}
                  <div className="flex flex-wrap gap-2">
                    {paymentDates.map((entry) => {
                      const isLast = entry.selected && summary.selectedCount === 1;
                      return (
                        <button
                          key={entry.date}
                          type="button"
                          title={
                            isLast
                              ? 'Esta é a última data ativa — não pode ser removida.'
                              : entry.selected
                                ? 'Clique para desmarcar esta data'
                                : 'Clique para reativar esta data'
                          }
                          onClick={() => togglePaymentDate(entry.date)}
                          aria-pressed={entry.selected}
                          className={[
                            // Base
                            'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-semibold',
                            'transition-all duration-150 cursor-pointer min-h-[40px]',
                            'focus:outline-none focus:ring-2 focus:ring-offset-1',
                            // Selected state
                            entry.selected
                              ? [
                                  'bg-action-cyan/15 dark:bg-action-cyan/20',
                                  'border-action-cyan/60 dark:border-action-cyan/50',
                                  'text-action-cyan dark:text-cyan-300',
                                  'hover:bg-action-cyan/25 dark:hover:bg-action-cyan/30',
                                  'focus:ring-action-cyan',
                                ].join(' ')
                              : [
                                  'bg-slate-200 dark:bg-slate-700',
                                  'border-slate-300 dark:border-slate-600',
                                  'text-slate-500 dark:text-slate-400',
                                  'hover:bg-slate-300 dark:hover:bg-slate-600',
                                  'focus:ring-slate-400',
                                  'line-through decoration-slate-400',
                                ].join(' '),
                            // Last-active styling
                            isLast && 'opacity-60 cursor-not-allowed',
                          ].join(' ')}
                        >
                          {entry.selected ? (
                            <Check className="w-3 h-3 shrink-0" />
                          ) : (
                            <X className="w-3 h-3 shrink-0" />
                          )}
                          {isoToBR(entry.date)}
                        </button>
                      );
                    })}
                  </div>

                  {/* Informational message when some dates are excluded */}
                  {hasManuallyExcluded && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic border-t border-border-subtle pt-2">
                      Datas desmarcadas não serão consideradas na agenda de pagamento.
                    </p>
                  )}

                  {/* Error: budget not set */}
                  {(!budget || budget <= 0) && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                      💡 Informe o budget para calcular o valor mensal automaticamente.
                    </p>
                  )}
                </div>
              ) : (
                startDate && endDate && (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-xl p-3.5 text-sm text-red-700 dark:text-red-400 font-semibold flex items-start gap-2">
                    <span className="shrink-0">⚠️</span>
                    <span>Não há nenhuma data de pagamento dentro do período informado. Ajuste o período da alocação ou o dia preferencial de pagamento.</span>
                  </div>
                )
              )}
            </div>
          )}

          {/* ── Policy reference card ── */}
          {(() => {
            const dailyPolicyForFixedJob = db.policies.find((p: any) =>
              p.role === roleNeeded &&
              p.seniority === seniorityNeeded &&
              (['Diária', 'daily'].includes(p.billingType) || p.remunerationModel === 'daily')
            );
            const dailyReferenceUnit = dailyPolicyForFixedJob ? Number(dailyPolicyForFixedJob.referenceValue) : 0;
            const dailyCeilingUnit = dailyPolicyForFixedJob ? Number(dailyPolicyForFixedJob.ceilingValue) : 0;

            const proposedVal = paymentFlow === 'recurring' ? summary.effectiveMonthlyAmount : oneTimeRate;
            const calculatedDays = policyResult ? policyResult.calculatedDays : calculateInclusiveDays(startDate, endDate);
            const refBruto = dailyReferenceUnit * calculatedDays;
            const tetoBruto = dailyCeilingUnit * calculatedDays;
            const discountPercent = policyResult ? Math.round(policyResult.appliedDiscount * 100) : 0;
            const descontoReferencia = refBruto * (discountPercent / 100);
            const descontoTeto = tetoBruto * (discountPercent / 100);
            const refFechado = refBruto - descontoReferencia;
            const tetoFechado = tetoBruto - descontoTeto;
            const calculatedExcessAmount = proposedVal - tetoFechado;
            const calculatedExcessPercent = tetoFechado > 0 ? (calculatedExcessAmount / tetoFechado) * 100 : 0;
            
            const isMemoryOpen = isMemoryOpenManual !== null ? isMemoryOpenManual : (policyStatus === 'above_policy_requires_approval');

            const cardClass = 
              policyStatus === 'above_policy_requires_approval' ? 'policy-card-above' :
              policyStatus === 'within_policy' ? 'policy-card-within' :
              'policy-card-missing';

            return (
              <div className={`border rounded-2xl p-5 space-y-4 ${cardClass}`}>
                <h5 className="policy-title text-[12px] font-bold flex items-center gap-1.5 uppercase tracking-wide">
                  <Scale className="w-4 h-4 text-[inherit]" />
                  Política de Referência — {roleNeeded} / {seniorityNeeded}
                </h5>

                {policyResult && policyResult.policyStatus !== 'policy_missing' ? (
                  <div className="space-y-4">
                    {/* Linha 1 */}
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs border-b border-border-subtle pb-3 text-text-secondary">
                      <div>
                        Modelo: <strong className="text-text-primary">{
                          remunerationModel === 'daily' ? 'Diária' :
                          remunerationModel === 'hourly' ? 'Hora' :
                          remunerationModel === 'fixed_job' ? 'Job fechado' : 'Mensal / Salário'
                        }</strong>
                      </div>
                      <div>
                        Base de cálculo: <strong className="text-text-primary">{
                          remunerationModel === 'fixed_job' ? 'Diária equivalente' :
                          remunerationModel === 'daily' ? 'Diária direta' :
                          remunerationModel === 'hourly' ? 'Horas previstas' : 'Mensal direto'
                        }</strong>
                      </div>
                      <div>
                        Período considerado: <strong className="text-text-primary">{calculatedDays} dias corridos</strong>
                      </div>
                    </div>

                    {/* Cards Internos */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Card 1: Valor informado */}
                      <div className="policy-metric-bg p-3 rounded-xl border">
                        <span className="text-[10px] text-text-secondary block font-bold uppercase tracking-wider mb-0.5">Valor Informado</span>
                        <span className="font-extrabold text-sm block">
                          {formatCurrencyBR(proposedVal)}
                        </span>
                      </div>

                      {/* Card 2: Referência total */}
                      <div className="policy-metric-bg p-3 rounded-xl border">
                        <span className="text-[10px] text-text-secondary block font-bold uppercase tracking-wider mb-0.5">Referência Total</span>
                        <span className="font-semibold text-sm block">
                          {policyResult.referenceAmount ? formatCurrencyBR(policyResult.referenceAmount) : '—'}
                        </span>
                      </div>

                      {/* Card 3: Teto autorizado total */}
                      <div className="policy-metric-bg p-3 rounded-xl border">
                        <span className="text-[10px] text-text-secondary block font-bold uppercase tracking-wider mb-0.5">Teto Autorizado Total</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400 text-sm block">
                          {policyResult.limitAmount ? formatCurrencyBR(policyResult.limitAmount) : '—'}
                        </span>
                      </div>

                      {/* Card 4: Status da regra */}
                      <div className="policy-metric-bg p-3 rounded-xl border flex flex-col justify-center">
                        <span className="text-[10px] text-text-secondary block font-bold uppercase tracking-wider mb-1">Status da Regra</span>
                        <div>
                          <span className="policy-badge inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold">
                            {policyStatus === 'within_policy' ? 'Dentro da política' : 'Acima do teto'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Alerta de excedente */}
                    {policyStatus === 'above_policy_requires_approval' && policyResult.excessAmount > 0 && (
                      <div className="policy-warning-bg p-3.5 rounded-xl text-xs font-semibold border">
                        ⚠️ Excedente: {formatCurrencyBR(policyResult.excessAmount)} — {policyResult.excessPercent.toFixed(1)}% acima do teto. Será necessário solicitar aprovação do Head do Núcleo.
                      </div>
                    )}

                    {/* Memória de cálculo */}
                    {remunerationModel === 'fixed_job' && (
                      <div className="border-t border-border-subtle/60 pt-3.5 mt-2">
                        <button
                          type="button"
                          onClick={() => setIsMemoryOpenManual(!isMemoryOpen)}
                          className="flex items-center justify-between w-full text-xs font-bold text-text-primary hover:text-action-cyan transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <span>Memória de cálculo</span>
                            <span className="text-[10px] font-normal text-text-secondary">({isMemoryOpen ? 'Clique para colapsar' : 'Clique para expandir'})</span>
                          </span>
                          {isMemoryOpen ? <ChevronUp className="w-4.5 h-4.5" /> : <ChevronDown className="w-4.5 h-4.5" />}
                        </button>
                        
                        {isMemoryOpen && (
                          <div className="mt-3 bg-white/40 dark:bg-slate-900/40 p-4 rounded-xl border border-border-subtle/50 text-[11px] space-y-2 font-mono text-text-primary leading-relaxed shadow-inner">
                            <div className="flex justify-between border-b border-border-subtle/20 pb-1">
                              <span>Período:</span>
                              <span className="font-semibold">{isoToBR(startDate)} a {isoToBR(endDate)}</span>
                            </div>
                            <div className="flex justify-between border-b border-border-subtle/20 pb-1">
                              <span>Dias considerados:</span>
                              <span className="font-semibold">{calculatedDays} dias corridos</span>
                            </div>
                            <div className="flex justify-between border-b border-border-subtle/20 pb-1">
                              <span>Diária referência:</span>
                              <span className="font-semibold">{formatCurrencyBR(dailyReferenceUnit)}</span>
                            </div>
                            <div className="flex justify-between border-b border-border-subtle/20 pb-1">
                              <span>Diária teto:</span>
                              <span className="font-semibold">{formatCurrencyBR(dailyCeilingUnit)}</span>
                            </div>
                            <div className="flex justify-between border-b border-border-subtle/20 pb-1">
                              <span>Referência bruta:</span>
                              <span className="font-semibold">{formatCurrencyBR(dailyReferenceUnit)} × {calculatedDays} = {formatCurrencyBR(refBruto)}</span>
                            </div>
                            <div className="flex justify-between border-b border-border-subtle/20 pb-1">
                              <span>Teto bruto:</span>
                              <span className="font-semibold">{formatCurrencyBR(dailyCeilingUnit)} × {calculatedDays} = {formatCurrencyBR(tetoBruto)}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-border-subtle/20 pb-1 group relative cursor-help">
                              <span className="underline decoration-dotted flex items-center gap-1">
                                Desconto por job fechado:
                                <HelpCircle className="w-3.5 h-3.5 text-text-secondary" />
                              </span>
                              <span className="font-semibold">{discountPercent}%</span>
                              <div className="absolute bottom-full mb-1.5 left-0 hidden group-hover:block bg-slate-900 text-white text-[10px] rounded p-2.5 shadow-lg z-50 max-w-[280px] font-sans normal-case leading-normal">
                                Desconto aplicado porque contratações por pacote/job fechado tendem a consolidar escopo e reduzir custo proporcional em relação à diária cheia.
                              </div>
                            </div>
                            <div className="flex justify-between border-b border-border-subtle/20 pb-1">
                              <span>Desconto aplicado na referência:</span>
                              <span className="font-semibold">{formatCurrencyBR(descontoReferencia)}</span>
                            </div>
                            <div className="flex justify-between border-b border-border-subtle/20 pb-1">
                              <span>Desconto aplicado no teto:</span>
                              <span className="font-semibold">{formatCurrencyBR(descontoTeto)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-xs pt-1 border-b border-border-subtle/20 pb-1">
                              <span>Referência total após desconto:</span>
                              <span>{formatCurrencyBR(refFechado)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-xs pt-1 border-b border-border-subtle/20 pb-1">
                              <span>Teto autorizado após desconto:</span>
                              <span>{formatCurrencyBR(tetoFechado)}</span>
                            </div>
                            <div className="flex justify-between border-b border-border-subtle/20 pb-1">
                              <span>Valor informado:</span>
                              <span className="font-semibold">{formatCurrencyBR(proposedVal)}</span>
                            </div>
                            {calculatedExcessAmount > 0 ? (
                              <>
                                <div className="flex justify-between text-red-650 dark:text-red-400 font-bold border-b border-border-subtle/20 pb-1">
                                  <span>Excedente:</span>
                                  <span>{formatCurrencyBR(calculatedExcessAmount)}</span>
                                </div>
                                <div className="flex justify-between text-red-650 dark:text-red-400 font-bold">
                                  <span>Percentual acima do teto:</span>
                                  <span>{calculatedExcessPercent.toFixed(1)}%</span>
                                </div>
                              </>
                            ) : (
                              <div className="text-emerald-600 dark:text-emerald-400 font-bold text-right pt-0.5">
                                ✓ Dentro do limite autorizado
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-text-secondary italic flex items-center gap-2 p-2 bg-amber-500/5 rounded-lg border border-amber-500/20">
                    <span>⚠️</span>
                    <span>Não existe política cadastrada para esta função, senioridade e modelo. Solicite validação do RH.</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Financial summary ── */}
          <div className="forecast-card rounded-xl p-5">
            <p className="forecast-title text-[10px] font-bold uppercase tracking-wider mb-4">Resumo da Previsão</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Budget */}
              <div>
                <span className="text-[10px] text-text-muted block mb-1">Budget do Job</span>
                <span className="font-extrabold text-base">{formatCurrencyBR(budget)}</span>
              </div>

              {/* Total previsto */}
              <div>
                <span className="text-[10px] text-text-muted block mb-1">Total Previsto Freela</span>
                <span className={`font-extrabold text-base ${
                  expectedTotalCompensation > 0 && expectedTotalCompensation > budget
                    ? 'forecast-value-negative' : 'forecast-value-positive'
                }`}>
                  {expectedTotalCompensation > 0 ? formatCurrencyBR(expectedTotalCompensation) : '—'}
                </span>
              </div>

              {/* Status da Política */}
              <div>
                <span className="text-[10px] text-text-muted block mb-1">Status da Política</span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                  policyStatus === 'within_policy'
                    ? 'forecast-status-within'
                    : policyStatus === 'above_policy_requires_approval'
                      ? 'forecast-status-above'
                      : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {policyStatus === 'within_policy' ? 'Dentro da política' :
                   policyStatus === 'above_policy_requires_approval' ? 'Acima da política' : 'Política não cadastrada'}
                </span>
              </div>
            </div>

            {policyStatus === 'above_policy_requires_approval' && (
              <p className="text-[11px] forecast-value-negative mt-4 font-semibold border-t border-border-soft pt-3">
                ⚠️ Esta oportunidade foi criada acima da política e exigirá aprovação do Head do Núcleo durante a negociação.
              </p>
            )}

            {policyStatus === 'no_policy_found' && (
              <p className="text-[11px] text-amber-500 mt-4 font-semibold border-t border-border-soft pt-3">
                ⚠️ Não existe política cadastrada para esta combinação. A contratação exigirá validação.
              </p>
            )}
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
          <button type="button" disabled={isSubmitting} onClick={onCancel}
            className="btn-custom btn-secondary disabled:opacity-50">
            Cancelar
          </button>
          <button type="submit" disabled={isSubmitting}
            className="btn-custom btn-primary disabled:opacity-50 flex items-center justify-center gap-2 shadow-md">
            <Plus className="w-4 h-4" />
            {isSubmitting ? 'Gravando...' : 'Criar Demanda & Ver Shortlist'}
          </button>
        </div>
      </form>
    </div>
  );
}
