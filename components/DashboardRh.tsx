'use client';

import React, { useState } from 'react';
import { DatabaseProps } from '@/app/page';
import { generateUniqueId } from '@/lib/utils';
import { 
  Users, FileWarning, ClipboardCheck, CornerDownRight, Check, X, 
  ShieldAlert, BadgeInfo, Building, PhoneCall, Heart, AlertTriangle, 
  CalendarDays, Flame, Loader2, Sparkles, MessageSquare
} from 'lucide-react';
import { decideApprovalAction } from '@/app/actions/evaluation';
import { supabase } from '@/lib/supabase';

export default function DashboardRh({ db }: { db: DatabaseProps }) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<{ [key: string]: string }>({});


  // Counters
  const activeCount = db.freelancers.filter(f => f.status === 'Elegível').length;
  const blockedCount = db.freelancers.filter(f => f.status === 'Bloqueado').length;
  const onboardingCount = db.freelancers.filter(f => f.status === 'Em onboarding').length;
  const analysisCount = db.freelancers.filter(f => f.status === 'Em análise').length;
  const observationCount = db.freelancers.filter(f => f.status === 'Em observação').length;

  // Pending approvals from allocation_approvals table
  const pendingApprovals = db.approvals.filter(ap => ap.status === 'pending');

  const [pendingSubmissionsCount, setPendingSubmissionsCount] = useState<number>(0);
  const [loadingSubmissionsCount, setLoadingSubmissionsCount] = useState(true);

  React.useEffect(() => {
    const fetchCount = async () => {
      try {
        const { count, error } = await supabase
          .from('freelancer_public_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending_review');
        if (!error && count !== null) {
          setPendingSubmissionsCount(count);
        }
      } catch (err) {
        console.error('Error fetching submissions count:', err);
      } finally {
        setLoadingSubmissionsCount(false);
      }
    };
    fetchCount();
  }, []);

  // Handle Approval decisions calling Server Actions
  const handleDecideApproval = async (approvalId: string, status: 'approved' | 'rejected') => {
    setProcessingId(approvalId);
    const notes = decisionNotes[approvalId] || '';
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';

      const res = await decideApprovalAction(
        token,
        approvalId,
        status,
        db.currentUser.id,
        db.currentUser.profile || 'RH',
        notes
      );

      if (res.success) {
        alert(`Decisão de aprovação registrada com sucesso: ${status === 'approved' ? 'APROVADO' : 'REPROVADO'}.`);
        setDecisionNotes(prev => {
          const next = { ...prev };
          delete next[approvalId];
          return next;
        });
        await db.reloadDatabase();
      } else {
        alert(`Erro ao salvar decisão: ${res.error || 'Erro desconhecido'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Erro inesperado ao registrar decisão.');
    } finally {
      setProcessingId(null);
    }
  };

  // --- ANALYTICS FOR COMPLIANCE / WARNINGS ---

  // 1. Leaders / Nuclei with low reverse scores
  const getLowScoreLeaders = () => {
    // Group reverse evaluations by leader name
    const leaderStats: { 
      [key: string]: { 
        name: string, 
        nucleo: string, 
        count: number, 
        leaderSum: number, 
        projectSum: number,
        npsSum: number,
        csatSum: number
      } 
    } = {};

    db.reverseEvaluations.forEach(re => {
      // Find leader profile name
      const leaderProfile = db.users.find((u: any) => u.id === re.leaderId);
      const leaderName = leaderProfile?.name || re.client || 'Líder do Núcleo';
      const nucleoName = db.nucleos.find(n => n.id === re.nucleoId)?.name || 'Outro';

      const key = re.leaderId || re.nucleoId || 'default';
      if (!leaderStats[key]) {
        leaderStats[key] = {
          name: leaderName,
          nucleo: nucleoName,
          count: 0,
          leaderSum: 0,
          projectSum: 0,
          npsSum: 0,
          csatSum: 0
        };
      }

      leaderStats[key].count += 1;
      leaderStats[key].leaderSum += re.leaderScoreComponent || 0;
      leaderStats[key].projectSum += re.projectExperienceScore || 0;
      leaderStats[key].npsSum += re.npsProject || 0;
      leaderStats[key].csatSum += re.csatProject || 0;
    });

    // Convert to array and filter for low averages (< 70)
    return Object.values(leaderStats)
      .map(stat => ({
        name: stat.name,
        nucleo: stat.nucleo,
        count: stat.count,
        avgLeaderScore: Number((stat.leaderSum / stat.count).toFixed(1)),
        avgProjectScore: Number((stat.projectSum / stat.count).toFixed(1)),
        avgNps: Number((stat.npsSum / stat.count).toFixed(1)),
        avgCsat: Number((stat.csatSum / stat.count).toFixed(1))
      }))
      .filter(l => l.avgLeaderScore < 70 || l.avgProjectScore < 70)
      .sort((a, b) => a.avgLeaderScore - b.avgLeaderScore);
  };

  // 2. High Rework levels detected in post-job evaluations
  const getHighReworkProjects = () => {
    return db.evaluations
      .filter(ev => ev.reworkLevel === 'alta' || ev.reworkLevel === 'media')
      .map(ev => {
        const job = db.jobs.find(j => j.id === ev.jobId);
        const freela = db.freelancers.find(f => f.id === ev.freelancerId);
        const nucleo = db.nucleos.find(n => n.id === job?.nucleoId);
        return {
          id: ev.id,
          projectName: job?.name || 'Projeto Concluído',
          client: job?.client || 'Cliente',
          nucleoName: nucleo?.name || 'Núcleo',
          freelaName: freela?.name || 'Freelancer',
          reworkLevel: ev.reworkLevel === 'alta' ? 'Alta' : 'Média',
          comments: ev.comment
        };
      });
  };

  const lowScoreLeaders = getLowScoreLeaders();
  const highReworkProjects = getHighReworkProjects();

  return (
    <div id="dashboard-rh-container" className="space-y-6 font-sans text-xs">
      
      {/* KPI Base Cadastral row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div id="rh-kpi-ativos" className="bg-white dark:bg-[#0d1627] border border-slate-150 dark:border-slate-850 rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 text-xs font-semibold mb-1">
            <span>Ativos Elegíveis</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{activeCount}</p>
          <span className="text-[10px] text-slate-400">Prontos para contratação</span>
        </div>

        <div className="bg-white dark:bg-[#0d1627] border border-slate-150 dark:border-slate-850 rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 text-xs font-semibold mb-1">
            <span>Em Onboarding</span>
            <span className="w-1.5 h-1.5 rounded-full bg-action-cyan"></span>
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{onboardingCount}</p>
          <span className="text-[10px] text-slate-400">Assinando Docs / Fiscal</span>
        </div>

        <div className="bg-white dark:bg-[#0d1627] border border-slate-150 dark:border-slate-850 rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 text-xs font-semibold mb-1">
            <span>Em Análise</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{analysisCount}</p>
          <span className="text-[10px] text-slate-400">Triagem de portfólio</span>
        </div>

        <div className="bg-white dark:bg-[#0d1627] border border-slate-150 dark:border-slate-850 rounded-xl p-4 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 text-xs font-semibold mb-1">
            <span>Em Observação</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{observationCount}</p>
          <span className="text-[10px] text-slate-400">Acompanhamento técnico</span>
        </div>

        <div className="bg-white dark:bg-[#0d1627] border border-slate-150 dark:border-slate-850 rounded-xl p-4 shadow-xs col-span-2 lg:col-span-1">
          <div className="flex justify-between items-center text-slate-500 text-xs font-semibold mb-1">
            <span>Bloqueados</span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{blockedCount}</p>
          <span className="text-[10px] text-rose-500 font-semibold">Vetados de engajar</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* LEFT: Pre-registration submissions */}
        <div id="rh-suggested-panel" className="bg-white dark:bg-[#0d1627] rounded-2xl shadow-xs border border-slate-150 dark:border-slate-850 overflow-hidden flex flex-col justify-between min-h-[300px]">
          <div className="p-4 border-b border-slate-150 dark:border-slate-850 bg-slate-50 dark:bg-slate-900/40 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-action-cyan" />
              <span>Análise de Pré-cadastros</span>
            </h3>
            <span className="text-[10px] bg-action-cyan/15 text-action-cyan border border-action-cyan/20 px-2 py-0.5 rounded-full font-bold uppercase">
              Fila Pública
            </span>
          </div>

          <div className="p-6 flex flex-col items-center justify-center text-center flex-1 space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
              <Users className="w-6 h-6 text-slate-400 dark:text-slate-500" />
            </div>
            {loadingSubmissionsCount ? (
              <div className="flex items-center gap-2 text-slate-500 font-semibold text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-action-cyan" /> Carregando fila...
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                  {pendingSubmissionsCount} {pendingSubmissionsCount === 1 ? 'Pré-cadastro' : 'Pré-cadastros'}
                </p>
                <p className="text-xs text-slate-500 max-w-sm">
                  {pendingSubmissionsCount === 0 
                    ? 'Todos os cadastros e atualizações públicas foram revisados. Excelente!' 
                    : 'Há novos candidatos e solicitações de atualização aguardando validação do RH.'}
                </p>
              </div>
            )}
            
            <button
              onClick={() => db.setActiveTab('Análise de Pré-cadastros')}
              className="bg-[#0F2342] hover:bg-slate-800 text-white font-extrabold px-4 py-2 rounded-xl transition text-[11px] uppercase tracking-wider shadow-sm cursor-pointer inline-flex items-center gap-1.5"
            >
              Acessar Fila de Análise
            </button>
          </div>
        </div>

        {/* RIGHT: Governance Approvals (Rate policy exceptions + schedule conflicts) */}
        <div id="rh-exceptions-panel" className="bg-white dark:bg-[#0d1627] rounded-2xl shadow-xs border border-slate-150 dark:border-slate-850 overflow-hidden">
          <div className="p-4 border-b border-slate-150 dark:border-slate-850 bg-slate-50 dark:bg-slate-900/40 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-status-error" />
              <span>Aprovações de Exceções de Governança ({pendingApprovals.length})</span>
            </h3>
            <span className="text-[10px] bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
              Alerta de Conformidade
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-850/60 max-h-[420px] overflow-y-auto">
            {pendingApprovals.length === 0 ? (
              <div className="p-12 text-center text-slate-500 italic">
                Nenhum pedido de exceção ou liberação pendente no portal.
              </div>
            ) : (
              pendingApprovals.map((ap) => {
                const job = db.jobs.find(j => j.id === ap.jobId);
                const freela = db.freelancers.find(f => f.id === ap.freelancerId);
                const nucleo = db.nucleos.find(n => n.id === job?.nucleoId);
                const requester = db.users.find(u => u.id === ap.requestedBy);

                const isValueException = ap.approvalType === 'value_exception';
                const difference = ap.negotiatedValue - ap.policyCeilingValue;
                const diffPercentage = ap.policyCeilingValue > 0 ? Math.round((difference / ap.policyCeilingValue) * 100) : 0;

                return (
                  <div key={ap.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/10 transition-colors space-y-3.5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                          {freela?.name || 'Freelancer'} &rarr; <span className="text-slate-500">{job?.name || 'Campanha'}</span>
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-2 py-0.5 rounded-lg text-[9px]">
                            Núcleo: {nucleo?.name || 'N/A'}
                          </span>
                          
                          {isValueException ? (
                            <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 font-extrabold px-1.5 py-0.5 rounded-md text-[9px] uppercase">
                              Estouro Budget ({diffPercentage}% acima do teto)
                            </span>
                          ) : (
                            <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 font-extrabold px-1.5 py-0.5 rounded-md text-[9px] uppercase flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" /> Conflito de Agenda
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-1.5 self-end sm:self-center">
                        <button
                          disabled={processingId === ap.id}
                          onClick={() => handleDecideApproval(ap.id, 'approved')}
                          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white p-1.5 px-3 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                        >
                          {processingId === ap.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Aprovar
                        </button>
                        <button
                          disabled={processingId === ap.id}
                          onClick={() => handleDecideApproval(ap.id, 'rejected')}
                          className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white p-1.5 px-3 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                        >
                          {processingId === ap.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                          Reprovar
                        </button>
                      </div>
                    </div>

                    {/* Comparative analysis table for budget exceptions */}
                    {isValueException && (
                      <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850/80 text-[11px]">
                        <div>
                          <span className="text-slate-500 block">Teto da Política</span>
                          <span className="font-bold text-slate-850 dark:text-slate-200">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ap.policyCeilingValue)} / dia
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block font-bold text-rose-500">Valor Proposto</span>
                          <span className="font-black text-rose-500">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ap.negotiatedValue)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Diferença (GAP)</span>
                          <span className="font-bold text-rose-500">
                            +{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(difference)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Schedule conflict details if agenda overlap */}
                    {!isValueException && (
                      <div className="p-2.5 bg-amber-500/5 border border-amber-500/15 rounded-xl text-[11px] text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                        ⚠️ Profissional possui uma alocação ativa confirmada que coincide com o cronograma desta demanda ({job?.startDate ? new Date(job.startDate).toLocaleDateString('pt-BR') : ''} a {job?.endDate ? new Date(job.endDate).toLocaleDateString('pt-BR') : ''}). O RH precisa validar o remanejamento ou autorizar a sobreposição.
                      </div>
                    )}

                    {/* Justification details */}
                    <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-150 dark:border-slate-850/80 p-2.5 rounded-xl space-y-2.5">
                      <div className="flex gap-1.5 items-start text-slate-600 dark:text-slate-400">
                        <BadgeInfo className="w-3.5 h-3.5 text-action-cyan shrink-0 mt-0.5" />
                        <span className="font-medium text-[11px]">
                          <span className="font-bold text-slate-500">Justificativa de {requester?.name || 'Solicitante'}:</span> &ldquo;{ap.reason}&rdquo;
                        </span>
                      </div>

                      {/* Inline Decision notes input */}
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <input
                          type="text"
                          value={decisionNotes[ap.id] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDecisionNotes(prev => ({ ...prev, [ap.id]: val }));
                          }}
                          placeholder="Digite um parecer de aprovação ou recusa..."
                          className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-[10px] outline-none text-slate-800 dark:text-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* RH AUDIT: Low leader scores and high rework projects */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* Leaders with low reverse scores warning */}
        <div className="bg-white dark:bg-[#0d1627] p-5 rounded-2xl shadow-xs border border-slate-150 dark:border-slate-850 space-y-4">
          <div className="border-b border-slate-150 dark:border-slate-850 pb-3">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-500" />
              <span>Líderes com Baixas Avaliações Operacionais</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">Líderes de núcleos com notas médias abaixo de 70 no feedback reverso dos freelancers.</p>
          </div>

          <div className="overflow-x-auto">
            {lowScoreLeaders.length === 0 ? (
              <div className="text-center py-8 text-slate-500 italic">
                Nenhum núcleo ou líder com score reverso abaixo de 70. Excelente!
              </div>
            ) : (
              <table className="w-full text-left whitespace-nowrap">
                <thead className="text-slate-500 font-bold border-b border-slate-150 dark:border-slate-850/80">
                  <tr>
                    <th className="pb-2">Líder / Núcleo</th>
                    <th className="pb-2 text-center">Avaliações</th>
                    <th className="pb-2 text-center">Score Liderança</th>
                    <th className="pb-2 text-center">Score Projeto</th>
                    <th className="pb-2 text-center">CSAT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850/50">
                  {lowScoreLeaders.map((leader, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/10 transition-colors">
                      <td className="py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                        <div>{leader.name}</div>
                        <div className="text-[9px] text-slate-400 font-normal">{leader.nucleo}</div>
                      </td>
                      <td className="py-2.5 text-center text-slate-500 font-bold">{leader.count}</td>
                      <td className="py-2.5 text-center font-bold text-rose-500 bg-rose-500/5">{leader.avgLeaderScore}</td>
                      <td className="py-2.5 text-center font-bold text-rose-500 bg-rose-500/5">{leader.avgProjectScore}</td>
                      <td className="py-2.5 text-center font-bold text-amber-500">{leader.avgCsat} ★</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* High Rework Levels dashboard */}
        <div className="bg-white dark:bg-[#0d1627] p-5 rounded-2xl shadow-xs border border-slate-150 dark:border-slate-850 space-y-4">
          <div className="border-b border-slate-150 dark:border-slate-850 pb-3">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span>Demandas com Nível Crítico de Refação</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">Projetos sinalizados pelos coordenadores com refações médias ou altas no pós-job.</p>
          </div>

          <div className="overflow-y-auto max-h-60 space-y-3">
            {highReworkProjects.length === 0 ? (
              <div className="text-center py-8 text-slate-500 italic">
                Nenhum projeto com refações críticas detectado nas avaliações recentes.
              </div>
            ) : (
              highReworkProjects.map((proj) => (
                <div key={proj.id} className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-150 dark:border-slate-850/80 space-y-1.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200">{proj.projectName}</h4>
                      <p className="text-[9px] text-slate-400 font-medium">{proj.nucleoName} &bull; Cliente: {proj.client}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider
                      ${proj.reworkLevel === 'Alta' 
                        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/15' 
                        : 'bg-amber-500/10 text-amber-500 border border-amber-500/15'}`}>
                      Refação {proj.reworkLevel}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-700 dark:text-slate-350 italic font-medium leading-relaxed">&ldquo;{proj.comments}&rdquo;</p>
                  <p className="text-[9px] text-slate-500 font-bold border-t border-dashed border-slate-200 dark:border-slate-800 pt-1">
                    Profissional alocado: {proj.freelaName}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* RH Audit list of low score freelas */}
      <div id="rh-performance-panel" className="bg-white dark:bg-[#0d1627] p-5 rounded-2xl shadow-xs border border-slate-150 dark:border-slate-850">
        <div className="flex md:flex-row flex-col justify-between items-start md:items-center border-b border-slate-150 dark:border-slate-850 pb-3 mb-4 gap-2">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-status-warning" />
              <span>Controle Fiscal e Alvos de Baixa Performance</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Profissionais com pontuações baixas sob acompanhamento ativo para manter a qualidade de entrega.</p>
          </div>
          <button 
            onClick={() => db.setActiveTab('Banco de Freelancers')} 
            className="text-[10px] font-bold text-action-cyan hover:underline cursor-pointer uppercase tracking-wider"
          >
            Acessar banco de talentos
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {db.freelancers
            .filter(f => {
              const score = f.consolidatedScore ?? (f.averageScore > 5 ? f.averageScore : f.averageScore * 20);
              return score > 0 && score < 65;
            })
            .map((f) => {
              const score = f.consolidatedScore ?? (f.averageScore > 5 ? f.averageScore : f.averageScore * 20);
              return (
                <div key={f.id} className="p-3 border border-slate-150 dark:border-slate-850 rounded-xl bg-slate-50 dark:bg-slate-900/30 flex flex-col justify-between hover:border-status-warning/45 transition-colors">
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{f.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border 
                        ${f.status === 'Bloqueado' 
                          ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' 
                          : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                        {f.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Função: {f.mainRole} • {f.seniority}</p>
                    <p className="text-[11px] font-medium text-slate-700 dark:text-slate-350 line-clamp-2 mt-2.5 italic">&ldquo;{f.observations}&rdquo;</p>
                  </div>
                  <div className="border-t border-dashed border-slate-200 dark:border-slate-800 pt-2 mt-3.5 flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-bold uppercase text-[9px]">Score Consolidado:</span>
                    <span className="font-black text-rose-500 flex items-center gap-1">
                      {score.toFixed(1)} / 100
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
