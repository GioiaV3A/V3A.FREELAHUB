'use client';

import React, { useMemo } from 'react';
import { DatabaseProps } from '@/app/page';
import { 
  Briefcase, Key, CalendarRange, TrendingUp, AlertTriangle, Layers, 
  UserCheck, Star, Activity, QrCode, FileText, Clock, Building
} from 'lucide-react';
import { getRoleLabel } from '@/lib/dbMapper';

export default function DashboardOperacao({ db }: { db: DatabaseProps }) {
  const user = db.currentUser;

  // 1. Multi-nucleus KPIs:
  const activeOpportunitiesCount = useMemo(() => {
    return db.jobs.filter(j => j.status === 'Oportunidade criada').length;
  }, [db.jobs]);

  const shortlistJobsCount = useMemo(() => {
    return db.jobs.filter(j => j.status === 'Em shortlist').length;
  }, [db.jobs]);

  const inNegotiationCount = useMemo(() => {
    return db.jobs.filter(j => j.status === 'Em negociação' || j.status === 'Aguardando RH').length;
  }, [db.jobs]);

  const activeAllocationsCount = useMemo(() => {
    return db.allocations.filter(a => a.status?.toLowerCase() === 'ativo' || a.status?.toLowerCase() === 'bookado' || a.status?.toLowerCase() === 'em_andamento').length;
  }, [db.allocations]);

  // Payment requests pending
  const pendingPaymentsCount = useMemo(() => {
    return db.paymentRequests?.filter(pr => pr.documentStatus === 'generated' || pr.documentStatus === 'exported').length || 0;
  }, [db.paymentRequests]);

  // Links created by the user
  const generatedLinksCount = useMemo(() => {
    return db.paymentCodes?.length || 0; // fallback or mock count if not directly in db state. Let's make it look dynamic.
  }, [db.paymentCodes]);

  // Submissions pending validation
  const pendingSubmissionsCount = useMemo(() => {
    // We can read suggestions or count of freelancers in analysis
    return db.freelancers.filter(f => f.status === 'Em análise').length;
  }, [db.freelancers]);

  // 2. Schedule conflicts detection across all nuclei
  const scheduleConflicts = useMemo(() => {
    const conflicts: Array<{ freelancerName: string; jobName: string; overlappingJobName: string; start: string; end: string }> = [];
    
    db.allocations.forEach(alloc => {
      const docOverlap = db.allocations.find(other => 
        other.id !== alloc.id && 
        other.freelancerId === alloc.freelancerId &&
        (other.status?.toLowerCase() === 'ativo' || other.status?.toLowerCase() === 'bookado' || other.status?.toLowerCase() === 'em_andamento') &&
        (alloc.status?.toLowerCase() === 'ativo' || alloc.status?.toLowerCase() === 'bookado' || alloc.status?.toLowerCase() === 'em_andamento') &&
        ((alloc.startDate <= other.endDate && alloc.endDate >= other.startDate))
      );

      if (docOverlap) {
        const fl = db.freelancers.find(f => f.id === alloc.freelancerId);
        const j1 = db.jobs.find(j => j.id === alloc.jobId);
        const j2 = db.jobs.find(j => j.id === docOverlap.jobId);
        
        const overlapFound = conflicts.some(x => x.freelancerName === fl?.name);
        if (!overlapFound && fl && j1 && j2) {
          conflicts.push({
            freelancerName: fl.name,
            jobName: j1.name,
            overlappingJobName: j2.name,
            start: alloc.startDate,
            end: alloc.endDate
          });
        }
      }
    });
    return conflicts;
  }, [db.allocations, db.freelancers, db.jobs]);

  // 3. Breakdown of demands per nucleus
  const nucleusBreakdown = useMemo(() => {
    return db.nucleos.map(n => {
      const jobsCount = db.jobs.filter(j => j.nucleoId === n.id).length;
      const activeAlloc = db.allocations.filter(a => a.nucleoId === n.id && (a.status?.toLowerCase() === 'ativo' || a.status?.toLowerCase() === 'bookado')).length;
      return {
        id: n.id,
        name: n.name,
        jobsCount,
        activeAlloc,
        headName: n.headName
      };
    }).sort((a, b) => b.jobsCount - a.jobsCount);
  }, [db.nucleos, db.jobs, db.allocations]);

  return (
    <div id="dashboard-operacao-container" className="space-y-6 animate-fade-in">
      
      {/* Target heading */}
      <div className="flex md:flex-row flex-col gap-2 justify-between items-start md:items-center">
        <div>
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span>Painel Operacional Multi-núcleo</span>
            <span className="bg-amber-500/10 text-amber-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/20">
              OPERAÇÕES
            </span>
          </h2>
          <p className="text-xs text-text-secondary">Visão consolidada de oportunidades, shortlists, negociações, alocações e pagamentos de todos os núcleos da agência.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => db.setActiveTab('Criar Oportunidade')} 
            className="bg-action-cyan hover:bg-action-cyan/85 text-white font-extrabold p-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs"
          >
            + Nova Demanda / Job
          </button>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Active Opportunities */}
        <div className="bg-white p-5 border border-border-subtle rounded-2xl shadow-xs flex items-center justify-between hover:border-slate-300 transition-colors">
          <div className="space-y-1">
            <span className="text-text-secondary text-xs font-semibold">Oportunidades Ativas</span>
            <p className="text-2xl font-black text-text-primary">{activeOpportunitiesCount}</p>
            <p className="text-[10px] text-text-secondary">Aguardando definição de shortlist</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/20 dark:text-cyan-400 flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Jobs in Shortlist */}
        <div className="bg-white p-5 border border-border-subtle rounded-2xl shadow-xs flex items-center justify-between hover:border-slate-300 transition-colors">
          <div className="space-y-1">
            <span className="text-text-secondary text-xs font-semibold">Jobs em Shortlist</span>
            <p className="text-2xl font-black text-text-primary">{shortlistJobsCount}</p>
            <p className="text-[10px] text-text-secondary">Com candidatos em seleção</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Negotiations in Progress */}
        <div className="bg-white p-5 border border-border-subtle rounded-2xl shadow-xs flex items-center justify-between hover:border-slate-300 transition-colors">
          <div className="space-y-1">
            <span className="text-text-secondary text-xs font-semibold">Negociações Ativas</span>
            <p className="text-2xl font-black text-text-primary">{inNegotiationCount}</p>
            <p className="text-[10px] text-text-secondary">Aguardando aprovação ou fechamento</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Active Allocations */}
        <div className="bg-white p-5 border border-border-subtle rounded-2xl shadow-xs flex items-center justify-between hover:border-slate-300 transition-colors">
          <div className="space-y-1">
            <span className="text-text-secondary text-xs font-semibold">Alocações Ativas</span>
            <p className="text-2xl font-black text-text-primary">{activeAllocationsCount}</p>
            <p className="text-[10px] text-text-secondary">Freelas executando ou bookados</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Sub-KPI grid row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Sub-KPI 1: Payment requests */}
        <div className="bg-slate-50 p-4 border border-border-subtle rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Pagtos Pendentes</p>
            <p className="text-sm font-bold text-text-primary mt-0.5">{pendingPaymentsCount} solicitações</p>
          </div>
        </div>

        {/* Sub-KPI 2: Submissions pending review */}
        <div className="bg-slate-50 p-4 border border-border-subtle rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Triagem de Portfólio</p>
            <p className="text-sm font-bold text-text-primary mt-0.5">{pendingSubmissionsCount} pré-cadastros no RH</p>
          </div>
        </div>

        {/* Sub-KPI 3: Schedule conflicts */}
        <div className="bg-slate-50 p-4 border border-border-subtle rounded-xl flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 
            ${scheduleConflicts.length > 0 ? 'bg-red-500/10 text-red-600 animate-pulse' : 'bg-slate-200 text-slate-600'}`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Conflitos de Recursos</p>
            <p className="text-sm font-bold text-text-primary mt-0.5">
              {scheduleConflicts.length > 0 ? `${scheduleConflicts.length} alocações encavaladas` : 'Nenhum conflito ativo'}
            </p>
          </div>
        </div>

      </div>

      {/* Main Grid: Breakdown & Conflicts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Breakdown per Nucleus */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl border border-border-subtle shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border-subtle bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
                <Building className="w-4 h-4 text-text-secondary" />
                <span>Indicadores Operacionais por Núcleo</span>
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 font-semibold text-text-secondary border-b border-border-subtle">
                  <tr>
                    <th className="px-5 py-3">NÚCLEO / RESPONSÁVEL</th>
                    <th className="px-5 py-3 text-center">DEMANDAS TOTAIS</th>
                    <th className="px-5 py-3 text-center">ALOCAÇÕES ATIVAS</th>
                    <th className="px-5 py-3 text-right">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-medium text-text-primary">
                  {nucleusBreakdown.map((nuc) => (
                    <tr key={nuc.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-text-primary">{nuc.name}</p>
                        <p className="text-[10px] text-text-secondary">Head: {nuc.headName || 'Não definido'}</p>
                      </td>
                      <td className="px-5 py-3.5 text-center font-bold text-text-primary">
                        {nuc.jobsCount}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold
                          ${nuc.activeAlloc > 0 ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {nuc.activeAlloc} ativas
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => {
                            db.setActiveTab('Buscar Freelancers');
                          }}
                          className="text-[11px] font-bold text-action-cyan hover:underline"
                        >
                          Ver Alocações &rarr;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Conflicts List */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-border-subtle p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <CalendarRange className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-text-primary text-sm">Alertas de Alocações Simultâneas</h3>
            </div>

            <div className="space-y-4">
              {scheduleConflicts.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-10 h-10 text-emerald-500 mx-auto opacity-70 mb-2" />
                  <p className="text-xs font-bold text-text-primary">Recursos saudáveis!</p>
                  <p className="text-[10px] text-text-secondary mt-1">Nenhum profissional está alocado em tarefas simultâneas conflitantes na plataforma.</p>
                </div>
              ) : (
                scheduleConflicts.map((conflict, idx) => (
                  <div key={idx} className="p-3 bg-red-500/5 border border-red-500/15 rounded-xl space-y-2.5">
                    <div className="flex gap-2 items-start text-red-600">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                      <div>
                        <h4 className="text-xs font-bold text-text-primary">{conflict.freelancerName}</h4>
                        <p className="text-[10px] text-text-secondary mt-0.5">Profissional encavalado em múltiplos núcleos:</p>
                      </div>
                    </div>

                    <div className="text-[11px] space-y-1 pl-6">
                      <p className="text-text-primary font-medium">&bull; <span className="font-semibold text-action-cyan">Job A:</span> {conflict.jobName}</p>
                      <p className="text-text-primary font-medium">&bull; <span className="font-semibold text-red-500">Job B:</span> {conflict.overlappingJobName}</p>
                      <p className="text-[10px] text-text-secondary">Período sobreposto: <span className="font-semibold">{conflict.start} &rarr; {conflict.end}</span></p>
                    </div>

                    <div className="pt-2 border-t border-dashed border-border-subtle pl-6 flex justify-between items-center">
                      <span className="text-[10px] text-text-secondary">Ajuste recomendado</span>
                      <button 
                        onClick={() => db.setActiveTab('Timeline de Alocações')}
                        className="text-[11px] text-action-cyan font-bold hover:underline"
                      >
                        Timeline &rarr;
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
