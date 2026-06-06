'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
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

  useEffect(() => {
    if (!id) return;

    const fetchJobDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch freelancer request (Job Opportunity)
        const { data: reqData, error: reqErr } = await supabase
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
          .single();

        if (reqErr) {
          console.error('Error fetching request:', reqErr);
          setError('Oportunidade não encontrada ou erro no banco de dados.');
          setLoading(false);
          return;
        }

        if (reqData) {
          const mappedJob = mapJobToUI(reqData);
          setJob({
            ...mappedJob,
            nucleoName: reqData.jobs?.nucleos?.name || 'Sem núcleo',
            jobCode: reqData.jobs?.job_code || 'JOB-—',
            requestCode: reqData.request_code || 'REQ-—',
          });
        }

        // 2. Fetch Shortlist Candidates
        const { data: dbShortlist, error: slErr } = await supabase
          .from('shortlist_candidates')
          .select('*, freelancers(*)')
          .eq('request_id', id);

        if (slErr) console.error('Error fetching shortlist:', slErr);
        else setShortlist(dbShortlist || []);

        // 3. Fetch Negotiations
        const { data: dbNegs, error: negErr } = await supabase
          .from('negotiations')
          .select('*, freelancers(*)')
          .eq('request_id', id);

        if (negErr) console.error('Error fetching negotiations:', negErr);
        else setNegotiations(dbNegs || []);

        // 4. Fetch Allocations
        const { data: dbAllocs, error: allocErr } = await supabase
          .from('allocations')
          .select('*, freelancers(*)')
          .eq('job_id', id);

        if (allocErr) console.error('Error fetching allocations:', allocErr);
        else setAllocations(dbAllocs || []);

        // 5. Fetch Payment Codes
        const { data: dbPayments, error: payErr } = await supabase
          .from('payment_codes')
          .select('*, freelancers(*)')
          .eq('job_id', id);

        if (payErr) console.error('Error fetching payment codes:', payErr);
        else setPaymentCodes(dbPayments || []);

        // 6. Fetch Evaluations
        const { data: dbEvals, error: evalErr } = await supabase
          .from('evaluations')
          .select('*, freelancers(*)')
          .eq('job_id', id);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <button
          onClick={() => router.push('/?tab=Timeline de Alocações')}
          className="flex items-center gap-2 bg-bg-surface hover:bg-bg-hover text-text-secondary hover:text-text-primary border border-border-subtle p-2.5 px-4 rounded-xl text-xs font-bold transition shadow-xs"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Voltar para a Timeline</span>
        </button>

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
            <span className="bg-[#0F2342] text-white text-[10px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider">
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
                    <span className="font-mono text-[10px] font-bold text-white bg-[#0F2342] px-2 py-0.5 rounded-lg">
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

    </div>
  );
}
