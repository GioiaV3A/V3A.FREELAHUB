'use client';

import { supabase } from '@/lib/supabase';

import React, { useState, useEffect, useMemo } from 'react';
import { useSortableTable } from '@/hooks/useSortableTable';
import { SortableHeader } from '@/components/SortableHeader';
import { 
  generatePublicFormLinkAction, 
  revokePublicFormLinkAction, 
  listPublicFormLinksAction,
  clearPublicFormLinksHistoryAction
} from '@/app/actions/adminPublicForm';
import QRCodeModal from './QRCodeModal';
import SubmissionDiffViewer from './SubmissionDiffViewer';
import { 
  Plus, 
  QrCode, 
  Trash2, 
  Copy, 
  Check, 
  Clock, 
  AlertTriangle,
  RotateCcw,
  Loader2,
  Calendar,
  Eye,
  Trash,
} from 'lucide-react';

interface PublicLinksPanelProps {
  db: any; // Allow full access to db tabs/setters
}

export default function PublicLinksPanel({ db }: PublicLinksPanelProps) {
  const [links, setLinks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Filters, search, sort, and pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRhStatus, setFilterRhStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('recent');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{
    token: string;
    linkType: 'new_freelancer' | 'update_freelancer';
    freelancerName?: string;
    expiresAt?: string | null;
    status: string;
  } | null>(null);

  // Generate Link Form States
  const [linkFormType, setLinkFormType] = useState<'new_freelancer' | 'update_freelancer'>('new_freelancer');
  const [selectedFreelaId, setSelectedFreelaId] = useState('');
  const [expiresDays, setExpiresDays] = useState('7');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Administrative clean-up states
  const [cleanupModalOpen, setCleanupModalOpen] = useState(false);
  const [cleanupOption, setCleanupOption] = useState<number>(1);

  // Selected submission details drawer
  const [selectedSubmissionForView, setSelectedSubmissionForView] = useState<any | null>(null);

  // Support lists for industries and functions mapping in diff view
  const [functions, setFunctions] = useState<any[]>([]);
  const [industries, setIndustries] = useState<any[]>([]);

  const getSessionToken = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  // Fetch Links List
  const fetchLinks = async () => {
    setIsLoading(true);
    try {
      const token = await getSessionToken();
      if (!token) return;
      const res = await listPublicFormLinksAction(token);
      if (res.success && res.links) {
        setLinks(res.links);
      } else if (res.error) {
        console.error('Error fetching links:', res.error);
      }
    } catch (err) {
      console.error('Error fetching links:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch auxiliary support tables
  const loadSupportData = async () => {
    try {
      const { data: funcData } = await supabase.from('freela_functions').select('id, name');
      if (funcData) setFunctions(funcData);

      const { data: indData } = await supabase.from('industries').select('id, name');
      if (indData) setIndustries(indData);
    } catch (err) {
      console.error('Error fetching support lists:', err);
    }
  };

  useEffect(() => {
    fetchLinks();
    loadSupportData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Copy Link Helper
  const handleCopyLink = (linkToken: string, linkType: string, linkId: string) => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const path = linkType === 'new_freelancer' ? '/public/freela/novo/' : '/public/freela/atualizar/';
      const url = `${origin}${path}${linkToken}`;
      navigator.clipboard.writeText(url);
      setCopiedLinkId(linkId);
      setTimeout(() => setCopiedLinkId(null), 2000);
    }
  };

  // Open QR Code Modal
  const handleOpenQRModal = (link: any) => {
    const tokenVal = link.metadata?.token || link.token_hash;
    setModalData({
      token: tokenVal,
      linkType: link.link_type,
      freelancerName: link.freelancer?.full_name,
      expiresAt: link.expires_at,
      status: link.status
    });
    setModalOpen(true);
  };

  // Generate public link
  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (linkFormType === 'update_freelancer' && !selectedFreelaId) {
      setErrorMsg('Selecione um freelancer para gerar o link de atualização.');
      return;
    }

    setIsActionLoading(true);
    try {
      const token = await getSessionToken();
      if (!token) {
        setErrorMsg('Sessão expirada. Faça login novamente.');
        return;
      }

      const res = await generatePublicFormLinkAction(token, {
        type: linkFormType,
        freelancerId: linkFormType === 'update_freelancer' ? selectedFreelaId : undefined,
        expiresDays: expiresDays === 'never' ? undefined : parseInt(expiresDays)
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Erro ao gerar o link.');
      } else {
        setSuccessMsg('Link gerado com sucesso!');
        setSelectedFreelaId('');
        
        const targetFreela = db.freelancers.find((f: any) => f.id === selectedFreelaId);
        setModalData({
          token: res.token || '',
          linkType: res.linkType as any,
          freelancerName: targetFreela?.name,
          expiresAt: res.expiresAt,
          status: 'active'
        });
        setModalOpen(true);
        fetchLinks();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado no servidor.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Revoke public link
  const handleRevokeLink = async (linkId: string) => {
    if (!confirm('Tem certeza de que deseja desativar/revogar este link?')) return;

    setIsActionLoading(true);
    try {
      const token = await getSessionToken();
      if (!token) return;
      const res = await revokePublicFormLinkAction(token, linkId);
      if (res.success) {
        fetchLinks();
      } else {
        alert(res.error || 'Erro ao revogar o link.');
      }
    } catch (err) {
      console.error('Error revoking link:', err);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Administrative clean-up handler
  const handleCleanupHistory = async () => {
    setIsActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const token = await getSessionToken();
      if (!token) {
        setErrorMsg('Sessão expirada. Faça login novamente.');
        return;
      }
      const res = await clearPublicFormLinksHistoryAction(token, cleanupOption);
      if (res.success) {
        setSuccessMsg(res.message || 'Histórico limpo com sucesso.');
        setCleanupModalOpen(false);
        fetchLinks();
      } else {
        setErrorMsg(res.error || 'Erro ao limpar histórico.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado ao limpar histórico.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Helper `getLinkDisplayName(link)`
  const getLinkDisplayName = (link: any) => {
    const freelancer = link.freelancer;
    const submission = link.submission;
    
    if (link.link_type === 'update_freelancer' && freelancer) {
      return freelancer.full_name;
    }
    if (submission?.submitted_data) {
      const sData = submission.submitted_data;
      if (sData.full_name) return sData.full_name;
      if (sData.nome_completo) return sData.nome_completo;
      if (sData.name) return sData.name;
    }
    if (link.link_type === 'new_freelancer') {
      return "Candidato Geral";
    }
    return "—";
  };

  // Helper `getLinkRhStatus(link)`
  const getLinkRhStatus = (link: any) => {
    const submission = link.submission;
    
    if (link.status === 'revoked') {
      return { label: 'Link revogado', status: 'revoked' };
    }
    if (link.status === 'expired') {
      return { label: 'Não preenchido / expirado', status: 'expired_unused' };
    }
    if (link.status === 'active' && !submission) {
      return { label: 'Aguardando preenchimento', status: 'waiting_fill' };
    }
    if (submission) {
      if (submission.status === 'pending_review') {
        return { label: 'Aguardando aprovação RH', status: 'pending_review' };
      }
      if (submission.status === 'under_review') {
        return { label: 'Em análise RH', status: 'under_review' };
      }
      if (submission.status === 'converted' && submission.submission_type === 'new_freelancer') {
        return { label: 'Convertido em freela', status: 'converted' };
      }
      if (submission.status === 'approved' && submission.submission_type === 'update_freelancer') {
        return { label: 'Atualização aplicada', status: 'approved' };
      }
      if (submission.status === 'rejected') {
        return { label: 'Rejeitado', status: 'rejected' };
      }
    }
    return { label: 'Sem submissão', status: 'none' };
  };

  // Render Link Status Chip
  const renderStatusChip = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      used: 'bg-blue-50 text-blue-700 border-blue-200',
      expired: 'bg-slate-100 text-slate-600 border-slate-200',
      revoked: 'bg-rose-50 text-rose-700 border-rose-200',
    };
    const labels: Record<string, string> = {
      active: 'Ativo',
      used: 'Utilizado',
      expired: 'Expirado',
      revoked: 'Revogado',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider select-none ${styles[status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
        {labels[status] || status}
      </span>
    );
  };

  // Render RH Status Chip
  const renderRhStatusChip = (link: any) => {
    const info = getLinkRhStatus(link);
    const styles: Record<string, string> = {
      waiting_fill: 'bg-slate-50 text-slate-600 border-slate-200',
      pending_review: 'bg-amber-50 text-amber-700 border-amber-200',
      under_review: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      converted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      rejected: 'bg-rose-50 text-rose-700 border-rose-200',
      revoked: 'bg-rose-50/50 text-rose-600 border-rose-100',
      expired_unused: 'bg-slate-100 text-slate-500 border-slate-200',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider select-none ${styles[info.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
        {info.label}
      </span>
    );
  };

  // Filtered and sorted links
  const filteredLinks = useMemo(() => {
    let result = [...links];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(link => {
        const displayName = getLinkDisplayName(link).toLowerCase();
        const email = (link.submission?.submitted_data?.email || link.freelancer?.email || '').toLowerCase();
        const whatsapp = (link.submission?.submitted_data?.whatsapp || link.freelancer?.whatsapp || '').toLowerCase();
        const tokenVal = (link.metadata?.token || link.token_hash || '').toLowerCase();
        const creator = (link.creator?.full_name || '').toLowerCase();
        
        return displayName.includes(q) || email.includes(q) || whatsapp.includes(q) || tokenVal.includes(q) || creator.includes(q);
      });
    }

    if (filterType !== 'all') {
      result = result.filter(link => link.link_type === filterType);
    }

    if (filterStatus !== 'all') {
      result = result.filter(link => link.status === filterStatus);
    }

    if (filterRhStatus !== 'all') {
      result = result.filter(link => {
        const rhStatus = getLinkRhStatus(link).status;
        return rhStatus === filterRhStatus;
      });
    }

    result.sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'used_recent') {
        const ta = a.used_at ? new Date(a.used_at).getTime() : 0;
        const tb = b.used_at ? new Date(b.used_at).getTime() : 0;
        return tb - ta;
      }
      if (sortBy === 'pending_first') {
        const statusA = getLinkRhStatus(a).status === 'pending_review' ? 1 : 0;
        const statusB = getLinkRhStatus(b).status === 'pending_review' ? 1 : 0;
        if (statusA !== statusB) {
          return statusB - statusA;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
    });

    return result;
  }, [links, searchQuery, filterType, filterStatus, filterRhStatus, sortBy]);

  const linksWithCalculated = useMemo(() => {
    return filteredLinks.map(link => ({
      ...link,
      displayName: getLinkDisplayName(link),
      rhStatusLabel: getLinkRhStatus(link).label,
      creatorName: link.creator?.full_name || '',
    }));
  }, [filteredLinks]);

  const { data: sortedLinks, sortKey, sortDirection, requestSort } = useSortableTable(
    linksWithCalculated,
    'created_at',
    'desc'
  );

  const totalItems = filteredLinks.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedLinks = sortedLinks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const isMasterOrRh = db.currentUser?.profile === 'MASTER' || db.currentUser?.profile === 'RH';

  return (
    <div className="space-y-6 font-sans text-xs">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Form: Generate Link */}
        <div className="w-full md:w-1/3 bg-white border border-border-subtle rounded-3xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-text-primary">Gerar Novo Acesso Temporário</h3>
            <p className="text-[10px] text-text-secondary mt-0.5">RH gera links ou QR Codes seguros de uso único.</p>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-rose-800 p-3 rounded-xl flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 p-3 rounded-xl flex gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleGenerateLink} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Finalidade do Form</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLinkFormType('new_freelancer')}
                  className={`flex-1 p-2.5 rounded-xl border text-center font-bold transition select-none cursor-pointer
                    ${linkFormType === 'new_freelancer'
                      ? 'bg-[#0F2342] text-white border-[#0F2342]'
                      : 'bg-white text-text-secondary border-border-subtle hover:bg-slate-50'}`}
                >
                  Novo Cadastro
                </button>
                <button
                  type="button"
                  onClick={() => setLinkFormType('update_freelancer')}
                  className={`flex-1 p-2.5 rounded-xl border text-center font-bold transition select-none cursor-pointer
                    ${linkFormType === 'update_freelancer'
                      ? 'bg-[#0F2342] text-white border-[#0F2342]'
                      : 'bg-white text-text-secondary border-border-subtle hover:bg-slate-50'}`}
                >
                  Atualização
                </button>
              </div>
            </div>

            {linkFormType === 'update_freelancer' && (
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Selecionar Freelancer *</label>
                <select
                  required
                  value={selectedFreelaId}
                  onChange={(e) => setSelectedFreelaId(e.target.value)}
                  className="w-full bg-slate-50 border border-border-subtle p-3 rounded-xl text-slate-700 outline-none focus:border-slate-400 cursor-pointer"
                >
                  <option value="">Escolha da base geral...</option>
                  {[...db.freelancers]
                    .filter(f => !f.mergedIntoFreelancerId && f.status !== 'Inativo' && f.status !== 'Bloqueado')
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(f => {
                      const contactInfo = f.email || f.whatsapp || '';
                      const contactPart = contactInfo ? ` — ${contactInfo}` : '';
                      return (
                        <option key={f.id} value={f.id}>
                          {f.name} — {f.mainRole}{contactPart}
                        </option>
                      );
                    })}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Prazo de Expiração</label>
              <select
                value={expiresDays}
                onChange={(e) => setExpiresDays(e.target.value)}
                className="w-full bg-slate-50 border border-border-subtle p-3 rounded-xl text-slate-700 outline-none focus:border-slate-400 cursor-pointer"
              >
                <option value="7">7 dias (Recomendado)</option>
                <option value="15">15 dias</option>
                <option value="30">30 dias</option>
                <option value="never">Sem expiração</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isActionLoading}
              className="w-full bg-action-cyan hover:bg-[#0ea5e9] text-[#0F2342] font-black py-3 rounded-xl flex items-center justify-center gap-1.5 transition select-none cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Gerar QR Code &amp; Link
            </button>
          </form>
        </div>

        {/* Right Table: Links */}
        <div className="flex-1 bg-white border border-border-subtle rounded-3xl p-6 shadow-sm flex flex-col min-w-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-text-primary">Histórico de Links de Cadastro</h3>
              <p className="text-[10px] text-text-secondary mt-0.5">Lista de links criados temporariamente para preenchimento público.</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {isMasterOrRh && (
                <button
                  onClick={() => setCleanupModalOpen(true)}
                  className="px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer text-[10px]"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpar histórico de testes
                </button>
              )}
              <button
                onClick={fetchLinks}
                disabled={isLoading}
                className="p-2 bg-slate-50 hover:bg-slate-100 border border-border-subtle rounded-xl text-text-secondary transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Atualizar
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 select-none">
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">Busca rápida</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full bg-white border border-border-subtle p-2 rounded-xl outline-none focus:border-slate-400 text-[11px]"
                placeholder="Nome, e-mail, token, criador..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">Finalidade</label>
              <select
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
                className="w-full bg-white border border-border-subtle p-2 rounded-xl outline-none focus:border-slate-400 text-[11px] cursor-pointer"
              >
                <option value="all">Todos os tipos</option>
                <option value="new_freelancer">Novo Cadastro</option>
                <option value="update_freelancer">Atualização</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">Status do Link</label>
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                className="w-full bg-white border border-border-subtle p-2 rounded-xl outline-none focus:border-slate-400 text-[11px] cursor-pointer"
              >
                <option value="all">Todos os status</option>
                <option value="active">Ativo</option>
                <option value="used">Utilizado</option>
                <option value="expired">Expirado</option>
                <option value="revoked">Revogado</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">Status RH</label>
              <select
                value={filterRhStatus}
                onChange={(e) => { setFilterRhStatus(e.target.value); setCurrentPage(1); }}
                className="w-full bg-white border border-border-subtle p-2 rounded-xl outline-none focus:border-slate-400 text-[11px] cursor-pointer"
              >
                <option value="all">Todos os status</option>
                <option value="waiting_fill">Aguardando preenchimento</option>
                <option value="pending_review">Aguardando aprovação</option>
                <option value="under_review">Em análise</option>
                <option value="converted">Convertido em freela</option>
                <option value="approved">Atualização aplicada</option>
                <option value="rejected">Rejeitado</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">Ordenação</label>
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                className="w-full bg-white border border-border-subtle p-2 rounded-xl outline-none focus:border-slate-400 text-[11px] cursor-pointer"
              >
                <option value="recent">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
                <option value="used_recent">Preenchidos recentemente</option>
                <option value="pending_first">Aguardando aprovação primeiro</option>
              </select>
            </div>
          </div>

          {/* Table Content */}
          <div className="flex-1 overflow-x-auto min-h-64">
            {isLoading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-action-cyan animate-spin" />
              </div>
            ) : links.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center text-text-secondary select-none">
                <Calendar className="w-10 h-10 text-slate-300 mb-2" />
                <p className="font-bold">Nenhum link gerado ainda.</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Use o formulário ao lado para criar o primeiro.</p>
              </div>
            ) : paginatedLinks.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center text-text-secondary select-none">
                <Calendar className="w-10 h-10 text-slate-300 mb-2" />
                <p className="font-bold">Nenhum link encontrado com os filtros aplicados.</p>
              </div>
            ) : (
              <>
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-border-subtle bg-slate-50 select-none">
                      <SortableHeader label="Tipo" sortKey="link_type" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="p-3" />
                      <SortableHeader label="Freela/Candidato" sortKey="displayName" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="p-3" />
                      <SortableHeader label="Status do Link" sortKey="status" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="p-3" />
                      <SortableHeader label="Status RH" sortKey="rhStatusLabel" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="p-3" />
                      <SortableHeader label="Criado por" sortKey="creatorName" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="p-3" />
                      <SortableHeader label="Criado em" sortKey="created_at" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="p-3" />
                      <SortableHeader label="Preenchido em" sortKey="used_at" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="p-3" />
                      <SortableHeader label="Expira em" sortKey="expires_at" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="p-3" />
                      <th className="p-3 text-[9px] text-slate-500 font-extrabold uppercase tracking-wider text-left">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paginatedLinks.map((link) => {
                      const isCopied = copiedLinkId === link.id;
                      const clearToken = link.metadata?.token;
                      const displayName = getLinkDisplayName(link);
                      
                      // Resolve emails for subtitle rendering
                      const emailVal = link.submission?.submitted_data?.email || link.freelancer?.email || '';

                      return (
                        <tr key={link.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold truncate">
                            {link.link_type === 'new_freelancer' ? (
                              <span className="flex items-center gap-1.5 text-[#0F2342]">
                                <Plus className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Novo Cadastro
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-slate-700">
                                <RotateCcw className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> Atualização
                              </span>
                            )}
                          </td>
                          <td className="p-3 truncate max-w-xs">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800">{displayName}</span>
                              {emailVal && <span className="text-[9px] text-slate-400 mt-0.5">{emailVal}</span>}
                            </div>
                          </td>
                          <td className="p-3">{renderStatusChip(link.status)}</td>
                          <td className="p-3">{renderRhStatusChip(link)}</td>
                          <td className="p-3 truncate max-w-xs">{link.creator?.full_name || '—'}</td>
                          <td className="p-3 whitespace-nowrap">{new Date(link.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td className="p-3 whitespace-nowrap">
                            {link.used_at ? (
                              <span className="text-blue-600 font-semibold">{new Date(link.used_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {link.expires_at ? (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {new Date(link.expires_at).toLocaleDateString('pt-BR')}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Sem expiração</span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {clearToken && link.status === 'active' && (
                                <button
                                  onClick={() => handleCopyLink(clearToken, link.link_type, link.id)}
                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition cursor-pointer"
                                  title="Copiar URL"
                                >
                                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              )}
                              {link.status === 'active' && (
                                <button
                                  onClick={() => handleOpenQRModal(link)}
                                  className="p-1.5 bg-[#0F2342]/10 hover:bg-[#0F2342]/20 text-[#0F2342] rounded-lg transition cursor-pointer"
                                  title="Ver QR Code"
                                >
                                  <QrCode className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {link.status === 'active' && (
                                <button
                                  onClick={() => handleRevokeLink(link.id)}
                                  className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition cursor-pointer"
                                  title="Desativar Link"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              
                              {/* Ver submissão action */}
                              {link.submission && (
                                <button
                                  onClick={() => setSelectedSubmissionForView(link.submission)}
                                  className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition cursor-pointer flex items-center gap-1 text-[10px] font-extrabold"
                                  title="Ver Submissão"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Ver Submissão
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-4 mt-4 select-none text-[11px] text-slate-500 font-bold gap-3">
                  <div className="flex items-center gap-3">
                    <span>
                      {totalItems === 0 ? '0 itens' : `${((currentPage - 1) * pageSize) + 1}–${Math.min(currentPage * pageSize, totalItems)} de ${totalItems} itens`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span>Itens por página:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => { setPageSize(parseInt(e.target.value)); setCurrentPage(1); }}
                        className="bg-white border border-border-subtle p-1 rounded-md outline-none text-[10px] font-bold cursor-pointer"
                      >
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                      </select>
                    </div>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg disabled:opacity-50 transition cursor-pointer"
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg disabled:opacity-50 transition cursor-pointer"
                      >
                        Próximo
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cleanup Modal */}
      {cleanupModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            <div>
              <h3 className="text-sm font-extrabold text-[#0F2342] flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-500" /> Limpar histórico de links
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">
                Esta ação removerá links públicos de teste e seus registros associados. Não serão apagados freelancers oficiais já aprovados.
              </p>
            </div>

            <div className="space-y-2.5">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Opções de Limpeza</label>
              
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition select-none">
                <input
                  type="radio"
                  name="cleanup_option"
                  checked={cleanupOption === 1}
                  onChange={() => setCleanupOption(1)}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-extrabold text-slate-800 text-[11px]">1. Limpar apenas links sem submissão</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">Remove apenas links ativos, expirados ou revogados que nunca foram acessados ou preenchidos.</p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition select-none">
                <input
                  type="radio"
                  name="cleanup_option"
                  checked={cleanupOption === 2}
                  onChange={() => setCleanupOption(2)}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-extrabold text-slate-800 text-[11px]">2. Limpar links usados e submissões pendentes</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">Remove submissões ainda pendentes de análise RH de teste e seus respectivos links usados.</p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition select-none">
                <input
                  type="radio"
                  name="cleanup_option"
                  checked={cleanupOption === 3}
                  onChange={() => setCleanupOption(3)}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-extrabold text-slate-800 text-[11px]">3. Limpar todo o histórico de links e submissões</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">Limpa absolutamente todo o histórico e submissões da tela, mas mantém os freelancers oficiais na base do banco.</p>
                </div>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setCleanupModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-extrabold transition cursor-pointer text-center text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleCleanupHistory}
                disabled={isActionLoading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1 shadow-sm disabled:opacity-50 text-xs"
              >
                {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash className="w-3.5 h-3.5" />} Confirmar Limpeza
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submission Details Drawer */}
      {selectedSubmissionForView && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex justify-end" onClick={() => setSelectedSubmissionForView(null)}>
          <div 
            className="w-full md:w-[500px] bg-white h-full shadow-2xl flex flex-col animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center select-none bg-slate-50">
              <div>
                <h3 className="text-sm font-extrabold text-[#0F2342]">Submissão do Candidato</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Enviada em {new Date(selectedSubmissionForView.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <button
                onClick={() => setSelectedSubmissionForView(null)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-700">
              {/* Status Section */}
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex justify-between items-center select-none">
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Status da Análise RH</span>
                  <span className="font-extrabold text-slate-800 text-xs">
                    {getLinkRhStatus({ submission: selectedSubmissionForView }).label}
                  </span>
                </div>
                {/* Quick link buttons based on status */}
                <div className="flex gap-2">
                  {(selectedSubmissionForView.status === 'pending_review' || selectedSubmissionForView.status === 'under_review') && (
                    <button
                      onClick={() => {
                        setSelectedSubmissionForView(null);
                        db.setActiveTab('Análise de Pré-cadastros');
                      }}
                      className="bg-action-cyan hover:bg-[#0ea5e9] text-[#0F2342] font-black px-3.5 py-2 rounded-xl transition text-[10px] uppercase tracking-wider shadow-xs cursor-pointer"
                    >
                      Ir para Aprovação
                    </button>
                  )}
                  {(selectedSubmissionForView.status === 'converted' || selectedSubmissionForView.status === 'approved') && selectedSubmissionForView.converted_freelancer_id && (
                    <button
                      onClick={() => {
                        db.setSelectedFreelancerId(selectedSubmissionForView.converted_freelancer_id);
                        db.setActiveTab('Perfil do Freelancer');
                        setSelectedSubmissionForView(null);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3.5 py-2 rounded-xl transition text-[10px] uppercase tracking-wider shadow-xs cursor-pointer"
                    >
                      Ver Freela
                    </button>
                  )}
                  {selectedSubmissionForView.status === 'approved' && !selectedSubmissionForView.converted_freelancer_id && selectedSubmissionForView.freelancer_id && (
                    <button
                      onClick={() => {
                        db.setSelectedFreelancerId(selectedSubmissionForView.freelancer_id);
                        db.setActiveTab('Perfil do Freelancer');
                        setSelectedSubmissionForView(null);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3.5 py-2 rounded-xl transition text-[10px] uppercase tracking-wider shadow-xs cursor-pointer"
                    >
                      Ver Freela
                    </button>
                  )}
                </div>
              </div>

              {/* Notes Section if reviewed */}
              {selectedSubmissionForView.reviewed_at && (
                <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-2xl space-y-2 select-none">
                  <div className="flex justify-between items-center text-[10px] font-bold text-amber-900">
                    <span>Revisado em {new Date(selectedSubmissionForView.reviewed_at).toLocaleDateString('pt-BR')}</span>
                    <span>Por: {selectedSubmissionForView.reviewer?.full_name || 'Sistema'}</span>
                  </div>
                  <p className="text-slate-700 text-[11px] leading-relaxed italic">{selectedSubmissionForView.review_notes || 'Sem observações.'}</p>
                </div>
              )}

              {/* Submission Details */}
              {selectedSubmissionForView.submission_type === 'update_freelancer' ? (
                <div className="space-y-3">
                  <h4 className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider">Alterações Solicitadas</h4>
                  <SubmissionDiffViewer
                    currentData={selectedSubmissionForView.current_data_snapshot}
                    submittedData={selectedSubmissionForView.submitted_data}
                    functions={functions}
                    industries={industries}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Dados Pessoais */}
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3">
                    <h4 className="font-extrabold text-slate-800 pb-1 border-b border-slate-200 uppercase tracking-wider text-[9px]">
                      Dados Pessoais &amp; Contato
                    </h4>
                    <div className="space-y-2 text-slate-750">
                      <p><strong>Nome Completo:</strong> {selectedSubmissionForView.submitted_data.full_name}</p>
                      <p><strong>E-mail:</strong> {selectedSubmissionForView.submitted_data.email || '—'}</p>
                      <p><strong>WhatsApp:</strong> {selectedSubmissionForView.submitted_data.whatsapp || '—'}</p>
                      <p><strong>Localidade:</strong> {selectedSubmissionForView.submitted_data.city}/{selectedSubmissionForView.submitted_data.state} {selectedSubmissionForView.submitted_data.location_text && `(${selectedSubmissionForView.submitted_data.location_text})`}</p>
                    </div>
                  </div>

                  {/* Perfil Profissional */}
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3">
                    <h4 className="font-extrabold text-slate-800 pb-1 border-b border-slate-200 uppercase tracking-wider text-[9px]">
                      Perfil Profissional
                    </h4>
                    <div className="space-y-2 text-slate-750">
                      <p>
                        <strong>Função Principal:</strong>{' '}
                        {functions.find(f => f.id === selectedSubmissionForView.submitted_data.main_function_id)?.name || selectedSubmissionForView.submitted_data.main_function_id || '—'}
                      </p>
                      <p><strong>Senioridade:</strong> <span className="bg-blue-50 border border-blue-100 text-blue-800 px-1.5 py-0.5 rounded uppercase font-bold text-[9px]">{selectedSubmissionForView.submitted_data.seniority || '—'}</span></p>
                      <p><strong>Situação Atual:</strong> {selectedSubmissionForView.submitted_data.current_situation || '—'}</p>
                      <p><strong>Disponibilidade:</strong> {selectedSubmissionForView.submitted_data.availability || '—'}</p>
                      <div>
                        <strong>Segmentos / Indústrias:</strong>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {selectedSubmissionForView.submitted_data.industries?.map((id: string) => {
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

                  {/* Portfólio */}
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3">
                    <h4 className="font-extrabold text-slate-800 pb-1 border-b border-slate-200 uppercase tracking-wider text-[9px]">
                      Portfólio &amp; Links
                    </h4>
                    <div className="space-y-2 text-slate-755">
                      {selectedSubmissionForView.submitted_data.portfolio_url && (
                        <p><strong>Portfólio URL:</strong> <a href={selectedSubmissionForView.submitted_data.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline inline-flex items-center gap-0.5">{selectedSubmissionForView.submitted_data.portfolio_url}</a></p>
                      )}
                      {selectedSubmissionForView.submitted_data.linkedin_url && (
                        <p><strong>LinkedIn:</strong> <a href={selectedSubmissionForView.submitted_data.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline inline-flex items-center gap-0.5">{selectedSubmissionForView.submitted_data.linkedin_url}</a></p>
                      )}
                      {selectedSubmissionForView.submitted_data.portfolio_file_url && (
                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                          <span className="font-bold">Portfólio Anexo:</span>
                          <a 
                            href={selectedSubmissionForView.submitted_data.portfolio_file_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="bg-[#0F2342] text-white hover:bg-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-1 transition text-[10px] font-extrabold"
                          >
                            Baixar Anexo
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Code Viewer Modal */}
      {modalOpen && modalData && (
        <QRCodeModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setModalData(null);
          }}
          token={modalData.token}
          linkType={modalData.linkType}
          freelancerName={modalData.freelancerName}
          expiresAt={modalData.expiresAt}
          status={modalData.status}
        />
      )}
    </div>
  );
}

