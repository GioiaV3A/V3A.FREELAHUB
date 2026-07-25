'use client';

import React from 'react';
import { DatabaseProps } from '@/app/page';
import { Users, ShieldAlert, Award, Briefcase, Key, Star, FileWarning, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { simulatePaymentProjections } from '@/lib/financial';
import DashboardCashFlowProjections from './DashboardCashFlowProjections';

export default function DashboardMaster({ db }: { db: DatabaseProps }) {
  // Compute metric cards values
  const totalFreelas = db.freelancers.length;
  const eligibleFreelas = db.freelancers.filter(f => f.status === 'Elegível').length;
  const blockedFreelas = db.freelancers.filter(f => f.status === 'Bloqueado').length;
  const totalJobs = db.jobs.length;
  const activeAllocations = db.allocations.filter(a => a.status === 'Ativo').length;
  const pendingEvals = db.jobs.filter(j => j.status === 'Avaliação pendente').length;
  const totalCodes = db.paymentCodes.length;

  // Compute pending price exceptions (negotiations above policy ceiling, with status 'Pendente aprovação RH')
  const priceExceptions = db.negotiations.filter(n => n.status === 'Pendente aprovação RH').length;

  // Alert calculations for the compliance card
  const lowRatingAlarms = db.freelancers.filter(f => f.averageScore > 0 && f.averageScore < 3.5);
  const jobsAwaitingCompliance = db.jobs.filter(j => j.status === 'Aguardando RH').length;

  // Render Jobs per Nucleus Chart (Using beautiful SVG proportional progress bars)
  const jobsByNucleus = db.nucleos.map(n => {
    const count = db.jobs.filter(j => j.nucleoId === n.id).length;
    const percentage = totalJobs > 0 ? Math.round((count / totalJobs) * 100) : 0;
    return { name: n.name, count, percentage };
  }).sort((a, b) => b.count - a.count);

  // Render Allocation per Roles Chart
  const rolesMap: { [key: string]: number } = {};
  db.allocations.forEach(alloc => {
    const job = db.jobs.find(j => j.id === alloc.jobId);
    if (job) {
      rolesMap[job.roleNeeded] = (rolesMap[job.roleNeeded] || 0) + 1;
    }
  });
  const rolesList = Object.entries(rolesMap)
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div id="dashboard-master-container" className="space-y-6">
      {/* 21 KPI Cards Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div id="master-kpi-total-freelas" className="bg-white border border-border-subtle rounded-xl p-4 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <span className="text-text-secondary text-sm font-semibold">Total de Freelancers</span>
            <div className="w-8 h-8 rounded-full bg-secondary-container/20 flex items-center justify-center text-primary">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-bold text-text-primary">{totalFreelas}</span>
            <div className="flex items-center mt-1 text-status-success text-xs font-semibold">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              <span>+12% este mês</span>
            </div>
          </div>
        </div>

        {/* KPI 2 */}
        <div id="master-kpi-elegidos" className="bg-white border border-border-subtle rounded-xl p-4 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <span className="text-text-secondary text-sm font-semibold">Freelas Elegíveis</span>
            <div className="w-8 h-8 rounded-full bg-status-success/10 flex items-center justify-center text-status-success">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-bold text-text-primary">{eligibleFreelas}</span>
            <p className="text-xs text-text-secondary mt-1">Disponíveis para shortlist</p>
          </div>
        </div>

        {/* KPI 3 */}
        <div id="master-kpi-bloqueados" className="bg-white border border-border-subtle rounded-xl p-4 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <span className="text-text-secondary text-sm font-semibold">Freelas Bloqueados</span>
            <div className="w-8 h-8 rounded-full bg-status-error/10 flex items-center justify-center text-status-error">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-bold text-text-primary">{blockedFreelas}</span>
            <p className="text-xs text-status-error font-semibold mt-1">Bloqueios de compliance</p>
          </div>
        </div>

        {/* KPI 4 */}
        <div id="master-kpi-alocacoes-ativas" className="bg-white border border-border-subtle rounded-xl p-4 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-2">
            <span className="text-text-secondary text-sm font-semibold">Alocações Ativas</span>
            <div className="w-8 h-8 rounded-full bg-action-cyan/15 flex items-center justify-center text-action-cyan">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-bold text-text-primary">{activeAllocations}</span>
            <div className="flex items-center mt-1 text-status-success text-xs font-semibold">
              <Clock className="w-3.5 h-3.5 mr-1" />
              <span>Em campo atualmente</span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-border-subtle rounded-xl p-4 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-primary border border-border-subtle">
            <TrendingUp className="w-5 h-5 text-action-cyan" />
          </div>
          <div>
            <span className="text-xl font-bold text-text-primary block leading-none">{totalJobs}</span>
            <span className="text-xs text-text-secondary">Jobs Criados</span>
          </div>
        </div>

        <div className="bg-white border border-border-subtle rounded-xl p-4 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-primary border border-border-subtle">
            <Star className="w-5 h-5 text-status-warning" />
          </div>
          <div>
            <span className="text-xl font-bold text-text-primary block leading-none">{pendingEvals}</span>
            <span className="text-xs text-text-secondary font-semibold">Avaliações Pendentes</span>
          </div>
        </div>

        <div className="bg-white border border-border-subtle rounded-xl p-4 shadow-xs flex items-center gap-3 relative overflow-hidden">
          <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-primary border border-border-subtle">
            <FileWarning className="w-5 h-5 text-status-error" />
          </div>
          <div>
            <span className="text-xl font-bold text-text-primary block leading-none">{priceExceptions}</span>
            <span className="text-xs text-text-secondary">Exceções de Valor</span>
          </div>
        </div>

        <div className="bg-white border border-border-subtle rounded-xl p-4 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-primary border border-border-subtle">
            <Key className="w-5 h-5 text-primary" />
          </div>
          <div>
            <span className="text-xl font-bold text-text-primary block leading-none">{totalCodes}</span>
            <span className="text-xs text-text-secondary">Códigos Gerados</span>
          </div>
        </div>
      </div>

      {/* Cash Flow Projections Panel */}
      <DashboardCashFlowProjections db={db} />

      {/* Analytics & Compliance Split panels */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left chart panel */}
        <div className="xl:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Jobs per Nucleus */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-border-subtle">
              <h3 className="font-bold text-text-primary text-base mb-4 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-text-secondary" />
                <span>Demandas por Núcleo de Live Marketing</span>
              </h3>
              <div className="space-y-4">
                {jobsByNucleus.map((n, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-text-primary font-medium">{n.name}</span>
                      <span className="font-bold text-primary">{n.count} {n.count === 1 ? 'job' : 'jobs'} ({n.percentage}%)</span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-2">
                      <div 
                        className="bg-action-cyan h-2 rounded-full transition-all duration-500" 
                        style={{ width: `${n.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Allocations per role */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-border-subtle flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-text-primary text-base mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-text-secondary" />
                  <span>Alocações Ativas por Função</span>
                </h3>
                {rolesList.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-text-secondary italic text-sm">
                    Nenhuma alocação registrada no momento.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {rolesList.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-surface rounded-lg border border-surface-variant">
                        <span className="text-xs text-text-primary font-medium">{item.role}</span>
                        <span className="bg-secondary-container text-on-secondary-container text-[11px] font-bold px-2 py-0.5 rounded-full">
                          {item.count} {item.count === 1 ? 'freela' : 'freelas'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-border-subtle pt-3 mt-3 text-right">
                <button 
                  onClick={() => db.setActiveTab('Alocações')}
                  className="text-xs font-semibold text-action-cyan hover:underline"
                >
                  Visualizar mapa e timeline completo &rarr;
                </button>
              </div>
            </div>
          </div>

          {/* Latest opportunities / Jobs logs */}
          <div className="bg-white rounded-2xl shadow-xs border border-border-subtle overflow-hidden">
            <div className="p-4 border-b border-border-subtle flex justify-between items-center bg-surface">
              <h3 className="font-bold text-text-primary text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-text-secondary" />
                <span>Últimos Jobs Registrados</span>
              </h3>
              <button 
                onClick={() => db.setActiveTab('Jobs/Oportunidades')} 
                className="text-xs font-semibold text-action-cyan hover:underline"
              >
                Ver todos
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-surface font-semibold text-text-secondary border-b border-border-subtle">
                  <tr>
                    <th className="px-4 py-3">JOB / CLIENTE</th>
                    <th className="px-4 py-3">NÚCLEO</th>
                    <th className="px-4 py-3">FREELANCER REQUERIDO</th>
                    <th className="px-4 py-3">STATUS</th>
                    <th className="px-4 py-3 text-right">ORÇAMENTO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {db.jobs.slice(0, 4).map((job) => {
                    const nucleo = db.nucleos.find(n => n.id === job.nucleoId);
                    return (
                      <tr key={job.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-text-primary text-xs">{job.name}</p>
                          <p className="text-[10px] text-text-secondary">{job.client}</p>
                        </td>
                        <td className="px-4 py-3.5 text-text-primary">{nucleo?.name || 'Geral'}</td>
                        <td className="px-4 py-3.5 text-text-secondary">
                          <span className="font-medium text-text-primary">{job.roleNeeded}</span> • {job.seniorityNeeded}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold
                            ${job.status === 'Bookado' || job.status === 'Em andamento' ? 'bg-status-success/10 text-status-success' : ''}
                            ${job.status === 'Oportunidade criada' || job.status === 'Em shortlist' ? 'bg-secondary-container text-on-secondary-container' : ''}
                            ${job.status === 'Aguardando RH' || job.status === 'Em negociação' ? 'bg-status-warning/10 text-[#B28900]' : ''}
                            ${job.status === 'Avaliação pendente' ? 'bg-status-error/10 text-status-error border border-status-error/20' : ''}
                            ${job.status === 'Encerrado' ? 'bg-surface-container-highest text-text-secondary' : ''}
                          `}>
                            {job.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-text-primary">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(job.budget)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right dashboard column - Corporate Governance Alerts */}
        <div id="master-compliance-panel" className="xl:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl shadow-xs border border-border-subtle p-5">
            <h3 className="font-bold text-text-primary text-base mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-status-error" />
              <span>Painel de Alertas de Governança B2B</span>
            </h3>

            <div className="space-y-4">
              {/* Alert item 1: Pending Evaluations */}
              {pendingEvals > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-status-error/5 border border-status-error/20">
                  <div className="mt-0.5 text-status-error">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-text-primary">Alocações sem avaliação ({pendingEvals})</h4>
                    <p className="text-[10px] text-text-secondary mt-0.5">Necessitam parecer do núcleo solicitante para liberar pagamentos.</p>
                    <button 
                      onClick={() => db.setActiveTab('Avaliações')}
                      className="text-[11px] font-bold text-status-error mt-2 hover:underline"
                    >
                      Acessar avaliações &rarr;
                    </button>
                  </div>
                </div>
              )}

              {/* Alert item 2: Low scores */}
              {lowRatingAlarms.length > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-status-warning/5 border border-status-warning/25">
                  <div className="mt-0.5 text-status-warning">
                    <Star className="w-5 h-5 fill-status-warning text-status-warning" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-text-primary">Alerta de performance crítica ({lowRatingAlarms.length})</h4>
                    <p className="text-[10px] text-text-secondary mt-0.5">Freelancers com score inferior a 3.5. Sugerido colocar em observação.</p>
                    <div className="mt-2 space-y-1">
                      {lowRatingAlarms.map(f => (
                        <div key={f.id} className="text-[10px] text-text-primary font-medium flex justify-between">
                          <span>{f.name} ({f.mainRole})</span>
                          <span className="text-status-error font-bold">{f.averageScore.toFixed(2)} ★</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Alert item 3: Pending Exceptions */}
              {priceExceptions > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-status-warning/10 border border-status-warning/30">
                  <div className="mt-0.5 text-[#B28900]">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-text-primary">Aprovações de valores pendentes ({priceExceptions})</h4>
                    <p className="text-[10px] text-text-secondary mt-0.5">Negociações com orçamentos acima do teto de referência acordado por função.</p>
                    <button 
                      onClick={() => db.setActiveTab('Política de Valores')}
                      className="text-[11px] font-bold text-[#B28900] mt-2 hover:underline"
                    >
                      Analisar termos &rarr;
                    </button>
                  </div>
                </div>
              )}

              {/* Alert item 4: Awaiting compliance */}
              {jobsAwaitingCompliance > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary-container/30 border border-border-subtle">
                  <div className="mt-0.5 text-primary">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-text-primary">Aguardando validação jurídica do RH ({jobsAwaitingCompliance})</h4>
                    <p className="text-[10px] text-text-secondary mt-0.5">Jobs criados aguardando publicação formal de proposta.</p>
                  </div>
                </div>
              )}

              {pendingEvals === 0 && lowRatingAlarms.length === 0 && priceExceptions === 0 && (
                <div className="text-center py-6">
                  <CheckCircle className="w-12 h-12 text-status-success mx-auto opacity-70 mb-2" />
                  <p className="text-sm font-semibold text-text-primary">Todas as conformidades em dia!</p>
                  <p className="text-xs text-text-secondary mt-1">Nenhuma irregularidade fiscal ou operacional ativa no sistema.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
