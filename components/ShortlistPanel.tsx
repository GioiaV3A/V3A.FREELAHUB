'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DatabaseProps } from '@/app/page';
import { generateUniqueId } from '@/lib/utils';
import { Job, Shortlist, Freelancer, ValuePolicy, Allocation, PaymentCode } from '@/lib/mockData';
import { createApprovalRequestAction, decideApprovalAction } from '@/app/actions/evaluation';
import { confirmOfficialShortlistAction } from '@/app/actions/proposalActions';
import { supabase } from '@/lib/supabase';
import ConsolidatedAllocation from '@/components/ConsolidatedAllocation';
import { confirmAllocationAction } from '@/app/actions/admin';
import { 
  calculateAllocationDays, 
  calculateNegotiatedTotal, 
  calculateBudgetSaving, 
  getBudgetDeltaStatus,
  formatCurrencyBRL,
  formatCurrencyBR,
  parseCurrencyBR,
  maskCurrencyBRL,
  formatPercentage,
  calculatePolicyLimitForJob,
  calculateMonthlyPaymentSchedule,
  simulatePaymentProjections,
  getDominantMonthLabel
} from '@/lib/financial';
import NegotiationFinancialSummary from '@/components/NegotiationFinancialSummary';
import { 
  Briefcase, 
  Users, 
  Scale, 
  ArrowRight, 
  HelpCircle, 
  FileWarning, 
  CheckCircle, 
  Clock,  
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Calendar, 
  Lock, 
  Unlock, 
  Star,
  RefreshCw,
  Loader2,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  SlidersHorizontal,
  Grid,
  List,
  Check,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  AlertCircle,
  FileCheck,
  Award
} from 'lucide-react';
import ScoreStars from '@/components/ScoreStars';
import { useSortableTable } from '@/hooks/useSortableTable';
import { SortableHeader } from '@/components/SortableHeader';
import { ResponsiveDataTable, Column } from './ResponsiveDataTable';

/** Timezone-safe ISO date → dd/mm/yyyy formatter (avoids new Date(iso) UTC shift) */
const isoToBR = (isoStr?: string | null): string => {
  if (!isoStr) return 'A definir';
  const parts = isoStr.split('T')[0].split('-');
  if (parts.length === 3) return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
  return isoStr;
};

const SENIORITY_RANK: Record<string, number> = {
  'Júnior': 1,
  'Pleno': 2,
  'Sênior': 3,
  'Especialista': 4
};

const normalizeFunctionName = (value: string): string => {
  if (!value) return '';
  let normalized = value.trim().toLowerCase();
  
  // Remover acentos e caracteres especiais
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Remover pontuações comuns
  normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');

  // Aliases conhecidos
  const aliases: Record<string, string[]> = {
    'diretor de arte': ['diretor de arte', 'diretor de artes', 'direcao de arte', 'direção de arte', 'art director', 'art directors', 'diretor de criacao', 'diretora de arte', 'diretora de artes'],
    'designer 3d': ['designer 3d', '3d designer', 'modelador 3d', 'artista 3d', '3d artist'],
    'produtor executivo': ['produtor executivo', 'producao executiva', 'produção executiva', 'produtora executiva', 'executive producer'],
    'planejamento': ['planejamento', 'planner', 'planner estrategico', 'estrategista', 'planejamento estrategico', 'diretor de planejamento']
  };

  for (const [key, list] of Object.entries(aliases)) {
    const listNormalized = list.map(item => item.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    if (listNormalized.includes(normalized) || normalized.includes(key)) {
      return key;
    }
  }

  // Singularização básica
  if (normalized.endsWith('s') && !normalized.endsWith('iss') && normalized.length > 3) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
};

const areRolesRelated = (r1: string, r2: string): boolean => {
  const norm1 = normalizeFunctionName(r1);
  const norm2 = normalizeFunctionName(r2);
  if (norm1 === norm2) return true;

  const designRoles = ['diretor de arte', 'designer 3d', 'designer', 'designer grafico', 'art director', 'art directors', 'direcao de arte', 'direção de arte', 'motion designer', 'finalizador'];
  const productionRoles = ['produtor executivo', 'producao executiva', 'produção executiva', 'produtor', 'produtor de campo', 'coordenador de producao', 'diretor de producao'];
  const planningRoles = ['planejamento', 'planner', 'estrategista', 'diretor de planejamento', 'redator', 'copywriter', 'criativo'];

  if (designRoles.includes(norm1) && designRoles.includes(norm2)) return true;
  if (productionRoles.includes(norm1) && productionRoles.includes(norm2)) return true;
  if (planningRoles.includes(norm1) && planningRoles.includes(norm2)) return true;

  return false;
};

function JobDescriptionFormatted({ description }: { description: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!description) return null;

  const lines = description.split('\n');

  return (
    <div className="w-full mt-2 pt-2 border-t border-slate-700/70">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Descrição Técnico-Operacional</span>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[11px] font-bold text-action-cyan hover:underline flex items-center gap-1 cursor-pointer select-none"
        >
          {isExpanded ? (
            <span className="flex items-center gap-1"><span>Contrair escopo</span> <ChevronUp className="w-3.5 h-3.5" /></span>
          ) : (
            <span className="flex items-center gap-1"><span>Expandir escopo</span> <ChevronDown className="w-3.5 h-3.5" /></span>
          )}
        </button>
      </div>

      <div className={`mt-1.5 text-xs text-slate-300 leading-relaxed font-sans transition-all duration-300 ${!isExpanded ? 'max-h-16 overflow-hidden relative' : ''}`}>
        {!isExpanded && (
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-800 to-transparent pointer-events-none" />
        )}
        
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1" />;
          
          if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
            const content = trimmed.replace(/^[•-]\s*/, '');
            const isHeader = content === content.toUpperCase() && content.length > 5;
            if (isHeader) {
              return (
                <h5 key={idx} className="font-extrabold text-action-cyan text-[11px] mt-2 mb-0.5 flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-action-cyan inline-block" />
                  <span>{content}</span>
                </h5>
              );
            }
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-2 my-0.5">
                <span className="text-action-cyan font-bold">•</span>
                <span>{content}</span>
              </div>
            );
          }

          if (trimmed.endsWith(':') && trimmed.length < 50) {
            return (
              <h5 key={idx} className="font-extrabold text-action-cyan text-[11px] mt-2 mb-0.5 uppercase tracking-wide">
                {trimmed}
              </h5>
            );
          }

          return <p key={idx} className="my-0.5">{trimmed}</p>;
        })}
      </div>
    </div>
  );
}

export default function ShortlistPanel({ db }: { db: DatabaseProps }) {
  // Navigation / Stepper State
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedJobIdLocal, setSelectedJobIdLocal] = useState(db.selectedJobId || '');
  const activeJob = db.jobs.find(j => j.id === selectedJobIdLocal);
  const [negotiatingFreelancerId, setNegotiatingFreelancerId] = useState<string>('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [compareSortKey, setCompareSortKey] = useState<'default' | 'saving' | 'total' | 'status' | 'score'>('default');
  const [isDispatchingEmails, setIsDispatchingEmails] = useState(false);

  const handleConfirmShortlistAndDispatchProposals = async () => {
    if (!activeJob || jobShortlists.length === 0) return;
    setIsDispatchingEmails(true);
    try {
      const selectedFreelas = jobShortlists.map(s => {
        const f = db.freelancers.find(fl => fl.id === s.freelancerId);
        return {
          id: s.freelancerId,
          name: f?.name || 'Profissional',
          email: f?.email || '',
        };
      });

      const res = await confirmOfficialShortlistAction({
        jobId: activeJob.id,
        jobCode: activeJob.job_code || activeJob.jobCode || '26-0000-001',
        jobTitle: activeJob.name || activeJob.title || 'Oportunidade V3A',
        clientName: activeJob.client || activeJob.clientName || 'V3A',
        nucleoId: activeJob.nucleoId,
        roleName: activeJob.roleNeeded,
        seniority: activeJob.seniorityNeeded,
        startDate: activeJob.startDate,
        endDate: activeJob.endDate,
        remunerationModel: activeJob.remunerationModel,
        baseValue: activeJob.budget,
        selectedFreelancerIds: jobShortlists.map(s => s.freelancerId),
        userId: db.currentUser.id,
        freelancersMetadata: selectedFreelas,
      });

      if (res.success) {
        const failedEmails = res.results?.filter((r: any) => !r.emailSent) || [];
        if (failedEmails.length > 0) {
          alert(`⚠️ Shortlist confirmada no sistema, MAS o envio de e-mail falhou!\n\nMotivo: ${failedEmails[0].emailError}\n\nNota: Se for erro "Username and Password not accepted", o Google bloqueou o SMTP. Você precisa gerar uma "Senha de App" (App Password) na conta freelahub@v3a.ag.`);
        } else {
          alert(`Shortlist Oficial confirmada! ${res.count} proposta(s) disparada(s) por e-mail com link público seguro.`);
        }
      } else {
        alert(`Aviso ao enviar propostas: ${res.error || 'Verifique o ambiente.'}`);
      }
    } catch (err: any) {
      console.error('Error dispatching proposals:', err);
      alert(`Erro ao disparar propostas: ${err?.message || 'Erro de comunicação.'}`);
    } finally {
      setIsDispatchingEmails(false);
      handleNavigateStep(3);
    }
  };

  // Faturamento & Success Fee configuration states per candidate
  const [candidateNegotiations, setCandidateNegotiations] = useState<Record<string, {
    paymentModel: 'one_time' | 'monthly_recurring' | 'milestone';
    contractStartDate: string;
    contractEndDate: string;
    recurringAmount: number;
    recurringAmountVisual: string;
    preferredDueDay: number;
    paymentTerms: string;
    paymentNotes: string;
    // Success Fee Fields
    successFeeEnabled: boolean;
    successFeeType: 'fixed' | 'percentage';
    successFeeFixedAmount: number;
    successFeeFixedAmountVisual: string;
    successFeePercent: number;
    successFeeBase: string;
    successFeeTrigger: string;
    successFeeRequiresApproval: boolean;
    successFeeTerms: string;
    acceptedByFreelancer: boolean;
  }>>({});

  const [excludedDates, setExcludedDates] = useState<Record<string, string[]>>({});
  const [visualRates, setVisualRates] = useState<Record<string, string>>({});

  // Build the default negotiation state for a candidate, preferring data saved in the shortlist
  const getCandidateNeg = (freelancerId: string, sl?: any) => {
    if (candidateNegotiations[freelancerId]) {
      return candidateNegotiations[freelancerId];
    }

    const jobModel = activeJob?.remunerationModel || 'daily';
    const isMonthly = (jobModel as string) === 'monthly_salary' || (jobModel as string) === 'monthly' || activeJob?.paymentFlow === 'recurring';
    
    // Prefer saved shortlist values over job defaults
    const savedModel = sl?.paymentModel as 'one_time' | 'monthly_recurring' | 'milestone' | undefined;
    const defaultModel = savedModel || (isMonthly ? 'monthly_recurring' : 'one_time');
    const defaultStart = sl?.contractStartDate || activeJob?.startDate || '';
    const defaultEnd = sl?.contractEndDate || activeJob?.endDate || '';
    const defaultDue = sl?.preferredDueDay || activeJob?.expectedPaymentDay || 5;

    let defaultRate = sl?.negotiatedRate || 0;
    if (!defaultRate && activeJob) {
      if (isMonthly) {
        if (activeJob.expectedRate && activeJob.expectedRate > 0) {
          defaultRate = activeJob.expectedRate;
        } else {
          const projections = simulatePaymentProjections(activeJob.startDate, activeJob.endDate, 'monthly_salary');
          if (projections.length > 0 && activeJob.budget > 0) {
            defaultRate = Math.round((activeJob.budget / projections.length) * 100) / 100;
          } else {
            defaultRate = activeJob.budget;
          }
        }
      } else {
        defaultRate = activeJob.expectedRate || activeJob.budget;
      }
    }

    // Success fee defaults from Job Creation
    const jobSuccessFeeEnabled = activeJob?.success_fee_enabled || false;
    const jobRule = db.jobSuccessFeeRules?.find(r => (r.jobId === activeJob?.id || r.jobId === activeJob?.jobId) && r.isActive !== false);
    const jobBudget = activeJob?.budget || 0;

    let initialType: 'percentage' | 'fixed' = 'percentage';
    let maxPercent = 0;
    let maxFixed = 0;

    if (jobRule) {
      initialType = (jobRule.feeType as 'percentage' | 'fixed') || 'percentage';
      if (jobRule.feeType === 'fixed' && jobRule.fixedAmount) {
        maxFixed = jobRule.fixedAmount;
        maxPercent = jobBudget > 0 ? (jobRule.fixedAmount / jobBudget) * 100 : 0;
      } else if (jobRule.feeType === 'percentage' && jobRule.percentageRate) {
        maxPercent = jobRule.percentageRate;
        maxFixed = (jobBudget * jobRule.percentageRate) / 100;
      }
    } else if (activeJob) {
      const sfType = (activeJob as any).successFeeType || (activeJob as any).success_fee_type || 'percentage';
      const sfFixed = (activeJob as any).successFeeFixedAmount || (activeJob as any).success_fee_fixed_amount || 0;
      const sfPercent = (activeJob as any).successFeePercent || (activeJob as any).success_fee_percent || 0;

      initialType = sfType === 'fixed' ? 'fixed' : 'percentage';
      if (sfType === 'fixed' && sfFixed > 0) {
        maxFixed = sfFixed;
        maxPercent = jobBudget > 0 ? (sfFixed / jobBudget) * 100 : 0;
      } else if (sfPercent > 0) {
        maxPercent = sfPercent;
        maxFixed = (jobBudget * sfPercent) / 100;
      }
    }

    if (!maxPercent && maxFixed > 0 && jobBudget > 0) {
      maxPercent = (maxFixed / jobBudget) * 100;
    }
    if (!maxFixed && maxPercent > 0 && jobBudget > 0) {
      maxFixed = (jobBudget * maxPercent) / 100;
    }
    if (!maxPercent && maxFixed === 0) maxPercent = 8;
    if (!maxFixed && jobBudget > 0) maxFixed = (jobBudget * maxPercent) / 100;

    const rawTrigger = jobRule?.triggerType || (activeJob as any)?.successFeeTrigger || 'v3a_wins_bid';
    const friendlyTrigger = rawTrigger === 'v3a_wins_bid' ? 'V3A ganhar a concorrência' : rawTrigger === 'project_delivery' ? 'Entrega do projeto no prazo' : rawTrigger;

    const selectedType = sl?.successFeeType || initialType;
    const defaultFixedAmt = Math.min(sl?.successFeeFixedAmount || maxFixed, maxFixed || 999999);
    const defaultPercentAmt = Math.min(sl?.successFeePercent || maxPercent, maxPercent || 100);

    return {
      paymentModel: defaultModel as 'one_time' | 'monthly_recurring' | 'milestone',
      contractStartDate: defaultStart,
      contractEndDate: defaultEnd,
      recurringAmount: defaultRate,
      recurringAmountVisual: defaultRate > 0 ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(defaultRate) : '',
      preferredDueDay: defaultDue,
      paymentTerms: sl?.paymentTerms || '',
      paymentNotes: sl?.paymentNotes || '',
      // Success fee defaults
      successFeeEnabled: sl?.successFeeEnabled ?? jobSuccessFeeEnabled,
      successFeeType: selectedType,
      successFeeFixedAmount: defaultFixedAmt,
      successFeeFixedAmountVisual: defaultFixedAmt > 0 ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(defaultFixedAmt) : '',
      successFeePercent: defaultPercentAmt,
      successFeeBase: 'sobre o budget',
      successFeeTrigger: sl?.successFeeTrigger || friendlyTrigger,
      successFeeRequiresApproval: sl?.successFeeRequiresApproval ?? (jobRule?.requiresApproval ?? true),
      successFeeTerms: sl?.successFeeTerms || jobRule?.terms || '',
      acceptedByFreelancer: sl?.acceptedByFreelancer ?? false,
    };
  };

  const updateCandidateNeg = (freelancerId: string, updates: Partial<{
    paymentModel: 'one_time' | 'monthly_recurring' | 'milestone';
    contractStartDate: string;
    contractEndDate: string;
    recurringAmount: number;
    recurringAmountVisual: string;
    preferredDueDay: number;
    paymentTerms: string;
    paymentNotes: string;
    // Success Fee
    successFeeEnabled: boolean;
    successFeeType: 'fixed' | 'percentage';
    successFeeFixedAmount: number;
    successFeeFixedAmountVisual: string;
    successFeePercent: number;
    successFeeBase: string;
    successFeeTrigger: string;
    successFeeRequiresApproval: boolean;
    successFeeTerms: string;
    acceptedByFreelancer: boolean;
  }>) => {
    setCandidateNegotiations(prev => {
      const current = prev[freelancerId] || getCandidateNeg(freelancerId);
      return {
        ...prev,
        [freelancerId]: {
          ...current,
          ...updates
        }
      };
    });
  };

  const toggleExcludedDate = (freelancerId: string, dateStr: string) => {
    setExcludedDates(prev => {
      const current = prev[freelancerId] || [];
      const updated = current.includes(dateStr)
        ? current.filter(d => d !== dateStr)
        : [...current, dateStr];
      return {
        ...prev,
        [freelancerId]: updated
      };
    });
  };

  // State for Custom Approval Modal
  const [approvalModal, setApprovalModal] = useState<{
    isOpen: boolean;
    slId: string;
    freelancerId: string;
    type: 'value_exception' | 'schedule_conflict';
    currentRate?: number;
    reason: string;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    slId: '',
    freelancerId: '',
    type: 'schedule_conflict',
    reason: '',
    loading: false,
    error: null
  });

  // State for Head Decision Modal
  const [headDecisionModal, setHeadDecisionModal] = useState<{
    isOpen: boolean;
    approvalId: string;
    freelancerName: string;
    decision: 'approve' | 'reject';
    comment: string;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    approvalId: '',
    freelancerName: '',
    decision: 'approve',
    comment: '',
    loading: false,
    error: null
  });

  // State for Toast Notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Sync selected job state if db changes natively (e.g. from outer tabs selection)
  const [prevSelectedId, setPrevSelectedId] = useState(db.selectedJobId);
  if (db.selectedJobId !== prevSelectedId) {
    setPrevSelectedId(db.selectedJobId);
    setSelectedJobIdLocal(db.selectedJobId || '');
    if (db.selectedJobId) {
      setActiveStep(2); // Auto advance to Step 2 when job is chosen outside
    } else {
      setActiveStep(1);
    }
  }

  // Always scroll to top of page/viewport when ShortlistPanel mounts or step changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const container = document.getElementById('main-scroll-container');
      if (container) container.scrollTop = 0;
      window.scrollTo(0, 0);
    }
  }, [activeStep]);

  // --- JOB SEARCH & FILTERS STATE (Step 1) ---
  const [jobSearch, setJobSearch] = useState('');
  const [jobTabFilter, setJobTabFilter] = useState<'ativas' | 'bookadas' | 'encerradas' | 'todas'>('ativas');
  const [jobRoleFilter, setJobRoleFilter] = useState('');
  const [jobSeniorityFilter, setJobSeniorityFilter] = useState('');
  const [jobUrgencyFilter, setJobUrgencyFilter] = useState('');
  const [jobBudgetMin, setJobBudgetMin] = useState('');
  const [jobBudgetMax, setJobBudgetMax] = useState('');
  const [jobStartDateFilter, setJobStartDateFilter] = useState('');
  const [jobEndDateFilter, setJobEndDateFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'table' | 'cards'>('table');

  // (Pagination removed — all jobs shown at once)

  // --- CANDIDATE SEARCH & FILTERS STATE (Step 2) ---

  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateRole, setCandidateRole] = useState('');
  const [candidateSeniority, setCandidateSeniority] = useState('');
  const [candidateMinScore, setCandidateMinScore] = useState<number>(0);
  const [candidateLocation, setCandidateLocation] = useState('');
  const [candidateMaxRate, setCandidateMaxRate] = useState<string>('');
  const [candidateAvailability, setCandidateAvailability] = useState('');
  const [candidateV3aExp, setCandidateV3aExp] = useState<boolean | null>(null);
  const [candidateBrands, setCandidateBrands] = useState('');
  const [showCandidateFilters, setShowCandidateFilters] = useState(false);

  // Smart matching filters
  const [requireExactRole, setRequireExactRole] = useState(false);
  const [requireExactSeniority, setRequireExactSeniority] = useState(false);
  const [showBelowSeniority, setShowBelowSeniority] = useState(true);
  const [showAboveBudget, setShowAboveBudget] = useState(true);

  // Collapse / Expand Match Groups in Step 2
  const [expandBestMatches, setExpandBestMatches] = useState(true);
  const [expandGoodMatches, setExpandGoodMatches] = useState(true);
  const [expandOtherMatches, setExpandOtherMatches] = useState(false);

  // Auto-sync candidate filters when active job changes
  const [prevActiveJobId, setPrevActiveJobId] = useState<string | null>(null);
  if (activeJob && activeJob.id !== prevActiveJobId) {
    setPrevActiveJobId(activeJob.id);
    setCandidateRole(activeJob.roleNeeded || '');
    setCandidateSeniority(activeJob.seniorityNeeded || '');
    setCandidateSearch('');
    setCandidateMinScore(0);
    setCandidateLocation('');
    setCandidateMaxRate('');
    setCandidateAvailability('');
    setCandidateV3aExp(null);
    setCandidateBrands('');
    setRequireExactRole(false);
    setRequireExactSeniority(false);
    setShowBelowSeniority(true);
    setShowAboveBudget(true);
    // If the job has an active allocation, pre-select that freelancer for Negotiation pane
    if (activeJob.selectedFreelancerId) {
      setNegotiatingFreelancerId(activeJob.selectedFreelancerId);
    } else {
      setNegotiatingFreelancerId('');
    }
    // Re-initialize candidateNegotiations from saved shortlist data when job changes
    setCandidateNegotiations({});
    setExcludedDates({});
    setVisualRates({});
  }

  // --- STEP 3: NEGOTIATION FORM INPUTS ---
  const [negotiatedValue, setNegotiatedValue] = useState<number>(0);
  const [billingType, setBillingType] = useState<'Diária' | 'Hora' | 'Job Fechado'>('Diária');
  const [scope, setScope] = useState('');
  const [justification, setJustification] = useState('');

  // Notifications feedback states
  const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});



  // Set default negotiation inputs when selected freelancer changes in Step 3
  useEffect(() => {
    if (negotiatingFreelancerId && activeJob) {
      const fl = db.freelancers.find(f => f.id === negotiatingFreelancerId);
      if (fl) {
        setNegotiatedValue(fl.referenceValue);
      }
      setScope('');
      setJustification('');
    }
  }, [negotiatingFreelancerId]);

  // --- CALCULATIONS ---
  const calculateDailyAverage = (job: Job) => {
    if (!job.startDate || !job.endDate) return job.budget;
    const start = new Date(job.startDate);
    const end = new Date(job.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return job.budget;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? job.budget / diffDays : job.budget;
  };

  const getInstallmentsList = (startDateStr: string, endDateStr: string, preferredDueDay: number, recurringAmount: number) => {
    const list: Array<{
      installment_number: number;
      reference_period: string;
      due_date: string;
      due_date_formatted: string;
      amount: number;
    }> = [];
    if (!startDateStr || !endDateStr) return list;
    
    const start = new Date(startDateStr + 'T12:00:00');
    const end = new Date(endDateStr + 'T12:00:00');
    
    let currentStart = new Date(start);
    let installmentNum = 1;
    
    while (currentStart < end) {
      let idealEnd = new Date(currentStart);
      idealEnd.setMonth(idealEnd.getMonth() + 1);
      idealEnd.setDate(idealEnd.getDate() - 1);
      
      let currentEnd = new Date(idealEnd);
      if (currentEnd > end) {
        currentEnd = new Date(end);
      }
      
      let nextMonthDate = new Date(currentEnd);
      nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
      
      let dueDay = preferredDueDay;
      let tempDue = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), dueDay, 12, 0, 0);
      if (tempDue.getMonth() !== nextMonthDate.getMonth()) {
        tempDue = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1, 0, 12, 0, 0);
      }
      
      const pad = (n: number) => String(n).padStart(2, '0');
      const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      
      const refLabel = currentStart.getMonth() === currentEnd.getMonth()
        ? currentStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        : `${currentStart.toLocaleDateString('pt-BR', { month: 'short' })} a ${currentEnd.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`;
        
      list.push({
        installment_number: installmentNum++,
        reference_period: refLabel.charAt(0).toUpperCase() + refLabel.slice(1),
        due_date: formatDate(tempDue),
        due_date_formatted: tempDue.toLocaleDateString('pt-BR'),
        amount: recurringAmount
      });
      
      let nextStart = new Date(currentEnd);
      nextStart.setDate(nextStart.getDate() + 1);
      currentStart = nextStart;
    }
    return list;
  };

  const hasScheduleConflict = (freelancerId: string, startDate: string, endDate: string) => {
    if (!startDate || !endDate) return false;
    const start = new Date(startDate);
    const end = new Date(endDate);

    return db.allocations.some(alloc => {
      if (alloc.freelancerId !== freelancerId) return false;
      if (alloc.status === 'Cancelado') return false;
      if (alloc.jobId === selectedJobIdLocal) return false; // ignore current job

      if (!alloc.startDate || !alloc.endDate) return false;
      const allocStart = new Date(alloc.startDate);
      const allocEnd = new Date(alloc.endDate);

      return start <= allocEnd && end >= allocStart;
    });
  };

  // --- JOB FILTERING AND ROLE ISOLATION ---
  const filteredJobs = db.jobs.filter(job => {
    // 1. Role-based Isolation: NÚCLEO profile can only see their own nucleo's jobs
    if (db.currentUser.profile === 'NÚCLEO' && job.nucleoId !== db.currentUser.nucleoId) {
      return false;
    }

    // 2. Tab Filter
    const isActiveStatus = ['Oportunidade criada', 'Em shortlist', 'Em negociação', 'Aguardando RH'].includes(job.status);
    const isBookedStatus = ['Bookado', 'Em andamento', 'Concluído', 'Avaliação pendente'].includes(job.status);
    const isClosedStatus = ['Encerrado'].includes(job.status);

    if (jobTabFilter === 'ativas' && !isActiveStatus) return false;
    if (jobTabFilter === 'bookadas' && !isBookedStatus) return false;
    if (jobTabFilter === 'encerradas' && !isClosedStatus) return false;

    // 3. Search input
    if (jobSearch) {
      const q = jobSearch.toLowerCase();
      const nucleoName = db.nucleos.find(n => n.id === job.nucleoId)?.name.toLowerCase() || '';
      const match = 
        job.name.toLowerCase().includes(q) ||
        job.client.toLowerCase().includes(q) ||
        nucleoName.includes(q) ||
        job.roleNeeded.toLowerCase().includes(q) ||
        job.id.toLowerCase().includes(q);
      if (!match) return false;
    }

    // 4. Advanced Filters
    if (jobRoleFilter && job.roleNeeded !== jobRoleFilter) return false;
    if (jobSeniorityFilter && job.seniorityNeeded !== jobSeniorityFilter) return false;
    if (jobUrgencyFilter && job.urgency !== jobUrgencyFilter) return false;
    if (jobBudgetMin && job.budget < Number(jobBudgetMin)) return false;
    if (jobBudgetMax && job.budget > Number(jobBudgetMax)) return false;
    if (jobStartDateFilter && job.startDate < jobStartDateFilter) return false;
    if (jobEndDateFilter && job.endDate > jobEndDateFilter) return false;

    return true;
  });

  // Sorting
  const jobsWithDetails = useMemo(() => {
    return filteredJobs.map(job => {
      const nucleoName = db.nucleos.find(n => n.id === job.nucleoId)?.name || '';
      const shCount = db.shortlists.filter(sl => sl.jobId === job.id).length;
      const dailyAvg = calculateDailyAverage(job);
      return {
        ...job,
        nucleoName,
        shCount,
        dailyAvgValue: dailyAvg,
      };
    });
  }, [filteredJobs, db]);

  const {
    data: sortedJobs,
    sortKey: jobSortKey,
    sortDirection: jobSortDirection,
    requestSort: requestJobSort,
  } = useSortableTable(jobsWithDetails, 'createdAt', 'desc');

  const columns = useMemo<Column<any>[]>(() => [
    {
      key: 'name',
      label: 'Job',
      sortKey: 'name',
      width: '26%',
      render: (job: any) => {
        const code = job.id.slice(0, 8).toUpperCase();
        return (
          <div className="flex flex-col min-w-0">
            <span className="font-mono font-bold text-text-secondary text-xs">{code}</span>
            <span className="font-bold text-sidebar-navy dark:text-text-primary text-sm mt-0.5 hover:underline cursor-pointer" onClick={() => handleSelectJob(job.id)}>
              {job.name}
            </span>
            <span className="text-xs text-text-muted mt-0.5">{job.client}</span>
          </div>
        );
      }
    },
    {
      key: 'nucleo',
      label: 'Núcleo',
      sortKey: 'nucleoName',
      width: '11%',
      render: (job: any) => {
        const nucleo = db.nucleos.find((n: any) => n.id === job.nucleoId);
        return (
          <span className="font-semibold text-text-secondary">
            {nucleo ? nucleo.name : '—'}
          </span>
        );
      }
    },
    {
      key: 'role',
      label: 'Perfil requerido',
      sortKey: 'roleNeeded',
      width: '16%',
      render: (job: any) => (
        <div className="flex flex-col">
          <span className="font-semibold text-text-primary text-sm">{job.roleNeeded}</span>
          <span className="text-xs text-text-secondary mt-0.5 font-medium">{job.seniorityNeeded}</span>
        </div>
      )
    },
    {
      key: 'period',
      label: 'Período',
      sortKey: 'startDate',
      width: '14%',
      render: (job: any) => (
        <span className="text-text-secondary font-medium block">
          {isoToBR(job.startDate)} a {isoToBR(job.endDate)}
        </span>
      )
    },
    {
      key: 'financial',
      label: 'Financeiro',
      sortKey: 'budget',
      width: '11%',
      align: 'right',
      render: (job: any) => {
        const dailyAvg = calculateDailyAverage(job);
        return (
          <div className="flex flex-col text-right">
            <span className="font-bold text-sidebar-navy dark:text-text-primary text-sm">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(job.budget)}
            </span>
            <span className="text-xs text-text-muted mt-0.5">
              Diária: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dailyAvg)}
            </span>
          </div>
        );
      }
    },
    {
      key: 'progress',
      label: 'Andamento',
      sortKey: 'status',
      width: '9%',
      align: 'center',
      render: (job: any) => {
        const shCount = db.shortlists.filter((sl: any) => sl.jobId === job.id).length;
        return (
          <div className="flex flex-col items-center gap-1">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
              job.status === 'Bookado' 
                ? 'bg-success-bg text-success-text border-success-border/40' 
                : job.status === 'Aguardando RH'
                  ? 'bg-warning-bg text-warning-text border-warning-border/40'
                  : job.status === 'Encerrado'
                    ? 'bg-danger-bg text-danger-text border-danger-border/40'
                    : 'bg-info-bg text-info-text border-info-border/40'
            }`}>
              {job.status}
            </span>
            <span className="bg-slate-100 dark:bg-slate-800 text-text-secondary font-bold px-2 py-0.5 rounded-full text-[9px]">
              {shCount} freelas
            </span>
          </div>
        );
      }
    },
    {
      key: 'actions',
      label: 'Ação',
      width: '13%',
      align: 'center',
      render: (job: any) => {
        const isSelected = selectedJobIdLocal === job.id;
        const isBooked = job.status?.toLowerCase() === 'bookado' || job.status?.toLowerCase() === 'booked' || !!job.selectedFreelancerId;
        return (
          <div className="min-w-[105px] w-full px-1">
            <button
              onClick={() => handleSelectJob(job.id)}
              className={`font-bold py-1.5 px-2.5 w-full flex items-center justify-center gap-1.5 rounded-lg text-[10.5px] border transition-all cursor-pointer whitespace-nowrap truncate ${
                isSelected 
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                  : 'bg-primary/10 border-primary/20 hover:bg-action-cyan hover:text-white hover:border-action-cyan text-sidebar-navy dark:text-text-primary'
              }`}
            >
              {isSelected ? (
                <><Check className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" /><span>Selecionado</span></>
              ) : isBooked ? (
                <span>Ver Alocação</span>
              ) : (
                <span>Selecionar</span>
              )}
            </button>
          </div>
        );
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selectedJobIdLocal, db.shortlists]);

  const mobileJobRenderer = (job: any) => {
    const code = job.id.slice(0, 8).toUpperCase();
    const nucleo = db.nucleos.find((n: any) => n.id === job.nucleoId);
    const shCount = db.shortlists.filter((sl: any) => sl.jobId === job.id).length;
    const dailyAvg = calculateDailyAverage(job);
    const isSelected = selectedJobIdLocal === job.id;

    return (
      <div 
        className="rounded-2xl border p-4 space-y-3.5 bg-white dark:bg-bg-card transition-shadow hover:shadow-xs"
        style={{ borderColor: 'var(--border-soft)' }}
      >
        <div className="flex justify-between items-start gap-2">
          <div>
            <h4 
              onClick={() => handleSelectJob(job.id)} 
              className="font-bold text-text-primary text-base hover:underline cursor-pointer"
            >
              {job.name}
            </h4>
            <p className="text-[11px] text-text-secondary mt-0.5 font-medium">{code} • {job.client}</p>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
            job.status === 'Bookado' 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/30' 
              : job.status === 'Aguardando RH'
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-350 dark:border-amber-900/30'
                : job.status === 'Encerrado'
                  ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/30'
                  : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900/30'
          }`}>
            {job.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs border-t pt-3" style={{ borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}>
          <div>
            <p className="font-bold text-[10px] text-text-muted uppercase tracking-wider">Perfil Requerido</p>
            <p className="font-bold text-text-primary mt-0.5">{job.roleNeeded} • {job.seniorityNeeded}</p>
          </div>
          <div>
            <p className="font-bold text-[10px] text-text-muted uppercase tracking-wider">Período</p>
            <p className="font-semibold text-text-primary mt-0.5">
              {isoToBR(job.startDate)} a {isoToBR(job.endDate)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs border-t pt-3" style={{ borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}>
          <div>
            <p className="font-bold text-[10px] text-text-muted uppercase tracking-wider">Núcleo</p>
            <p className="font-semibold text-text-primary mt-0.5">{nucleo ? nucleo.name : '—'}</p>
          </div>
          <div>
            <p className="font-bold text-[10px] text-text-muted uppercase tracking-wider">Shortlist</p>
            <p className="font-semibold text-text-primary mt-0.5">{shCount} freelas alocados</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs border-t pt-3" style={{ borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}>
          <div>
            <p className="font-bold text-[10px] text-text-muted uppercase tracking-wider">Orçamento</p>
            <p className="font-bold text-text-primary mt-0.5">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(job.budget)}
            </p>
          </div>
          <div>
            <p className="font-bold text-[10px] text-text-muted uppercase tracking-wider">Diária Média</p>
            <p className="font-bold text-text-primary mt-0.5">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dailyAvg)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end border-t pt-3" style={{ borderColor: 'var(--border-soft)' }}>
          <button
            onClick={() => handleSelectJob(job.id)}
            className={`font-bold px-4 py-2 rounded-xl text-xs border transition-all cursor-pointer w-full text-center ${
              isSelected 
                ? 'bg-emerald-600 border-emerald-600 text-white' 
                : 'bg-primary/10 border-primary/20 hover:bg-action-cyan hover:text-white hover:border-action-cyan text-sidebar-navy dark:text-text-primary'
            }`}
          >
            {isSelected ? 'Selecionado' : (job.status?.toLowerCase() === 'bookado' || job.status?.toLowerCase() === 'booked' || job.selectedFreelancerId) ? 'Ver Alocação' : 'Selecionar Oportunidade'}
          </button>
        </div>
      </div>
    );
  };

  // --- CANDIDATE MATCHING & FILTERING ---
  const compatibleFreelancers = db.freelancers.filter(f => {
    // Hide blocked/inactive freelancers entirely, as well as merged duplicates
    if (f.status === 'Bloqueado' || f.status === 'Inativo') return false;
    if (f.mergedIntoFreelancerId) return false;

    // Search query matches name, main role, or secondary roles
    if (candidateSearch) {
      const q = candidateSearch.toLowerCase();
      const matchName = f.name.toLowerCase().includes(q);
      const matchRole = f.mainRole.toLowerCase().includes(q) || f.secondaryRoles.some(r => r.toLowerCase().includes(q));
      if (!matchName && !matchRole) return false;
    }

    // Role Match Logic (based on Job or manual candidateRole filter)
    const roleToMatch = candidateRole || (activeJob ? activeJob.roleNeeded : '');
    if (roleToMatch) {
      const hasExactRole = f.mainRole === roleToMatch || f.secondaryRoles.includes(roleToMatch);
      const normToMatch = normalizeFunctionName(roleToMatch);
      const normMainRole = normalizeFunctionName(f.mainRole);
      const hasNormalizedRole = normMainRole === normToMatch || f.secondaryRoles.some(r => normalizeFunctionName(r) === normToMatch);
      const hasRelatedRole = areRolesRelated(f.mainRole, roleToMatch) || f.secondaryRoles.some(r => areRolesRelated(r, roleToMatch));

      if (requireExactRole) {
        if (!hasExactRole) return false;
      } else {
        if (!hasExactRole && !hasNormalizedRole && !hasRelatedRole) return false;
      }
    }

    // Seniority Match Logic
    const seniorityToMatch = candidateSeniority || (activeJob ? activeJob.seniorityNeeded : '');
    if (seniorityToMatch) {
      if (requireExactSeniority) {
        if (f.seniority !== seniorityToMatch) return false;
      } else {
        if (activeJob && seniorityToMatch === activeJob.seniorityNeeded) {
          const jobRank = SENIORITY_RANK[activeJob.seniorityNeeded] || 2;
          const fRank = SENIORITY_RANK[f.seniority] || 2;
          if (!showBelowSeniority && fRank < jobRank) return false;
        } else {
          if (candidateSeniority && f.seniority !== candidateSeniority) return false;
        }
      }
    }

    // Budget/Daily rate Filter Logic
    if (activeJob) {
      const dailyAvg = calculateDailyAverage(activeJob);
      if (!showAboveBudget && f.referenceValue > dailyAvg) return false;
    }

    // Standard filters
    if (candidateMinScore > 0 && f.averageScore < candidateMinScore) return false;
    if (candidateLocation) {
      const loc = candidateLocation.toLowerCase();
      const matchCity = f.city.toLowerCase().includes(loc);
      const matchState = f.state.toLowerCase().includes(loc);
      if (!matchCity && !matchState) return false;
    }
    if (candidateMaxRate && f.referenceValue > parseCurrencyBR(candidateMaxRate)) return false;
    if (candidateAvailability && f.availability !== candidateAvailability) return false;
    if (candidateBrands) {
      const q = candidateBrands.toLowerCase();
      const matchBrands = (f.brandsWorked || '').toLowerCase().includes(q);
      const matchIndustries = (f.industries || []).some(ind => ind.toLowerCase().includes(q));
      if (!matchBrands && !matchIndustries) return false;
    }

    const hasV3aExp = f.experienceWithV3A || f.averageScore > 0 || (f.hasWorkedWithV3a && f.hasWorkedWithV3a.toLowerCase() !== 'não');
    if (candidateV3aExp !== null && hasV3aExp !== candidateV3aExp) return false;

    return true;
  });

  // Shortlists linked to selected job
  const jobShortlists = db.shortlists.filter(sl => sl.jobId === selectedJobIdLocal);

  // Match Compatibility Scoring Engine
  const getCandidateScoreAndReason = (f: Freelancer) => {
    if (!activeJob) return { score: 0, reasons: [], tags: [] };

    let score = 0;
    const reasons: string[] = [];
    const tags: string[] = [];

    const dailyAvg = calculateDailyAverage(activeJob);
    const jobRank = SENIORITY_RANK[activeJob.seniorityNeeded] || 2;
    const fRank = SENIORITY_RANK[f.seniority] || 2;

    // 1. Role compatibility (max +40)
    const jobRole = activeJob.roleNeeded;
    const hasExactRole = f.mainRole === jobRole || f.secondaryRoles.includes(jobRole);
    const normJobRole = normalizeFunctionName(jobRole);
    const normMainRole = normalizeFunctionName(f.mainRole);
    const hasNormalizedRole = normMainRole === normJobRole || f.secondaryRoles.some(r => normalizeFunctionName(r) === normJobRole);
    const hasRelatedRole = areRolesRelated(f.mainRole, jobRole) || f.secondaryRoles.some(r => areRolesRelated(r, jobRole));

    if (hasExactRole || hasNormalizedRole) {
      score += 40;
      reasons.push('Função compatível');
      tags.push('Função compatível');
    } else if (hasRelatedRole) {
      score += 20;
      reasons.push('Função relacionada');
      tags.push('Função relacionada');
    } else {
      reasons.push('Função não compatível');
    }

    // 2. Seniority (max +20, penalty -10)
    if (fRank >= jobRank) {
      score += 20;
      reasons.push('Senioridade compatível ou superior');
      tags.push('Senioridade compatível');
    } else {
      const diff = jobRank - fRank;
      if (diff === 1) {
        score += 10;
        reasons.push('Senioridade 1 nível abaixo');
        tags.push('Senioridade abaixo do solicitado');
      } else if (diff === 2) {
        score += 5;
        reasons.push('Senioridade 2 níveis abaixo');
        tags.push('Senioridade abaixo do solicitado');
      } else {
        score -= 10; // Penalty
        reasons.push('Senioridade muito abaixo');
        tags.push('Senioridade muito abaixo');
      }
    }

    // 3. Availability (max +15, penalty -20)
    if (f.availability === 'Imediata' || f.availability === '15 dias' || f.availability === '30+ dias') {
      score += 15;
      reasons.push('Disponibilidade compatível');
      tags.push('Disponível');
    } else if (f.availability === 'Indisponível') {
      score -= 20; // Penalty
      reasons.push('Indisponível');
      tags.push('Indisponível');
    }

    // 4. Daily budget (max +10, penalty -10)
    if (f.referenceValue <= dailyAvg) {
      score += 10;
      reasons.push('Valor dentro do budget');
      tags.push('Valor dentro do budget');
    } else {
      score -= 10; // Penalty
      reasons.push('Valor acima do budget');
      tags.push('Valor acima do budget');
    }

    // 5. Rating/Stars (max +10)
    if (f.averageScore >= 4.5) {
      score += 10;
      reasons.push('Avaliação excelente');
      tags.push('Avaliação top');
    } else if (f.averageScore >= 4.0) {
      score += 8;
      reasons.push('Avaliação boa');
    } else if (f.averageScore >= 3.5) {
      score += 5;
      reasons.push('Avaliação mediana');
    }

    // 6. Experience with V3A (max +5)
    const hasV3aExp = f.experienceWithV3A || f.averageScore > 0 || (f.hasWorkedWithV3a && f.hasWorkedWithV3a.toLowerCase() !== 'não');
    if (hasV3aExp) {
      score += 5;
      reasons.push('Histórico com a V3A');
      tags.push('Já trabalhou com V3A');
    }

    // 7. Incomplete data penalty (penalty -5)
    const hasIncompleteData = !f.city || !f.state || !f.email || !f.whatsapp;
    if (hasIncompleteData) {
      score -= 5;
      reasons.push('Dados incompletos');
      tags.push('Cadastro incompleto');
    }

    // Clamp score 0 to 100
    const finalScore = Math.max(0, Math.min(100, score));

    return { score: finalScore, reasons, tags };
  };

  // Helper to render matching row design
  const renderCandidateRow = (cand: Freelancer & { matchDetails: ReturnType<typeof getCandidateScoreAndReason> }) => {
    const isAdded = jobShortlists.some(sl => sl.freelancerId === cand.id);
    const { score, reasons, tags } = cand.matchDetails;

    // Check if below seniority but compatible role
    const dailyAvg = activeJob ? calculateDailyAverage(activeJob) : 0;
    const jobRank = activeJob ? (SENIORITY_RANK[activeJob.seniorityNeeded] || 2) : 2;
    const fRank = SENIORITY_RANK[cand.seniority] || 2;
    const jobRole = activeJob ? activeJob.roleNeeded : '';
    const hasExactRole = cand.mainRole === jobRole || cand.secondaryRoles.includes(jobRole);
    const normJobRole = normalizeFunctionName(jobRole);
    const normMainRole = normalizeFunctionName(cand.mainRole);
    const hasNormalizedRole = normMainRole === normJobRole || cand.secondaryRoles.some(r => normalizeFunctionName(r) === normJobRole);
    
    const isBelowSeniorityButCompatRole = fRank < jobRank && (hasExactRole || hasNormalizedRole);

    // Score badge style
    let scoreBadgeStyle = "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20";
    if (score >= 75) {
      scoreBadgeStyle = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
    } else if (score >= 50) {
      scoreBadgeStyle = "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
    }

    return (
      <div 
        key={cand.id} 
        draggable={!isAdded && !activeJob?.selectedFreelancerId}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', cand.id);
        }}
        className="p-3.5 flex flex-col gap-2.5 match-candidate-row hover:bg-bg-hover transition-all border-b border-border-subtle last:border-0 bg-bg-surface cursor-grab active:cursor-grabbing hover:border-action-cyan"
      >
        {/* Name, Score and Seniority */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center flex-wrap gap-1.5">
              <strong className="text-text-primary text-sm font-bold">{cand.name}</strong>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                score >= 75 ? 'bg-success-bg text-success-text border-success-border/30' :
                score >= 50 ? 'bg-info-bg text-info-text border-info-border/30' :
                'bg-neutral-bg text-neutral-text border-neutral-border/30'
              }`}>
                {cand.seniority}
              </span>
            </div>
            <p className="text-text-secondary text-[11px] leading-tight">
              {cand.mainRole} &bull; {cand.city}-{cand.state} &bull; Média diária: <strong className="text-text-primary">R$ {cand.referenceValue}</strong>
            </p>
          </div>

          <div className={`flex items-center gap-1 border px-2 py-0.5 rounded-lg text-xs font-bold ${scoreBadgeStyle}`}>
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Score: {score}%</span>
          </div>
        </div>

        {/* Ratings, Score & Experience */}
        <div className="flex items-center flex-wrap gap-3 text-[11px]">
          <div className="flex items-center gap-1">
            <ScoreStars score={cand.averageScore} size="sm" showNumber={true} />
          </div>
          {cand.experienceWithV3A && (
            <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold px-1.5 py-0.5 rounded">
              Histórico V3A
            </span>
          )}
          <span className="text-text-secondary">
            Agenda: <span className="font-semibold text-text-primary">{cand.availability}</span>
          </span>
        </div>

        {/* Semantic Tags */}
        {(tags.length > 0 || activeJob?.success_fee_enabled) && (
          <div className="flex flex-wrap gap-1.5">
            {activeJob?.success_fee_enabled && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-300 dark:border-indigo-900/30 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Success Fee Aplicável</span>
              </span>
            )}
            {tags.map((t, idx) => {
              let tagColor = "bg-neutral-bg text-neutral-text border-neutral-border/30";
              if (t === "Função compatível" || t === "Valor dentro do budget" || t === "Já trabalhou com V3A" || t === "Disponível") {
                tagColor = "bg-success-bg text-success-text border-success-border/30";
              } else if (t === "Função relacionada") {
                tagColor = "bg-info-bg text-info-text border-info-border/30";
              } else if (t === "Senioridade abaixo do solicitado" || t === "Valor acima do budget" || t === "Cadastro incompleto") {
                tagColor = "bg-warning-bg text-warning-text border-warning-border/30";
              } else if (t === "Indisponível" || t === "Senioridade muito abaixo") {
                tagColor = "bg-danger-bg text-danger-text border-danger-border/30";
              }
              return (
                <span key={idx} className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${tagColor}`}>
                  {t}
                </span>
              );
            })}
          </div>
        )}

        {/* Warning block for Pleno matching Especialista role */}
        {isBelowSeniorityButCompatRole && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] p-2.5 rounded-lg flex items-start gap-1.5 leading-snug">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>Apesar de estar abaixo da senioridade solicitada, possui função compatível para análise do núcleo.</span>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end pt-1">
          <button
            disabled={isAdded || !!activeJob?.selectedFreelancerId}
            onClick={() => handleAddToShortlist(cand.id)}
            className={`add-to-shortlist-btn p-1.5 px-3 rounded-lg font-bold text-xs transition-all ${
              isAdded 
                ? 'bg-emerald-600/20 border border-emerald-600/40 text-emerald-450 dark:text-emerald-400 font-semibold cursor-default' 
                : activeJob?.selectedFreelancerId
                  ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-accent-soft border border-accent/30 text-accent hover:bg-action-cyan hover:text-white hover:border-action-cyan'
            }`}
          >
            {isAdded ? <Check className="w-3.5 h-3.5 inline mr-1" /> : ''}
            {isAdded ? 'Na Shortlist' : 'Adicionar'}
          </button>
        </div>
      </div>
    );
  };

  // Match Compatibility Grouping
  const getCandidateMatches = () => {
    if (!activeJob) return { best: [], good: [], other: [] };

    const best: Array<Freelancer & { matchDetails: ReturnType<typeof getCandidateScoreAndReason> }> = [];
    const good: Array<Freelancer & { matchDetails: ReturnType<typeof getCandidateScoreAndReason> }> = [];
    const other: Array<Freelancer & { matchDetails: ReturnType<typeof getCandidateScoreAndReason> }> = [];

    compatibleFreelancers.forEach(f => {
      const details = getCandidateScoreAndReason(f);
      const decorated = { ...f, matchDetails: details };

      if (details.score >= 75) {
        best.push(decorated);
      } else if (details.score >= 50) {
        good.push(decorated);
      } else {
        other.push(decorated);
      }
    });

    const sortByScore = (a: any, b: any) => b.matchDetails.score - a.matchDetails.score;
    best.sort(sortByScore);
    good.sort(sortByScore);
    other.sort(sortByScore);

    return { best, good, other };
  };

  const matches = getCandidateMatches();

  // --- ACTIONS ---

  // Select Job
  const handleSelectJob = (jobId: string) => {
    setSelectedJobIdLocal(jobId);
    db.setSelectedJobId(jobId);
    
    const job = db.jobs.find(j => j.id === jobId);
    if (job && (job.status?.toLowerCase() === 'bookado' || job.status?.toLowerCase() === 'booked' || job.selectedFreelancerId)) {
      setActiveStep(4);
    } else {
      setActiveStep(2); // Auto advance to Step 2
    }
  };

  // Clear Selected Job
  const handleClearJob = () => {
    setSelectedJobIdLocal('');
    db.setSelectedJobId(null);
    setNegotiatingFreelancerId('');
    setActiveStep(1);
  };

  // Add to shortlist
  const handleAddToShortlist = (freelancerId: string) => {
    if (!selectedJobIdLocal || !activeJob) return;

    if (activeJob.selectedFreelancerId) {
      alert(`⚠️ Bloqueio de Oportunidade:\nEsta oportunidade já possui um profissional alocado (${db.freelancers.find(f => f.id === activeJob.selectedFreelancerId)?.name}). Para contratar outro profissional, crie uma nova oportunidade.`);
      return;
    }

    // Add to shortlist
    const newSl: Shortlist = {
      id: generateUniqueId('short'),
      jobId: selectedJobIdLocal,
      freelancerId: freelancerId,
      candidateStatus: 'Selecionado',
      notes: ''
    };

    db.setShortlists(prev => [...prev, newSl]);

    // Update job status if it was "Oportunidade criada"
    if (activeJob.status === 'Oportunidade criada') {
      db.setJobs(prev => prev.map(j => j.id === selectedJobIdLocal ? { ...j, status: 'Em shortlist' } : j));
    }
  };

  // Remove from shortlist
  const handleRemoveFromShortlist = (freelancerId: string) => {
    if (!selectedJobIdLocal || !activeJob) return;
    if (activeJob.selectedFreelancerId) {
      alert(`⚠️ Ação Bloqueada:\nA contratação deste job já foi consolidada. Não é possível alterar a shortlist.`);
      return;
    }

    db.setShortlists(prev => prev.filter(sl => !(sl.jobId === selectedJobIdLocal && sl.freelancerId === freelancerId)));
  };

  // Update candidate status inside shortlist
  const handleStatusChange = (freelancerId: string, newStatus: Shortlist['candidateStatus']) => {
    if (activeJob?.selectedFreelancerId) return;

    db.setShortlists(prev => prev.map(sl => {
      if (sl.jobId === selectedJobIdLocal && sl.freelancerId === freelancerId) {
        return { ...sl, candidateStatus: newStatus };
      }
      return sl;
    }));
  };

  // Update candidate observations/notes in shortlist
  const handleNotesChange = (freelancerId: string, value: string) => {
    if (activeJob?.selectedFreelancerId) return;

    // Set local visual state as saving
    setSaveStatus(prev => ({ ...prev, [freelancerId]: 'saving' }));

    db.setShortlists(prev => prev.map(sl => {
      if (sl.jobId === selectedJobIdLocal && sl.freelancerId === freelancerId) {
        return { ...sl, notes: value };
      }
      return sl;
    }));

    // Local visual state saved confirmation
    setTimeout(() => {
      setSaveStatus(prev => ({ ...prev, [freelancerId]: 'saved' }));
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [freelancerId]: 'idle' }));
      }, 1500);
    }, 500);
  };

  // Step navigation helper with validation checks
  const handleNavigateStep = (step: 1 | 2 | 3 | 4) => {
    if ((activeJob?.selectedFreelancerId || activeJob?.status === 'Bookado' || activeJob?.status === 'bookado') && (step === 2 || step === 3)) {
      alert('⚠️ Bloqueio de Fluxo:\nEste job já está bookado/alocado. A shortlist e negociação estão fechadas.');
      return;
    }

    if (step === 1) {
      setActiveStep(1);
      return;
    }

    if (step === 2) {
      if (!selectedJobIdLocal) {
        alert('⚠️ Validação de Fluxo:\nPor favor, selecione uma oportunidade na lista antes de prosseguir.');
        return;
      }
      setActiveStep(2);
      return;
    }

    if (step === 3) {
      if (!selectedJobIdLocal) {
        alert('⚠️ Validação de Fluxo:\nPor favor, selecione uma oportunidade antes de ir para a negociação.');
        return;
      }
      if (jobShortlists.length === 0) {
        alert('⚠️ Validação de Fluxo:\nA shortlist deve conter pelo menos 1 profissional elegível para prosseguir para a Negociação.');
        return;
      }
      setActiveStep(3);
      return;
    }

    if (step === 4) {
      if (!selectedJobIdLocal) {
        alert('⚠️ Validação de Fluxo:\nPor favor, selecione uma oportunidade antes de ir para a homologação.');
        return;
      }
      setActiveStep(4);
      return;
    }
  };

  const handleUpdateNegotiation = (
    freelancerId: string, 
    updates: { 
      negotiationStatus?: Shortlist['candidateStatus'];
      negotiatedRate?: number;
      remunerationModel?: string;
      notes?: string;
      estimatedHours?: number;
    }
  ) => {
    // Sincronizar Taxa Acordada com Valor Mensal se houver alteração
    if (updates.negotiatedRate !== undefined) {
      const newRate = updates.negotiatedRate;
      updateCandidateNeg(freelancerId, {
        recurringAmount: newRate,
        recurringAmountVisual: newRate > 0 ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(newRate) : ''
      });
    }

    // Sincronizar Modelo de Remuneração com o Modelo de Pagamento
    if (updates.remunerationModel !== undefined) {
      const m = updates.remunerationModel;
      if (m === 'Mensal / Salário' || m === 'Mensal') {
        updateCandidateNeg(freelancerId, {
          paymentModel: 'monthly_recurring'
        });
      } else {
        updateCandidateNeg(freelancerId, {
          paymentModel: 'one_time'
        });
      }
    }

    const isJobMonthly = (activeJob?.remunerationModel as string) === 'monthly_salary' || (activeJob?.remunerationModel as string) === 'monthly' || activeJob?.paymentFlow === 'recurring';
    const defaultJobBilling = 
      isJobMonthly ? 'Mensal / Salário por período' :
      activeJob?.remunerationModel === 'hourly' ? 'Hora' :
      ((activeJob?.remunerationModel as string) === 'fixed_job' || (activeJob?.remunerationModel as string) === 'closed_package') ? 'Job Fechado' : 'Diária';

    db.setShortlists(prev => prev.map(sl => {
      if (sl.jobId === selectedJobIdLocal && sl.freelancerId === freelancerId) {
        const rate = updates.negotiatedRate !== undefined ? updates.negotiatedRate : sl.negotiatedRate;
        const model = updates.remunerationModel !== undefined ? updates.remunerationModel : (sl.remunerationModel || defaultJobBilling);
        const notes = updates.notes !== undefined ? updates.notes : sl.notes;
        const estHours = updates.estimatedHours !== undefined ? updates.estimatedHours : sl.estimatedHours;
        
        let nextStatus = updates.negotiationStatus !== undefined ? updates.negotiationStatus : sl.candidateStatus;
        
        // Use calculatePolicyLimitForJob for precise policy check
        const currentRate = rate || 0;
        const policyResult = activeJob ? calculatePolicyLimitForJob({
          role: activeJob.roleNeeded,
          seniority: activeJob.seniorityNeeded,
          remunerationModel: model || defaultJobBilling,
          startDate: activeJob.startDate,
          endDate: activeJob.endDate,
          proposedAmount: currentRate,
          policies: db.policies,
          installmentsCount: estHours ? undefined : undefined
        }) : null;

        const isAbovePolicy = policyResult ? policyResult.policyStatus === 'above_policy' : false;
        
        if (isAbovePolicy && nextStatus !== 'Pendente aprovação Head') {
          nextStatus = 'Valor fora da política';
        }

        const allocationDays = calculateAllocationDays(activeJob?.startDate, activeJob?.endDate);
        const negotiatedTotal = calculateNegotiatedTotal({
          negotiatedRate: rate,
          remunerationModel: model,
          allocationDays,
          estimatedHours: estHours,
          startDate: activeJob?.startDate,
          endDate: activeJob?.endDate
        }) ?? undefined;

        const { savingAmount, savingPercentage } = calculateBudgetSaving({
          budget: activeJob?.budget,
          negotiatedTotal
        });

        const budgetDeltaStatus = getBudgetDeltaStatus({
          budget: activeJob?.budget,
          negotiatedTotal
        });

        const dailyBudgetReference = allocationDays > 0 && activeJob?.budget ? activeJob.budget / allocationDays : 0;
        
        const dailySavingAmount = (model?.toLowerCase() === 'diária' || model?.toLowerCase() === 'diaria')
          ? (rate !== null && rate !== undefined ? dailyBudgetReference - rate : 0)
          : 0;

        return {
          ...sl,
          candidateStatus: nextStatus,
          negotiationStatus: nextStatus,
          negotiatedRate: rate,
          remunerationModel: model,
          notes,
          estimatedHours: estHours,
          negotiatedTotal,
          budgetSavingAmount: savingAmount ?? undefined,
          budgetSavingPercentage: savingPercentage ?? undefined,
          dailyBudgetReference: dailyBudgetReference || undefined,
          dailySavingAmount: dailySavingAmount || undefined,
          budgetDeltaStatus
        };
      }
      return sl;
    }));
  };

  const handleRequestApproval = (slId: string, freelancerId: string, type: 'value_exception' | 'schedule_conflict', currentRate?: number) => {
    if (!activeJob) {
      showToast('Nenhuma oportunidade selecionada.', 'error');
      return;
    }
    
    // Front-end parameters validation
    if (!slId) {
      showToast('Candidato da shortlist não identificado.', 'error');
      console.error('[handleRequestApproval] candidate ID missing');
      return;
    }
    if (!freelancerId) {
      showToast('Freelancer não identificado.', 'error');
      console.error('[handleRequestApproval] freelancer ID missing');
      return;
    }

    setApprovalModal({
      isOpen: true,
      slId,
      freelancerId,
      type,
      currentRate,
      reason: '',
      loading: false,
      error: null
    });
  };

  const handleSubmitApprovalRequest = async () => {
    const trimmedReason = approvalModal.reason.trim();
    if (!trimmedReason) {
      setApprovalModal(prev => ({ ...prev, error: 'A justificativa técnica é obrigatória.' }));
      return;
    }
    if (trimmedReason.length < 10) {
      setApprovalModal(prev => ({ ...prev, error: 'A justificativa deve conter no mínimo 10 caracteres.' }));
      return;
    }
    if (trimmedReason.length > 1000) {
      setApprovalModal(prev => ({ ...prev, error: 'A justificativa não deve exceder 1000 caracteres.' }));
      return;
    }

    if (!activeJob) {
      setApprovalModal(prev => ({ ...prev, error: 'Oportunidade ativa não identificada.' }));
      return;
    }

    setApprovalModal(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';

      if (!token) {
        setApprovalModal(prev => ({ ...prev, loading: false, error: 'Sessão expirada. Por favor, refaça o login.' }));
        return;
      }

      const targetModel = activeJob.remunerationModel || 'daily';
      const billingTypeForMatch = 
        ['daily', 'diaria', 'diária'].includes(targetModel.toLowerCase()) ? 'Diária' :
        ['hourly', 'hora'].includes(targetModel.toLowerCase()) ? 'Hora' :
        ['fixed_job', 'pacote', 'job fechado', 'projeto'].includes(targetModel.toLowerCase()) ? 'Job Fechado' : 'Mensal / Salário';

      const policy = db.policies.find(p => 
        p.role === activeJob.roleNeeded && 
        p.seniority === activeJob.seniorityNeeded && 
        p.billingType === billingTypeForMatch
      );
      const refVal = policy ? policy.referenceValue : 0;
      const ceiling = policy ? policy.ceilingValue : 99999;

      const res = await createApprovalRequestAction(token, {
        shortlistCandidateId: approvalModal.slId,
        freelancerId: approvalModal.freelancerId,
        approvalType: approvalModal.type,
        requestedBy: db.currentUser.id,
        reason: trimmedReason,
        policyReferenceValue: refVal,
        policyCeilingValue: ceiling,
        negotiatedValue: approvalModal.currentRate || ceiling
      });

      if (res.success) {
        setApprovalModal(prev => ({ ...prev, isOpen: false, reason: '', loading: false }));
        showToast('Solicitação de aprovação enviada com sucesso.', 'success');
        await db.reloadDatabase();
      } else {
        setApprovalModal(prev => ({ ...prev, loading: false, error: res.error || 'Erro ao registrar solicitação.' }));
      }
    } catch (err: any) {
      console.error('[requestApproval] failed:', {
        error: err,
        payload: {
          jobId: activeJob?.id,
          shortlistCandidateId: approvalModal.slId,
          freelancerId: approvalModal.freelancerId,
          approvalType: approvalModal.type,
          reason: trimmedReason
        }
      });
      setApprovalModal(prev => ({ ...prev, loading: false, error: 'Erro inesperado no servidor.' }));
    }
  };

  const handleFinalAllocation = async (freelancerId: string, slId: string, rate: number, model: string, scopeText: string, sl?: Shortlist) => {
    if (!activeJob) return;

    const candNeg = getCandidateNeg(freelancerId, sl);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';
      if (!token) {
        alert('Sessão expirada. Faça login novamente.');
        return;
      }

       const res = await confirmAllocationAction(token, {
        requestId: activeJob.id,
        freelancerId,
        negotiatedRate: rate,
        remunerationModel: model,
        scope: scopeText || 'Alocação homologada pelo núcleo',
        paymentModel: candNeg.paymentModel,
        contractStartDate: candNeg.contractStartDate || activeJob.startDate,
        contractEndDate: candNeg.contractEndDate || activeJob.endDate,
        recurringAmount: candNeg.paymentModel === 'monthly_recurring' ? (candNeg.recurringAmount || rate) : undefined,
        preferredDueDay: candNeg.preferredDueDay,
        paymentTerms: candNeg.paymentTerms,
        paymentNotes: candNeg.paymentNotes,
        excludedDates: excludedDates[freelancerId],
        // Success Fee fields
        successFeeEnabled: candNeg.successFeeEnabled,
        successFeeType: candNeg.successFeeType,
        successFeeFixedAmount: candNeg.successFeeFixedAmount,
        successFeePercent: candNeg.successFeePercent,
        successFeeBase: candNeg.successFeeBase,
        successFeeTrigger: candNeg.successFeeTrigger,
        successFeeTerms: candNeg.successFeeTerms,
        acceptedByFreelancer: candNeg.acceptedByFreelancer
      });

      if (!res.success) {
        alert(`❌ Erro ao homologar alocação: ${res.error}`);
        return;
      }

      alert(`✅ Alocação homologada com sucesso!\nO profissional foi alocado para o job e a vaga foi bookada.`);
      
      await db.reloadDatabase();
      setActiveStep(4);
    } catch (err: any) {
      console.error('[confirmAllocation] failed:', err);
      alert(`❌ Erro ao homologar alocação: ${err.message || err}`);
    }
  };

  // Head do Núcleo: Aprovar ou Rejeitar exceção de valor
  const handleHeadDecision = async (approvalId: string, decision: 'approve' | 'reject', comment: string) => {
    if (!approvalId) {
      showToast('ID da aprovação inválido.', 'error');
      return;
    }

    const approval = db.approvals?.find((ap: any) => ap.id === approvalId);
    const isNucleusHead = db.currentUser.isNucleusHead ||
      (db.currentUser.profile === 'NÚCLEO' &&
        !!db.currentUser.nucleoId &&
        !!approval?.nucleusId &&
        db.currentUser.nucleoId === approval.nucleusId);
    const isPrivileged = ['MASTER', 'RH', 'C-LEVEL'].includes(db.currentUser.profile);

    if (!isNucleusHead && !isPrivileged) {
      showToast('Permissão negada: apenas o Head do Núcleo, MASTER, RH ou C-LEVEL podem aprovar exceções.', 'error');
      return;
    }

    const trimmedComment = comment.trim();
    if (!trimmedComment || trimmedComment.length < 5) {
      showToast('Comentário de decisão obrigatório (mínimo 5 caracteres).', 'error');
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';
      const userId = sessionData?.session?.user?.id;
      if (!token || !userId) {
        showToast('Sessão expirada. Faça login novamente.', 'error');
        return;
      }

      const res = await decideApprovalAction(
        token,
        approvalId,
        decision === 'approve' ? 'approved' : 'rejected',
        userId,
        db.currentUser.profile,
        trimmedComment
      );

      if (!res.success) {
        showToast(`Erro ao registrar decisão: ${res.error}`, 'error');
        return;
      }

      showToast(decision === 'approve' ? 'Exceção aprovada com sucesso.' : 'Exceção rejeitada.', 'success');
      await db.reloadDatabase();
    } catch (err: any) {
      console.error('[handleHeadDecision] error:', err);
      showToast('Erro inesperado ao registrar decisão.', 'error');
    }
  };

  const handleSubmitHeadDecision = async () => {
    if (!headDecisionModal.comment || headDecisionModal.comment.trim().length < 5) {
      setHeadDecisionModal(prev => ({ ...prev, error: 'Comentário de decisão obrigatório (mínimo 5 caracteres).' }));
      return;
    }

    setHeadDecisionModal(prev => ({ ...prev, loading: true, error: null }));
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';
      const userId = sessionData?.session?.user?.id;
      if (!token || !userId) {
        setHeadDecisionModal(prev => ({ ...prev, loading: false, error: 'Sessão expirada. Faça login novamente.' }));
        return;
      }

      const res = await decideApprovalAction(
        token,
        headDecisionModal.approvalId,
        headDecisionModal.decision === 'approve' ? 'approved' : 'rejected',
        userId,
        db.currentUser.profile,
        headDecisionModal.comment
      );

      if (!res.success) {
        setHeadDecisionModal(prev => ({ ...prev, loading: false, error: res.error || 'Erro ao registrar decisão.' }));
        return;
      }

      showToast(
        headDecisionModal.decision === 'approve' 
          ? 'Exceção aprovada com sucesso.' 
          : 'Exceção rejeitada.', 
        'success'
      );
      
      setHeadDecisionModal(prev => ({ ...prev, isOpen: false, comment: '', loading: false }));
      await db.reloadDatabase();
    } catch (err: any) {
      console.error('[handleSubmitHeadDecision] failed:', err);
      setHeadDecisionModal(prev => ({ ...prev, loading: false, error: 'Erro inesperado no servidor.' }));
    }
  };

  // Reopen Job allocation and deselect professional (MASTER / RH only)
  const handleReopenJob = async () => {
    if (!activeJob) return;

    if (db.currentUser.profile !== 'MASTER' && db.currentUser.profile !== 'RH') {
      alert('⚠️ Permissão Negada:\nApenas perfis MASTER e RH possuem permissão para cancelar alocações consolidadas.');
      return;
    }

    const currentBookedFreela = db.freelancers.find(f => f.id === activeJob.selectedFreelancerId);
    const reasonInput = prompt(
      `Você está prestes a reabrir esta vaga e cancelar a alocação de "${currentBookedFreela?.name}".\n\nInsira a justificativa técnica obrigatória:`
    );

    if (reasonInput === null) return;
    if (!reasonInput.trim()) {
      alert('⚠️ Justificativa técnica é obrigatória para cancelar a alocação.');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('reopen_job_allocation', {
        p_request_id: activeJob.id,
        p_user_id: db.currentUser.id,
        p_reason: `Alocação cancelada por ${db.currentUser.name}. Justificativa: ${reasonInput}`
      });

      if (error) throw error;

      const result = typeof data === 'string' ? JSON.parse(data) : data;
      if (!result.success) {
        alert(`❌ Erro ao reabrir vaga: ${result.error}`);
        return;
      }

      alert(`✅ Sucesso!\nAlocação revogada. Oportunidade reaberta e retornada para a fase de shortlist.`);
      
      await db.reloadDatabase();
      setActiveStep(2);
    } catch (err: any) {
      console.error('[reopenJob] failed:', err);
      alert(`❌ Erro ao reabrir vaga: ${err.message || err}`);
    }
  };

  // --- STEP 3: COMPARISON GRID SORTING LOGIC ---
  const getStatusRank = (status: string | null | undefined): number => {
    const s = status?.toLowerCase() || '';
    if (s.includes('aceitou')) return 5;
    if (s.includes('fora_politica') || s.includes('fora da política')) return 4;
    if (s.includes('em_negociacao') || s.includes('negociação')) return 3;
    if (s.includes('aguardando')) return 2;
    if (s.includes('nao_aceitou') || s.includes('não aceitou') || s.includes('rejeitado')) return 1;
    return 0;
  };

  const sortedCompareList = useMemo(() => {
    const list = jobShortlists.map(sl => {
      const cand = db.freelancers.find(f => f.id === sl.freelancerId);
      
      const isJobMonthly = (activeJob?.remunerationModel as string) === 'monthly_salary' || (activeJob?.remunerationModel as string) === 'monthly' || activeJob?.paymentFlow === 'recurring';
      const defaultBilling = 
        isJobMonthly ? 'Mensal / Salário por período' :
        activeJob?.remunerationModel === 'hourly' ? 'Hora' :
        ((activeJob?.remunerationModel as string) === 'fixed_job' || (activeJob?.remunerationModel as string) === 'closed_package') ? 'Job Fechado' : 'Diária';
      
      const billing = sl.remunerationModel && sl.remunerationModel !== 'Diária' && sl.remunerationModel !== 'daily'
        ? sl.remunerationModel 
        : defaultBilling;
      
      const billingTypeForMatch = 
        ['daily', 'diaria', 'diária'].includes(billing.toLowerCase()) ? 'Diária' :
        ['hourly', 'hora'].includes(billing.toLowerCase()) ? 'Hora' :
        ['fixed_job', 'pacote', 'job fechado', 'projeto'].includes(billing.toLowerCase()) ? 'Job Fechado' : 'Mensal / Salário';

      const policy = db.policies.find(p => 
        p.role === activeJob?.roleNeeded && 
        p.seniority === activeJob?.seniorityNeeded && 
        p.billingType === billingTypeForMatch
      );
      const ceilingValue = policy ? policy.ceilingValue : 99999;
      
      const defaultRate = (activeJob?.expectedRate && activeJob.expectedRate > 0)
        ? activeJob.expectedRate
        : (cand?.referenceValue || 0);

      const rate = (sl.negotiatedRate != null && sl.negotiatedRate > 0) ? sl.negotiatedRate : defaultRate;
      const allocationDays = calculateAllocationDays(activeJob?.startDate, activeJob?.endDate);
      
      const negotiatedTotal = calculateNegotiatedTotal({
        negotiatedRate: rate,
        remunerationModel: billing,
        allocationDays,
        estimatedHours: sl.estimatedHours,
        startDate: activeJob?.startDate,
        endDate: activeJob?.endDate
      }) || 0;

      const { savingAmount, savingPercentage } = calculateBudgetSaving({
        budget: activeJob?.budget || 0,
        negotiatedTotal
      });

      const hasConflict = cand ? hasScheduleConflict(cand.id, activeJob?.startDate || '', activeJob?.endDate || '') : false;
      const exceedsCeiling = rate > ceilingValue;

      const conflictApproval = db.approvals?.find(ap => 
        ap.shortlistCandidateId === sl.id && 
        ap.approvalType === 'schedule_conflict' &&
        ap.freelancerId === cand?.id
      );
      const isConflictApproved = conflictApproval?.status === 'approved';

      const budgetApproval = db.approvals?.find(ap => 
        ap.shortlistCandidateId === sl.id && 
        ap.approvalType === 'value_exception' &&
        ap.freelancerId === cand?.id
      );
      const isBudgetApproved = budgetApproval?.status === 'approved';

      const isEligible = (sl.candidateStatus === 'Aceitou' || sl.candidateStatus === 'Aprovado pelo Head' || (sl.candidateStatus === 'Valor fora da política' && isBudgetApproved)) && (!hasConflict || isConflictApproved);

      return {
        sl,
        cand,
        rate,
        billing,
        negotiatedTotal,
        savingAmount: savingAmount || 0,
        savingPercentage: savingPercentage || 0,
        exceedsCeiling,
        hasConflict,
        isEligible,
        statusRank: getStatusRank(sl.candidateStatus),
        score: cand?.averageScore || 0
      };
    });

    if (compareSortKey === 'saving') {
      return [...list].sort((a, b) => b.savingAmount - a.savingAmount);
    } else if (compareSortKey === 'total') {
      return [...list].sort((a, b) => a.negotiatedTotal - b.negotiatedTotal);
    } else if (compareSortKey === 'status') {
      return [...list].sort((a, b) => b.statusRank - a.statusRank);
    } else if (compareSortKey === 'score') {
      return [...list].sort((a, b) => b.score - a.score);
    } else {
      return [...list].sort((a, b) => b.statusRank - a.statusRank);
    }
  }, [jobShortlists, activeJob, db.freelancers, db.policies, db.approvals, compareSortKey]);

  // Helper lists for filter dropdown options
  const uniqueClients = Array.from(new Set(db.jobs.map(j => j.client))).filter(Boolean).sort();
  const uniqueJobRoles = Array.from(new Set(db.jobs.map(j => j.roleNeeded))).filter(Boolean).sort();
  const uniqueFreelancerRoles = Array.from(new Set([
...db.freelancers.map(f => f.mainRole),
    ...db.freelancers.flatMap(f => f.secondaryRoles)
  ])).filter(Boolean).sort();

  const activeAllocation = selectedJobIdLocal
    ? db.allocations.find(a => a.jobId === selectedJobIdLocal && a.status !== 'Cancelado')
    : null;

  if (activeAllocation) {
    return <ConsolidatedAllocation db={db} jobId={selectedJobIdLocal} />;
  }

  return (
    <div id="shortlist-workflow-panel" className="space-y-6">
      
      {/* -------------------- STEPPER COMPONENT — só exibe quando um job foi selecionado -------------------- */}
      {activeStep > 1 && selectedJobIdLocal && (
        <div className="bg-[#0f172a]/80 backdrop-blur-md border border-slate-800 rounded-2xl shadow-xl">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 px-6 py-4">

            {/* Left: Title & Subtitle */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/50">
                <Scale className="w-5 h-5 text-action-cyan" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-white leading-none tracking-wide">Workflow de Shortlist & Negociação</h2>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">Ciclo completo desde a triagem até a contratação e alocação.</p>
              </div>
            </div>

            {/* Right: Modern Connective Stepper */}
            <div className="flex items-center gap-1.5 text-xs font-semibold overflow-x-auto shrink-0 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80 w-full lg:w-auto">
              
              {/* Step 1 — Seleção do Job */}
              {(() => {
                const done = activeStep > 1;
                const active = activeStep === 1;
                return (
                  <button
                    onClick={() => handleNavigateStep(1)}
                    className={`flex items-center gap-2 py-2 px-4 rounded-lg transition-all duration-205 whitespace-nowrap ${
                      active
                        ? 'bg-action-cyan text-slate-950 shadow-md font-extrabold cursor-default'
                        : done
                          ? 'text-emerald-400 hover:bg-slate-800/50 cursor-pointer hover:text-emerald-300'
                          : 'text-slate-500 cursor-default'
                    }`}
                  >
                    <span className={`w-4.5 h-4.5 shrink-0 flex items-center justify-center rounded-full text-[10px] font-bold ${
                      active ? 'bg-slate-950 text-action-cyan' : done ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {done ? <Check className="w-3 h-3 stroke-[3.5]" /> : '1'}
                    </span>
                    <span>Seleção</span>
                  </button>
                );
              })()}

              <span className="text-slate-800 font-light select-none px-0.5">/</span>

              {/* Step 2 — Shortlist Oficial */}
              {(() => {
                const done = activeStep > 2;
                const active = activeStep === 2;
                return (
                  <button
                    onClick={() => handleNavigateStep(2)}
                    className={`flex items-center gap-2 py-2 px-4 rounded-lg transition-all duration-205 whitespace-nowrap ${
                      active
                        ? 'bg-action-cyan text-slate-950 shadow-md font-extrabold cursor-default'
                        : done
                          ? 'text-emerald-400 hover:bg-slate-800/50 cursor-pointer hover:text-emerald-300'
                          : 'text-slate-500 cursor-default'
                    }`}
                  >
                    <span className={`w-4.5 h-4.5 shrink-0 flex items-center justify-center rounded-full text-[10px] font-bold ${
                      active ? 'bg-slate-950 text-action-cyan' : done ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {done ? <Check className="w-3 h-3 stroke-[3.5]" /> : '2'}
                    </span>
                    <span>Shortlist</span>
                  </button>
                );
              })()}

              <span className="text-slate-800 font-light select-none px-0.5">/</span>

              {/* Step 3 — Negociação */}
              {(() => {
                const done = activeStep > 3;
                const active = activeStep === 3;
                return (
                  <button
                    onClick={() => handleNavigateStep(3)}
                    className={`flex items-center gap-2 py-2 px-4 rounded-lg transition-all duration-205 whitespace-nowrap ${
                      active
                        ? 'bg-action-cyan text-slate-950 shadow-md font-extrabold cursor-default'
                        : done
                          ? 'text-emerald-400 hover:bg-slate-800/50 cursor-pointer hover:text-emerald-300'
                          : 'text-slate-500 cursor-default'
                    }`}
                  >
                    <span className={`w-4.5 h-4.5 shrink-0 flex items-center justify-center rounded-full text-[10px] font-bold ${
                      active ? 'bg-slate-950 text-action-cyan' : done ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {done ? <Check className="w-3 h-3 stroke-[3.5]" /> : '3'}
                    </span>
                    <span>Negociação</span>
                  </button>
                );
              })()}

              <span className="text-slate-800 font-light select-none px-0.5">/</span>

              {/* Step 4 — Homologação */}
              {(() => {
                const done = activeJob?.status === 'Bookado' || activeJob?.status === 'Concluído' || !!activeJob?.selectedFreelancerId;
                const active = activeStep === 4;
                return (
                  <button
                    onClick={() => handleNavigateStep(4)}
                    className={`flex items-center gap-2 py-2 px-4 rounded-lg transition-all duration-205 whitespace-nowrap ${
                      active
                        ? 'bg-action-cyan text-slate-950 shadow-md font-extrabold cursor-default'
                        : done
                          ? 'text-emerald-400 hover:bg-slate-800/50 cursor-pointer hover:text-emerald-300'
                          : 'text-slate-500 cursor-default'
                    }`}
                  >
                    <span className={`w-4.5 h-4.5 shrink-0 flex items-center justify-center rounded-full text-[10px] font-bold ${
                      active ? 'bg-slate-950 text-action-cyan' : done ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {done ? <Check className="w-3 h-3 stroke-[3.5]" /> : '4'}
                    </span>
                    <span>Homologação</span>
                  </button>
                );
              })()}

            </div>
          </div>
        </div>
      )}

      {/* -------------------- STEP 1: JOB SELECTION -------------------- */}
      {activeStep === 1 && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-border-subtle shadow-xs space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-sidebar-navy flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-action-cyan" />
                  <span>Escolha a Oportunidade de Live Marketing</span>
                </h3>
                <p className="text-xs text-text-secondary">Selecione uma vaga para criar sua shortlist e alocar talentos homologados.</p>
              </div>

              {/* View Layout Toggle */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setLayoutMode('table')} 
                  className={`p-2 rounded-lg border transition-all ${layoutMode === 'table' ? 'bg-slate-100 border-slate-300 text-sidebar-navy' : 'bg-white border-border-subtle text-text-secondary'}`}
                  title="Visualização em Tabela"
                >
                  <List className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setLayoutMode('cards')} 
                  className={`p-2 rounded-lg border transition-all ${layoutMode === 'cards' ? 'bg-slate-100 border-slate-300 text-sidebar-navy' : 'bg-white border-border-subtle text-text-secondary'}`}
                  title="Visualização em Cards"
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Status Filter Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-border-subtle pb-3">
              <button
                onClick={() => setJobTabFilter('ativas')}
                className={`p-2 px-4 rounded-xl text-xs font-bold transition-all border ${
                  jobTabFilter === 'ativas'
                    ? 'bg-sidebar-navy text-white border-sidebar-navy'
                    : 'bg-white hover:bg-slate-50 text-text-secondary border-border-subtle'
                }`}
              >
                Ativas ({db.jobs.filter(j => (db.currentUser.profile === 'NÚCLEO' ? j.nucleoId === db.currentUser.nucleoId : true) && ['Oportunidade criada', 'Em shortlist', 'Em negociação', 'Aguardando RH'].includes(j.status)).length})
              </button>
              <button
                onClick={() => setJobTabFilter('bookadas')}
                className={`p-2 px-4 rounded-xl text-xs font-bold transition-all border ${
                  jobTabFilter === 'bookadas'
                    ? 'bg-sidebar-navy text-white border-sidebar-navy'
                    : 'bg-white hover:bg-slate-50 text-text-secondary border-border-subtle'
                }`}
              >
                Bookadas ({db.jobs.filter(j => (db.currentUser.profile === 'NÚCLEO' ? j.nucleoId === db.currentUser.nucleoId : true) && ['Bookado', 'Em andamento', 'Concluído', 'Avaliação pendente'].includes(j.status)).length})
              </button>
              <button
                onClick={() => setJobTabFilter('encerradas')}
                className={`p-2 px-4 rounded-xl text-xs font-bold transition-all border ${
                  jobTabFilter === 'encerradas'
                    ? 'bg-sidebar-navy text-white border-sidebar-navy'
                    : 'bg-white hover:bg-slate-50 text-text-secondary border-border-subtle'
                }`}
              >
                Encerradas ({db.jobs.filter(j => (db.currentUser.profile === 'NÚCLEO' ? j.nucleoId === db.currentUser.nucleoId : true) && ['Encerrado'].includes(j.status)).length})
              </button>
              <button
                onClick={() => setJobTabFilter('todas')}
                className={`p-2 px-4 rounded-xl text-xs font-bold transition-all border ${
                  jobTabFilter === 'todas'
                    ? 'bg-sidebar-navy text-white border-sidebar-navy'
                    : 'bg-white hover:bg-slate-50 text-text-secondary border-border-subtle'
                }`}
              >
                Todas ({db.jobs.filter(j => (db.currentUser.profile === 'NÚCLEO' ? j.nucleoId === db.currentUser.nucleoId : true)).length})
              </button>
            </div>

            {/* Search Input and Filter Collapsible Button */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute inset-y-0 left-3 my-auto w-4.5 h-4.5 text-text-secondary" />
                <input
                  type="text"
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  placeholder="Buscar por nome do job, cliente, função..."
                  className="w-full bg-[#F8FAFC] border border-border-subtle pl-10 pr-4 py-2.5 rounded-xl text-xs text-text-primary focus:outline-none focus:border-action-cyan"
                />
                {jobSearch && (
                  <button onClick={() => setJobSearch('')} className="absolute inset-y-0 right-3 my-auto text-text-secondary">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex items-center gap-1.5 p-2 px-4 border rounded-xl text-xs font-semibold transition-all ${
                  showAdvancedFilters ? 'bg-slate-100 border-slate-300 text-sidebar-navy' : 'bg-white border-border-subtle hover:bg-slate-50'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4 text-action-cyan" />
                <span>Filtros</span>
              </button>
            </div>

            {/* Collapsible Advanced Filters */}
            {showAdvancedFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4 bg-slate-50 rounded-xl border border-border-subtle text-xs animate-fade-in">
                <div>
                  <label className="text-[11px] font-bold text-text-secondary block mb-1">Função Requerida</label>
                  <select
                    value={jobRoleFilter}
                    onChange={(e) => setJobRoleFilter(e.target.value)}
                    className="w-full bg-white border border-border-subtle p-2 rounded-lg text-xs"
                  >
                    <option value="">Todas</option>
                    {uniqueJobRoles.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-secondary block mb-1">Senioridade</label>
                  <select
                    value={jobSeniorityFilter}
                    onChange={(e) => setJobSeniorityFilter(e.target.value)}
                    className="w-full bg-white border border-border-subtle p-2 rounded-lg text-xs"
                  >
                    <option value="">Todas</option>
                    <option value="Júnior">Júnior</option>
                    <option value="Pleno">Pleno</option>
                    <option value="Sênior">Sênior</option>
                    <option value="Especialista">Especialista</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-secondary block mb-1">Urgência</label>
                  <select
                    value={jobUrgencyFilter}
                    onChange={(e) => setJobUrgencyFilter(e.target.value)}
                    className="w-full bg-white border border-border-subtle p-2 rounded-lg text-xs"
                  >
                    <option value="">Todas</option>
                    <option value="Alta">Alta</option>
                    <option value="Média">Média</option>
                    <option value="Baixa">Baixa</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-secondary block mb-1">Orçamento Mín (R$)</label>
                  <input
                    type="number"
                    value={jobBudgetMin}
                    onChange={(e) => setJobBudgetMin(e.target.value)}
                    placeholder="Min"
                    className="w-full bg-white border border-border-subtle p-2 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-secondary block mb-1">Orçamento Máx (R$)</label>
                  <input
                    type="number"
                    value={jobBudgetMax}
                    onChange={(e) => setJobBudgetMax(e.target.value)}
                    placeholder="Max"
                    className="w-full bg-white border border-border-subtle p-2 rounded-lg text-xs"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setJobRoleFilter('');
                      setJobSeniorityFilter('');
                      setJobUrgencyFilter('');
                      setJobBudgetMin('');
                      setJobBudgetMax('');
                      setJobStartDateFilter('');
                      setJobEndDateFilter('');
                    }}
                    className="w-full bg-white hover:bg-slate-100 border border-border-subtle p-2 rounded-lg text-xs text-status-error font-bold text-center"
                  >
                    Limpar Filtros
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* LIST/TABLE OF JOBS — todos os jobs exibidos sem paginação */}
          {layoutMode === 'table' ? (
            <div className="bg-white rounded-2xl border border-border-subtle shadow-xs p-6">
              <ResponsiveDataTable
                columns={columns}
                data={sortedJobs}
                rowKey={(job) => job.id}
                isLoading={false}
                activeSortKey={jobSortKey}
                sortDirection={jobSortDirection}
                onSort={requestJobSort}
                mobileRenderer={mobileJobRenderer}
                emptyState="Nenhum job localizado com os critérios selecionados."
              />
            </div>
          ) : (
            /* Cards layout view mode */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedJobs.length === 0 ? (
                <div className="col-span-full bg-white p-12 text-center text-text-secondary border border-border-subtle rounded-2xl italic">
                  Nenhum job localizado com os critérios selecionados.
                </div>
              ) : (
                sortedJobs.map((job) => {
                  const nucleo = db.nucleos.find(n => n.id === job.nucleoId);
                  const code = job.id.slice(0, 8).toUpperCase();
                  const shCount = db.shortlists.filter(sl => sl.jobId === job.id).length;
                  const dailyAvg = calculateDailyAverage(job);
                  const isSelected = selectedJobIdLocal === job.id;

                  return (
                    <div 
                      key={job.id} 
                      className={`bg-white p-5 rounded-2xl border transition-all duration-200 shadow-xs hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between gap-4 ${
                        isSelected ? 'border-action-cyan ring-1 ring-action-cyan' : 'border-border-subtle'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-mono text-text-secondary font-bold">COD: {code}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            job.status === 'Bookado' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : job.status === 'Aguardando RH'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {job.status}
                          </span>
                        </div>

                        <h4 className="font-bold text-sidebar-navy text-sm">{job.name}</h4>
                        <p className="text-[11px] text-text-secondary font-semibold uppercase">Cliente: {job.client} &bull; {nucleo?.name}</p>
                        
                        <div className="pt-2 border-t border-dashed border-border-subtle text-xs text-text-secondary space-y-1.5">
                          <div className="flex justify-between">
                            <span>Perfil Requerido:</span>
                            <strong className="text-text-primary">{job.roleNeeded} ({job.seniorityNeeded})</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Período:</span>
                            <span className="text-text-primary">
                              {isoToBR(job.startDate)} a {isoToBR(job.endDate)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Budget Máximo:</span>
                            <strong className="text-text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(job.budget)}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Média Diária:</span>
                            <strong className="text-text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dailyAvg)}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-border-subtle mt-1.5">
                        <span className="text-[11px] text-text-secondary font-bold">{shCount} profissionais na shortlist</span>
                        <button
                          onClick={() => handleSelectJob(job.id)}
                          className={`font-bold w-[110px] h-[32px] flex items-center justify-center rounded-lg text-xs border transition-all ${
                            isSelected 
                              ? 'bg-emerald-600 border-emerald-600 text-white' 
                              : 'bg-primary/10 border-primary/20 hover:bg-action-cyan hover:text-white hover:border-action-cyan text-sidebar-navy'
                          }`}
                        >
                          {isSelected ? 'Selecionado' : (job.status?.toLowerCase() === 'bookado' || job.status?.toLowerCase() === 'booked' || job.selectedFreelancerId) ? 'Ver Alocação' : 'Selecionar'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {selectedJobIdLocal && activeJob && (
            <div className="flex justify-end pt-4">
              {activeJob.selectedFreelancerId ? (
                <button
                  onClick={() => handleNavigateStep(4)}
                  className="bg-sidebar-navy hover:bg-sidebar-navy/95 text-white font-bold p-3 px-6 rounded-xl flex items-center gap-2 text-xs shadow-xs"
                >
                  <span>Avançar para Alocação</span>
                  <ArrowRight className="w-4 h-4 text-action-cyan" />
                </button>
              ) : (
                <button
                  onClick={() => handleNavigateStep(2)}
                  className="bg-sidebar-navy hover:bg-sidebar-navy/95 text-white font-bold p-3 px-6 rounded-xl flex items-center gap-2 text-xs shadow-xs"
                >
                  <span>Avançar para Shortlist</span>
                  <ArrowRight className="w-4 h-4 text-action-cyan" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* -------------------- STEP 2: SHORTLIST COMPOSITION -------------------- */}
      {activeStep === 2 && activeJob && (
        <div className="space-y-6">
          {/* Active Job Meta-Header — STICKY no topo ao dar scroll com descrição formatada */}
          {(() => {
            const nucleoName = db.nucleos.find(n => n.id === activeJob.nucleoId)?.name || '—';
            const model = activeJob.remunerationModel || 'monthly_salary';
            const paymentFlowLabel =
              (model as string) === 'monthly_salary' || (model as string) === 'monthly' ? 'Mensal / Salário por Período' :
              model === 'daily' ? 'Diária' :
              model === 'hourly' ? 'Hora' :
              (model as string) === 'fixed_job' || (model as string) === 'closed_package' ? 'Job Fechado (Parcela Única)' :
              (activeJob.paymentFlow === 'recurring' ? 'Recorrente Mensal' : 'Pagamento Único');

            const projections = simulatePaymentProjections(activeJob.startDate, activeJob.endDate, model);
            const monthlyRate = activeJob.expectedRate && activeJob.expectedRate > 0
              ? activeJob.expectedRate
              : (projections.length > 0 && activeJob.budget > 0 ? activeJob.budget / projections.length : 0);

            const installmentSummaryText = projections.length > 1
              ? ` (${projections.length} parcelas de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthlyRate)}/mês)`
              : '';

            const referenceRateLabel =
              (model as string) === 'monthly_salary' || (model as string) === 'monthly' ? 'Valor Mensal de Referência' :
              model === 'daily' ? 'Diária de Referência' :
              model === 'hourly' ? 'Valor Hora de Referência' :
              (model as string) === 'fixed_job' || (model as string) === 'closed_package' ? 'Valor Fechado de Referência' :
              'Taxa de Referência';

            const referenceRate = activeJob.expectedRate && activeJob.expectedRate > 0
              ? activeJob.expectedRate
              : (projections.length > 1 && activeJob.budget > 0 ? activeJob.budget / projections.length : activeJob.budget);
            const paymentDay = activeJob.expectedPaymentDay;

            return (
              <div
                className="bg-slate-900/95 text-slate-100 p-5 rounded-2xl border border-slate-700/80 shadow-xl flex flex-col md:flex-row justify-between gap-6 job-meta-header sticky top-0 z-30 transition-all duration-300"
                style={{ backdropFilter: 'blur(10px)' }}
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-slate-950 text-slate-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-slate-800">
                      COD: {activeJob.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className="text-[11px] uppercase font-extrabold text-action-cyan tracking-wider">Oportunidade Selecionada</span>
                    <span className="bg-blue-950 text-blue-300 border border-blue-800/80 px-2.5 py-0.5 rounded text-[10px] font-bold">{activeJob.status}</span>
                  </div>

                  <h3 className="text-base font-extrabold text-white leading-tight">[{activeJob.client}] {activeJob.name}</h3>

                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-300">
                    <div>Núcleo: <strong className="text-white">{nucleoName}</strong></div>
                    <div>Função: <strong className="text-white">{activeJob.roleNeeded} ({activeJob.seniorityNeeded})</strong></div>
                    <div>Urgência: <strong className={activeJob.urgency === 'Alta' ? 'text-red-400 font-bold' : 'text-slate-200'}>{activeJob.urgency}</strong></div>
                    <div>Período: <strong className="text-white">{isoToBR(activeJob.startDate)} a {isoToBR(activeJob.endDate)}</strong></div>
                    <div>Modelo / Fluxo: <strong className="text-emerald-300 font-bold">{paymentFlowLabel}{installmentSummaryText}</strong></div>
                    {paymentDay && <div>Vencimento Preferencial: <strong className="text-white">Dia {paymentDay}</strong></div>}
                    {referenceRate > 0 && <div>{referenceRateLabel}: <strong className="text-amber-300 font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(referenceRate)}</strong></div>}
                  </div>

                  {/* Formatted Description with Expand/Collapse */}
                  {activeJob.description && (
                    <JobDescriptionFormatted description={activeJob.description} />
                  )}
                </div>

                <div className="flex flex-col justify-between items-end gap-3 min-w-[180px] shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Budget Máximo do Job</div>
                    <div className="text-lg font-black text-action-cyan">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(activeJob.budget)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                      Média diária: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateDailyAverage(activeJob))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleClearJob}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold p-2 px-3.5 rounded-xl text-xs transition-all border border-slate-700 cursor-pointer shadow-xs"
                    >
                      Trocar Job
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Booked Locked Alert Banner */}
          {activeJob.selectedFreelancerId && (
            <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl flex items-start gap-3">
              <Lock className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-emerald-900 text-xs">🔒 Contratação Consolidada</h4>
                <p className="text-[11px] text-emerald-800 leading-normal mt-0.5">
                  Esta vaga foi fechada com o profissional <strong>{db.freelancers.find(f => f.id === activeJob.selectedFreelancerId)?.name}</strong>.
                  Para manter a integridade fiscal, a shortlist foi congelada em modo de leitura histórica.
                </p>
              </div>
            </div>
          )}

          {/* Main Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* LEFT COLUMN: BANCO DE TALENTOS */}
            <div className="xl:col-span-7 space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-border-subtle shadow-xs space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-sidebar-navy text-sm flex items-center gap-1.5">
                      <Search className="w-4 h-4 text-action-cyan" />
                      <span>Banco de Talentos Homologados V3A</span>
                    </h4>
                    <p className="text-[11px] text-text-secondary mt-0.5">Busque e filtre freelancers compatíveis no banco de dados.</p>
                  </div>

                  <button
                    onClick={() => setShowCandidateFilters(!showCandidateFilters)}
                    className={`flex items-center gap-1.5 p-1.5 px-3 border rounded-lg text-xs font-semibold transition-all ${
                      showCandidateFilters ? 'bg-slate-100 border-slate-300 text-sidebar-navy' : 'bg-white border-border-subtle hover:bg-slate-50'
                    }`}
                  >
                    <Filter className="w-3.5 h-3.5 text-action-cyan" />
                    <span>Filtros</span>
                  </button>
                </div>

                {/* Candidate search criteria inputs */}
                <div className="relative">
                  <Search className="absolute inset-y-0 left-3 my-auto w-4 h-4 text-text-secondary" />
                  <input
                    type="text"
                    value={candidateSearch}
                    onChange={(e) => setCandidateSearch(e.target.value)}
                    placeholder="Buscar freelancer por nome ou função..."
                    className="w-full bg-bg-input border border-border-subtle pl-9 pr-4 py-2.5 rounded-lg text-sm focus:outline-none focus:border-action-cyan text-text-primary"
                  />
                  {candidateSearch && (
                    <button onClick={() => setCandidateSearch('')} className="absolute inset-y-0 right-3 my-auto text-text-secondary">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {showCandidateFilters && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-border-subtle text-xs animate-fade-in">
                    <div>
                      <label className="text-[11px] font-bold text-text-secondary block mb-1">Função / Perfil</label>
                      <select
                        value={candidateRole}
                        onChange={(e) => setCandidateRole(e.target.value)}
                        className="w-full bg-white border border-border-subtle p-1.5 rounded-lg text-xs"
                      >
                        <option value="">Todas</option>
                        {uniqueFreelancerRoles.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-text-secondary block mb-1">Senioridade</label>
                      <select
                        value={candidateSeniority}
                        onChange={(e) => setCandidateSeniority(e.target.value)}
                        className="w-full bg-white border border-border-subtle p-1.5 rounded-lg text-xs"
                      >
                        <option value="">Todas</option>
                        <option value="Júnior">Júnior</option>
                        <option value="Pleno">Pleno</option>
                        <option value="Sênior">Sênior</option>
                        <option value="Especialista">Especialista</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-text-secondary block mb-1">Score Mínimo</label>
                      <select
                        value={candidateMinScore}
                        onChange={(e) => setCandidateMinScore(Number(e.target.value))}
                        className="w-full bg-white border border-border-subtle p-1.5 rounded-lg text-xs"
                      >
                        <option value={0}>Todos</option>
                        <option value={3.5}>3.5+ Estrelas</option>
                        <option value={4.0}>4.0+ Estrelas</option>
                        <option value={4.5}>4.5+ Estrelas</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-text-secondary block mb-1">Cidade / UF</label>
                      <input
                        type="text"
                        value={candidateLocation}
                        onChange={(e) => setCandidateLocation(e.target.value)}
                        placeholder="Ex: São Paulo"
                        className="w-full bg-white border border-border-subtle p-1.5 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-text-secondary block mb-1">Taxa Diária Máx (R$)</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-text-secondary select-none">R$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={candidateMaxRate}
                          onChange={(e) => setCandidateMaxRate(maskCurrencyBRL(e.target.value))}
                          onBlur={() => {
                            const numeric = parseCurrencyBR(candidateMaxRate);
                            if (numeric > 0) {
                              setCandidateMaxRate(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric));
                            }
                          }}
                          placeholder="Valor máximo"
                          className="w-full bg-white border border-border-subtle p-1.5 pl-6.5 rounded-lg text-xs text-text-primary"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-text-secondary block mb-1">Marcas / Setores</label>
                      <input
                        type="text"
                        value={candidateBrands}
                        onChange={(e) => setCandidateBrands(e.target.value)}
                        placeholder="Ex: Automotivo"
                        className="w-full bg-white border border-border-subtle p-1.5 rounded-lg text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2 flex items-center justify-between pt-2">
                      <span className="text-[11px] font-bold text-text-secondary">Somente talentos com histórico na V3A:</span>
                      <button
                        type="button"
                        onClick={() => setCandidateV3aExp(p => p === null ? true : p === true ? false : null)}
                        className={`p-1.5 px-3 rounded-lg text-[10px] font-bold border transition-all ${
                          candidateV3aExp === true 
                            ? 'bg-sidebar-navy border-sidebar-navy text-white' 
                            : candidateV3aExp === false 
                              ? 'bg-slate-200 border-slate-300 text-slate-800' 
                              : 'bg-white border-border-subtle text-text-secondary'
                        }`}
                      >
                        {candidateV3aExp === true ? 'Sim' : candidateV3aExp === false ? 'Não' : 'Todos'}
                      </button>
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={() => {
                          setCandidateRole(activeJob.roleNeeded);
                          setCandidateSeniority(activeJob.seniorityNeeded);
                          setCandidateSearch('');
                          setCandidateMinScore(0);
                          setCandidateLocation('');
                          setCandidateMaxRate('');
                          setCandidateAvailability('');
                          setCandidateV3aExp(null);
                          setCandidateBrands('');
                          setRequireExactRole(false);
                          setRequireExactSeniority(false);
                          setShowBelowSeniority(true);
                          setShowAboveBudget(true);
                        }}
                        className="w-full bg-white hover:bg-slate-100 border border-border-subtle p-1.5 rounded-lg text-xs text-status-error font-bold text-center"
                      >
                        Resetar Filtros
                      </button>
                    </div>

                    <div className="sm:col-span-3 border-t border-border-subtle pt-3 mt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <label className="flex items-center gap-2 text-[11px] font-semibold text-text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={requireExactRole}
                          onChange={(e) => setRequireExactRole(e.target.checked)}
                          className="rounded text-action-cyan focus:ring-action-cyan w-3.5 h-3.5 bg-bg-surface border-border-subtle"
                        />
                        <span>Exigir função exata</span>
                      </label>

                      <label className="flex items-center gap-2 text-[11px] font-semibold text-text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={requireExactSeniority}
                          onChange={(e) => setRequireExactSeniority(e.target.checked)}
                          className="rounded text-action-cyan focus:ring-action-cyan w-3.5 h-3.5 bg-bg-surface border-border-subtle"
                        />
                        <span>Exigir senioridade exata</span>
                      </label>

                      <label className="flex items-center gap-2 text-[11px] font-semibold text-text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showBelowSeniority}
                          onChange={(e) => setShowBelowSeniority(e.target.checked)}
                          className="rounded text-action-cyan focus:ring-action-cyan w-3.5 h-3.5 bg-bg-surface border-border-subtle"
                        />
                        <span>Mostrar alt. abaixo senioridade</span>
                      </label>

                      <label className="flex items-center gap-2 text-[11px] font-semibold text-text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showAboveBudget}
                          onChange={(e) => setShowAboveBudget(e.target.checked)}
                          className="rounded text-action-cyan focus:ring-action-cyan w-3.5 h-3.5 bg-bg-surface border-border-subtle"
                        />
                        <span>Mostrar opções acima budget</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* MATCH TIERS DIRECTIVES */}
                <div className="pt-2 border-t border-border-subtle space-y-4">
                  
                  {/* Melhores Matches Folder */}
                  <div className="accordion-match accordion-best border border-emerald-700/40 rounded-xl overflow-hidden shadow-xs">
                    <button 
                      onClick={() => setExpandBestMatches(!expandBestMatches)}
                      className="w-full bg-emerald-900/30 p-3 flex justify-between items-center text-xs font-bold text-emerald-300 border-b border-emerald-700/40 hover:bg-emerald-900/40 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-emerald-400" />
                        <span>🏆 Melhores Matches ({matches.best.length})</span>
                      </span>
                      {expandBestMatches ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {expandBestMatches && (
                      <div className="divide-y divide-border-subtle max-h-[400px] overflow-y-auto bg-bg-surface">
                        {matches.best.length === 0 ? (
                          <p className="p-4 text-center text-text-secondary italic text-xs">Nenhum match com pontuação ideal e histórico V3A localizado.</p>
                        ) : (
                          matches.best.map(cand => renderCandidateRow(cand))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Boas Alternativas Folder */}
                  <div className="accordion-match accordion-good border border-blue-700/40 rounded-xl overflow-hidden shadow-xs">
                    <button 
                      onClick={() => setExpandGoodMatches(!expandGoodMatches)}
                      className="w-full bg-blue-900/30 p-3 flex justify-between items-center text-xs font-bold text-blue-300 border-b border-blue-700/40 hover:bg-blue-900/40 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                        <span>⚡ Boas Alternativas ({matches.good.length})</span>
                      </span>
                      {expandGoodMatches ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {expandGoodMatches && (
                      <div className="divide-y divide-border-subtle max-h-[400px] overflow-y-auto bg-bg-surface">
                        {matches.good.length === 0 ? (
                          <p className="p-4 text-center text-text-secondary italic text-xs">Nenhuma alternativa compatível localizada.</p>
                        ) : (
                          matches.good.map(cand => renderCandidateRow(cand))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Outras Opções Folder */}
                  <div className="accordion-match accordion-neutral border border-slate-600/40 rounded-xl overflow-hidden shadow-xs">
                    <button 
                      onClick={() => setExpandOtherMatches(!expandOtherMatches)}
                      className="w-full bg-slate-700/40 p-3 flex justify-between items-center text-xs font-bold text-slate-300 border-b border-slate-600/40 hover:bg-slate-700/60 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span>👥 Outras Opções ({matches.other.length})</span>
                      </span>
                      {expandOtherMatches ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {expandOtherMatches && (
                      <div className="divide-y divide-border-subtle max-h-[400px] overflow-y-auto bg-bg-surface">
                        {matches.other.length === 0 ? (
                          <p className="p-4 text-center text-text-secondary italic text-xs">Nenhum profissional elegível.</p>
                        ) : (
                          matches.other.map(cand => renderCandidateRow(cand))
                        )}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: SHORTLIST OFICIAL DA VAGA */}
            <div className="xl:col-span-5 space-y-4">
              <div 
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!activeJob.selectedFreelancerId) {
                    setIsDraggingOver(true);
                  }
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                  if (activeJob.selectedFreelancerId) return;
                  const freelancerId = e.dataTransfer.getData('text/plain');
                  if (freelancerId) {
                    handleAddToShortlist(freelancerId);
                  }
                }}
                className={`bg-white p-5 rounded-2xl border-2 transition-all shadow-xs space-y-4 ${
                  isDraggingOver 
                    ? 'border-dashed border-action-cyan bg-action-cyan/5 scale-[1.01]' 
                    : 'border-border-subtle'
                }`}
              >
                <div>
                  <h4 className="font-bold text-sidebar-navy text-sm flex items-center gap-1.5">
                    <CheckCircle className="w-4.5 h-4.5 text-emerald-600" />
                    <span>Shortlist Oficial da Demanda ({jobShortlists.length})</span>
                  </h4>
                  <p className="text-[11px] text-text-secondary mt-0.5">Arraste talentos aqui ou clique em "Adicionar" para compor a shortlist.</p>
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                  {jobShortlists.length === 0 ? (
                    <div className="p-8 text-center text-text-secondary border border-dashed border-border-subtle rounded-2xl italic text-xs">
                      Shortlist vazia. Arraste profissionais recomendados aqui ou use o botão de fallback no painel lateral.
                    </div>
                  ) : (
                    jobShortlists.map(sl => {
                      const cand = db.freelancers.find(f => f.id === sl.freelancerId);
                      const isBooked = activeJob.selectedFreelancerId === sl.freelancerId;
                      const statusVal = saveStatus[sl.freelancerId] || 'idle';

                      return (
                        <div 
                          key={sl.id} 
                          className={`p-4 rounded-xl border transition-all ${
                            isBooked 
                              ? 'border-emerald-300 bg-emerald-50/20 ring-1 ring-emerald-300' 
                              : 'border-border-subtle hover:border-slate-300'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <strong className="text-sidebar-navy font-bold text-xs">{cand?.name}</strong>
                                <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-1.5 py-0.2 rounded">{cand?.seniority}</span>
                                {activeJob.success_fee_enabled && (
                                  <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[9px] font-bold px-1.5 py-0.2 rounded dark:bg-indigo-950/20 dark:text-indigo-300 dark:border-indigo-900/30 flex items-center gap-0.5">
                                    <Award className="w-2.5 h-2.5 text-indigo-500" />
                                    <span>Success Fee</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-text-secondary">{cand?.mainRole}</p>
                              <div className="flex items-center gap-1.5 mt-1 text-[11.5px]">
                                <ScoreStars score={cand?.averageScore} size="sm" showNumber={true} />
                                <span className="text-text-secondary">&bull; R$ {cand?.referenceValue}/diária</span>
                              </div>
                            </div>

                            <button
                              disabled={!!activeJob.selectedFreelancerId}
                              onClick={() => handleRemoveFromShortlist(sl.freelancerId)}
                              className="text-text-secondary hover:text-status-error disabled:opacity-30 font-bold text-xs"
                            >
                              Remover
                            </button>
                          </div>

                          {/* Candidate Observations / Notes */}
                          <div className="mt-3.5 space-y-2.5 pt-3 border-t border-dashed border-border-subtle text-xs">
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="text-[11px] font-bold text-text-secondary">Observações / Notas internas</label>
                                {statusVal === 'saving' && <span className="text-[10px] text-action-cyan animate-pulse">Gravando...</span>}
                                {statusVal === 'saved' && <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5"><Check className="w-3 h-3" /> Salvo</span>}
                              </div>
                              <textarea
                                disabled={!!activeJob.selectedFreelancerId}
                                defaultValue={sl.notes || ''}
                                onBlur={(e) => handleNotesChange(sl.freelancerId, e.target.value)}
                                placeholder="Insira restrições de agenda, escopo acertado ou contrapropostas de valores..."
                                rows={2}
                                className="w-full bg-white border border-border-subtle p-2 rounded-lg text-xs focus:outline-none focus:border-action-cyan disabled:bg-slate-50 disabled:opacity-85 text-text-primary resize-y"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-border-subtle">
            <button
              onClick={() => handleNavigateStep(1)}
              className="bg-white border border-border-subtle hover:bg-slate-50 text-text-primary font-bold p-3 px-6 rounded-xl text-xs transition-all"
            >
              Voltar para Seleção de Job
            </button>

            {jobShortlists.length > 0 && (
              <div className="flex gap-2">
                <button
                  disabled={isDispatchingEmails}
                  onClick={handleConfirmShortlistAndDispatchProposals}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold p-3 px-6 rounded-xl flex items-center gap-2 text-xs shadow-md disabled:opacity-50 transition-all"
                >
                  <Mail className="w-4 h-4" />
                  <span>{isDispatchingEmails ? 'Confirmando & Disparando...' : 'Confirmar Shortlist Oficial & Disparar Propostas'}</span>
                </button>
                <button
                  onClick={() => handleNavigateStep(3)}
                  className="bg-sidebar-navy hover:bg-sidebar-navy/95 text-white font-bold p-3 px-5 rounded-xl flex items-center gap-2 text-xs shadow-xs"
                >
                  <span>Negociação</span>
                  <ArrowRight className="w-4 h-4 text-action-cyan" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------- STEP 3: CONTRACT NEGOTIATION -------------------- */}
      {activeStep === 3 && activeJob && (
        <div className="space-y-6 animate-fade-in">
          {/* Active Job Meta-Header — STICKY no topo ao dar scroll com descrição formatada */}
          {(() => {
            const nucleoName = db.nucleos.find(n => n.id === activeJob.nucleoId)?.name || '—';
            const model = activeJob.remunerationModel || 'monthly_salary';
            const paymentFlowLabel =
              (model as string) === 'monthly_salary' || (model as string) === 'monthly' ? 'Mensal / Salário por Período' :
              model === 'daily' ? 'Diária' :
              model === 'hourly' ? 'Hora' :
              (model as string) === 'fixed_job' || (model as string) === 'closed_package' ? 'Job Fechado (Parcela Única)' :
              (activeJob.paymentFlow === 'recurring' ? 'Recorrente Mensal' : 'Pagamento Único');

            const projections = simulatePaymentProjections(activeJob.startDate, activeJob.endDate, model);
            const monthlyRate = activeJob.expectedRate && activeJob.expectedRate > 0
              ? activeJob.expectedRate
              : (projections.length > 0 && activeJob.budget > 0 ? activeJob.budget / projections.length : 0);

            const installmentSummaryText = projections.length > 1
              ? ` (${projections.length} parcelas de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthlyRate)}/mês)`
              : '';

            const referenceRateLabel =
              (model as string) === 'monthly_salary' || (model as string) === 'monthly' ? 'Valor Mensal de Referência' :
              model === 'daily' ? 'Diária de Referência' :
              model === 'hourly' ? 'Valor Hora de Referência' :
              (model as string) === 'fixed_job' || (model as string) === 'closed_package' ? 'Valor Fechado de Referência' :
              'Taxa de Referência';

            const referenceRate = activeJob.expectedRate && activeJob.expectedRate > 0
              ? activeJob.expectedRate
              : (projections.length > 1 && activeJob.budget > 0 ? activeJob.budget / projections.length : activeJob.budget);
            const paymentDay = activeJob.expectedPaymentDay;

            return (
              <div
                className="bg-slate-900/95 text-slate-100 p-4 rounded-2xl border border-slate-700/80 shadow-xl flex flex-col md:flex-row justify-between gap-4 job-meta-header sticky top-0 z-30 transition-all duration-300"
                style={{ backdropFilter: 'blur(10px)' }}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-slate-950 text-slate-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-slate-800">
                      COD: {activeJob.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className="text-[10px] uppercase font-extrabold text-action-cyan tracking-wider">Negociação Individual</span>
                    <span className="bg-blue-950 text-blue-300 border border-blue-800/80 px-2.5 py-0.5 rounded text-[10px] font-bold">{activeJob.status}</span>
                  </div>

                  <h3 className="text-sm font-extrabold text-white leading-tight">[{activeJob.client}] {activeJob.name}</h3>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-300">
                    <div>Núcleo: <strong className="text-white">{nucleoName}</strong></div>
                    <div>Função: <strong className="text-white">{activeJob.roleNeeded} ({activeJob.seniorityNeeded})</strong></div>
                    <div>Urgência: <strong className={activeJob.urgency === 'Alta' ? 'text-red-400 font-bold' : 'text-slate-200'}>{activeJob.urgency}</strong></div>
                    <div>Período: <strong className="text-white">{isoToBR(activeJob.startDate)} a {isoToBR(activeJob.endDate)}</strong></div>
                    <div>Modelo / Fluxo: <strong className="text-emerald-300 font-bold">{paymentFlowLabel}{installmentSummaryText}</strong></div>
                    {paymentDay && <div>Vencimento Preferencial: <strong className="text-white">Dia {paymentDay}</strong></div>}
                    {referenceRate > 0 && <div>{referenceRateLabel}: <strong className="text-amber-300 font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(referenceRate)}</strong></div>}
                  </div>

                  {/* Formatted Description with Expand/Collapse */}
                  {activeJob.description && (
                    <JobDescriptionFormatted description={activeJob.description} />
                  )}
                </div>

                <div className="flex flex-col justify-between items-end gap-2 shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Budget Máximo do Job</div>
                    <div className="text-base font-black text-action-cyan">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(activeJob.budget)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                      Média diária: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateDailyAverage(activeJob))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleNavigateStep(2)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold p-2 px-3 rounded-lg text-xs transition-all border border-slate-700 whitespace-nowrap cursor-pointer shadow-xs"
                  >
                    Voltar para Shortlist
                  </button>
                </div>
              </div>
            );
          })()}

          {/* COMPARISON GRID BETWEEN FREELANCERS */}
          {jobShortlists.length > 1 && (
            <div className="bg-[#1E293B] border border-slate-700/50 p-6 rounded-2xl shadow-lg space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h4 className="font-extrabold text-white text-sm uppercase tracking-wider flex items-center gap-1.5">
                    <SlidersHorizontal className="w-5 h-5 text-action-cyan" />
                    <span>Painel Comparativo de Propostas</span>
                  </h4>
                  <p className="text-xs text-slate-350">RH, Master e Heads de Núcleo podem comparar o impacto financeiro de cada opção.</p>
                </div>

                {/* Sorting Controls */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-400 font-bold">Ordenar por:</span>
                  <button
                    type="button"
                    onClick={() => setCompareSortKey('default')}
                    className={`p-2 px-3 rounded-lg font-bold transition-all border ${
                      compareSortKey === 'default'
                        ? 'bg-action-cyan text-sidebar-navy border-action-cyan'
                        : 'bg-slate-800 text-slate-300 border-slate-750 hover:bg-slate-750'
                    }`}
                  >
                    Status
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompareSortKey('saving')}
                    className={`p-2 px-3 rounded-lg font-bold transition-all border ${
                      compareSortKey === 'saving'
                        ? 'bg-action-cyan text-sidebar-navy border-action-cyan'
                        : 'bg-slate-800 text-slate-300 border-slate-750 hover:bg-slate-750'
                    }`}
                  >
                    Maior Saving
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompareSortKey('total')}
                    className={`p-2 px-3 rounded-lg font-bold transition-all border ${
                      compareSortKey === 'total'
                        ? 'bg-action-cyan text-sidebar-navy border-action-cyan'
                        : 'bg-slate-800 text-slate-300 border-slate-750 hover:bg-slate-750'
                    }`}
                  >
                    Menor Total
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompareSortKey('score')}
                    className={`p-2 px-3 rounded-lg font-bold transition-all border ${
                      compareSortKey === 'score'
                        ? 'bg-action-cyan text-sidebar-navy border-action-cyan'
                        : 'bg-slate-800 text-slate-300 border-slate-750 hover:bg-slate-750'
                    }`}
                  >
                    Melhor Score
                  </button>
                </div>
              </div>

              {/* Table Wrapper for Desktop */}
              <div className="hidden md:block rounded-xl border border-slate-750 overflow-visible">
                <table className="w-full text-left text-xs border-collapse sticky-table-header">
                  <thead>
                    <tr className="bg-slate-800 border-b border-slate-750 text-slate-200">
                      <th className="p-3.5 font-bold uppercase tracking-wider">Freelancer</th>
                      <th className="p-3.5 font-bold uppercase tracking-wider">Status Negociação</th>
                      <th className="p-3.5 font-bold uppercase tracking-wider text-right">Rate Negociado</th>
                      <th className="p-3.5 font-bold uppercase tracking-wider text-right">Total Negociado</th>
                      <th className="p-3.5 font-bold uppercase tracking-wider text-right">Saving</th>
                      <th className="p-3.5 font-bold uppercase tracking-wider text-center">Saving %</th>
                      <th className="p-3.5 font-bold uppercase tracking-wider text-center">Política</th>
                      <th className="p-3.5 font-bold uppercase tracking-wider text-center">Agenda</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/30 text-slate-300">
                    {sortedCompareList.map(({ sl, cand, rate, billing, negotiatedTotal, savingAmount, savingPercentage, exceedsCeiling, hasConflict }) => (
                      <tr key={sl.id} className={`hover:bg-slate-800/30 transition-colors ${sl.candidateStatus === 'Não aceitou' ? 'opacity-40 grayscale' : ''}`}>
                        <td className="p-3.5">
                          <div className="font-bold text-white">{cand?.name || '—'}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{cand?.seniority} &bull; {cand?.mainRole}</div>
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sl.candidateStatus === 'Aceitou' || sl.candidateStatus === 'Aprovado pelo Head'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                              : sl.candidateStatus === 'Valor fora da política' || sl.candidateStatus === 'Reprovado pelo Head' || sl.candidateStatus === 'Aceitou com ressalva'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800/50'
                                : sl.candidateStatus === 'Bloqueado por conflito de agenda' || sl.candidateStatus === 'Não aceitou'
                                  ? 'bg-red-950 text-red-400 border border-red-800/50'
                                  : 'bg-slate-800 text-slate-300 border border-slate-700/60'
                          }`}>
                            {sl.candidateStatus}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-semibold">
                          {formatCurrencyBRL(rate)}/{billing === 'Hora' ? 'h' : billing === 'Diária' ? 'dia' : 'job'}
                        </td>
                        <td className="p-3.5 text-right font-bold text-white">
                          {formatCurrencyBRL(negotiatedTotal)}
                        </td>
                        <td className={`p-3.5 text-right font-bold ${
                          savingAmount > 0 
                            ? 'text-emerald-450' 
                            : savingAmount < 0 
                              ? 'text-red-400' 
                              : 'text-slate-300'
                        }`}>
                          {savingAmount < 0 
                            ? `-${formatCurrencyBRL(Math.abs(savingAmount))}` 
                            : formatCurrencyBRL(savingAmount)
                          }
                        </td>
                        <td className={`p-3.5 text-center font-bold ${
                          savingAmount > 0 
                            ? 'text-emerald-450' 
                            : savingAmount < 0 
                              ? 'text-red-400' 
                              : 'text-slate-300'
                        }`}>
                          {savingAmount < 0 
                            ? `${Math.abs(Math.round(savingPercentage))}% acima` 
                            : formatPercentage(savingPercentage)
                          }
                        </td>
                        <td className="p-3.5 text-center">
                          {exceedsCeiling ? (
                            <span className="text-red-400 font-bold bg-red-950/40 p-1 px-2 rounded border border-red-900/40">Excedeu</span>
                          ) : (
                            <span className="text-emerald-400 font-bold bg-emerald-950/40 p-1 px-2 rounded border border-emerald-900/40">Dentro</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          {hasConflict ? (
                            <span className="text-red-400 font-bold bg-red-950/40 p-1 px-2 rounded border border-red-900/40">Conflito</span>
                          ) : (
                            <span className="text-emerald-400 font-semibold bg-emerald-950/40 p-1 px-2 rounded border border-emerald-900/40">Livre</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards Wrapper for Mobile */}
              <div className="md:hidden space-y-3">
                {sortedCompareList.map(({ sl, cand, rate, billing, negotiatedTotal, savingAmount, savingPercentage, exceedsCeiling, hasConflict }) => (
                  <div key={sl.id} className={`bg-slate-900/40 p-4 rounded-xl border border-slate-750 space-y-3 ${sl.candidateStatus === 'Não aceitou' ? 'opacity-40 grayscale' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-white text-xs">{cand?.name || '—'}</div>
                        <div className="text-[10px] text-slate-400">{cand?.seniority} &bull; {cand?.mainRole}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        sl.candidateStatus === 'Aceitou' || sl.candidateStatus === 'Aprovado pelo Head'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : sl.candidateStatus === 'Valor fora da política' || sl.candidateStatus === 'Reprovado pelo Head' || sl.candidateStatus === 'Aceitou com ressalva'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800/50'
                            : sl.candidateStatus === 'Bloqueado por conflito de agenda' || sl.candidateStatus === 'Não aceitou'
                              ? 'bg-red-950 text-red-400 border border-red-800/50'
                              : 'bg-slate-800 text-slate-350'
                      }`}>
                        {sl.candidateStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-400 block">Rate Negociado:</span>
                        <strong className="text-white">{formatCurrencyBRL(rate)}/{billing === 'Hora' ? 'h' : billing === 'Diária' ? 'dia' : 'job'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Total Negociado:</span>
                        <strong className="text-white">{formatCurrencyBRL(negotiatedTotal)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Saving Gerado:</span>
                        <strong className={savingAmount > 0 ? 'text-emerald-400' : savingAmount < 0 ? 'text-red-400' : 'text-slate-300'}>
                          {savingAmount < 0 
                            ? `-${formatCurrencyBRL(Math.abs(savingAmount))}` 
                            : formatCurrencyBRL(savingAmount)
                          }
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Saving %:</span>
                        <strong className={savingAmount > 0 ? 'text-emerald-400' : savingAmount < 0 ? 'text-red-400' : 'text-slate-300'}>
                          {savingAmount < 0 
                            ? `${Math.abs(Math.round(savingPercentage))}% acima` 
                            : formatPercentage(savingPercentage)
                          }
                        </strong>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-2 text-[9px] font-bold">
                      <span className={`p-1 px-2 rounded ${exceedsCeiling ? 'bg-red-950 text-red-400' : 'bg-emerald-950 text-emerald-400'}`}>
                        Política: {exceedsCeiling ? 'Excedeu' : 'Dentro'}
                      </span>
                      <span className={`p-1 px-2 rounded ${hasConflict ? 'bg-red-950 text-red-400' : 'bg-emerald-950 text-emerald-400'}`}>
                        Agenda: {hasConflict ? 'Conflito' : 'Livre'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cards for each candidate in shortlist */}
          <div className="grid grid-cols-1 gap-6">
            {sortedCompareList.length === 0 ? (
              <div className="bg-white p-12 text-center text-text-secondary border border-border-subtle rounded-2xl italic text-xs">
                Nenhum candidato na shortlist para negociar. Volte para o Passo 2.
              </div>
            ) : (
              sortedCompareList.map(({ sl, cand }) => {
                if (!cand) return null;

                const isJobMonthly = (activeJob?.remunerationModel as string) === 'monthly_salary' || (activeJob?.remunerationModel as string) === 'monthly' || activeJob?.paymentFlow === 'recurring';
                const defaultBilling = 
                  isJobMonthly ? 'Mensal / Salário por período' :
                  activeJob?.remunerationModel === 'hourly' ? 'Hora' :
                  ((activeJob?.remunerationModel as string) === 'fixed_job' || (activeJob?.remunerationModel as string) === 'closed_package') ? 'Job Fechado' : 'Diária';
                
                // Keep defaultBilling for monthly jobs unless user explicitly selected a non-default model
                const billing = sl.remunerationModel && sl.remunerationModel !== 'Diária' && sl.remunerationModel !== 'daily'
                  ? sl.remunerationModel 
                  : defaultBilling;

                const targetModel = billing;
                const billingTypeForMatch = 
                  ['daily', 'diaria', 'diária'].includes(targetModel.toLowerCase()) ? 'Diária' :
                  ['hourly', 'hora'].includes(targetModel.toLowerCase()) ? 'Hora' :
                  ['fixed_job', 'pacote', 'job fechado', 'projeto'].includes(targetModel.toLowerCase()) ? 'Job Fechado' : 'Mensal / Salário';

                const policy = db.policies.find(p => 
                  p.role === activeJob.roleNeeded && 
                  p.seniority === activeJob.seniorityNeeded && 
                  p.billingType === billingTypeForMatch
                );
                const ceilingValue = policy ? policy.ceilingValue : 99999;
                const referenceValue = policy ? policy.referenceValue : 0;

                // Pre-populate rate: for initial phase, force activeJob.expectedRate
                const defaultRate = (activeJob?.expectedRate && activeJob.expectedRate > 0)
                  ? activeJob.expectedRate
                  : (cand.referenceValue || 0);
                const rate = (sl.negotiatedRate != null && sl.negotiatedRate > 0) ? sl.negotiatedRate : defaultRate;
                
                const hasConflict = hasScheduleConflict(cand.id, activeJob.startDate, activeJob.endDate);
                const exceedsCeiling = rate > ceilingValue;

                const conflictApproval = db.approvals?.find(ap => 
                  ap.shortlistCandidateId === sl.id && 
                  ap.approvalType === 'schedule_conflict' &&
                  ap.freelancerId === cand.id
                );
                const isConflictApproved = conflictApproval?.status === 'approved';
                const isConflictPending = conflictApproval?.status === 'pending';

                const budgetApproval = db.approvals?.find(ap => 
                  ap.shortlistCandidateId === sl.id && 
                  ap.approvalType === 'value_exception' &&
                  ap.freelancerId === cand.id
                );
                const isBudgetApproved = budgetApproval?.status === 'approved';
                const isBudgetPending = budgetApproval?.status === 'pending';

                let isLocked = isConflictPending || isBudgetPending || !!activeJob.selectedFreelancerId;
                
                return (
                  <div key={sl.id} className="bg-white p-6 rounded-2xl border border-border-subtle shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Freelancer Header Info */}
                    <div className="lg:col-span-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sidebar-navy text-sm">{cand.name}</h4>
                        <span className="bg-neutral-bg text-neutral-text border border-neutral-border/30 text-[10px] font-bold px-2 py-0.5 rounded-md">{cand.seniority}</span>
                      </div>
                      <p className="text-xs text-text-secondary">{cand.mainRole} &bull; {cand.city}-{cand.state}</p>
                      
                      <div className="flex items-center gap-1.5 pt-1 text-xs">
                        <ScoreStars score={cand.averageScore} size="sm" showNumber={true} />
                        <span className="text-text-secondary">&bull; Referência: R$ {cand.referenceValue}/diária</span>
                      </div>

                      {/* Warnings / Alerts */}
                      <div className="space-y-2 pt-2">
                        {hasConflict && (
                          <div className={`p-2.5 rounded-lg border text-[11px] flex items-start gap-1.5 leading-snug ${
                            isConflictApproved 
                              ? 'bg-emerald-55 border-emerald-200 text-emerald-800'
                              : 'bg-red-55 border-red-200 text-red-800'
                          }`}>
                            <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${isConflictApproved ? 'text-emerald-650' : 'text-red-650'}`} />
                            <div>
                              <span className="font-bold block text-[11.5px] mb-0.5">Conflito de Agenda Detectado</span>
                              {isConflictApproved ? (
                                <p className="text-[10px] text-emerald-700">Aprovado pelo RH: {conflictApproval.decisionNotes}</p>
                              ) : isConflictPending ? (
                                <p className="text-[10px] text-red-700">Solicitação pendente de aprovação com o RH.</p>
                              ) : (
                                <div className="mt-1">
                                  <p className="text-[10px] text-red-700">Profissional alocado em outro job neste período.</p>
                                  <button
                                    type="button"
                                    onClick={() => handleRequestApproval(sl.id, cand.id, 'schedule_conflict')}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 rounded-lg text-[10px] mt-1 transition-all cursor-pointer"
                                  >
                                    Solicitar aprovação RH
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {exceedsCeiling && (
                          <div className={`p-2.5 rounded-lg border text-[11px] flex items-start gap-1.5 leading-snug ${
                            isBudgetApproved
                              ? 'bg-emerald-55 border-emerald-200 text-emerald-800'
                              : 'bg-red-55 border-red-200 text-red-800'
                          }`}>
                            <Scale className={`w-4 h-4 shrink-0 mt-0.5 ${isBudgetApproved ? 'text-emerald-650' : 'text-red-650'}`} />
                            <div>
                              <span className="font-bold block text-[11.5px] mb-0.5">Excedeu Teto de Referência</span>
                              {isBudgetApproved ? (
                                <p className="text-[10px] text-emerald-700">Aprovado pelo Head: {budgetApproval.decisionNotes}</p>
                              ) : isBudgetPending ? (
                                <div className="space-y-2">
                                  <p className="text-[10px] text-red-700">Aguardando aprovação do Head do Núcleo.</p>
                                  {(db.currentUser.profile === 'MASTER' || 
                                    db.currentUser.profile === 'RH' || 
                                    db.currentUser.profile === 'C-LEVEL' || 
                                    (db.currentUser.profile === 'NÚCLEO' && 
                                     db.currentUser.isNucleusHead === true && 
                                     db.currentUser.nucleoId === activeJob.nucleoId)) && (
                                    <div className="flex gap-1.5 mt-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setHeadDecisionModal({
                                          isOpen: true,
                                          approvalId: budgetApproval?.id || '',
                                          freelancerName: cand.name,
                                          decision: 'approve',
                                          comment: '',
                                          loading: false,
                                          error: null
                                        })}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded text-[10px] transition-all cursor-pointer"
                                      >
                                        Aprovar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setHeadDecisionModal({
                                          isOpen: true,
                                          approvalId: budgetApproval?.id || '',
                                          freelancerName: cand.name,
                                          decision: 'reject',
                                          comment: '',
                                          loading: false,
                                          error: null
                                        })}
                                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 rounded text-[10px] transition-all cursor-pointer"
                                      >
                                        Reprovar
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-1">
                                  <p className="text-[10px] text-red-700">O teto comercial é de R$ {ceilingValue}.</p>
                                  <button
                                    type="button"
                                    onClick={() => handleRequestApproval(sl.id, cand.id, 'value_exception', rate)}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 rounded-lg text-[10px] mt-1 transition-all cursor-pointer"
                                  >
                                    Solicitar aprovação Head
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Negotiation Form Inputs */}
                    <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold text-text-secondary block mb-1">Taxa Acordada (R$) *</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-text-secondary select-none">R$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={isLocked}
                            value={visualRates[cand.id] !== undefined ? visualRates[cand.id] : maskCurrencyBRL(rate.toString())}
                            onChange={(e) => {
                              const rawVal = e.target.value;
                              const masked = maskCurrencyBRL(rawVal);
                              setVisualRates(prev => ({ ...prev, [cand.id]: masked }));
                              
                              const numeric = parseCurrencyBR(masked);
                              updateCandidateNeg(cand.id, {
                                recurringAmount: numeric,
                                recurringAmountVisual: masked
                              });
                            }}
                            onBlur={() => {
                              const currentVal = visualRates[cand.id] !== undefined ? visualRates[cand.id] : maskCurrencyBRL(rate.toString());
                              const numeric = parseCurrencyBR(currentVal);
                              if (numeric > 0) {
                                const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric);
                                setVisualRates(prev => ({ ...prev, [cand.id]: formatted }));
                                updateCandidateNeg(cand.id, {
                                  recurringAmount: numeric,
                                  recurringAmountVisual: formatted
                                });
                                handleUpdateNegotiation(cand.id, { negotiatedRate: numeric });
                              } else {
                                setVisualRates(prev => ({ ...prev, [cand.id]: '' }));
                                updateCandidateNeg(cand.id, {
                                  recurringAmount: 0,
                                  recurringAmountVisual: ''
                                });
                                handleUpdateNegotiation(cand.id, { negotiatedRate: 0 });
                              }
                            }}
                            className="w-full bg-[#F8FAFC] border border-border-subtle p-2.5 pl-8 rounded-lg text-xs font-bold text-text-primary focus:outline-none focus:border-action-cyan disabled:opacity-60"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-text-secondary block mb-1">Modelo de Remuneração</label>
                        <select
                          disabled={isLocked}
                          value={billing}
                          onChange={(e) => handleUpdateNegotiation(cand.id, { remunerationModel: e.target.value })}
                          className="w-full bg-white border border-border-subtle p-2.5 rounded-lg text-xs font-semibold focus:outline-none focus:border-action-cyan disabled:opacity-60"
                        >
                          <option value="Mensal / Salário por período">Mensal / Salário por período</option>
                          <option value="Diária">Diária</option>
                          <option value="Hora">Hora</option>
                          <option value="Job Fechado">Job Fechado</option>
                        </select>
                      </div>

                      {billing === 'Hora' && (
                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-bold text-text-secondary block mb-1">Horas Estimadas *</label>
                          <input
                            type="number"
                            disabled={isLocked}
                            value={sl.estimatedHours || ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? undefined : Number(e.target.value);
                              handleUpdateNegotiation(cand.id, { estimatedHours: val });
                            }}
                            placeholder="Ex: 40"
                            className="w-full bg-[#F8FAFC] border border-border-subtle p-2.5 rounded-lg text-xs font-bold text-text-primary focus:outline-none focus:border-action-cyan disabled:opacity-60"
                          />
                        </div>
                      )}

                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-bold text-text-secondary block mb-1">Status da Negociação</label>
                        <select
                          disabled={isLocked || (hasConflict && !isConflictApproved) || (exceedsCeiling && !isBudgetApproved)}
                          value={sl.candidateStatus}
                          onChange={(e) => handleUpdateNegotiation(cand.id, { negotiationStatus: e.target.value as any })}
                          className="w-full bg-white border border-border-subtle p-2.5 rounded-lg text-xs font-bold focus:outline-none focus:border-action-cyan disabled:opacity-60"
                        >
                          <option value="Selecionado">Selecionado (Fase Inicial)</option>
                          <option value="Em negociação">Em negociação</option>
                          <option value="Aguardando retorno">Aguardando retorno</option>
                          <option value="Aceitou com ressalva">Aceitou com ressalva (Em negociação)</option>
                          <option value="Valor fora da política" disabled={!exceedsCeiling}>Valor fora da política</option>
                          <option value="Bloqueado por conflito de agenda" disabled={!hasConflict}>Bloqueado por conflito de agenda</option>
                          {isConflictPending && <option value="Pendente aprovação RH">Pendente aprovação RH</option>}
                          {isBudgetPending && <option value="Pendente aprovação Head">Pendente aprovação Head</option>}
                          <option value="Aceitou">Aceitou a proposta</option>
                          <option value="Não aceitou">Rejeitou a proposta / Não aceitou</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-bold text-text-secondary block mb-1">Observações Internas</label>
                        <textarea
                          disabled={isLocked}
                          defaultValue={sl.notes || ''}
                          onBlur={(e) => handleUpdateNegotiation(cand.id, { notes: e.target.value })}
                          placeholder="Adicione notas sobre agenda, escopo acertado, contrapropostas, etc."
                          rows={2}
                          className="w-full bg-white border border-border-subtle p-2.5 rounded-lg text-xs focus:outline-none focus:border-action-cyan disabled:opacity-60 text-text-primary resize-none"
                        />
                      </div>

                      {/* Faturamento e Condições Comerciais per Candidate */}
                      {(() => {
                        const candNeg = getCandidateNeg(cand.id, sl);

                        return (
                          <div className="sm:col-span-2 space-y-4">
                            {/* Contract dates and terms */}
                            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-border-subtle space-y-3 text-left">
                              <span className="font-bold text-[11px] text-sidebar-navy dark:text-action-cyan uppercase tracking-wider block">
                                Informações Contratuais & Operacionais
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] font-bold text-text-secondary block mb-0.5">
                                    Início do Contrato *
                                  </label>
                                  <input
                                    type="date"
                                    disabled={isLocked}
                                    value={candNeg.contractStartDate}
                                    onChange={(e) => updateCandidateNeg(cand.id, { contractStartDate: e.target.value })}
                                    className="w-full bg-white border border-border-subtle p-1.5 rounded-lg text-[11px] focus:outline-none focus:border-action-cyan text-text-primary"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-text-secondary block mb-0.5">
                                    Fim do Contrato *
                                  </label>
                                  <input
                                    type="date"
                                    disabled={isLocked}
                                    value={candNeg.contractEndDate}
                                    onChange={(e) => updateCandidateNeg(cand.id, { contractEndDate: e.target.value })}
                                    className="w-full bg-white border border-border-subtle p-1.5 rounded-lg text-[11px] focus:outline-none focus:border-action-cyan text-text-primary"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] font-bold text-text-secondary block mb-0.5">
                                    Condições de Pagamento
                                  </label>
                                  <input
                                    type="text"
                                    disabled={isLocked}
                                    placeholder="Prazo NF, etc..."
                                    value={candNeg.paymentTerms}
                                    onChange={(e) => updateCandidateNeg(cand.id, { paymentTerms: e.target.value })}
                                    className="w-full bg-white border border-border-subtle p-1.5 rounded-lg text-[11px] focus:outline-none focus:border-action-cyan text-text-primary"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-text-secondary block mb-0.5">
                                    Notas Administrativas
                                  </label>
                                  <input
                                    type="text"
                                    disabled={isLocked}
                                    placeholder="Notas..."
                                    value={candNeg.paymentNotes}
                                    onChange={(e) => updateCandidateNeg(cand.id, { paymentNotes: e.target.value })}
                                    className="w-full bg-white border border-border-subtle p-1.5 rounded-lg text-[11px] focus:outline-none focus:border-action-cyan text-text-primary"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Success Fee Custom settings */}
                            {activeJob.success_fee_enabled && (() => {
                              const jobRule = db.jobSuccessFeeRules?.find(r => (r.jobId === activeJob?.id || r.jobId === activeJob?.jobId) && r.isActive !== false);
                              const jobBudget = activeJob?.budget || 0;
                              const calcMode = (activeJob as any)?.successFeeCalcMode || (jobRule as any)?.calcMode || 'dilute';

                              let jobMaxFixed = 0;
                              let jobMaxPercent = 0;

                              if (jobRule) {
                                if (jobRule.feeType === 'fixed' && jobRule.fixedAmount) {
                                  jobMaxFixed = jobRule.fixedAmount;
                                  jobMaxPercent = jobBudget > 0 ? (jobRule.fixedAmount / jobBudget) * 100 : 0;
                                } else if (jobRule.feeType === 'percentage' && jobRule.percentageRate) {
                                  jobMaxPercent = jobRule.percentageRate;
                                  jobMaxFixed = (jobBudget * jobRule.percentageRate) / 100;
                                }
                              } else if (activeJob) {
                                const sfType = (activeJob as any).successFeeType || (activeJob as any).success_fee_type || 'percentage';
                                const sfFixed = (activeJob as any).successFeeFixedAmount || (activeJob as any).success_fee_fixed_amount || 0;
                                const sfPercent = (activeJob as any).successFeePercent || (activeJob as any).success_fee_percent || 0;

                                if (sfType === 'fixed' && sfFixed > 0) {
                                  jobMaxFixed = sfFixed;
                                  jobMaxPercent = jobBudget > 0 ? (sfFixed / jobBudget) * 100 : 0;
                                } else if (sfPercent > 0) {
                                  jobMaxPercent = sfPercent;
                                  jobMaxFixed = (jobBudget * sfPercent) / 100;
                                }
                              }

                              if (!jobMaxPercent && jobMaxFixed > 0 && jobBudget > 0) {
                                jobMaxPercent = (jobMaxFixed / jobBudget) * 100;
                              }
                              if (!jobMaxFixed && jobMaxPercent > 0 && jobBudget > 0) {
                                jobMaxFixed = (jobBudget * jobMaxPercent) / 100;
                              }
                              if (!jobMaxPercent && jobMaxFixed === 0) jobMaxPercent = 8;
                              if (!jobMaxFixed && jobBudget > 0) jobMaxFixed = (jobBudget * jobMaxPercent) / 100;

                              return (
                                <div className="bg-indigo-50/30 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-200/50 dark:border-indigo-800/40 space-y-3 text-left">
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold text-[11px] text-indigo-950 dark:text-indigo-300 uppercase tracking-wider block flex items-center gap-1">
                                      <Award className="w-3.5 h-3.5 text-indigo-650" />
                                      Condições de Success Fee (Espelhadas da Oportunidade)
                                    </span>
                                    <label className="flex items-center gap-1.5 text-xs font-semibold text-text-primary dark:text-indigo-200 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        disabled={isLocked}
                                        checked={candNeg.successFeeEnabled}
                                        onChange={(e) => updateCandidateNeg(cand.id, { successFeeEnabled: e.target.checked })}
                                        className="rounded text-indigo-650 focus:ring-indigo-500 w-3.5 h-3.5"
                                      />
                                      <span>Aplicável a este freela</span>
                                    </label>
                                  </div>

                                  {/* Read-Only Application Mode Badge (Bloqueado da Oportunidade) */}
                                  <div className="bg-slate-900/80 border border-slate-750 p-2.5 rounded-lg flex items-center justify-between text-xs">
                                    <div>
                                      <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-slate-400 block">Forma de Aplicação do Success Fee</span>
                                      <strong className="text-action-cyan font-extrabold text-xs">
                                        {calcMode === 'increment_budget' ? 'INCREMENTAR E ATUALIZAR O BUDGET' : 'DILUIR SUCCESS FEE NAS PROJEÇÕES'}
                                      </strong>
                                    </div>
                                    <span className="bg-slate-800 text-slate-300 text-[9.5px] font-bold px-2 py-0.5 rounded border border-slate-700">Fixado no Job</span>
                                  </div>

                                  {candNeg.successFeeEnabled && (
                                    <div className="space-y-3 pt-2 border-t border-indigo-200/30 text-xs">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                          <label className="text-[10px] font-bold text-text-secondary dark:text-slate-300 block mb-0.5">Tipo de Taxa *</label>
                                          <select
                                            disabled={isLocked}
                                            value={candNeg.successFeeType}
                                            onChange={(e) => {
                                              const newType = e.target.value as 'percentage' | 'fixed';
                                              const cappedFixed = jobMaxFixed > 0 ? Math.min(candNeg.successFeeFixedAmount || jobMaxFixed, jobMaxFixed) : candNeg.successFeeFixedAmount;
                                              const cappedPercent = jobMaxPercent > 0 ? Math.min(candNeg.successFeePercent || jobMaxPercent, jobMaxPercent) : candNeg.successFeePercent;
                                              updateCandidateNeg(cand.id, {
                                                successFeeType: newType,
                                                successFeeFixedAmount: cappedFixed,
                                                successFeeFixedAmountVisual: cappedFixed > 0 ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cappedFixed) : '',
                                                successFeePercent: cappedPercent
                                              });
                                            }}
                                            className="w-full bg-white dark:bg-slate-900 border border-border-subtle dark:border-slate-700 p-1.5 rounded-lg text-[11px] font-bold focus:outline-none focus:border-indigo-500 text-text-primary dark:text-white"
                                          >
                                            <option value="percentage">Percentual (%)</option>
                                            <option value="fixed">Valor Fixo (R$)</option>
                                          </select>
                                        </div>

                                        {candNeg.successFeeType === 'percentage' ? (
                                          <div>
                                            <label className="text-[10px] font-bold text-text-secondary dark:text-slate-300 block mb-0.5">
                                              Percentual (%) {jobMaxPercent > 0 && <span className="text-amber-400 font-normal">(Teto: {Math.round(jobMaxPercent * 10) / 10}%)</span>} *
                                            </label>
                                            <input
                                              type="number"
                                              disabled={isLocked}
                                              max={jobMaxPercent > 0 ? jobMaxPercent : undefined}
                                              value={candNeg.successFeePercent || ''}
                                              onChange={(e) => {
                                                const val = Number(e.target.value);
                                                const capped = jobMaxPercent > 0 ? Math.min(val, jobMaxPercent) : val;
                                                updateCandidateNeg(cand.id, { successFeePercent: capped });
                                              }}
                                              className="w-full bg-white dark:bg-slate-900 border border-border-subtle dark:border-slate-700 p-1.5 rounded-lg text-[11px] font-bold focus:outline-none focus:border-indigo-500 text-text-primary dark:text-white"
                                              placeholder={`Ex: ${Math.round(jobMaxPercent) || 8}`}
                                            />
                                          </div>
                                        ) : (
                                          <div>
                                            <label className="text-[10px] font-bold text-text-secondary dark:text-slate-300 block mb-0.5">
                                              Valor Fixo (R$) {jobMaxFixed > 0 && <span className="text-amber-400 font-normal">(Teto: R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(jobMaxFixed)})</span>} *
                                            </label>
                                            <div className="relative">
                                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-text-secondary">R$</span>
                                              <input
                                                type="text"
                                                inputMode="decimal"
                                                disabled={isLocked}
                                                value={candNeg.successFeeFixedAmountVisual}
                                                onChange={(e) => {
                                                  const raw = e.target.value;
                                                  const masked = maskCurrencyBRL(raw);
                                                  let numeric = parseCurrencyBR(masked);
                                                  if (jobMaxFixed > 0 && numeric > jobMaxFixed) {
                                                    numeric = jobMaxFixed;
                                                  }
                                                  const cappedMasked = jobMaxFixed > 0 && numeric >= jobMaxFixed
                                                    ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(jobMaxFixed)
                                                    : masked;
                                                  updateCandidateNeg(cand.id, {
                                                    successFeeFixedAmountVisual: cappedMasked,
                                                    successFeeFixedAmount: numeric
                                                  });
                                                }}
                                                onBlur={() => {
                                                  if (candNeg.successFeeFixedAmount > 0) {
                                                    const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(candNeg.successFeeFixedAmount);
                                                    updateCandidateNeg(cand.id, { successFeeFixedAmountVisual: formatted });
                                                  }
                                                }}
                                                className="w-full bg-white dark:bg-slate-900 border border-border-subtle dark:border-slate-700 p-1.5 pl-7 rounded-lg text-[11px] font-bold focus:outline-none focus:border-indigo-500 text-text-primary dark:text-white"
                                                placeholder="0,00"
                                              />
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                          <label className="text-[10px] font-bold text-text-secondary dark:text-slate-300 block mb-0.5">Gatilho de Sucesso *</label>
                                          <input
                                            type="text"
                                            disabled={isLocked}
                                            value={candNeg.successFeeTrigger}
                                            onChange={(e) => updateCandidateNeg(cand.id, { successFeeTrigger: e.target.value })}
                                            className="w-full bg-white dark:bg-slate-900 border border-border-subtle dark:border-slate-700 p-1.5 rounded-lg text-[11px] font-bold focus:outline-none focus:border-indigo-55 text-text-primary dark:text-white"
                                            placeholder="Ex: V3A ganhar a concorrência"
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-bold text-text-secondary dark:text-slate-300 block mb-0.5">Condições Complementares</label>
                                          <input
                                            type="text"
                                            disabled={isLocked}
                                            value={candNeg.successFeeTerms}
                                            onChange={(e) => updateCandidateNeg(cand.id, { successFeeTerms: e.target.value })}
                                            className="w-full bg-white dark:bg-slate-900 border border-border-subtle dark:border-slate-700 p-1.5 rounded-lg text-[11px] font-bold focus:outline-none focus:border-indigo-55 text-text-primary dark:text-white"
                                            placeholder="Condições ou termos extras..."
                                          />
                                        </div>
                                      </div>

                                      <div className="bg-indigo-50/50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-indigo-100 dark:border-slate-850 flex items-center justify-between mt-2">
                                        <label className="flex items-center gap-2 text-xs font-bold text-indigo-950 dark:text-indigo-350 cursor-pointer select-none">
                                          <input
                                            type="checkbox"
                                            disabled={isLocked}
                                            checked={candNeg.acceptedByFreelancer}
                                            onChange={(e) => updateCandidateNeg(cand.id, { acceptedByFreelancer: e.target.checked })}
                                            className="rounded text-indigo-650 focus:ring-indigo-500 w-4 h-4 bg-white"
                                          />
                                          <span>Aceite formal do freelancer às condições de success fee</span>
                                        </label>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Negotiation Financial Summary */}
                            <div className="pt-2 text-left">
                              <NegotiationFinancialSummary
                                budget={activeJob.budget}
                                startDate={activeJob.startDate}
                                endDate={activeJob.endDate}
                                negotiatedRate={rate}
                                remunerationModel={billing}
                                estimatedHours={sl.estimatedHours}
                                successFeeEnabled={candNeg.successFeeEnabled}
                                successFeeType={candNeg.successFeeType}
                                successFeeFixedAmount={candNeg.successFeeFixedAmount}
                                successFeePercent={candNeg.successFeePercent}
                                successFeeBase={candNeg.successFeeBase}
                                successFeeTrigger={candNeg.successFeeTrigger}
                                variant="detailed"
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-between pt-4 border-t border-border-subtle">
            <button
              onClick={() => handleNavigateStep(2)}
              className="bg-white border border-border-subtle hover:bg-slate-50 text-text-primary font-bold p-3 px-6 rounded-xl text-xs transition-all cursor-pointer"
            >
              Voltar para Shortlist
            </button>

            {jobShortlists.some(sl => ['Aceitou', 'Aprovado pelo Head', 'Valor fora da política'].includes(sl.candidateStatus)) && (
              <button
                onClick={() => handleNavigateStep(4)}
                className="bg-sidebar-navy hover:bg-sidebar-navy/95 text-white font-bold p-3 px-6 rounded-xl flex items-center gap-2 text-xs shadow-xs"
              >
                <span>Avançar para Homologação</span>
                <ArrowRight className="w-4 h-4 text-action-cyan" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* -------------------- STEP 4: HOMOLOGAÇÃO & ALLOCATION -------------------- */}
      {activeStep === 4 && activeJob && (
        <div className="space-y-6 animate-fade-in">
          {/* Active Job Meta-Header — STICKY no topo ao dar scroll com descrição formatada */}
          {(() => {
            const nucleoName = db.nucleos.find(n => n.id === activeJob.nucleoId)?.name || '—';
            const model = activeJob.remunerationModel || 'monthly_salary';
            const paymentFlowLabel =
              (model as string) === 'monthly_salary' || (model as string) === 'monthly' ? 'Mensal / Salário por Período' :
              model === 'daily' ? 'Diária' :
              model === 'hourly' ? 'Hora' :
              (model as string) === 'fixed_job' || (model as string) === 'closed_package' ? 'Job Fechado (Parcela Única)' :
              (activeJob.paymentFlow === 'recurring' ? 'Recorrente Mensal' : 'Pagamento Único');

            const projections = simulatePaymentProjections(activeJob.startDate, activeJob.endDate, model);
            const monthlyRate = activeJob.expectedRate && activeJob.expectedRate > 0
              ? activeJob.expectedRate
              : (projections.length > 0 && activeJob.budget > 0 ? activeJob.budget / projections.length : 0);

            const installmentSummaryText = projections.length > 1
              ? ` (${projections.length} parcelas de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthlyRate)}/mês)`
              : '';

            const referenceRateLabel =
              (model as string) === 'monthly_salary' || (model as string) === 'monthly' ? 'Valor Mensal de Referência' :
              model === 'daily' ? 'Diária de Referência' :
              model === 'hourly' ? 'Valor Hora de Referência' :
              (model as string) === 'fixed_job' || (model as string) === 'closed_package' ? 'Valor Fechado de Referência' :
              'Taxa de Referência';

            const referenceRate = activeJob.expectedRate && activeJob.expectedRate > 0
              ? activeJob.expectedRate
              : (projections.length > 1 && activeJob.budget > 0 ? activeJob.budget / projections.length : activeJob.budget);
            const paymentDay = activeJob.expectedPaymentDay;

            return (
              <div
                className="bg-slate-900/95 text-slate-100 p-5 rounded-2xl border border-slate-700/80 shadow-xl flex flex-col md:flex-row justify-between gap-6 job-meta-header sticky top-0 z-30 transition-all duration-300"
                style={{ backdropFilter: 'blur(10px)' }}
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-slate-950 text-slate-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-slate-800">
                      COD: {activeJob.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className="text-[11px] uppercase font-extrabold text-action-cyan tracking-wider">Homologação da Alocação</span>
                    <span className="bg-emerald-950 text-emerald-300 border border-emerald-800/90 px-2.5 py-0.5 rounded text-[10px] font-bold">{activeJob.status}</span>
                  </div>

                  <h3 className="text-base font-extrabold text-white leading-tight">[{activeJob.client}] {activeJob.name}</h3>

                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-300">
                    <div>Núcleo: <strong className="text-white">{nucleoName}</strong></div>
                    <div>Função: <strong className="text-white">{activeJob.roleNeeded} ({activeJob.seniorityNeeded})</strong></div>
                    <div>Urgência: <strong className={activeJob.urgency === 'Alta' ? 'text-red-400 font-bold' : 'text-slate-200'}>{activeJob.urgency}</strong></div>
                    <div>Período: <strong className="text-white">{isoToBR(activeJob.startDate)} a {isoToBR(activeJob.endDate)}</strong></div>
                    <div>Modelo / Fluxo: <strong className="text-emerald-300 font-bold">{paymentFlowLabel}{installmentSummaryText}</strong></div>
                    {paymentDay && <div>Vencimento Preferencial: <strong className="text-white">Dia {paymentDay}</strong></div>}
                    {referenceRate > 0 && <div>{referenceRateLabel}: <strong className="text-amber-300 font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(referenceRate)}</strong></div>}
                  </div>

                  {/* Formatted Description with Expand/Collapse */}
                  {activeJob.description && (
                    <JobDescriptionFormatted description={activeJob.description} />
                  )}
                </div>

                <div className="flex flex-col justify-between items-end gap-3 min-w-[180px] shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Budget Máximo do Job</div>
                    <div className="text-lg font-black text-action-cyan">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(activeJob.budget)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                      Média diária: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateDailyAverage(activeJob))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleNavigateStep(3)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold p-2 px-3.5 rounded-xl text-xs transition-all border border-slate-700 cursor-pointer shadow-xs"
                    >
                      Voltar para Negociação
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ===== PAINEL DE EXCEÇÕES PENDENTES (Head do Núcleo / MASTER / RH / C-LEVEL) ===== */}
          {(() => {
            const isPrivileged = ['MASTER', 'RH', 'C-LEVEL'].includes(db.currentUser.profile);
            // Verifica se é Head por flag explícita OU por correspondência de núcleo
            const jobNucleoId = activeJob.nucleoId;
            const isNucleusHead = db.currentUser.isNucleusHead ||
              (db.currentUser.profile === 'NÚCLEO' &&
                !!db.currentUser.nucleoId &&
                !!jobNucleoId &&
                db.currentUser.nucleoId === jobNucleoId);
            if (!isNucleusHead && !isPrivileged) return null;

            // Filtrar exceções pendentes do núcleo do job ativo
            const pendingExceptions = db.approvals?.filter((ap: any) => {
              const isValueException = ap.approvalType === 'value_exception';
              const isPending = ap.status === 'pending';
              const isForThisJob = ap.jobId === activeJob.id;
              // Head só vê seu próprio núcleo; MASTER/RH/C-LEVEL veem todos
              if (isPrivileged) return isValueException && isPending && isForThisJob;
              return isValueException && isPending && isForThisJob &&
                (ap.nucleusId === db.currentUser.nucleoId || ap.nucleusId === jobNucleoId);
            }) || [];

            if (pendingExceptions.length === 0) return null;

            return (
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-4 animate-fade-in">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-500 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-amber-900 text-sm">Exceções de Valor Pendentes de Aprovação</h4>
                    <p className="text-[11px] text-amber-700">{pendingExceptions.length} solicitação(ões) aguardam sua decisão antes de liberar a homologação.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {pendingExceptions.map((ap: any) => {
                    const freelancer = db.freelancers.find(f => f.id === ap.freelancerId);
                    const exceedPct = ap.excessPercent ? Number(ap.excessPercent).toFixed(1) : '—';
                    const excessAmt = ap.excessAmount ? Number(ap.excessAmount) : (ap.requestedAmount && ap.calculatedPolicyLimit ? Number(ap.requestedAmount) - Number(ap.calculatedPolicyLimit) : 0);
                    const requestedAmt = ap.requestedAmount || ap.negotiatedValue;
                    const limitAmt = ap.calculatedPolicyLimit || ap.policyCeilingValue;

                    return (
                      <div key={ap.id} className="bg-white border border-amber-200 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-start flex-wrap gap-2">
                          <div>
                            <strong className="text-sidebar-navy text-sm">{freelancer?.name || 'Freelancer'}</strong>
                            <p className="text-[11px] text-text-secondary">{freelancer?.mainRole} ({freelancer?.seniority})</p>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] text-red-700 font-bold">
                              {requestedAmt ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(requestedAmt)) : '—'}
                              {limitAmt && <span className="text-text-secondary font-normal"> (teto: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(limitAmt))})</span>}
                            </div>
                            <span className="text-[10px] bg-red-50 border border-red-200 text-red-700 font-bold px-1.5 py-0.5 rounded">
                              +{exceedPct}% acima do teto
                            </span>
                          </div>
                        </div>

                        {ap.reason && (
                          <div className="bg-slate-50 border border-border-subtle p-2.5 rounded-lg text-[11px] text-text-secondary leading-relaxed">
                            <strong className="text-text-primary block text-[10px] uppercase tracking-wider mb-1">Justificativa do solicitante</strong>
                            {ap.reason}
                          </div>
                        )}

                        {/* Decision input + buttons */}
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                            Comentário da decisão <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            placeholder="Descreva o motivo da aprovação ou rejeição (mín. 5 caracteres)..."
                            className="w-full bg-white border border-border-subtle p-2 rounded-lg text-xs focus:outline-none focus:border-action-cyan text-text-primary resize-none"
                            rows={2}
                            id={`head-comment-${ap.id}`}
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                const el = document.getElementById(`head-comment-${ap.id}`) as HTMLTextAreaElement;
                                handleHeadDecision(ap.id, 'reject', el?.value || '');
                              }}
                              className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              Rejeitar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const el = document.getElementById(`head-comment-${ap.id}`) as HTMLTextAreaElement;
                                handleHeadDecision(ap.id, 'approve', el?.value || '');
                              }}
                              className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Aprovar Exceção
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* CHECK IF JOB IS ALREADY BOOKED (BOOKING HISTORY MODE) */}
          {activeJob.selectedFreelancerId ? (() => {
            const bookedFreelancer = db.freelancers.find(f => f.id === activeJob.selectedFreelancerId);
            const allocation = db.allocations.find(a => a.jobId === activeJob.id && a.freelancerId === activeJob.selectedFreelancerId);
            const payCode = db.paymentCodes.find(pc => pc.jobId === activeJob.id && pc.freelancerId === activeJob.selectedFreelancerId);
            const neg = db.negotiations.find(n => n.jobId === activeJob.id && n.freelancerId === activeJob.selectedFreelancerId);

            return (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Booked Candidate Card */}
                <div className="bg-white p-5 rounded-2xl border border-border-subtle shadow-xs space-y-4">
                  <div className="text-center pb-4 border-b border-border-subtle">
                    <div className="w-14 h-14 bg-success-bg rounded-full flex items-center justify-center mx-auto mb-2 text-success-text border border-success-border/20">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    <h4 className="font-bold text-sidebar-navy text-sm">{bookedFreelancer?.name}</h4>
                    <span className="bg-success-bg text-success-text border border-success-border/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-block mt-1">
                      Contratado Oficial
                    </span>
                  </div>

                  <div className="text-xs space-y-2 text-text-secondary pt-2">
                    <div className="flex justify-between">
                      <span>Perfil Principal:</span>
                      <strong className="text-text-primary">{bookedFreelancer?.mainRole}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Senioridade:</span>
                      <strong className="text-text-primary">{bookedFreelancer?.seniority}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Avaliação Média:</span>
                      <div className="flex items-center"><ScoreStars score={bookedFreelancer?.averageScore} size="sm" showNumber={true} /></div>
                    </div>
                  </div>
                </div>

                {/* Allocation details contract details */}
                <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-emerald-300 shadow-xs space-y-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-bold p-1 px-4 rounded-bl-xl uppercase tracking-wider">
                    Alocação Consolidada
                  </div>

                  <div>
                    <h4 className="font-bold text-sidebar-navy text-sm flex items-center gap-1.5">
                      <FileCheck className="w-5 h-5 text-emerald-600" />
                      <span>Detalhes Administrativos do Booking</span>
                    </h4>
                    <p className="text-[11px] text-text-secondary mt-0.5">Metadados fiscais e códigos vinculados à convocação.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-border-subtle space-y-1">
                      <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Código de Alocação</span>
                      <div className="font-mono text-base font-bold text-sidebar-navy">{allocation?.allocationCode || 'ALOC-PENDENTE'}</div>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-border-subtle space-y-1">
                      <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Status do Pagamento</span>
                      <div className="font-semibold text-xs flex items-center gap-1 text-sidebar-navy">
                        <Clock className="w-4 h-4 text-action-cyan shrink-0" />
                        <span>{payCode?.paymentStatus || 'Aguardando encerramento do job'}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-border-subtle space-y-1">
                      <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Tarifa Homologada</span>
                      <div className="font-bold text-sm text-sidebar-navy">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(allocation?.approvedValue || neg?.negotiatedValue || 0)} ({neg?.billingType || 'Diária'})
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-border-subtle space-y-1">
                      <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Período de Execução</span>
                      <div className="font-semibold text-xs text-sidebar-navy">
                        {isoToBR(allocation?.startDate)} a {isoToBR(allocation?.endDate)}
                      </div>
                    </div>
                  </div>

                  {neg?.scope && (
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-border-subtle text-xs space-y-1">
                      <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Escopo Homologado</span>
                      <p className="text-text-primary text-[12px] leading-relaxed">{neg.scope}</p>
                    </div>
                  )}

                  {/* Reopen Action (MASTER/RH only) */}
                  <div className="pt-4 border-t border-border-subtle flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div className="text-[11px] text-text-secondary leading-normal flex items-start gap-1">
                      <AlertCircle className="w-4.5 h-4.5 text-text-secondary shrink-0 mt-0.5" />
                      <span>Para rescindir, trocar profissional ou reabrir esta vaga, utilize a ação ao lado (apenas Master/RH).</span>
                    </div>

                    {(db.currentUser.profile === 'MASTER' || db.currentUser.profile === 'RH') ? (
                      <button
                        onClick={handleReopenJob}
                        className="bg-status-error hover:bg-status-error/95 text-white font-bold p-2.5 px-4 rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-colors shadow-xs"
                      >
                        <Unlock className="w-4 h-4" />
                        <span>Cancelar Alocação / Reabrir</span>
                      </button>
                    ) : (
                      <button
                        disabled
                        className="bg-slate-100 text-slate-400 border border-slate-200 font-bold p-2.5 px-4 rounded-xl text-xs flex items-center gap-1.5 shrink-0 cursor-not-allowed"
                      >
                        <Lock className="w-4 h-4" />
                        <span>Reabertura Restrita ao RH</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })() : (
            /* INTERACTIVE ALLOCATION FORM */
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-border-subtle shadow-xs space-y-4">
                <div>
                  <h4 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                    <FileCheck className="w-5 h-5 text-emerald-600" />
                    <span>Profissionais Elegíveis para Alocação Final</span>
                  </h4>
                  <p className="text-[11.5px] text-text-secondary mt-0.5">Selecione o profissional acordado para homologar a alocação oficial e bloquear o job.</p>
                </div>

                <div className="space-y-6 pt-2">
                  {(() => {
                    const eligibleCandidates = jobShortlists.filter(sl => {
                      const cand = db.freelancers.find(f => f.id === sl.freelancerId);
                      if (!cand) return false;

                      const hasConflict = cand && activeJob ? hasScheduleConflict(cand.id, activeJob.startDate, activeJob.endDate) : false;
                      const conflictApproval = db.approvals?.find(ap => 
                        ap.shortlistCandidateId === sl.id && 
                        ap.approvalType === 'schedule_conflict' &&
                        ap.freelancerId === cand.id
                      );
                      const isConflictApproved = conflictApproval?.status === 'approved';

                      const budgetApproval = db.approvals?.find(ap => 
                        ap.shortlistCandidateId === sl.id && 
                        ap.approvalType === 'value_exception' &&
                        ap.freelancerId === cand.id
                      );
                      const isBudgetApproved = budgetApproval?.status === 'approved';

                      const isStatusOk = sl.candidateStatus === 'Aceitou' || sl.candidateStatus === 'Aprovado pelo Head' || (sl.candidateStatus === 'Valor fora da política' && isBudgetApproved);
                      const isConflictOk = !hasConflict || isConflictApproved;

                      return isStatusOk && isConflictOk;
                    });

                    if (eligibleCandidates.length === 0) {
                      return (
                        <div className="col-span-2 bg-slate-50 p-8 text-center text-text-secondary border border-border-subtle rounded-xl italic text-xs">
                          Nenhum profissional finalizou a fase de negociação com status "Aceitou" ou com exceção de valor aprovada pelo Head. 
                          Avance na negociação dos rates no Passo 3.
                        </div>
                      );
                    }

                    return eligibleCandidates.map(sl => {
                      const cand = db.freelancers.find(f => f.id === sl.freelancerId);
                      if (!cand) return null;

                      const defaultRate = activeJob?.expectedRate || cand.referenceValue || 0;
                      const rate = sl.negotiatedRate || defaultRate;
                      
                      const isJobMonthly = (activeJob?.remunerationModel as string) === 'monthly_salary' || (activeJob?.remunerationModel as string) === 'monthly' || activeJob?.paymentFlow === 'recurring';
                      const defaultBilling = 
                        isJobMonthly ? 'Mensal / Salário por período' :
                        activeJob?.remunerationModel === 'hourly' ? 'Hora' :
                        ((activeJob?.remunerationModel as string) === 'fixed_job' || (activeJob?.remunerationModel as string) === 'closed_package') ? 'Job Fechado' : 'Diária';
                      
                      const billing = sl.remunerationModel && sl.remunerationModel !== 'Diária' && sl.remunerationModel !== 'daily'
                        ? sl.remunerationModel 
                        : defaultBilling;

                      const targetModel = billing || activeJob.remunerationModel || 'daily';
                      const billingTypeForMatch = 
                        ['daily', 'diaria', 'diária'].includes(targetModel.toLowerCase()) ? 'Diária' :
                        ['hourly', 'hora'].includes(targetModel.toLowerCase()) ? 'Hora' :
                        ['fixed_job', 'pacote', 'job fechado', 'projeto'].includes(targetModel.toLowerCase()) ? 'Job Fechado' : 'Mensal / Salário';

                      const policy = db.policies.find(p => 
                        p.role === activeJob.roleNeeded && 
                        p.seniority === activeJob.seniorityNeeded && 
                        p.billingType === billingTypeForMatch
                      );
                      const ceilingValue = policy ? policy.ceilingValue : 99999;
                      const referenceValue = policy ? policy.referenceValue : 0;
                      
                      const allocationDays = calculateAllocationDays(activeJob.startDate, activeJob.endDate);
                      const negotiatedTotal = calculateNegotiatedTotal({
                        negotiatedRate: rate,
                        remunerationModel: billing,
                        allocationDays,
                        estimatedHours: sl.estimatedHours,
                        startDate: activeJob?.startDate,
                        endDate: activeJob?.endDate
                      });
                      const savingAmount = negotiatedTotal !== null ? activeJob.budget - negotiatedTotal : 0;
                      const savingPercentage = negotiatedTotal !== null && activeJob.budget > 0 ? (savingAmount / activeJob.budget) * 100 : 0;

                      const isHoursMissing = billing === 'Hora' && !sl.estimatedHours;
                      const isJustificationMissing = savingAmount < 0 && !sl.notes?.trim();
                      const isConflictPending = sl.requiresRhApproval;
                      const isBudgetPending = sl.requiresHeadApproval;
                      const isButtonDisabled = isHoursMissing || isJustificationMissing || isConflictPending || isBudgetPending;

                      return (
                        <div key={sl.id} className="border border-border-subtle hover:border-emerald-500/50 p-6 rounded-2xl bg-white dark:bg-slate-900/60 shadow-sm space-y-6 transition-all text-left">
                          {/* GRID LAYOUT (Left Column: Candidate & Commercial | Right Column: Supply Projections) */}
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            
                            {/* ─── LEFT COLUMN (col-span-12 lg:col-span-5) ─── */}
                            <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
                              <div className="space-y-4">
                                {/* Candidate Header */}
                                <div className="flex justify-between items-start pb-3 border-b border-border-subtle">
                                  <div>
                                    <strong className="text-sidebar-navy dark:text-white font-extrabold text-base block">{cand.name}</strong>
                                    <p className="text-xs text-text-secondary dark:text-slate-400 mt-0.5">{cand.mainRole} ({cand.seniority})</p>
                                  </div>
                                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                                    isButtonDisabled
                                      ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                  }`}>
                                    {isButtonDisabled ? 'Bloqueado por Pendências' : 'Pronto para Alocação'}
                                  </span>
                                </div>
                                
                                {/* Embedded Financial Summary Card */}
                                <NegotiationFinancialSummary
                                  budget={activeJob.budget}
                                  startDate={activeJob.startDate}
                                  endDate={activeJob.endDate}
                                  negotiatedRate={rate}
                                  remunerationModel={billing}
                                  estimatedHours={sl.estimatedHours}
                                  successFeeEnabled={getCandidateNeg(cand.id, sl).successFeeEnabled}
                                  successFeeType={getCandidateNeg(cand.id, sl).successFeeType}
                                  successFeeFixedAmount={getCandidateNeg(cand.id, sl).successFeeFixedAmount}
                                  successFeePercent={getCandidateNeg(cand.id, sl).successFeePercent}
                                  successFeeBase={getCandidateNeg(cand.id, sl).successFeeBase}
                                  successFeeTrigger={getCandidateNeg(cand.id, sl).successFeeTrigger}
                                  variant="compact"
                                />

                                {/* Read-Only Final Commercial & Billing Conditions */}
                                {(() => {
                                  const candNeg = getCandidateNeg(cand.id, sl);
                                  const startDateStr = activeJob?.startDate || candNeg.contractStartDate || '';
                                  const endDateStr = activeJob?.endDate || candNeg.contractEndDate || '';
                                  const totalDays = (startDateStr && endDateStr) ? calculateAllocationDays(startDateStr, endDateStr) : 0;
                                  const formatISOToBR = (isoStr?: string) => {
                                    if (!isoStr) return 'A definir';
                                    const parts = isoStr.split('T')[0].split('-');
                                    if (parts.length === 3) return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
                                    return isoStr;
                                  };

                                  return (
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-border-subtle space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-[11px] text-sidebar-navy dark:text-action-cyan uppercase tracking-wider block">
                                          Condições Comerciais & Faturamento
                                        </span>
                                        {totalDays > 0 && (
                                          <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                                            {totalDays} {totalDays === 1 ? 'dia' : 'dias'}
                                          </span>
                                        )}
                                      </div>

                                      <div className="space-y-2 text-xs">
                                        <div className="flex justify-between border-b border-border-subtle/50 pb-1.5">
                                          <span className="text-[10px] uppercase font-bold text-text-secondary">Período</span>
                                          <strong className="text-sidebar-navy dark:text-white">
                                            {formatISOToBR(startDateStr)} a {formatISOToBR(endDateStr)}
                                          </strong>
                                        </div>
                                        <div className="flex justify-between border-b border-border-subtle/50 pb-1.5">
                                          <span className="text-[10px] uppercase font-bold text-text-secondary">Modelo</span>
                                          <strong className="text-sidebar-navy dark:text-white">
                                            {(() => {
                                              const bModel = billing?.toLowerCase() || '';
                                              if (bModel.includes('mensal') || bModel === 'monthly_salary' || bModel === 'monthly') {
                                                const candNegLocal = getCandidateNeg(cand.id, sl);
                                                const sd = activeJob?.startDate || candNegLocal.contractStartDate || '';
                                                const ed = activeJob?.endDate || candNegLocal.contractEndDate || '';
                                                const installments = (sd && ed) ? simulatePaymentProjections(sd, ed, billing).length : 1;
                                                return `Mensal / Salário por Período (${installments} ${installments === 1 ? 'parcela' : 'parcelas'})`;
                                              }
                                              if (bModel === 'hora' || bModel === 'hourly') return 'Por Hora';
                                              if (bModel.includes('job fechado') || bModel === 'fixed_job' || bModel === 'closed_package') return 'Job Fechado (Valor Fixo)';
                                              return 'Diária';
                                            })()}
                                          </strong>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-[10px] uppercase font-bold text-text-secondary">Obs.</span>
                                          <strong className="text-sidebar-navy dark:text-white truncate max-w-[200px]">
                                            {candNeg.paymentNotes || 'Sem observações'}
                                          </strong>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* Warnings & Justifications */}
                                {isConflictPending && (
                                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl text-[11px] text-red-800 dark:text-red-400 flex items-start gap-2 leading-relaxed">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-650 dark:text-red-500" />
                                    <div>
                                      <span className="font-bold block">Aprovação do RH Pendente</span>
                                      Este profissional possui um conflito de agenda no período deste job. A homologação está bloqueada até que o RH aprove a solicitação de exceção.
                                    </div>
                                  </div>
                                )}

                                {isBudgetPending && (
                                  <div className="p-3 bg-red-50 dark:bg-red-955/20 border border-red-200 dark:border-red-900/40 rounded-xl text-[11px] text-red-800 dark:text-red-400 flex items-start gap-2 leading-relaxed">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-650 dark:text-red-500" />
                                    <div>
                                      <span className="font-bold block">Aprovação do Head Pendente</span>
                                      O valor acordado ultrapassa o teto comercial. A homologação está bloqueada até que o Head do Núcleo aprove a solicitação de exceção.
                                    </div>
                                  </div>
                                )}

                                {isHoursMissing && (
                                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl text-[11px] text-red-800 dark:text-red-400 flex items-start gap-2 leading-relaxed">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-650 dark:text-red-500" />
                                    <div>
                                      <span className="font-bold block">Horas Estimadas Obrigatórias</span>
                                      Para modelo por hora, você precisa informar a estimativa de horas no Passo 3 antes de confirmar a homologação.
                                    </div>
                                  </div>
                                )}

                                {savingAmount < 0 && (
                                  <div className="space-y-2">
                                    <div className="p-3 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-[11px] text-amber-800 dark:text-amber-450 flex items-start gap-2 leading-relaxed">
                                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-650 dark:text-amber-500" />
                                      <div>
                                        <span className="font-bold block">Estouro de budget detectado: {formatCurrencyBRL(Math.abs(savingAmount))}</span>
                                        Esta alocação ultrapassa o budget definido para o job ({Math.abs(Math.round(savingPercentage))}% acima).
                                      </div>
                                    </div>

                                    <div>
                                      <label className="text-[11px] font-bold text-text-secondary block mb-1">
                                        Justificativa do estouro de budget (Obrigatório) *
                                      </label>
                                      <textarea
                                        disabled={!!activeJob.selectedFreelancerId}
                                        placeholder="Explique o motivo do teto ultrapassado (ex: profissional sênior com alta aderência técnica)..."
                                        value={sl.notes || ''}
                                        onChange={(e) => handleUpdateNegotiation(cand.id, { notes: e.target.value })}
                                        className="w-full bg-white dark:bg-slate-800 border border-border-subtle p-2 rounded-lg text-xs focus:outline-none focus:border-action-cyan text-text-primary dark:text-white resize-none"
                                        rows={2}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* ─── RIGHT COLUMN (col-span-12 lg:col-span-7) ─── */}
                            <div className="lg:col-span-7 space-y-4 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-border-subtle pt-5 lg:pt-0 lg:pl-6 text-left">
                              {(() => {
                                const candNeg = getCandidateNeg(cand.id, sl);
                                const startDateStr = activeJob?.startDate || candNeg.contractStartDate || '';
                                const endDateStr = activeJob?.endDate || candNeg.contractEndDate || '';

                                const formatISOToBR = (isoStr?: string) => {
                                  if (!isoStr) return 'A definir';
                                  const parts = isoStr.split('T')[0].split('-');
                                  if (parts.length === 3) return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
                                  return isoStr;
                                };

                                 const targetModel = (candNeg as any)?.remunerationModel || sl?.remunerationModel || activeJob?.remunerationModel;
                                const projections = (startDateStr && endDateStr) ? simulatePaymentProjections(startDateStr, endDateStr, targetModel) : [];

                                const getAlertBadgeConfig = (level: 'informational' | 'attention' | 'urgent' | 'critical') => {
                                  switch (level) {
                                    case 'critical':
                                      return {
                                        label: '🚨 ALERTA CRÍTICO: Abertura de RC Imediata',
                                        badgeClass: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/40',
                                      };
                                    case 'urgent':
                                      return {
                                        label: '🔥 ALTA PRIORIDADE: 0 a 3 dias para Prazo da RC',
                                        badgeClass: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/40',
                                      };
                                    case 'attention':
                                      return {
                                        label: '⚡ ATENÇÃO: 4 a 10 dias para Prazo da RC',
                                        badgeClass: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40',
                                      };
                                    case 'informational':
                                    default:
                                      return {
                                        label: '✅ REGULAR: Mais de 10 dias até o Prazo da RC',
                                        badgeClass: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
                                      };
                                  }
                                };

                                return (
                                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                                    {/* Supply Payment Projections Section (Sec. 5.2 & 5.3) */}
                                    <div className="bg-slate-900/90 text-white p-5 rounded-2xl border border-slate-700/80 shadow-md space-y-4 flex-1">
                                      <div className="flex items-center justify-between pb-3 border-b border-slate-700/80">
                                        <div className="flex items-center gap-2.5">
                                          <div className="p-2 rounded-lg bg-action-cyan/10 border border-action-cyan/30 text-action-cyan">
                                            <Clock className="w-4 h-4" />
                                          </div>
                                          <div>
                                            <h4 className="font-extrabold text-xs text-white uppercase tracking-wider">
                                              Projeções de Pagamento & Supply
                                            </h4>
                                            <p className="text-[10px] text-slate-400">Diretrizes da Política de Supply v2.0</p>
                                          </div>
                                        </div>
                                      </div>

                                      {projections.length > 0 ? (
                                        <div className="space-y-3">
                                          {projections.map((p, idx) => {
                                            const monthLabel = p.referenceMonth || getDominantMonthLabel(p.startDate, p.endDate);
                                            const parcelVal = negotiatedTotal !== null ? negotiatedTotal / projections.length : 0;
                                            const cycleDays = (p as any).daysInCycle || (p.startDate && p.endDate ? Math.round((new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / 86400000) + 1 : 0);

                                            return (
                                              <div key={idx} className="bg-slate-800/90 border border-slate-700/90 rounded-xl p-4 space-y-3 text-xs shadow-xs">
                                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/60 pb-2.5">
                                                  <div className="flex items-center gap-2">
                                                    <span className="font-bold text-white text-[11px] bg-slate-700/90 border border-slate-600 px-2.5 py-0.5 rounded">
                                                      {projections.length > 1 ? `Parcela ${p.cycleNumber}/${projections.length}` : 'Parcela Única'}
                                                    </span>
                                                    <span className="text-[11px] text-action-cyan font-extrabold">
                                                      Mês de Referência: {monthLabel}
                                                    </span>
                                                  </div>
                                                  <span className="text-[10px] text-slate-400 font-medium">
                                                    {cycleDays} dias de alocação
                                                  </span>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                                  <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-3 flex flex-col justify-between">
                                                    <span className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                                                      PERÍODO DO CICLO
                                                    </span>
                                                    <span className="text-xs font-bold text-white block">
                                                      {formatISOToBR(p.startDate)} a {formatISOToBR(p.endDate)}
                                                    </span>
                                                  </div>

                                                  <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-3 flex flex-col justify-between">
                                                    <span className="block text-[9px] font-extrabold uppercase tracking-wider text-emerald-400 mb-1">
                                                      VALOR PREVISTO DA PARCELA
                                                    </span>
                                                    <span className="text-base font-extrabold text-emerald-300 block">
                                                      {parcelVal > 0 
                                                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parcelVal) 
                                                        : 'Sob consulta'}
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-slate-400 italic">
                                          Defina o período do contrato para gerar as projeções de pagamento conforme a política de Supply.
                                        </p>
                                      )}

                                      {/* Mandatory Notice Disclaimer */}
                                      <div className="pt-3 border-t border-slate-700/80 text-[11px] text-amber-300 bg-amber-950/30 border border-amber-900/40 rounded-xl p-3.5 space-y-1">
                                        <strong className="block font-bold text-amber-400 text-[11.5px] flex items-center gap-1.5">
                                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                                          <span>Aviso Obrigatório da Política de Supply</span>
                                        </strong>
                                        <p className="text-amber-200/90 leading-relaxed text-[11px]">
                                          O pagamento depende da abertura e aprovação da RC pelo núcleo contratante no ERP de Supply, respeitando os prazos e políticas internas (antecedência mínima de 10 dias corridos).
                                        </p>
                                      </div>
                                    </div>

                                    {/* Action Footer */}
                                    <div className="pt-2 flex justify-end">
                                      <button
                                        type="button"
                                        disabled={isButtonDisabled}
                                        onClick={() => handleFinalAllocation(cand.id, sl.id, rate, billing, sl.notes || '', sl)}
                                        className={`font-extrabold px-6 py-3 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer ${
                                          isButtonDisabled 
                                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60' 
                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/20'
                                        }`}
                                      >
                                        <CheckCircle className="w-4 h-4" />
                                        <span>Confirmar Alocação</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-start pt-4 border-t border-border-subtle">
            <button
              onClick={() => handleNavigateStep(3)}
              className="bg-white border border-border-strong hover:bg-slate-50 text-text-secondary font-bold p-3 px-6 rounded-xl text-xs transition-all cursor-pointer"
            >
              Voltar para Negociação
            </button>
          </div>
        </div>
      )}      {/* Custom Approval Request Modal */}
      {approvalModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs font-sans">
          <div className="bg-[#0b1329] border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col relative animate-scale-up">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#0e172e]">
              <div>
                <h3 className="font-extrabold text-white text-sm">
                  {approvalModal.type === 'schedule_conflict' 
                    ? 'Solicitar aprovação RH' 
                    : 'Solicitar aprovação Head'}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  Fluxo de Exceção Operacional
                </p>
              </div>
              <button
                type="button"
                onClick={() => setApprovalModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition cursor-pointer"
                disabled={approvalModal.loading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex flex-col gap-4 text-xs">
              <p className="text-slate-300 leading-relaxed">
                {approvalModal.type === 'schedule_conflict'
                  ? 'Este freelancer possui conflito de agenda no período do job. Informe a justificativa para solicitar uma exceção ao RH.'
                  : 'Este freelancer está com valor acordado acima do teto da política comercial. Informe a justificativa para solicitar uma exceção ao Head.'}
              </p>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                  Justificativa da solicitação <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={approvalModal.reason}
                  onChange={(e) => setApprovalModal(prev => ({ ...prev, reason: e.target.value, error: null }))}
                  placeholder="Descreva detalhadamente a justificativa técnica para esta contratação excepcional (mínimo 10 caracteres)..."
                  className="w-full h-32 px-3 py-2 text-xs bg-[#121c38] border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-action-cyan placeholder-slate-500 resize-none transition-all"
                  maxLength={1000}
                  disabled={approvalModal.loading}
                />
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium px-1">
                  <span>Mínimo 10, máx. 1000 caracteres</span>
                  <span>{approvalModal.reason.length}/1000</span>
                </div>
              </div>

              {approvalModal.error && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/80 text-[11px] text-red-400 font-semibold">
                  ⚠️ {approvalModal.error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#0e172e] border-t border-slate-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setApprovalModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                disabled={approvalModal.loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitApprovalRequest}
                className="px-4 py-2 text-xs font-bold bg-[#00BCD4] hover:bg-[#00BCD4]/95 text-white rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={approvalModal.loading}
              >
                {approvalModal.loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar solicitação'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Head Decision Modal */}
      {headDecisionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/70 backdrop-blur-xs font-sans">
          <div className="bg-[#0b1329] border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col relative animate-scale-up">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#0e172e]">
              <div>
                <h3 className="font-extrabold text-white text-sm">
                  {headDecisionModal.decision === 'approve' 
                    ? 'Aprovar Exceção de Valor' 
                    : 'Reprovar Exceção de Valor'}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  Decisão do Head do Núcleo &bull; {headDecisionModal.freelancerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHeadDecisionModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition cursor-pointer"
                disabled={headDecisionModal.loading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex flex-col gap-4 text-xs font-sans">
              <p className="text-slate-300 leading-relaxed">
                {headDecisionModal.decision === 'approve'
                  ? 'Você está aprovando esta contratação com taxas comerciais fora da política padrão. Justifique detalhadamente por que esta exceção é válida.'
                  : 'Descreva a justificativa para reprovar a solicitação de exceção de valor para esta contratação.'}
              </p>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                  Comentários / Justificativa da decisão <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={headDecisionModal.comment}
                  onChange={(e) => setHeadDecisionModal(prev => ({ ...prev, comment: e.target.value, error: null }))}
                  placeholder="Informe os detalhes da sua decisão (mínimo 5 caracteres)..."
                  className="w-full h-32 px-3 py-2 text-xs bg-[#121c38] border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-action-cyan placeholder-slate-500 resize-none transition-all"
                  maxLength={1000}
                  disabled={headDecisionModal.loading}
                />
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium px-1">
                  <span>Mínimo 5, máx. 1000 caracteres</span>
                  <span>{headDecisionModal.comment.length}/1000</span>
                </div>
              </div>

              {headDecisionModal.error && (
                <div className="p-3 rounded-lg bg-red-955/40 border border-red-800/80 text-[11px] text-red-400 font-semibold">
                  ⚠️ {headDecisionModal.error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#0e172e] border-t border-slate-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setHeadDecisionModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                disabled={headDecisionModal.loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitHeadDecision}
                className={`px-4 py-2 text-xs font-bold text-white rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  headDecisionModal.decision === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
                disabled={headDecisionModal.loading}
              >
                {headDecisionModal.loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  'Confirmar Decisão'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert UI */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 p-4 px-5 rounded-2xl shadow-xl border text-white animate-fade-in
          ${toast.type === 'success' ? 'bg-[#0b1329] border-[#00BCD4] text-white' : 'bg-red-900 border-red-650'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 
            ${toast.type === 'success' ? 'bg-[#00BCD4]/15 text-[#00BCD4]' : 'bg-white/10 text-white'}`}>
            <CheckCircle className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold">{toast.message}</p>
          <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100 p-1 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

    </div>
  );
}
