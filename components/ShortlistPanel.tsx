'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DatabaseProps } from '@/app/page';
import { generateUniqueId } from '@/lib/utils';
import { Job, Shortlist, Freelancer, ValuePolicy, Allocation, PaymentCode } from '@/lib/mockData';
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

export default function ShortlistPanel({ db }: { db: DatabaseProps }) {
  // Navigation / Stepper State
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [selectedJobIdLocal, setSelectedJobIdLocal] = useState(db.selectedJobId || '');
  const [negotiatingFreelancerId, setNegotiatingFreelancerId] = useState<string>('');

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

  // Pagination
  const [jobPage, setJobPage] = useState(1);
  const [jobLimit, setJobLimit] = useState<number>(10);

  // --- CANDIDATE SEARCH & FILTERS STATE (Step 2) ---
  const activeJob = db.jobs.find(j => j.id === selectedJobIdLocal);

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
  }

  // --- STEP 3: NEGOTIATION FORM INPUTS ---
  const [negotiatedValue, setNegotiatedValue] = useState<number>(0);
  const [billingType, setBillingType] = useState<'Diária' | 'Hora' | 'Job Fechado'>('Diária');
  const [scope, setScope] = useState('');
  const [justification, setJustification] = useState('');

  // Notifications feedback states
  const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});

  // Reset page if filters change
  useEffect(() => {
    setJobPage(1);
  }, [jobSearch, jobTabFilter, jobRoleFilter, jobSeniorityFilter, jobUrgencyFilter, jobBudgetMin, jobBudgetMax, jobStartDateFilter, jobEndDateFilter]);

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
  } = useSortableTable(jobsWithDetails, 'id', 'desc');

  // Pagination
  const totalJobs = sortedJobs.length;
  const totalPages = Math.ceil(totalJobs / jobLimit) || 1;
  const paginatedJobs = sortedJobs.slice((jobPage - 1) * jobLimit, jobPage * jobLimit);

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
    if (candidateMaxRate && f.referenceValue > Number(candidateMaxRate)) return false;
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
    const hasIncompleteData = !f.city || !f.state || !f.email || (!f.phone && !f.whatsapp);
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
      <div key={cand.id} className="p-3.5 flex flex-col gap-2.5 match-candidate-row hover:bg-bg-hover transition-colors border-b border-border-subtle last:border-0 bg-bg-surface">
        {/* Name, Score and Seniority */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center flex-wrap gap-1.5">
              <strong className="text-text-primary text-sm font-bold">{cand.name}</strong>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                score >= 75 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                score >= 50 ? 'bg-blue-100 text-blue-800 dark:bg-blue-955/40 dark:text-blue-300' :
                'bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300'
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
            <ScoreStars score={cand.averageScore} size="xs" showNumber={true} />
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
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t, idx) => {
              let tagColor = "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20";
              if (t === "Função compatível" || t === "Valor dentro do budget" || t === "Já trabalhou com V3A" || t === "Disponível") {
                tagColor = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
              } else if (t === "Função relacionada") {
                tagColor = "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
              } else if (t === "Senioridade abaixo do solicitado" || t === "Valor acima do budget" || t === "Cadastro incompleto") {
                tagColor = "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
              } else if (t === "Indisponível" || t === "Senioridade muito abaixo") {
                tagColor = "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20";
              }
              return (
                <span key={idx} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tagColor}`}>
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
            disabled={isAdded || !!activeJob.selectedFreelancerId}
            onClick={() => handleAddToShortlist(cand.id)}
            className={`add-to-shortlist-btn p-1.5 px-3 rounded-lg font-bold text-xs transition-all ${
              isAdded 
                ? 'bg-emerald-600/20 border border-emerald-600/40 text-emerald-450 dark:text-emerald-400 font-semibold cursor-default' 
                : activeJob.selectedFreelancerId
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
    setActiveStep(2); // Auto advance to Step 2
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
  const handleNavigateStep = (step: 1 | 2 | 3) => {
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
    }
  };

  // Submit and save the booking allocation
  const handleSaveNegotiation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeJob || !negotiatingFreelancerId) return;

    const policy = db.policies.find(p => p.role === activeJob.roleNeeded && p.seniority === activeJob.seniorityNeeded);
    const ceilingValue = policy ? policy.ceilingValue : 99999;
    const isExceeding = negotiatedValue > ceilingValue;

    if (isExceeding && !justification.trim()) {
      alert('⚠️ Governança Corporativa V3A:\nValores acima do teto acordado da política exigem uma justificativa técnica obrigatória para análise do RH.');
      return;
    }

    const nextStatus = isExceeding ? 'Aguardando RH' : 'Bookado';

    // 1. Update job details
    db.setJobs(prev => prev.map(j => {
      if (j.id === activeJob.id) {
        return {
          ...j,
          status: nextStatus,
          selectedFreelancerId: isExceeding ? null : negotiatingFreelancerId,
          closedAt: isExceeding ? null : new Date().toISOString(),
          closedBy: isExceeding ? null : db.currentUser.id,
          closureReason: isExceeding ? null : 'Contratação validada dentro da política de diárias'
        };
      }
      return j;
    }));

    // 2. Update candidate status in Shortlist
    db.setShortlists(prev => prev.map(sl => {
      if (sl.jobId === activeJob.id && sl.freelancerId === negotiatingFreelancerId) {
        return {
          ...sl,
          candidateStatus: isExceeding ? 'Valor fora da política' : 'Aprovado pelo RH',
          notes: isExceeding ? `Proposta de exceção: R$ ${negotiatedValue}. Justificativa: ${justification}` : sl.notes
        };
      }
      return sl;
    }));

    // 3. Create Negotiation record
    const newNeg = {
      id: generateUniqueId('neg'),
      jobId: activeJob.id,
      freelancerId: negotiatingFreelancerId,
      negotiatedValue,
      billingType,
      scope,
      status: (isExceeding ? 'Pendente aprovação RH' : 'Aprovado pelo RH') as any,
      justificationIfAbovePolicy: isExceeding ? justification : undefined
    };
    db.setNegotiations(prev => [newNeg, ...prev]);

    if (!isExceeding) {
      // 4. Create Allocation (only if within policy and successfully booked)
      const nextNumString = String(db.allocations.length + 1).padStart(4, '0');
      const mockAllocCode = `ALOC-2026-${nextNumString}`;

      const newAlloc = {
        id: generateUniqueId('alloc'),
        allocationCode: mockAllocCode,
        jobId: activeJob.id,
        freelancerId: negotiatingFreelancerId,
        nucleoId: activeJob.nucleoId,
        startDate: activeJob.startDate,
        endDate: activeJob.endDate,
        approvedValue: negotiatedValue,
        status: 'Ativo' as const
      };
      db.setAllocations(prev => [...prev, newAlloc]);

      // Note: Payment Code and allocation code trigger generation is automated in PostgreSQL, 
      // but we update the local states here to ensure UI instant responsiveness
      db.setPaymentCodes(prev => [
        ...prev,
        {
          id: generateUniqueId('pay'),
          allocationCode: mockAllocCode,
          jobId: activeJob.id,
          freelancerId: negotiatingFreelancerId,
          approvedValue: negotiatedValue,
          paymentStatus: 'Aguardando conclusão do job'
        }
      ]);

      alert(`✅ Sucesso!\nContratação realizada com sucesso!\nCódigo de alocação ${mockAllocCode} gerado.`);
    } else {
      alert(`⚠️ Exceção Enviada!\nO valor de R$ ${negotiatedValue} excede o teto contratual de R$ ${ceilingValue}.\nEsta contratação foi encaminhada para a aprovação do RH.`);
    }

    // Refresh view
    setActiveStep(3);
  };

  // Reopen Job allocation and deselect professional (MASTER / RH only)
  const handleReopenJob = () => {
    if (!activeJob) return;

    if (db.currentUser.profile !== 'MASTER' && db.currentUser.profile !== 'RH') {
      alert('⚠️ Permissão Negada:\nApenas perfis MASTER e RH possuem permissão para cancelar alocações consolidadas.');
      return;
    }

    const currentBookedFreela = db.freelancers.find(f => f.id === activeJob.selectedFreelancerId);
    const reasonInput = prompt(
      `Você está prestes a reabrir esta vaga e cancelar a alocação de "${currentBookedFreela?.name}".\n\nInsira a justificativa técnica obrigatória:`
    );

    if (reasonInput === null) return; // Prompt cancelled
    if (!reasonInput.trim()) {
      alert('⚠️ Justificativa técnica é obrigatória para cancelar a alocação.');
      return;
    }

    // Update job columns to revert booking
    db.setJobs(prev => prev.map(j => {
      if (j.id === activeJob.id) {
        return {
          ...j,
          status: 'Em shortlist',
          selectedFreelancerId: null,
          closedAt: null,
          closedBy: null,
          closureReason: `Alocação cancelada por ${db.currentUser.name}. Justificativa: ${reasonInput}`
        };
      }
      return j;
    }));

    // Inactivate or delete the allocation
    db.setAllocations(prev => prev.filter(alloc => !(alloc.jobId === activeJob.id && alloc.freelancerId === activeJob.selectedFreelancerId)));
    // Inactivate or delete the payment codes
    db.setPaymentCodes(prev => prev.filter(pc => !(pc.jobId === activeJob.id && pc.freelancerId === activeJob.selectedFreelancerId)));

    alert(`✅ Sucesso!\nAlocação revogada. Oportunidade reaberta e retornada para a fase de shortlist.`);
    setActiveStep(2);
  };

  // Helper lists for filter dropdown options
  const uniqueClients = Array.from(new Set(db.jobs.map(j => j.client))).filter(Boolean).sort();
  const uniqueJobRoles = Array.from(new Set(db.jobs.map(j => j.roleNeeded))).filter(Boolean).sort();
  const uniqueFreelancerRoles = Array.from(new Set([
    ...db.freelancers.map(f => f.mainRole),
    ...db.freelancers.flatMap(f => f.secondaryRoles)
  ])).filter(Boolean).sort();

  return (
    <div id="shortlist-workflow-panel" className="space-y-6">
      
      {/* -------------------- STEPPER COMPONENT -------------------- */}
      <div className="bg-white p-4 rounded-2xl border border-border-subtle shadow-xs">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sidebar-navy rounded-xl text-white">
              <Scale className="w-6 h-6 text-action-cyan" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-sidebar-navy leading-none">Workflow de Shortlist & Negociação</h2>
              <p className="text-xs text-text-secondary mt-1">Conduza oportunidades desde a seleção até a homologação contratual.</p>
            </div>
          </div>

          {/* Stepper Steps UI */}
          <div className="flex items-center gap-1.5 md:gap-4 text-xs font-semibold">
            {/* Step 1 */}
            <button 
              onClick={() => handleNavigateStep(1)}
              className={`flex items-center gap-2 p-2 px-3.5 rounded-xl border transition-all ${
                activeStep === 1 
                  ? 'bg-sidebar-navy text-white border-sidebar-navy shadow-xs' 
                  : selectedJobIdLocal 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-slate-50 text-text-secondary border-border-subtle hover:bg-slate-100'
              }`}
            >
              <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] ${
                activeStep === 1 ? 'bg-action-cyan text-sidebar-navy font-bold' : 'bg-emerald-600 text-white'
              }`}>
                {selectedJobIdLocal ? <Check className="w-3 h-3" /> : '1'}
              </span>
              <span>1. Seleção do Job</span>
            </button>

            <ChevronRight className="w-4 h-4 text-text-secondary hidden md:block" />

            {/* Step 2 */}
            <button 
              onClick={() => handleNavigateStep(2)}
              className={`flex items-center gap-2 p-2 px-3.5 rounded-xl border transition-all ${
                activeStep === 2 
                  ? 'bg-sidebar-navy text-white border-sidebar-navy shadow-xs' 
                  : jobShortlists.length > 0
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-slate-50 text-text-secondary border-border-subtle hover:bg-slate-100'
              }`}
            >
              <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] ${
                activeStep === 2 ? 'bg-action-cyan text-sidebar-navy font-bold' : 'bg-slate-200 text-text-secondary'
              }`}>
                {jobShortlists.length > 0 && selectedJobIdLocal ? <Check className="w-3 h-3" /> : '2'}
              </span>
              <span>2. Shortlist</span>
            </button>

            <ChevronRight className="w-4 h-4 text-text-secondary hidden md:block" />

            {/* Step 3 */}
            <button 
              onClick={() => handleNavigateStep(3)}
              className={`flex items-center gap-2 p-2 px-3.5 rounded-xl border transition-all ${
                activeStep === 3 
                  ? 'bg-sidebar-navy text-white border-sidebar-navy shadow-xs' 
                  : activeJob?.selectedFreelancerId
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-slate-50 text-text-secondary border-border-subtle hover:bg-slate-100'
              }`}
            >
              <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] ${
                activeStep === 3 ? 'bg-action-cyan text-sidebar-navy font-bold' : 'bg-slate-200 text-text-secondary'
              }`}>
                {activeJob?.selectedFreelancerId ? <Check className="w-3 h-3" /> : '3'}
              </span>
              <span>3. Alocação</span>
            </button>
          </div>
        </div>
      </div>

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

          {/* LIST/TABLE OF JOBS */}
          {layoutMode === 'table' ? (
            <div className="bg-white rounded-2xl border border-border-subtle overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-border-subtle text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                      <SortableHeader label="Código" sortKey="id" activeSortKey={jobSortKey} direction={jobSortDirection} onSort={requestJobSort} className="p-4" />
                      <SortableHeader label="Nome do Job" sortKey="name" activeSortKey={jobSortKey} direction={jobSortDirection} onSort={requestJobSort} className="p-4" />
                      <SortableHeader label="Cliente" sortKey="client" activeSortKey={jobSortKey} direction={jobSortDirection} onSort={requestJobSort} className="p-4" />
                      <SortableHeader label="Núcleo" sortKey="nucleoName" activeSortKey={jobSortKey} direction={jobSortDirection} onSort={requestJobSort} className="p-4" />
                      <SortableHeader label="Função / Senioridade" sortKey="roleNeeded" activeSortKey={jobSortKey} direction={jobSortDirection} onSort={requestJobSort} className="p-4" />
                      <SortableHeader label="Período" sortKey="startDate" activeSortKey={jobSortKey} direction={jobSortDirection} onSort={requestJobSort} className="p-4" />
                      <SortableHeader label="Budget" sortKey="budget" activeSortKey={jobSortKey} direction={jobSortDirection} onSort={requestJobSort} align="right" className="p-4" />
                      <SortableHeader label="Diária Média" sortKey="dailyAvgValue" activeSortKey={jobSortKey} direction={jobSortDirection} onSort={requestJobSort} align="right" className="p-4" />
                      <SortableHeader label="Status" sortKey="status" activeSortKey={jobSortKey} direction={jobSortDirection} onSort={requestJobSort} align="center" className="p-4" />
                      <SortableHeader label="Shortlist" sortKey="shCount" activeSortKey={jobSortKey} direction={jobSortDirection} onSort={requestJobSort} align="center" className="p-4" />
                      <th className="p-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {paginatedJobs.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="p-12 text-center text-text-secondary italic">
                          Nenhum job localizado com os critérios selecionados.
                        </td>
                      </tr>
                    ) : (
                      paginatedJobs.map((job) => {
                        const nucleo = db.nucleos.find(n => n.id === job.nucleoId);
                        const code = job.id.slice(0, 8).toUpperCase();
                        const shCount = db.shortlists.filter(sl => sl.jobId === job.id).length;
                        const dailyAvg = calculateDailyAverage(job);
                        const isSelected = selectedJobIdLocal === job.id;

                        return (
                          <tr key={job.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                            <td className="p-4 font-mono font-bold text-text-secondary">{code}</td>
                            <td className="p-4 font-bold text-sidebar-navy">{job.name}</td>
                            <td className="p-4 text-text-secondary">{job.client}</td>
                            <td className="p-4 font-semibold text-text-secondary">{nucleo ? nucleo.name : '—'}</td>
                            <td className="p-4">
                              <span className="font-semibold text-text-primary">{job.roleNeeded}</span>
                              <span className="text-text-secondary font-medium"> ({job.seniorityNeeded})</span>
                            </td>
                            <td className="p-4 whitespace-nowrap text-text-secondary">
                              {job.startDate ? new Date(job.startDate).toLocaleDateString('pt-BR') : 'A definir'} a{' '}
                              {job.endDate ? new Date(job.endDate).toLocaleDateString('pt-BR') : 'A definir'}
                            </td>
                            <td className="p-4 text-right font-bold text-sidebar-navy">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(job.budget)}
                            </td>
                            <td className="p-4 text-right text-text-secondary">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dailyAvg)}
                            </td>
                            <td className="p-4 text-center whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                                job.status === 'Bookado' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : job.status === 'Aguardando RH'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : job.status === 'Encerrado'
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}>
                                {job.status}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full text-[10px]">
                                {shCount} freelas
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleSelectJob(job.id)}
                                className={`font-bold px-3 py-1.5 rounded-lg text-[11px] border transition-all ${
                                  isSelected 
                                    ? 'bg-emerald-600 border-emerald-600 text-white' 
                                    : 'bg-primary/10 border-primary/20 hover:bg-action-cyan hover:text-white hover:border-action-cyan text-sidebar-navy'
                                }`}
                              >
                                {isSelected ? 'Selecionado' : 'Selecionar'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 bg-slate-50 border-t border-border-subtle flex items-center justify-between">
                  <span className="text-xs text-text-secondary">
                    Mostrando <strong>{Math.min(totalJobs, (jobPage - 1) * jobLimit + 1)}</strong>-<strong>{Math.min(totalJobs, jobPage * jobLimit)}</strong> de <strong>{totalJobs}</strong> jobs
                  </span>
                  <div className="flex gap-1">
                    <button
                      disabled={jobPage === 1}
                      onClick={() => setJobPage(p => Math.max(1, p - 1))}
                      className="p-1 px-3 bg-white border border-border-subtle rounded text-xs hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setJobPage(p)}
                        className={`p-1 px-3 rounded text-xs font-bold border transition-all ${
                          jobPage === p 
                            ? 'bg-sidebar-navy border-sidebar-navy text-white' 
                            : 'bg-white border-border-subtle hover:bg-slate-50 text-text-secondary'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      disabled={jobPage === totalPages}
                      onClick={() => setJobPage(p => Math.min(totalPages, p + 1))}
                      className="p-1 px-3 bg-white border border-border-subtle rounded text-xs hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Cards layout view mode */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedJobs.length === 0 ? (
                <div className="col-span-full bg-white p-12 text-center text-text-secondary border border-border-subtle rounded-2xl italic">
                  Nenhum job localizado com os critérios selecionados.
                </div>
              ) : (
                paginatedJobs.map((job) => {
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
                              {job.startDate ? new Date(job.startDate).toLocaleDateString('pt-BR') : 'A definir'} a{' '}
                              {job.endDate ? new Date(job.endDate).toLocaleDateString('pt-BR') : 'A definir'}
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
                          className={`p-1.5 px-4 rounded-lg font-bold text-xs border transition-all ${
                            isSelected 
                              ? 'bg-emerald-600 border-emerald-600 text-white' 
                              : 'bg-primary/10 border-primary/20 hover:bg-action-cyan hover:text-white hover:border-action-cyan text-sidebar-navy'
                          }`}
                        >
                          {isSelected ? 'Selecionado' : 'Selecionar'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {selectedJobIdLocal && (
            <div className="flex justify-end pt-4">
              <button
                onClick={() => handleNavigateStep(2)}
                className="bg-sidebar-navy hover:bg-sidebar-navy/95 text-white font-bold p-3 px-6 rounded-xl flex items-center gap-2 text-xs shadow-xs"
              >
                <span>Avançar para Shortlist</span>
                <ArrowRight className="w-4 h-4 text-action-cyan" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* -------------------- STEP 2: SHORTLIST COMPOSITION -------------------- */}
      {activeStep === 2 && activeJob && (
        <div className="space-y-6">
          {/* Active Job Meta-Header */}
          <div className="bg-slate-800 text-slate-100 p-5 rounded-2xl border border-slate-700 shadow-md flex flex-col md:flex-row justify-between gap-6 job-meta-header">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-slate-900 text-slate-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                  COD: {activeJob.id.slice(0, 8).toUpperCase()}
                </span>
                <span className="text-[11px] uppercase font-bold text-action-cyan tracking-wider">Oportunidade Selecionada</span>
                <span className="bg-blue-900 text-blue-200 border border-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">{activeJob.status}</span>
              </div>
              <h3 className="text-base font-bold text-white leading-tight">[{activeJob.client}] {activeJob.name}</h3>
              <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-slate-300">
                <div>Função Requerida: <strong className="text-white">{activeJob.roleNeeded} ({activeJob.seniorityNeeded})</strong></div>
                <div>Urgência: <strong className={activeJob.urgency === 'Alta' ? 'text-red-400' : 'text-slate-200'}>{activeJob.urgency}</strong></div>
                <div>Período: <strong className="text-white">{activeJob.startDate ? new Date(activeJob.startDate).toLocaleDateString('pt-BR') : 'A definir'} a {activeJob.endDate ? new Date(activeJob.endDate).toLocaleDateString('pt-BR') : 'A definir'}</strong></div>
              </div>
            </div>

            <div className="flex flex-col justify-between items-end gap-3 min-w-[200px]">
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-400">Budget Máximo</div>
                <div className="text-base font-bold text-action-cyan">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(activeJob.budget)}
                </div>
                <div className="text-[10px] text-slate-400">
                  Média diária: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateDailyAverage(activeJob))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleClearJob}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold p-2 px-3 rounded-lg text-xs transition-all border border-slate-600"
                >
                  Trocar Job
                </button>
              </div>
            </div>
          </div>

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
                      <input
                        type="number"
                        value={candidateMaxRate}
                        onChange={(e) => setCandidateMaxRate(e.target.value)}
                        placeholder="Valor máximo"
                        className="w-full bg-white border border-border-subtle p-1.5 rounded-lg text-xs"
                      />
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
              <div className="bg-white p-5 rounded-2xl border border-border-subtle shadow-xs space-y-4">
                <div>
                  <h4 className="font-bold text-sidebar-navy text-sm flex items-center gap-1.5">
                    <CheckCircle className="w-4.5 h-4.5 text-emerald-600" />
                    <span>Shortlist Oficial da Demanda ({jobShortlists.length})</span>
                  </h4>
                  <p className="text-[11px] text-text-secondary mt-0.5">Determine o status de negociação de cada candidato.</p>
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                  {jobShortlists.length === 0 ? (
                    <div className="p-8 text-center text-text-secondary border border-dashed border-border-subtle rounded-2xl italic text-xs">
                      Shortlist vazia. Adicione profissionais recomendados no painel lateral.
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

                          {/* Candidate negotiation status */}
                          <div className="mt-3.5 space-y-2.5 pt-3 border-t border-dashed border-border-subtle text-xs">
                            <div>
                              <label className="text-[11px] font-bold text-text-secondary block mb-1">Status da Negociação</label>
                              <select
                                disabled={!!activeJob.selectedFreelancerId}
                                value={sl.candidateStatus}
                                onChange={(e) => handleStatusChange(sl.freelancerId, e.target.value as any)}
                                className="w-full bg-white border border-border-subtle p-2 rounded-lg text-xs font-semibold focus:outline-none focus:border-action-cyan disabled:bg-slate-50 disabled:opacity-85"
                              >
                                <option value="Selecionado">Selecionado</option>
                                <option value="Em negociação">Em negociação</option>
                                <option value="Aguardando retorno">Aguardando retorno</option>
                                <option value="Valor fora da política">Valor fora da política</option>
                                <option value="Aprovado RH">Aprovado pelo RH</option>
                                <option value="Rejeitado">Rejeitado</option>
                                <option value="Aceitou">Aceitou</option>
                                <option value="Não aceitou">Não aceitou</option>
                              </select>
                            </div>

                            {/* Candidate Observations / Notes */}
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
              <button
                onClick={() => handleNavigateStep(3)}
                className="bg-sidebar-navy hover:bg-sidebar-navy/95 text-white font-bold p-3 px-6 rounded-xl flex items-center gap-2 text-xs shadow-xs"
              >
                <span>Avançar para Contratação & Alocação</span>
                <ArrowRight className="w-4 h-4 text-action-cyan" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* -------------------- STEP 3: CONTRACT NEGOTIATION & ALLOCATION -------------------- */}
      {activeStep === 3 && activeJob && (
        <div className="space-y-6">
          
          {/* Active Job Meta-Header */}
          <div className="bg-[#1E293B] text-slate-100 p-5 rounded-2xl border border-slate-700 shadow-md flex flex-col md:flex-row justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-slate-750 text-slate-100 border border-slate-650 font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                  COD: {activeJob.id.slice(0, 8).toUpperCase()}
                </span>
                <span className="text-[11px] uppercase font-bold text-action-cyan tracking-wider">Homologação da Alocação</span>
                <span className="bg-emerald-950 text-emerald-300 border border-emerald-800/90 px-2 py-0.5 rounded text-[10px] font-bold">{activeJob.status}</span>
              </div>
              <h3 className="text-lg font-extrabold text-white leading-tight">[{activeJob.client}] {activeJob.name}</h3>
              <p className="text-xs text-slate-200">
                Alocação: <strong className="text-white font-extrabold">{activeJob.roleNeeded} ({activeJob.seniorityNeeded})</strong> &bull; Período: <strong className="text-white font-extrabold">{activeJob.startDate ? new Date(activeJob.startDate).toLocaleDateString('pt-BR') : 'A definir'} a {activeJob.endDate ? new Date(activeJob.endDate).toLocaleDateString('pt-BR') : 'A definir'}</strong>
              </p>
            </div>

            <div className="flex flex-col justify-between items-end gap-3 min-w-[200px]">
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-300">Budget do Job</div>
                <div className="text-lg font-extrabold text-action-cyan">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(activeJob.budget)}
                </div>
                <div className="text-[10px] text-slate-300">
                  Média diária: <strong className="text-white font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateDailyAverage(activeJob))}</strong>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleNavigateStep(2)}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-extrabold p-2 px-3 rounded-lg text-xs transition-all cursor-pointer"
                >
                  Voltar para Shortlist
                </button>
              </div>
            </div>
          </div>

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
                    <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-2 text-emerald-600">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    <h4 className="font-bold text-sidebar-navy text-sm">{bookedFreelancer?.name}</h4>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded inline-block mt-1">
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
                    {bookedFreelancer?.whatsapp && (
                      <div className="flex justify-between items-center pt-2 border-t border-dashed border-border-subtle">
                        <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> WhatsApp:</span>
                        <strong className="text-text-primary">{bookedFreelancer.whatsapp}</strong>
                      </div>
                    )}
                    {bookedFreelancer?.email && (
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> E-mail:</span>
                        <strong className="text-text-primary text-[11.5px] truncate max-w-[150px]" title={bookedFreelancer.email}>{bookedFreelancer.email}</strong>
                      </div>
                    )}
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
                        {allocation?.startDate ? new Date(allocation.startDate).toLocaleDateString('pt-BR') : 'A definir'} a{' '}
                        {allocation?.endDate ? new Date(allocation.endDate).toLocaleDateString('pt-BR') : 'A definir'}
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
                      <span>Para rescindir, trocar profissional ou reabrir esta vaga, utilize o painel ao lado (apenas Master/RH).</span>
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
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              
              {/* Form Input fields */}
              <div className="xl:col-span-7 bg-bg-surface p-5 rounded-2xl border border-border-subtle shadow-xs">
                <div>
                  <h4 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                    <Scale className="w-5 h-5 text-action-cyan" />
                    <span>Diretrizes e Rates de Contratação</span>
                  </h4>
                  <p className="text-[11px] text-text-secondary mt-0.5">Insira o rate fechado com o profissional e valide com a política corporativa.</p>
                </div>

                <form onSubmit={handleSaveNegotiation} className="space-y-4 pt-4 text-xs">
                  
                  {/* Select candidate from shortlist */}
                  <div>
                    <label className="font-bold text-text-primary block mb-1">Selecionar Profissional da Shortlist *</label>
                    <select
                      required
                      value={negotiatingFreelancerId}
                      onChange={(e) => setNegotiatingFreelancerId(e.target.value)}
                      className="w-full border border-border-strong p-2.5 rounded-lg text-xs font-semibold bg-bg-input text-text-primary focus:outline-none focus:border-action-cyan"
                    >
                      <option value="">-- Selecione o profissional --</option>
                      {jobShortlists.map(sl => {
                        const cand = db.freelancers.find(f => f.id === sl.freelancerId);
                        return (
                          <option key={sl.freelancerId} value={sl.freelancerId} className="bg-bg-surface text-text-primary">
                            {cand?.name} ({cand?.seniority}) - Ref: R$ {cand?.referenceValue}/diária
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {negotiatingFreelancerId && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="font-bold text-text-primary block mb-1">Taxa Acordada (R$) *</label>
                          <input
                            type="number"
                            required
                            value={negotiatedValue || ''}
                            onChange={(e) => setNegotiatedValue(Number(e.target.value))}
                            className="w-full border border-border-strong p-2.5 rounded-lg text-xs bg-bg-input text-text-primary font-bold focus:outline-none focus:border-action-cyan"
                            placeholder="Ex: 650"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-text-primary block mb-1">Modelo de Remuneração</label>
                          <select
                            value={billingType}
                            onChange={(e) => setBillingType(e.target.value as any)}
                            className="w-full border border-border-strong p-2.5 rounded-lg text-xs bg-bg-input text-text-primary focus:outline-none focus:border-action-cyan font-medium"
                          >
                            <option value="Diária" className="bg-bg-surface text-text-primary">Diária</option>
                            <option value="Hora" className="bg-bg-surface text-text-primary">Hora</option>
                            <option value="Job Fechado" className="bg-bg-surface text-text-primary">Job Fechado</option>
                          </select>
                        </div>
                      </div>

                      {/* REAL-TIME POLICY COMPARATOR WIDGET */}
                      {(() => {
                        const policy = db.policies.find(p => p.role === activeJob.roleNeeded && p.seniority === activeJob.seniorityNeeded);
                        const ceilingValue = policy ? policy.ceilingValue : 99999;
                        const reference = policy ? policy.referenceValue : 0;
                        const exceedsCeiling = negotiatedValue > ceilingValue;
                        const belowReference = negotiatedValue < reference;

                        return (
                          <div className={`p-4 rounded-xl border transition-all ${
                            exceedsCeiling
                              ? 'bg-danger-bg border-danger-border text-danger-text'
                              : belowReference
                                ? 'bg-warning-bg border-warning-border text-warning-text'
                                : 'bg-success-bg border-success-border text-success-text'
                          }`}>
                            <div className="flex gap-2.5 items-start">
                              <Scale className={`w-5 h-5 shrink-0 mt-0.5 ${exceedsCeiling ? 'text-danger-border' : belowReference ? 'text-warning-border' : 'text-success-border'}`} />
                              <div className="space-y-1">
                                {exceedsCeiling ? (
                                  <>
                                    <h5 className="font-bold text-danger-text text-xs">🚨 Alerta de Exceção de Política (Acima do Teto)</h5>
                                    <p className="text-[11.5px] text-text-secondary leading-normal">
                                      A diária proposta excede o teto contratual de <strong>R$ {ceilingValue}</strong> estabelecido para {activeJob.roleNeeded} {activeJob.seniorityNeeded}.
                                      Para prosseguir, insira uma justificativa técnica robusta abaixo. O RH avaliará manualmente.
                                    </p>
                                  </>
                                ) : belowReference ? (
                                  <>
                                    <h5 className="font-bold text-warning-text text-xs">⚠️ Tarifa Abaixo da Referência Padrão</h5>
                                    <p className="text-[11.5px] text-text-secondary leading-normal">
                                      O valor está abaixo da referência de mercado homologada (R$ {reference}). 
                                      Homologação será instantânea. Métrica do teto máximo: R$ {ceilingValue}.
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <h5 className="font-bold text-success-text text-xs">✅ Tarifa Dentro da Política Homologada</h5>
                                    <p className="text-[11.5px] text-text-secondary leading-normal">
                                      O valor proposto está perfeitamente alinhado com o acordo comercial (Teto: R$ {ceilingValue} | Referência: R$ {reference}).
                                      A alocação será consolidada instantaneamente e o job será bloqueado para o profissional.
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>

                            {exceedsCeiling && (
                              <div className="mt-4 pt-3.5 border-t border-danger-border/30">
                                <label className="font-bold text-danger-text block mb-1 uppercase tracking-wider text-[10px]">Justificativa Técnica ao RH *</label>
                                <textarea
                                  rows={3}
                                  required
                                  value={justification}
                                  onChange={(e) => setJustification(e.target.value)}
                                  placeholder="Explique os motivos técnicos para exceder a política (Ex: Professional com conhecimento especializado requerido pelo cliente, complexidade de cronograma)..."
                                  className="w-full bg-bg-input border border-danger-border/50 p-2.5 rounded-lg text-xs focus:outline-none focus:border-danger-border text-text-primary placeholder:text-text-muted/70"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div>
                        <label className="font-bold text-text-primary block mb-1 font-semibold">Escopo e Cronograma Específicos</label>
                        <textarea
                          rows={3}
                          value={scope}
                          onChange={(e) => setScope(e.target.value)}
                          placeholder="Detalhes adicionais combinados para a execução da atividade..."
                          className="w-full bg-bg-input border border-border-strong p-2.5 rounded-lg text-xs focus:outline-none focus:border-action-cyan text-text-primary placeholder:text-text-muted/70"
                        />
                      </div>

                      <div className="flex justify-end gap-2.5 pt-3">
                        <button
                          type="button"
                          onClick={() => setNegotiatingFreelancerId('')}
                          className="bg-bg-surface border border-border-strong hover:bg-bg-hover text-text-secondary font-bold p-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          Limpar
                        </button>
                        <button
                          type="submit"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold p-2.5 px-5 rounded-xl flex items-center gap-1 text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Homologar & Concluir Alocação</span>
                        </button>
                      </div>
                    </>
                  )}

                </form>
              </div>

              {/* RIGHT SIDEBAR: POLICY TABLE REFERENCE METRICS */}
              <div className="xl:col-span-5 space-y-4">
                <div className="bg-bg-panel p-5 rounded-2xl border border-border-subtle space-y-4 text-xs">
                  <div>
                    <h4 className="font-bold text-text-primary text-xs flex items-center gap-1.5">
                      <SlidersHorizontal className="w-4 h-4 text-action-cyan" />
                      <span>Política Comercial de Referência V3A</span>
                    </h4>
                    <p className="text-[10px] text-text-secondary mt-0.5">Tabela referencial homologada comercialmente.</p>
                  </div>

                  <div className="space-y-3.5 max-h-[400px] overflow-y-auto pr-1">
                    {db.policies.filter(p => p.role === activeJob.roleNeeded).map(p => {
                      const isExactSeniority = p.seniority === activeJob.seniorityNeeded;
                      return (
                        <div 
                          key={p.id} 
                          className={`p-3 rounded-xl border transition-all ${
                            isExactSeniority 
                              ? 'bg-action-cyan/10 border-action-cyan ring-1 ring-action-cyan' 
                              : 'bg-bg-surface border-border-subtle'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <strong className="text-text-primary font-bold">{p.role}</strong>
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              isExactSeniority ? 'bg-action-cyan text-[#0F2342]' : 'bg-bg-muted text-text-secondary border border-border-subtle'
                            }`}>
                              {p.seniority}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] text-text-secondary pt-2 border-t border-dashed border-border-subtle mt-1.5">
                            <div>
                              <span>Média Referência</span>
                              <div className="font-bold text-text-primary text-xs">R$ {p.referenceValue}</div>
                            </div>
                            <div>
                              <span>Teto Contratual</span>
                              <div className="font-bold text-danger-text text-xs">R$ {p.ceilingValue}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {db.policies.filter(p => p.role === activeJob.roleNeeded).length === 0 && (
                      <div className="bg-bg-surface p-4 rounded-xl border border-border-subtle text-center italic text-text-secondary">
                        Nenhuma diretriz de política cadastrada para {activeJob.roleNeeded}.
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          <div className="flex justify-start pt-4 border-t border-border-subtle">
            <button
              onClick={() => handleNavigateStep(2)}
              className="bg-bg-surface border border-border-strong hover:bg-bg-hover text-text-secondary font-bold p-3 px-6 rounded-xl text-xs transition-all cursor-pointer"
            >
              Voltar para Composição da Shortlist
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
