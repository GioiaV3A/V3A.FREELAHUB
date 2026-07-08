'use client';

import React, {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useDeferredValue,
} from 'react';
import { createPortal } from 'react-dom';
import { DatabaseProps } from '@/app/page';
import {
  Calendar,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  X,
  Search,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
  LayoutList,
  CalendarDays,
  Clock,
  Users,
  Building2,
  Tag,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ============================================================
// TYPES & INTERFACES
// ============================================================
type TimelineViewMode = 'timeline' | 'calendar';
type TimelineScale = 'year' | 'month' | 'week' | 'day';
type TimelineGroupBy = 'freelancer' | 'nucleo' | 'role' | 'client';
type TimelineZoom = 'compact' | 'normal' | 'wide';

interface BarPosition {
  leftPercent: number;
  widthPercent: number;
  isOutsideView: boolean;
}

interface ConflictInfo {
  hasConflict: boolean;
  conflictingIds: string[];
}

interface AllocationItemEnriched {
  id: string;
  allocationCode: string;
  jobId: string;
  freelancerId: string;
  nucleoId: string;
  startDate: string;
  endDate: string;
  approvedValue: number;
  status: string;
  paymentModel?: string;
  remunerationModel?: string;
  negotiatedTotal?: number;
  totalContractValue?: number;
  evaluationStatus?: string;
  paymentRequestStatus?: string;
  observations?: string;
  freelancerName: string;
  freelancerAvatar?: string;
  freelancerRole: string;
  freelancerSeniority: string;
  jobName: string;
  clientName: string;
  nucleoName: string;
  conflict: ConflictInfo;
  paymentSchedules: any[];
}

interface HoverState {
  allocation: AllocationItemEnriched;
  rect: DOMRect;
}

interface FilterState {
  activeOnly: boolean;
  nucleoId: string;
  role: string;
  status: string;
  clientName: string;
  conflictsOnly: boolean;
}

// ============================================================
// HELPERS & SEARCH NORMALIZATION
// ============================================================

/** Parse YYYY-MM-DD safely without UTC shift */
function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function diffDays(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.round(ms / 86400000);
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// ============================================================
// DATE HELPERS
// ============================================================
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return d;
}

function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6);
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31);
}

/** Normalize Search Term to clear accents and lowercase */
function normalizeSearch(value: string): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/** Returns the anchor-period range (used for labeling / arrow navigation) */
function getViewRange(scale: TimelineScale, anchor: Date): { start: Date; end: Date } {
  switch (scale) {
    case 'year':
      return { start: startOfYear(anchor), end: endOfYear(anchor) };
    case 'month':
      return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
    case 'week':
      return { start: startOfWeek(anchor), end: endOfWeek(anchor) };
    case 'day':
      return { start: new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()), end: new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()) };
  }
}

/**
 * Returns a WIDE range for the scrollable timeline area.
 * This lets the user scroll through time without clicking arrows.
 */
function getExtendedViewRange(scale: TimelineScale, anchor: Date): { start: Date; end: Date } {
  switch (scale) {
    case 'year': {
      const start = new Date(anchor.getFullYear() - 2, 0, 1);
      const end = new Date(anchor.getFullYear() + 2, 11, 31);
      return { start, end };
    }
    case 'month': {
      const start = new Date(anchor.getFullYear(), anchor.getMonth() - 12, 1);
      const end = endOfMonth(new Date(anchor.getFullYear(), anchor.getMonth() + 12, 1));
      return { start, end };
    }
    case 'week': {
      const anchorWeekStart = startOfWeek(anchor);
      const start = addDays(anchorWeekStart, -26 * 7);
      const end = addDays(anchorWeekStart, 26 * 7 + 6);
      return { start, end };
    }
    case 'day': {
      const start = addDays(anchor, -180);
      const end = addDays(anchor, 184);
      return { start, end };
    }
  }
}

function calcBarPosition(
  allocStart: string,
  allocEnd: string,
  viewStart: Date,
  viewEnd: Date
): BarPosition {
  const as = parseDate(allocStart);
  const ae = parseDate(allocEnd);
  const visibleDuration = diffDays(viewEnd, viewStart) + 1;

  const clampedStart = as < viewStart ? viewStart : as;
  const clampedEnd = ae > viewEnd ? viewEnd : ae;

  if (clampedStart > clampedEnd) {
    return { leftPercent: 0, widthPercent: 0, isOutsideView: true };
  }

  const startOffset = diffDays(clampedStart, viewStart);
  const visibleDays = diffDays(clampedEnd, clampedStart) + 1;

  const leftPercent = (startOffset / visibleDuration) * 100;
  const widthPercent = Math.max(0.3, (visibleDays / visibleDuration) * 100);

  return { leftPercent, widthPercent, isOutsideView: false };
}

function navigatePeriod(scale: TimelineScale, anchor: Date, dir: -1 | 1): Date {
  const d = new Date(anchor);
  switch (scale) {
    case 'year': d.setFullYear(d.getFullYear() + dir); break;
    case 'month': d.setMonth(d.getMonth() + dir); break;
    case 'week': d.setDate(d.getDate() + dir * 7); break;
    case 'day': d.setDate(d.getDate() + dir); break;
  }
  return d;
}

const ptBRDate = (date: Date, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('pt-BR', opts).format(date);

const ptBRNum = (n: number, opts: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat('pt-BR', opts).format(n);

const formatCurrency = (v: any) => {
  const n = Number(v);
  if (isNaN(n)) return '—';
  return ptBRNum(n, { style: 'currency', currency: 'BRL' });
};

const formatShortDate = (s: string) => {
  if (!s) return '—';
  const d = parseDate(s);
  return ptBRDate(d, { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatPeriod = (s: string, e: string) => {
  const sf = formatShortDate(s);
  const ef = formatShortDate(e);
  if (sf !== '—' && ef !== '—') return `${sf} a ${ef}`;
  return sf !== '—' ? `A partir de ${sf}` : ef !== '—' ? `Até ${ef}` : '—';
};

const calcDuration = (s: string, e: string): string => {
  const ds = parseDate(s);
  const de = parseDate(e);
  if (isNaN(ds.getTime()) || isNaN(de.getTime())) return '—';
  const days = diffDays(de, ds) + 1;
  return `${days} ${days === 1 ? 'dia' : 'dias'}`;
};

function getAllocationTitle(a: AllocationItemEnriched): string {
  const cleanValue = (val?: string) => {
    if (!val) return '';
    const trimmed = val.trim();
    if (trimmed === '—' || trimmed === '--' || trimmed === 'null' || trimmed === 'undefined') return '';
    return trimmed;
  };

  const jobNameClean = cleanValue(a.jobName);
  const clientNameClean = cleanValue(a.clientName);
  const codeClean = cleanValue(a.allocationCode);

  if (jobNameClean && clientNameClean) {
    return `${jobNameClean} — ${clientNameClean}`;
  }
  return jobNameClean || clientNameClean || codeClean || 'Alocação sem título';
}

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTH_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// ============================================================
// STATUS COLOR SYSTEM
// ============================================================
interface StatusColors {
  bg: string;
  border: string;
  text: string;
  hoverBg: string;
}

function getAllocationColors(status: string, hasConflict: boolean): StatusColors {
  if (hasConflict) {
    return {
      bg: 'bg-red-500/20 dark:bg-red-500/15',
      border: 'border-[var(--timeline-conflict-border)]',
      text: 'text-red-700 dark:text-red-300',
      hoverBg: 'hover:bg-red-500/30',
    };
  }
  const s = (status || '').toLowerCase();
  if (s.includes('bookad') || s === 'bookada' || s === 'bookado') {
    return {
      bg: 'bg-blue-500/20 dark:bg-blue-500/15',
      border: 'border-blue-500/50 dark:border-blue-400/40',
      text: 'text-blue-800 dark:text-blue-200',
      hoverBg: 'hover:bg-blue-500/30',
    };
  }
  if (s === 'ativo' || s === 'ativa' || s === 'em andamento' || s === 'em execução') {
    return {
      bg: 'bg-emerald-500/20 dark:bg-emerald-500/15',
      border: 'border-emerald-500/50 dark:border-emerald-400/40',
      text: 'text-emerald-800 dark:text-emerald-200',
      hoverBg: 'hover:bg-emerald-500/30',
    };
  }
  if (s.includes('aguardando início') || s.includes('aguardando inicio')) {
    return {
      bg: 'bg-sky-400/20 dark:bg-sky-400/15',
      border: 'border-sky-400/50 dark:border-sky-300/40',
      text: 'text-sky-800 dark:text-sky-200',
      hoverBg: 'hover:bg-sky-400/30',
    };
  }
  if (s.includes('aguardando entrega') || s.includes('entrega')) {
    return {
      bg: 'bg-amber-400/20 dark:bg-amber-400/15',
      border: 'border-amber-500/50 dark:border-amber-400/40',
      text: 'text-amber-800 dark:text-amber-200',
      hoverBg: 'hover:bg-amber-400/30',
    };
  }
  if (s.includes('pagamento') || s.includes('solicitad')) {
    return {
      bg: 'bg-violet-500/20 dark:bg-violet-500/15',
      border: 'border-violet-500/50 dark:border-violet-400/40',
      text: 'text-violet-800 dark:text-violet-200',
      hoverBg: 'hover:bg-violet-500/30',
    };
  }
  if (s === 'concluído' || s === 'concluida' || s === 'concluido') {
    return {
      bg: 'bg-slate-400/15 dark:bg-slate-400/10',
      border: 'border-slate-400/40 dark:border-slate-400/30',
      text: 'text-slate-700 dark:text-slate-300',
      hoverBg: 'hover:bg-slate-400/25',
    };
  }
  if (s === 'cancelado' || s === 'cancelada') {
    return {
      bg: 'bg-red-400/15 dark:bg-red-400/10',
      border: 'border-red-400/40',
      text: 'text-red-700 dark:text-red-300',
      hoverBg: 'hover:bg-red-400/25',
    };
  }
  return {
    bg: 'bg-[var(--accent-soft)]',
    border: 'border-[var(--accent)]/40',
    text: 'text-[var(--accent)] dark:text-[var(--accent)]',
    hoverBg: 'hover:bg-[var(--accent-soft)]',
  };
}

function getStatusDotColor(status: string): string {
  const s = (status || '').toLowerCase();
  if (s.includes('bookad')) return 'bg-blue-500';
  if (s === 'ativo' || s === 'ativa' || s === 'em andamento' || s === 'em execução') return 'bg-emerald-500';
  if (s.includes('aguardando início') || s.includes('aguardando inicio')) return 'bg-sky-400';
  if (s.includes('entrega')) return 'bg-amber-400';
  if (s.includes('pagamento') || s.includes('solicitad')) return 'bg-violet-500';
  if (s === 'concluído' || s === 'concluida' || s === 'concluido') return 'bg-slate-400';
  if (s === 'cancelado' || s === 'cancelada') return 'bg-red-400';
  return 'bg-[var(--accent)]';
}

function getPaymentDotColor(status: string): string {
  const s = (status || '').toLowerCase().trim();
  if (
    s === 'paid' ||
    s === 'pago' ||
    s === 'exportado' ||
    s === 'emitido' ||
    s === 'finance_code_received' ||
    s === 'sent_to_finance' ||
    s === 'payment_request_generated'
  ) {
    return 'bg-emerald-500 border-emerald-300';
  }
  if (s === 'pending' || s === 'pendente') {
    return 'bg-amber-400 border-amber-200';
  }
  if (s === 'cancelled' || s === 'cancelado' || s === 'cancelada') {
    return 'bg-slate-500 border-slate-300';
  }
  return 'bg-slate-400 border-slate-200';
}

// ============================================================
// INITIALS AVATAR
// ============================================================
function Initials({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500',
    'bg-amber-500', 'bg-cyan-500', 'bg-rose-500', 'bg-indigo-500',
  ];
  const colorIdx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold shrink-0 ${colors[colorIdx]}`}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
      aria-hidden="true"
    >
      {initials || '?'}
    </div>
  );
}

// ============================================================
// PAYMENT MODEL LABEL
// ============================================================
function paymentModelLabel(model?: string): string {
  switch (model) {
    case 'monthly_recurring': return 'Recorrente Mensal';
    case 'milestone': return 'Milestones';
    case 'one_time': return 'Pagamento Único';
    default: return 'Pagamento Único';
  }
}

function evalStatusLabel(status?: string): string {
  switch (status) {
    case 'locked': return 'Bloqueada (Aguardando Faturamento)';
    case 'available': return 'Liberada / Pendente';
    case 'pending': return 'Em andamento';
    case 'completed': return 'Concluída';
    default: return 'Não iniciada';
  }
}

function remunerationModelLabel(model?: string): string {
  if (!model) return '';
  const m = model.toLowerCase().trim();
  if (m === 'daily' || m === 'diária' || m === 'diaria') return 'Diária';
  if (m === 'hourly' || m === 'hora' || m === 'horária' || m === 'horaria') return 'Hora';
  if (m === 'fixed_job' || m === 'job fechado' || m === 'job_fechado') return 'Job Fechado';
  if (m === 'monthly_salary' || m === 'mensal / salário' || m === 'mensalidade' || m === 'mensal') return 'Mensal / Salário';
  return model;
}

function paymentStatusLabel(status?: string): string {
  switch (status) {
    case 'not_requested': return 'Não solicitado';
    case 'partially_requested': return 'Parcialmente solicitado';
    case 'requested': return 'Solicitado';
    case 'completed': return 'Concluído';
    case 'cancelled': return 'Cancelado';
    case 'paid': return 'Pago';
    case 'exported': return 'Exportado';
    default: return '';
  }
}

// ============================================================
// ZOOM COLUMN WIDTH
// ============================================================
function zoomDayPx(zoom: TimelineZoom, scale: TimelineScale): number {
  const base: Record<TimelineScale, Record<TimelineZoom, number>> = {
    year: { compact: 3, normal: 4.5, wide: 7 },
    month: { compact: 22, normal: 32, wide: 48 },
    week: { compact: 80, normal: 120, wide: 180 },
    day: { compact: 60, normal: 80, wide: 120 },
  };
  return base[scale][zoom];
}

// ============================================================
// ERROR BOUNDARY
// ============================================================
class TimelineErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, info: any) {
    console.error('Timeline render error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-bg)] text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-[var(--danger-text)] font-bold text-sm">
            <AlertTriangle className="w-5 h-5" />
            Erro ao renderizar a Timeline de Alocações
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] px-4 py-2 rounded-xl text-xs font-bold transition"
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
// HOVER CARD — via Portal to avoid overflow clipping
// ============================================================
interface HoverCardProps {
  allocation: AllocationItemEnriched;
  rect: DOMRect;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onEscape: () => void;
  onFocusAllocation: () => void;
  onOpenDetails: () => void;
}

function AllocationHoverCard({
  allocation,
  rect,
  onMouseEnter,
  onMouseLeave,
  onEscape,
  onFocusAllocation,
  onOpenDetails,
}: HoverCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let root = document.getElementById('timeline-hover-portal');
    if (!root) {
      root = document.createElement('div');
      root.id = 'timeline-hover-portal';
      root.setAttribute('data-timeline-portal', 'true');
      document.body.appendChild(root);
    }
    setPortalRoot(root);
  }, []);

  const getInitialPosition = useCallback((anchorRect: DOMRect) => {
    const CARD_WIDTH = 360;
    const CARD_HEIGHT = 320;
    const VIEWPORT_MARGIN = 16;

    let left = anchorRect.left;
    let top = anchorRect.bottom + 10;

    if (left + CARD_WIDTH > window.innerWidth - VIEWPORT_MARGIN) {
      left = window.innerWidth - CARD_WIDTH - VIEWPORT_MARGIN;
    }
    if (left < VIEWPORT_MARGIN) {
      left = VIEWPORT_MARGIN;
    }
    if (top + CARD_HEIGHT > window.innerHeight - VIEWPORT_MARGIN) {
      top = anchorRect.top - CARD_HEIGHT - 10;
    }
    if (top < VIEWPORT_MARGIN) {
      top = VIEWPORT_MARGIN;
    }
    return { top, left };
  }, []);

  const [position, setPosition] = useState<{ top: number; left: number } | null>(() => getInitialPosition(rect));

  useEffect(() => {
    const cardEl = cardRef.current;
    const w = cardEl ? cardEl.offsetWidth : 360;
    const h = cardEl ? cardEl.offsetHeight : 340;
    const VIEWPORT_MARGIN = 16;

    let left = rect.left;
    let top = rect.bottom + 10;

    if (left + w > window.innerWidth - VIEWPORT_MARGIN) {
      left = window.innerWidth - w - VIEWPORT_MARGIN;
    }
    if (left < VIEWPORT_MARGIN) {
      left = VIEWPORT_MARGIN;
    }
    if (top + h > window.innerHeight - VIEWPORT_MARGIN) {
      top = rect.top - h - 10;
    }
    if (top < VIEWPORT_MARGIN) {
      top = VIEWPORT_MARGIN;
    }

    setPosition({ top, left });
  }, [rect]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onEscape]);

  if (!allocation) return null;
  if (!portalRoot) return null;
  if (!position || !Number.isFinite(position.top) || !Number.isFinite(position.left)) return null;

  const totalValue = allocation.totalContractValue || allocation.negotiatedTotal ||
    (Array.isArray(allocation.paymentSchedules) ? allocation.paymentSchedules : []).reduce((s: number, p: any) => s + (p.amount || 0), 0) ||
    allocation.approvedValue;

  const nextSchedule = [...(Array.isArray(allocation.paymentSchedules) ? allocation.paymentSchedules : [])]
    .filter(s => s && s.status !== 'paid' && s.status !== 'cancelled')
    .sort((x, y) => (x.dueDate || x.referencePeriodEnd || '').localeCompare(y.dueDate || y.referencePeriodEnd || ''))[0];

  const cleanValue = (val?: string) => {
    if (!val) return '';
    const trimmed = val.trim();
    if (trimmed === '—' || trimmed === '--' || trimmed === 'null' || trimmed === 'undefined') return '';
    return trimmed;
  };

  const jobNameClean = cleanValue(allocation.jobName);
  const clientNameClean = cleanValue(allocation.clientName);
  const codeClean = cleanValue(allocation.allocationCode);

  const allocationTitle =
    jobNameClean ||
    clientNameClean ||
    codeClean ||
    'Alocação sem título';

  const isValidValue = (val: any): boolean => {
    if (val === undefined || val === null) return false;
    if (typeof val === 'string') {
      const trimmed = val.trim().toLowerCase();
      if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null' || trimmed === 'nan' || trimmed === 'invalid date' || trimmed === '—' || trimmed === '--') {
        return false;
      }
    }
    if (typeof val === 'number' && (isNaN(val) || !isFinite(val))) {
      return false;
    }
    return true;
  };

  return createPortal(
    <div
      ref={cardRef}
      id="timeline-allocation-tooltip"
      role="tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        opacity: 1,
        zIndex: 9999,
        transition: 'opacity 0.1s',
        pointerEvents: 'auto',
      }}
      className="w-76 max-w-[340px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-[var(--timeline-hover-shadow)] p-4 text-xs flex flex-col gap-2"
    >
      {/* Header */}
      <div className="pb-2 border-b border-[var(--border-subtle)] flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-extrabold text-[var(--text-primary)] text-sm leading-tight truncate">{allocationTitle}</h4>
          {clientNameClean && (
            <p className="text-[var(--text-secondary)] text-[11px] mt-0.5">Cliente: {clientNameClean}</p>
          )}
        </div>
        {codeClean && (
          <span className="shrink-0 font-mono text-[10px] font-bold text-[var(--accent)] bg-[var(--accent-soft)] border border-[var(--accent)]/20 px-1.5 py-0.5 rounded">
            {codeClean}
          </span>
        )}
      </div>

      {/* Body grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
        {[
          ['Freelancer', allocation.freelancerName],
          ['Núcleo', allocation.nucleoName],
          ['Função', allocation.freelancerRole],
          ['Senioridade', allocation.freelancerSeniority],
          ['Período', formatPeriod(allocation.startDate, allocation.endDate)],
          ['Duração', calcDuration(allocation.startDate, allocation.endDate)],
          ['Status da Alocação', allocation.status],
          ['Modelo de Pagamento', paymentModelLabel(allocation.paymentModel)],
          ['Modelo de Remuneração', remunerationModelLabel(allocation.remunerationModel)],
          ['Valor Contratado', formatCurrency(totalValue)],
          ['Avaliação', evalStatusLabel(allocation.evaluationStatus)],
          ['Status do Pagamento', paymentStatusLabel(allocation.paymentRequestStatus)],
        ].map(([label, value]) => {
          if (!isValidValue(value)) return null;
          const isWide = label === 'Período' || label === 'Duração';
          return (
            <div key={label} className={isWide ? 'col-span-2' : ''}>
              <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-0.5">{label}</span>
              <span className="font-semibold text-[var(--text-primary)]">{value}</span>
            </div>
          );
        })}
        {nextSchedule && isValidValue(nextSchedule.amount) && (
          <div className="col-span-2">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-0.5">Próxima Parcela</span>
            <span className="font-semibold text-[var(--accent)]">
              {formatCurrency(nextSchedule.amount)} · {formatShortDate(nextSchedule.dueDate || nextSchedule.referencePeriodEnd)}
            </span>
          </div>
        )}
      </div>

      {/* Conflict alert */}
      {allocation.conflict.hasConflict && (
        <div className="pt-2 border-t border-[var(--timeline-conflict-border)]/30 flex items-start gap-1.5 text-[var(--danger-text)]">
          <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
          <span className="text-[10px] font-semibold">
            Conflito de agenda · {allocation.conflict.conflictingIds.length} alocação(ões) sobrepost(as)
          </span>
        </div>
      )}

      {/* Interactive Actions in Tooltip */}
      <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] flex flex-col gap-1 w-full">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFocusAllocation();
          }}
          className="w-full text-left bg-[var(--accent-soft)] hover:bg-[var(--accent)] hover:text-white text-[var(--accent)] font-bold py-1.5 px-3 rounded-lg text-[10px] flex items-center justify-between transition cursor-pointer"
        >
          <span>Centralizar na Timeline</span>
          <ChevronRight className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails();
          }}
          className="w-full text-left bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] font-semibold py-1.5 px-3 rounded-lg text-[10px] border border-[var(--border-subtle)] flex items-center justify-between transition cursor-pointer"
        >
          <span>Ver detalhes da alocação</span>
          <LayoutList className="w-3 h-3" />
        </button>
      </div>
    </div>,
    portalRoot
  );
}

// ============================================================
// ALLOCATION DRAWER (click action)
// ============================================================
interface DrawerProps {
  allocation: AllocationItemEnriched;
  onClose: () => void;
  onOpenJob: () => void;
  canViewPaymentRequests: boolean;
}

function AllocationDrawer({ allocation: a, onClose, onOpenJob, canViewPaymentRequests }: DrawerProps) {
  const totalValue = a.totalContractValue || a.negotiatedTotal ||
    a.paymentSchedules.reduce((s: number, p: any) => s + (p.amount || 0), 0) ||
    a.approvedValue;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] shadow-2xl flex flex-col">
        {/* Drawer header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)] sticky top-0 bg-[var(--bg-surface)] z-10">
          <div>
            <h3 className="font-extrabold text-[var(--text-primary)] text-base">{a.jobName}</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{a.allocationCode}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conflict alert */}
        {a.conflict.hasConflict && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-[var(--danger-bg)] border border-[var(--danger-border)] flex gap-2 text-[var(--danger-text)] text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
            <span className="font-semibold">Conflito de agenda detectado — {a.conflict.conflictingIds.length} alocação(ões) sobrepost(as)</span>
          </div>
        )}

        {/* Resource info */}
        <div className="p-5 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3 mb-3">
            <Initials name={a.freelancerName} size={40} />
            <div>
              <p className="font-bold text-[var(--text-primary)] text-sm">{a.freelancerName}</p>
              <p className="text-xs text-[var(--text-secondary)]">{a.freelancerRole} · {a.freelancerSeniority}</p>
              <p className="text-xs text-[var(--text-muted)]">{a.nucleoName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${getStatusDotColor(a.status)}`} />
            <span className="text-xs font-semibold text-[var(--text-primary)]">{a.status}</span>
          </div>
        </div>

        {/* Details */}
        <div className="p-5 space-y-3">
          {[
            ['Cliente', a.clientName],
            ['Período', formatPeriod(a.startDate, a.endDate)],
            ['Duração', calcDuration(a.startDate, a.endDate)],
            ['Modelo de Pagamento', paymentModelLabel(a.paymentModel)],
            ['Valor Contratado', formatCurrency(totalValue)],
            ['Avaliação', evalStatusLabel(a.evaluationStatus)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-2">
              <span className="text-xs text-[var(--text-muted)] font-medium shrink-0">{label}</span>
              <span className="text-xs font-semibold text-[var(--text-primary)] text-right">{value || '—'}</span>
            </div>
          ))}
        </div>

        {/* Payment schedules */}
        {canViewPaymentRequests && a.paymentSchedules.length > 0 && (
          <div className="px-5 pb-5">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Parcelas</h4>
            <div className="space-y-1.5">
              {a.paymentSchedules.map((s: any, i: number) => (
                <div key={s.id || i} className="flex items-center justify-between text-xs bg-[var(--bg-panel)] rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full border ${getPaymentDotColor(s.status)}`} />
                    <span className="text-[var(--text-secondary)]">Parcela {s.installmentNumber}</span>
                  </div>
                  <span className="font-semibold text-[var(--text-primary)]">{formatCurrency(s.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-5 border-t border-[var(--border-subtle)] space-y-2 mt-auto">
          <button
            onClick={onOpenJob}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition"
          >
            Ver detalhes do Job <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="w-full bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] font-semibold py-2.5 px-4 rounded-xl text-xs border border-[var(--border-subtle)] transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TIMELINE BAR — sophisticated redesign, height 30px, border-radius 6px
// ============================================================
interface TimelineBarProps {
  allocation: AllocationItemEnriched;
  leftPercent: number;
  widthPercent: number;
  dayPx: number;
  onHover: (rect: DOMRect | null) => void;
  onClick: () => void;
  onDoubleClick?: () => void;
  hoveredAllocId?: string;
  selectedAllocationId?: string;
  scale: TimelineScale;
  topOffset: number;
}

function TimelineBar({
  allocation: a,
  leftPercent,
  widthPercent,
  dayPx,
  onHover,
  onClick,
  onDoubleClick,
  hoveredAllocId,
  selectedAllocationId,
  scale,
  topOffset,
}: TimelineBarProps) {
  const colors = getAllocationColors(a.status, a.conflict.hasConflict);

  const allocStart = parseDate(a.startDate);
  const allocEnd = parseDate(a.endDate);
  const totalRange = allocEnd.getTime() - allocStart.getTime();

  // Width in pixels based on zoom level and duration
  const duration = scale === 'day'
    ? (allocEnd.getTime() - allocStart.getTime()) / 3600000
    : diffDays(allocEnd, allocStart) + 1;
  const barWidth = duration * dayPx;

  const isSelected = selectedAllocationId === a.id;

  const renderBarContent = () => {
    // 1. Daily scale logic
    if (scale === 'day') {
      const timeStr = `${String(allocStart.getHours()).padStart(2, '0')}:${String(allocStart.getMinutes()).padStart(2, '0')}–${String(allocEnd.getHours()).padStart(2, '0')}:${String(allocEnd.getMinutes()).padStart(2, '0')}`;
      if (barWidth >= 180) {
        return <span className="truncate text-[10px] leading-tight font-medium">{timeStr} · {a.jobName}</span>;
      } else if (barWidth >= 90) {
        return <span className="truncate text-[10px] leading-tight font-medium">{timeStr}</span>;
      } else {
        return <span className="text-[9px] mx-auto select-none">●</span>;
      }
    }

    // 2. Weekly / Monthly / Yearly scales logic
    if (barWidth >= 220) {
      return (
        <div className="flex flex-col leading-tight w-full text-left">
          <span className="truncate font-extrabold text-[10px]">{a.allocationCode}</span>
          <span className="truncate font-medium opacity-85 text-[9px]">{a.freelancerName}</span>
        </div>
      );
    } else if (barWidth >= 110) {
      return (
        <span className="truncate text-[10px] font-extrabold leading-tight">
          {a.allocationCode} · {a.freelancerName}
        </span>
      );
    } else if (barWidth >= 60) {
      return <span className="truncate text-[10px] font-extrabold leading-tight">{a.allocationCode}</span>;
    } else {
      return <span className="text-[9px] mx-auto select-none">●</span>;
    }
  };

  const isHovered = hoveredAllocId === a.id;
  const hoverActiveClass = isHovered ? colors.hoverBg.replace('hover:', '') : '';

  return (
    <button
      type="button"
      aria-label={`Centralizar na alocação ${a.allocationCode}, freelancer ${a.freelancerName}, de ${formatShortDate(a.startDate)} até ${formatShortDate(a.endDate)}`}
      aria-describedby={hoveredAllocId === a.id ? 'timeline-allocation-tooltip' : undefined}
      data-selected={isSelected ? 'true' : 'false'}
      className={`absolute rounded-md flex flex-col justify-center text-[10px] font-semibold cursor-pointer border transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 overflow-hidden select-none w-full text-left
        ${colors.bg} ${colors.border} ${colors.text} ${colors.hoverBg} ${hoverActiveClass}
        ${isSelected ? 'outline-[var(--accent)] outline-2 outline-offset-2 z-10 shadow-lg' : ''}
        ${isHovered ? 'ring-2 ring-[var(--accent)] shadow-md z-20 scale-[1.01]' : ''}
      `}
      style={{
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
        minWidth: '4px',
        top: topOffset,
        height: '30px',
        minHeight: '30px',
      }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(); }}
      onMouseEnter={(e) => {
        onHover({
          left: e.clientX,
          top: e.clientY,
          bottom: e.clientY,
          right: e.clientX,
          width: 0,
          height: 0
        } as DOMRect);
      }}
      onMouseLeave={() => onHover(null)}
      onFocus={(e) => onHover(e.currentTarget.getBoundingClientRect())}
      onBlur={() => onHover(null)}
    >
      <div className="sticky left-2 right-2 w-max max-w-[calc(100%-8px)] flex items-center gap-1 overflow-hidden pointer-events-none">
        {a.conflict.hasConflict && (
          <AlertTriangle className="w-3 h-3 shrink-0 text-amber-500 mr-1 animate-pulse" aria-label="Conflito de agenda" />
        )}
        {renderBarContent()}
      </div>

      {/* Payment schedule dots */}
      {Array.isArray(a.paymentSchedules) && a.paymentSchedules.length > 0 && totalRange > 0 && barWidth > 40 && (
        <div className="absolute inset-0 pointer-events-none">
          {a.paymentSchedules.map((sched: any, idx: number) => {
            const dueDateStr = sched.dueDate || sched.referencePeriodEnd;
            if (!dueDateStr) return null;
            const schedDate = parseDate(dueDateStr);
            const dotOffset = (schedDate.getTime() - allocStart.getTime()) / totalRange;
            const dotPercent = Math.max(1, Math.min(99, dotOffset * 100));
            return (
              <div
                key={sched.id || idx}
                className={`absolute w-2 h-2 rounded-full border border-white/95 bottom-0.5 shadow-xs -translate-x-1/2 ${getPaymentDotColor(sched.status)}`}
                style={{ left: `${dotPercent}%` }}
                title={`Parcela ${sched.installmentNumber}: ${formatCurrency(sched.amount)}`}
              />
            );
          })}
        </div>
      )}
    </button>
  );
}

interface ResourceCellProps {
  allocations: AllocationItemEnriched[];
  isManuallyExpanded?: boolean;
  onToggleExpand?: () => void;
  height: number;
  onFocusAllocation: (a: AllocationItemEnriched) => void;
}

function ResourceCell({
  allocations,
  isManuallyExpanded,
  onToggleExpand,
  height,
  onFocusAllocation,
}: ResourceCellProps) {
  const [showPopover, setShowPopover] = useState(false);
  const a = allocations[0];

  const isCompact = !isManuallyExpanded;

  return (
    <div
      className="relative grid grid-cols-[30px_minmax(0,1fr)] gap-x-2.5 items-start p-2 w-full border-r border-[var(--border-subtle)]"
      style={{
        background: 'var(--timeline-resource-background)',
        height,
        minHeight: 64,
        boxSizing: 'border-box',
        overflow: 'visible', // Must be visible to prevent status badge clipping
      }}
    >
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        <Initials name={a.freelancerName} size={30} />
      </div>

      {/* Info container */}
      <div className="flex flex-col gap-0.5 min-w-0 text-left overflow-visible">
        {/* Name */}
        <span
          className="font-bold text-[var(--text-primary)] text-[13px] leading-tight truncate w-full"
          title={a.freelancerName}
        >
          {a.freelancerName}
        </span>

        {/* Role & Seniority */}
        <p
          className="text-[11px] text-[var(--text-secondary)] leading-tight truncate w-full"
          title={`${a.freelancerRole} · ${a.freelancerSeniority}`}
        >
          {a.freelancerRole} · {a.freelancerSeniority}
        </p>

        {/* Single Allocation Trigger / Code & Status */}
        {allocations.length === 1 && (
          <div className="flex items-center gap-2 min-w-0 min-height-[18px] overflow-visible mt-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFocusAllocation(a);
              }}
              className="inline-flex items-center w-fit p-0 border-0 bg-transparent text-[var(--accent)] hover:underline text-[10px] font-mono cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2 rounded"
              aria-label={`Localizar alocação ${a.allocationCode} na Timeline`}
            >
              {a.allocationCode}
            </button>
            <span className="inline-flex items-center flex-shrink-0 min-height-[18px] gap-1 text-[10px] text-[var(--text-muted)]">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDotColor(a.status)}`} />
              {a.status}
            </span>
          </div>
        )}

        {/* Multi Allocation triggers */}
        {allocations.length > 1 && (
          <>
            {isCompact ? (
              <div className="relative overflow-visible">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand?.();
                  }}
                  className="mt-0.5 px-2.5 py-0.5 text-[9px] font-extrabold bg-[var(--accent-soft)] hover:bg-[var(--accent)] hover:text-white text-[var(--accent)] rounded-full transition w-max cursor-pointer focus:outline-none"
                >
                  {allocations.length} alocações
                </button>
              </div>
            ) : (
              <div className="mt-1 flex flex-col gap-1 w-full overflow-hidden">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand?.();
                  }}
                  className="px-2 py-0.5 text-[9px] font-extrabold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-full transition w-max cursor-pointer focus:outline-none"
                >
                  Recolher alocações
                </button>
                <div className="mt-0.5 flex flex-col gap-0.5 w-full overflow-y-auto no-scrollbar" style={{ maxHeight: height - 56 }}>
                  {allocations.map(alloc => (
                    <div key={alloc.id} className="flex items-center gap-2 min-w-0 min-height-[18px] overflow-visible">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFocusAllocation(alloc);
                        }}
                        className="inline-flex items-center w-fit p-0 border-0 bg-transparent text-[var(--accent)] hover:underline text-[10px] font-mono cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2 rounded"
                        aria-label={`Localizar alocação ${alloc.allocationCode} na Timeline`}
                      >
                        {alloc.allocationCode}
                      </button>
                      <span className="inline-flex items-center flex-shrink-0 min-height-[18px] gap-1 text-[9px] text-[var(--text-muted)]">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDotColor(alloc.status)}`} />
                        {alloc.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// DATE HEADER — multilevel
// ============================================================
interface DateHeaderProps {
  scale: TimelineScale;
  viewStart: Date;
  viewEnd: Date;
  dayPx: number;
  today: Date;
}

function TimelineDateHeader({ scale, viewStart, viewEnd, dayPx, today }: DateHeaderProps) {
  const totalDays = diffDays(viewEnd, viewStart) + 1;

  if (scale === 'year') {
    const months: Array<{ label: string; days: number }> = [];
    let cur = new Date(viewStart);
    while (cur <= viewEnd) {
      const monthEnd = endOfMonth(cur);
      const end = monthEnd > viewEnd ? viewEnd : monthEnd;
      const days = diffDays(end, cur) + 1;
      months.push({ label: `${MONTH_SHORT[cur.getMonth()]} ${cur.getFullYear()}`, days });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    return (
      <div className="flex" style={{ background: 'var(--timeline-header-background)' }}>
        {months.map((m, i) => {
          const widthPx = m.days * dayPx;
          return (
            <div
              key={i}
              className="flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-[var(--text-secondary)] border-r border-[var(--timeline-month-divider)] border-b border-b-[var(--timeline-grid-line)] uppercase tracking-wider h-8"
              style={{ width: widthPx, minWidth: widthPx }}
            >
              {widthPx > 30 ? m.label : ''}
            </div>
          );
        })}
      </div>
    );
  }

  if (scale === 'month') {
    const days: Date[] = [];
    let cur = new Date(viewStart);
    while (cur <= viewEnd) { days.push(new Date(cur)); cur = addDays(cur, 1); }

    const monthGroups: Array<{ label: string; count: number }> = [];
    days.forEach(d => {
      const label = `${MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`;
      if (!monthGroups.length || monthGroups[monthGroups.length - 1].label !== label) {
        monthGroups.push({ label, count: 1 });
      } else {
        monthGroups[monthGroups.length - 1].count++;
      }
    });

    return (
      <div style={{ background: 'var(--timeline-header-background)' }}>
        <div className="flex border-b border-[var(--timeline-grid-line)]">
          {monthGroups.map((m, i) => (
            <div
              key={i}
              className="flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-[var(--text-secondary)] border-r border-[var(--timeline-month-divider)] h-7 uppercase tracking-wider"
              style={{ width: m.count * dayPx }}
            >
              {m.count * dayPx > 60 ? m.label : m.label.slice(0, 3)}
            </div>
          ))}
        </div>
        <div className="flex">
          {days.map((d, i) => {
            const isToday = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div
                key={i}
                className={`flex-shrink-0 flex flex-col items-center justify-center text-[9px] h-8 border-r border-[var(--timeline-grid-line)] font-semibold
                  ${isWeekend ? 'text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}
                  ${isToday ? 'bg-[var(--timeline-today-background)] text-[var(--accent)] font-extrabold' : ''}
                `}
                style={{ width: dayPx, minWidth: dayPx }}
              >
                {dayPx > 14 ? <span className="text-[8px] leading-none">{WEEKDAY_SHORT[d.getDay()]}</span> : null}
                {dayPx > 8 ? <span>{d.getDate()}</span> : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (scale === 'week') {
    const days: Date[] = [];
    let cur = new Date(viewStart);
    while (cur <= viewEnd) { days.push(new Date(cur)); cur = addDays(cur, 1); }

    const weekGroups: Array<{ label: string; count: number; weekStart: Date }> = [];
    days.forEach(d => {
      const ws = startOfWeek(d);
      const label = `${ptBRDate(ws, { day: '2-digit', month: 'short' })} – ${ptBRDate(endOfWeek(ws), { day: '2-digit', month: 'short', year: 'numeric' })}`;
      if (!weekGroups.length || weekGroups[weekGroups.length - 1].weekStart.getTime() !== ws.getTime()) {
        weekGroups.push({ label, count: 1, weekStart: ws });
      } else {
        weekGroups[weekGroups.length - 1].count++;
      }
    });

    return (
      <div style={{ background: 'var(--timeline-header-background)' }}>
        <div className="flex border-b border-[var(--timeline-grid-line)]">
          {weekGroups.map((wg, i) => (
            <div
              key={i}
              className="flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-[var(--text-secondary)] border-r border-[var(--timeline-month-divider)] h-7 uppercase tracking-wider px-1"
              style={{ width: wg.count * dayPx }}
            >
              {wg.count * dayPx > 80 ? wg.label : wg.count * dayPx > 40 ? ptBRDate(wg.weekStart, { day: '2-digit', month: 'short' }) : ''}
            </div>
          ))}
        </div>
        <div className="flex">
          {days.map((d, i) => {
            const isToday = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div
                key={i}
                className={`flex-shrink-0 flex flex-col items-center justify-center text-xs border-r border-[var(--timeline-grid-line)] h-12 font-semibold
                  ${isWeekend ? 'bg-[var(--timeline-weekend-background)] text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}
                  ${isToday ? 'bg-[var(--timeline-today-background)] text-[var(--accent)] font-extrabold' : ''}
                `}
                style={{ width: dayPx, minWidth: dayPx }}
              >
                <span className="text-[10px]">{WEEKDAY_SHORT[d.getDay()]}</span>
                <span className="text-sm font-bold">{d.getDate()}</span>
                <span className="text-[9px] text-[var(--text-muted)]">{MONTH_SHORT[d.getMonth()]}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Day — show hours with readable widths
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const hourPx = dayPx;
  return (
    <div style={{ background: 'var(--timeline-header-background)' }}>
      <div className="flex border-b border-[var(--timeline-grid-line)]">
        <div
          className="flex items-center justify-center text-[11px] font-bold text-[var(--text-secondary)] h-8 px-3 border-b border-[var(--timeline-grid-line)] w-full"
          style={{ width: 24 * hourPx }}
        >
          {ptBRDate(viewStart, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
      </div>
      <div className="flex">
        {hours.map(h => (
          <div
            key={h}
            className="flex-shrink-0 flex items-center justify-center text-[10px] font-semibold text-[var(--text-muted)] border-r border-[var(--timeline-grid-line)] h-8"
            style={{ width: hourPx, minWidth: hourPx }}
          >
            {`${String(h).padStart(2, '0')}h`}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// TIMELINE GRID BACKGROUND (gridlines + today marker)
// ============================================================
interface GridBackgroundProps {
  scale: TimelineScale;
  viewStart: Date;
  viewEnd: Date;
  dayPx: number;
  today: Date;
}

function GridBackground({ scale, viewStart, viewEnd, dayPx, today }: GridBackgroundProps) {
  const totalDays = diffDays(viewEnd, viewStart) + 1;
  const days: Date[] = [];
  let cur = new Date(viewStart);
  while (cur <= viewEnd) { days.push(new Date(cur)); cur = addDays(cur, 1); }

  const todayOffset = diffDays(today, viewStart);
  const todayVisible = todayOffset >= 0 && todayOffset <= totalDays;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Weekends highlight */}
      {days.map((d, i) => {
        if (d.getDay() !== 0 && d.getDay() !== 6) return null;
        return (
          <div
            key={i}
            className="absolute top-0 bottom-0"
            style={{
              left: `${(i / totalDays) * 100}%`,
              width: `${(1 / totalDays) * 100}%`,
              background: 'var(--timeline-weekend-background)',
            }}
          />
        );
      })}
      {/* Vertical gridlines */}
      {scale === 'year' ? null : days.map((d, i) => {
        const isMonthChange = d.getDate() === 1 && i > 0;
        return (
          <div
            key={`g${i}`}
            className="absolute top-0 bottom-0 w-px"
            style={{
              left: `${(i / totalDays) * 100}%`,
              background: isMonthChange ? 'var(--timeline-month-divider)' : 'var(--timeline-grid-line)',
            }}
          />
        );
      })}
      {/* Today highlight + now line */}
      {todayVisible && (
        <>
          <div
            className="absolute top-0 bottom-0"
            style={{
              left: `${(todayOffset / totalDays) * 100}%`,
              width: `${(1 / totalDays) * 100}%`,
              background: 'var(--timeline-today-background)',
            }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5"
            style={{ left: `${((todayOffset + 0.5) / totalDays) * 100}%`, background: 'var(--timeline-today-line)' }}
          />
        </>
      )}
    </div>
  );
}

// ============================================================
// ARRANGE ALLOCATIONS INTO NON-OVERLAPPING ROWS
// ============================================================
function computeRows(allocs: AllocationItemEnriched[]): AllocationItemEnriched[][] {
  const rows: AllocationItemEnriched[][] = [];
  const sorted = [...allocs].sort((a, b) => a.startDate.localeCompare(b.startDate));
  for (const alloc of sorted) {
    let placed = false;
    for (const row of rows) {
      const last = row[row.length - 1];
      if (last.endDate < alloc.startDate) {
        row.push(alloc);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push([alloc]);
  }
  return rows.length ? rows : [[]];
}

// ============================================================
// TIMELINE VIEW (Gantt) — compact heights and spacing
// ============================================================
interface TimelineViewProps {
  allocations: AllocationItemEnriched[];
  scale: TimelineScale;
  anchor: Date;
  zoom: TimelineZoom;
  today: Date;
  onHoverAllocation: (alloc: AllocationItemEnriched | null, rect: DOMRect | null) => void;
  onClickAllocation: (alloc: AllocationItemEnriched) => void;
  onDoubleClickAllocation?: (alloc: AllocationItemEnriched) => void;
  hoveredAllocId?: string;
  selectedAllocationId?: string;
  onScrollAnchorChange?: (newAnchor: Date) => void;
  onRegisterScrollFn?: (fn: (date: Date, options?: { alignment?: 'start' | 'center'; behavior?: 'smooth' }) => void) => void;
  onFocusAllocation: (a: AllocationItemEnriched) => void;
  expandedFreelancers?: Record<string, boolean>;
  onToggleExpandFreelancer?: (freelancerId: string) => void;
}

function TimelineView({
  allocations, scale, anchor, zoom, today,
  onHoverAllocation, onClickAllocation, onDoubleClickAllocation, hoveredAllocId, selectedAllocationId,
  onScrollAnchorChange, onRegisterScrollFn, onFocusAllocation,
  expandedFreelancers = {}, onToggleExpandFreelancer,
}: TimelineViewProps) {
  const dayPx = zoomDayPx(zoom, scale);

  const { start: extStart, end: extEnd } = useMemo(() => getExtendedViewRange(scale, anchor), [scale, anchor]);
  const totalDays = diffDays(extEnd, extStart) + 1;
  const totalWidth = scale === 'day' ? 24 * dayPx : totalDays * dayPx;

  // Group allocations by freelancer, stacking overlaps
  const groupedByFreelancer = useMemo(() => {
    const map = new Map<string, AllocationItemEnriched[]>();
    allocations.forEach(a => {
      const key = a.freelancerId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return Array.from(map.values());
  }, [allocations]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const resourceRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);

  /** Calculate the pixel offset for a given date within the extended range */
  const dateToScrollX = useCallback((date: Date): number => {
    if (scale === 'day') {
      return 0;
    }
    const offset = diffDays(date, extStart);
    return offset * dayPx;
  }, [scale, extStart, dayPx]);

  /** Scroll the timeline area to show a given date, centered or start-aligned */
  const scrollToDate = useCallback((date: Date, options?: { alignment?: 'start' | 'center'; behavior?: 'smooth' }) => {
    const container = scrollRef.current;
    if (!container) return;
    const x = dateToScrollX(date);
    const containerW = container.clientWidth;
    const alignment = options?.alignment ?? 'center';

    let targetScrollLeft = x;
    if (alignment === 'center') {
      targetScrollLeft = Math.max(0, x - containerW / 2 + dayPx / 2);
    } else {
      targetScrollLeft = Math.max(0, x - containerW * 0.08); // 8% offset padding
    }

    container.scrollTo({
      left: targetScrollLeft,
      behavior: options?.behavior ?? 'smooth',
    });
  }, [dateToScrollX, dayPx]);

  // Register scroll function with parent so it can be called imperatively
  useEffect(() => {
    if (onRegisterScrollFn) onRegisterScrollFn(scrollToDate);
  }, [onRegisterScrollFn, scrollToDate]);

  // On anchor/scale change: scroll to anchor date
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToDate(scale === 'week' ? startOfWeek(anchor) : scale === 'month' ? startOfMonth(anchor) : anchor);
    }, 50);
    return () => clearTimeout(timer);
  }, [anchor, scale, scrollToDate]);

  // Sync vertical scroll
  const syncScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const t = e.currentTarget.scrollTop;
    if (scrollRef.current) scrollRef.current.scrollTop = t;
    if (resourceRef.current) resourceRef.current.scrollTop = t;
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--timeline-background)]">
      {/* Header row */}
      <div className="flex border-b border-[var(--border-subtle)] shrink-0" style={{ background: 'var(--timeline-corner-background)' }}>
        {/* Corner */}
        <div
          className="shrink-0 flex items-center px-4 border-r border-[var(--border-subtle)] bg-[var(--timeline-corner-background)]"
          style={{ width: 280, zIndex: 50, position: 'sticky', left: 0 }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Recurso / Freelancer</span>
        </div>
        {/* Date header */}
        <div
          ref={headerScrollRef}
          className="overflow-x-hidden overflow-y-hidden no-scrollbar flex-1"
          id="tl-header-scroll"
        >
          <div style={{ width: totalWidth, minWidth: totalWidth }}>
            <TimelineDateHeader scale={scale} viewStart={extStart} viewEnd={extEnd} dayPx={dayPx} today={today} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Resource column */}
        <div
          ref={resourceRef}
          className="shrink-0 overflow-y-auto overflow-x-hidden no-scrollbar border-r border-[var(--border-subtle)] overflow-visible"
          style={{ width: 280, zIndex: 30, background: 'var(--timeline-resource-background)' }}
          onScroll={syncScroll}
        >
          {groupedByFreelancer.map((group, gi) => {
            const freelancerId = group[0]?.freelancerId;
            const isManuallyExpanded = !!expandedFreelancers[freelancerId];
            const rows = isManuallyExpanded
              ? group.map(alloc => [alloc])
              : computeRows(group);
            const rowCount = rows.length;
            // Height formula: 64px base + 32px for additional rows
            const totalHeight = 64 + Math.max(0, rowCount - 1) * 32;
            return (
              <div
                key={gi}
                style={{ height: totalHeight, borderBottom: '1px solid var(--border-subtle)' }}
              >
                <ResourceCell
                  allocations={group}
                  height={totalHeight}
                  onFocusAllocation={onFocusAllocation}
                  isManuallyExpanded={isManuallyExpanded}
                  onToggleExpand={() => onToggleExpandFreelancer?.(freelancerId)}
                />
              </div>
            );
          })}
        </div>

        {/* Timeline area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto"
          onScroll={(e) => {
            if (headerScrollRef.current) headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
            if (resourceRef.current) resourceRef.current.scrollTop = e.currentTarget.scrollTop;
          }}
        >
          <div style={{ width: totalWidth, minWidth: totalWidth }}>
            {groupedByFreelancer.map((group, gi) => {
              const freelancerId = group[0]?.freelancerId;
              const isManuallyExpanded = !!expandedFreelancers[freelancerId];
              const rows = isManuallyExpanded
                ? group.map(alloc => [alloc])
                : computeRows(group);
              const rowCount = rows.length;
              const totalHeight = 64 + Math.max(0, rowCount - 1) * 32;
              return (
                <div
                  key={gi}
                  className="relative border-b border-[var(--border-subtle)]"
                  style={{ height: totalHeight }}
                >
                  <GridBackground scale={scale} viewStart={extStart} viewEnd={extEnd} dayPx={dayPx} today={today} />
                  {rows.map((rowAllocs, rowIdx) =>
                    rowAllocs.map((a) => {
                      const pos = scale === 'day'
                        ? { leftPercent: 0, widthPercent: 100, isOutsideView: false }
                        : calcBarPosition(a.startDate, a.endDate, extStart, extEnd);
                      if (pos.isOutsideView) return null;
                      
                      // Symmetric lane centering calculations
                      const topOffset = rowIdx === 0 ? 17 : 65 + (rowIdx - 1) * 32;
                      return (
                        <TimelineBar
                          key={a.id}
                          allocation={a}
                          leftPercent={pos.leftPercent}
                          widthPercent={pos.widthPercent}
                          dayPx={dayPx}
                          onHover={(rect) => {
                            onHoverAllocation(rect ? a : null, rect);
                          }}
                          onClick={() => onClickAllocation(a)}
                          onDoubleClick={() => onDoubleClickAllocation?.(a)}
                          hoveredAllocId={hoveredAllocId}
                          selectedAllocationId={selectedAllocationId}
                          scale={scale}
                          topOffset={topOffset}
                        />
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CALENDAR MONTH VIEW — with multi-month continuous scroll
// ============================================================
interface CalendarMonthProps {
  anchor: Date;
  allocations: AllocationItemEnriched[];
  today: Date;
  onClickAllocation: (a: AllocationItemEnriched) => void;
  onHoverAllocation: (a: AllocationItemEnriched | null, rect: DOMRect | null) => void;
  hoveredAllocId?: string;
  selectedAllocationId?: string;
}

interface CalendarOverflowPopoverProps {
  day: Date;
  allocations: AllocationItemEnriched[];
  rect: DOMRect;
  onClose: () => void;
  onClickAllocation: (a: AllocationItemEnriched) => void;
  onHoverAllocation: (a: AllocationItemEnriched | null, rect: DOMRect | null) => void;
  hoveredAllocId?: string;
}

function CalendarOverflowPopover({
  day,
  allocations,
  rect,
  onClose,
  onClickAllocation,
  onHoverAllocation,
  hoveredAllocId,
}: CalendarOverflowPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let root = document.getElementById('timeline-hover-portal');
    if (!root) {
      root = document.createElement('div');
      root.id = 'timeline-hover-portal';
      root.setAttribute('data-timeline-portal', 'true');
      document.body.appendChild(root);
    }
    setPortalRoot(root);
  }, []);

  useLayoutEffect(() => {
    if (!rect) return;
    const POPOVER_WIDTH = 280;
    const margin = 12;

    let left = rect.left;
    let top = rect.bottom + 6;

    if (typeof window !== 'undefined') {
      if (left + POPOVER_WIDTH > window.innerWidth) {
        left = window.innerWidth - POPOVER_WIDTH - margin;
      }
      if (left < margin) {
        left = margin;
      }
      const POPOVER_ESTIMATED_HEIGHT = 220;
      if (top + POPOVER_ESTIMATED_HEIGHT > window.innerHeight) {
        top = rect.top - POPOVER_ESTIMATED_HEIGHT - 6;
      }
      if (top < margin) {
        top = margin;
      }
    }
    setPosition({ top, left });
  }, [rect]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!portalRoot) return null;

  const dateTitle = ptBRDate(day, { weekday: 'short', day: '2-digit', month: 'short' });
  const formattedTitle = dateTitle.charAt(0).toUpperCase() + dateTitle.slice(1);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9990] bg-transparent" onClick={onClose} />

      <div
        ref={popoverRef}
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          zIndex: 9991,
        }}
        className="w-72 max-w-[300px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-xl p-3 flex flex-col gap-2 transition-all animate-in fade-in zoom-in-95 duration-100"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
          <span className="font-bold text-xs text-[var(--text-primary)]">
            Alocações de {formattedTitle}
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
            aria-label="Fechar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
          {allocations.map(a => {
            const colors = getAllocationColors(a.status, a.conflict.hasConflict);
            return (
              <button
                key={a.id}
                onClick={() => {
                  onClickAllocation(a);
                  onClose();
                }}
                onMouseEnter={(e) => onHoverAllocation(a, e.currentTarget.getBoundingClientRect())}
                onMouseLeave={() => onHoverAllocation(null, null)}
                onFocus={(e) => onHoverAllocation(a, e.currentTarget.getBoundingClientRect())}
                onBlur={() => onHoverAllocation(null, null)}
                className={`w-full text-left text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border transition flex flex-col gap-0.5 ${colors.bg} ${colors.border} ${colors.text} ${colors.hoverBg}`}
                aria-describedby={hoveredAllocId === a.id ? 'timeline-allocation-tooltip' : undefined}
                title={`${getAllocationTitle(a)} · ${a.freelancerName}`}
              >
                <span className="font-bold truncate w-full text-left">{getAllocationTitle(a)}</span>
                <span className="opacity-75 truncate w-full text-left">{a.freelancerName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>,
    portalRoot
  );
}

function SingleMonthGrid({
  monthStart,
  allocations,
  today,
  isAnchorMonth,
  onClickAllocation,
  onHoverAllocation,
  hoveredAllocId,
  selectedAllocationId,
}: {
  monthStart: Date;
  allocations: AllocationItemEnriched[];
  today: Date;
  isAnchorMonth: boolean;
  onClickAllocation: (a: AllocationItemEnriched) => void;
  onHoverAllocation: (a: AllocationItemEnriched | null, rect: DOMRect | null) => void;
  hoveredAllocId?: string;
  selectedAllocationId?: string;
}) {
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);

  const [popoverState, setPopoverState] = useState<{ day: Date; rect: DOMRect; allocs: AllocationItemEnriched[] } | null>(null);

  const weeks: Date[][] = [];
  let cur = new Date(calStart);
  while (cur <= calEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cur));
      cur = addDays(cur, 1);
    }
    weeks.push(week);
  }

  const formatDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return (
    <div
      id={`cal-month-${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`}
      className={`rounded-2xl border overflow-hidden bg-[var(--bg-surface)] select-none mb-4 ${isAnchorMonth ? 'border-[var(--accent)]/60 shadow-[0_0_0_2px_var(--accent)]/20' : 'border-[var(--border-subtle)]'}`}
    >
      <div className={`px-4 py-2.5 border-b border-[var(--border-subtle)] flex items-center gap-2 ${isAnchorMonth ? 'bg-[var(--accent-soft)]' : 'bg-[var(--timeline-header-background)]'}`}>
        <span className={`font-extrabold text-sm capitalize ${isAnchorMonth ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
          {ptBRDate(monthStart, { month: 'long', year: 'numeric' })}
        </span>
        {isAnchorMonth && (
          <span className="text-[10px] font-bold text-[var(--accent)] bg-[var(--accent)]/15 px-2 py-0.5 rounded-full">
            Mês atual
          </span>
        )}
      </div>

      <div className="grid grid-cols-7 border-b border-[var(--border-subtle)] bg-[var(--timeline-header-background)]">
        {WEEKDAY_SHORT.map(d => (
          <div key={d} className="text-center py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {d}
          </div>
        ))}
      </div>

      {weeks.map((week, wi) => {
        const weekStart = week[0];
        const weekEnd = week[6];
        const weekStartStr = formatDateStr(weekStart);
        const weekEndStr = formatDateStr(weekEnd);

        const weekAllocs = allocations.filter(a => a.startDate <= weekEndStr && a.endDate >= weekStartStr);

        const segments = weekAllocs.map(a => {
          const segStartStr = a.startDate < weekStartStr ? weekStartStr : a.startDate;
          const segEndStr = a.endDate > weekEndStr ? weekEndStr : a.endDate;
          const colStart = diffDays(parseDate(segStartStr), weekStart);
          const colEnd = diffDays(parseDate(segEndStr), weekStart);
          const span = colEnd - colStart + 1;
          return {
            allocation: a,
            colStart,
            colEnd,
            span,
            startsThisWeek: a.startDate >= weekStartStr,
            endsThisWeek: a.endDate <= weekEndStr
          };
        });

        const sortedSegments = [...segments].sort((x, y) => {
          if (y.span !== x.span) return y.span - x.span;
          if (x.colStart !== y.colStart) return x.colStart - y.colStart;
          if (x.allocation.startDate !== y.allocation.startDate) {
            return x.allocation.startDate.localeCompare(y.allocation.startDate);
          }
          return x.allocation.id.localeCompare(y.allocation.id);
        });

        const row0: (any | null)[] = Array(7).fill(null);
        const row1: (any | null)[] = Array(7).fill(null);
        const placedSegments: { segment: any; row: number }[] = [];
        const unplacedSegments: any[] = [];

        for (const seg of sortedSegments) {
          let canPlace0 = true;
          for (let c = seg.colStart; c <= seg.colEnd; c++) {
            if (row0[c] !== null) { canPlace0 = false; break; }
          }
          if (canPlace0) {
            for (let c = seg.colStart; c <= seg.colEnd; c++) row0[c] = seg;
            placedSegments.push({ segment: seg, row: 0 });
            continue;
          }

          let canPlace1 = true;
          for (let c = seg.colStart; c <= seg.colEnd; c++) {
            if (row1[c] !== null) { canPlace1 = false; break; }
          }
          if (canPlace1) {
            for (let c = seg.colStart; c <= seg.colEnd; c++) row1[c] = seg;
            placedSegments.push({ segment: seg, row: 1 });
            continue;
          }

          unplacedSegments.push(seg);
        }

        const row2: (any | null)[] = Array(7).fill(null);
        const unplacedOnCol: any[][] = Array.from({ length: 7 }, () => []);
        for (const seg of unplacedSegments) {
          for (let c = seg.colStart; c <= seg.colEnd; c++) {
            unplacedOnCol[c].push(seg);
          }
        }

        for (const seg of unplacedSegments) {
          let canPlace2 = true;
          for (let c = seg.colStart; c <= seg.colEnd; c++) {
            if (row2[c] !== null || unplacedOnCol[c].length !== 1) {
              canPlace2 = false;
              break;
            }
          }
          if (canPlace2) {
            for (let c = seg.colStart; c <= seg.colEnd; c++) {
              row2[c] = seg;
              unplacedOnCol[c] = [];
            }
            placedSegments.push({ segment: seg, row: 2 });
          }
        }

        const overflowCountOnCol = unplacedOnCol.map(list => list.length);

        return (
          <div key={wi} className="relative border-b border-[var(--border-subtle)] last:border-b-0 min-h-[110px]">
            {/* Backdrop Grid */}
            <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
              {week.map((day, di) => {
                const isCurrentMonth = day.getMonth() === monthStart.getMonth();
                const isToday = day.toDateString() === today.toDateString();
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <div
                    key={di}
                    className={`border-r border-[var(--border-subtle)] last:border-r-0 h-full flex flex-col justify-between p-1.5
                      ${!isCurrentMonth ? 'opacity-40' : ''}
                      ${isWeekend ? 'bg-[var(--timeline-weekend-background)]' : ''}
                      ${isToday ? 'bg-[var(--timeline-today-background)]' : ''}
                    `}
                  >
                    <div className="flex justify-end">
                      <span className={`text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full
                        ${isToday ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'}`}>
                        {day.getDate()}
                      </span>
                    </div>
                    <div className="h-[75px]" />
                  </div>
                );
              })}
            </div>

            {/* Event Overlay */}
            <div className="relative pt-8 pb-1.5 px-1.5 grid grid-cols-7 grid-rows-3 gap-y-1 gap-x-1.5 h-full pointer-events-none">
              {placedSegments.map(({ segment, row }) => {
                const a = segment.allocation;
                const colors = getAllocationColors(a.status, a.conflict.hasConflict);
                const colStart = segment.colStart;
                const span = segment.span;
                const roundedClasses = `${segment.startsThisWeek ? 'rounded-l-md' : ''} ${segment.endsThisWeek ? 'rounded-r-md' : ''}`;
                const isSelected = selectedAllocationId === a.id;

                return (
                  <button
                    key={`${a.id}-${colStart}`}
                    style={{
                      gridColumn: `${colStart + 1} / span ${span}`,
                      gridRow: `${row + 1}`
                    }}
                    className={`pointer-events-auto text-left text-[9px] font-semibold px-2 py-0.5 border truncate transition-all duration-150 flex items-center gap-1 min-h-[22px] cursor-pointer
                      ${colors.bg} ${colors.border} ${colors.text} ${colors.hoverBg} ${roundedClasses}
                      ${isSelected ? 'outline-[var(--accent)] outline-2 outline-offset-1 z-10 shadow-md' : ''}
                      ${hoveredAllocId === a.id ? `${colors.hoverBg.replace('hover:', '')} ring-2 ring-[var(--accent)] shadow-md z-15 scale-[1.01]` : ''}
                    `}
                    onClick={() => onClickAllocation(a)}
                    onMouseEnter={(e) => {
                      onHoverAllocation(a, {
                        left: e.clientX,
                        top: e.clientY,
                        bottom: e.clientY,
                        right: e.clientX,
                        width: 0,
                        height: 0
                      } as DOMRect);
                    }}
                    onMouseLeave={() => onHoverAllocation(null, null)}
                    onFocus={(e) => onHoverAllocation(a, e.currentTarget.getBoundingClientRect())}
                    onBlur={() => onHoverAllocation(null, null)}
                    aria-describedby={hoveredAllocId === a.id ? 'timeline-allocation-tooltip' : undefined}
                    title={`${getAllocationTitle(a)} · ${a.freelancerName}`}
                  >
                    {!segment.startsThisWeek && <span className="text-[10px] leading-none select-none">←</span>}
                    <span className="truncate flex-1">{getAllocationTitle(a)}</span>
                    {!segment.endsThisWeek && <span className="text-[10px] leading-none select-none">→</span>}
                  </button>
                );
              })}

              {overflowCountOnCol.map((overflow, col) => {
                if (overflow <= 0) return null;
                const day = week[col];
                const dayAllocsList = allocations.filter(a => {
                  const ds = formatDateStr(day);
                  return a.startDate <= ds && a.endDate >= ds;
                });

                return (
                  <button
                    key={`overflow-${col}`}
                    style={{
                      gridColumn: `${col + 1}`,
                      gridRow: `3`
                    }}
                    onClick={(e) => {
                      setPopoverState({
                        day,
                        rect: e.currentTarget.getBoundingClientRect(),
                        allocs: dayAllocsList
                      });
                    }}
                    className="pointer-events-auto text-[9px] font-bold text-[var(--accent)] hover:underline hover:bg-[var(--accent-soft)]/20 px-1 py-0.5 rounded text-left truncate w-full transition min-h-[20px]"
                  >
                    +{overflow} alocaç{overflow === 1 ? 'ão' : 'ões'}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {popoverState && (
        <CalendarOverflowPopover
          day={popoverState.day}
          allocations={popoverState.allocs}
          rect={popoverState.rect}
          onClose={() => setPopoverState(null)}
          onClickAllocation={onClickAllocation}
          onHoverAllocation={onHoverAllocation}
          hoveredAllocId={hoveredAllocId}
        />
      )}
    </div>
  );
}

function CalendarMonth({
  anchor, allocations, today, onClickAllocation, onHoverAllocation, hoveredAllocId, selectedAllocationId
}: CalendarMonthProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const months = useMemo(() => {
    const result: Date[] = [];
    for (let i = -6; i <= 12; i++) {
      result.push(new Date(anchor.getFullYear(), anchor.getMonth() + i, 1));
    }
    return result;
  }, [anchor]);

  const anchorId = `cal-month-${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    const timer = setTimeout(() => {
      const el = document.getElementById(anchorId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => clearTimeout(timer);
  }, [anchorId]);

  return (
    <div ref={scrollContainerRef} className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
      {months.map((monthStart, i) => {
        const isAnchorMonth = monthStart.getFullYear() === anchor.getFullYear() && monthStart.getMonth() === anchor.getMonth();
        return (
          <SingleMonthGrid
            key={i}
            monthStart={monthStart}
            allocations={allocations}
            today={today}
            isAnchorMonth={isAnchorMonth}
            onClickAllocation={onClickAllocation}
            onHoverAllocation={onHoverAllocation}
            hoveredAllocId={hoveredAllocId}
            selectedAllocationId={selectedAllocationId}
          />
        );
      })}
    </div>
  );
}

// ============================================================
// CALENDAR WEEK VIEW — spanning bars + continuous horizontal scroll
// ============================================================
interface CalendarWeekProps {
  anchor: Date;
  allocations: AllocationItemEnriched[];
  today: Date;
  onClickAllocation: (a: AllocationItemEnriched) => void;
  onHoverAllocation: (a: AllocationItemEnriched | null, rect: DOMRect | null) => void;
  hoveredAllocId?: string;
  selectedAllocationId?: string;
}

function CalendarWeek({
  anchor, allocations, today, onClickAllocation, onHoverAllocation, hoveredAllocId, selectedAllocationId
}: CalendarWeekProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const weeks = useMemo(() => {
    const anchorWeekStart = startOfWeek(anchor);
    const result: Date[] = [];
    for (let i = -13; i <= 26; i++) {
      result.push(addDays(anchorWeekStart, i * 7));
    }
    return result;
  }, [anchor]);

  const WEEK_COL_MIN_PX = 140;
  const DAY_PX = WEEK_COL_MIN_PX;

  const anchorWeekStart = startOfWeek(anchor);

  useEffect(() => {
    const timer = setTimeout(() => {
      const el = document.getElementById(`cal-week-${anchorWeekStart.getFullYear()}-${anchorWeekStart.getMonth()}-${anchorWeekStart.getDate()}`);
      if (el && scrollRef.current) {
        const containerLeft = scrollRef.current.getBoundingClientRect().left;
        const elLeft = el.getBoundingClientRect().left;
        const currentScroll = scrollRef.current.scrollLeft;
        scrollRef.current.scrollLeft = currentScroll + elLeft - containerLeft;
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [anchor]);

  const formatDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-surface)]">
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-hidden"
        onScroll={(e) => {
          if (headerRef.current) headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }}
      >
        <div className="flex" style={{ minWidth: weeks.length * 7 * DAY_PX }}>
          {weeks.map((weekStart, wi) => {
            const weekEnd = addDays(weekStart, 6);
            const weekStartStr = formatDateStr(weekStart);
            const weekEndStr = formatDateStr(weekEnd);
            const isAnchorWeek = weekStart.getTime() === anchorWeekStart.getTime();

            const days: Date[] = [];
            for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));

            const weekAllocs = allocations.filter(a => a.startDate <= weekEndStr && a.endDate >= weekStartStr);

            const segments = weekAllocs.map(a => {
              const segStartStr = a.startDate < weekStartStr ? weekStartStr : a.startDate;
              const segEndStr = a.endDate > weekEndStr ? weekEndStr : a.endDate;
              const colStart = diffDays(parseDate(segStartStr), weekStart);
              const colEnd = diffDays(parseDate(segEndStr), weekStart);
              const span = colEnd - colStart + 1;
              return {
                allocation: a,
                colStart,
                colEnd,
                span,
                startsThisWeek: a.startDate >= weekStartStr,
                endsThisWeek: a.endDate <= weekEndStr,
              };
            });

            const sortedSegs = [...segments].sort((x, y) => y.span - x.span || x.colStart - y.colStart);

            const MAX_ROWS = 4;
            const rowSlots: (any | null)[][] = Array.from({ length: MAX_ROWS }, () => Array(7).fill(null));
            const placedSegs: { seg: any; row: number }[] = [];

            for (const seg of sortedSegs) {
              for (let r = 0; r < MAX_ROWS; r++) {
                let canPlace = true;
                for (let c = seg.colStart; c <= seg.colEnd; c++) {
                  if (rowSlots[r][c] !== null) { canPlace = false; break; }
                }
                if (canPlace) {
                  for (let c = seg.colStart; c <= seg.colEnd; c++) rowSlots[r][c] = seg;
                  placedSegs.push({ seg, row: r });
                  break;
                }
              }
            }

            return (
              <div
                key={wi}
                id={`cal-week-${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`}
                className={`flex-shrink-0 border-r border-[var(--border-subtle)] last:border-r-0 ${isAnchorWeek ? 'bg-[var(--accent-soft)]/10' : ''}`}
                style={{ width: 7 * DAY_PX }}
              >
                <div className={`border-b border-[var(--timeline-month-divider)] px-2 py-1 text-[10px] font-bold text-center uppercase tracking-wider ${isAnchorWeek ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--timeline-header-background)] text-[var(--text-muted)]'}`}>
                  {ptBRDate(weekStart, { day: '2-digit', month: 'short' })} – {ptBRDate(weekEnd, { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>

                <div className="grid grid-cols-7 border-b border-[var(--border-subtle)] bg-[var(--timeline-header-background)]">
                  {days.map((d, di) => {
                    const isToday = d.toDateString() === today.toDateString();
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div
                        key={di}
                        className={`py-2 text-center border-r border-[var(--border-subtle)] last:border-r-0 ${isWeekend ? 'text-[var(--text-muted)]' : ''}`}
                        style={{ width: DAY_PX, minWidth: DAY_PX }}
                      >
                        <p className="text-[10px] font-semibold">{WEEKDAY_SHORT[d.getDay()]}</p>
                        <p className={`text-sm font-bold ${isToday ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{d.getDate()}</p>
                        <p className="text-[9px] text-[var(--text-muted)]">{MONTH_SHORT[d.getMonth()]}</p>
                      </div>
                    );
                  })}
                </div>

                <div
                  className="relative min-h-[160px] grid grid-rows-4 gap-y-0.5 p-1"
                  style={{ gridTemplateColumns: `repeat(7, ${DAY_PX}px)` }}
                >
                  <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                    {days.map((d, di) => {
                      const isToday = d.toDateString() === today.toDateString();
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <div
                          key={di}
                          className={`border-r border-[var(--border-subtle)] last:border-r-0 h-full
                            ${isWeekend ? 'bg-[var(--timeline-weekend-background)]' : ''}
                            ${isToday ? 'bg-[var(--timeline-today-background)]' : ''}
                          `}
                        />
                      );
                    })}
                  </div>

                  {placedSegs.map(({ seg, row }) => {
                    const a = seg.allocation;
                    const colors = getAllocationColors(a.status, a.conflict.hasConflict);
                    const roundedClasses = `${seg.startsThisWeek ? 'rounded-l-md' : ''} ${seg.endsThisWeek ? 'rounded-r-md' : ''}`;
                    const isSelected = selectedAllocationId === a.id;
                    return (
                      <button
                        key={`${a.id}-w${wi}`}
                        style={{
                          gridColumn: `${seg.colStart + 1} / span ${seg.span}`,
                          gridRow: `${row + 1}`,
                        }}
                        className={`relative z-10 text-left text-[10px] font-semibold px-2 py-1 border transition-all duration-150 flex items-center gap-1 min-h-[28px] cursor-pointer
                          ${colors.bg} ${colors.border} ${colors.text} ${colors.hoverBg} ${roundedClasses}
                          ${isSelected ? 'outline-[var(--accent)] outline-2 outline-offset-1 z-10 shadow-md' : ''}
                          ${hoveredAllocId === a.id ? `${colors.hoverBg.replace('hover:', '')} ring-2 ring-[var(--accent)] shadow-md z-15 scale-[1.01]` : ''}
                        `}
                        onClick={() => onClickAllocation(a)}
                        onMouseEnter={(e) => {
                          onHoverAllocation(a, {
                            left: e.clientX,
                            top: e.clientY,
                            bottom: e.clientY,
                            right: e.clientX,
                            width: 0,
                            height: 0
                          } as DOMRect);
                        }}
                        onMouseLeave={() => onHoverAllocation(null, null)}
                        onFocus={(e) => onHoverAllocation(a, e.currentTarget.getBoundingClientRect())}
                        onBlur={() => onHoverAllocation(null, null)}
                        aria-describedby={hoveredAllocId === a.id ? 'timeline-allocation-tooltip' : undefined}
                        title={`${getAllocationTitle(a)} · ${a.freelancerName}`}
                      >
                        {!seg.startsThisWeek && <span className="text-[10px] leading-none select-none shrink-0">←</span>}
                        <span className="truncate flex-1">{getAllocationTitle(a)}</span>
                        {!seg.endsThisWeek && <span className="text-[10px] leading-none select-none shrink-0">→</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CALENDAR DAY VIEW
// ============================================================
interface CalendarDayProps {
  viewStart: Date;
  allocations: AllocationItemEnriched[];
  today: Date;
  onClickAllocation: (a: AllocationItemEnriched) => void;
  onHoverAllocation: (a: AllocationItemEnriched | null, rect: DOMRect | null) => void;
  hoveredAllocId?: string;
}

function CalendarDay({
  viewStart, allocations, today, onClickAllocation, onHoverAllocation, hoveredAllocId
}: CalendarDayProps) {
  const ds = `${viewStart.getFullYear()}-${String(viewStart.getMonth() + 1).padStart(2, '0')}-${String(viewStart.getDate()).padStart(2, '0')}`;
  const dayAllocs = allocations.filter(a => a.startDate <= ds && a.endDate >= ds);
  const isToday = viewStart.toDateString() === today.toDateString();

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-surface)]">
      <div className={`py-3 px-4 border-b border-[var(--border-subtle)] ${isToday ? 'bg-[var(--timeline-today-background)]' : 'bg-[var(--timeline-header-background)]'}`}>
        <h3 className="font-bold text-[var(--text-primary)] text-sm">
          {ptBRDate(viewStart, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </h3>
        {isToday && <p className="text-xs text-[var(--accent)] font-semibold mt-0.5">Hoje</p>}
      </div>
      <div className="p-4 space-y-2">
        {dayAllocs.length === 0 ? (
          <p className="text-center text-[var(--text-muted)] text-sm py-8">Nenhuma alocação neste dia.</p>
        ) : (
          dayAllocs.map(a => {
            const colors = getAllocationColors(a.status, a.conflict.hasConflict);
            return (
              <button
                key={a.id}
                className={`w-full text-left px-4 py-3 rounded-xl border flex items-start gap-3 ${colors.bg} ${colors.border} ${colors.text} ${colors.hoverBg} transition duration-150
                  ${hoveredAllocId === a.id ? `${colors.hoverBg.replace('hover:', '')} ring-2 ring-[var(--accent)] shadow-md z-15 scale-[1.01]` : ''}
                `}
                onClick={() => onClickAllocation(a)}
                onMouseEnter={(e) => {
                  onHoverAllocation(a, {
                    left: e.clientX,
                    top: e.clientY,
                    bottom: e.clientY,
                    right: e.clientX,
                    width: 0,
                    height: 0
                  } as DOMRect);
                }}
                onMouseLeave={() => onHoverAllocation(null, null)}
                onFocus={(e) => onHoverAllocation(a, e.currentTarget.getBoundingClientRect())}
                onBlur={() => onHoverAllocation(null, null)}
                aria-describedby={hoveredAllocId === a.id ? 'timeline-allocation-tooltip' : undefined}
              >
                <Initials name={a.freelancerName} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{getAllocationTitle(a)}</span>
                    {a.conflict.hasConflict && <AlertTriangle className="w-3.5 h-3.5" />}
                  </div>
                  <p className="text-xs mt-0.5 opacity-80">{a.freelancerName} · {a.freelancerRole}</p>
                  <p className="text-[10px] mt-0.5 opacity-60">Dia inteiro · {a.status}</p>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0 mt-1 opacity-60" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================
// CALENDAR VIEW — wrapper
// ============================================================
interface CalendarViewProps {
  scale: TimelineScale;
  anchor: Date;
  viewStart: Date;
  viewEnd: Date;
  allocations: AllocationItemEnriched[];
  today: Date;
  onClickAllocation: (a: AllocationItemEnriched) => void;
  onHoverAllocation: (a: AllocationItemEnriched | null, rect: DOMRect | null) => void;
  hoveredAllocId?: string;
  selectedAllocationId?: string;
}

function CalendarView({
  scale, anchor, viewStart, viewEnd, allocations, today, onClickAllocation, onHoverAllocation, hoveredAllocId, selectedAllocationId
}: CalendarViewProps) {
  if (scale === 'day') return (
    <CalendarDay viewStart={viewStart} allocations={allocations} today={today} onClickAllocation={onClickAllocation} onHoverAllocation={onHoverAllocation} hoveredAllocId={hoveredAllocId} />
  );
  if (scale === 'week') return (
    <CalendarWeek anchor={anchor} allocations={allocations} today={today} onClickAllocation={onClickAllocation} onHoverAllocation={onHoverAllocation} hoveredAllocId={hoveredAllocId} selectedAllocationId={selectedAllocationId} />
  );
  return (
    <CalendarMonth anchor={anchor} allocations={allocations} today={today} onClickAllocation={onClickAllocation} onHoverAllocation={onHoverAllocation} hoveredAllocId={hoveredAllocId} selectedAllocationId={selectedAllocationId} />
  );
}

// ============================================================
// MOBILE AGENDA VIEW
// ============================================================
interface MobileAgendaProps {
  allocations: AllocationItemEnriched[];
  today: Date;
  anchor: Date;
  onClickAllocation: (a: AllocationItemEnriched) => void;
}

function MobileAgendaView({ allocations, today, anchor, onClickAllocation }: MobileAgendaProps) {
  const ds = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}-${String(anchor.getDate()).padStart(2, '0')}`;
  const dayAllocs = allocations.filter(a => a.startDate <= ds && a.endDate >= ds);

  return (
    <div className="space-y-3">
      <div className="text-center py-2">
        <p className="text-xs font-bold uppercase text-[var(--text-muted)] tracking-wider">
          {ptBRDate(anchor, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
        {anchor.toDateString() === today.toDateString() && (
          <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-[var(--accent)] text-white">Hoje</span>
        )}
      </div>
      {dayAllocs.length === 0 ? (
        <div className="text-center text-sm text-[var(--text-muted)] py-8">Nenhuma alocação neste dia.</div>
      ) : (
        dayAllocs.map(a => {
          const colors = getAllocationColors(a.status, a.conflict.hasConflict);
          return (
            <div
              key={a.id}
              className={`rounded-2xl border p-4 space-y-2 ${colors.bg} ${colors.border}`}
            >
              <div className="flex items-center gap-3">
                <Initials name={a.freelancerName} size={36} />
                <div className="min-w-0">
                  <p className={`font-bold text-sm ${colors.text}`}>{a.freelancerName}</p>
                  <p className={`text-xs opacity-80 ${colors.text}`}>{a.freelancerRole}</p>
                </div>
                {a.conflict.hasConflict && <AlertTriangle className="w-4 h-4 shrink-0 text-[var(--danger-text)]" />}
              </div>
              <div className={`text-xs space-y-0.5 ${colors.text}`}>
                <p><span className="font-semibold">Job:</span> {a.jobName}</p>
                <p><span className="font-semibold">Período:</span> {formatPeriod(a.startDate, a.endDate)}</p>
                <p><span className="font-semibold">Status:</span> {a.status}</p>
              </div>
              <button
                onClick={() => onClickAllocation(a)}
                className="w-full text-xs font-bold py-2 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition flex items-center justify-center gap-1.5"
              >
                Ver detalhes <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

// ============================================================
// EMPTY STATE
// ============================================================
function EmptyState({ onClearFilters, onGoToday }: { onClearFilters: () => void; onGoToday: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] flex items-center justify-center">
        <CalendarDays className="w-8 h-8 text-[var(--text-muted)]" />
      </div>
      <div>
        <h3 className="font-bold text-[var(--text-primary)] text-sm">Nenhuma alocação encontrada</h3>
        <p className="text-xs text-[var(--text-muted)] mt-1 max-w-[280px]">
          Nenhuma alocação encontrada neste período. Ajuste os filtros ou navegue para outro período.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onClearFilters}
          className="text-xs font-bold px-4 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] transition"
        >
          Limpar filtros
        </button>
        <button
          onClick={onGoToday}
          className="text-xs font-bold px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition"
        >
          Ir para hoje
        </button>
      </div>
    </div>
  );
}

// ============================================================
// FILTER CHIPS
// ============================================================
function FilterChips({ filters, nucleos, onRemoveNucleo, onRemoveStatus, onRemoveConflicts, onRemoveActiveOnly }: {
  filters: FilterState;
  nucleos: { id: string; name: string }[];
  onRemoveNucleo: () => void;
  onRemoveStatus: () => void;
  onRemoveConflicts: () => void;
  onRemoveActiveOnly: () => void;
}) {
  const chips: Array<{ label: string; onRemove: () => void }> = [];
  if (filters.nucleoId) {
    const n = nucleos.find(n => n.id === filters.nucleoId);
    if (n) chips.push({ label: `Núcleo: ${n.name}`, onRemove: onRemoveNucleo });
  }
  if (filters.status) {
    const displayStatus = filters.status === 'Bookado' ? 'Reservado (Bookado)' : filters.status;
    chips.push({ label: `Status: ${displayStatus}`, onRemove: onRemoveStatus });
  }
  if (filters.conflictsOnly) chips.push({ label: 'Conflitos', onRemove: onRemoveConflicts });
  if (filters.activeOnly) chips.push({ label: 'Apenas ativas', onRemove: onRemoveActiveOnly });

  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1 text-[10px] font-bold bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/20 px-2 py-1 rounded-full">
          {c.label}
          <button onClick={c.onRemove} className="hover:opacity-60 transition" aria-label={`Remover filtro ${c.label}`}>
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

// ============================================================
// PERIOD LABEL
// ============================================================
function periodLabel(scale: TimelineScale, viewStart: Date, viewEnd: Date): string {
  switch (scale) {
    case 'year':
      return String(viewStart.getFullYear());
    case 'month':
      return ptBRDate(viewStart, { month: 'long', year: 'numeric' });
    case 'week': {
      const sf = ptBRDate(viewStart, { day: '2-digit', month: 'short' });
      const ef = ptBRDate(viewEnd, { day: '2-digit', month: 'short', year: 'numeric' });
      return `${sf} – ${ef}`;
    }
    case 'day':
      return ptBRDate(viewStart, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }
}

// ============================================================
// MAIN CONTENT COMPONENT
// ============================================================
function TimelineAlocacoesContent({ db }: { db: DatabaseProps }) {
  const router = useRouter();
  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  // === State ===
  const [viewMode, setViewMode] = useState<TimelineViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('freela_hub_timeline_view') as TimelineViewMode) || 'timeline';
    }
    return 'timeline';
  });
  const [scale, setScale] = useState<TimelineScale>('month');
  const [anchor, setAnchor] = useState<Date>(today);
  const [zoom, setZoom] = useState<TimelineZoom>('normal');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    activeOnly: false,
    nucleoId: '',
    role: '',
    status: '',
    clientName: '',
    conflictsOnly: false,
  });

  const [selectedAllocationId, setSelectedAllocationId] = useState<string | null>(null);
  const [searchResultIndex, setSearchResultIndex] = useState(0);

  const [expandedFreelancers, setExpandedFreelancers] = useState<Record<string, boolean>>({});

  const toggleExpandFreelancer = useCallback((freelancerId: string) => {
    setExpandedFreelancers(prev => ({
      ...prev,
      [freelancerId]: !prev[freelancerId]
    }));
  }, []);

  const [hoveredAlloc, setHoveredAlloc] = useState<HoverState | null>(null);
  const [clickedAlloc, setClickedAlloc] = useState<AllocationItemEnriched | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Stable scroll function ref
  const timelineScrollToDateRef = useRef<((date: Date, options?: { alignment?: 'start' | 'center'; behavior?: 'smooth' }) => void) | null>(null);

  // useDeferredValue to avoid input lag/loss of focus
  const deferredSearch = useDeferredValue(searchQuery);

  // Persist view mode
  useEffect(() => {
    localStorage.setItem('freela_hub_timeline_view', viewMode);
  }, [viewMode]);

  // Cleanup hover on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const cancelCloseHover = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleCloseHover = useCallback(() => {
    cancelCloseHover();
    closeTimerRef.current = setTimeout(() => {
      setHoveredAlloc(null);
    }, 150);
  }, [cancelCloseHover]);

  // === Permission scope ===
  const currentUser = db.currentUser;
  const isNucleoProfile = currentUser.profile === 'NÚCLEO';
  const myNucleoId = currentUser.nucleoId;
  const canViewPaymentRequests = ['MASTER', 'RH', 'C-LEVEL', 'OPERAÇÃO', 'OPERAÇÕES'].includes(currentUser.profile);

  // === View range (for the anchor/label only) ===
  const { start: viewStart, end: viewEnd } = useMemo(() => getViewRange(scale, anchor), [scale, anchor]);

  // === Build enriched allocations ===
  const allEnriched = useMemo<AllocationItemEnriched[]>(() => {
    return db.allocations
      .filter(alloc => {
        if (isNucleoProfile && alloc.nucleoId !== myNucleoId) return false;
        return true;
      })
      .map(alloc => {
        const fl = db.freelancers.find(f => f.id === alloc.freelancerId);
        const job = db.jobs.find(j => j.id === alloc.jobId);
        const ncl = db.nucleos.find(n => n.id === alloc.nucleoId);
        return {
          ...alloc,
          freelancerName: fl?.name || 'Freelancer',
          freelancerAvatar: undefined,
          freelancerRole: fl?.mainRole || job?.roleNeeded || '—',
          freelancerSeniority: fl?.seniority || job?.seniorityNeeded || '—',
          jobName: job?.name || '—',
          clientName: job?.client || '—',
          nucleoName: ncl?.name || '—',
          remunerationModel: job?.remunerationModel || '—',
          conflict: { hasConflict: false, conflictingIds: [] },
          paymentSchedules: db.paymentSchedules?.filter(s => s.allocationId === alloc.id) || [],
        } as AllocationItemEnriched;
      });
  }, [db.allocations, db.freelancers, db.jobs, db.nucleos, db.paymentSchedules, isNucleoProfile, myNucleoId]);

  // === Compute conflicts ===
  const withConflicts = useMemo<AllocationItemEnriched[]>(() => {
    const conflictMap = new Map<string, string[]>();
    for (let i = 0; i < allEnriched.length; i++) {
      const a = allEnriched[i];
      if (!a.startDate || !a.endDate) continue;
      for (let j = i + 1; j < allEnriched.length; j++) {
        const b = allEnriched[j];
        if (a.freelancerId !== b.freelancerId) continue;
        if (!b.startDate || !b.endDate) continue;
        if (a.startDate <= b.endDate && a.endDate >= b.startDate) {
          conflictMap.set(a.id, [...(conflictMap.get(a.id) || []), b.id]);
          conflictMap.set(b.id, [...(conflictMap.get(b.id) || []), a.id]);
        }
      }
    }
    return allEnriched.map(a => ({
      ...a,
      conflict: {
        hasConflict: (conflictMap.get(a.id)?.length || 0) > 0,
        conflictingIds: conflictMap.get(a.id) || [],
      },
    }));
  }, [allEnriched]);

  // === Apply filters + search (deferredSearch) ===
  const filtered = useMemo<AllocationItemEnriched[]>(() => {
    let result = withConflicts;
    if (filters.activeOnly) result = result.filter(a => a.status === 'Ativo' || a.status === 'Ativa' || a.status === 'Em andamento' || a.status === 'Bookado' || a.status === 'Bookada');
    if (filters.nucleoId) result = result.filter(a => a.nucleoId === filters.nucleoId);
    if (filters.status) {
      result = result.filter(a => {
        const s = (a.status || '').toLowerCase();
        const fStatus = filters.status.toLowerCase();
        if (fStatus === 'bookado') {
          return s === 'bookado' || s === 'bookada' || s.includes('bookad');
        }
        if (fStatus === 'ativo') {
          return s === 'ativo' || s === 'ativa';
        }
        return s === fStatus;
      });
    }
    if (filters.conflictsOnly) result = result.filter(a => a.conflict.hasConflict);

    const query = normalizeSearch(deferredSearch);
    if (query) {
      result = result.filter(a => {
        const searchableContent = [
          a.allocationCode,
          a.freelancerName,
          a.jobName,
          a.clientName,
          a.nucleoName,
          a.freelancerRole,
          a.freelancerSeniority,
          a.status,
        ]
          .filter(Boolean)
          .join(' ');
        return normalizeSearch(searchableContent).includes(query);
      });
    }
    return result;
  }, [withConflicts, filters, deferredSearch]);

  const conflictCount = useMemo(() => withConflicts.filter(a => a.conflict.hasConflict).length, [withConflicts]);

  // Find result closest to current anchor date
  const closestIndex = useMemo(() => {
    if (filtered.length === 0) return 0;
    let minDiff = Infinity;
    let index = 0;
    filtered.forEach((alloc, i) => {
      const start = parseDate(alloc.startDate);
      const diff = Math.abs(start.getTime() - anchor.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        index = i;
      }
    });
    return index;
  }, [filtered, anchor]);

  // Helper to wait for Timeline component updates in DOM
  const waitForTimelineRender = useCallback(async () => {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  }, []);

  const ensureDateIsLoaded = useCallback(async (dateStr: string) => {
    if (!dateStr) return;
    const targetDate = parseDate(dateStr);
    const { start, end } = getExtendedViewRange(scale, anchor);
    if (targetDate < start || targetDate > end) {
      setAnchor(targetDate);
    }
  }, [scale, anchor]);

  const focusAllocation = useCallback(async (allocation: AllocationItemEnriched) => {
    setSelectedAllocationId(allocation.id);
    await ensureDateIsLoaded(allocation.startDate);
    await waitForTimelineRender();

    if (viewMode === 'timeline') {
      timelineScrollToDateRef.current?.(parseDate(allocation.startDate), { alignment: 'start', behavior: 'smooth' });
    } else if (viewMode === 'calendar') {
      const d = parseDate(allocation.startDate);
      const monthElId = `cal-month-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const el = document.getElementById(monthElId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [viewMode, scale, anchor, ensureDateIsLoaded, waitForTimelineRender]);

  // Hook index changes to auto scroll/focus result
  useEffect(() => {
    if (deferredSearch && filtered[searchResultIndex]) {
      focusAllocation(filtered[searchResultIndex]);
    }
  }, [searchResultIndex, deferredSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset index when search changes
  useEffect(() => {
    setSearchResultIndex(closestIndex);
  }, [filtered, closestIndex]);

  // === Handlers ===
  const handleHoverAllocation = useCallback((alloc: AllocationItemEnriched | null, rect: DOMRect | null) => {
    cancelCloseHover();
    if (!alloc || !rect) {
      scheduleCloseHover();
      return;
    }
    setHoveredAlloc({ allocation: alloc, rect });
  }, [cancelCloseHover, scheduleCloseHover]);

  const handleClickAllocation = useCallback((alloc: AllocationItemEnriched) => {
    cancelCloseHover();
    setHoveredAlloc(null);
    focusAllocation(alloc);
  }, [cancelCloseHover, focusAllocation]);

  const handleDoubleClickAllocation = useCallback((alloc: AllocationItemEnriched) => {
    cancelCloseHover();
    setHoveredAlloc(null);
    setClickedAlloc(alloc);
  }, [cancelCloseHover]);

  const handleOpenJob = useCallback(() => {
    if (!clickedAlloc) return;
    const jobId = clickedAlloc.jobId;
    router.push(`/jobs/${jobId}?origin=timeline&allocationId=${clickedAlloc.id}`);
    setClickedAlloc(null);
  }, [clickedAlloc, router]);

  // Auto focus allocation if highlightAllocationId is in query parameters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const highlightId = params.get('highlightAllocationId') || params.get('allocationId');
      if (highlightId) {
        const found = allEnriched.find(
          a => a.id === highlightId || a.allocationCode === highlightId
        );
        if (found) {
          // Clear query params so we don't refocus repeatedly
          const url = new URL(window.location.href);
          url.searchParams.delete('highlightAllocationId');
          url.searchParams.delete('allocationId');
          window.history.replaceState({}, '', url.toString());

          // Delay slightly to ensure timeline is fully mounted
          setTimeout(() => {
            focusAllocation(found);
          }, 200);
        }
      }
    }
  }, [allEnriched, focusAllocation]);

  const goToday = () => {
    setAnchor(today);
    setTimeout(() => {
      timelineScrollToDateRef.current?.(today, { alignment: 'center', behavior: 'smooth' });
    }, 60);
  };

  const clearFilters = () => setFilters({ activeOnly: false, nucleoId: '', role: '', status: '', clientName: '', conflictsOnly: false });

  const handleNav = (dir: -1 | 1) => {
    setAnchor(prev => navigatePeriod(scale, prev, dir));
  };

  const handlePrevSearchResult = () => {
    setSearchResultIndex(prev => (prev - 1 + filtered.length) % filtered.length);
  };
  const handleNextSearchResult = () => {
    setSearchResultIndex(prev => (prev + 1) % filtered.length);
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div id="timeline-module" className="space-y-4">

      {/* ─── MODULE TITLE ─── */}
      <div>
        <h2 className="text-xl font-extrabold text-[var(--text-primary)]">Timeline Operacional de Alocações</h2>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          {isNucleoProfile
            ? `Planejamento do núcleo ${db.nucleos.find(n => n.id === myNucleoId)?.name || '—'} — freelancers, jobs e conflitos de agenda.`
            : 'Planejamento de freelancers, jobs, períodos e conflitos de agenda.'}
        </p>
      </div>

      {/* ─── TOOLBAR ─── */}
      <div className="flex flex-col gap-3">
        {/* Row 1: View mode + Scale */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeline / Calendário toggle */}
          <div className="flex bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-xl p-1 gap-1">
            {([
              { mode: 'timeline' as const, label: 'Timeline', Icon: LayoutList },
              { mode: 'calendar' as const, label: 'Calendário', Icon: CalendarDays },
            ] as const).map(({ mode, label, Icon }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === mode ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                aria-pressed={viewMode === mode}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          {/* Scale */}
          <div className="flex bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-xl p-1 gap-1">
            {(['year', 'month', 'week', 'day'] as const).map(s => (
              <button
                key={s}
                onClick={() => setScale(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${scale === s ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                aria-pressed={scale === s}
              >
                {s === 'year' ? 'Ano' : s === 'month' ? 'Mês' : s === 'week' ? 'Semana' : 'Dia'}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-xl p-1">
            <button
              onClick={() => handleNav(-1)}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
              aria-label="Período anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToday}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition"
            >
              Hoje
            </button>
            <button
              onClick={() => handleNav(1)}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
              aria-label="Próximo período"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Period label */}
          <span className="text-sm font-bold text-[var(--text-primary)] capitalize">
            {periodLabel(scale, viewStart, viewEnd)}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Zoom (Timeline only) */}
          {viewMode === 'timeline' && (
            <div className="flex items-center gap-1 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-xl p-1">
              <button
                onClick={() => setZoom(z => z === 'wide' ? 'normal' : z === 'normal' ? 'compact' : 'compact')}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition" aria-label="Compactar"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-bold text-[var(--text-muted)] px-1">
                {zoom === 'compact' ? 'Compacto' : zoom === 'normal' ? 'Normal' : 'Amplo'}
              </span>
              <button
                onClick={() => setZoom(z => z === 'compact' ? 'normal' : z === 'normal' ? 'wide' : 'wide')}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition" aria-label="Ampliar"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Row 2: Search + Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar freelancer, job, cliente ou código..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSelectedAllocationId(null); searchRef.current?.focus(); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Result Navigator */}
          {deferredSearch && filtered.length > 0 && (
            <div className="flex items-center gap-3 px-3 py-2 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-xl text-xs">
              <span className="font-bold text-[var(--text-primary)]">
                {filtered.length} {filtered.length === 1 ? 'alocação encontrada' : 'alocações encontradas'}
              </span>
              <div className="flex items-center gap-1 border-l border-[var(--border-subtle)] pl-3">
                <button
                  type="button"
                  onClick={handlePrevSearchResult}
                  className="p-1 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
                  title="Resultado anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="font-semibold px-1 text-[var(--text-secondary)]">
                  {searchResultIndex + 1} de {filtered.length}
                </span>
                <button
                  type="button"
                  onClick={handleNextSearchResult}
                  className="p-1 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
                  title="Próximo resultado"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Filters button */}
          <button
            onClick={() => setShowFilters(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition ${showFilters ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-[var(--bg-panel)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'}`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filtros
          </button>

          {/* Apenas ativas */}
          <button
            onClick={() => setFilters(f => ({ ...f, activeOnly: !f.activeOnly }))}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${filters.activeOnly ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-[var(--bg-panel)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'}`}
          >
            Apenas ativas
          </button>

          {/* Conflict KPI */}
          {conflictCount > 0 && (
            <button
              onClick={() => setFilters(f => ({ ...f, conflictsOnly: !f.conflictsOnly }))}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition ${filters.conflictsOnly ? 'bg-[var(--danger-bg)] text-[var(--danger-text)] border-[var(--danger-border)]' : 'bg-[var(--danger-bg)]/50 text-[var(--danger-text)] border-[var(--danger-border)]/40 hover:bg-[var(--danger-bg)]'}`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {conflictCount} conflito{conflictCount !== 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 p-3 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-xl text-xs">
            {/* Núcleo */}
            {!isNucleoProfile && (
              <div className="flex flex-col gap-1 min-w-[160px]">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Núcleo</label>
                <select
                  value={filters.nucleoId}
                  onChange={e => setFilters(f => ({ ...f, nucleoId: e.target.value }))}
                  className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition"
                >
                  <option value="">Todos os núcleos</option>
                  {db.nucleos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
            )}
            {/* Status */}
            <div className="flex flex-col gap-1 min-w-[160px]">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Status</label>
              <select
                value={filters.status}
                onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition"
              >
                <option value="">Todos os status</option>
                {['Bookado', 'Ativo', 'Em andamento', 'Concluído', 'Cancelado', 'Aguardando entrega'].map(s => {
                  let display = s;
                  if (s === 'Bookado') display = 'Reservado (Bookado)';
                  return (
                    <option key={s} value={s}>{display}</option>
                  );
                })}
              </select>
            </div>
            {/* Conflict toggle */}
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.conflictsOnly}
                  onChange={e => setFilters(f => ({ ...f, conflictsOnly: e.target.checked }))}
                  className="accent-[var(--accent)] w-3.5 h-3.5"
                />
                <span className="text-xs text-[var(--text-primary)] font-semibold">Apenas conflitos</span>
              </label>
            </div>
            {/* Clear */}
            <div className="flex items-end ml-auto">
              <button
                onClick={clearFilters}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] font-semibold underline-offset-2 hover:underline transition"
              >
                Limpar tudo
              </button>
            </div>
          </div>
        )}

        {/* Active filter chips */}
        <FilterChips
          filters={filters}
          nucleos={db.nucleos}
          onRemoveNucleo={() => setFilters(f => ({ ...f, nucleoId: '' }))}
          onRemoveStatus={() => setFilters(f => ({ ...f, status: '' }))}
          onRemoveConflicts={() => setFilters(f => ({ ...f, conflictsOnly: false }))}
          onRemoveActiveOnly={() => setFilters(f => ({ ...f, activeOnly: false }))}
        />
      </div>

      {/* ─── MAIN CONTENT ─── */}
      {filtered.length === 0 ? (
        <EmptyState onClearFilters={clearFilters} onGoToday={goToday} />
      ) : (
        <>
          {/* Desktop: show Timeline or Calendar */}
          <div className="hidden md:block">
            {viewMode === 'timeline' ? (
              <div style={{ height: 'calc(100vh - 320px)', minHeight: 400 }}>
                <TimelineView
                  allocations={filtered}
                  scale={scale}
                  anchor={anchor}
                  zoom={zoom}
                  today={today}
                  onHoverAllocation={handleHoverAllocation}
                  onClickAllocation={handleClickAllocation}
                  onDoubleClickAllocation={handleDoubleClickAllocation}
                  hoveredAllocId={hoveredAlloc?.allocation.id}
                  selectedAllocationId={selectedAllocationId || undefined}
                  onRegisterScrollFn={(fn) => { timelineScrollToDateRef.current = fn; }}
                  onFocusAllocation={focusAllocation}
                  expandedFreelancers={expandedFreelancers}
                  onToggleExpandFreelancer={toggleExpandFreelancer}
                />
              </div>
            ) : (
              <CalendarView
                scale={scale}
                anchor={anchor}
                viewStart={viewStart}
                viewEnd={viewEnd}
                allocations={filtered}
                today={today}
                onClickAllocation={handleClickAllocation}
                onHoverAllocation={handleHoverAllocation}
                hoveredAllocId={hoveredAlloc?.allocation.id}
                selectedAllocationId={selectedAllocationId || undefined}
              />
            )}
          </div>

          {/* Mobile: Agenda view */}
          <div className="md:hidden">
            <MobileAgendaView
              allocations={filtered}
              today={today}
              anchor={anchor}
              onClickAllocation={handleClickAllocation}
            />
          </div>
        </>
      )}

      {/* ─── HOVER CARD ─── */}
      {hoveredAlloc && (
        <AllocationHoverCard
          allocation={hoveredAlloc.allocation}
          rect={hoveredAlloc.rect}
          onMouseEnter={cancelCloseHover}
          onMouseLeave={scheduleCloseHover}
          onEscape={() => setHoveredAlloc(null)}
          onFocusAllocation={() => focusAllocation(hoveredAlloc.allocation)}
          onOpenDetails={() => handleDoubleClickAllocation(hoveredAlloc.allocation)}
        />
      )}

      {/* ─── DETAIL DRAWER ─── */}
      {clickedAlloc && (
        <AllocationDrawer
          allocation={clickedAlloc}
          onClose={() => setClickedAlloc(null)}
          onOpenJob={handleOpenJob}
          canViewPaymentRequests={canViewPaymentRequests}
        />
      )}
    </div>
  );
}

// ============================================================
// PUBLIC EXPORT — wrapped in error boundary
// ============================================================
export default function TimelineAlocacoes({ db }: { db: DatabaseProps }) {
  return (
    <TimelineErrorBoundary>
      <TimelineAlocacoesContent db={db} />
    </TimelineErrorBoundary>
  );
}
