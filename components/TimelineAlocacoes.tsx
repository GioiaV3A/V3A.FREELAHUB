'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DatabaseProps } from '@/app/page';
import { Calendar, AlertTriangle, HelpCircle, Layers, CheckCircle, RefreshCw, ChevronUp, ChevronDown, X, ChevronRight } from 'lucide-react';
import { useSortableTable } from '@/hooks/useSortableTable';
import { useRouter } from 'next/navigation';

// ============================================================
// SAFE FORMATTING HELPERS
// ============================================================
const safeFormatDate = (value: any): string => {
  if (!value || typeof value !== 'string') return '—';
  const parts = value.split('-');
  if (parts.length < 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const safeFormatCurrency = (value: any): string => {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

const safeFormatPeriod = (start: any, end: any): string => {
  const s = safeFormatDate(start);
  const e = safeFormatDate(end);
  if (s !== '—' && e !== '—') {
    return `${s} a ${e}`;
  }
  if (s !== '—') return `A partir de ${s}`;
  if (e !== '—') return `Até ${e}`;
  return 'Período não informado';
};

// ============================================================
// STATUS CHIP COLORS MAPPING
// ============================================================
const getJobStatusColors = (status: string, hasConflict: boolean) => {
  if (hasConflict) {
    return {
      bg: 'bg-status-error/15 dark:bg-danger-bg/20',
      border: 'border-status-error/40 dark:border-danger-border/30',
      text: 'text-status-error dark:text-danger-text',
      hoverBg: 'hover:bg-status-error/25 dark:hover:bg-danger-bg/40',
      hoverBorder: 'hover:border-status-error dark:hover:border-danger-border',
    };
  }
  switch (status) {
    case 'Bookado':
      return {
        bg: 'bg-success-bg text-success-text',
        border: 'border-success-border/30 dark:border-success-border/20',
        text: 'text-success-text',
        hoverBg: 'hover:bg-success-bg/90',
        hoverBorder: 'hover:border-success-border',
      };
    case 'Em andamento':
      return {
        bg: 'bg-info-bg text-info-text',
        border: 'border-info-border/30 dark:border-info-border/20',
        text: 'text-info-text',
        hoverBg: 'hover:bg-info-bg/90',
        hoverBorder: 'hover:border-info-border',
      };
    case 'Oportunidade criada':
    case 'Em shortlist':
    case 'Em negociação':
    case 'Aguardando RH':
      return {
        bg: 'bg-warning-bg text-warning-text',
        border: 'border-warning-border/30 dark:border-warning-border/20',
        text: 'text-warning-text',
        hoverBg: 'hover:bg-warning-bg/90',
        hoverBorder: 'hover:border-warning-border',
      };
    case 'Concluído':
    case 'Avaliação pendente':
      return {
        bg: 'bg-neutral-bg text-neutral-text',
        border: 'border-neutral-border/30 dark:border-neutral-border/20',
        text: 'text-neutral-text',
        hoverBg: 'hover:bg-[#e2e8f0] dark:hover:bg-[#344155]',
        hoverBorder: 'hover:border-neutral-border',
      };
    default:
      return {
        bg: 'bg-bg-selected text-text-primary',
        border: 'border-border-strong',
        text: 'text-text-primary',
        hoverBg: 'hover:bg-bg-hover',
        hoverBorder: 'hover:border-border-focus',
      };
  }
};

// ============================================================
// TIMELINE ERROR BOUNDARY CLASS COMPONENT
// ============================================================
class TimelineErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Erro capturado no Gantt/Timeline:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-status-error/10 border border-status-error/20 rounded-2xl text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-status-error font-bold">
            <AlertTriangle className="w-5 h-5" />
            <span>Erro ao renderizar a Timeline de Alocações</span>
          </div>
          <p className="text-xs text-text-secondary">Ocorreu um erro inesperado de renderização. Tente recarregar a página.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-bg-surface hover:bg-bg-hover text-text-primary border border-border-subtle p-2 px-4 rounded-xl text-xs font-bold transition"
          >
            Recarregar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================
// TIMELINE WEEK HEADER COMPONENT
// ============================================================
function TimelineWeekHeader() {
  return (
    <div className="md:col-span-8 grid grid-cols-4 text-center text-[10px] uppercase font-bold tracking-wider hidden md:grid border-l border-border-subtle/40">
      <div className="border-r border-border-subtle/40 py-2 bg-table-header-bg text-table-header-text">Semana 1 (01-07/Jun)</div>
      <div className="border-r border-border-subtle/40 py-2 bg-table-header-bg text-table-header-text">Semana 2 (08-14/Jun)</div>
      <div className="border-r border-border-subtle/40 py-2 bg-table-header-bg text-table-header-text">Semana 3 (15-21/Jun)</div>
      <div className="py-2 bg-table-header-bg text-table-header-text">Semana 4 (22-30/Jun)</div>
    </div>
  );
}

// ============================================================
// TIMELINE JOB BAR COMPONENT
// ============================================================
interface TimelineJobBarProps {
  job: any;
  allocation: any;
  freelancer: any;
  onClick: () => void;
  onHover: (e: React.MouseEvent<HTMLDivElement> | null) => void;
  status: string;
  hasConflict: boolean;
  leftPercent: number;
  widthPercent: number;
}

function TimelineJobBar({ job, allocation, freelancer, onClick, onHover, status, hasConflict, leftPercent, widthPercent }: TimelineJobBarProps) {
  const colors = getJobStatusColors(status, hasConflict);
  const barText = job?.name || 'Job';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Abrir detalhes do job ${barText}`}
      className={`absolute top-1.5 bottom-1.5 rounded-md flex items-center justify-between px-3 text-[10px] font-extrabold shadow-sm cursor-pointer transition-all border outline-none focus:ring-2 focus:ring-accent ${colors.bg} ${colors.border} ${colors.text} ${colors.hoverBg} ${colors.hoverBorder}`}
      style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={(e) => onHover(e)}
      onMouseLeave={() => onHover(null)}
    >
      <span className="truncate">{barText}</span>
    </div>
  );
}

// ============================================================
// TIMELINE ALLOCATION ROW COMPONENT
// ============================================================
interface TimelineAllocationRowProps {
  alloc: any;
  freelancer: any;
  job: any;
  nucleo: any;
  hasConflict: boolean;
  overlaps: any[];
  leftPercent: number;
  widthPercent: number;
  onJobClick: () => void;
  onJobHover: (e: React.MouseEvent<HTMLDivElement> | null) => void;
}

function TimelineAllocationRow({ alloc, freelancer, job, nucleo, hasConflict, overlaps, leftPercent, widthPercent, onJobClick, onJobHover }: TimelineAllocationRowProps) {
  const allocationCode = alloc?.allocationCode || '—';
  const freelancerName = freelancer?.name || 'Incompleto';
  const mainRole = freelancer?.mainRole || '—';
  const nucleoName = nucleo?.name || 'V3A';
  const jobTitle = job?.name || '—';
  const clientName = job?.client || '—';
  const dailyRate = alloc?.approvedValue || 0;

  return (
    <div className={`p-4 hover:bg-bg-hover transition-colors ${hasConflict ? 'bg-status-error/[0.03] dark:bg-danger-bg/5' : ''} border-b border-border-subtle`}>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Panel 1: Details */}
        <div className="md:col-span-4 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <strong className="text-text-primary text-sm font-extrabold">{freelancerName}</strong>
            <span className="font-mono text-[10px] font-bold text-text-secondary bg-bg-panel border border-border-subtle px-1.5 py-0.5 rounded-lg">
              {allocationCode}
            </span>
          </div>
          
          <p className="text-xs text-text-secondary font-medium">
            <span className="font-bold text-text-primary">{mainRole}</span> &bull; {nucleoName}
          </p>
          
          {/* Status chips */}
          {hasConflict ? (
            <div className="inline-flex items-center gap-1 bg-status-error/15 text-status-error text-[10px] font-bold p-1 px-2.5 rounded-lg animate-pulse border border-status-error/20">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Conflito: {overlaps.length} {overlaps.length === 1 ? 'Job' : 'Jobs'} sobrepostos</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 bg-success-bg text-success-text text-[10px] font-extrabold p-1 px-2.5 rounded-lg border border-success-border/20">
              <CheckCircle className="w-3 h-3" />
              <span>Agenda Disponível / Livre</span>
            </div>
          )}
        </div>

        {/* Panel 2: Gantt timeline progress block */}
        <div className="md:col-span-8 space-y-2">
          {/* Desktop timeline view */}
          <div className="relative w-full h-9 bg-bg-panel border border-border-subtle rounded-lg overflow-hidden hidden md:block">
            {/* Weekly gridlines */}
            <div className="absolute inset-0 grid grid-cols-4 pointer-events-none opacity-30">
              <div className="border-r border-border-strong h-full"></div>
              <div className="border-r border-border-strong h-full"></div>
              <div className="border-r border-border-strong h-full"></div>
              <div className="h-full"></div>
            </div>

            {/* Absolute positioned job bar component */}
            <TimelineJobBar
              job={job}
              allocation={alloc}
              freelancer={freelancer}
              onClick={onJobClick}
              onHover={onJobHover}
              status={job?.status || 'Oportunidade criada'}
              hasConflict={hasConflict}
              leftPercent={leftPercent}
              widthPercent={widthPercent}
            />
          </div>

          {/* Small mobile date fallback display */}
          <div className="md:hidden space-y-2 bg-bg-surface-elevated p-3.5 rounded-xl border border-border-subtle shadow-xs">
            <p className="text-text-primary text-xs"><span className="font-bold text-text-secondary">Campanha:</span> {jobTitle} ({clientName})</p>
            <p className="text-text-secondary text-xs"><span className="font-bold text-text-muted">Cronograma:</span> {safeFormatPeriod(alloc?.startDate, alloc?.endDate)}</p>
            <p className="text-text-secondary text-xs"><span className="font-bold text-text-muted">Taxa Diária:</span> {safeFormatCurrency(dailyRate)}</p>
            
            {hasConflict && (
              <div className="mt-2 text-status-error font-semibold flex items-center gap-1 text-[10px]">
                <AlertTriangle className="w-3.5 h-3.5" /> Agenda encavalada com outro(s) job(s) ativos!
              </div>
            )}

            <button
              onClick={onJobClick}
              className="mt-2.5 w-full bg-bg-panel hover:bg-bg-hover text-text-primary font-bold py-2 px-3 rounded-lg text-xs border border-border-subtle transition flex items-center justify-center gap-1.5"
            >
              <span>Ver detalhes do job</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// JOB HOVER CARD / TOOLTIP COMPONENT (Desktop)
// ============================================================
interface JobHoverCardProps {
  job: any;
  allocation: any;
  freelancer: any;
  targetRect: DOMRect;
  paymentCodes: any[];
}

function JobHoverCard({ job, allocation, freelancer, targetRect, paymentCodes }: JobHoverCardProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const allocCode = allocation?.allocationCode || '—';
  const paymentCodesArray = Array.isArray(paymentCodes) ? paymentCodes : [];
  const paymentCode = paymentCodesArray.find(pc => pc?.allocationCode === allocCode);
  const paymentStatus = paymentCode?.paymentStatus || 'Aguardando conclusão do job';

  useEffect(() => {
    if (!tooltipRef.current) return;
    const tooltip = tooltipRef.current;
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;

    // Default positioning: centered above the target
    let top = targetRect.top - tooltipHeight - 8;
    let left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);

    // Viewport boundaries checks
    const padding = 16;
    if (left < padding) {
      left = padding;
    } else if (left + tooltipWidth > window.innerWidth - padding) {
      left = window.innerWidth - tooltipWidth - padding;
    }

    if (top < padding) {
      // If there's no space above, render below the target
      top = targetRect.bottom + 8;
    }

    setCoords({ top, left });
  }, [targetRect]);

  const jobName = job?.name || 'Job sem título';
  const clientName = job?.client || 'Não informado';
  const jobId = job?.id ? job.id.slice(0, 8).toUpperCase() : '—';
  const freelancerName = freelancer?.name || 'Não informado';
  const nucleoName = job?.nucleoName || 'Não informado';
  const roleName = job?.roleNeeded || 'Não informado';
  const seniorityName = job?.seniorityNeeded || 'Não informado';
  const periodText = safeFormatPeriod(allocation?.startDate, allocation?.endDate);
  const rateText = allocation?.approvedValue ? `${safeFormatCurrency(allocation.approvedValue)}/dia` : '—';

  return (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 100,
      }}
      className="w-72 bg-bg-surface border border-border-subtle p-4 rounded-xl shadow-xl animate-fade-in text-xs space-y-2 pointer-events-none"
    >
      <div className="flex justify-between items-start border-b border-border-subtle pb-1.5">
        <div>
          <h4 className="font-extrabold text-text-primary leading-tight text-sm truncate max-w-[180px]">{jobName}</h4>
          <p className="text-[11px] text-text-secondary font-medium">Cliente: {clientName}</p>
        </div>
        <span className="font-mono text-[9px] font-bold text-accent bg-accent-soft border border-accent/20 px-1 rounded-sm">
          {jobId}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <span className="text-text-muted block font-semibold text-[9px] uppercase tracking-wider">Freelancer</span>
          <span className="text-text-primary font-bold truncate block">{freelancerName}</span>
        </div>
        <div>
          <span className="text-text-muted block font-semibold text-[9px] uppercase tracking-wider">Núcleo</span>
          <span className="text-text-primary font-bold truncate block">{nucleoName}</span>
        </div>
        <div className="col-span-2">
          <span className="text-text-muted block font-semibold text-[9px] uppercase tracking-wider">Função / Senioridade</span>
          <span className="text-text-primary font-bold text-ellipsis overflow-hidden whitespace-nowrap block">{roleName} — {seniorityName}</span>
        </div>
        <div className="col-span-2">
          <span className="text-text-muted block font-semibold text-[9px] uppercase tracking-wider">Período</span>
          <span className="text-text-primary font-bold block">{periodText}</span>
        </div>
        <div>
          <span className="text-text-muted block font-semibold text-[9px] uppercase tracking-wider">Código Alocação</span>
          <span className="text-text-primary font-bold font-mono">{allocCode}</span>
        </div>
        <div>
          <span className="text-text-muted block font-semibold text-[9px] uppercase tracking-wider">Taxa Aprovada</span>
          <span className="text-text-primary font-bold">{rateText}</span>
        </div>
      </div>

      <div className="border-t border-border-subtle pt-2 flex flex-col gap-1.5 text-[11px]">
        <div>
          <span className="text-text-muted block font-semibold text-[9px] uppercase tracking-wider">Status Financeiro</span>
          <span className="text-text-primary font-bold">{paymentStatus}</span>
        </div>
        {allocation?.observations && (
          <div>
            <span className="text-text-muted block font-semibold text-[9px] uppercase tracking-wider">Observações</span>
            <p className="text-text-secondary italic truncate">{allocation.observations}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// JOB DETAIL POPOVER / BOTTOM SHEET (Mobile Fallback)
// ============================================================
interface JobDetailPopoverProps {
  job: any;
  allocation: any;
  freelancer: any;
  onClose: () => void;
  onOpenDetails: () => void;
  paymentCodes: any[];
}

function JobDetailPopover({ job, allocation, freelancer, onClose, onOpenDetails, paymentCodes }: JobDetailPopoverProps) {
  const allocCode = allocation?.allocationCode || '—';
  const paymentCodesArray = Array.isArray(paymentCodes) ? paymentCodes : [];
  const paymentCode = paymentCodesArray.find(pc => pc?.allocationCode === allocCode);
  const paymentStatus = paymentCode?.paymentStatus || 'Aguardando conclusão do job';

  const jobName = job?.name || 'Job sem título';
  const clientName = job?.client || 'Não informado';
  const freelancerName = freelancer?.name || 'Não informado';
  const nucleoName = job?.nucleoName || 'Não informado';
  const roleName = job?.roleNeeded || 'Não informado';
  const seniorityName = job?.seniorityNeeded || 'Não informado';
  const periodText = safeFormatPeriod(allocation?.startDate, allocation?.endDate);
  const rateText = allocation?.approvedValue ? safeFormatCurrency(allocation.approvedValue) : '—';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-bg-surface border-t sm:border border-border-subtle rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl space-y-4 animate-slide-up z-10">
        <div className="w-12 h-1 bg-border-subtle rounded-full mx-auto sm:hidden mb-2" />

        <div className="flex justify-between items-start border-b border-border-subtle pb-3">
          <div>
            <h3 className="font-extrabold text-text-primary text-base leading-snug">{jobName}</h3>
            <p className="text-xs text-text-secondary">Cliente: {clientName}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-text-muted block font-semibold text-[10px] uppercase tracking-wider">Freelancer</span>
            <span className="text-text-primary font-bold truncate block">{freelancerName}</span>
          </div>
          <div>
            <span className="text-text-muted block font-semibold text-[10px] uppercase tracking-wider">Núcleo</span>
            <span className="text-text-primary font-bold truncate block">{nucleoName}</span>
          </div>
          <div>
            <span className="text-text-muted block font-semibold text-[10px] uppercase tracking-wider">Função / Senioridade</span>
            <span className="text-text-primary font-bold truncate block">{roleName} — {seniorityName}</span>
          </div>
          <div>
            <span className="text-text-muted block font-semibold text-[10px] uppercase tracking-wider">Período</span>
            <span className="text-text-primary font-bold block">{periodText}</span>
          </div>
          <div>
            <span className="text-text-muted block font-semibold text-[10px] uppercase tracking-wider">Código Alocação</span>
            <span className="text-text-primary font-bold font-mono">{allocCode}</span>
          </div>
          <div>
            <span className="text-text-muted block font-semibold text-[10px] uppercase tracking-wider">Taxa Aprovada</span>
            <span className="text-text-primary font-bold">{rateText}</span>
          </div>
          <div className="col-span-2">
            <span className="text-text-muted block font-semibold text-[10px] uppercase tracking-wider">Status Financeiro</span>
            <span className="text-text-primary font-bold">{paymentStatus}</span>
          </div>
        </div>

        <div className="pt-4 flex flex-col gap-2">
          {job?.id ? (
            <button
              onClick={onOpenDetails}
              className="w-full bg-[#00BCD4] hover:bg-[#00BCD4]/95 text-white font-bold p-3 rounded-xl flex items-center justify-center gap-1.5 text-xs transition"
            >
              <span>Abrir detalhes do job</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="text-center text-text-muted text-xs italic py-2">
              Detalhes do Job indisponíveis (ID ausente)
            </div>
          )}
          <button
            onClick={onClose}
            className="w-full bg-bg-surface-elevated hover:bg-bg-hover text-text-secondary font-bold p-3 rounded-xl text-xs transition border border-border-subtle"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TIMELINE CORE CONTENT COMPONENT
// ============================================================
function TimelineAlocacoesContent({ db }: { db: DatabaseProps }) {
  const router = useRouter();
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);
  const [hoveredJob, setHoveredJob] = useState<{
    job: any;
    allocation: any;
    freelancer: any;
    targetRect: DOMRect | null;
  } | null>(null);
  
  const [activeMobileJob, setActiveMobileJob] = useState<{
    alloc: any;
    job: any;
    freelancer: any;
  } | null>(null);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentUser = db.currentUser;
  const isNucleoProfile = currentUser.profile === 'NÚCLEO';
  const myNucleoId = currentUser.nucleoId || (db.nucleos && db.nucleos[0]?.id) || '55d9d7c0-d3cb-4f1e-84ad-e77ff961805b';
  
  // Filter allocations based on profile
  const allocationsToDisplay = db.allocations.filter(alloc => {
    if (isNucleoProfile && alloc.nucleoId !== myNucleoId) {
      return false;
    }
    if (filterActiveOnly && alloc.status !== 'Ativo') {
      return false;
    }
    return true;
  });

  const allocationsWithDetails = useMemo(() => {
    return allocationsToDisplay.map(alloc => {
      const fl = db.freelancers.find(f => f.id === alloc.freelancerId);
      const job = db.jobs.find(j => j.id === alloc.jobId);
      const ncl = db.nucleos.find(n => n.id === alloc.nucleoId);
      return {
        ...alloc,
        freelancerName: fl?.name || '',
        freelancerRole: fl?.mainRole || '',
        jobName: job?.name || '',
        nucleoName: ncl?.name || '',
      };
    });
  }, [allocationsToDisplay, db]);

  const {
    data: sortedAllocations,
    sortKey,
    sortDirection,
    requestSort
  } = useSortableTable(allocationsWithDetails, 'freelancerName', 'asc');

  // Calculate schedule overlap for each freelancer
  const checkOverlap = (allocId: string, freelancerId: string, start: string, end: string) => {
    const overlaps = db.allocations.filter(other => 
      other.id !== allocId && 
      other.freelancerId === freelancerId &&
      other.status === 'Ativo' &&
      ((start <= other.endDate && end >= other.startDate))
    );
    return overlaps;
  };

  const handleJobClick = (alloc: any, job: any, fl: any) => {
    const jobId = job?.id;
    if (!jobId) {
      alert('Não foi possível abrir os detalhes deste job. ID da vaga inválido ou ausente.');
      return;
    }

    if (window.innerWidth < 768) {
      setActiveMobileJob({ alloc, job, freelancer: fl });
    } else {
      router.push(`/jobs/${jobId}`);
    }
  };

  const handleJobHover = (e: React.MouseEvent<HTMLDivElement> | null, alloc: any, job: any, fl: any) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    if (!e) {
      setHoveredJob(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    
    // 150ms delay to avoid accidental triggers
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredJob({
        job,
        allocation: alloc,
        freelancer: fl,
        targetRect: rect,
      });
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div id="timeline-component-container" className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Timeline Operacional de Alocações</h2>
          <p className="text-xs text-text-secondary">
            {isNucleoProfile 
              ? `Exibindo cronograma logístico de fornecedores do núcleo: ${db.nucleos.find(n => n.id === myNucleoId)?.name || 'Ativo'}.`
              : 'Gantt consolidado da agência. Verificação em tempo real de conformidade de agendas.'
            }
          </p>
        </div>

        {/* Filters bar */}
        <div className="flex gap-2 text-xs shrink-0 bg-bg-surface border border-border-subtle p-1.5 rounded-xl">
          <button
            onClick={() => setFilterActiveOnly(!filterActiveOnly)}
            className={`p-1.5 px-3 rounded-lg font-bold transition-all ${filterActiveOnly ? 'bg-action-cyan text-white' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Apenas Ativas
          </button>
        </div>
      </div>

      {/* Grid resource gantt board */}
      <div className="bg-bg-surface rounded-2xl border border-border-subtle overflow-hidden shadow-xs">
        {/* Header weeks */}
        <div className="bg-bg-surface p-4 border-b border-border-subtle grid grid-cols-1 md:grid-cols-12 gap-2 text-xs font-semibold text-text-secondary items-center">
          <div
            onClick={() => requestSort('freelancerName')}
            className="md:col-span-4 flex items-center gap-1.5 text-text-primary font-bold cursor-pointer hover:text-action-cyan transition-colors select-none"
          >
            <Layers className="w-4 h-4 text-text-secondary shrink-0" />
            <span>ALOCAÇÃO / FREELANCER</span>
            {sortKey === 'freelancerName' && sortDirection ? (
              sortDirection === 'asc' ? (
                <ChevronUp className="w-3.5 h-3.5 text-action-cyan shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-action-cyan shrink-0" />
              )
            ) : (
              <div className="w-3.5 h-3.5 opacity-20 hover:opacity-100 flex flex-col items-center justify-center shrink-0">
                <ChevronUp className="w-2.5 h-2.5" />
                <ChevronDown className="w-2.5 h-2.5 -mt-1.5" />
              </div>
            )}
          </div>
          <TimelineWeekHeader />
        </div>

        <div className="divide-y divide-border-subtle">
          {sortedAllocations.length === 0 ? (
            <div className="p-12 text-center text-text-secondary text-xs italic">
              Nenhuma alocação registrada no cronograma correspondente.
            </div>
          ) : (
            sortedAllocations.map((alloc) => {
              const fl = db.freelancers.find(f => f.id === alloc.freelancerId);
              const job = db.jobs.find(j => j.id === alloc.jobId);
              const ncl = db.nucleos.find(n => n.id === alloc.nucleoId);

              // Analyze conflict
              const overlaps = checkOverlap(alloc.id, alloc.freelancerId, alloc.startDate, alloc.endDate);
              const hasConflict = overlaps.length > 0 && alloc.status === 'Ativo';

              // Visual calculations for progress bar placement
              const getDayFromDate = (dateString: string) => {
                if (!dateString || typeof dateString !== 'string') return 1;
                const dayStr = dateString.split('-')[2];
                return dayStr ? parseInt(dayStr) : 1;
              };

              const startDay = Math.max(1, getDayFromDate(alloc.startDate));
              const endDay = Math.min(30, getDayFromDate(alloc.endDate));
              const leftPercent = Math.max(0, Math.min(100, Math.round(((startDay - 1) / 30) * 100)));
              const widthPercent = Math.max(10, Math.min(100 - leftPercent, Math.round(((endDay - startDay + 1) / 30) * 100)));

              const extendedJob = job ? { ...job, nucleoName: ncl?.name } : null;

              return (
                <TimelineAllocationRow
                  key={alloc.id}
                  alloc={alloc}
                  freelancer={fl}
                  job={extendedJob}
                  nucleo={ncl}
                  hasConflict={hasConflict}
                  overlaps={overlaps}
                  leftPercent={leftPercent}
                  widthPercent={widthPercent}
                  onJobClick={() => handleJobClick(alloc, job, fl)}
                  onJobHover={(e) => handleJobHover(e, alloc, job, fl)}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Desktop Hover Card Tooltip */}
      {hoveredJob && hoveredJob.targetRect && (
        <JobHoverCard
          job={hoveredJob.job}
          allocation={hoveredJob.allocation}
          freelancer={hoveredJob.freelancer}
          targetRect={hoveredJob.targetRect}
          paymentCodes={db.paymentCodes}
        />
      )}

      {/* Mobile Detail Modal Bottom Sheet */}
      {activeMobileJob && (
        <JobDetailPopover
          job={activeMobileJob.job}
          allocation={activeMobileJob.alloc}
          freelancer={activeMobileJob.freelancer}
          paymentCodes={db.paymentCodes}
          onClose={() => setActiveMobileJob(null)}
          onOpenDetails={() => {
            const jobId = activeMobileJob.job?.id;
            setActiveMobileJob(null);
            if (jobId) {
              router.push(`/jobs/${jobId}`);
            }
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// EXPORTING WRAPPED WITH ERROR BOUNDARY
// ============================================================
export default function TimelineAlocacoes({ db }: { db: DatabaseProps }) {
  return (
    <TimelineErrorBoundary>
      <TimelineAlocacoesContent db={db} />
    </TimelineErrorBoundary>
  );
}
