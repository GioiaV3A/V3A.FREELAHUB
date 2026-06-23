'use client';

import React, { useState, useMemo } from 'react';
import { DatabaseProps } from '@/app/page';
import { 
  Search, Filter, Calendar, Award, CheckCircle2, Sliders, 
  User, Building, Download, RotateCcw, XCircle, Info, 
  ChevronRight, AlertCircle, Check, X, CreditCard, Star
} from 'lucide-react';
import { 
  formatCurrencyBRL, 
  formatISODateToBR 
} from '@/lib/financial';
import ConsolidatedAllocation from '@/components/ConsolidatedAllocation';
import { supabase } from '@/lib/supabase';
import { 
  concludeAllocationAction, 
  cancelAllocationAction, 
  reopenAllocationAction 
} from '@/app/actions/admin';

export default function BookingsPanel({ db }: { db: DatabaseProps }) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  // Conclusion modal states
  const [concludeAllocId, setConcludeAllocId] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [checklist1, setChecklist1] = useState(false);
  const [checklist2, setChecklist2] = useState(false);
  const [checklist3, setChecklist3] = useState(false);

  const currentUser = db.currentUser;
  const isNucleoProfile = currentUser.profile === 'NÚCLEO';
  const myNucleoId = currentUser.nucleoId || (db.nucleos && db.nucleos[0]?.id);

  // Handle selectedJobId redirect from page context if selectedJobId is in db state
  React.useEffect(() => {
    if (db.selectedJobId) {
      // If the selected job has an allocation, show details
      const alloc = db.allocations.find(a => a.jobId === db.selectedJobId && a.status !== 'Cancelado');
      if (alloc) {
        setSelectedJobId(db.selectedJobId);
      }
      // Reset selected job ID in DB context to avoid infinite loop redirect
      if (db.setSelectedJobId) {
        db.setSelectedJobId(null);
      }
    }
  }, [db.selectedJobId, db.allocations, db.setSelectedJobId]);

  // Filter bookings based on permissions and status/search query
  const filteredBookings = useMemo(() => {
    return db.allocations.filter(alloc => {
      // 1. Nucleus filter
      if (isNucleoProfile && myNucleoId && alloc.nucleoId !== myNucleoId) {
        return false;
      }

      const freelancer = db.freelancers.find(f => f.id === alloc.freelancerId);
      const job = db.jobs.find(j => j.id === alloc.jobId);
      const nucleo = db.nucleos.find(n => n.id === alloc.nucleoId);

      const freelancerName = freelancer?.name?.toLowerCase() || '';
      const jobName = job?.name?.toLowerCase() || '';
      const clientName = job?.client?.toLowerCase() || '';
      const nucleoName = nucleo?.name?.toLowerCase() || '';
      const allocCode = alloc.allocationCode?.toLowerCase() || '';

      const query = searchQuery.toLowerCase();

      // 2. Search match
      const matchesSearch = 
        freelancerName.includes(query) ||
        jobName.includes(query) ||
        clientName.includes(query) ||
        nucleoName.includes(query) ||
        allocCode.includes(query);

      if (!matchesSearch) return false;

      // 3. Status filter matching
      const statusUi = alloc.status; // Pendente, Ativo, Concluído, Pago, Cancelado, etc.
      if (statusFilter === 'all') return true;
      if (statusFilter === 'pending') return statusUi === 'Pendente';
      if (statusFilter === 'active') return statusUi === 'Ativo';
      if (statusFilter === 'completed') return statusUi === 'Concluído';
      if (statusFilter === 'cancelled') return statusUi === 'Cancelado';
      if (statusFilter === 'pending_evaluation') {
        return alloc.evaluationStatus === 'available' && (!alloc.evaluatedFreelancer || !alloc.evaluatedDelivery);
      }
      if (statusFilter === 'pending_payment') {
        const schedules = db.paymentSchedules.filter(s => s.allocationId === alloc.id);
        const hasPending = schedules.some(s => s.status === 'pending');
        return hasPending;
      }

      return true;
    });
  }, [db.allocations, db.freelancers, db.jobs, db.nucleos, db.paymentSchedules, searchQuery, statusFilter, isNucleoProfile, myNucleoId]);

  const handleOpenConcludeModal = (allocId: string) => {
    setConcludeAllocId(allocId);
    setCompletionNotes('');
    setChecklist1(false);
    setChecklist2(false);
    setChecklist3(false);
  };

  const handleConcludeJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checklist1 || !checklist2 || !checklist3) {
      alert('Por favor, confirme todos os itens do checklist antes de concluir.');
      return;
    }

    if (!concludeAllocId) return;

    setLoadingActionId(concludeAllocId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';
      if (!token) return;

      const res = await concludeAllocationAction(token, concludeAllocId, completionNotes);
      if (!res.success) {
        alert(`❌ Erro ao concluir job: ${res.error}`);
        return;
      }

      alert('✅ Job operacionalmente concluído com sucesso! As avaliações e a timeline foram liberadas.');
      setConcludeAllocId(null);
      await db.reloadDatabase();
    } catch (err: any) {
      alert(`❌ Erro: ${err.message}`);
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleCancelBooking = async (allocId: string) => {
    if (!window.confirm('Tem certeza que deseja CANCELAR este booking? Esta ação alterará os status do job e do freelancer.')) {
      return;
    }

    setLoadingActionId(allocId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';
      if (!token) return;

      const res = await cancelAllocationAction(token, allocId);
      if (!res.success) {
        alert(`❌ Erro ao cancelar booking: ${res.error}`);
        return;
      }

      alert('✅ Booking cancelado com sucesso.');
      await db.reloadDatabase();
    } catch (err: any) {
      alert(`❌ Erro: ${err.message}`);
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleReopenBooking = async (allocId: string) => {
    if (!window.confirm('Deseja REABRIR este booking concluído/cancelado?')) {
      return;
    }

    setLoadingActionId(allocId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';
      if (!token) return;

      const res = await reopenAllocationAction(token, allocId);
      if (!res.success) {
        alert(`❌ Erro ao reabrir booking: ${res.error}`);
        return;
      }

      alert('✅ Booking reaberto com sucesso.');
      await db.reloadDatabase();
    } catch (err: any) {
      alert(`❌ Erro: ${err.message}`);
    } finally {
      setLoadingActionId(null);
    }
  };

  // Render detail view if selectedJobId is set
  if (selectedJobId) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-border-subtle shadow-xs">
          <button 
            onClick={() => setSelectedJobId(null)}
            className="bg-bg-panel hover:bg-bg-hover text-sidebar-navy dark:text-action-cyan font-bold p-2 px-4 rounded-xl text-xs border border-border-subtle shadow-xs transition flex items-center gap-2 cursor-pointer"
          >
            &larr; Voltar para Meus Bookings
          </button>
          
          <div className="flex gap-2">
            {/* Quick conclude action directly from top details header if applicable */}
            {(() => {
              const alloc = db.allocations.find(a => a.jobId === selectedJobId && a.status !== 'Cancelado');
              if (alloc && ['Pendente', 'Ativo'].includes(alloc.status)) {
                return (
                  <button
                    onClick={() => handleOpenConcludeModal(alloc.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Concluir Execução do Job</span>
                  </button>
                );
              }
              return null;
            })()}
          </div>
        </div>

        <ConsolidatedAllocation db={db} jobId={selectedJobId} />

        {/* Conclusion Modal (rendered over details view too if clicked) */}
        {concludeAllocId && renderConcludeModal()}
      </div>
    );
  }

  return (
    <div id="bookings-panel-container" className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex md:flex-row flex-col justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <span>Meus Bookings e Alocações</span>
          </h2>
          <p className="text-xs text-text-secondary">Acompanhe, conclua e audite as contratações e tranches financeiras de freelancers.</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-border-subtle p-4 rounded-2xl shadow-xs grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-8 relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Pesquise por freelancer, job, cliente, código de alocação..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container border border-border-subtle pl-10 pr-4 py-2.5 rounded-xl text-xs focus:outline-none focus:border-action-cyan text-text-primary placeholder:text-text-muted"
          />
        </div>

        <div className="md:col-span-4 flex gap-2">
          <div className="w-full relative">
            <Filter className="absolute left-3 top-3 w-3.5 h-3.5 text-text-muted" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-surface-container border border-border-subtle pl-9 pr-3 py-2.5 rounded-xl text-xs focus:outline-none focus:border-action-cyan text-text-primary appearance-none cursor-pointer"
            >
              <option value="all">Todos os Status</option>
              <option value="pending">Aguardando Início (Pendente)</option>
              <option value="active">Em Execução (Ativo)</option>
              <option value="completed">Concluídos</option>
              <option value="cancelled">Cancelados</option>
              <option value="pending_evaluation">Pendentes de Avaliação</option>
              <option value="pending_payment">Com Faturamentos Pendentes</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bookings List Table */}
      <div className="bg-white dark:bg-slate-900 border border-border-subtle rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          {filteredBookings.length === 0 ? (
            <div className="p-12 text-center text-text-secondary text-xs italic space-y-2">
              <Calendar className="w-10 h-10 mx-auto text-text-muted opacity-50" />
              <p>Nenhuma alocação ou booking encontrado correspondente aos filtros.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-surface font-semibold text-text-secondary border-b border-border-subtle">
                <tr>
                  <th className="px-4 py-3">ALOC / PROJETO</th>
                  <th className="px-4 py-3">FREELANCER</th>
                  <th className="px-4 py-3">PERÍODO</th>
                  <th className="px-4 py-3">MODELO & VALOR</th>
                  <th className="px-4 py-3 text-center">PAGAMENTOS</th>
                  <th className="px-4 py-3 text-center">AVALIAÇÃO</th>
                  <th className="px-4 py-3 text-center">STATUS OPERACIONAL</th>
                  <th className="px-4 py-3 text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredBookings.map((alloc) => {
                  const freelancer = db.freelancers.find(f => f.id === alloc.freelancerId);
                  const job = db.jobs.find(j => j.id === alloc.jobId);
                  const nucleo = db.nucleos.find(n => n.id === alloc.nucleoId);
                  
                  const isPending = alloc.status === 'Pendente';
                  const isActive = alloc.status === 'Ativo';
                  const isCompleted = alloc.status === 'Concluído';
                  const isCancelled = alloc.status === 'Cancelado';

                  // Checks evaluation status
                  const evalCount = (alloc.evaluatedFreelancer ? 1 : 0) + (alloc.evaluatedDelivery ? 1 : 0);

                  return (
                    <tr key={alloc.id} className="hover:bg-surface-container-low transition-colors">
                      {/* Allocation code and Job Info */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-sidebar-navy dark:text-action-cyan bg-bg-panel border border-border-subtle px-1.5 py-0.5 rounded">
                            {alloc.allocationCode || 'PENDENTE'}
                          </span>
                        </div>
                        <p className="font-bold text-text-primary text-xs mt-1 truncate max-w-[200px]">{job?.name || 'Projeto'}</p>
                        <p className="text-[10px] text-text-secondary">{job?.client} &bull; {nucleo?.name}</p>
                      </td>

                      {/* Freelancer details */}
                      <td className="px-4 py-3.5 text-text-primary">
                        <p className="font-bold">{freelancer?.name || 'Profissional'}</p>
                        <p className="text-[10px] text-text-secondary">{freelancer?.mainRole || 'Função'}</p>
                      </td>

                      {/* Period */}
                      <td className="px-4 py-3.5 text-text-secondary font-medium">
                        {formatISODateToBR(alloc.startDate)} a {formatISODateToBR(alloc.endDate)}
                      </td>

                      {/* Payment Model and Rate */}
                      <td className="px-4 py-3.5 font-medium">
                        <p className="text-text-primary font-bold">
                          {formatCurrencyBRL(alloc.totalContractValue || alloc.approvedValue)}
                        </p>
                        <span className="text-[10px] text-text-secondary uppercase">
                          {alloc.paymentModel === 'monthly_recurring' ? 'Mensal' : 'Job Único'}
                        </span>
                      </td>

                      {/* Payment Status Check */}
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                          (alloc.paymentRequestStatus as any) === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400'
                            : (alloc.paymentRequestStatus as any) === 'exported'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-150 text-slate-700 border-slate-200'
                        }`}>
                          <CreditCard className="w-3 h-3" />
                          {(alloc.paymentRequestStatus as any) === 'paid' ? 'Pago' :
                           (alloc.paymentRequestStatus as any) === 'exported' ? 'Exportado' : 'Aguardando'}
                        </span>
                      </td>

                      {/* Evaluation status */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex flex-col items-center justify-center">
                          {alloc.evaluationStatus === 'locked' ? (
                            <span className="text-[9px] text-text-muted">Aguardando Pgto</span>
                          ) : (
                            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold border ${
                              evalCount === 2
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-250'
                            }`}>
                              <Star className={`w-2.5 h-2.5 ${evalCount === 2 ? 'fill-emerald-600' : 'fill-amber-600 text-amber-600'}`} />
                              {evalCount}/2 Env.
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Operational status */}
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border
                          ${isPending ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                          ${isActive ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                          ${isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
                          ${isCancelled ? 'bg-red-50 text-red-700 border-red-200' : ''}
                        `}>
                          {alloc.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right space-x-1.5">
                        {/* 1. Ver Detalhes */}
                        <button
                          onClick={() => setSelectedJobId(alloc.jobId)}
                          className="bg-primary/10 border border-primary/20 text-sidebar-navy hover:bg-action-cyan hover:text-white hover:border-action-cyan font-bold p-1.5 px-2.5 rounded-lg text-[10px] transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          Detalhes
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>

                        {/* 2. Concluir Job */}
                        {(isPending || isActive) && (currentUser.profile === 'MASTER' || currentUser.profile === 'C-LEVEL' || (isNucleoProfile && myNucleoId === alloc.nucleoId)) && (
                          <button
                            disabled={loadingActionId === alloc.id}
                            onClick={() => handleOpenConcludeModal(alloc.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-extrabold p-1.5 px-2.5 rounded-lg text-[10px] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Concluir Job
                          </button>
                        )}

                        {/* 3. Administrative Override: Cancel/Reopen */}
                        {(currentUser.profile === 'MASTER' || currentUser.profile === 'C-LEVEL' || (isNucleoProfile && myNucleoId === alloc.nucleoId)) && (
                          <>
                            {isCompleted && (
                              <button
                                disabled={loadingActionId === alloc.id}
                                onClick={() => handleReopenBooking(alloc.id)}
                                className="bg-slate-750 hover:bg-slate-650 disabled:opacity-40 text-white font-bold p-1.5 px-2.5 rounded-lg text-[10px] transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Reabrir
                              </button>
                            )}

                            {(isPending || isActive) && (
                              <button
                                disabled={loadingActionId === alloc.id}
                                onClick={() => handleCancelBooking(alloc.id)}
                                className="bg-red-50 hover:bg-red-100 text-status-error font-bold p-1.5 px-2.5 rounded-lg text-[10px] border border-status-error/30 transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <XCircle className="w-3 h-3" />
                                Cancelar
                              </button>
                            )}
                          </>
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

      {/* Concluir Job Confirmation Modal */}
      {concludeAllocId && renderConcludeModal()}
    </div>
  );

  // Helper render function for modal
  function renderConcludeModal() {
    const alloc = db.allocations.find(a => a.id === concludeAllocId);
    const freelancer = db.freelancers.find(f => f.id === alloc?.freelancerId);
    const job = db.jobs.find(j => j.id === alloc?.jobId);

    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
        <div className="absolute inset-0" onClick={() => setConcludeAllocId(null)} />
        <div className="relative w-full max-w-lg bg-bg-surface border border-border-subtle rounded-3xl p-6 shadow-2xl space-y-4 animate-scale-in z-10 text-xs">
          
          <div className="flex justify-between items-start border-b border-border-subtle pb-3">
            <div>
              <h3 className="font-extrabold text-text-primary text-base flex items-center gap-1.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Confirmar Conclusão Operacional do Job</span>
              </h3>
              <p className="text-[11px] text-text-secondary mt-0.5">Esta ação mudará o status do job para concluído e liberará a etapa de avaliações.</p>
            </div>
            <button 
              onClick={() => setConcludeAllocId(null)}
              className="p-1 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Job details box */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-border-subtle space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-text-secondary uppercase font-semibold">Campanha / Cliente</span>
                <p className="font-bold text-text-primary text-xs truncate">{job?.name} ({job?.client})</p>
              </div>
              <div>
                <span className="text-[10px] text-text-secondary uppercase font-semibold">Freelancer Alocado</span>
                <p className="font-bold text-text-primary text-xs truncate">{freelancer?.name}</p>
              </div>
              <div className="col-span-2 pt-1.5 border-t border-dashed border-border-subtle">
                <span className="text-[10px] text-text-secondary uppercase font-semibold">Período de Execução</span>
                <p className="font-bold text-text-primary">
                  {alloc?.startDate ? formatISODateToBR(alloc.startDate) : '—'} a {alloc?.endDate ? formatISODateToBR(alloc.endDate) : '—'}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleConcludeJobSubmit} className="space-y-4 pt-1">
            {/* Checklist of deliverables */}
            <div className="space-y-2.5">
              <span className="font-bold text-[11px] text-text-primary uppercase tracking-wider block">Checklist de Entregáveis obrigatórios</span>
              
              <label className="flex items-start gap-3 p-3 rounded-xl border border-border-subtle hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist1}
                  onChange={(e) => setChecklist1(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-border-strong cursor-pointer"
                />
                <div>
                  <strong className="text-text-primary font-bold">Entrega completa dos materiais</strong>
                  <p className="text-[10px] text-text-secondary mt-0.5">O freelancer carregou e entregou todos os arquivos, peças e entregáveis definidos no escopo do job.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-border-subtle hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist2}
                  onChange={(e) => setChecklist2(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-border-strong cursor-pointer"
                />
                <div>
                  <strong className="text-text-primary font-bold">Validação técnica efetuada</strong>
                  <p className="text-[10px] text-text-secondary mt-0.5">A liderança técnica do núcleo validou a qualidade final do trabalho executado.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-border-subtle hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist3}
                  onChange={(e) => setChecklist3(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-border-strong cursor-pointer"
                />
                <div>
                  <strong className="text-text-primary font-bold">Liberação de faturamento operacional</strong>
                  <p className="text-[10px] text-text-secondary mt-0.5">Autorizo a emissão/registro das solicitações de pagamento restantes para o financeiro.</p>
                </div>
              </label>
            </div>

            {/* Notes final text */}
            <div className="space-y-1.5">
              <label className="font-bold text-[11px] text-text-primary uppercase tracking-wider block">Observações e Notas Finais de Conclusão</label>
              <textarea
                rows={3}
                placeholder="Insira detalhes sobre a performance, atrasos ou notas relevantes da conclusão da demanda..."
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                className="w-full bg-surface-container border border-border-subtle p-3 rounded-xl focus:outline-none focus:border-action-cyan text-text-primary"
              />
            </div>

            {/* Submit / Cancel Buttons */}
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setConcludeAllocId(null)}
                className="bg-bg-panel hover:bg-bg-hover text-text-secondary border border-border-subtle font-bold px-4 py-2.5 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!checklist1 || !checklist2 || !checklist3 || loadingActionId !== null}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-5 py-2.5 rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                {loadingActionId === concludeAllocId ? (
                  <Sliders className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Confirmar Conclusão</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}
