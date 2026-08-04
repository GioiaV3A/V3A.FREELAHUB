'use client';

import React, { useState, useMemo } from 'react';
import { DatabaseProps } from '@/app/page';
import { simulatePaymentProjections, formatCurrencyBR, getDominantMonthLabel } from '@/lib/financial';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  BarChart3,
  Building,
  Users,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Filter,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Table,
  Search,
  ShieldAlert,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  PieChart,
  Lock,
  Briefcase,
  ExternalLink,
  RotateCcw,
  Award,
  Layers3,
  Eye
} from 'lucide-react';

interface ProjectionItem {
  id: string;
  allocationId?: string;
  jobId: string;
  jobTitle: string;
  clientName: string;
  nucleoId: string;
  nucleoName: string;
  freelancerName: string;
  cycleNumber: number;
  totalCycles: number;
  startDate: string;
  endDate: string;
  suggestedPaymentDate: string;
  suggestedRcDeadline: string;
  alertLevel: 'informational' | 'attention' | 'urgent' | 'critical';
  referenceMonth: string;
  monthKey: string; // e.g. "2026-08"
  amount: number;
  hasSuccessFee: boolean;
  successFeeAmount: number;
  remunerationModel: string;
}

export default function DashboardCashFlowProjections({ db }: { db: DatabaseProps }) {
  // ── 0. Access Control Verification (Master, RH, C-Level) ──
  const userRole = (db.currentUser?.role || (db.currentUser as any)?.profileRole || 'MASTER').toUpperCase();
  const isAuthorized = ['MASTER', 'RH', 'C-LEVEL', 'C_LEVEL'].includes(userRole);

  // Filter States
  const [selectedNucleo, setSelectedNucleo] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [riskOnlyFilter, setRiskOnlyFilter] = useState<boolean>(false);
  const [timeHorizon, setTimeHorizon] = useState<'6' | '12' | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'timeline' | 'nucleos' | 'clients' | 'table'>('timeline');
  const [hoveredMonthKey, setHoveredMonthKey] = useState<string | null>(null);
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');

  // Focused Nucleus line highlight state (null = all active)
  const [highlightedNucleoName, setHighlightedNucleoName] = useState<string | null>(null);

  // ── Carousel / Window Navigation State ──
  const [monthWindowOffset, setMonthWindowOffset] = useState<number>(0);
  const windowSize = 6; // Number of months visible per page view in sync with graph

  // Color palette for distinct nuclei lines
  const chartColors = ['#a855f7', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#6366f1', '#3b82f6', '#14b8a6'];

  // ── 1. Extract All Auditable Projection Items ──
  const allProjectionItems = useMemo(() => {
    const items: ProjectionItem[] = [];

    // Process Active Allocations
    db.allocations.forEach((alloc, allocIdx) => {
      if (!alloc.startDate || !alloc.endDate) return;
      const job = db.jobs.find(j => j.id === alloc.jobId);
      const nucleo = db.nucleos.find(n => n.id === (alloc.nucleoId || job?.nucleoId));
      const freelancer = db.freelancers.find(f => f.id === alloc.freelancerId);
      const clientName = job?.clientName || (job as any)?.client || 'Cliente não especificado';
      let nucleoName = nucleo?.name || 'Núcleo não identificado';
      if (!nucleoName || nucleoName.toLowerCase() === 'núcleo não identificado') {
        nucleoName = 'Núcleo Pendente de Configuração';
      }
      const nucleoId = nucleo?.id || alloc.nucleoId || job?.nucleoId || 'unknown';
      const freelancerName = freelancer?.fullName || freelancer?.name || 'Freelancer homologado';
      const jobTitle = job?.title || 'Job sem título';
      const model = alloc.remunerationModel || job?.remunerationModel || 'monthly_salary';
      const val = alloc.totalContractValue || alloc.negotiatedTotal || alloc.approvedValue || 0;

      const projections = simulatePaymentProjections(alloc.startDate, alloc.endDate, model);
      if (projections.length > 0) {
        const parcelVal = model === 'fixed_job' ? val : (val > 0 ? val / projections.length : 0);

        projections.forEach((p, pIdx) => {
          if (!p.startDate) return;
          const payDateStr = p.suggestedPaymentDate || p.startDate;
          const payParts = payDateStr.split('T')[0].split('-');
          let monthKey = `${payParts[0]}-${payParts[1]}`;
          
          const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
          const monthIndex = parseInt(payParts[1], 10) - 1;
          const refMonth = `${monthNames[monthIndex]}/${payParts[0]}`;

          const hasSf = Boolean(alloc.successFeeEnabled || job?.successFeeEnabled);
          const sfAmt = alloc.successFeeAmount || (job as any)?.successFeeFixedAmount || 0;

          items.push({
            id: `alloc-${alloc.id || allocIdx}-p-${pIdx}`,
            allocationId: alloc.id,
            jobId: alloc.jobId || job?.id || `job-${allocIdx}`,
            jobTitle,
            clientName,
            nucleoId,
            nucleoName,
            freelancerName,
            cycleNumber: p.cycleNumber,
            totalCycles: projections.length,
            startDate: p.startDate,
            endDate: p.endDate,
            suggestedPaymentDate: p.suggestedPaymentDate,
            suggestedRcDeadline: p.suggestedRcDeadline,
            alertLevel: p.alertLevel,
            referenceMonth: refMonth,
            monthKey,
            amount: parcelVal,
            hasSuccessFee: hasSf,
            successFeeAmount: sfAmt,
            remunerationModel: model
          });
        });
      }
    });

    // Process Open Jobs without Allocations
    db.jobs.forEach((job, jobIdx) => {
      const hasAlloc = db.allocations.some(a => a.jobId === job.id);
      if (!hasAlloc && job.startDate && job.endDate && job.budget > 0) {
        const nucleo = db.nucleos.find(n => n.id === job.nucleoId);
        const clientName = job.clientName || (job as any).client || 'Cliente não especificado';
        let nucleoName = nucleo?.name || 'Núcleo não identificado';
        if (!nucleoName || nucleoName.toLowerCase() === 'núcleo não identificado') {
          nucleoName = 'Núcleo Pendente de Configuração';
        }
        const model = job.remunerationModel || 'monthly_salary';

        const projections = simulatePaymentProjections(job.startDate, job.endDate, model);
        if (projections.length > 0) {
          const parcelVal = model === 'fixed_job' ? job.budget : (job.budget / projections.length);

          projections.forEach((p, pIdx) => {
            if (!p.startDate) return;
            const payDateStr = p.suggestedPaymentDate || p.startDate;
            const payParts = payDateStr.split('T')[0].split('-');
            let monthKey = `${payParts[0]}-${payParts[1]}`;
            
            const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            const monthIndex = parseInt(payParts[1], 10) - 1;
            const refMonth = `${monthNames[monthIndex]}/${payParts[0]}`;

            items.push({
              id: `job-${job.id || jobIdx}-p-${pIdx}`,
              jobId: job.id,
              jobTitle: job.title || 'Oportunidade Aberta',
              clientName,
              nucleoId: job.nucleoId || 'unknown',
              nucleoName,
              freelancerName: 'Oportunidade aberta (Pendente de homologação)',
              cycleNumber: p.cycleNumber,
              totalCycles: projections.length,
              startDate: p.startDate,
              endDate: p.endDate,
              suggestedPaymentDate: p.suggestedPaymentDate,
              suggestedRcDeadline: p.suggestedRcDeadline,
              alertLevel: p.alertLevel,
              referenceMonth: refMonth,
              monthKey,
              amount: parcelVal,
              hasSuccessFee: Boolean(job.successFeeEnabled),
              successFeeAmount: (job as any).successFeeFixedAmount || 0,
              remunerationModel: model
            });
          });
        }
      }
    });

    return items;
  }, [db.allocations, db.jobs, db.nucleos, db.freelancers]);

  // Unique Lists for Filter Selects
  const availableNucleos = useMemo(() => {
    const map = new Map<string, string>();
    allProjectionItems.forEach(i => map.set(i.nucleoId, i.nucleoName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allProjectionItems]);

  const availableClients = useMemo(() => {
    const set = new Set<string>();
    allProjectionItems.forEach(i => {
      let raw = (i.clientName || '').trim();
      if (raw) set.add(raw);
    });
    return Array.from(set).sort();
  }, [allProjectionItems]);

  // Filtered Projection Items
  const filteredItems = useMemo(() => {
    return allProjectionItems.filter(item => {
      if (selectedNucleo !== 'all' && item.nucleoId !== selectedNucleo) return false;
      if (selectedClient !== 'all' && item.clientName.toLowerCase() !== selectedClient.toLowerCase()) return false;
      if (riskOnlyFilter && item.alertLevel !== 'urgent' && item.alertLevel !== 'critical') return false;
      return true;
    });
  }, [allProjectionItems, selectedNucleo, selectedClient, riskOnlyFilter]);

  // ── 2. Aggregate Data by Reference Month ──
  const monthlyAggregates = useMemo(() => {
    const map: {
      [monthKey: string]: {
        monthKey: string;
        monthLabel: string;
        totalAmount: number;
        parcelCount: number;
        jobsSet: Set<string>;
        allocationsSet: Set<string>;
        alertCounts: { informational: number; attention: number; urgent: number; critical: number };
        nucleosMap: { [nucleoName: string]: number };
        clientsMap: { [clientName: string]: number };
        successFeeAmount: number;
        items: ProjectionItem[];
      };
    } = {};

    filteredItems.forEach(item => {
      if (!map[item.monthKey]) {
        map[item.monthKey] = {
          monthKey: item.monthKey,
          monthLabel: item.referenceMonth,
          totalAmount: 0,
          parcelCount: 0,
          jobsSet: new Set(),
          allocationsSet: new Set(),
          alertCounts: { informational: 0, attention: 0, urgent: 0, critical: 0 },
          nucleosMap: {},
          clientsMap: {},
          successFeeAmount: 0,
          items: []
        };
      }

      const m = map[item.monthKey];
      m.totalAmount += item.amount;
      m.parcelCount += 1;
      m.jobsSet.add(item.jobId);
      if (item.allocationId) m.allocationsSet.add(item.allocationId);
      m.alertCounts[item.alertLevel] += 1;
      m.nucleosMap[item.nucleoName] = (m.nucleosMap[item.nucleoName] || 0) + item.amount;

      let cName = (item.clientName || '').trim();
      if (!cName || cName.toLowerCase() === 'cliente não especificado') cName = 'Cliente a definir';
      m.clientsMap[cName] = (m.clientsMap[cName] || 0) + item.amount;

      if (item.hasSuccessFee) m.successFeeAmount += item.successFeeAmount;
      m.items.push(item);
    });

    let sortedList = Object.values(map).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    if (timeHorizon === '6') sortedList = sortedList.slice(0, 6);
    else if (timeHorizon === '12') sortedList = sortedList.slice(0, 12);

    const maxVal = Math.max(...sortedList.map(m => m.totalAmount), 1);
    const grandTotal = sortedList.reduce((acc, curr) => acc + curr.totalAmount, 0);

    // Calculate Month-over-Month (MoM) Growth Rate
    const listWithMoM = sortedList.map((m, idx) => {
      let momPercent = 0;
      if (idx > 0 && sortedList[idx - 1].totalAmount > 0) {
        const prev = sortedList[idx - 1].totalAmount;
        momPercent = ((m.totalAmount - prev) / prev) * 100;
      }
      const shareOfTotal = grandTotal > 0 ? (m.totalAmount / grandTotal) * 100 : 0;
      return { ...m, momPercent, shareOfTotal };
    });

    return { list: listWithMoM, maxVal, grandTotal };
  }, [filteredItems, timeHorizon]);

  // Executive KPI Summary Values
  const totalVolume = monthlyAggregates.grandTotal;
  const totalParcels = filteredItems.length;
  const uniqueJobsCount = new Set(filteredItems.map(i => i.jobId)).size;
  const riskAlertsCount = filteredItems.filter(i => i.alertLevel === 'urgent' || i.alertLevel === 'critical').length;
  const criticalAlertsCount = filteredItems.filter(i => i.alertLevel === 'critical').length;
  const urgentAlertsCount = filteredItems.filter(i => i.alertLevel === 'urgent').length;

  const peakMonthObj = useMemo(() => {
    if (monthlyAggregates.list.length === 0) return null;
    return [...monthlyAggregates.list].sort((a, b) => b.totalAmount - a.totalAmount)[0];
  }, [monthlyAggregates.list]);

  // ── Month Window Pagination for Carousel Controls (Syncs Graph & Cards) ──
  const maxOffset = Math.max(0, monthlyAggregates.list.length - windowSize);
  const visibleMonthList = useMemo(() => {
    return monthlyAggregates.list.slice(monthWindowOffset, monthWindowOffset + windowSize);
  }, [monthlyAggregates.list, monthWindowOffset, windowSize]);

  // ── Focused Month Object for Clean Executive Focus Banner ──
  const activeFocusMonth = useMemo(() => {
    if (hoveredMonthKey) {
      const found = visibleMonthList.find(m => m.monthKey === hoveredMonthKey);
      if (found) return found;
    }
    return visibleMonthList[0] || peakMonthObj || null;
  }, [hoveredMonthKey, visibleMonthList, peakMonthObj]);

  // Y-Axis Ticks (5 reference ticks)
  const yAxisTicks = useMemo(() => {
    const max = monthlyAggregates.maxVal;
    return [
      { label: formatCurrencyBR(max), value: max },
      { label: formatCurrencyBR(max * 0.75), value: max * 0.75 },
      { label: formatCurrencyBR(max * 0.5), value: max * 0.5 },
      { label: formatCurrencyBR(max * 0.25), value: max * 0.25 },
      { label: 'R$ 0,00', value: 0 }
    ];
  }, [monthlyAggregates.maxVal]);

  // ── Normalized Nucleus Breakdown Aggregates ──
  const nucleosBreakdown = useMemo(() => {
    const map: { [key: string]: { name: string; amount: number; parcelCount: number; jobsSet: Set<string> } } = {};
    filteredItems.forEach(item => {
      let raw = (item.nucleoName || '').trim();
      if (!raw || raw.toLowerCase() === 'núcleo não identificado') {
        raw = 'Núcleo Pendente de Configuração';
      }
      const key = raw.toUpperCase();

      if (!map[key]) {
        map[key] = { name: raw, amount: 0, parcelCount: 0, jobsSet: new Set() };
      }
      map[key].amount += item.amount;
      map[key].parcelCount += 1;
      map[key].jobsSet.add(item.jobId);
    });

    return Object.values(map)
      .map((data, idx) => ({
        name: data.name,
        amount: data.amount,
        parcelCount: data.parcelCount,
        jobsCount: data.jobsSet.size,
        percentage: totalVolume > 0 ? (data.amount / totalVolume) * 100 : 0,
        color: chartColors[idx % chartColors.length]
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredItems, totalVolume, chartColors]);

  // ── Active Nuclei List Present in Current Visible Month Window with Unique Colors ──
  const visibleNucleosMap = useMemo(() => {
    const map = new Map<string, { name: string; totalAmount: number; color: string }>();

    visibleMonthList.forEach(m => {
      Object.entries(m.nucleosMap).forEach(([nName, amt]) => {
        if (amt > 0) {
          if (!map.has(nName)) {
            const found = nucleosBreakdown.find(nb => nb.name === nName);
            const color = found?.color || chartColors[map.size % chartColors.length];
            map.set(nName, { name: nName, totalAmount: amt, color });
          } else {
            map.get(nName)!.totalAmount += amt;
          }
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [visibleMonthList, nucleosBreakdown, chartColors]);

  // ── Normalized Client Breakdown Aggregates (Case-Insensitive Deduplication) ──
  const clientsBreakdown = useMemo(() => {
    const map: { [key: string]: { name: string; amount: number; parcelCount: number; jobsSet: Set<string>; nucleosSet: Set<string> } } = {};
    filteredItems.forEach(item => {
      let raw = (item.clientName || '').trim();
      if (!raw || raw.toLowerCase() === 'cliente não especificado' || raw.toLowerCase() === 'cliente não informado') {
        raw = 'Cliente A Definir';
      }
      const key = raw.toUpperCase();

      if (!map[key]) {
        const displayName = raw.toUpperCase() === raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : raw;
        map[key] = { name: displayName, amount: 0, parcelCount: 0, jobsSet: new Set(), nucleosSet: new Set() };
      }
      map[key].amount += item.amount;
      map[key].parcelCount += 1;
      map[key].jobsSet.add(item.jobId);
      if (item.nucleoName) map[key].nucleosSet.add(item.nucleoName);
    });

    return Object.values(map)
      .map((data, idx) => ({
        name: data.name,
        amount: data.amount,
        parcelCount: data.parcelCount,
        jobsCount: data.jobsSet.size,
        nucleosCount: data.nucleosSet.size,
        percentage: totalVolume > 0 ? (data.amount / totalVolume) * 100 : 0,
        color: chartColors[idx % chartColors.length]
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredItems, totalVolume, chartColors]);

  // Table Search Filtered Items
  const tableFilteredItems = useMemo(() => {
    if (!tableSearchQuery.trim()) return filteredItems;
    const q = tableSearchQuery.toLowerCase();
    return filteredItems.filter(i =>
      i.jobTitle.toLowerCase().includes(q) ||
      i.clientName.toLowerCase().includes(q) ||
      i.nucleoName.toLowerCase().includes(q) ||
      i.freelancerName.toLowerCase().includes(q) ||
      i.referenceMonth.toLowerCase().includes(q)
    );
  }, [filteredItems, tableSearchQuery]);

  // ── Restricted Access Render ──
  if (!isAuthorized) {
    return (
      <div id="dashboard-cashflow-projections-panel" className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-4">
        <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-[var(--text-primary)]">Acesso Restrito à Gestão Executiva</h3>
        <p className="text-xs text-[var(--text-disabled)] max-w-md mx-auto">
          O painel de Projeção de Fluxo de Caixa / Pagamentos (Supply) é visível exclusivamente para os perfis <strong className="text-[var(--text-secondary)]">MASTER</strong>, <strong className="text-[var(--text-secondary)]">RH</strong> e <strong className="text-[var(--text-secondary)]">C-LEVEL</strong>.
        </p>
      </div>
    );
  }

  return (
    <div id="dashboard-cashflow-projections-panel" className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/80 p-6 md:p-8 space-y-7 transition-all duration-300">
      
      {/* ── 1. HEADER EXECUTIVE TITLE ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between border-b border-slate-200 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-action-cyan/10 border border-action-cyan/30 text-action-cyan flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-[var(--text-primary)] text-lg tracking-tight flex items-center gap-2">
                <span>Projeção de Fluxo de Caixa / Pagamentos (Supply)</span>
              </h3>
              <p className="text-xs text-[var(--text-disabled)] mt-0.5">
                Linha do tempo executiva e previsão operacional de desembolsos consolidados por mês de referência.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-xs">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Previsão Operacional Ativa</span>
          </span>
          <span className="text-[11px] font-bold text-[var(--text-muted)] bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full">
            Perfil: <strong className="text-action-cyan">{userRole}</strong>
          </span>
        </div>
      </div>

      {/* ── 2. EXECUTIVE KPI SUMMARY GRID ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Volume Total */}
        <div className="bg-slate-50/60 border border-slate-200/80 p-4 rounded-xl flex items-center justify-between shadow-sm hover:border-action-cyan/40 transition-all">
          <div>
            <span className="text-[10px] font-extrabold text-[var(--text-disabled)] uppercase tracking-wider block">Volume Total Projetado</span>
            <span className="text-lg font-black text-[var(--text-primary)] block mt-1 tracking-tight">
              {formatCurrencyBR(totalVolume)}
            </span>
            <span className="text-[10px] text-[var(--text-disabled)] font-medium block mt-0.5">
              Ref. alocações homologadas
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Total de Parcelas */}
        <div className="bg-slate-50/60 border border-slate-200/80 p-4 rounded-xl flex items-center justify-between shadow-sm hover:border-action-cyan/40 transition-all">
          <div>
            <span className="text-[10px] font-extrabold text-[var(--text-disabled)] uppercase tracking-wider block">Total de Parcelas</span>
            <span className="text-lg font-black text-[var(--text-primary)] block mt-1 tracking-tight">
              {totalParcels} {totalParcels === 1 ? 'parcela' : 'parcelas'}
            </span>
            <span className="text-[10px] text-[var(--text-disabled)] font-medium block mt-0.5">
              Em {uniqueJobsCount} {uniqueJobsCount === 1 ? 'job impactado' : 'jobs impactados'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-action-cyan/10 border border-action-cyan/20 text-action-cyan flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Mês de Maior Desembolso */}
        <div className="bg-slate-50/60 border border-slate-200/80 p-4 rounded-xl flex items-center justify-between shadow-sm hover:border-action-cyan/40 transition-all">
          <div>
            <span className="text-[10px] font-extrabold text-[var(--text-disabled)] uppercase tracking-wider block">Pico de Desembolso</span>
            <span className="text-base font-extrabold text-amber-400 block mt-1 truncate max-w-[140px]">
              {peakMonthObj ? peakMonthObj.monthLabel : '—'}
            </span>
            <span className="text-[11px] font-bold text-[var(--text-muted)] block mt-0.5">
              {peakMonthObj ? formatCurrencyBR(peakMonthObj.totalAmount) : 'R$ 0,00'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Alertas de Risco RC */}
        <div className="bg-slate-50/60 border border-slate-200/80 p-4 rounded-xl flex items-center justify-between shadow-sm hover:border-action-cyan/40 transition-all">
          <div>
            <span className="text-[10px] font-extrabold text-[var(--text-disabled)] uppercase tracking-wider block">Prazos de RC em Risco</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={`text-lg font-black ${riskAlertsCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {riskAlertsCount}
              </span>
              <span className="text-[10px] font-bold text-[var(--text-disabled)]">
                ({criticalAlertsCount} crít. / {urgentAlertsCount} urg.)
              </span>
            </div>
            <span className="text-[10px] text-[var(--text-disabled)] font-medium block mt-0.5">
              Requer atenção operacional
            </span>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${riskAlertsCount > 0 ? 'bg-red-500/10 border border-red-500/20 text-red-400 animate-pulse' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 5: Núcleos Ativos */}
        <div className="bg-slate-50/60 border border-slate-200/80 p-4 rounded-xl flex items-center justify-between shadow-sm hover:border-action-cyan/40 transition-all">
          <div>
            <span className="text-[10px] font-extrabold text-[var(--text-disabled)] uppercase tracking-wider block">Núcleos Envolvidos</span>
            <span className="text-lg font-black text-[var(--text-primary)] block mt-1 tracking-tight">
              {nucleosBreakdown.length} {nucleosBreakdown.length === 1 ? 'núcleo' : 'núcleos'}
            </span>
            <span className="text-[10px] text-[var(--text-disabled)] font-medium block mt-0.5">
              {clientsBreakdown.length} clientes ativos
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <Building className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── 3. CONTROLS & FILTERS BAR ── */}
      <div className="bg-slate-50/80 border border-slate-750 p-4 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: View Tabs */}
        <div className="flex items-center gap-1.5 bg-white/90 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'timeline' ? 'bg-action-cyan text-slate-950 shadow-md' : 'text-[var(--text-disabled)] hover:text-[var(--text-primary)]'}`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Linha do Tempo</span>
          </button>
          <button
            onClick={() => setActiveTab('nucleos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'nucleos' ? 'bg-action-cyan text-slate-950 shadow-md' : 'text-[var(--text-disabled)] hover:text-[var(--text-primary)]'}`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Por Núcleo (Gráfico)</span>
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'clients' ? 'bg-action-cyan text-slate-950 shadow-md' : 'text-[var(--text-disabled)] hover:text-[var(--text-primary)]'}`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Por Cliente (Gráfico)</span>
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'table' ? 'bg-action-cyan text-slate-950 shadow-md' : 'text-[var(--text-disabled)] hover:text-[var(--text-primary)]'}`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Tabela Analítica</span>
          </button>
        </div>

        {/* Right: Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Núcleo Select */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[var(--text-disabled)]" />
            <select
              value={selectedNucleo}
              onChange={e => setSelectedNucleo(e.target.value)}
              className="bg-white border border-slate-200 text-xs text-[var(--text-primary)] rounded-lg px-2.5 py-1.5 focus:border-action-cyan focus:outline-none"
            >
              <option value="all">Todos os Núcleos</option>
              {availableNucleos.map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>

          {/* Client Select */}
          <select
            value={selectedClient}
            onChange={e => setSelectedClient(e.target.value)}
            className="bg-white border border-slate-200 text-xs text-[var(--text-primary)] rounded-lg px-2.5 py-1.5 focus:border-action-cyan focus:outline-none"
          >
            <option value="all">Todos os Clientes</option>
            {availableClients.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Time Horizon Select */}
          <select
            value={timeHorizon}
            onChange={e => setTimeHorizon(e.target.value as any)}
            className="bg-white border border-slate-200 text-xs text-[var(--text-primary)] rounded-lg px-2.5 py-1.5 focus:border-action-cyan focus:outline-none"
          >
            <option value="all">Todos os Meses</option>
            <option value="6">Próximos 6 meses</option>
            <option value="12">Próximos 12 meses</option>
          </select>

          {/* Risk Filter Toggle */}
          <button
            onClick={() => setRiskOnlyFilter(!riskOnlyFilter)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${riskOnlyFilter ? 'bg-red-500/20 text-red-300 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'bg-white text-[var(--text-disabled)] border-slate-200 hover:text-[var(--text-primary)]'}`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Apenas Alertas RC</span>
          </button>
        </div>
      </div>

      {/* ── 4. MAIN CONTENT TAB VIEWS ── */}

      {/* TAB 1: EXECUTIVE TIMELINE CHART WITH MULTI-COLOR NUCLEUS CURVES */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h4 className="font-extrabold text-xs text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-action-cyan" />
              <span>Evolução Mensal das Projeções (Curvas por Núcleo Contratante)</span>
            </h4>

            {/* Carousel / Navigation Controls */}
            {monthlyAggregates.list.length > windowSize && (
              <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-200">
                <button
                  disabled={monthWindowOffset === 0}
                  onClick={() => setMonthWindowOffset(prev => Math.max(0, prev - 1))}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-50 text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-action-cyan hover:text-slate-950 transition-all duration-300 flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Anterior</span>
                </button>

                <span className="text-[11px] font-bold text-[var(--text-muted)] px-2 select-none">
                  {visibleMonthList[0]?.monthLabel} — {visibleMonthList[visibleMonthList.length - 1]?.monthLabel}
                </span>

                <button
                  disabled={monthWindowOffset >= maxOffset}
                  onClick={() => setMonthWindowOffset(prev => Math.min(maxOffset, prev + 1))}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-50 text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-action-cyan hover:text-slate-950 transition-all duration-300 flex items-center gap-1"
                >
                  <span>Próximo</span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                {monthWindowOffset !== 0 && (
                  <button
                    onClick={() => setMonthWindowOffset(0)}
                    title="Reiniciar navegação para o início"
                    className="p-1 rounded-lg text-[var(--text-disabled)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {monthlyAggregates.list.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-disabled)] text-xs italic bg-white/50 rounded-2xl border border-slate-200">
              Nenhuma projeção financeira cadastrada ou correspondente aos filtros selecionados.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Interactive SVG Timeline Curve with Multi-Color Nuclei Lines */}
              <div className="bg-slate-950/90 border border-slate-200 rounded-2xl p-6 relative overflow-hidden transition-all duration-500 space-y-4">
                
                {/* ── MULTI-COLOR NUCLEI INTERACTIVE LEGEND BAR ── */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                  <span className="text-[10px] font-extrabold text-[var(--text-disabled)] uppercase tracking-wider flex items-center gap-1.5">
                    <Layers3 className="w-3.5 h-3.5 text-action-cyan" />
                    <span>Legenda de Núcleos no Gráfico</span>
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Total Consolidated Badge */}
                    <button
                      onClick={() => setHighlightedNucleoName(null)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${highlightedNucleoName === null ? 'bg-slate-50 border-action-cyan text-[var(--text-primary)] shadow-xs' : 'bg-white border-slate-200 text-[var(--text-disabled)] hover:text-[var(--text-primary)]'}`}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-action-cyan" />
                      <span>Total Consolidado</span>
                    </button>

                    {/* Individual Nuclei Color Chips */}
                    {visibleNucleosMap.map(n => (
                      <button
                        key={n.name}
                        onClick={() => setHighlightedNucleoName(highlightedNucleoName === n.name ? null : n.name)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${highlightedNucleoName === n.name ? 'bg-slate-50 border-white text-[var(--text-primary)] shadow-md scale-105' : 'bg-white border-slate-200 text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                        style={{ borderColor: highlightedNucleoName === n.name ? n.color : undefined }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: n.color }} />
                        <span>{n.name}</span>
                        <span className="text-[10px] text-[var(--text-disabled)] font-normal">({formatCurrencyBR(n.totalAmount)})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* SVG Visual Canvas with Y-Axis & X-Axis */}
                <div className="flex gap-4 pt-1">
                  {/* Y-Axis Monetary Reference Labels Column */}
                  <div className="w-24 flex flex-col justify-between text-[10px] font-extrabold text-[var(--text-disabled)] text-right pr-2 py-1 select-none border-r border-slate-200/80 shrink-0">
                    {yAxisTicks.map((tick, idx) => (
                      <span key={idx} className="block tracking-tight truncate">
                        {tick.label}
                      </span>
                    ))}
                  </div>

                  {/* Main SVG Plot Area */}
                  <div className="flex-1 relative">
                    <div className="w-full h-56 relative">
                      {/* Horizontal Gridlines matching Y ticks */}
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none py-1">
                        {yAxisTicks.map((_, idx) => (
                          <div key={idx} className="w-full border-b border-dashed border-slate-200/70" />
                        ))}
                      </div>

                      {/* SVG Multi-Color Nuclei Curves & Points */}
                      <svg className="w-full h-full overflow-visible transition-all duration-500 ease-out" preserveAspectRatio="none" viewBox="0 0 1000 200">
                        <defs>
                          <linearGradient id="timelineGradientMain" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {(() => {
                          const list = visibleMonthList;
                          const max = monthlyAggregates.maxVal;
                          const count = list.length;
                          if (count === 0) return null;

                          // Points for Total Consolidate Curve
                          const totalPoints = list.map((m, idx) => {
                            const x = count === 1 ? 500 : (idx / (count - 1)) * 960 + 20;
                            const y = 185 - (m.totalAmount / max) * 155;
                            return `${x},${y}`;
                          });

                          const totalAreaPath = count > 1 ? `M ${totalPoints[0]} L ${totalPoints.join(' L ')} L ${totalPoints[totalPoints.length - 1].split(',')[0]},185 L ${totalPoints[0].split(',')[0]},185 Z` : '';
                          const totalLinePath = count > 1 ? `M ${totalPoints.join(' L ')}` : '';

                          return (
                            <>
                              {/* 1. Total Consolidated Area Background (Subtle) */}
                              {count > 1 && (
                                <path
                                  d={totalAreaPath}
                                  fill="url(#timelineGradientMain)"
                                  className="transition-all duration-500 ease-out opacity-60"
                                />
                              )}

                              {/* 2. Total Consolidated Line (Dashed Cyan) */}
                              {count > 1 && (
                                <path
                                  d={totalLinePath}
                                  fill="none"
                                  stroke="#06b6d4"
                                  strokeWidth="2"
                                  strokeDasharray="4 4"
                                  className="transition-all duration-500 ease-out opacity-40"
                                />
                              )}

                              {/* 3. Individual Distinct Lines for Each Nucleus with Matching Colors */}
                              {visibleNucleosMap.map(nObj => {
                                const isFocused = highlightedNucleoName === null || highlightedNucleoName === nObj.name;
                                const opacity = isFocused ? 1 : 0.15;
                                const strokeW = highlightedNucleoName === nObj.name ? 4 : 3;

                                const nPoints = list.map((m, idx) => {
                                  const x = count === 1 ? 500 : (idx / (count - 1)) * 960 + 20;
                                  const amt = m.nucleosMap[nObj.name] || 0;
                                  const y = 185 - (amt / max) * 155;
                                  return { x, y, amt, monthKey: m.monthKey };
                                });

                                const nLinePath = count > 1 ? `M ${nPoints.map(p => `${p.x},${p.y}`).join(' L ')}` : '';

                                return (
                                  <g key={`nucleo-line-${nObj.name}`} style={{ opacity, transition: 'opacity 0.4s ease' }}>
                                    {count > 1 && (
                                      <path
                                        d={nLinePath}
                                        fill="none"
                                        stroke={nObj.color}
                                        strokeWidth={strokeW}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="transition-all duration-500 ease-out"
                                      />
                                    )}

                                    {/* Circle Nodes for each month for this Nucleus */}
                                    {nPoints.map((pt) => {
                                      if (pt.amt === 0) return null;
                                      const isHovered = hoveredMonthKey === pt.monthKey;
                                      return (
                                        <circle
                                          key={`node-${nObj.name}-${pt.monthKey}`}
                                          cx={pt.x}
                                          cy={pt.y}
                                          r={isHovered ? 6 : 4}
                                          fill={nObj.color}
                                          stroke="#090d16"
                                          strokeWidth="2"
                                          className="transition-all duration-300"
                                        />
                                      );
                                    })}
                                  </g>
                                );
                              })}

                              {/* 4. Hover Guide Vertical Dotted Line */}
                              {list.map((m, idx) => {
                                const isHovered = hoveredMonthKey === m.monthKey;
                                if (!isHovered) return null;
                                const cx = count === 1 ? 500 : (idx / (count - 1)) * 960 + 20;
                                const cy = 185 - (m.totalAmount / max) * 155;
                                return (
                                  <line
                                    key={`hover-line-${m.monthKey}`}
                                    x1={cx}
                                    y1={cy}
                                    x2={cx}
                                    y2={195}
                                    stroke="#06b6d4"
                                    strokeDasharray="4 4"
                                    strokeWidth="2"
                                    className="animate-fadeIn"
                                  />
                                );
                              })}
                            </>
                          );
                        })()}
                      </svg>

                      {/* Interactive Touch Layer over Month Columns */}
                      <div className="absolute inset-0 flex justify-between items-end px-5 pointer-events-none transition-all duration-500">
                        {visibleMonthList.map((m) => {
                          const isHovered = hoveredMonthKey === m.monthKey;
                          return (
                            <div
                              key={m.monthKey}
                              className="flex flex-col items-center pointer-events-auto cursor-pointer group relative transition-all duration-300"
                              onMouseEnter={() => setHoveredMonthKey(m.monthKey)}
                              onMouseLeave={() => setHoveredMonthKey(null)}
                              style={{ height: '100%', width: '40px', justifyContent: 'flex-end' }}
                            >
                              {/* Total Top Glow Node */}
                              <div
                                className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 shadow-[0_0_10px_rgba(6,182,212,0.4)] ${isHovered ? 'bg-white border-action-cyan scale-150 z-30 ring-4 ring-action-cyan/40' : 'bg-white border-action-cyan/70 opacity-60'}`}
                                style={{ marginBottom: `${Math.max(10, (m.totalAmount / monthlyAggregates.maxVal) * 145)}px` }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* X-Axis Reference Month Labels Row */}
                    <div className="flex justify-between items-center px-2 pt-3 border-t border-slate-200 text-[11px] font-extrabold text-[var(--text-muted)] select-none">
                      {visibleMonthList.map((m) => {
                        const isHovered = hoveredMonthKey === m.monthKey;
                        return (
                          <div
                            key={m.monthKey}
                            onMouseEnter={() => setHoveredMonthKey(m.monthKey)}
                            onMouseLeave={() => setHoveredMonthKey(null)}
                            className={`cursor-pointer transition-all duration-300 text-center px-1 py-0.5 rounded-md ${isHovered ? 'text-action-cyan bg-action-cyan/10 scale-110' : 'hover:text-[var(--text-primary)]'}`}
                          >
                            <span>{m.monthLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ── CLEAN EXECUTIVE FOCUS BANNER (No Text Overlap) ── */}
                {activeFocusMonth && (
                  <div className="mt-6 bg-white/90 border border-action-cyan/40 rounded-xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 animate-fadeIn">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-action-cyan/10 border border-action-cyan/30 text-action-cyan flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold text-action-cyan uppercase tracking-wider">Mês em Foco</span>
                          <span className="text-[var(--text-primary)] font-extrabold text-sm">{activeFocusMonth.monthLabel}</span>
                          {activeFocusMonth.momPercent !== 0 && (
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border flex items-center gap-0.5 ${activeFocusMonth.momPercent > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                              {activeFocusMonth.momPercent > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              {Math.abs(activeFocusMonth.momPercent).toFixed(1)}% MoM
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-0.5">
                          <strong className="text-emerald-400 font-extrabold text-sm">{formatCurrencyBR(activeFocusMonth.totalAmount)}</strong>
                          <span className="text-[var(--text-disabled)] ml-2">({activeFocusMonth.parcelCount} parcelas · {activeFocusMonth.jobsSet.size} jobs)</span>
                        </div>
                      </div>
                    </div>

                    {/* Nuclei Breakdown Chips for Focused Month */}
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      {Object.entries(activeFocusMonth.nucleosMap).map(([nName, nAmt]) => {
                        const nObj = visibleNucleosMap.find(v => v.name === nName);
                        return (
                          <div key={nName} className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: nObj?.color || '#a855f7' }} />
                            <span className="text-[10px] text-[var(--text-disabled)] uppercase">{nName}:</span>
                            <strong className="text-[var(--text-primary)] font-bold">{formatCurrencyBR(nAmt)}</strong>
                          </div>
                        );
                      })}

                      <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5">
                        <span className="text-[10px] text-[var(--text-disabled)] uppercase">Alertas RC:</span>
                        {activeFocusMonth.alertCounts.critical > 0 ? (
                          <span className="text-red-400 font-bold">🚨 {activeFocusMonth.alertCounts.critical} crít.</span>
                        ) : activeFocusMonth.alertCounts.urgent > 0 ? (
                          <span className="text-orange-400 font-bold">🔥 {activeFocusMonth.alertCounts.urgent} urg.</span>
                        ) : (
                          <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Em dia</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── SYNCHRONIZED MONTHLY CARDS GRID (EXACTLY MATCHING GRAPH MONTHS) ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5 mt-6 transition-all duration-500 ease-out">
                  {visibleMonthList.map(m => {
                    const isHovered = hoveredMonthKey === m.monthKey;
                    const pctBar = Math.round((m.totalAmount / monthlyAggregates.maxVal) * 100);

                    return (
                      <div
                        key={m.monthKey}
                        onMouseEnter={() => setHoveredMonthKey(m.monthKey)}
                        onMouseLeave={() => setHoveredMonthKey(null)}
                        className={`bg-white/90 border rounded-2xl p-4 transition-all duration-300 flex flex-col justify-between gap-3 shadow-md relative group cursor-pointer ${isHovered ? 'border-action-cyan ring-2 ring-action-cyan/30 bg-slate-50 shadow-[0_0_20px_rgba(6,182,212,0.2)] -translate-y-1' : 'border-slate-200 hover:border-slate-200'}`}
                      >
                        {/* Month Header */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-black text-[var(--text-primary)] text-base tracking-tight">{m.monthLabel}</span>
                            {m.momPercent !== 0 && (
                              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border flex items-center gap-0.5 ${m.momPercent > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                                {m.momPercent > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                {Math.abs(m.momPercent).toFixed(1)}%
                              </span>
                            )}
                          </div>

                          <div className="text-base font-black text-emerald-400 tracking-tight">
                            {formatCurrencyBR(m.totalAmount)}
                          </div>
                        </div>

                        {/* Visual Progress Bar */}
                        <div className="w-full bg-slate-50 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-action-cyan to-emerald-400 h-full rounded-full transition-all duration-500"
                            style={{ width: `${pctBar}%` }}
                          />
                        </div>

                        {/* Month Stats Sub-row */}
                        <div className="space-y-1.5 text-xs border-t border-slate-200/80 pt-2.5">
                          <div className="flex justify-between text-[var(--text-disabled)] text-[10.5px]">
                            <span>Parcelas:</span>
                            <span className="font-bold text-[var(--text-primary)]">
                              {m.parcelCount} ({m.jobsSet.size} jobs)
                            </span>
                          </div>

                          {/* Multi-Nucleus Breakdown Badges in Card */}
                          <div className="space-y-1 pt-1 border-t border-slate-200/50">
                            {Object.entries(m.nucleosMap).map(([nName, nAmt]) => {
                              const nObj = visibleNucleosMap.find(v => v.name === nName);
                              return (
                                <div key={nName} className="flex justify-between text-[10px] truncate">
                                  <span className="flex items-center gap-1 font-bold text-[var(--text-muted)] truncate">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: nObj?.color || '#a855f7' }} />
                                    <span className="truncate">{nName}</span>
                                  </span>
                                  <span className="font-bold text-[var(--text-primary)] shrink-0">{formatCurrencyBR(nAmt)}</span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Risk Badges */}
                          <div className="flex items-center gap-1 pt-1">
                            {m.alertCounts.critical > 0 && (
                              <span className="text-[9px] font-extrabold bg-red-500/20 text-red-300 border border-red-500/40 px-1.5 py-0.5 rounded">
                                🚨 {m.alertCounts.critical} crít.
                              </span>
                            )}
                            {m.alertCounts.urgent > 0 && (
                              <span className="text-[9px] font-extrabold bg-orange-500/20 text-orange-300 border border-orange-500/40 px-1.5 py-0.5 rounded">
                                🔥 {m.alertCounts.urgent} urg.
                              </span>
                            )}
                            {m.alertCounts.critical === 0 && m.alertCounts.urgent === 0 && (
                              <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Prazos em dia
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RICH GRAPHICAL NUCLEUS CONCENTRATION BREAKDOWN */}
      {activeTab === 'nucleos' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h4 className="font-extrabold text-xs text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <Building className="w-4 h-4 text-action-cyan" />
              <span>Análise Gráfica de Concentração por Núcleo Contratante</span>
            </h4>
            <span className="text-[11px] text-[var(--text-disabled)] font-medium">
              Proporção acumulada e volume financeiro por Núcleo
            </span>
          </div>

          {/* 1. Proportional Segmented Visual Bar Chart */}
          <div className="bg-slate-950/90 border border-slate-200 rounded-2xl p-6 space-y-4">
            <span className="text-[10px] font-extrabold text-[var(--text-disabled)] uppercase tracking-wider block">
              Distribuição Proporcional do Volume Total (100%)
            </span>

            {/* Stacked Bar */}
            <div className="w-full bg-white rounded-xl h-6 flex overflow-hidden p-1 gap-1 border border-slate-200">
              {nucleosBreakdown.map((n) => (
                <div
                  key={n.name}
                  title={`${n.name}: ${n.percentage.toFixed(1)}% (${formatCurrencyBR(n.amount)})`}
                  className="h-full rounded-md transition-all duration-500 hover:brightness-125 cursor-pointer relative group"
                  style={{
                    width: `${Math.max(1.5, n.percentage)}%`,
                    backgroundColor: n.color
                  }}
                />
              ))}
            </div>

            {/* Legend Chips */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {nucleosBreakdown.map((n) => (
                <div key={n.name} className="flex items-center gap-2 text-xs bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: n.color }} />
                  <span className="font-bold text-[var(--text-primary)]">{n.name}</span>
                  <span className="text-[var(--text-disabled)] font-semibold">{n.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Graphical Ranking Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {nucleosBreakdown.map((n, idx) => (
              <div key={n.name} className="bg-white/90 border border-slate-200 hover:border-action-cyan/40 rounded-2xl p-5 space-y-4 transition-all duration-300 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-[var(--text-primary)] text-sm shadow-md"
                      style={{ backgroundColor: n.color + '25', color: n.color, border: `1px solid ${n.color}50` }}
                    >
                      #{idx + 1}
                    </div>
                    <div>
                      <h5 className="font-extrabold text-[var(--text-primary)] text-base">{n.name}</h5>
                      <span className="text-[11px] text-[var(--text-disabled)] font-medium">
                        {n.jobsCount} {n.jobsCount === 1 ? 'job impactado' : 'jobs impactados'} · {n.parcelCount} parcelas
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-black text-emerald-400">{formatCurrencyBR(n.amount)}</div>
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-slate-50 text-action-cyan border border-slate-200">
                      {n.percentage.toFixed(1)}% do total
                    </span>
                  </div>
                </div>

                {/* Progress Bar Visual */}
                <div className="space-y-1">
                  <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200">
                    <div
                      className="h-full rounded-full transition-all duration-500 shadow-sm"
                      style={{
                        width: `${Math.max(2, n.percentage)}%`,
                        backgroundColor: n.color
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--text-disabled)] font-medium pt-1">
                    <span>Média por parcela: {formatCurrencyBR(n.parcelCount > 0 ? n.amount / n.parcelCount : 0)}</span>
                    <span>Proporção em relação ao orçamento global</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: RICH GRAPHICAL CLIENT CONCENTRATION BREAKDOWN */}
      {activeTab === 'clients' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h4 className="font-extrabold text-xs text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-action-cyan" />
              <span>Análise Gráfica de Concentração por Cliente / Projeto</span>
            </h4>
            <span className="text-[11px] text-[var(--text-disabled)] font-medium">
              Ranking consolidado e desduplicado de marcas contratantes
            </span>
          </div>

          {/* Top 5 Visual Ranking Horizontal Bar Chart */}
          <div className="bg-slate-950/90 border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-[var(--text-disabled)] uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" />
                <span>Ranking dos Maiores Clientes por Volume Projetado</span>
              </span>
              <span className="text-xs text-action-cyan font-bold">{clientsBreakdown.length} clientes ativos</span>
            </div>

            <div className="space-y-3.5 pt-2">
              {clientsBreakdown.slice(0, 5).map((c, idx) => (
                <div key={c.name} className="space-y-1.5">
                  <div className="flex justify-between text-xs items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-5 font-black text-[var(--text-disabled)] text-right">#{idx + 1}</span>
                      <span className="font-bold text-[var(--text-primary)] text-sm">{c.name}</span>
                      <span className="text-[10px] text-[var(--text-disabled)]">({c.jobsCount} jobs · {c.parcelCount} parcelas)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-emerald-400 text-sm">{formatCurrencyBR(c.amount)}</span>
                      <span className="text-[11px] font-bold text-action-cyan bg-action-cyan/10 border border-action-cyan/30 px-2 py-0.5 rounded-md">
                        {c.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-white rounded-full h-2.5 overflow-hidden border border-slate-200">
                    <div
                      className="bg-gradient-to-r from-action-cyan to-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(2, c.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cards Grid for All Clients */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientsBreakdown.map((c, idx) => (
              <div key={c.name} className="bg-white/90 border border-slate-200 hover:border-action-cyan/40 rounded-2xl p-4 space-y-3 transition-all duration-300 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 text-action-cyan font-black text-xs flex items-center justify-center">
                      #{idx + 1}
                    </div>
                    <div>
                      <h5 className="font-bold text-[var(--text-primary)] text-sm truncate max-w-[140px]">{c.name}</h5>
                      <span className="text-[10px] text-[var(--text-disabled)]">{c.nucleosCount} {c.nucleosCount === 1 ? 'núcleo' : 'núcleos'}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-black text-emerald-400">{formatCurrencyBR(c.amount)}</div>
                    <span className="text-[10px] font-bold text-action-cyan">{c.percentage.toFixed(1)}% do total</span>
                  </div>
                </div>

                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-200">
                  <div
                    className="bg-action-cyan h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(2, c.percentage)}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-[var(--text-disabled)] pt-0.5">
                  <span>{c.jobsCount} {c.jobsCount === 1 ? 'job' : 'jobs'}</span>
                  <span>{c.parcelCount} {c.parcelCount === 1 ? 'parcela' : 'parcelas'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: DETAILED ANALYTICAL TABLE */}
      {activeTab === 'table' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h4 className="font-extrabold text-xs text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <Table className="w-4 h-4 text-action-cyan" />
              <span>Tabela Analítica de Projeções de Pagamento</span>
            </h4>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-disabled)]" />
              <input
                type="text"
                placeholder="Buscar por job, cliente, núcleo ou freela..."
                value={tableSearchQuery}
                onChange={e => setTableSearchQuery(e.target.value)}
                className="bg-white border border-slate-200 text-xs text-[var(--text-primary)] pl-8 pr-3 py-1.5 rounded-lg focus:border-action-cyan focus:outline-none w-full sm:w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-[var(--text-disabled)] font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <th className="p-3">Job / Cliente</th>
                  <th className="p-3">Núcleo</th>
                  <th className="p-3">Freelancer</th>
                  <th className="p-3">Mês de Ref.</th>
                  <th className="p-3">Data Sugerida</th>
                  <th className="p-3">Prazo RC</th>
                  <th className="p-3">Status Alerta</th>
                  <th className="p-3 text-right">Valor Previsto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-white/60">
                {tableFilteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-semibold text-[var(--text-primary)]">
                      <div>{item.jobTitle}</div>
                      <div className="text-[10px] text-[var(--text-disabled)] font-normal">{item.clientName}</div>
                    </td>
                    <td className="p-3 text-purple-300 font-medium">{item.nucleoName}</td>
                    <td className="p-3 text-[var(--text-muted)]">{item.freelancerName}</td>
                    <td className="p-3 font-bold text-action-cyan">{item.referenceMonth}</td>
                    <td className="p-3 text-[var(--text-muted)] font-medium">
                      {item.suggestedPaymentDate.split('T')[0].split('-').reverse().join('/')}
                    </td>
                    <td className="p-3 text-[var(--text-muted)] font-medium">
                      {item.suggestedRcDeadline.split('T')[0].split('-').reverse().join('/')}
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                        item.alertLevel === 'critical' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                        item.alertLevel === 'urgent' ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' :
                        item.alertLevel === 'attention' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                        'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}>
                        {item.alertLevel === 'critical' ? 'Crítico' :
                         item.alertLevel === 'urgent' ? 'Urgente' :
                         item.alertLevel === 'attention' ? 'Atenção' : 'Informativo'}
                      </span>
                    </td>
                    <td className="p-3 text-right font-black text-emerald-400">
                      {formatCurrencyBR(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 5. MANDATORY COMPLIANCE DISCLAIMER ── */}
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-[var(--text-muted)] flex items-start gap-3 shadow-md">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-amber-300 font-extrabold block mb-0.5">Aviso Obrigatório de Governança de Supply:</strong>
          O pagamento depende da abertura e aprovação da RC pelo núcleo contratante no ERP de Supply, respeitando os prazos e políticas internas.
        </div>
      </div>

    </div>
  );
}
