'use client';

import React, { useState, useCallback } from 'react';
import { DatabaseProps } from '@/app/page';
import {
  getRoleLabel, mapSeniorityToDB, mapFreelancerStatusToDB,
  mapAvailabilityToDB, mapFreelancerToUI, mapJobToUI, mapUrgencyToDB
} from '@/lib/dbMapper';
import { calculateInclusiveDays, calculatePolicyLimitForJob, formatCurrencyBR, parseCurrencyBR, maskCurrencyBRL, simulatePaymentProjections } from '@/lib/financial';
import {
  Sparkles, Save, Briefcase, Plus, Scale, Building,
  RefreshCw, Check, X, ChevronDown, ChevronUp, HelpCircle, Percent,
  Calendar, AlertTriangle
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

  // Today's date in YYYY-MM-DD local format
  const todayStr = React.useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const defaultEndStr = React.useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  // ── Section 1: Job basics ─────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [roleNeeded, setRoleNeeded] = useState('Diretor de Arte');
  const [seniorityNeeded, setSeniorityNeeded] = useState<'Júnior' | 'Pleno' | 'Sênior' | 'Especialista'>('Sênior');
  const [description, setDescription] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(defaultEndStr);
  const [budget, setBudget] = useState(10000);
  const [urgency, setUrgency] = useState<'Alta' | 'Média' | 'Baixa'>('Média');
  const [selectedNucleoId, setSelectedNucleoId] = useState(
    canSelectNucleo ? '' : (db.currentUser.nucleoId || '')
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Section 2: Remuneration ───────────────────────────────────────────────
  const [remunerationModel, setRemunerationModel] = useState<'daily' | 'hourly' | 'fixed_job' | 'monthly_salary'>('daily');

  // Unified payment fields
  const [expectedHours, setExpectedHours] = useState<number>(0);
  const [oneTimeRate, setOneTimeRate] = useState<number>(0);

  // ── Section 3: Success Fee Rules ──────────────────────────────────────────
  const [successFeeEnabled, setSuccessFeeEnabled] = useState(false);
  const [isCompetitiveBid, setIsCompetitiveBid] = useState(false);
  const [successFeeType, setSuccessFeeType] = useState<'fixed' | 'percentage'>('fixed');
  const [successFeeFixedAmount, setSuccessFeeFixedAmount] = useState(0);
  const [successFeeFixedAmountVisual, setSuccessFeeFixedAmountVisual] = useState('');
  const [successFeePercent, setSuccessFeePercent] = useState(0);
  const [successFeeBase, setSuccessFeeBase] = useState('Valor total do contrato');
  const [successFeeTrigger, setSuccessFeeTrigger] = useState('vitória da V3A na concorrência');
  const [successFeeTerms, setSuccessFeeTerms] = useState('');
  const [successFeeRequiresApproval, setSuccessFeeRequiresApproval] = useState(true);

  // Visual currency formatting states
  const [budgetVisual, setBudgetVisual] = useState(() => budget > 0 ? maskCurrencyBRL(budget.toString()) : '');
  const [oneTimeRateVisual, setOneTimeRateVisual] = useState(() => oneTimeRate > 0 ? maskCurrencyBRL(oneTimeRate.toString()) : '');
  const [isMemoryOpenManual, setIsMemoryOpenManual] = useState<boolean | null>(null);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [isEditingSuccessFee, setIsEditingSuccessFee] = useState(false);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting);
      },
      { threshold: [0] }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
      observer.disconnect();
    };
  }, []);

  // Financial totals
  const days = calculateInclusiveDays(startDate, endDate);

  const projectedPayments = React.useMemo(() => {
    return simulatePaymentProjections(startDate, endDate);
  }, [startDate, endDate]);

  // Helper to sync rate (oneTimeRate) from budget
  const syncRateFromBudget = useCallback((
    targetBudget: number,
    model = remunerationModel,
    sfEnabled = successFeeEnabled,
    sfType = successFeeType,
    sfFixed = successFeeFixedAmount,
    sfPercent = successFeePercent,
    currentDays = days,
    currentPayments = projectedPayments.length,
    currentHours = expectedHours
  ) => {
    let baseBudget = targetBudget;
    if (sfEnabled) {
      if (sfType === 'fixed') {
        baseBudget = targetBudget - sfFixed;
      } else {
        baseBudget = targetBudget / (1 + (sfPercent || 0) / 100);
      }
    }
    if (baseBudget < 0) baseBudget = 0;

    let rate = 0;
    if (model === 'monthly_salary') {
      rate = baseBudget / (currentPayments || 1);
    } else if (model === 'fixed_job') {
      rate = baseBudget;
    } else if (model === 'daily') {
      rate = baseBudget / (currentDays || 1);
    } else if (model === 'hourly') {
      rate = baseBudget / (currentHours || 1);
    }

    rate = Math.round(rate * 100) / 100;
    setOneTimeRate(rate);
    setOneTimeRateVisual(rate > 0 ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rate) : '');
  }, [remunerationModel, successFeeEnabled, successFeeType, successFeeFixedAmount, successFeePercent, days, projectedPayments.length, expectedHours]);

  // Helper to sync budget from rate
  const syncBudgetFromRate = useCallback((
    targetRate: number,
    model = remunerationModel,
    sfEnabled = successFeeEnabled,
    sfType = successFeeType,
    sfFixed = successFeeFixedAmount,
    sfPercent = successFeePercent,
    currentDays = days,
    currentPayments = projectedPayments.length,
    currentHours = expectedHours
  ) => {
    let baseCost = 0;
    if (model === 'monthly_salary') {
      baseCost = targetRate * (currentPayments || 1);
    } else if (model === 'fixed_job') {
      baseCost = targetRate;
    } else if (model === 'daily') {
      baseCost = targetRate * (currentDays || 1);
    } else if (model === 'hourly') {
      baseCost = targetRate * (currentHours || 1);
    }

    let calculatedBudget = baseCost;
    if (sfEnabled) {
      if (sfType === 'fixed') {
        calculatedBudget = baseCost + sfFixed;
      } else {
        calculatedBudget = baseCost * (1 + (sfPercent || 0) / 100);
      }
    }

    calculatedBudget = Math.round(calculatedBudget * 100) / 100;
    setBudget(calculatedBudget);
    setBudgetVisual(calculatedBudget > 0 ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(calculatedBudget) : '');
  }, [remunerationModel, successFeeEnabled, successFeeType, successFeeFixedAmount, successFeePercent, days, projectedPayments.length, expectedHours]);

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const masked = maskCurrencyBRL(rawVal);
    setBudgetVisual(masked);
    const numeric = parseCurrencyBR(masked);
    setBudget(numeric);
    syncRateFromBudget(numeric);
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
    syncBudgetFromRate(numeric);
  };

  const handleOneTimeRateBlur = () => {
    if (oneTimeRate > 0) {
      setOneTimeRateVisual(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(oneTimeRate));
    } else {
      setOneTimeRateVisual('');
    }
  };

  const handleSuccessFeeFixedAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const masked = maskCurrencyBRL(rawVal);
    setSuccessFeeFixedAmountVisual(masked);
    const numeric = parseCurrencyBR(masked);
    setSuccessFeeFixedAmount(numeric);
    syncRateFromBudget(budget, remunerationModel, successFeeEnabled, successFeeType, numeric, successFeePercent, days, projectedPayments.length, expectedHours);
  };

  const handleSuccessFeeFixedAmountBlur = () => {
    if (successFeeFixedAmount > 0) {
      setSuccessFeeFixedAmountVisual(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(successFeeFixedAmount));
    } else {
      setSuccessFeeFixedAmountVisual('');
    }
  };

  const activeNucleos = db.nucleos.filter((n: any) => n.status === 'Ativo');
  const nucleoName = db.nucleos.find((n: any) => n.id === selectedNucleoId)?.name || '';

  let oneTimeTotal = 0;
  if (remunerationModel === 'daily') {
    oneTimeTotal = oneTimeRate * Math.max(0, days);
  } else if (remunerationModel === 'hourly') {
    oneTimeTotal = oneTimeRate * (expectedHours || 0);
  } else if (remunerationModel === 'fixed_job') {
    oneTimeTotal = oneTimeRate;
  } else if (remunerationModel === 'monthly_salary') {
    oneTimeTotal = oneTimeRate * projectedPayments.length;
  }

  const expectedTotalCompensation = oneTimeTotal;
  const expectedRate = oneTimeRate;

  // Policy match
  const billingTypeForMatch =
    remunerationModel === 'daily' ? 'Diária' :
      remunerationModel === 'hourly' ? 'Hora' :
        remunerationModel === 'fixed_job' ? 'Job Fechado' : 'Mensal / Salário';

  const matchedPolicy = db.policies.find((p: any) =>
    p.role === roleNeeded &&
    p.seniority === seniorityNeeded &&
    p.billingType === billingTypeForMatch
  );

  const policyResult = React.useMemo(() => {
    if (!roleNeeded || !seniorityNeeded || !remunerationModel || !startDate || !endDate) return null;
    const proposedAmt = oneTimeRate;
    if (!proposedAmt || proposedAmt <= 0) return null;
    return calculatePolicyLimitForJob({
      role: roleNeeded,
      seniority: seniorityNeeded,
      remunerationModel,
      startDate,
      endDate,
      proposedAmount: proposedAmt,
      policies: db.policies,
      installmentsCount: undefined
    });
  }, [roleNeeded, seniorityNeeded, remunerationModel, startDate, endDate, oneTimeRate, db.policies]);

  const matchingSuccessFeePolicy = React.useMemo(() => {
    return db.policies.find((p: any) =>
      p.role === roleNeeded &&
      p.seniority === seniorityNeeded &&
      p.successFeeMaxPercent !== undefined &&
      p.successFeeMaxPercent !== null &&
      p.successFeeMaxPercent > 0
    );
  }, [roleNeeded, seniorityNeeded, db.policies]);

  const currentSuccessFeePercent = React.useMemo(() => {
    if (!successFeeEnabled) return 0;
    if (successFeeType === 'percentage') {
      return successFeePercent || 0;
    } else {
      if (!budget || budget <= 0) return 0;
      return (successFeeFixedAmount / budget) * 100;
    }
  }, [successFeeEnabled, successFeeType, successFeePercent, successFeeFixedAmount, budget]);

  const isSuccessFeeAbovePolicy = successFeeEnabled && matchingSuccessFeePolicy
    ? currentSuccessFeePercent > Number(matchingSuccessFeePolicy.successFeeMaxPercent)
    : false;

  const isAccumulatedOverBudget = budget > 0 && expectedTotalCompensation > budget;

  const basePolicyStatus: 'within_policy' | 'above_policy_requires_approval' | 'no_policy_found' =
    !policyResult || policyResult.policyStatus === 'policy_missing' ? 'no_policy_found' :
      policyResult.policyStatus === 'above_policy' ? 'above_policy_requires_approval' : 'within_policy';

  const policyStatus: 'within_policy' | 'above_policy_requires_approval' | 'no_policy_found' =
    isSuccessFeeAbovePolicy ? 'above_policy_requires_approval' : basePolicyStatus;

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (policyStatus === 'no_policy_found') {
      const confirmCreate = confirm('Não existe política cadastrada para esta combinação. A contratação exigirá validação. Deseja prosseguir com a criação da oportunidade?');
      if (!confirmCreate) return;
    }

    if (isSuccessFeeAbovePolicy && matchingSuccessFeePolicy) {
      const msg = successFeeType === 'percentage'
        ? `Atenção: O percentual de Success Fee informado (${successFeePercent}%) excede o teto autorizado na política para esta função (${matchingSuccessFeePolicy.successFeeMaxPercent}%). A contratação exigirá validação. Deseja prosseguir?`
        : `Atenção: O valor de Success Fee informado equivale a ${currentSuccessFeePercent.toFixed(1)}% do budget, o que excede o teto de ${matchingSuccessFeePolicy.successFeeMaxPercent}% na política para esta função. A contratação exigirá validação. Deseja prosseguir?`;
      const confirmExceed = confirm(msg);
      if (!confirmExceed) return;
    }

    if (!name || !client || !description) {
      alert('Preencha os campos obrigatórios: Título do Job, Cliente e Descrição Técnica.');
      return;
    }
    const nucleoId = canSelectNucleo ? selectedNucleoId : (db.currentUser.nucleoId || '');
    if (!nucleoId) { alert('Selecione o núcleo contratante.'); return; }
    if (!startDate || !endDate) { alert('Informe a data de início e término.'); return; }
    if (startDate < todayStr) {
      alert('A data de início estimado não pode ser anterior à data de hoje.');
      return;
    }
    if (days < 1) { alert('A data de fim deve ser igual ou posterior à data de início.'); return; }
    if (!budget || budget <= 0) { alert('Informe o budget com um valor maior que zero.'); return; }
    if (oneTimeRate <= 0) { alert('Informe um valor previsto de remuneração maior que zero.'); return; }
    if (remunerationModel === 'hourly' && expectedHours <= 0) {
      alert('Informe a quantidade de horas previstas maior que zero.');
      return;
    }

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
      const statusDb = isCompetitiveBid ? 'waiting_competition_result' : 'oportunidade_criada';

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

      const savingAmount = budget - expectedTotalCompensation;
      const savingPercentage = budget > 0 ? (savingAmount / budget) * 100 : 0;

      const jobPayload = {
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
        payment_flow: 'one_time',
        payment_model: 'single',
        remuneration_model: mapRemunerationModelToDB(remunerationModel),
        expected_rate: expectedRate,
        expected_hours: remunerationModel === 'hourly' ? expectedHours : null,
        expected_payment_day: null,
        expected_payment_count: 1,
        expected_total_compensation: expectedTotalCompensation,
        expected_budget_saving_amount: savingAmount,
        expected_budget_saving_percentage: savingPercentage,
        payment_policy_status: policyStatus,

        is_competitive_bid: isCompetitiveBid,
        success_fee_enabled: successFeeEnabled,
        expected_total_value: expectedTotalCompensation,
        expected_daily_value: remunerationModel === 'daily' ? oneTimeRate : null,
        expected_monthly_value: remunerationModel === 'monthly_salary' ? oneTimeRate : null,
        expected_closed_value: remunerationModel === 'fixed_job' ? oneTimeRate : null,
        payment_day: null,
        installments_count: 1,
        suggested_installments_count: 1,
        payment_dates: [],
        selected_payment_dates: [],
        deselected_payment_dates: [],
        payment_dates_generated: [],
        payment_dates_selected: [],
        payment_dates_excluded: [],

        policy_reference_value: matchedPolicy ? Number(matchedPolicy.referenceValue) : null,
        policy_cap_value: matchedPolicy ? Number(matchedPolicy.ceilingValue) : null,
        policy_reference_total: policyResult ? policyResult.referenceAmount : null,
        policy_cap_total: policyResult ? policyResult.limitAmount : null,
        policy_discount_percent: policyResult ? (policyResult.appliedDiscount * 100) : 0,
        policy_exceeded: dbPolicyExceeded,
        policy_excess_amount: policyResult ? policyResult.excessAmount : 0,
        policy_excess_percent: policyResult ? policyResult.excessPercent : 0,
        policy_status: dbPolicyStatus,
        policy_calc_memory: dbPolicyCalcMemory,
        requires_head_approval: dbRequiresHeadApproval,
        approval_status: dbApprovalStatus,
        created_by_user_id: db.currentUser.id,
        created_by_profile: db.currentUser.role || db.currentUser.profile,
        created_by_nucleo_id: db.currentUser.nucleoId || nucleoId
      };

      const { data: parentJob, error: jobErr } = await supabase
        .from('jobs')
        .insert(jobPayload)
        .select('id')
        .single();

      if (jobErr || !parentJob) throw jobErr || new Error('Erro ao criar job.');

      // Save Success Fee Rules if enabled
      if (successFeeEnabled) {
        const { error: ruleErr } = await supabase
          .from('job_success_fee_rules')
          .insert({
            job_id: parentJob.id,
            fee_type: successFeeType,
            fixed_amount: successFeeType === 'fixed' ? successFeeFixedAmount : null,
            percentage_rate: successFeeType === 'percentage' ? successFeePercent : null,
            percentage_base: successFeeType === 'percentage' ? successFeeBase : null,
            trigger_type: successFeeTrigger,
            terms: successFeeTerms,
            requires_approval: successFeeRequiresApproval,
            created_by: db.currentUser.id
          });
        if (ruleErr) {
          // Cleanup job
          await supabase.from('jobs').delete().eq('id', parentJob.id);
          throw ruleErr;
        }
      }

      const requestPayload = {
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
        payment_flow: 'one_time',
        remuneration_model: mapRemunerationModelToDB(remunerationModel),
        expected_rate: expectedRate,
        expected_hours: remunerationModel === 'hourly' ? expectedHours : null,
        expected_payment_day: null,
        expected_payment_count: 1,
        expected_total_compensation: expectedTotalCompensation,
        expected_budget_saving_amount: savingAmount,
        expected_budget_saving_percentage: savingPercentage,
        payment_policy_status: policyStatus,
        payment_dates_generated: [],
        payment_dates_selected: [],
        payment_dates_excluded: [],

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
      alert(`Demanda "${name}" registrada com sucesso! ${isCompetitiveBid ? 'Aguardando encerramento da concorrência.' : 'Prossiga para a shortlist.'}`);
      db.setSelectedJobId(null);
      db.setActiveTab(isCompetitiveBid ? 'Dashboard' : 'Shortlist');
    } catch (error: any) {
      console.error('Error creating opportunity:', error);
      alert(`Erro ao criar oportunidade: ${error?.message || 'Erro desconhecido.'}`);
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
            Configure o job, defina o modelo de remuneração e inicie a shortlist automaticamente.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 relative">
        {/* Sentinel for sticky header */}
        <div ref={sentinelRef} className="absolute top-0 left-0 w-px h-px pointer-events-none" />

        {/* Sticky Consolidated Header Wrapper */}
        <div className="sticky top-0 z-30 h-0 overflow-visible pointer-events-none">
          {isSticky && (
            <div
              className="bg-white/95 dark:bg-slate-900/95 text-text-primary p-4 rounded-2xl border border-border-subtle shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 animate-fade-in pointer-events-auto"
              style={{ backdropFilter: 'blur(8px)' }}
            >
              <div className="space-y-1 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-action-cyan/15 text-action-cyan font-mono text-[9px] font-extrabold px-2 py-0.5 rounded tracking-wider uppercase">
                    Resumo do Job
                  </span>
                  {urgency && (
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${urgency === 'Alta'
                      ? 'bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/10'
                      : urgency === 'Média'
                        ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/10'
                        : 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/10'
                      }`}>
                      Urgência: {urgency}
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-bold text-text-primary leading-tight">
                  {client ? `[${client}] ` : ''}{name || 'Título não definido'}
                </h3>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-secondary">
                  {nucleoName && (
                    <div className="flex items-center gap-1">
                      <Building className="w-3 h-3 text-text-muted" />
                      <span>Núcleo: <strong className="text-text-primary">{nucleoName}</strong></span>
                    </div>
                  )}
                  {(roleNeeded || seniorityNeeded) && (
                    <div className="flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-text-muted" />
                      <span>Função: <strong className="text-text-primary">{roleNeeded} ({seniorityNeeded})</strong></span>
                    </div>
                  )}
                  {(startDate || endDate) && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-text-muted" />
                      <span>Período: <strong className="text-text-primary">{startDate ? isoToBR(startDate) : '?'} a {endDate ? isoToBR(endDate) : '?'}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              <div className={`flex flex-col sm:items-end justify-center shrink-0 px-3 py-1.5 rounded-xl transition-all duration-300 ${isEditingRate || isEditingSuccessFee || isEditingBudget
                ? 'border border-action-cyan/40 bg-action-cyan/5 ring-1 ring-action-cyan/20 shadow-[0_0_8px_rgba(6,182,212,0.15)]'
                : 'border border-transparent'
                }`}>
                <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider flex items-center gap-1.5">
                  Budget Máximo
                  {(isEditingRate || isEditingSuccessFee || isEditingBudget) && (
                    <span className="text-[8px] font-extrabold text-action-cyan uppercase tracking-wider animate-pulse">
                      (Atualizando...)
                    </span>
                  )}
                </span>
                <span className="text-base font-extrabold text-action-cyan">
                  {formatCurrencyBR(budget || 0)}
                </span>
              </div>
            </div>
          )}
        </div>

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
              value={selectedNucleoId}
              onChange={e => setSelectedNucleoId(e.target.value)}
              className={selectCls}
            >
              <option value="">Selecione o núcleo responsável...</option>
              {activeNucleos.map((n: any) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            {!canSelectNucleo && (
              <p className="text-[10px] text-amber-600 dark:text-amber-500/80">
                Você está vinculado ao núcleo <strong>{activeNucleos.find((n: any) => n.id === db.currentUser.nucleoId)?.name || '—'}</strong>. Contatos de nível Núcleo não podem alterar o núcleo contratante.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Título do Job / Oportunidade *</label>
              <input type="text" placeholder="Ex: Diretor de Arte para Convenção Anual" value={name} onChange={e => setName(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Cliente / Projeto *</label>
              <input type="text" placeholder="Ex: Nestlé - Campanha Páscoa" value={client} onChange={e => setClient(e.target.value)} className={inputCls} required />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className={labelCls}>Função Requerida</label>
              <select value={roleNeeded} onChange={e => setRoleNeeded(e.target.value)} className={selectCls}>
                {Array.from(new Set(db.policies.map((p: any) => p.role))).map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Senioridade Requerida</label>
              <select value={seniorityNeeded} onChange={e => setSeniorityNeeded(e.target.value as any)} className={selectCls}>
                {['Júnior', 'Pleno', 'Sênior', 'Especialista'].map(s => (
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
                min={todayStr}
                onChange={e => {
                  const newStart = e.target.value;
                  setStartDate(newStart);
                  const newDays = calculateInclusiveDays(newStart, endDate);
                  const newProj = simulatePaymentProjections(newStart, endDate);
                  syncRateFromBudget(budget, remunerationModel, successFeeEnabled, successFeeType, successFeeFixedAmount, successFeePercent, newDays, newProj.length, expectedHours);
                }}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Fim Estimado</label>
              <input type="date" value={endDate}
                min={startDate}
                onChange={e => {
                  const newEnd = e.target.value;
                  setEndDate(newEnd);
                  const newDays = calculateInclusiveDays(startDate, newEnd);
                  const newProj = simulatePaymentProjections(startDate, newEnd);
                  syncRateFromBudget(budget, remunerationModel, successFeeEnabled, successFeeType, successFeeFixedAmount, successFeePercent, newDays, newProj.length, expectedHours);
                }}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                Budget Previsto Máximo (Valor Total do Job) *
                {(isEditingRate || isEditingSuccessFee) && (
                  <span className="ml-2 text-[10px] font-extrabold text-action-cyan uppercase tracking-wider animate-pulse">
                    (Atualizando...)
                  </span>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-text-secondary select-none">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={budgetVisual}
                  onChange={handleBudgetChange}
                  onFocus={() => setIsEditingBudget(true)}
                  onBlur={() => {
                    handleBudgetBlur();
                    setIsEditingBudget(false);
                  }}
                  className={`${inputCls} pl-9 font-semibold transition-all duration-300 ${isEditingRate || isEditingSuccessFee
                    ? 'border-action-cyan ring-2 ring-action-cyan/40 shadow-[0_0_12px_rgba(6,182,212,0.25)] bg-action-cyan/5 dark:bg-action-cyan/10'
                    : ''
                    }`}
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
            SECTION 2 — Modelo de Remuneração e Valores
        ═══════════════════════════════════════════════════════════════ */}
        <div className={sectionCls}>
          <div className="border-b border-border-subtle pb-3">
            <h3 className="font-bold text-action-cyan text-xs uppercase tracking-wider flex items-center gap-2">
              <Scale className="w-4 h-4" />
              2. Modelo de Remuneração da Alocação
            </h3>
            <p className="text-xs text-text-secondary mt-1.5">
              Defina a sugestão do modelo de remuneração mais adequado para este job e revise os valores.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Modelo de Remuneração *</label>
              <select
                value={remunerationModel}
                onChange={e => {
                  const newModel = e.target.value as any;
                  setRemunerationModel(newModel);
                  syncRateFromBudget(budget, newModel, successFeeEnabled, successFeeType, successFeeFixedAmount, successFeePercent, days, projectedPayments.length, expectedHours);
                }}
                className={selectCls}
                required
              >
                <option value="daily">Diária</option>
                <option value="hourly">Hora</option>
                <option value="fixed_job">Job fechado (pacote)</option>
                <option value="monthly_salary">Mensal / Salário por período</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>
                {remunerationModel === 'daily' && 'Valor Previsto por Diária (R$) *'}
                {remunerationModel === 'hourly' && 'Valor Previsto por Hora (R$) *'}
                {remunerationModel === 'fixed_job' && 'Valor Total Fechado (R$) *'}
                {remunerationModel === 'monthly_salary' && 'Valor Mensal Equivalente (R$) *'}
                {(isEditingSuccessFee || isEditingBudget) && (
                  <span className="ml-2 text-[10px] font-extrabold text-action-cyan uppercase tracking-wider animate-pulse">
                    (Atualizando...)
                  </span>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-text-secondary select-none">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={oneTimeRateVisual}
                  onChange={handleOneTimeRateChange}
                  onFocus={() => setIsEditingRate(true)}
                  onBlur={() => {
                    handleOneTimeRateBlur();
                    setIsEditingRate(false);
                  }}
                  className={`${inputCls} pl-9 font-semibold transition-all duration-300 ${isEditingSuccessFee || isEditingBudget
                    ? 'border-action-cyan ring-2 ring-action-cyan/40 shadow-[0_0_12px_rgba(6,182,212,0.25)] bg-action-cyan/5 dark:bg-action-cyan/10'
                    : ''
                    }`}
                  required
                />
              </div>
            </div>
          </div>

          {remunerationModel === 'monthly_salary' && isAccumulatedOverBudget && (
            <div className="mt-4 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-xs font-semibold text-red-650 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
              <div>
                Atenção: O custo total previsto para as parcelas mensais acumuladas ({projectedPayments.length} × {formatCurrencyBR(oneTimeRate)} = {formatCurrencyBR(expectedTotalCompensation)}) excede o budget máximo do job ({formatCurrencyBR(budget)}).
              </div>
            </div>
          )}

          {remunerationModel === 'hourly' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={labelCls}>Horas Previstas *</label>
                <input
                  type="number"
                  value={expectedHours || ''}
                  placeholder="0"
                  min={1}
                  onChange={e => {
                    const newHours = Number(e.target.value);
                    setExpectedHours(newHours);
                    syncRateFromBudget(budget, remunerationModel, successFeeEnabled, successFeeType, successFeeFixedAmount, successFeePercent, days, projectedPayments.length, newHours);
                  }}
                  className={inputCls}
                  required
                />
              </div>
            </div>
          )}

          {/* Projeção de Pagamento Box */}
          {projectedPayments && projectedPayments.length > 0 && (
            <div className="mt-6 border-t border-border-subtle/50 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-action-cyan" />
                  <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    Projeção de Pagamentos (Diretrizes de Supply)
                  </h4>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-bold text-text-secondary">
                  <span>Duração total: <strong className="text-text-primary">{days} dias</strong></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-border-subtle" />
                  <span>Parcelas: <strong className="text-text-primary">{projectedPayments.length}</strong></span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {projectedPayments.map((p, idx) => {
                  const cycleDays = calculateInclusiveDays(p.startDate, p.endDate);
                  let parcelAmount = 0;
                  if (remunerationModel === 'monthly_salary') {
                    parcelAmount = oneTimeRate;
                  } else if (remunerationModel === 'fixed_job') {
                    parcelAmount = oneTimeRate / projectedPayments.length;
                  } else if (remunerationModel === 'daily') {
                    parcelAmount = oneTimeRate * cycleDays;
                  } else if (remunerationModel === 'hourly') {
                    parcelAmount = (oneTimeRate * expectedHours) / projectedPayments.length;
                  }

                  return (
                    <div key={idx} className="bg-slate-500/5 border border-border-subtle/50 rounded-xl p-3.5 flex flex-col justify-between gap-2 shadow-sm">
                      <div className="flex items-center justify-between border-b border-border-subtle/20 pb-1.5 mb-1">
                        <span className="text-[10px] font-extrabold text-action-cyan uppercase tracking-wider">
                          Parcela {p.cycleNumber}/{projectedPayments.length}
                        </span>
                        <span className="text-[10px] text-text-secondary font-medium italic">
                          {cycleDays} dias
                        </span>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between text-text-secondary text-[11px]">
                          <span>Período:</span>
                          <span className="font-semibold text-text-primary">
                            {isoToBR(p.startDate)} a {isoToBR(p.endDate)}
                          </span>
                        </div>
                        {parcelAmount > 0 && (
                          <div className="flex justify-between text-text-secondary text-[11px]">
                            <span>Valor Previsto:</span>
                            <span className="font-bold text-text-primary">
                              {formatCurrencyBR(parcelAmount)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-border-subtle/10 pt-1.5 mt-1.5">
                          <span className="text-[10px] font-bold text-text-secondary uppercase">
                            Projeção de Pgto:
                          </span>
                          <span className="text-[11px] font-extrabold text-emerald-500 dark:text-emerald-400">
                            {isoToBR(p.suggestedPaymentDate)} (Terça)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl text-[10.5px] font-medium text-text-secondary leading-relaxed flex gap-2">
                <span className="shrink-0 text-amber-500">⚠️</span>
                <span>
                  <strong>Aviso Importante:</strong> Data sugerida, não oficial. O pagamento depende da abertura e aprovação da RC pelo núcleo contratante no ERP de Supply, respeitando os prazos e políticas internas.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 3 — Success Fee (Bônus por Performance)
        ═══════════════════════════════════════════════════════════════ */}
        <div className={sectionCls}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border-subtle pb-3 gap-4">
            <div>
              <h3 className="font-bold text-action-cyan text-xs uppercase tracking-wider flex items-center gap-2">
                <Percent className="w-4 h-4" />
                3. Bônus por Performance (Success Fee)
              </h3>
              <p className="text-xs text-text-secondary mt-1.5">
                Indique se a contratação contempla comissão ou bônus por êxito comercial/performance.
              </p>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={successFeeEnabled}
                  onChange={e => {
                    const val = e.target.checked;
                    setSuccessFeeEnabled(val);
                    syncRateFromBudget(budget, remunerationModel, val, successFeeType, successFeeFixedAmount, successFeePercent, days, projectedPayments.length, expectedHours);
                  }}
                  className="w-4 h-4 rounded text-action-cyan border-border-subtle focus:ring-action-cyan"
                />
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wide">Habilitar Bônus por Performance (Success Fee)</span>
              </label>
              <div className="relative group ml-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-text-muted hover:text-action-cyan transition-colors cursor-help" />
                <div className="absolute bottom-full right-0 mb-2 w-72 p-3 rounded-xl bg-[#0a1628] border border-action-cyan/30 text-white text-[11px] leading-relaxed shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                  <strong className="text-action-cyan block mb-1">💰 Success Fee (Bônus)</strong>
                  <span className="text-slate-300">
                    Cria um <strong className="text-white">valor financeiro adicional</strong> condicionado ao atingimento de um gatilho mensurável (ex: vitória na concorrência, KPI de projeto, meta de entrega).
                    <span className="block mt-1.5 text-slate-400 italic">O bônus só é pago se o resultado for marcado como &quot;Atingido&quot;. Pode ser valor fixo ou percentual sobre o fee-base.</span>
                  </span>
                  <div className="absolute top-full right-1.5 w-2 h-2 bg-[#0a1628] border-r border-b border-action-cyan/30 rotate-45 -mt-1"></div>
                </div>
              </div>
            </div>
          </div>

          {successFeeEnabled && (
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-border-subtle rounded-xl p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className={labelCls}>Tipo de Remuneração *</label>
                  <select
                    value={successFeeType}
                    onChange={e => {
                      const newType = e.target.value as 'fixed' | 'percentage';
                      setSuccessFeeType(newType);
                      syncRateFromBudget(budget, remunerationModel, successFeeEnabled, newType, successFeeFixedAmount, successFeePercent, days, projectedPayments.length, expectedHours);
                    }}
                    className={selectCls}
                  >
                    <option value="fixed">Valor Fixo</option>
                    <option value="percentage">Percentual (%)</option>
                  </select>
                </div>

                {successFeeType === 'fixed' ? (
                  <div>
                    <label className={labelCls}>
                      Valor Fixo Sugerido (R$) *
                      {(isEditingRate || isEditingBudget) && (
                        <span className="ml-2 text-[10px] font-extrabold text-action-cyan uppercase tracking-wider animate-pulse">
                          (Atualizando...)
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-text-secondary select-none">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={successFeeFixedAmountVisual}
                        onChange={handleSuccessFeeFixedAmountChange}
                        onFocus={() => setIsEditingSuccessFee(true)}
                        onBlur={() => {
                          handleSuccessFeeFixedAmountBlur();
                          setIsEditingSuccessFee(false);
                        }}
                        className={`${inputCls} pl-9 font-semibold transition-all duration-300 ${isEditingRate || isEditingBudget
                          ? 'border-action-cyan ring-2 ring-action-cyan/40 shadow-[0_0_12px_rgba(6,182,212,0.25)] bg-action-cyan/5 dark:bg-action-cyan/10'
                          : ''
                          }`}
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className={labelCls}>
                        Percentual Sugerido (%) *
                        {(isEditingRate || isEditingBudget) && (
                          <span className="ml-2 text-[10px] font-extrabold text-action-cyan uppercase tracking-wider animate-pulse">
                            (Atualizando...)
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="Ex: 5.0"
                        value={successFeePercent || ''}
                        onChange={e => {
                          const newPercent = Number(e.target.value);
                          setSuccessFeePercent(newPercent);
                          syncRateFromBudget(budget, remunerationModel, successFeeEnabled, successFeeType, successFeeFixedAmount, newPercent, days, projectedPayments.length, expectedHours);
                        }}
                        onFocus={() => setIsEditingSuccessFee(true)}
                        onBlur={() => setIsEditingSuccessFee(false)}
                        className={`${inputCls} transition-all duration-300 ${isEditingRate || isEditingBudget
                          ? 'border-action-cyan ring-2 ring-action-cyan/40 shadow-[0_0_12px_rgba(6,182,212,0.25)] bg-action-cyan/5 dark:bg-action-cyan/10'
                          : ''
                          }`}
                        required
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Base de Cálculo *</label>
                      <input
                        type="text"
                        placeholder="Ex: Margem bruta do projeto"
                        value={successFeeBase}
                        onChange={e => setSuccessFeeBase(e.target.value)}
                        className={inputCls}
                        required
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>Gatilho de Elegibilidade (Trigger) *</label>
                  <input
                    type="text"
                    value={successFeeTrigger}
                    onChange={e => setSuccessFeeTrigger(e.target.value)}
                    className={inputCls}
                    placeholder="Ex: vitória da V3A na concorrência"
                    required
                  />
                </div>
                <div className="flex items-end pb-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={successFeeRequiresApproval}
                      onChange={e => setSuccessFeeRequiresApproval(e.target.checked)}
                      className="w-4 h-4 rounded text-action-cyan border-border-subtle focus:ring-action-cyan"
                    />
                    <span className="text-xs font-bold text-text-secondary uppercase tracking-wide">Exige aprovação extraordinária do Head</span>
                  </label>
                </div>
              </div>

              <div>
                <label className={labelCls}>Condições Complementares & Observações</label>
                <textarea
                  rows={3}
                  placeholder="Especifique os critérios e métricas adicionais para pagamento deste bônus..."
                  value={successFeeTerms}
                  onChange={e => setSuccessFeeTerms(e.target.value)}
                  className={inputCls + ' resize-y'}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Policy reference card ── */}
        {(() => {
          const dailyPolicyForFixedJob = db.policies.find((p: any) =>
            p.role === roleNeeded &&
            p.seniority === seniorityNeeded &&
            (['Diária', 'daily'].includes(p.billingType) || p.remunerationModel === 'daily')
          );
          const dailyReferenceUnit = dailyPolicyForFixedJob ? Number(dailyPolicyForFixedJob.referenceValue) : 0;
          const dailyCeilingUnit = dailyPolicyForFixedJob ? Number(dailyPolicyForFixedJob.ceilingValue) : 0;

          const proposedVal = oneTimeRate;
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
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
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

                    {/* Card 3: Teto authorized total */}
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
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-extrabold ${policyStatus === 'within_policy' && !isSuccessFeeAbovePolicy
                          ? 'forecast-status-within'
                          : (policyStatus === 'above_policy_requires_approval' || isSuccessFeeAbovePolicy)
                            ? 'forecast-status-above'
                            : 'bg-amber-500/20 text-amber-400'
                          }`}>
                          {policyStatus === 'within_policy' && !isSuccessFeeAbovePolicy ? 'Dentro da política' :
                            (policyStatus === 'above_policy_requires_approval' || isSuccessFeeAbovePolicy) ? 'Acima da política' : 'Política não cadastrada'}
                        </span>
                      </div>
                    </div>

                    {/* Card 5: Success Fee Máximo */}
                    {successFeeEnabled && (
                      <div className="policy-metric-bg p-3 rounded-xl border">
                        <span className="text-[10px] text-text-secondary block font-bold uppercase tracking-wider mb-0.5">
                          {successFeeType === 'percentage' ? 'Teto Success Fee (Política)' : 'SF Calculado vs Teto'}
                        </span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm block">
                          {matchingSuccessFeePolicy?.successFeeMaxPercent
                            ? (successFeeType === 'percentage'
                              ? `${matchingSuccessFeePolicy.successFeeMaxPercent}%`
                              : `${currentSuccessFeePercent.toFixed(1)}% (Teto ${matchingSuccessFeePolicy.successFeeMaxPercent}%)`)
                            : 'Não definido'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Alerta de excedente */}
                  {policyStatus === 'above_policy_requires_approval' && policyResult && policyResult.excessAmount > 0 && (
                    <div className="policy-warning-bg p-3.5 rounded-xl text-xs font-semibold border">
                      ⚠️ Excedente: {formatCurrencyBR(policyResult.excessAmount)} — {policyResult.excessPercent.toFixed(1)}% acima do teto. Será necessário solicitar aprovação do Head do Núcleo.
                    </div>
                  )}

                  {isSuccessFeeAbovePolicy && matchingSuccessFeePolicy && (
                    <div className="policy-warning-bg p-3.5 rounded-xl text-xs font-semibold border mt-2">
                      {successFeeType === 'percentage' ? (
                        <span>⚠️ Success Fee Excedente: O percentual de {successFeePercent}% está acima do teto de {matchingSuccessFeePolicy.successFeeMaxPercent}% estabelecido para esta função/senioridade. Será necessário solicitar aprovação do Head do Núcleo.</span>
                      ) : (
                        <span>⚠️ Success Fee Excedente: O valor de Success Fee equivale a {currentSuccessFeePercent.toFixed(1)}% do budget, ultrapassando o teto de {matchingSuccessFeePolicy.successFeeMaxPercent}% estabelecido para esta função/senioridade. Será necessário solicitar aprovação do Head do Núcleo.</span>
                      )}
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
        <div className="forecast-card rounded-xl p-5 bg-slate-50/50 dark:bg-slate-900/30 border border-border-subtle">
          <p className="forecast-title text-[10px] font-bold uppercase tracking-wider mb-4">Resumo da Previsão</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Budget */}
            <div>
              <span className="text-[10px] text-text-secondary block mb-1">Budget do Job</span>
              <span className="font-extrabold text-base">{formatCurrencyBR(budget)}</span>
            </div>

            {/* Total previsto */}
            <div>
              <span className="text-[10px] text-text-secondary block mb-1">Custo Base Previsto (Freela)</span>
              <span className={`font-extrabold text-base ${expectedTotalCompensation > 0 && expectedTotalCompensation > budget
                ? 'forecast-value-negative' : 'forecast-value-positive'
                }`}>
                {expectedTotalCompensation > 0 ? formatCurrencyBR(expectedTotalCompensation) : '—'}
              </span>
            </div>

            {/* Success Fee Potencial */}
            <div>
              <span className="text-[10px] text-text-secondary block mb-1">Success Fee Potencial</span>
              <span className="font-extrabold text-base text-action-cyan">
                {successFeeEnabled
                  ? (successFeeType === 'fixed'
                    ? `${formatCurrencyBR(successFeeFixedAmount)} (Fixo)`
                    : `${successFeePercent}% sobre ${successFeeBase}`)
                  : 'Nenhum'
                }
              </span>
            </div>
          </div>

          {successFeeEnabled && isCompetitiveBid && (
            <p className="text-[11px] text-action-cyan mt-4 font-semibold border-t border-border-subtle pt-3">
              💡 Este job será marcado em concorrência. O status inicial será &quot;Aguardando Resultado de Concorrência&quot;. O success fee só se tornará elegível após a confirmação de vitória.
            </p>
          )}
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
