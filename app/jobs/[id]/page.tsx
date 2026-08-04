'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { simulatePaymentProjections } from '@/lib/financial';
import { 
  mapJobToUI, 
  mapCandidateStatusToUI, 
  mapBillingTypeToUI, 
  mapNegotiationStatusToUI,
  mapAllocationStatusToUI,
  mapPaymentStatusToUI
} from '@/lib/dbMapper';
import { 
  Briefcase, 
  ChevronLeft, 
  Calendar, 
  DollarSign, 
  Users, 
  Award, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Scale, 
  Layers,
  FileCheck
} from 'lucide-react';

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [job, setJob] = useState<any>(null);
  const [shortlist, setShortlist] = useState<any[]>([]);
  const [negotiations, setNegotiations] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [paymentCodes, setPaymentCodes] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [successFee, setSuccessFee] = useState<any>(null);
  const [updatingOutcome, setUpdatingOutcome] = useState(false);
  const [outcomeStatus, setOutcomeStatus] = useState<string>('pending');
  const [outcomeNotes, setOutcomeNotes] = useState<string>('');

  useEffect(() => {
    if (successFee) {
      setOutcomeStatus(successFee.status || 'pending');
      setOutcomeNotes(successFee.notes || '');
    }
  }, [successFee]);

  const handleUpdateSuccessFeeOutcome = async () => {
    if (!successFee) return;
    setUpdatingOutcome(true);
    try {
      const { error } = await supabase
        .from('allocation_success_fees')
        .update({
          status: outcomeStatus,
          notes: outcomeNotes,
          achieved_at: ['achieved', 'paid'].includes(outcomeStatus) ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', successFee.id);

      if (error) {
        alert(`❌ Erro ao atualizar resultado: ${error.message}`);
        return;
      }

      alert('✅ Resultado da Success Fee atualizado com sucesso!');
      setSuccessFee((prev: any) => ({
        ...prev,
        status: outcomeStatus,
        notes: outcomeNotes,
        achieved_at: ['achieved', 'paid'].includes(outcomeStatus) ? new Date().toISOString() : null
      }));
    } catch (err: any) {
      alert(`❌ Erro: ${err.message}`);
    } finally {
      setUpdatingOutcome(false);
    }
  };

  const [origin, setOrigin] = useState<string>('');
  const [allocationId, setAllocationId] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      setOrigin(searchParams.get('origin') || '');
      setAllocationId(searchParams.get('allocationId') || '');
    }
  }, []);

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/?tab=Timeline de Alocações');
    }
  };

  useEffect(() => {
    if (!id) return;

    const fetchJobDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch freelancer request (Job Opportunity)
        let { data: reqData, error: reqErr } = await supabase
          .from('job_freelancer_requests')
          .select(`
            *,
            jobs (
              *,
              nucleos (*)
            ),
            freela_functions (*)
          `)
          .eq('id', id)
          .maybeSingle();

        // If not found by request_id, try by job_id (e.g. when navigated from timeline alloc.job_id)
        if (!reqData && !reqErr) {
          const { data: altData, error: altErr } = await supabase
            .from('job_freelancer_requests')
            .select(`
              *,
              jobs (
                *,
                nucleos (*)
              ),
              freela_functions (*)
            `)
            .eq('job_id', id)
            .maybeSingle();
          reqData = altData;
          reqErr = altErr;
        }

        if (reqErr) {
          console.error('Error fetching request:', reqErr);
          setError('Oportunidade não encontrada ou erro no banco de dados.');
          setLoading(false);
          return;
        }

        if (!reqData) {
          setError('Oportunidade não encontrada.');
          setLoading(false);
          return;
        }

        const mappedJob = mapJobToUI(reqData);
        setJob({
          ...mappedJob,
          nucleoName: reqData.jobs?.nucleos?.name || 'Sem núcleo',
          jobCode: reqData.jobs?.job_code || 'JOB-—',
          requestCode: reqData.request_code || 'REQ-—',
        });

        // 2. Fetch Shortlist Candidates using resolved request_id
        const { data: dbShortlist, error: slErr } = await supabase
          .from('shortlist_candidates')
          .select('*, freelancers(*)')
          .eq('request_id', reqData.id);

        if (slErr) console.error('Error fetching shortlist:', slErr);
        else setShortlist(dbShortlist || []);

        // 3. Fetch Negotiations using resolved request_id
        const { data: dbNegs, error: negErr } = await supabase
          .from('negotiations')
          .select('*, freelancers(*)')
          .eq('request_id', reqData.id);

        if (negErr) console.error('Error fetching negotiations:', negErr);
        else setNegotiations(dbNegs || []);

        // 4. Fetch Allocations using resolved job_id
        const { data: dbAllocs, error: allocErr } = await supabase
          .from('allocations')
          .select('*, freelancers(*)')
          .eq('job_id', reqData.job_id);

        if (allocErr) console.error('Error fetching allocations:', allocErr);
        else {
          setAllocations(dbAllocs || []);
          if (dbAllocs && dbAllocs.length > 0) {
            const { data: dbAllocFees, error: feeErr } = await supabase
              .from('allocation_success_fees')
              .select('*')
              .eq('allocation_id', dbAllocs[0].id)
              .maybeSingle();
            if (feeErr) console.error('Error fetching success fee details:', feeErr);
            else setSuccessFee(dbAllocFees);
          }
        }

        // 5. Fetch Payment Codes using resolved job_id
        const { data: dbPayments, error: payErr } = await supabase
          .from('payment_codes')
          .select('*, freelancers(*)')
          .eq('job_id', reqData.job_id);

        if (payErr) console.error('Error fetching payment codes:', payErr);
        else setPaymentCodes(dbPayments || []);

        // 6. Fetch Evaluations using resolved job_id
        const { data: dbEvals, error: evalErr } = await supabase
          .from('evaluations')
          .select('*, freelancers(*)')
          .eq('job_id', reqData.job_id);

        if (evalErr) console.error('Error fetching evaluations:', evalErr);
        else setEvaluations(dbEvals || []);

      } catch (err: any) {
        console.error('Unexpected error fetching details:', err);
        setError(err.message || 'Erro ao carregar detalhes.');
      } finally {
        setLoading(false);
      }
    };

    fetchJobDetails();
  }, [id]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    const parts = dateString.split('-');
    if (parts.length < 3) return dateString;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const calculateDailyAverage = (budget: number, start: string, end: string) => {
    if (!start || !end) return budget;
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return budget;
    const diffTime = Math.abs(e.getTime() - s.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? budget / diffDays : budget;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-app flex flex-col items-center justify-center text-text-primary p-6">
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-accent animate-spin" />
          <span className="text-sm font-bold">Carregando detalhes da oportunidade...</span>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-bg-app flex flex-col items-center justify-center text-text-primary p-6 space-y-4">
        <div className="flex items-center gap-2 text-status-error">
          <AlertTriangle className="w-6 h-6" />
          <span className="text-sm font-bold">{error || 'Erro ao carregar o job.'}</span>
        </div>
        <button
          onClick={() => router.push('/?tab=Timeline de Alocações')}
          className="bg-bg-surface border border-border-subtle p-2.5 px-4 rounded-xl text-xs hover:bg-bg-hover text-text-primary transition font-bold"
        >
          Voltar para a Timeline
        </button>
      </div>
    );
  }

  const dailyAvg = calculateDailyAverage(job.budget, job.startDate, job.endDate);

  return (
    <div className="min-h-screen bg-bg-app text-text-primary p-4 md:p-8 space-y-6">
      
      {/* HEADER CONTROLS */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {origin === 'timeline' && allocationId ? (
            <button
              onClick={() => router.push(`/?tab=Timeline de Alocações&highlightAllocationId=${allocationId}`)}
              className="flex items-center gap-2 bg-bg-surface hover:bg-bg-hover text-text-secondary hover:text-text-primary border border-border-subtle p-2.5 px-4 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Voltar para a Alocação</span>
            </button>
          ) : (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 bg-bg-surface hover:bg-bg-hover text-text-secondary hover:text-text-primary border border-border-subtle p-2.5 px-4 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Voltar para a Timeline</span>
            </button>
          )}

          {allocations.length > 0 && (
            <button
              onClick={() => {
                const targetCode = allocations[0]?.allocation_code;
                router.push(`/?tab=Timeline de Alocações&highlightAllocationId=${targetCode}`);
              }}
              className="flex items-center gap-2 bg-bg-surface hover:bg-bg-hover text-text-secondary hover:text-text-primary border border-border-subtle p-2.5 px-4 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <span>Ver Alocação</span>
            </button>
          )}

          <button
            onClick={() => router.push('/?tab=Timeline de Alocações')}
            className="flex items-center gap-2 bg-bg-surface hover:bg-bg-hover text-text-secondary hover:text-text-primary border border-border-subtle p-2.5 px-4 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <span>Ver na Timeline</span>
          </button>

          <button
            onClick={() => router.push(`/shortlist/${id}`)}
            className="flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-slate-900 p-2.5 px-4 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <span>Visualizar histórico do Workflow</span>
          </button>
        </div>

        <div className="text-xs text-text-secondary">
          Plataforma &bull; Timeline de Alocações &bull; <strong className="text-text-primary uppercase font-extrabold">Detalhes do Job</strong>
        </div>
      </div>

      {/* GENERAL JOB DETAILS CARD */}
      <div className="bg-bg-surface rounded-2xl border border-border-subtle p-6 shadow-xs grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-bg-panel border border-border-subtle text-text-secondary text-[10px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider">
              {job.jobCode}
            </span>
            <span className="bg-[#0F2342] text-slate-900 text-[10px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider">
              {job.requestCode}
            </span>
            <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${
              job.status === 'Bookado' ? 'bg-success-bg text-success-text border-success-border/20' : 
              job.status === 'Em andamento' ? 'bg-info-bg text-info-text border-info-border/20' :
              'bg-warning-bg text-warning-text border-warning-border/20'
            }`}>
              {job.status}
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-tight text-text-primary">{job.name}</h1>
            <p className="text-xs text-text-secondary mt-1">
              Cliente: <strong className="text-text-primary font-bold">{job.client}</strong> &bull; Núcleo: <strong className="text-text-primary font-bold">{job.nucleoName}</strong>
            </p>
          </div>

          <div className="border-t border-border-subtle pt-4 space-y-2">
            <h3 className="text-sm font-bold text-text-primary">Descrição e Escopo</h3>
            <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">{job.description || 'Nenhuma descrição detalhada inserida.'}</p>
          </div>

          {job.deliverables && (
            <div className="border-t border-border-subtle pt-4 space-y-2">
              <h3 className="text-sm font-bold text-text-primary">Entregáveis Esperados</h3>
              <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">{job.deliverables}</p>
            </div>
          )}
        </div>

        {/* METADATA SIDEBAR */}
        <div className="bg-bg-panel border border-border-subtle p-5 rounded-xl space-y-4 self-start">
          <h3 className="text-xs font-black uppercase tracking-wider text-text-primary border-b border-border-subtle pb-2">Requisitos e Orçamento</h3>
          
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Função Requerida:</span>
              <span className="font-bold text-text-primary">{job.roleNeeded}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Senioridade:</span>
              <span className="font-bold text-text-primary">{job.seniorityNeeded}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Urgência:</span>
              <span className={`font-bold p-1 px-2.5 rounded-lg text-[10px] ${
                job.urgency === 'Alta' ? 'bg-danger-bg text-danger-text border border-danger-border/20' : 'bg-success-bg text-success-text'
              }`}>
                {job.urgency}
              </span>
            </div>

            <div className="border-t border-border-subtle/60 my-2"></div>

            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Início:</span>
              <span className="font-bold text-text-primary">{formatDate(job.startDate)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Término:</span>
              <span className="font-bold text-text-primary">{formatDate(job.endDate)}</span>
            </div>

            <div className="border-t border-border-subtle/60 my-2"></div>

            <div className="flex justify-between items-center">
              <span className="text-text-secondary flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-text-muted" /> Budget Máximo:
              </span>
              <span className="font-extrabold text-text-primary">{formatCurrency(job.budget)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-text-muted" /> Média de Diária:
              </span>
              <span className="font-bold text-text-primary">{formatCurrency(dailyAvg)}/dia</span>
            </div>
          </div>
        </div>

      </div>

      {/* SHORTLIST CANDIDATES SECTION */}
      <div className="bg-bg-surface rounded-2xl border border-border-subtle p-6 shadow-xs space-y-4">
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <Users className="w-5 h-5 text-accent" />
          <span>Profissionais na Shortlist ({shortlist.length})</span>
        </h2>

        {shortlist.length === 0 ? (
          <p className="text-xs text-text-secondary italic">Nenhum profissional selecionado para esta shortlist.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border-subtle bg-bg-panel">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-table-header-bg text-table-header-text">
                  <th className="p-3 font-semibold uppercase tracking-wider">Freelancer</th>
                  <th className="p-3 font-semibold uppercase tracking-wider">Função principal</th>
                  <th className="p-3 font-semibold uppercase tracking-wider">Senioridade</th>
                  <th className="p-3 font-semibold uppercase tracking-wider">Status na vaga</th>
                  <th className="p-3 font-semibold uppercase tracking-wider">Cidade / Estado</th>
                  <th className="p-3 font-semibold uppercase tracking-wider">Observações do RH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {shortlist.map((cand) => (
                  <tr key={cand.id} className="hover:bg-bg-hover transition-colors">
                    <td className="p-3 font-bold text-text-primary">{cand.freelancers?.full_name || '—'}</td>
                    <td className="p-3 text-text-secondary">{cand.freelancers?.main_function?.name || '—'}</td>
                    <td className="p-3 text-text-secondary">{cand.freelancers?.seniority || '—'}</td>
                    <td className="p-3">
                      <span className={`p-1 px-2.5 rounded-lg text-[10px] font-bold ${
                        cand.candidate_status === 'aprovado_rh' ? 'bg-success-bg text-success-text' :
                        cand.candidate_status === 'selecionado' ? 'bg-info-bg text-info-text' :
                        'bg-warning-bg text-warning-text'
                      }`}>
                        {mapCandidateStatusToUI(cand.candidate_status)}
                      </span>
                    </td>
                    <td className="p-3 text-text-secondary">{cand.freelancers?.city || '—'} / {cand.freelancers?.state || '—'}</td>
                    <td className="p-3 text-text-muted italic truncate max-w-[200px]">{cand.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* NEGOTIATIONS HISTORY SECTION */}
      <div className="bg-bg-surface rounded-2xl border border-border-subtle p-6 shadow-xs space-y-4">
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <Scale className="w-5 h-5 text-accent" />
          <span>Histórico de Negociações ({negotiations.length})</span>
        </h2>

        {negotiations.length === 0 ? (
          <p className="text-xs text-text-secondary italic">Nenhuma negociação registrada para este job.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border-subtle bg-bg-panel">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-table-header-bg text-table-header-text">
                  <th className="p-3 font-semibold uppercase tracking-wider">Freelancer</th>
                  <th className="p-3 font-semibold uppercase tracking-wider">Valor Proposto</th>
                  <th className="p-3 font-semibold uppercase tracking-wider">Tipo de cobrança</th>
                  <th className="p-3 font-semibold uppercase tracking-wider">Status aprovação</th>
                  <th className="p-3 font-semibold uppercase tracking-wider">Justificativa Acima do Teto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {negotiations.map((neg) => (
                  <tr key={neg.id} className="hover:bg-bg-hover transition-colors">
                    <td className="p-3 font-bold text-text-primary">{neg.freelancers?.full_name || '—'}</td>
                    <td className="p-3 font-bold text-text-primary">{formatCurrency(neg.negotiated_value)}</td>
                    <td className="p-3 text-text-secondary">{mapBillingTypeToUI(neg.billing_type)}</td>
                    <td className="p-3">
                      <span className={`p-1 px-2.5 rounded-lg text-[10px] font-bold ${
                        neg.status === 'aprovado_rh' ? 'bg-success-bg text-success-text' : 'bg-warning-bg text-warning-text'
                      }`}>
                        {mapNegotiationStatusToUI(neg.status, neg.is_above_policy)}
                      </span>
                    </td>
                    <td className="p-3 text-text-secondary italic whitespace-pre-line max-w-[300px]">{neg.exception_justification || 'Dentro do limite contratual.'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ALLOCATIONS & PAYMENT CODES SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Allocations */}
        <div className="bg-bg-surface rounded-2xl border border-border-subtle p-6 shadow-xs space-y-4">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Layers className="w-5 h-5 text-accent" />
            <span>Alocações Consolidadas ({allocations.length})</span>
          </h2>

          {allocations.length === 0 ? (
            <p className="text-xs text-text-secondary italic">Nenhum profissional alocado no Gantt operacional.</p>
          ) : (
            <div className="space-y-4">
              {allocations.map((alloc) => (
                <div key={alloc.id} className="p-4 bg-bg-panel border border-border-subtle rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-text-primary">{alloc.freelancers?.full_name}</span>
                    <span className="font-mono text-[10px] font-bold text-accent bg-accent-soft border border-accent/20 px-2 py-0.5 rounded-lg">
                      {alloc.allocation_code}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <p className="text-text-secondary">Período: <strong className="text-text-primary font-bold">{formatDate(alloc.start_date)} a {formatDate(alloc.end_date)}</strong></p>
                    <p className="text-text-secondary">Taxa diária: <strong className="text-text-primary font-bold">{formatCurrency(alloc.approved_value)}</strong></p>
                    <p className="text-text-secondary col-span-2">
                      Status da alocação: &nbsp;
                      <span className={`p-0.5 px-2 rounded-lg text-[10px] font-bold ${
                        alloc.status === 'em_andamento' ? 'bg-success-bg text-success-text' : 'bg-warning-bg text-warning-text'
                      }`}>
                        {mapAllocationStatusToUI(alloc.status)}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Codes */}
        <div className="bg-bg-surface rounded-2xl border border-border-subtle p-6 shadow-xs space-y-4">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-accent" />
            <span>Códigos de Faturamento ({paymentCodes.length})</span>
          </h2>

          {paymentCodes.length === 0 ? (
            <p className="text-xs text-text-secondary italic">Nenhum código de faturamento gerado para esta oportunidade.</p>
          ) : (
            <div className="space-y-4">
              {paymentCodes.map((pay) => (
                <div key={pay.id} className="p-4 bg-bg-panel border border-border-subtle rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-text-primary">{pay.freelancers?.full_name}</span>
                    <span className="font-mono text-[10px] font-bold text-slate-900 bg-[#0F2342] px-2 py-0.5 rounded-lg">
                      {pay.allocation_code}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <p className="text-text-secondary">Valor aprovado para pagamento: <strong className="text-text-primary font-bold">{formatCurrency(pay.approved_value)}</strong></p>
                    <p className="text-text-secondary">
                      Faturamento: &nbsp;
                      <span className="text-text-primary font-bold">{mapPaymentStatusToUI(pay.payment_status)}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* EVALUATIONS HISTORICAL RECORD SECTION */}
      <div className="bg-bg-surface rounded-2xl border border-border-subtle p-6 shadow-xs space-y-4">
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <Award className="w-5 h-5 text-accent" />
          <span>Avaliações de Desempenho Relacionadas ({evaluations.length})</span>
        </h2>

        {evaluations.length === 0 ? (
          <p className="text-xs text-text-secondary italic">Nenhuma avaliação cadastrada após a entrega operacional.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {evaluations.map((ev) => (
              <div key={ev.id} className="p-5 bg-bg-panel border border-border-subtle rounded-xl space-y-3">
                <div className="flex justify-between items-center border-b border-border-subtle/50 pb-2">
                  <span className="font-bold text-text-primary">{ev.freelancers?.full_name || 'Freelancer'}</span>
                  <div className="flex items-center gap-1 bg-success-bg px-2.5 py-0.5 rounded-lg border border-success-border/20">
                    <Award className="w-3.5 h-3.5 text-success-text" />
                    <span className="text-success-text font-extrabold text-xs">{Number(ev.final_score).toFixed(1)} / 5.0</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px] text-text-secondary">
                  <div>Técnico: <strong className="text-text-primary">{ev.technical_quality}.0</strong></div>
                  <div>Prazos: <strong className="text-text-primary">{ev.deadline}.0</strong></div>
                  <div>Briefing: <strong className="text-text-primary">{ev.briefing_adherence}.0</strong></div>
                  <div>Comunicação: <strong className="text-text-primary">{ev.communication}.0</strong></div>
                  <div>Autonomia: <strong className="text-text-primary">{ev.autonomy}.0</strong></div>
                  <div>Comportamento: <strong className="text-text-primary">{ev.behavior}.0</strong></div>
                </div>

                {ev.comment && (
                  <div className="text-xs text-text-secondary italic border-t border-border-subtle/50 pt-2 leading-relaxed">
                    &ldquo;{ev.comment}&rdquo;
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SUCCESS FEE OUTCOME CONTROL PANEL */}
      {successFee && (
        <div className="bg-bg-surface border border-indigo-200 dark:border-indigo-900/40 rounded-2xl p-6 shadow-xs space-y-4 text-left">
          <div className="flex justify-between items-center border-b border-indigo-100 dark:border-indigo-950 pb-3">
            <div>
              <h2 className="text-lg font-black text-indigo-900 dark:text-amber-600 flex items-center gap-2">
                <Award className="w-5 h-5" />
                <span>Painel de Resultados da Success Fee (Gatilho)</span>
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Defina o desfecho comercial da taxa de sucesso com base no cumprimento das metas acordadas.
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border uppercase ${
              successFee.status === 'achieved' || successFee.status === 'paid' ? 'bg-success-bg text-success-text border-success-border/20' :
              successFee.status === 'failed' ? 'bg-danger-bg text-danger-text border-danger-border/20' :
              'bg-warning-bg text-warning-text border-warning-border/20'
            }`}>
              {successFee.status === 'achieved' ? 'Atingido (Elegível)' :
               successFee.status === 'failed' ? 'Não Atingido (Inelegível)' :
               successFee.status === 'paid' ? 'Pago' : 'Pendente de Resultado'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-bg-panel p-4 rounded-xl border border-border-subtle space-y-2 text-xs">
              <span className="text-[10px] text-text-secondary uppercase font-bold tracking-wider">Regra de Cálculo</span>
              <div>
                <strong className="text-base text-text-primary font-extrabold block">
                  {formatCurrency(successFee.calculated_potential_amount)}
                </strong>
                <span className="text-text-secondary">
                  Tipo: {successFee.fee_type === 'fixed' ? 'Valor Fixo' : `${successFee.percentage_rate}%`}
                </span>
              </div>
              {successFee.terms && (
                <p className="pt-1.5 border-t border-dashed border-border-subtle text-text-secondary italic">
                  Gatilho: {successFee.terms}
                </p>
              )}
            </div>

            <div className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 text-xs">
                  <label className="font-bold text-[11px] text-text-primary uppercase tracking-wider block">Desfecho Comercial</label>
                  <select
                    value={outcomeStatus}
                    onChange={(e) => setOutcomeStatus(e.target.value)}
                    className="w-full bg-surface-container border border-border-subtle p-2.5 rounded-xl focus:outline-none focus:border-action-cyan text-text-primary text-xs"
                  >
                    <option value="pending">Aguardando Resultado (Pendente)</option>
                    <option value="achieved">Gatilho Atingido (Elegível)</option>
                    <option value="failed">Gatilho Não Atingido (Inelegível)</option>
                    <option value="paid">Pago</option>
                  </select>
                </div>

                <div className="space-y-1.5 text-xs">
                  <label className="font-bold text-[11px] text-text-primary uppercase tracking-wider block">Observações / Notas</label>
                  <input
                    type="text"
                    value={outcomeNotes}
                    onChange={(e) => setOutcomeNotes(e.target.value)}
                    placeholder="Adicione detalhes sobre o atingimento do gatilho..."
                    className="w-full bg-surface-container border border-border-subtle p-2.5 rounded-xl focus:outline-none focus:border-action-cyan text-text-primary text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  disabled={updatingOutcome}
                  onClick={handleUpdateSuccessFeeOutcome}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingOutcome ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span>Salvar Resultado do Gatilho</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SIMULATED BILLING PROJECTIONS LIST */}
      <div className="bg-bg-surface rounded-2xl border border-border-subtle p-6 shadow-xs space-y-4 text-left">
        <div>
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent" />
            <span>Simulação de Cronograma & Compliance de RC</span>
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Projeção estimativa dos ciclos de pagamento, prazos limites para abertura de RCs e níveis de risco operacional.
          </p>
        </div>

        {(() => {
          const projections = simulatePaymentProjections(job.startDate, job.endDate, job.remunerationModel);
          if (projections.length === 0) return <p className="text-xs text-text-secondary italic">Sem projeções para o período deste job.</p>;

          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projections.map((p) => {
                const alertColors = 
                  p.alertLevel === 'critical' ? 'border-status-error bg-red-500/10 text-status-error' :
                  p.alertLevel === 'urgent' ? 'border-warning-border bg-warning-bg text-warning-text' :
                  p.alertLevel === 'attention' ? 'border-amber-200 bg-amber-500/10 text-amber-600' :
                  'border-border-subtle bg-bg-panel text-text-primary';

                return (
                  <div key={p.cycleNumber} className={`p-4 rounded-xl border ${alertColors} space-y-2.5 text-xs`}>
                    <div className="flex justify-between items-center">
                      <strong className="text-xs font-black">Ciclo #{p.cycleNumber}</strong>
                      <span className="text-[10px] font-mono opacity-80">{formatDate(p.startDate)} a {formatDate(p.endDate)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-dashed border-current/20 font-semibold">
                      <div>
                        <span className="text-[9px] opacity-75 block uppercase">Vencimento</span>
                        <span className="font-mono text-xs">{formatDate(p.suggestedPaymentDate)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] opacity-75 block uppercase">Prazo RC</span>
                        <span className="font-mono text-xs">{formatDate(p.suggestedRcDeadline)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

    </div>
  );
}
