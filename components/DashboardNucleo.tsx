'use client';

import React from 'react';
import { DatabaseProps } from '@/app/page';
import { Briefcase, Key, CalendarRange, TrendingUp, AlertTriangle, Layers, UserCheck, Star, Activity } from 'lucide-react';

export default function DashboardNucleo({ db }: { db: DatabaseProps }) {
  // Identify active nucleus based on currently selected profile logic
  // To keep the simulation fluid, we query the logged in user or offer a dropdown of nuclei!
  const user = db.currentUser;
  const initialNucleoId = user?.nucleoId || (db.nucleos && db.nucleos[0]?.id) || '55d9d7c0-d3cb-4f1e-84ad-e77ff961805b';
  const [selectedNucleoId, setSelectedNucleoId] = React.useState(initialNucleoId);

  React.useEffect(() => {
    if (user?.nucleoId) {
      setSelectedNucleoId(user.nucleoId);
    }
  }, [user?.nucleoId]);

  const activeNucleoId = user?.nucleoId || selectedNucleoId;
  const nucleo = db.nucleos.find(n => n.id === activeNucleoId);

  // Filter jobs and allocations belonging to this nucleus
  const myJobs = db.jobs.filter(j => j.nucleoId === activeNucleoId);
  const myAllocations = db.allocations.filter(a => a.nucleoId === activeNucleoId);
  const myActiveAllocations = myAllocations.filter(a => a.status === 'Ativo');

  // Compute budget
  const maxBudget = 150000; // Mock target budget per nucleus
  const usedBudget = myAllocations.reduce((sum, item) => sum + item.approvedValue, 0);
  const availableBudget = maxBudget - usedBudget;
  const usedPercentage = Math.round((usedBudget / maxBudget) * 100);

  // Check Schedule Conflicts for all freelancers allocated to this nucleus:
  // A conflict exists if a freelancer allocated here has an overlapping active booking in ANY nucleus
  const conflictingAllocations: Array<{ freelancerName: string; jobName: string; overlappingJobName: string; start: string; end: string }> = [];

  myAllocations.forEach(alloc => {
    // Look for other overlapping allocations for the same freelancer
    const docOverlap = db.allocations.find(other => 
      other.id !== alloc.id && 
      other.freelancerId === alloc.freelancerId &&
      other.status === 'Ativo' && alloc.status === 'Ativo' &&
      // Date overlaps check
      ((alloc.startDate <= other.endDate && alloc.endDate >= other.startDate))
    );

    if (docOverlap) {
      const fl = db.freelancers.find(f => f.id === alloc.freelancerId);
      const j1 = db.jobs.find(j => j.id === alloc.jobId);
      const j2 = db.jobs.find(j => j.id === docOverlap.jobId);
      
      const overlapFound = conflictingAllocations.some(x => x.freelancerName === fl?.name);
      if (!overlapFound && fl && j1 && j2) {
        conflictingAllocations.push({
          freelancerName: fl.name,
          jobName: j1.name,
          overlappingJobName: j2.name,
          start: alloc.startDate,
          end: alloc.endDate
        });
      }
    }
  });

  return (
    <div id="dashboard-nucleo-container" className="space-y-6">
      {/* Target heading */}
      <div className="flex md:flex-row flex-col gap-2 justify-between items-start md:items-center">
        <div>
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span>Painel Operacional — Núcleo</span>
            {user?.nucleoId ? (
              <span>{nucleo?.name}</span>
            ) : (
              <select
                value={activeNucleoId}
                onChange={(e) => setSelectedNucleoId(e.target.value)}
                className="bg-surface border border-border-subtle rounded px-2 py-0.5 text-sm font-semibold text-text-primary outline-none focus:border-action-cyan"
              >
                {db.nucleos.map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            )}
          </h2>
          <p className="text-xs text-text-secondary">Visão consolidada de orçamento, alocações de terceiros e demandas do seu núcleo.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => db.setActiveTab('Criar Oportunidade')} 
            className="bg-action-cyan hover:brightness-95 text-[var(--text-primary)] font-bold p-1.5 px-3 rounded-lg text-xs"
          >
            + Nova Demanda / Job
          </button>
        </div>
      </div>

      {/* KPI Bento row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI 1: Budget utilization with visual gauge */}
        <div id="nucleo-budget-card" className="bg-white border border-border-subtle rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-text-secondary text-xs font-semibold">Consumo de Budget do Núcleo</span>
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-text-primary">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(usedBudget)}
              </span>
              <span className="text-xs text-text-secondary">/ {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(maxBudget)}</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-text-secondary font-medium">Orçamento Utilizado:</span>
              <span className="font-bold text-text-primary">{usedPercentage}%</span>
            </div>
            <div className="w-full bg-surface-container rounded-full h-2.5">
              <div 
                className="bg-action-cyan h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(usedPercentage, 100)}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-text-secondary mt-2 flex justify-between">
              <span>Saldo Livre:</span>
              <span className="font-semibold text-status-success">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(availableBudget)}
              </span>
            </p>
          </div>
        </div>

        {/* KPI 2: Active bookings of my nucleus */}
        <div className="bg-white border border-border-subtle rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-text-secondary text-xs font-semibold">Alocações Ativas</span>
              <p className="text-3xl font-bold text-text-primary mt-1">{myActiveAllocations.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-status-success/15 flex items-center justify-center text-status-success">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="border-t border-border-subtle pt-3 mt-3">
            <div className="flex justify-between text-xs text-text-secondary">
              <span>Total histórico:</span>
              <span className="font-bold text-text-primary">{myAllocations.length} alocações</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Job demands status list */}
        <div className="bg-white border border-border-subtle rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-text-secondary text-xs font-semibold">Demandas Cadastradas</span>
              <p className="text-3xl font-bold text-text-primary mt-1">{myJobs.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Briefcase className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <div className="flex gap-2 text-[10px] items-center pt-3 mt-3 border-t border-border-subtle">
            <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full font-bold">
              {myJobs.filter(j => j.status === 'Oportunidade criada' || j.status === 'Em shortlist').length} Novas
            </span>
            <span className="bg-status-warning/10 text-[#B28900] px-2 py-0.5 rounded-full font-bold">
              {myJobs.filter(j => j.status === 'Em negociação' || j.status === 'Aguardando RH').length} Negociações
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left column: My demands and bookings */}
        <div className="xl:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl border border-border-subtle shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border-subtle flex justify-between items-center bg-surface">
              <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-text-secondary" />
                <span>Demandas sob Responsabilidade do Núcleo ({myJobs.length})</span>
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              {myJobs.length === 0 ? (
                <div className="p-12 text-center text-text-secondary text-xs italic">
                  Nenhuma demanda criada. Crie sua primeira oportunidade acima!
                </div>
              ) : (
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-surface font-semibold text-text-secondary border-b border-border-subtle">
                    <tr>
                      <th className="px-4 py-3">CAMPANHA / CLIENTE</th>
                      <th className="px-4 py-3">FUNÇÃO / NÍVEL</th>
                      <th className="px-4 py-3">PERÍODO</th>
                      <th className="px-4 py-3">STATUS</th>
                      <th className="px-4 py-3 text-right">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {myJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-text-primary text-xs">{job.name}</p>
                          <p className="text-[10px] text-text-secondary">{job.client}</p>
                        </td>
                        <td className="px-4 py-3.5 text-text-primary">
                          <p className="font-medium">{job.roleNeeded}</p>
                          <p className="text-[10px] text-text-secondary">{job.seniorityNeeded}</p>
                        </td>
                        <td className="px-4 py-3.5 text-text-secondary">
                          {job.startDate} a {job.endDate}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold
                            ${job.status === 'Bookado' || job.status === 'Em andamento' ? 'bg-status-success/10 text-status-success' : ''}
                            ${job.status === 'Oportunidade criada' || job.status === 'Em shortlist' ? 'bg-secondary-container text-on-secondary-container' : ''}
                            ${job.status === 'Aguardando RH' || job.status === 'Em negociação' ? 'bg-status-warning/10 text-[#B28900]' : ''}
                            ${job.status === 'Avaliação pendente' ? 'bg-status-error/15 text-status-error border border-status-error/25' : ''}
                            ${job.status === 'Encerrado' ? 'bg-surface-container-highest text-text-secondary' : ''}
                          `}>
                            {job.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {job.status === 'Oportunidade criada' && (
                            <button 
                              onClick={() => { 
                                db.setSelectedJobId(job.id); 
                                db.setActiveTab('Shortlist'); 
                              }}
                              className="text-[11px] font-bold text-amber-600 border border-action-cyan/30 hover:brightness-95 p-1 px-2.5 rounded-lg"
                            >
                              Adicionar Shortlist
                            </button>
                          )}
                          {job.status === 'Em shortlist' && (
                            <button 
                              onClick={() => { 
                                db.setSelectedJobId(job.id); 
                                db.setActiveTab('Shortlist'); 
                              }}
                              className="text-[11px] font-bold text-amber-600 hover:underline"
                            >
                              Ver Shortlist
                            </button>
                          )}
                          {job.status === 'Em negociação' && (
                            <button 
                              onClick={() => { 
                                db.setSelectedJobId(job.id); 
                                db.setActiveTab('Shortlist'); 
                              }}
                              className="text-[11px] font-bold text-status-warning hover:underline"
                            >
                              Negociar Valores
                            </button>
                          )}
                          {['Bookado', 'Em andamento', 'Concluído', 'Avaliação pendente', 'Encerrado'].includes(job.status) && (
                            <button 
                              onClick={() => { 
                                db.setSelectedJobId(job.id); 
                                db.setActiveTab('Meus Bookings'); 
                              }}
                              className="text-[11px] font-bold text-amber-600 border border-action-cyan/35 hover:brightness-95 p-1.5 px-3 rounded-lg"
                            >
                              Ver Alocação
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Schedule Conflicts / encavalados */}
        <div id="nucleo-conflicts-panel" className="xl:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-border-subtle p-5">
            <div className="flex items-center gap-2 mb-4">
              <CalendarRange className="w-5 h-5 text-[#B28900]" />
              <h3 className="font-bold text-text-primary text-base">Agenda e Conflitos de Recursos</h3>
            </div>

            <div className="space-y-4">
              {conflictingAllocations.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-10 h-10 text-status-success mx-auto opacity-70 mb-2" />
                  <p className="text-xs font-bold text-text-primary">Recursos saudáveis!</p>
                  <p className="text-[10px] text-text-secondary mt-1">Nenhum profissional encavalado ou sobreposto em múltiplos cronogramas do seu núcleo.</p>
                </div>
              ) : (
                conflictingAllocations.map((conflict, idx) => (
                  <div key={idx} className="p-3 bg-status-error/5 border border-status-error/15 rounded-xl space-y-2.5">
                    <div className="flex gap-2 items-start text-status-error">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-text-primary">Conflito Detectado: {conflict.freelancerName}</h4>
                        <p className="text-[10px] text-text-secondary mt-0.5">O profissional está encavalado em tarefas simultâneas:</p>
                      </div>
                    </div>

                    <div className="text-[11px] space-y-1 pl-6">
                      <p className="text-text-primary font-medium">&bull; <span className="font-semibold text-amber-600">Job 1:</span> {conflict.jobName}</p>
                      <p className="text-text-primary font-medium">&bull; <span className="font-semibold text-status-error">Job 2:</span> {conflict.overlappingJobName}</p>
                      <p className="text-[10px] text-text-secondary">Período sobreposto: <span className="font-semibold">{conflict.start} &rarr; {conflict.end}</span></p>
                    </div>

                    <div className="pt-1.5 border-t border-dashed border-border-subtle pl-6 flex justify-between items-center">
                      <span className="text-[10px] text-text-secondary">Ajuste de cronograma sugerido</span>
                      <button 
                        onClick={() => db.setActiveTab('Timeline')}
                        className="text-[11px] text-amber-600 font-bold hover:underline"
                      >
                        Remanejar &rarr;
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
