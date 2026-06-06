'use client';

import React from 'react';
import { DatabaseProps } from '@/app/page';
import { generateUniqueId } from '@/lib/utils';
import { Users, FileWarning, ClipboardCheck, CornerDownRight, Check, X, ShieldAlert, BadgeInfo, Building, PhoneCall } from 'lucide-react';

export default function DashboardRh({ db }: { db: DatabaseProps }) {
  // Counters
  const activeCount = db.freelancers.filter(f => f.status === 'Elegível').length;
  const blockedCount = db.freelancers.filter(f => f.status === 'Bloqueado').length;
  const onboardingCount = db.freelancers.filter(f => f.status === 'Em onboarding').length;
  const analysisCount = db.freelancers.filter(f => f.status === 'Em análise').length;
  const observationCount = db.freelancers.filter(f => f.status === 'Em observação').length;

  const pendingSuggestions = db.suggestions.filter(s => s.status === 'Pendente de análise RH');
  const pendingExceptions = db.negotiations.filter(n => n.status === 'Pendente aprovação RH');

  // Approve a suggestion (convert to registered eligible freelancer)
  const handleApproveSuggestion = (sugId: string) => {
    const sug = db.suggestions.find(s => s.id === sugId);
    if (!sug) return;

    // Update suggestion status
    db.setSuggestions(prev => prev.map(s => s.id === sugId ? { ...s, status: 'Aprovada' } : s));

    // Check redundance
    const isRedundant = db.freelancers.some(f => f.email.toLowerCase() === sug.email.toLowerCase());
    if (isRedundant) {
      alert(`O e-mail ${sug.email} já está cadastrado no banco ativo. Marcado como duplicado!`);
      db.setSuggestions(prev => prev.map(s => s.id === sugId ? { ...s, status: 'Duplicada' } : s));
      return;
    }

    // Add new freelancer
    const newFreela = {
      id: generateUniqueId('free'),
      name: sug.freelancerName,
      email: sug.email,
      whatsapp: sug.whatsapp,
      city: 'São Paulo', // Default
      state: 'SP',
      mainRole: sug.suggestedRole,
      secondaryRoles: [],
      seniority: 'Pleno' as any, // Default initial
      industries: ['Tecnologia'],
      portfolioUrl: sug.portfolioUrl,
      status: 'Elegível' as any,
      availability: 'Imediata' as any,
      referenceValue: 450,
      averageScore: 0,
      observations: `Aprovado via indicação do núcleo para projeto "${sug.relatedProject}". Justificativa: ${sug.reason}`,
      experienceWithV3A: false
    };

    db.setFreelancers(prev => [newFreela, ...prev]);
    alert(`Sugestão de ${sug.freelancerName} aprovada! Perfil criado com sucesso como 'Elegível'.`);
  };

  // Reject a suggestion
  const handleRejectSuggestion = (sugId: string) => {
    db.setSuggestions(prev => prev.map(s => s.id === sugId ? { ...s, status: 'Rejeitada' } : s));
    alert('Indicação rejeitada.');
  };

  // Process Exception Approval
  const handleApproveException = (negId: string) => {
    const neg = db.negotiations.find(n => n.id === negId);
    if (!neg) return;

    // Change status of negotiation
    db.setNegotiations(prev => prev.map(n => n.id === negId ? { ...n, status: 'Aprovado pelo RH' } : n));

    // Update shortlist status
    db.setShortlists(prev => prev.map(s => 
      s.jobId === neg.jobId && s.freelancerId === neg.freelancerId
        ? { ...s, candidateStatus: 'Aprovado pelo RH' }
        : s
    ));

    // Transition the JOB status to "Bookado" which allows booking
    db.setJobs(prev => prev.map(j => j.id === neg.jobId ? { 
      ...j, 
      status: 'Bookado',
      selectedFreelancerId: neg.freelancerId,
      closedAt: new Date().toISOString(),
      closedBy: db.currentUser.id,
      closureReason: 'Aprovação de exceção pelo RH'
    } : j));

    // Automatically generate Allocation Code as rule:
    // "No funding without ALOC-YYYY-NNNN code"
    const nextNumString = String(db.allocations.length + 1).padStart(4, '0');
    const allocCode = `ALOC-2026-${nextNumString}`;

    // Create active allocation
    const newAlloc = {
      id: generateUniqueId('alloc'),
      allocationCode: allocCode,
      jobId: neg.jobId,
      freelancerId: neg.freelancerId,
      nucleoId: db.jobs.find(j => j.id === neg.jobId)?.nucleoId || '55d9d7c0-d3cb-4f1e-84ad-e77ff961805b',
      startDate: db.jobs.find(j => j.id === neg.jobId)?.startDate || '2026-06-01',
      endDate: db.jobs.find(j => j.id === neg.jobId)?.endDate || '2026-06-10',
      approvedValue: neg.negotiatedValue,
      status: 'Ativo' as const
    };

    // Append to allocations & create payment code
    db.setAllocations(prev => [...prev, newAlloc]);
    db.setPaymentCodes(prev => [
      ...prev,
      {
        id: generateUniqueId('pay'),
        allocationCode: allocCode,
        jobId: neg.jobId,
        freelancerId: neg.freelancerId,
        approvedValue: neg.negotiatedValue,
        paymentStatus: 'Aguardando conclusão do job'
      }
    ]);

    alert(`Exceção Aprovada! Código de Alocação ${allocCode} gerado e liberado para execução financeira.`);
  };

  const handleRejectException = (negId: string) => {
    db.setNegotiations(prev => prev.map(n => n.id === negId ? { ...n, status: 'Rejeitado pelo RH' } : n));
    alert('Exceção rejeitada. O Núcleo solicitante receberá um sinalizar de valor reprovado.');
  };

  return (
    <div id="dashboard-rh-container" className="space-y-6">
      {/* KPI Base Cadastral row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Ativos */}
        <div id="rh-kpi-ativos" className="bg-white border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-center text-text-secondary text-xs font-semibold mb-1">
            <span>Ativos Elegíveis</span>
            <span className="w-1.5 h-1.5 rounded-full bg-status-success"></span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{activeCount}</p>
          <span className="text-[10px] text-text-secondary">Prontos para contratação</span>
        </div>

        {/* Em Onboarding */}
        <div className="bg-white border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-center text-text-secondary text-xs font-semibold mb-1">
            <span>Em Onboarding</span>
            <span className="w-1.5 h-1.5 rounded-full bg-action-cyan"></span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{onboardingCount}</p>
          <span className="text-[10px] text-text-secondary">Assinando Docs / Fiscal</span>
        </div>

        {/* Em Analise */}
        <div className="bg-white border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-center text-text-secondary text-xs font-semibold mb-1">
            <span>Em Análise</span>
            <span className="w-1.5 h-1.5 rounded-full bg-status-warning"></span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{analysisCount}</p>
          <span className="text-[10px] text-text-secondary">Triagem de portfólio</span>
        </div>

        {/* Observação */}
        <div className="bg-white border border-border-subtle rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-center text-text-secondary text-xs font-semibold mb-1">
            <span>Em Observação</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#B28900]"></span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{observationCount}</p>
          <span className="text-[10px] text-text-secondary">Acompanhamento técnico</span>
        </div>

        {/* Bloqueados */}
        <div className="bg-white border border-border-subtle rounded-xl p-4 shadow-xs col-span-2 lg:col-span-1">
          <div className="flex justify-between items-center text-text-secondary text-xs font-semibold mb-1">
            <span>Bloqueados</span>
            <span className="w-1.5 h-1.5 rounded-full bg-status-error"></span>
          </div>
          <p className="text-2xl font-bold text-text-primary">{blockedCount}</p>
          <span className="text-[10px] text-status-error font-semibold">Vetados de engajar</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* LEFT: Suggested Freelancers from Nuclei */}
        <div id="rh-suggested-panel" className="bg-white rounded-2xl shadow-xs border border-border-subtle overflow-hidden">
          <div className="p-4 border-b border-border-subtle bg-surface flex justify-between items-center">
            <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-primary" />
              <span>Indicações Pendentes de Análise ({pendingSuggestions.length})</span>
            </h3>
            <span className="text-[10px] text-text-secondary">Enviado pelos Heads de Núcleo</span>
          </div>

          <div className="divide-y divide-border-subtle">
            {pendingSuggestions.length === 0 ? (
              <div className="p-8 text-center text-text-secondary text-xs italic">
                Nenhuma sugestão enviada no momento. Bom trabalho!
              </div>
            ) : (
              pendingSuggestions.map((sug) => (
                <div key={sug.id} className="p-4 hover:bg-surface-container-low transition-colors space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-text-primary text-xs flex items-center gap-1.5">
                        {sug.freelancerName}
                        <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full text-[9px] font-semibold">
                          {sug.suggestedRole}
                        </span>
                      </h4>
                      <p className="text-[10px] text-text-secondary mt-0.5">Indicado por {sug.suggestedBy}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleApproveSuggestion(sug.id)}
                        className="bg-status-success/15 hover:bg-status-success/30 text-status-success p-1 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1"
                        title="Aprovar e Cadastrar como Elegível"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Aprovar
                      </button>
                      <button
                        onClick={() => handleRejectSuggestion(sug.id)}
                        className="bg-status-error/15 hover:bg-status-error/30 text-status-error p-1 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1"
                        title="Recusar recomendação"
                      >
                        <X className="w-3.5 h-3.5" />
                        Rejeitar
                      </button>
                    </div>
                  </div>

                  <div className="bg-surface text-[11px] p-2 rounded-lg border border-border-subtle space-y-1.5">
                    <p className="text-text-primary">
                      <span className="font-semibold">Justificativa:</span> &ldquo;{sug.reason}&rdquo;
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-text-secondary pt-1 border-t border-dashed border-border-subtle">
                      <span className="flex items-center gap-1">
                        <Building className="w-3 h-3" /> Projeto: {sug.relatedProject}
                      </span>
                      <span className="flex items-center gap-1">
                        <PhoneCall className="w-3 h-3" /> {sug.whatsapp}
                      </span>
                      {sug.portfolioUrl && (
                        <span>
                          <a href={`https://${sug.portfolioUrl}`} target="_blank" rel="noreferrer" className="text-action-cyan hover:underline font-medium">
                            💼 Ver Portfólio
                          </a>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Price Exceptions (Value Policy Exceeded, awaiting RH approval) */}
        <div id="rh-exceptions-panel" className="bg-white rounded-2xl shadow-xs border border-border-subtle overflow-hidden">
          <div className="p-4 border-b border-border-subtle bg-surface flex justify-between items-center">
            <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-status-error" />
              <span>Aprovações de Exceções de Valores ({pendingExceptions.length})</span>
            </h3>
            <span className="text-[10px] bg-status-error/10 text-status-error px-2 py-0.5 rounded-full font-bold">
              Alerta de Conformidade B2B
            </span>
          </div>

          <div className="divide-y divide-border-subtle">
            {pendingExceptions.length === 0 ? (
              <div className="p-8 text-center text-text-secondary text-xs italic">
                Nenhum pedido de exceção pendente! Todos os núcleos operam no padrão de valor.
              </div>
            ) : (
              pendingExceptions.map((neg) => {
                const job = db.jobs.find(j => j.id === neg.jobId);
                const freela = db.freelancers.find(f => f.id === neg.freelancerId);
                const nucleo = db.nucleos.find(n => n.id === job?.nucleoId);

                // Compute difference from policy ceiling
                const policy = db.policies.find(p => p.role === job?.roleNeeded && p.seniority === job?.seniorityNeeded);
                const ceiling = policy ? policy.ceilingValue : 0;
                const difference = neg.negotiatedValue - ceiling;
                const diffPercentage = ceiling > 0 ? Math.round((difference / ceiling) * 100) : 0;

                return (
                  <div key={neg.id} className="p-4 hover:bg-surface-container-low transition-colors space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-text-primary text-xs">
                          {freela?.name} &rarr; <span className="text-text-secondary">{job?.name}</span>
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="bg-surface-container-highest text-text-primary font-medium px-2 py-0.5 rounded-lg text-[9px]">
                            Núcleo: {nucleo?.name}
                          </span>
                          <span className="bg-status-error/10 text-status-error font-extrabold px-1.5 py-0.5 rounded-md text-[9px]">
                            {diffPercentage}% acima do teto acordado
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleApproveException(neg.id)}
                          className="bg-status-success hover:bg-status-success-dark text-white p-1 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1"
                        >
                          Aprovar
                        </button>
                        <button
                          onClick={() => handleRejectException(neg.id)}
                          className="bg-status-error hover:bg-status-error-dark text-white p-1 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1"
                        >
                          Reprovar
                        </button>
                      </div>
                    </div>

                    {/* Comparative analysis table */}
                    <div className="grid grid-cols-3 gap-2 bg-surface p-2.5 rounded-lg border border-border-subtle text-[11px]">
                      <div>
                        <span className="text-text-secondary block">Teto Contratual</span>
                        <span className="font-semibold text-text-primary">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ceiling)} / diária
                        </span>
                      </div>
                      <div>
                        <span className="text-text-secondary block font-bold text-status-error">Proposta Núcleo</span>
                        <span className="font-bold text-status-error">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(neg.negotiatedValue)}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-secondary block">Diferencial (GAP)</span>
                        <span className="font-semibold text-status-error">
                          +{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(difference)}
                        </span>
                      </div>
                    </div>

                    {/* Justification check */}
                    <div className="bg-status-warning/5 border border-status-warning/25 p-2 rounded-lg text-[11px]">
                      <div className="flex gap-1.5 items-start">
                        <BadgeInfo className="w-4 h-4 text-[#B28900] shrink-0 mt-0.5" />
                        <span>
                          <span className="font-bold text-[#B28900]">Justificativa do Núcleo:</span> &ldquo;{neg.justificationIfAbovePolicy}&rdquo;
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* RH Audit list of low score freelas */}
      <div id="rh-performance-panel" className="bg-white p-5 rounded-2xl shadow-xs border border-border-subtle">
        <div className="flex md:flex-row flex-col justify-between items-start md:items-center border-b border-border-subtle pb-3 mb-4 gap-2">
          <div>
            <h3 className="font-bold text-text-primary text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-status-warning" />
              <span>Controle Fiscal e Alvos de Baixa Performance</span>
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">Profissionais sob acompanhamento ativo para manter o padrão de entrega técnica da agência.</p>
          </div>
          <button 
            onClick={() => db.setActiveTab('Banco de Freelancers')} 
            className="text-xs font-semibold text-action-cyan hover:underline hover:text-action-cyan/85"
          >
            Acessar banco de talentos
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {db.freelancers.filter(f => f.averageScore > 0 && f.averageScore < 4.4).map((f) => (
            <div key={f.id} className="p-3 border border-border-subtle rounded-xl bg-surface flex flex-col justify-between hover:border-status-warning/40 transition-colors">
              <div>
                <div className="flex justify-between items-start">
                  <span className="font-bold text-xs text-text-primary">{f.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold 
                    ${f.status === 'Bloqueado' ? 'bg-status-error/10 text-status-error' : 'bg-status-warning/10 text-[#B28900]'}`}>
                    {f.status}
                  </span>
                </div>
                <p className="text-[10px] text-text-secondary mt-0.5">Função: {f.mainRole} • {f.seniority}</p>
                <p className="text-[11px] font-medium text-text-primary line-clamp-2 mt-2 italic">&ldquo;{f.observations}&rdquo;</p>
              </div>
              <div className="border-t border-dashed border-border-subtle pt-2 mt-3 flex justify-between items-center text-xs">
                <span className="text-text-secondary">Média geral:</span>
                <span className="font-bold text-status-error flex items-center gap-1">
                  {f.averageScore.toFixed(2)} ★
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
