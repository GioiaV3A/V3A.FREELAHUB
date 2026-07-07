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
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  Link2,
  User,
} from 'lucide-react';
import { ResponsiveDataTable, Column } from './ResponsiveDataTable';

const isValidUUID = (id: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
};

interface PublicLinksPanelProps {
  db: any;
}

// ─── Inline Toast ─────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = React.useRef(0);

  const addToast = (type: ToastType, message: string) => {
    const id = ++counter.current;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  return { toasts, addToast, removeToast };
}

// ─── Inline Confirmation Modal ─────────────────────────────────────────────────
interface ConfirmModalState {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}

// ─── FiltersBar — must live at MODULE level (not inside PublicLinksPanel) ─────
// Declaring it inside the parent causes React to create a NEW component type on
// every render, which unmounts and remounts the input on each keystroke.
interface FiltersBarProps {
  searchQuery: string;
  filterType: string;
  filterStatus: string;
  filterRhStatus: string;
  sortBy: string;
  onSearchChange: (v: string) => void;
  onFilterTypeChange: (v: string) => void;
  onFilterStatusChange: (v: string) => void;
  onFilterRhStatusChange: (v: string) => void;
  onSortByChange: (v: string) => void;
}

function FiltersBar({
  searchQuery,
  filterType,
  filterStatus,
  filterRhStatus,
  sortBy,
  onSearchChange,
  onFilterTypeChange,
  onFilterStatusChange,
  onFilterRhStatusChange,
  onSortByChange,
}: FiltersBarProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {/* Search */}
      <div className="lg:col-span-2 space-y-1">
        <label
          htmlFor="pl-search"
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          Busca rápida
        </label>
        <input
          id="pl-search"
          name="pl-search"
          type="text"
          autoComplete="off"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full border rounded-xl p-2.5 outline-none text-sm"
          style={{
            background: 'var(--bg-input)',
            borderColor: 'var(--border-soft)',
            color: 'var(--text-primary)',
          }}
          placeholder="Nome, e-mail, token, criador..."
        />
      </div>
      {/* Finalidade */}
      <div className="space-y-1">
        <label
          htmlFor="pl-filter-type"
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          Finalidade
        </label>
        <select
          id="pl-filter-type"
          value={filterType}
          onChange={e => onFilterTypeChange(e.target.value)}
          className="w-full border rounded-xl p-2.5 outline-none text-sm cursor-pointer"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
        >
          <option value="all">Todos os tipos</option>
          <option value="new_freelancer">Novo Cadastro</option>
          <option value="update_freelancer">Atualização</option>
        </select>
      </div>
      {/* Status Link */}
      <div className="space-y-1">
        <label
          htmlFor="pl-filter-status"
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          Status do Link
        </label>
        <select
          id="pl-filter-status"
          value={filterStatus}
          onChange={e => onFilterStatusChange(e.target.value)}
          className="w-full border rounded-xl p-2.5 outline-none text-sm cursor-pointer"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="used">Utilizado</option>
          <option value="expired">Expirado</option>
          <option value="revoked">Revogado</option>
        </select>
      </div>
      {/* Status RH + Sort stacked */}
      <div className="space-y-3">
        <div className="space-y-1">
          <label
            htmlFor="pl-filter-rh"
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Status RH
          </label>
          <select
            id="pl-filter-rh"
            value={filterRhStatus}
            onChange={e => onFilterRhStatusChange(e.target.value)}
            className="w-full border rounded-xl p-2.5 outline-none text-sm cursor-pointer"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
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
          <label
            htmlFor="pl-sort"
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Ordenação
          </label>
          <select
            id="pl-sort"
            value={sortBy}
            onChange={e => onSortByChange(e.target.value)}
            className="w-full border rounded-xl p-2.5 outline-none text-sm cursor-pointer"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
          >
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="used_recent">Preenchidos recentemente</option>
            <option value="pending_first">Aguardando aprovação primeiro</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default function PublicLinksPanel({ db }: PublicLinksPanelProps) {

  const { toasts, addToast, removeToast } = useToasts();

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

  // Mobile filter drawer
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // QR Code Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{
    token: string;
    linkType: 'new_freelancer' | 'update_freelancer';
    freelancerName?: string;
    expiresAt?: string | null;
    status: string;
  } | null>(null);

  // Confirm modal state (replaces native confirm())
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    open: false,
    title: '',
    description: '',
    confirmLabel: 'Confirmar',
    onConfirm: () => {},
  });

  // Generate Link Form States
  const [linkFormType, setLinkFormType] = useState<'new_freelancer' | 'update_freelancer'>('new_freelancer');
  const [selectedFreelaId, setSelectedFreelaId] = useState('');
  const [expiresDays, setExpiresDays] = useState('7');

  // Administrative clean-up states
  const [cleanupModalOpen, setCleanupModalOpen] = useState(false);
  const [cleanupOption, setCleanupOption] = useState<number>(1);

  // Selected submission details drawer
  const [selectedSubmissionForView, setSelectedSubmissionForView] = useState<any | null>(null);

  // Mobile link details drawer
  const [selectedLinkForDetails, setSelectedLinkForDetails] = useState<any | null>(null);

  // Support lists for industries and functions mapping in diff view
  const [functions, setFunctions] = useState<any[]>([]);
  const [industries, setIndustries] = useState<any[]>([]);

  const isMasterOrRh = db.currentUser?.profile === 'MASTER' || db.currentUser?.profile === 'RH';

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
    if (!isMasterOrRh) {
      setLinkFormType('new_freelancer');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.currentUser]);

  // Keyboard: close drawers/modals on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmModal.open) setConfirmModal(prev => ({ ...prev, open: false }));
        else if (cleanupModalOpen) setCleanupModalOpen(false);
        else if (selectedSubmissionForView) setSelectedSubmissionForView(null);
        else if (selectedLinkForDetails) setSelectedLinkForDetails(null);
        else if (mobileFiltersOpen) setMobileFiltersOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmModal.open, cleanupModalOpen, selectedSubmissionForView, selectedLinkForDetails, mobileFiltersOpen]);

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

    if (linkFormType === 'update_freelancer') {
      if (!selectedFreelaId) {
        addToast('error', 'Selecione um freelancer para gerar o link de atualização.');
        return;
      }
      if (!isValidUUID(selectedFreelaId)) {
        const targetFreela = db.freelancers?.find((f: any) => f.id === selectedFreelaId);
        const freelaName = targetFreela ? targetFreela.name : 'Desconhecido';
        const userEmail = db.currentUser?.email || 'Desconhecido';

        console.error('[Technical Error] Invalid UUID for public form update link generation:', {
          selectedFreelaId,
          freelancerName: freelaName,
          user: userEmail,
          timestamp: new Date().toISOString()
        });

        addToast('error', 'ID inválido do freelancer. Atualize a página e selecione novamente o freelancer a partir da base oficial.');
        return;
      }
    }

    setIsActionLoading(true);
    try {
      const token = await getSessionToken();
      if (!token) {
        addToast('error', 'Sessão expirada. Faça login novamente.');
        return;
      }

      const res = await generatePublicFormLinkAction(token, {
        type: linkFormType,
        freelancerId: linkFormType === 'update_freelancer' ? selectedFreelaId : undefined,
        expiresDays: expiresDays === 'never' ? undefined : parseInt(expiresDays)
      });

      if (!res.success) {
        addToast('error', res.error || 'Erro ao gerar o link.');
      } else {
        addToast('success', 'Link gerado com sucesso!');
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
      addToast('error', err.message || 'Erro inesperado no servidor.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Revoke public link — uses inline confirmation modal
  const handleRevokeLink = (linkId: string) => {
    setConfirmModal({
      open: true,
      title: 'Revogar link',
      description: 'Tem certeza de que deseja desativar/revogar este link? Esta ação não pode ser desfeita.',
      confirmLabel: 'Revogar',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, open: false }));
        setIsActionLoading(true);
        try {
          const token = await getSessionToken();
          if (!token) return;
          const res = await revokePublicFormLinkAction(token, linkId);
          if (res.success) {
            fetchLinks();
            addToast('success', 'Link revogado com sucesso.');
          } else {
            addToast('error', res.error || 'Erro ao revogar o link.');
          }
        } catch (err) {
          console.error('Error revoking link:', err);
          addToast('error', 'Erro inesperado ao revogar o link.');
        } finally {
          setIsActionLoading(false);
        }
      },
    });
  };

  // Administrative clean-up handler
  const handleCleanupHistory = async () => {
    setIsActionLoading(true);
    try {
      const token = await getSessionToken();
      if (!token) {
        addToast('error', 'Sessão expirada. Faça login novamente.');
        return;
      }
      const res = await clearPublicFormLinksHistoryAction(token, cleanupOption);
      if (res.success) {
        addToast('success', res.message || 'Histórico limpo com sucesso.');
        setCleanupModalOpen(false);
        fetchLinks();
      } else {
        addToast('error', res.error || 'Erro ao limpar histórico.');
      }
    } catch (err: any) {
      addToast('error', err.message || 'Erro inesperado ao limpar histórico.');
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
      return 'Candidato Geral';
    }
    return '—';
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

  // Render Link Status Badge — uses CSS vars for dark mode support
  const renderStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; border: string; label: string }> = {
      active:  { bg: 'var(--success-bg)',  text: 'var(--success-text)',  border: 'var(--success-border)',  label: 'Ativo' },
      used:    { bg: 'var(--info-bg)',     text: 'var(--info-text)',     border: 'var(--info-border)',     label: 'Utilizado' },
      expired: { bg: 'var(--neutral-bg)',  text: 'var(--neutral-text)',  border: 'var(--neutral-border)',  label: 'Expirado' },
      revoked: { bg: 'var(--danger-bg)',   text: 'var(--danger-text)',   border: 'var(--danger-border)',   label: 'Revogado' },
    };
    const s = map[status] || map.expired;
    return (
      <span
        style={{ background: s.bg, color: s.text, borderColor: s.border }}
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold border uppercase tracking-wider select-none"
      >
        {s.label}
      </span>
    );
  };

  // Render RH Status Badge — uses CSS vars
  const renderRhStatusBadge = (link: any) => {
    const info = getLinkRhStatus(link);
    const map: Record<string, { bg: string; text: string; border: string }> = {
      waiting_fill:   { bg: 'var(--neutral-bg)',  text: 'var(--neutral-text)',  border: 'var(--neutral-border)' },
      pending_review: { bg: 'var(--warning-bg)',  text: 'var(--warning-text)',  border: 'var(--warning-border)' },
      under_review:   { bg: 'var(--info-bg)',     text: 'var(--info-text)',     border: 'var(--info-border)' },
      converted:      { bg: 'var(--success-bg)',  text: 'var(--success-text)',  border: 'var(--success-border)' },
      approved:       { bg: 'var(--success-bg)',  text: 'var(--success-text)',  border: 'var(--success-border)' },
      rejected:       { bg: 'var(--danger-bg)',   text: 'var(--danger-text)',   border: 'var(--danger-border)' },
      revoked:        { bg: 'var(--danger-bg)',   text: 'var(--danger-text)',   border: 'var(--danger-border)' },
      expired_unused: { bg: 'var(--neutral-bg)',  text: 'var(--neutral-text)',  border: 'var(--neutral-border)' },
      none:           { bg: 'var(--neutral-bg)',  text: 'var(--neutral-text)',  border: 'var(--neutral-border)' },
    };
    const s = map[info.status] || map.none;
    return (
      <span
        style={{ background: s.bg, color: s.text, borderColor: s.border }}
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold border uppercase tracking-wider select-none"
      >
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, searchQuery, filterType, filterStatus, filterRhStatus, sortBy]);

  const linksWithCalculated = useMemo(() => {
    return filteredLinks.map(link => ({
      ...link,
      displayName: getLinkDisplayName(link),
      rhStatusLabel: getLinkRhStatus(link).label,
      creatorName: link.creator?.full_name || '',
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredLinks]);

  const { data: sortedLinks, sortKey, sortDirection, requestSort } = useSortableTable(
    linksWithCalculated,
    'created_at',
    'desc'
  );

  const columns = useMemo<Column<any>[]>(() => [
    {
      key: 'display',
      label: 'Link / Candidato',
      sortKey: 'displayName',
      width: '28%',
      render: (link: any) => {
        const displayName = getLinkDisplayName(link);
        const emailVal = link.submission?.submitted_data?.email || link.freelancer?.email || '';
        return (
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 bg-slate-100 dark:bg-slate-800">
              {link.link_type === 'new_freelancer' ? (
                <Plus className="w-4 h-4 text-info-500" />
              ) : (
                <RotateCcw className="w-4 h-4 text-purple-650 dark:text-purple-400" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm truncate text-text-primary" title={displayName}>
                {displayName}
              </span>
              {emailVal && (
                <span className="text-xs truncate mt-0.5 text-text-muted" title={emailVal}>
                  {emailVal}
                </span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: 'status',
      label: 'Status',
      width: '16%',
      render: (link: any) => (
        <div className="flex flex-col gap-1 items-start">
          {renderStatusBadge(link.status)}
          {renderRhStatusBadge(link)}
        </div>
      )
    },
    {
      key: 'created',
      label: 'Criação',
      sortKey: 'creatorName',
      width: '16%',
      render: (link: any) => (
        <div className="flex flex-col">
          <span className="font-semibold text-sm truncate text-text-primary" title={link.creator?.full_name || ''}>
            {link.creator?.full_name || '—'}
          </span>
          <span className="text-xs mt-0.5 text-text-muted">
            {new Date(link.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
          </span>
        </div>
      )
    },
    {
      key: 'used_at',
      label: 'Preenchimento',
      sortKey: 'used_at',
      width: '14%',
      render: (link: any) => link.used_at ? (
        <span className="font-semibold text-sm text-info-500">
          {new Date(link.used_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      ) : (
        <span className="text-sm italic text-text-disabled">
          Ainda não preenchido
        </span>
      )
    },
    {
      key: 'expires_at',
      label: 'Expira em',
      sortKey: 'expires_at',
      width: '14%',
      render: (link: any) => {
        const isExpired = link.expires_at && new Date(link.expires_at) < new Date();
        return link.expires_at ? (
          <div className="flex flex-col items-start gap-1">
            <span className={`flex items-center gap-1 text-sm font-semibold ${isExpired ? 'text-status-error' : 'text-text-secondary'}`}>
              <Clock className="w-3.5 h-3.5 shrink-0 text-text-muted" />
              {new Date(link.expires_at).toLocaleDateString('pt-BR')}
            </span>
            {isExpired && (
              <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded-md bg-rose-50 border border-rose-100 text-rose-600 dark:bg-rose-950/20 dark:border-rose-900/30 leading-none">
                EXPIRADO
              </span>
            )}
          </div>
        ) : (
          <span className="text-sm italic text-text-disabled">
            Sem expiração
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: 'Ações',
      width: '120px',
      align: 'right',
      render: (link: any) => {
        const isCopied = copiedLinkId === link.id;
        const clearToken = link.metadata?.token;
        return (
          <div className="flex items-center justify-end gap-1.5 w-full">
            {clearToken && link.status === 'active' && (
              <button
                onClick={() => handleCopyLink(clearToken, link.link_type, link.id)}
                className="p-1.5 rounded-lg transition cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                style={{ background: 'var(--neutral-bg)', color: 'var(--neutral-text)' }}
                title="Copiar URL"
                aria-label="Copiar link"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-success-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
            {link.status === 'active' && (
              <button
                onClick={() => handleOpenQRModal(link)}
                className="p-1.5 rounded-lg transition cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                title="Ver QR Code"
                aria-label="Ver QR Code"
              >
                <QrCode className="w-3.5 h-3.5" />
              </button>
            )}
            {isMasterOrRh && link.status === 'active' && (
              <button
                onClick={() => handleRevokeLink(link.id)}
                className="p-1.5 rounded-lg transition cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-950/20"
                style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)' }}
                title="Revogar link"
                aria-label="Revogar link"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            {link.submission && (
              <button
                onClick={() => setSelectedSubmissionForView(link.submission)}
                className="p-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 text-xs font-extrabold"
                style={{ background: 'var(--info-bg)', color: 'var(--info-text)' }}
                title="Ver submissão"
                aria-label="Ver submissão"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [copiedLinkId, isMasterOrRh]);

  const mobileLinkRenderer = (link: any) => {
    const isCopied = copiedLinkId === link.id;
    const clearToken = link.metadata?.token;
    const displayName = getLinkDisplayName(link);
    const emailVal = link.submission?.submitted_data?.email || link.freelancer?.email || '';
    return (
      <div
        className="rounded-2xl border p-4 space-y-3.5 transition-shadow hover:shadow-xs"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)' }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              {link.link_type === 'new_freelancer' ? (
                <Plus className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--info-text)' }} />
              ) : (
                <RotateCcw className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-purple-text, #7c3aed)' }} />
              )}
              <span className="font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                {link.link_type === 'new_freelancer' ? 'Novo Cadastro' : 'Atualização'}
              </span>
            </div>
            <p className="font-bold text-base text-text-primary truncate">{displayName}</p>
            {emailVal && <p className="text-xs text-text-muted truncate mt-0.5">{emailVal}</p>}
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            {renderStatusBadge(link.status)}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {renderRhStatusBadge(link)}
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-xs border-t pt-3" style={{ borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}>
          <div>
            <span className="font-bold uppercase tracking-wider text-[10px] text-text-muted">Criado por</span>
            <p className="mt-0.5 font-bold text-text-primary truncate">{link.creator?.full_name || '—'}</p>
            <p className="mt-0.5 text-[11px] text-text-muted">
              {new Date(link.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          </div>
          <div>
            <span className="font-bold uppercase tracking-wider text-[10px] text-text-muted">
              {link.used_at ? 'Preenchido em' : 'Expira em'}
            </span>
            <p className="mt-0.5 font-bold text-text-primary">
              {link.used_at
                ? new Date(link.used_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                : link.expires_at
                  ? new Date(link.expires_at).toLocaleDateString('pt-BR')
                  : 'Sem expiração'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: 'var(--border-soft)' }}>
          <div className="flex items-center gap-1.5">
            {clearToken && link.status === 'active' && (
              <button
                onClick={() => handleCopyLink(clearToken, link.link_type, link.id)}
                className="p-2 rounded-xl transition cursor-pointer"
                style={{ background: 'var(--neutral-bg)', color: 'var(--neutral-text)' }}
                aria-label="Copiar link"
              >
                {isCopied ? <Check className="w-4 h-4" style={{ color: 'var(--success-text)' }} /> : <Copy className="w-4 h-4" />}
              </button>
            )}
            {link.status === 'active' && (
              <button
                onClick={() => handleOpenQRModal(link)}
                className="p-2 rounded-xl transition cursor-pointer"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                aria-label="Ver QR Code"
              >
                <QrCode className="w-4 h-4" />
              </button>
            )}
            {isMasterOrRh && link.status === 'active' && (
              <button
                onClick={() => handleRevokeLink(link.id)}
                className="p-2 rounded-xl transition cursor-pointer"
                style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)' }}
                aria-label="Revogar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          {link.submission && (
            <button
              onClick={() => setSelectedSubmissionForView(link.submission)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs cursor-pointer"
              style={{ background: 'var(--info-bg)', color: 'var(--info-text)' }}
            >
              <Eye className="w-3.5 h-3.5" /> Ver Submissão
            </button>
          )}
        </div>
      </div>
    );
  };

  const totalItems = filteredLinks.length;

  const hasActiveFilters = searchQuery || filterType !== 'all' || filterStatus !== 'all' || filterRhStatus !== 'all';

  return (
    <div className="space-y-5 w-full min-w-0">

      {/* ── Toast Stack ──────────────────────────────────────────────────────── */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl shadow-lg border text-sm font-semibold animate-fade-in"
            style={{
              minWidth: 280,
              background: t.type === 'success' ? 'var(--success-bg)' : t.type === 'error' ? 'var(--danger-bg)' : 'var(--info-bg)',
              borderColor: t.type === 'success' ? 'var(--success-border)' : t.type === 'error' ? 'var(--danger-border)' : 'var(--info-border)',
              color: t.type === 'success' ? 'var(--success-text)' : t.type === 'error' ? 'var(--danger-text)' : 'var(--info-text)',
            }}
          >
            {t.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition"
              aria-label="Fechar notificação"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* ── Inline Confirmation Modal ─────────────────────────────────────────── */}
      {confirmModal.open && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(6,17,31,0.72)', backdropFilter: 'blur(4px)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
        >
          <div
            className="w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)' }}
          >
            <div className="p-5 flex items-start gap-3">
              <div
                className="p-2 rounded-xl shrink-0"
                style={{ background: 'var(--danger-bg)' }}
              >
                <AlertTriangle className="w-5 h-5" style={{ color: 'var(--danger-text)' }} />
              </div>
              <div>
                <h3
                  id="confirm-modal-title"
                  className="font-extrabold text-sm"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {confirmModal.title}
                </h3>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {confirmModal.description}
                </p>
              </div>
            </div>
            <div
              className="flex gap-2 px-5 pb-5"
            >
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}
                className="flex-1 py-2.5 rounded-xl border font-bold text-sm transition cursor-pointer"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="flex-1 py-2.5 rounded-xl font-black text-sm transition cursor-pointer"
                style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger-border)', color: 'var(--danger-text)', border: '1px solid' }}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Links Públicos / QR Codes
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Gere acessos temporários e acompanhe cadastros, atualizações e avaliações externas.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isMasterOrRh && (
            <button
              onClick={() => setCleanupModalOpen(true)}
              className="px-3 py-2 rounded-xl border font-bold text-sm transition flex items-center gap-1.5 cursor-pointer"
              style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger-border)', color: 'var(--danger-text)' }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpar histórico de testes</span>
              <span className="sm:hidden">Limpar</span>
            </button>
          )}
          <button
            onClick={fetchLinks}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl border font-bold text-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}
            aria-label="Atualizar lista de links"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* ── Generate Link Panel (horizontal, full-width) ──────────────────────── */}
      <div
        className="w-full rounded-3xl border shadow-sm p-5"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)' }}
      >
        <div className="mb-4">
          <h3 className="font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>
            Gerar Novo Acesso Temporário
          </h3>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Crie links ou QR Codes seguros, individuais e com prazo de expiração.
          </p>
        </div>

        <form onSubmit={handleGenerateLink}>
          {/* Desktop: horizontal grid — Mobile: stacked */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">

            {/* Finalidade */}
            {isMasterOrRh && (
              <div className={`space-y-1 ${linkFormType === 'update_freelancer' ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
                <label className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                  Finalidade do Form
                </label>
                <div className="flex gap-2 h-[42px]">
                  <button
                    type="button"
                    onClick={() => setLinkFormType('new_freelancer')}
                    className={`flex-1 rounded-xl border text-center font-bold text-sm transition select-none cursor-pointer transition-all duration-200 ${
                      linkFormType === 'new_freelancer'
                        ? 'bg-action-cyan text-slate-950 border-action-cyan shadow-sm font-extrabold'
                        : 'bg-transparent text-text-secondary border-border-soft hover:bg-bg-hover'
                    }`}
                  >
                    Novo Cadastro
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkFormType('update_freelancer')}
                    className={`flex-1 rounded-xl border text-center font-bold text-sm transition select-none cursor-pointer transition-all duration-200 ${
                      linkFormType === 'update_freelancer'
                        ? 'bg-action-cyan text-slate-950 border-action-cyan shadow-sm font-extrabold'
                        : 'bg-transparent text-text-secondary border-border-soft hover:bg-bg-hover'
                    }`}
                  >
                    Atualização
                  </button>
                </div>
              </div>
            )}

            {/* Freelancer selector — only when update_freelancer */}
            {linkFormType === 'update_freelancer' && (
              <div className="space-y-1 lg:col-span-4 sm:col-span-2">
                <label htmlFor="pl-freela-select" className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                  Selecionar Freelancer *
                </label>
                <select
                  id="pl-freela-select"
                  required
                  value={selectedFreelaId}
                  onChange={e => setSelectedFreelaId(e.target.value)}
                  className="w-full border rounded-xl p-2.5 outline-none text-sm cursor-pointer h-[42px]"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
                >
                  <option value="">Escolha da base geral...</option>
                  {[...db.freelancers]
                    .filter((f: any) => !f.mergedIntoFreelancerId && f.status !== 'Inativo' && f.status !== 'Bloqueado')
                    .sort((a: any, b: any) => a.name.localeCompare(b.name))
                    .map((f: any) => {
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

            {/* Prazo de Expiração */}
            <div className={`space-y-1 ${linkFormType === 'update_freelancer' ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              <label htmlFor="pl-expires" className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                Prazo de Expiração
              </label>
              <select
                id="pl-expires"
                value={expiresDays}
                onChange={e => setExpiresDays(e.target.value)}
                className="w-full border rounded-xl p-2.5 outline-none text-sm cursor-pointer h-[42px]"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
              >
                <option value="7">7 dias (Recomendado)</option>
                <option value="15">15 dias</option>
                <option value="30">30 dias</option>
                <option value="never">Sem expiração</option>
              </select>
            </div>

            {/* Spacer when no freelancer select */}
            {!isMasterOrRh && <div className="hidden lg:block lg:col-span-4" />}
            {isMasterOrRh && linkFormType === 'new_freelancer' && <div className="hidden lg:block lg:col-span-2" />}

            {/* Generate Button */}
            <div className={`${linkFormType === 'update_freelancer' ? 'lg:col-span-3' : 'lg:col-span-3'} sm:col-span-2`}>
              <button
                type="submit"
                disabled={isActionLoading}
                className="w-full font-black py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition select-none cursor-pointer disabled:opacity-50 shadow-sm h-[42px] text-sm"
                style={{ background: '#00BCD4', color: '#0F2342' }}
              >
                {isActionLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <QrCode className="w-4 h-4" />}
                Gerar QR Code &amp; Link
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ── History Block — full width ────────────────────────────────────────── */}
      <div
        className="w-full rounded-3xl border shadow-sm"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)' }}
      >
        {/* Block header */}
        <div
          className="px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-t-3xl"
          style={{ borderColor: 'var(--border-soft)', background: 'var(--table-header-bg)' }}
        >
          <div>
            <h3 className="font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>
              Histórico de Links de Cadastro
            </h3>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Lista de links criados temporariamente para preenchimento público.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile filter toggle */}
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="lg:hidden px-3 py-2 rounded-xl border font-bold text-sm flex items-center gap-1.5 cursor-pointer"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}
              aria-label="Abrir filtros"
            >
              <Filter className="w-3.5 h-3.5" />
              Filtros
              {hasActiveFilters && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: 'var(--accent)' }}
                />
              )}
            </button>
          </div>
        </div>

        {/* Desktop filters */}
        <div
          className="hidden lg:block px-6 py-4 border-b"
          style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-surface-elevated)' }}
        >
          <FiltersBar
            searchQuery={searchQuery}
            filterType={filterType}
            filterStatus={filterStatus}
            filterRhStatus={filterRhStatus}
            sortBy={sortBy}
            onSearchChange={v => setSearchQuery(v)}
            onFilterTypeChange={v => setFilterType(v)}
            onFilterStatusChange={v => setFilterStatus(v)}
            onFilterRhStatusChange={v => setFilterRhStatus(v)}
            onSortByChange={v => setSortBy(v)}
          />
        </div>

        {/* Mobile filter drawer */}
        {mobileFiltersOpen && (
          <div
            className="fixed inset-0 z-[100] flex flex-col justify-end lg:hidden animate-fade-in"
            style={{ background: 'rgba(6,17,31,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setMobileFiltersOpen(false)}
          >
            <div
              className="rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
              style={{ background: 'var(--bg-surface)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>Filtros</h3>
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="p-2 rounded-xl"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="Fechar filtros"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <FiltersBar
                searchQuery={searchQuery}
                filterType={filterType}
                filterStatus={filterStatus}
                filterRhStatus={filterRhStatus}
                sortBy={sortBy}
                onSearchChange={v => setSearchQuery(v)}
                onFilterTypeChange={v => setFilterType(v)}
                onFilterStatusChange={v => setFilterStatus(v)}
                onFilterRhStatusChange={v => setFilterRhStatus(v)}
                onSortByChange={v => setSortBy(v)}
              />
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="w-full py-3 rounded-xl font-extrabold text-sm"
                style={{ background: '#00BCD4', color: '#0F2342' }}
              >
                Aplicar filtros
              </button>
            </div>
          </div>
        )}

        {/* Table Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          ) : links.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center select-none" style={{ color: 'var(--text-secondary)' }}>
              <Calendar className="w-10 h-10 mb-3" style={{ color: 'var(--text-disabled)' }} />
              <p className="font-bold text-base">Nenhum link gerado ainda.</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Use o painel acima para criar o primeiro acesso temporário.
              </p>
            </div>
          ) : sortedLinks.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center select-none" style={{ color: 'var(--text-secondary)' }}>
              <Calendar className="w-10 h-10 mb-3" style={{ color: 'var(--text-disabled)' }} />
              <p className="font-bold text-base">Nenhum link encontrado com os filtros aplicados.</p>
              <button
                onClick={() => { setSearchQuery(''); setFilterType('all'); setFilterStatus('all'); setFilterRhStatus('all'); }}
                className="mt-3 px-4 py-2 rounded-xl border text-sm font-bold cursor-pointer"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <ResponsiveDataTable
                columns={columns}
                data={sortedLinks}
                rowKey={(link) => link.id}
                isLoading={isLoading}
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onSort={requestSort}
                mobileRenderer={mobileLinkRenderer}
              />
              
              <div className="flex justify-end text-xs text-text-muted select-none font-medium pr-1">
                Total: {totalItems} {totalItems === 1 ? 'link listado' : 'links listados'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Cleanup Modal ─────────────────────────────────────────────────────── */}
      {cleanupModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(6,17,31,0.72)', backdropFilter: 'blur(4px)' }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)' }}
          >
            <div>
              <h3 className="text-base font-extrabold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Trash2 className="w-5 h-5" style={{ color: 'var(--danger-text)' }} />
                Limpar histórico de links
              </h3>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Esta ação removerá links públicos de teste e seus registros associados. Não serão apagados freelancers oficiais já aprovados.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                Opções de Limpeza
              </label>

              {[
                { value: 1, title: '1. Limpar apenas links sem submissão', desc: 'Remove apenas links ativos, expirados ou revogados que nunca foram acessados ou preenchidos.' },
                { value: 2, title: '2. Limpar links usados e submissões pendentes', desc: 'Remove submissões ainda pendentes de análise RH de teste e seus respectivos links usados.' },
                { value: 3, title: '3. Limpar todo o histórico de links e submissões', desc: 'Limpa absolutamente todo o histórico e submissões da tela, mas mantém os freelancers oficiais na base do banco.' },
              ].map(opt => (
                <label
                  key={opt.value}
                  className="flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition select-none"
                  style={{ borderColor: cleanupOption === opt.value ? 'var(--accent)' : 'var(--border-soft)', background: 'var(--bg-surface-elevated)' }}
                >
                  <input
                    type="radio"
                    name="cleanup_option"
                    checked={cleanupOption === opt.value}
                    onChange={() => setCleanupOption(opt.value)}
                    className="mt-0.5 accent-cyan-500"
                  />
                  <div>
                    <p className="font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}>{opt.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setCleanupModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border font-extrabold text-sm transition cursor-pointer"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCleanupHistory}
                disabled={isActionLoading}
                className="flex-1 py-2.5 rounded-xl font-black text-sm transition cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50 border"
                style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger-border)', color: 'var(--danger-text)' }}
              >
                {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash className="w-3.5 h-3.5" />}
                Confirmar Limpeza
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Submission Details Drawer ─────────────────────────────────────────── */}
      {selectedSubmissionForView && (
        <div
          className="fixed inset-0 z-50 flex justify-end animate-fade-in"
          style={{ background: 'rgba(6,17,31,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelectedSubmissionForView(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full md:w-[500px] h-full shadow-2xl flex flex-col animate-slide-in"
            style={{ background: 'var(--bg-surface)' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="p-6 border-b flex justify-between items-center select-none"
              style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-surface-elevated)' }}
            >
              <div>
                <h3 className="text-base font-extrabold" style={{ color: 'var(--text-primary)' }}>
                  Submissão do Candidato
                </h3>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Enviada em {new Date(selectedSubmissionForView.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <button
                onClick={() => setSelectedSubmissionForView(null)}
                className="p-2 rounded-xl transition cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Fechar drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ color: 'var(--text-primary)' }}>
              {/* Status Section */}
              <div
                className="p-4 rounded-2xl border flex justify-between items-center select-none"
                style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-soft)' }}
              >
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                    Status da Análise RH
                  </span>
                  <span className="font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {getLinkRhStatus({ submission: selectedSubmissionForView }).label}
                  </span>
                </div>
                <div className="flex gap-2">
                  {isMasterOrRh && (selectedSubmissionForView.status === 'pending_review' || selectedSubmissionForView.status === 'under_review') && (
                    <button
                      onClick={() => {
                        setSelectedSubmissionForView(null);
                        db.setActiveTab('Análise de Pré-cadastros');
                      }}
                      className="px-3.5 py-2 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm cursor-pointer"
                      style={{ background: '#00BCD4', color: '#0F2342' }}
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
                      className="px-3.5 py-2 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-sm cursor-pointer"
                      style={{ background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}
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
                      className="px-3.5 py-2 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-sm cursor-pointer"
                      style={{ background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}
                    >
                      Ver Freela
                    </button>
                  )}
                </div>
              </div>

              {/* Notes Section if reviewed */}
              {selectedSubmissionForView.reviewed_at && (
                <div
                  className="p-4 rounded-2xl border space-y-2 select-none"
                  style={{ background: 'var(--warning-bg)', borderColor: 'var(--warning-border)' }}
                >
                  <div className="flex justify-between items-center text-xs font-bold" style={{ color: 'var(--warning-text)' }}>
                    <span>Revisado em {new Date(selectedSubmissionForView.reviewed_at).toLocaleDateString('pt-BR')}</span>
                    <span>Por: {selectedSubmissionForView.reviewer?.full_name || 'Sistema'}</span>
                  </div>
                  <p className="text-sm leading-relaxed italic" style={{ color: 'var(--text-primary)' }}>
                    {selectedSubmissionForView.review_notes || 'Sem observações.'}
                  </p>
                </div>
              )}

              {/* Submission Details */}
              {selectedSubmissionForView.submission_type === 'update_freelancer' ? (
                <div className="space-y-3">
                  <h4 className="font-extrabold text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Alterações Solicitadas
                  </h4>
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
                  <div className="p-4 rounded-2xl border space-y-3" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-soft)' }}>
                    <h4 className="font-extrabold pb-1 border-b uppercase tracking-wider text-xs" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-soft)' }}>
                      Dados Pessoais &amp; Contato
                    </h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>Nome Completo:</strong> {selectedSubmissionForView.submitted_data.full_name}</p>
                      <p><strong>E-mail:</strong> {selectedSubmissionForView.submitted_data.email || '—'}</p>
                      <p><strong>WhatsApp:</strong> {selectedSubmissionForView.submitted_data.whatsapp || '—'}</p>
                      <p><strong>Localidade:</strong> {selectedSubmissionForView.submitted_data.city}/{selectedSubmissionForView.submitted_data.state} {selectedSubmissionForView.submitted_data.location_text && `(${selectedSubmissionForView.submitted_data.location_text})`}</p>
                    </div>
                  </div>

                  {/* Perfil Profissional */}
                  <div className="p-4 rounded-2xl border space-y-3" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-soft)' }}>
                    <h4 className="font-extrabold pb-1 border-b uppercase tracking-wider text-xs" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-soft)' }}>
                      Perfil Profissional
                    </h4>
                    <div className="space-y-2 text-sm">
                      <p>
                        <strong>Função Principal:</strong>{' '}
                        {functions.find(f => f.id === selectedSubmissionForView.submitted_data.main_function_id)?.name || selectedSubmissionForView.submitted_data.main_function_id || '—'}
                      </p>
                      <p>
                        <strong>Senioridade:</strong>{' '}
                        <span
                          className="px-1.5 py-0.5 rounded uppercase font-bold text-xs border"
                          style={{ background: 'var(--info-bg)', color: 'var(--info-text)', borderColor: 'var(--info-border)' }}
                        >
                          {selectedSubmissionForView.submitted_data.seniority || '—'}
                        </span>
                      </p>
                      <p><strong>Situação Atual:</strong> {selectedSubmissionForView.submitted_data.current_situation || '—'}</p>
                      <p><strong>Disponibilidade:</strong> {selectedSubmissionForView.submitted_data.availability || '—'}</p>
                      <div>
                        <strong>Segmentos / Indústrias:</strong>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {selectedSubmissionForView.submitted_data.industries?.map((id: string) => {
                            const name = industries.find(i => i.id === id)?.name || id;
                            return (
                              <span
                                key={id}
                                className="px-2 py-0.5 rounded-md text-xs font-bold"
                                style={{ background: 'var(--neutral-bg)', color: 'var(--neutral-text)', border: '1px solid var(--neutral-border)' }}
                              >
                                {name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Portfólio */}
                  <div className="p-4 rounded-2xl border space-y-3" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-soft)' }}>
                    <h4 className="font-extrabold pb-1 border-b uppercase tracking-wider text-xs" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-soft)' }}>
                      Portfólio &amp; Links
                    </h4>
                    <div className="space-y-2 text-sm">
                      {selectedSubmissionForView.submitted_data.portfolio_url && (
                        <p>
                          <strong>Portfólio URL:</strong>{' '}
                          <a
                            href={selectedSubmissionForView.submitted_data.portfolio_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold hover:underline inline-flex items-center gap-0.5"
                            style={{ color: 'var(--info-text)' }}
                          >
                            {selectedSubmissionForView.submitted_data.portfolio_url}
                          </a>
                        </p>
                      )}
                      {selectedSubmissionForView.submitted_data.linkedin_url && (
                        <p>
                          <strong>LinkedIn:</strong>{' '}
                          <a
                            href={selectedSubmissionForView.submitted_data.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold hover:underline inline-flex items-center gap-0.5"
                            style={{ color: 'var(--info-text)' }}
                          >
                            {selectedSubmissionForView.submitted_data.linkedin_url}
                          </a>
                        </p>
                      )}
                      {selectedSubmissionForView.submitted_data.portfolio_file_url && (
                        <div className="pt-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-soft)' }}>
                          <span className="font-bold">Portfólio Anexo:</span>
                          <a
                            href={selectedSubmissionForView.submitted_data.portfolio_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg flex items-center gap-1 transition text-xs font-extrabold"
                            style={{ background: '#0F2342', color: '#fff' }}
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

      {/* ── QR Code Viewer Modal ─────────────────────────────────────────────── */}
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
