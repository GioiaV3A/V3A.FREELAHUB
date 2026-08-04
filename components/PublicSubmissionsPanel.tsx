'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSortableTable } from '@/hooks/useSortableTable';
import { SortableHeader } from '@/components/SortableHeader';
import { 
  listPublicSubmissionsAction, 
  reviewPublicSubmissionAction 
} from '@/app/actions/adminPublicForm';
import SubmissionDiffViewer from './SubmissionDiffViewer';
import { supabase } from '@/lib/supabase';
import { 
  Check, 
  X, 
  Eye, 
  AlertTriangle, 
  Clock, 
  RotateCcw,
  FileText,
  User,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Loader2,
  ListFilter
} from 'lucide-react';
import { mapSeniorityToUI, mapAvailabilityToUI } from '@/lib/dbMapper';

interface PublicSubmissionsPanelProps {
  db: {
    freelancers: any[];
    setFreelancers: React.Dispatch<React.SetStateAction<any[]>>;
    setFreelancersState?: React.Dispatch<React.SetStateAction<any[]>>;
    setActiveTab: (tab: string) => void;
    setSelectedFreelancerId: (id: string | null) => void;
  };
}

export default function PublicSubmissionsPanel({ db }: PublicSubmissionsPanelProps) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [functions, setFunctions] = useState<any[]>([]);
  const [industries, setIndustries] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'new' | 'update' | 'approved' | 'rejected'>('new');
  
  // Selected submission details
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // States for forced duplicate creation
  const [showForceCreateInput, setShowForceCreateInput] = useState(false);
  const [forceCreateJustification, setForceCreateJustification] = useState('');

  const getSessionToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  // Fetch Submissions and Support data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const token = await getSessionToken();
      if (!token) return;

      const subRes = await listPublicSubmissionsAction(token);
      if (subRes.success && subRes.submissions) {
        setSubmissions(subRes.submissions);
      }

      const { data: funcData } = await supabase.from('freela_functions').select('id, name');
      if (funcData) setFunctions(funcData);

      const { data: indData } = await supabase.from('industries').select('id, name');
      if (indData) setIndustries(indData);
    } catch (err) {
      console.error('Error loading submissions panel data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter Submissions
  const getFilteredSubmissions = () => {
    return submissions.filter(sub => {
      if (activeSubTab === 'new') {
        return sub.submission_type === 'new_freelancer' && (sub.status === 'pending_review' || sub.status === 'under_review');
      }
      if (activeSubTab === 'update') {
        return sub.submission_type === 'update_freelancer' && (sub.status === 'pending_review' || sub.status === 'under_review');
      }
      if (activeSubTab === 'approved') {
        return sub.status === 'approved' || sub.status === 'converted';
      }
      if (activeSubTab === 'rejected') {
        return sub.status === 'rejected';
      }
      return false;
    });
  };

  const filteredSubmissionsWithCalculated = useMemo(() => {
    return getFilteredSubmissions().map(sub => ({
      ...sub,
      candidateName: sub.submitted_data?.full_name || 'Sem nome',
      candidateEmail: sub.submitted_data?.email || '',
      candidateWhatsapp: sub.submitted_data?.whatsapp || '',
    }));
  }, [submissions, activeSubTab]);

  const { data: sortedSubmissions, sortKey, sortDirection, requestSort } = useSortableTable(
    filteredSubmissionsWithCalculated,
    'created_at',
    'desc'
  );

  // Process Approval / Rejection review action
  const handleReview = async (action: 'approve' | 'reject', reviewOptions?: {
    bypassDuplicateCheck?: boolean;
    justification?: string;
    mergeToFreelancerId?: string;
  }) => {
    if (!selectedSubmission) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (action === 'reject' && !reviewNotes.trim()) {
      setErrorMsg('A justificativa de revisão é obrigatória para rejeitar a submissão.');
      return;
    }

    setIsActionLoading(true);
    try {
      const token = await getSessionToken();
      if (!token) {
        setErrorMsg('Sessão expirada. Faça login novamente.');
        setIsActionLoading(false);
        return;
      }

      const res = await reviewPublicSubmissionAction(
        token,
        selectedSubmission.id,
        action,
        reviewNotes,
        reviewOptions
      );

      if (!res.success) {
        setErrorMsg(res.error || 'Erro ao revisar a submissão.');
      } else {
        setSuccessMsg(res.message || 'Submissão revisada com sucesso!');
        setReviewNotes('');
        
        // Refresh local db freelancers list if approved
        if (action === 'approve') {
          // Trigger a silent reload of the parent database so the freelancers database updates
          const { data: dbFreelancers } = await supabase
            .from('freelancers')
            .select('*, main_function:freela_functions(name), freelancer_industries(industry:industries(name))')
            .is('merged_into_freelancer_id', null);
          if (dbFreelancers) {
            // Re-map using parent mapper helper
            const mapper = await import('@/lib/dbMapper');
            const mappedFreelancers = dbFreelancers.map(mapper.mapFreelancerToUI);
            if (db.setFreelancersState) {
              db.setFreelancersState(mappedFreelancers);
            } else {
              db.setFreelancers(mappedFreelancers);
            }
          }
        }

        // Close details and reload submissions
        setSelectedSubmission(null);
        setShowForceCreateInput(false);
        setForceCreateJustification('');
        loadData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const normalizeName = (name: string) => {
    if (!name) return '';
    const map: Record<string, string> = {
      'Á':'A','À':'A','Â':'A','Ã':'A','Ä':'A','É':'E','È':'E','Ê':'E','Ë':'E','Í':'I','Ì':'I','Î':'I','Ï':'I','Ó':'O','Ò':'O','Ô':'O','Õ':'O','Ö':'O','Ú':'U','Ù':'U','Û':'U','Ü':'U','Ç':'C','Ý':'Y'
    };
    return name.toUpperCase().trim().replace(/\s+/g, ' ').split('').map(c => map[c] || c).join('');
  };

  // Check if submitted email/whatsapp already exists in DB freelancers (for Novo Freela flow)
  const checkDuplicity = (sub: any) => {
    if (sub.submission_type !== 'new_freelancer') return null;

    const emailForm = sub.submitted_data?.email?.trim().toLowerCase();
    const whatsappForm = sub.submitted_data?.whatsapp?.trim()?.replace(/\D/g, '');
    const nameForm = sub.submitted_data?.full_name ? normalizeName(sub.submitted_data.full_name) : '';
    const funcIdForm = sub.submitted_data?.main_function_id;
    const funcNameForm = functions.find(f => f.id === funcIdForm)?.name;

    const dup = db.freelancers.find(f => {
      const isPlaceholderPhone = whatsappForm === '5521999999999' || whatsappForm === '21999999999';
      const matchesEmail = emailForm && f.email?.trim().toLowerCase() === emailForm;
      const matchesWhatsapp = !isPlaceholderPhone && whatsappForm && f.whatsapp?.trim()?.replace(/\D/g, '') === whatsappForm;
      const matchesNameFunc = nameForm && funcNameForm && normalizeName(f.name) === nameForm && f.mainRole === funcNameForm;
      return matchesEmail || matchesWhatsapp || matchesNameFunc;
    });

    return dup || null;
  };

  const dupFreelancer = selectedSubmission ? checkDuplicity(selectedSubmission) : null;

  return (
    <div className="space-y-6 font-sans text-xs">
      
      {/* Abas Superiores de Filtro */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-border-subtle p-4 rounded-3xl shadow-sm select-none">
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
          <button
            onClick={() => {
              setActiveSubTab('new');
              setSelectedSubmission(null);
            }}
            className={`px-4 py-2 rounded-xl font-bold transition cursor-pointer
              ${activeSubTab === 'new' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Novos Freelas
          </button>
          <button
            onClick={() => {
              setActiveSubTab('update');
              setSelectedSubmission(null);
            }}
            className={`px-4 py-2 rounded-xl font-bold transition cursor-pointer
              ${activeSubTab === 'update' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Atualizações Cadastrais
          </button>
          <button
            onClick={() => {
              setActiveSubTab('approved');
              setSelectedSubmission(null);
            }}
            className={`px-4 py-2 rounded-xl font-bold transition cursor-pointer
              ${activeSubTab === 'approved' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Aprovados
          </button>
          <button
            onClick={() => {
              setActiveSubTab('rejected');
              setSelectedSubmission(null);
            }}
            className={`px-4 py-2 rounded-xl font-bold transition cursor-pointer
              ${activeSubTab === 'rejected' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)]' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Rejeitados
          </button>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-border-subtle rounded-xl text-text-secondary transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Atualizar Fila
        </button>
      </div>

      <div className="space-y-6">
        
        {/* Submissions List Table */}
        <div className="bg-white border border-border-subtle rounded-3xl p-6 shadow-sm overflow-hidden flex flex-col min-w-0">
          
          <div className="mb-4">
            <h3 className="text-sm font-extrabold text-text-primary">Fila de Submissões Recebidas</h3>
            <p className="text-[10px] text-text-secondary mt-0.5">Analise pré-cadastros ou atualizações solicitadas por links externos.</p>
          </div>

          <div className="overflow-x-auto min-h-64">
            {isLoading ? (
              <div className="h-64 flex items-center justify-center text-[var(--text-disabled)] select-none">
                <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
              </div>
            ) : sortedSubmissions.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center text-text-secondary select-none">
                <ListFilter className="w-10 h-10 text-slate-600 mb-2" />
                <p className="font-bold">Nenhuma submissão nesta aba.</p>
                <p className="text-[10px] text-[var(--text-disabled)] mt-0.5">Aguardando novos preenchimentos externos.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-border-subtle bg-slate-50 select-none">
                    <SortableHeader label="Tipo" sortKey="submission_type" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="p-3" />
                    <SortableHeader label="Candidato" sortKey="candidateName" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="p-3" />
                    <SortableHeader label="E-mail" sortKey="candidateEmail" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="p-3" />
                    <SortableHeader label="WhatsApp" sortKey="candidateWhatsapp" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="p-3" />
                    <SortableHeader label="Data Envio" sortKey="created_at" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="p-3" />
                    <SortableHeader label="Status" sortKey="status" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="p-3" />
                    <th className="p-3 text-[9px] text-[var(--text-disabled)] font-extrabold uppercase tracking-wider text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {sortedSubmissions.map((sub) => {
                    const data = sub.submitted_data;
                    const isSelected = selectedSubmission?.id === sub.id;

                    return (
                      <tr 
                        key={sub.id} 
                        className={`transition hover:bg-slate-50/50 cursor-pointer
                          ${isSelected ? 'bg-slate-50 font-bold border-l-2 border-action-cyan' : ''}`}
                        onClick={() => {
                          setSelectedSubmission(sub);
                          setReviewNotes('');
                          setErrorMsg(null);
                          setSuccessMsg(null);
                          setShowForceCreateInput(false);
                          setForceCreateJustification('');
                        }}
                      >
                        <td className="p-3 font-bold truncate">
                          {sub.submission_type === 'new_freelancer' ? (
                            <span className="text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider">Novo</span>
                          ) : (
                            <span className="text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider">Update</span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-slate-800 truncate">{data.full_name || 'Sem nome'}</td>
                        <td className="p-3 truncate max-w-xs">{data.email || '—'}</td>
                        <td className="p-3 truncate">{data.whatsapp || '—'}</td>
                        <td className="p-3 whitespace-nowrap">{new Date(sub.created_at).toLocaleDateString('pt-BR')}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wider select-none
                            ${sub.status === 'pending_review' ? 'text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100' : 
                              sub.status === 'converted' || sub.status === 'approved' ? 'text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100' :
                              'text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100'}`}>
                            {sub.status === 'pending_review' ? 'Pendente' : 
                             sub.status === 'converted' ? 'Convertido' :
                             sub.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSubmission(sub);
                              setReviewNotes('');
                              setErrorMsg(null);
                              setSuccessMsg(null);
                              setShowForceCreateInput(false);
                              setForceCreateJustification('');
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Modal Overlay: Detailed review pane */}
        {selectedSubmission && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/60 backdrop-blur-xs overflow-y-auto animate-fade-in"
            onClick={() => setSelectedSubmission(null)}
          >
            <div 
              className="w-full max-w-4xl bg-white border border-border-subtle rounded-3xl p-6 shadow-xl space-y-5 flex flex-col my-8 max-h-[90vh] overflow-y-auto animate-scale-up"
              onClick={e => e.stopPropagation()}
            >
              
              <div className="flex justify-between items-start pb-3 border-b border-slate-100 select-none">
                <div>
                  <h3 className="text-base font-extrabold text-text-primary uppercase tracking-wider">Detalhes da Submissão</h3>
                  <p className="text-[10px] text-text-secondary mt-0.5">
                    Recebido em {new Date(selectedSubmission.created_at).toLocaleString('pt-BR')} | Tipo:{' '}
                    <span className="font-extrabold text-amber-600 uppercase">
                      {selectedSubmission.submission_type === 'new_freelancer' ? 'Novo Cadastro' : 'Atualização de Cadastro'}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-[var(--text-disabled)] hover:text-slate-700 transition"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-200 text-rose-800 p-3 rounded-xl flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-500/10 border border-emerald-200 text-emerald-800 p-3 rounded-xl flex gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Warning banner for possible duplicate freelancer */}
            {dupFreelancer && (
              <div className="bg-amber-500/10 border border-amber-200 text-amber-900 p-3.5 rounded-2xl flex flex-col gap-2 select-none animate-scale-up">
                <div className="flex gap-2">
                  <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-amber-600 animate-bounce" />
                  <div className="text-[10px] leading-relaxed">
                    <p className="font-extrabold text-amber-955 text-xs">Possível Duplicidade Encontrada!</p>
                    <p className="text-slate-700 dark:text-slate-600 mt-0.5">
                      Já existe um cadastro ativo com e-mail, WhatsApp ou Nome + Função idênticos:
                      <br /><strong>{dupFreelancer.name}</strong> ({dupFreelancer.mainRole}).
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-1 pt-2 border-t border-amber-200">
                  <button
                    onClick={() => {
                      db.setSelectedFreelancerId(dupFreelancer.id);
                      db.setActiveTab('Perfil do Freelancer');
                    }}
                    className="w-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-extrabold py-1.5 px-3 rounded-xl flex items-center justify-center gap-1 transition text-[10px] cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Abrir Perfil Existente
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleReview('approve', { mergeToFreelancerId: dupFreelancer.id })}
                      disabled={isActionLoading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-1.5 px-3 rounded-xl flex items-center justify-center gap-1 transition text-[10px] cursor-pointer disabled:opacity-50"
                    >
                      {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Mesclar Dados
                    </button>

                    <button
                      onClick={() => setShowForceCreateInput(!showForceCreateInput)}
                      className="bg-slate-700 hover:bg-slate-50 text-[var(--text-primary)] border border-slate-650 font-extrabold py-1.5 px-3 rounded-xl flex items-center justify-center gap-1 transition text-[10px] cursor-pointer"
                    >
                      Criar Mesmo Assim
                    </button>
                  </div>

                  {showForceCreateInput && (
                    <div className="space-y-2 mt-2 p-3 bg-white/60 dark:bg-white/60 rounded-xl border border-amber-200 animate-scale-up">
                      <label className="text-[9px] text-amber-955 font-bold uppercase tracking-wider block">
                        Justificativa Administrativa *
                      </label>
                      <textarea
                        rows={2}
                        value={forceCreateJustification}
                        onChange={(e) => setForceCreateJustification(e.target.value)}
                        className="w-full bg-white dark:bg-slate-955 border border-amber-400/40 p-2 rounded-lg outline-none focus:border-amber-500 text-[10px]"
                        placeholder="Informe a justificativa administrativa para criar um cadastro com duplicidade..."
                      />
                      <button
                        onClick={() => handleReview('approve', { bypassDuplicateCheck: true, justification: forceCreateJustification })}
                        disabled={isActionLoading || !forceCreateJustification.trim()}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-1.5 rounded-lg flex items-center justify-center gap-1 transition text-[10px] disabled:opacity-50 cursor-pointer"
                      >
                        {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Confirmar Inclusão Forçada
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Submission type specifics: snapshot comparison or fields list */}
            <div className="flex-1 overflow-y-auto space-y-4 max-h-[450px] pr-1">
              {selectedSubmission.submission_type === 'update_freelancer' ? (
                <div className="space-y-3">
                  <div className="bg-indigo-50 border border-indigo-100 text-indigo-950 p-3.5 rounded-2xl text-[10px] leading-relaxed select-none">
                    <strong>Comparação de Alterações Cadastrais:</strong>
                    <p className="text-slate-600 mt-1">Revisão das alterações sugeridas pelo freelancer.</p>
                  </div>
                  <SubmissionDiffViewer
                    currentData={selectedSubmission.current_data_snapshot}
                    submittedData={selectedSubmission.submitted_data}
                    functions={functions}
                    industries={industries}
                  />
                </div>
              ) : (
                // Full Profile details list for Novo Freela
                <div className="space-y-4">
                  {/* Basic information */}
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3">
                    <h4 className="font-bold text-slate-800 pb-1 border-b border-slate-200 uppercase tracking-wider text-[9px] flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-[var(--text-disabled)]" /> Dados Pessoais & Contato
                    </h4>
                    <div className="space-y-1.5 text-slate-700">
                      <p><strong>Nome Completo:</strong> {selectedSubmission.submitted_data.full_name}</p>
                      {selectedSubmission.submitted_data.cnpj_normalized ? (
                        <p><strong>CNPJ:</strong> {selectedSubmission.submitted_data.cnpj_normalized.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}</p>
                      ) : selectedSubmission.submitted_data.foreign_tax_id ? (
                        <p><strong>Identificação Fiscal:</strong> {selectedSubmission.submitted_data.foreign_tax_id} ({selectedSubmission.submitted_data.tax_country_code || 'Estrangeiro'})</p>
                      ) : null}
                      <p className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-[var(--text-disabled)]" /> {selectedSubmission.submitted_data.email}</p>
                      <p className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-[var(--text-disabled)]" /> {selectedSubmission.submitted_data.whatsapp}</p>
                      <p className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-[var(--text-disabled)]" /> {selectedSubmission.submitted_data.city}/{selectedSubmission.submitted_data.state} {selectedSubmission.submitted_data.location_text && `(${selectedSubmission.submitted_data.location_text})`}</p>
                    </div>
                  </div>

                  {/* Professional profile details */}
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3">
                    <h4 className="font-bold text-slate-800 pb-1 border-b border-slate-200 uppercase tracking-wider text-[9px] flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-[var(--text-disabled)]" /> Perfil Profissional & Disponibilidade
                    </h4>
                    <div className="space-y-1.5 text-slate-700">
                      <p>
                        <strong>Função Principal:</strong>{' '}
                        {functions.find(f => f.id === selectedSubmission.submitted_data.main_function_id)?.name || selectedSubmission.submitted_data.main_function_id}
                      </p>
                      <p><strong>Senioridade:</strong> <span className="bg-blue-50 border border-blue-100 text-blue-800 px-1.5 py-0.5 rounded uppercase font-bold text-[9px]">{mapSeniorityToUI(selectedSubmission.submitted_data.seniority)}</span></p>
                      <p><strong>Situação Atual:</strong> {selectedSubmission.submitted_data.current_situation}</p>
                      <p><strong>Disponibilidade:</strong> <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">{mapAvailabilityToUI(selectedSubmission.submitted_data.availability)}</span></p>
                      <div>
                        <strong>Segmentos / Indústrias:</strong>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedSubmission.submitted_data.industries?.map((id: string) => {
                            const name = industries.find(i => i.id === id)?.name || id;
                            return (
                              <span key={id} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[9px] font-bold">
                                {name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* V3A specific experience */}
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-2">
                    <h4 className="font-bold text-slate-800 pb-1 border-b border-slate-200 uppercase tracking-wider text-[9px]">
                      Experiência com Eventos & V3A
                    </h4>
                    <div className="space-y-1.5 text-slate-700">
                      <p><strong>Já trabalhou com V3A?</strong> {selectedSubmission.submitted_data.has_worked_with_v3a}</p>
                      {selectedSubmission.submitted_data.v3a_projects && (
                        <p><strong>Projetos Realizados:</strong> {selectedSubmission.submitted_data.v3a_projects}</p>
                      )}
                      {selectedSubmission.submitted_data.brands_worked && (
                        <p><strong>Marcas Atendidas:</strong> {selectedSubmission.submitted_data.brands_worked}</p>
                      )}
                    </div>
                  </div>

                  {/* Social links and portfolio */}
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-2">
                    <h4 className="font-bold text-slate-800 pb-1 border-b border-slate-200 uppercase tracking-wider text-[9px]">
                      Portfólio & Links Sociais
                    </h4>
                    <div className="space-y-1.5 text-slate-700">
                      {selectedSubmission.submitted_data.portfolio_url && (
                        <p><strong>Portfólio URL:</strong> <a href={selectedSubmission.submitted_data.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline inline-flex items-center gap-0.5">{selectedSubmission.submitted_data.portfolio_url} <ExternalLink className="w-3 h-3" /></a></p>
                      )}
                      {selectedSubmission.submitted_data.linkedin_url && (
                        <p><strong>LinkedIn:</strong> <a href={selectedSubmission.submitted_data.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline inline-flex items-center gap-0.5">{selectedSubmission.submitted_data.linkedin_url} <ExternalLink className="w-3 h-3" /></a></p>
                      )}
                      {selectedSubmission.submitted_data.instagram_url && (
                        <p><strong>Instagram:</strong> <a href={selectedSubmission.submitted_data.instagram_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline inline-flex items-center gap-0.5">{selectedSubmission.submitted_data.instagram_url} <ExternalLink className="w-3 h-3" /></a></p>
                      )}
                      {selectedSubmission.submitted_data.portfolio_file_url && (
                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                          <span className="font-bold">Portfólio Anexo:</span>
                          <a 
                            href={selectedSubmission.submitted_data.portfolio_file_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="bg-slate-50 text-[var(--text-primary)] hover:bg-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1 transition text-[10px] font-extrabold"
                          >
                            <FileText className="w-3.5 h-3.5" /> Baixar Anexo
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Comments */}
                  {selectedSubmission.submitted_data.observations && (
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-1">
                      <h4 className="font-bold text-slate-800 pb-1 border-b border-slate-200 uppercase tracking-wider text-[9px]">
                        Observações Adicionais
                      </h4>
                      <p className="text-slate-600 leading-relaxed italic mt-1">{selectedSubmission.submitted_data.observations}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Review actions & notes field */}
            <div className="space-y-4 pt-3 border-t border-slate-100 bg-slate-50/50 p-4 rounded-2xl">
              <div className="space-y-1">
                <label className="text-[10px] text-[var(--text-disabled)] font-bold uppercase tracking-wider block">
                  Notas de Revisão {activeSubTab === 'rejected' || selectedSubmission.status === 'pending_review' ? '*' : ''}
                </label>
                {selectedSubmission.status === 'pending_review' || selectedSubmission.status === 'under_review' ? (
                  <textarea
                    rows={2.5}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="w-full bg-white border border-border-subtle p-2.5 rounded-xl outline-none focus:border-slate-400"
                    placeholder="Justificativa da rejeição (obrigatória) ou nota de aprovação (opcional)..."
                  />
                ) : (
                  <div className="bg-white p-3 rounded-xl border border-border-subtle select-none">
                    <p className="font-bold text-slate-800">Notas de Revisão:</p>
                    <p className="text-slate-600 mt-1 italic">{selectedSubmission.review_notes || 'Nenhuma nota registrada.'}</p>
                    <p className="text-[10px] text-[var(--text-disabled)] mt-2">Revisado por: {selectedSubmission.reviewer?.full_name || 'Sistema'}</p>
                  </div>
                )}
              </div>

              {(selectedSubmission.status === 'pending_review' || selectedSubmission.status === 'under_review') && (
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => handleReview('reject')}
                    disabled={isActionLoading}
                    className="flex-1 bg-white dark:bg-white hover:bg-red-50 dark:hover:bg-red-50 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-600 font-extrabold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition select-none cursor-pointer disabled:opacity-50"
                  >
                    <X className="w-4 h-4 text-red-500" /> Rejeitar
                  </button>
                  {selectedSubmission.submission_type === 'new_freelancer' && dupFreelancer ? (
                    <div className="flex-1 text-[10px] text-amber-700 dark:text-amber-600 font-bold bg-amber-500/10 p-2.5 rounded-xl border border-amber-200 text-center select-none">
                      Utilize as opções de Duplicidade acima para Aprovar/Mesclar.
                    </div>
                  ) : (
                    <button
                      onClick={() => handleReview('approve')}
                      disabled={isActionLoading}
                      className="flex-1 bg-action-cyan hover:brightness-95 text-black font-black py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition select-none cursor-pointer disabled:opacity-50"
                    >
                      {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-slate-900" />}
                      {selectedSubmission.submission_type === 'new_freelancer' ? 'Aprovar e Incluir' : 'Aprovar e Atualizar'}
                    </button>
                  )}
                </div>
              )}
            </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
