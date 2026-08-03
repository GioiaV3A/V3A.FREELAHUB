'use client';

import React, { useState, useMemo } from 'react';
import { DatabaseProps } from '@/app/page';
import { Key, ShieldCheck, Scale, Star, ArrowUpRight, CheckCircle, HelpCircle, AlertCircle, FilePenLine } from 'lucide-react';
import { useSortableTable } from '@/hooks/useSortableTable';
import { SortableHeader } from '@/components/SortableHeader';

export default function PaymentCodesPanel({ db }: { db: DatabaseProps }) {
  const [selectedAllocationId, setSelectedAllocationId] = useState<string | null>(null);

  // Form states matching 6 criteria and weight factors
  const [technicalQuality, setTechnicalQuality] = useState(5); // 30%
  const [deadline, setDeadline] = useState(5);                 // 20%
  const [briefingAdherence, setBriefingAdherence] = useState(5);// 15%
  const [communication, setCommunication] = useState(5);        // 15%
  const [autonomy, setAutonomy] = useState(5);                 // 10%
  const [behavior, setBehavior] = useState(5);                 // 10%
  const [comment, setComment] = useState('');
  const [recommendation, setRecommendation] = useState<'Sim' | 'Sim, com restrição' | 'Não'>('Sim');

  const selectedAlloc = db.allocations.find(a => a.id === selectedAllocationId);
  const selectedJob = selectedAlloc ? db.jobs.find(j => j.id === selectedAlloc.jobId) : null;
  const selectedFreela = selectedAlloc ? db.freelancers.find(f => f.id === selectedAlloc.freelancerId) : null;

  // Real-time weighted evaluation calculation
  const calculatedWeightedScore = () => {
    const score = (technicalQuality * 0.30) + 
                  (deadline * 0.20) + 
                  (briefingAdherence * 0.15) + 
                  (communication * 0.15) + 
                  (autonomy * 0.10) + 
                  (behavior * 0.10);
    return Number(score.toFixed(2));
  };

  const handleOpenEvaluate = (allocId: string) => {
    setSelectedAllocationId(allocId);
    setTechnicalQuality(5);
    setDeadline(5);
    setBriefingAdherence(5);
    setCommunication(5);
    setAutonomy(5);
    setBehavior(5);
    setComment('');
    setRecommendation('Sim');
  };

  // Submit and update states
  const handleSubmitEvaluation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlloc || !selectedJob || !selectedFreela) return;

    const finalScore = calculatedWeightedScore();

    // 1. Create new evaluation
    const newEval = {
      id: `eval-${Date.now()}`,
      jobId: selectedJob.id,
      freelancerId: selectedFreela.id,
      evaluatorId: db.currentUser.id,
      technicalQuality,
      deadline,
      briefingAdherence,
      communication,
      autonomy,
      behavior,
      finalScore,
      comment: comment || 'Profissional executou o briefing em excelente nível técnico.',
      recommendation
    };

    // 2. Append evaluation
    db.setEvaluations(prev => [newEval, ...prev]);

    // 3. Recalculate freelancer global rating (average of all evaluations)
    db.setFreelancers(prev => prev.map(f => {
      if (f.id === selectedFreela.id) {
        // Collect all evaluations for this freelancer (including the new one)
        const allEvals = [...db.evaluations.filter(ev => ev.freelancerId === f.id), newEval];
        const newAverage = allEvals.reduce((sum, item) => sum + item.finalScore, 0) / allEvals.length;
        
        let updateStatus = f.status;
        if (finalScore < 3.5) {
          updateStatus = 'Em observação';
        }

        return {
          ...f,
          averageScore: Number(newAverage.toFixed(2)),
          status: updateStatus
        };
      }
      return f;
    }));

    // 4. Update JOB status to "Encerrado" or "Avaliado"
    db.setJobs(prev => prev.map(j => j.id === selectedJob.id ? { ...j, status: 'Encerrado' } : j));

    // 5. Update PaymentCode status to "Liberado para pagamento"
    db.setPaymentCodes(prev => prev.map(p => {
      if (p.allocationCode === selectedAlloc.allocationCode) {
        return {
          ...p,
          paymentStatus: 'Liberado para pagamento'
        };
      }
      return p;
    }));

    // 6. Update Allocation status to Concluido
    db.setAllocations(prev => prev.map(a => a.id === selectedAlloc.id ? { ...a, status: 'Concluído' } : a));

    alert(`✅ Avaliação Registrada!\nMédia Ponderada: ${finalScore} ★\nO Código de Pagamento ${selectedAlloc.allocationCode} foi DESBLOQUEADO e liberado para faturamento financeiro.`);
    setSelectedAllocationId(null);
  };

  const codesWithDetails = useMemo(() => {
    return db.paymentCodes.map(code => {
      const freela = db.freelancers.find(f => f.id === code.freelancerId);
      const job = db.jobs.find(j => j.id === code.jobId);
      return {
        ...code,
        freelaName: freela?.name || '',
        jobName: job?.name || '',
      };
    });
  }, [db.paymentCodes, db.freelancers, db.jobs]);

  const {
    data: sortedCodes,
    sortKey,
    sortDirection,
    requestSort
  } = useSortableTable(codesWithDetails, 'allocationCode', 'desc');

  return (
    <div id="payment-codes-panel-container" className="space-y-6">
      {/* Visual Rule info banner */}
      <div className="bg-sidebar-navy text-[var(--text-primary)] p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-[#1e293b]">
        <div className="space-y-1">
          <h3 className="font-bold text-sm text-action-cyan uppercase tracking-widest flex items-center gap-2">
            <Key className="w-4 h-4" /> Diretriz de Governança B2B V3A
          </h3>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed font-medium">
            &ldquo;Nenhum pagamento de freelancer será auditado ou processado pelo financeiro sem um Código de Alocação homologado por este portal.&rdquo;
          </p>
        </div>
        <div className="shrink-0 bg-white/15 p-2 px-3 border border-[var(--border-default)] rounded-xl flex items-center gap-1.5 text-xs font-bold">
          <ShieldCheck className="w-4 h-4 text-action-cyan" /> Compliance Fiscal Ativo
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Payment codes registry list */}
        <div className={selectedAllocationId ? 'xl:col-span-6 space-y-6' : 'xl:col-span-12 space-y-6'}>
          <div className="bg-white border border border-border-subtle rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 bg-surface border-b border-border-subtle flex justify-between items-center text-xs">
              <h4 className="font-bold text-text-primary text-sm">Códigos de Faturamento Homologados</h4>
              <span className="text-text-secondary">{sortedCodes.length} cupons registrados</span>
            </div>

            <div className="overflow-x-auto">
              {sortedCodes.length === 0 ? (
                <div className="p-10 text-center text-text-secondary italic">
                  Nenhum código gerado. Ative contratações nos fluxos de Shortlist de demandas para emitir códigos B2B.
                </div>
              ) : (
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-surface font-semibold text-text-secondary border-b border-border-subtle">
                    <tr>
                      <SortableHeader label="CÓDIGO ALOCAÇÃO" sortKey="allocationCode" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-4 py-3" />
                      <SortableHeader label="PROFISSIONAL / CAMPANHA" sortKey="freelaName" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-4 py-3" />
                      <SortableHeader label="TAXA GERADA" sortKey="approvedValue" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-4 py-3" />
                      <SortableHeader label="STATUS DE FATURAMENTO" sortKey="paymentStatus" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-4 py-3" />
                      <th className="px-4 py-3 text-right">AÇÃO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {sortedCodes.map((code) => {
                      const alloc = db.allocations.find(a => a.allocationCode === code.allocationCode);

                      return (
                        <tr key={code.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="px-4 py-4 font-mono font-bold text-text-primary text-[11px]">
                            {code.allocationCode}
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-semibold text-text-primary">{code.freelaName || 'Carregando...'}</p>
                            <p className="text-[10px] text-text-secondary">{code.jobName || 'Job vinculado'}</p>
                          </td>
                          <td className="px-4 py-4 font-bold text-text-primary">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(code.approvedValue)}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold
                              ${code.paymentStatus === 'Liberado para pagamento' ? 'bg-status-success/10 text-status-success' : ''}
                              ${code.paymentStatus === 'Aguardando conclusão do job' ? 'bg-secondary-container text-on-secondary-container' : ''}
                              ${code.paymentStatus === 'Aguardando avaliação' ? 'bg-status-error/10 text-status-error border border-status-error/25' : ''}
                            `}>
                              {code.paymentStatus}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            {code.paymentStatus === 'Aguardando avaliação' ? (
                              <button
                                onClick={() => alloc && handleOpenEvaluate(alloc.id)}
                                className="bg-status-error hover:bg-status-error-dark text-[var(--text-primary)] font-bold p-1 px-2 text-[10px] rounded-lg flex items-center gap-1 inline-flex shrink-0 shadow-xs"
                              >
                                <FilePenLine className="w-3.5 h-3.5" /> Avaliar & Desbloquear
                              </button>
                            ) : (
                              <span className="text-[11px] text-text-secondary italic">Fiscalizado</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive evaluation form */}
        {selectedAllocationId && selectedAlloc && selectedJob && selectedFreela && (
          <div className="xl:col-span-6 bg-white p-5 rounded-2xl border-2 border-status-error shadow-md space-y-4 text-xs animate-fade-in self-start">
            <div className="flex justify-between items-start border-b border-border-subtle pb-2.5">
              <div>
                <h4 className="font-bold text-text-primary text-sm flex items-center gap-1">
                  <Scale className="w-4 h-4 text-status-error" />
                  <span>Avaliação Final Weighted: {selectedFreela.name}</span>
                </h4>
                <p className="text-[10px] text-text-secondary mt-0.5">Campanha: {selectedJob.name} &bull; Função: {selectedJob.roleNeeded}</p>
              </div>
              <button onClick={() => setSelectedAllocationId(null)} className="text-text-secondary hover:text-text-primary font-bold text-lg">&times;</button>
            </div>

            <form onSubmit={handleSubmitEvaluation} className="space-y-4">
              {/* Score breakdown metrics */}
              <div className="space-y-3.5 bg-surface p-4 rounded-xl border border-border-subtle">
                <p className="text-[11px] text-text-secondary mb-2 flex justify-between font-bold">
                  <span>Critérios com Pesos de Governança Ponderados</span>
                  <span className="text-status-error">Média em tempo real: {calculatedWeightedScore()} ★</span>
                </p>

                {/* Criterion 1: Technical Quality */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-primary font-semibold">1. Qualidade Técnica (Peso 30%)</span>
                    <span className="font-medium text-text-secondary">{technicalQuality} / 5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.5"
                    value={technicalQuality}
                    onChange={(e) => setTechnicalQuality(Number(e.target.value))}
                    className="w-full accent-status-error"
                  />
                </div>

                {/* Criterion 2: Deadline Compliance */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-primary font-semibold">2. Cumprimento de Prazos (Peso 20%)</span>
                    <span className="font-medium text-text-secondary">{deadline} / 5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.5"
                    value={deadline}
                    onChange={(e) => setDeadline(Number(e.target.value))}
                    className="w-full accent-status-error"
                  />
                </div>

                {/* Criterion 3: Briefing Adherence */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-primary font-semibold">3. Aderência ao Briefing (Peso 15%)</span>
                    <span className="font-medium text-text-secondary">{briefingAdherence} / 5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.5"
                    value={briefingAdherence}
                    onChange={(e) => setBriefingAdherence(Number(e.target.value))}
                    className="w-full accent-status-error"
                  />
                </div>

                {/* Criterion 4: Communication */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-primary font-semibold">4. Comunicação Clara (Peso 15%)</span>
                    <span className="font-medium text-text-secondary">{communication} / 5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.5"
                    value={communication}
                    onChange={(e) => setCommunication(Number(e.target.value))}
                    className="w-full accent-status-error"
                  />
                </div>

                {/* Criterion 5: Autonomy */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-primary font-semibold">5. Autonomia Operacional (Peso 10%)</span>
                    <span className="font-medium text-text-secondary">{autonomy} / 5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.5"
                    value={autonomy}
                    onChange={(e) => setAutonomy(Number(e.target.value))}
                    className="w-full accent-status-error"
                  />
                </div>

                {/* Criterion 6: Behavior */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-text-primary font-semibold">6. Postura / Comportamento (Peso 10%)</span>
                    <span className="font-medium text-text-secondary">{behavior} / 5</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.5"
                    value={behavior}
                    onChange={(e) => setBehavior(Number(e.target.value))}
                    className="w-full accent-status-error"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Recomenda este profissional para futuros jobs da V3A? *</label>
                <select
                  value={recommendation}
                  onChange={(e: any) => setRecommendation(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white text-xs focus:outline-none focus:border-action-cyan"
                >
                  <option value="Sim">Sim, recomendo fortemente</option>
                  <option value="Sim, com restrição">Sim, com pequenas restrições</option>
                  <option value="Não">Não recomendo (Sinalizar restrição de compliance)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Anotações / Feedback Descritivo (Obrigatório) *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Forneça comentários sobre a postura, iniciativa e captação do briefing..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary text-xs focus:outline-none focus:border-action-cyan"
                />
              </div>

              <div className="flex justify-end gap-2 text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedAllocationId(null)}
                  className="border border-border-subtle p-1.5 px-3 rounded-lg hover:bg-surface font-semibold text-text-primary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-status-error hover:bg-status-error-dark text-[var(--text-primary)] font-bold p-1.5 px-4 rounded-lg shadow-sm"
                >
                  Confirmar Avaliação e Liberar Pagamento
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
