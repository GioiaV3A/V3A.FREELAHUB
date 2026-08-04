'use client';

import React, { useState, useMemo } from 'react';
import { DatabaseProps } from '@/app/page';
import {
  Building,
  Plus,
  Save,
  Users,
  Edit2,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Check,
  Loader2,
  Copy,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { mapNucleoToUI, mapProfileToUser, getRoleLabel } from '@/lib/dbMapper';
import {
  createNucleoWithOptionalHeadUserAction,
  createRetroactiveHeadUserAction
} from '@/app/actions/admin';
import { useSortableTable } from '@/hooks/useSortableTable';
import { SortableHeader } from '@/components/SortableHeader';

// ─── Inline Toast ─────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Toast { id: number; type: ToastType; message: string; }

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = React.useRef(0);
  const addToast = (type: ToastType, message: string) => {
    const id = ++counter.current;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };
  const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));
  return { toasts, addToast, removeToast };
}

// ─── Inline Confirm Modal ─────────────────────────────────────────────────────
interface ConfirmState {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
}


export default function NucleosPanel({ db }: { db: any }) {
  const { toasts, addToast, removeToast } = useToasts();

  // ── "Register Nucleo" Modal State ─────────────────────────────────────────
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [headName, setHeadName] = useState('');
  const [headEmail, setHeadEmail] = useState('');
  const [createHeadUser, setCreateHeadUser] = useState(false);
  const [headPassword, setHeadPassword] = useState('');
  const [headConfirmPassword, setHeadConfirmPassword] = useState('');
  const [registerFormError, setRegisterFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Retroactive User Creation Modal State
  const [isRetroactiveModalOpen, setIsRetroactiveModalOpen] = useState(false);
  const [retroactiveNucleo, setRetroactiveNucleo] = useState<any | null>(null);
  const [retroactivePassword, setRetroactivePassword] = useState('');
  const [retroactiveConfirmPassword, setRetroactiveConfirmPassword] = useState('');

  // Edit Nucleo Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editNucleo, setEditNucleo] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editHeadName, setEditHeadName] = useState('');
  const [editHeadEmail, setEditHeadEmail] = useState('');
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // Inline confirm modal
  const [confirmModal, setConfirmModal] = useState<ConfirmState>({
    open: false, title: '', description: '', confirmLabel: 'Confirmar', onConfirm: () => {},
  });



  // Search / filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterHeadUserStatus, setFilterHeadUserStatus] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Highlight newly added nucleo
  const [newNucleoId, setNewNucleoId] = useState<string | null>(null);

  const canManage = getRoleLabel(db.currentUser?.profile) === 'MASTER'
    || getRoleLabel(db.currentUser?.profile) === 'RH'
    || getRoleLabel(db.currentUser?.profile) === 'C-LEVEL';

  // ── Derived data ─────────────────────────────────────────────────────────
  const getHeadUserStatus = React.useCallback((nuc: any) => {
    if (!nuc.headEmail) return 'Usuário não criado';
    const linkedUser = db.users.find(
      (u: any) => u.email.trim().toLowerCase() === nuc.headEmail.trim().toLowerCase()
    );
    if (!linkedUser) return 'Usuário não criado';
    if (linkedUser.status === 'Inativo') return 'Usuário inativo';
    if (linkedUser.firstAccessPending) return 'Primeiro acesso pendente';
    return 'Usuário criado';
  }, [db.users]);

  const nucleosWithCalculated = useMemo(() => {
    return db.nucleos.map((nuc: any) => ({
      ...nuc,
      headUserStatus: getHeadUserStatus(nuc),
      jobsCount: db.jobs.filter((j: any) => j.nucleoId === nuc.id).length,
      allocationsCount: db.allocations.filter((a: any) => a.nucleoId === nuc.id).length,
    }));
  }, [db.nucleos, db.jobs, db.allocations, getHeadUserStatus]);

  // ── Filtered nucleos ─────────────────────────────────────────────────────
  const filteredNucleos = useMemo(() => {
    let result = [...nucleosWithCalculated];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(n =>
        n.name?.toLowerCase().includes(q) ||
        n.id?.toLowerCase().includes(q) ||
        n.headName?.toLowerCase().includes(q) ||
        n.headEmail?.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') {
      result = result.filter(n => n.status === filterStatus);
    }
    if (filterHeadUserStatus !== 'all') {
      result = result.filter(n => n.headUserStatus === filterHeadUserStatus);
    }
    return result;
  }, [nucleosWithCalculated, searchQuery, filterStatus, filterHeadUserStatus]);

  const { data: sortedNucleos, sortKey, sortDirection, requestSort } = useSortableTable(
    filteredNucleos,
    'name',
    'asc'
  );

  const totalItems = filteredNucleos.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedNucleos = sortedNucleos.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // ── KPI Summary ────────────────────────────────────────────────────────
  const kpi = useMemo(() => ({
    ativos: db.nucleos.filter((n: any) => n.status === 'Ativo').length,
    semHead: db.nucleos.filter((n: any) => !n.headEmail).length,
    headSemUsuario: nucleosWithCalculated.filter((n: any) => n.headUserStatus === 'Usuário não criado' && n.headEmail).length,
    totalDemandas: db.jobs.length,
    totalAlocacoes: db.allocations.length,
  }), [db.nucleos, db.jobs, db.allocations, nucleosWithCalculated]);

  // ── Handle Create Nucleo ───────────────────────────────────────────────
  const handleCreateNucleo = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterFormError(null);

    if (!name || !headName || !headEmail) {
      setRegisterFormError('Preencha todos os campos obrigatórios: Nome do Núcleo, Líder e E-mail corporativo.');
      return;
    }

    if (createHeadUser) {
      if (!headPassword || !headConfirmPassword) {
        setRegisterFormError('Preencha a senha inicial e a confirmação para o novo usuário do Head.');
        return;
      }
      if (headPassword !== headConfirmPassword) {
        setRegisterFormError('As senhas informadas não coincidem.');
        return;
      }
    }

    const existingUser = db.users.find(
      (u: any) => u.email.trim().toLowerCase() === headEmail.trim().toLowerCase()
    );

    // Check for conflicting profile
    if (createHeadUser && existingUser) {
      if (getRoleLabel(existingUser.profile) === 'MASTER' || getRoleLabel(existingUser.profile) === 'RH') {
        setRegisterFormError('Este e-mail está associado a um usuário MASTER ou RH. Não é permitido vinculá-lo como Head de Núcleo.');
        return;
      }
      if (getRoleLabel(existingUser.profile) === 'NÚCLEO') {
        // Show inline confirm instead of native confirm()
        setConfirmModal({
          open: true,
          title: 'Usuário existente encontrado',
          description: `Já existe um usuário de Núcleo cadastrado com este e-mail (${existingUser.name}). Deseja vinculá-lo a este novo núcleo?`,
          confirmLabel: 'Vincular',
          variant: 'warning',
          onConfirm: () => {
            setConfirmModal(prev => ({ ...prev, open: false }));
            doCreateNucleo(false, existingUser);
          },
        });
        return;
      }
    }

    doCreateNucleo(createHeadUser && !existingUser, existingUser);
  };

  const doCreateNucleo = async (shouldCreateUser: boolean, existingUser: any) => {
    setIsSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';

      const res = await createNucleoWithOptionalHeadUserAction(token, {
        nucleoName: name,
        headName,
        headEmail,
        createHeadUser: shouldCreateUser,
        initialPassword: headPassword,
        confirmInitialPassword: headConfirmPassword,
      });

      if (!res.success) {
        setRegisterFormError(`Erro ao salvar: ${res.error}`);
        setIsSaving(false);
        return;
      }

      // Update local state for nucleos
      const mappedNuc = mapNucleoToUI(res.nucleo);
      db.setNucleos((prev: any) => [...prev, mappedNuc]);
      setNewNucleoId(res.nucleo.id);
      setTimeout(() => setNewNucleoId(null), 3500);

      // Update local state for users
      if (res.userCreated && res.profile) {
        const mappedUser = mapProfileToUser(res.profile);
        db.setUsers((prevUsers: any) => [mappedUser, ...prevUsers]);
        addToast('success', `Núcleo "${name}" criado com sucesso. O usuário do Head foi cadastrado e deverá alterar a senha no primeiro acesso.`);
      } else if (existingUser && getRoleLabel(existingUser.profile) === 'NÚCLEO') {
        db.setUsers((prevUsers: any) => prevUsers.map((u: any) => {
          if (u.id === existingUser.id) {
            return { ...u, nucleoId: res.nucleo.id, role: `Head de ${name}` };
          }
          return u;
        }));
        addToast('success', `Núcleo "${name}" cadastrado e vinculado ao usuário existente do Head.`);
      } else {
        addToast('success', `Núcleo "${name}" criado com sucesso.`);
      }

      // Reset form and close modal
      setName(''); setHeadName(''); setHeadEmail('');
      setCreateHeadUser(false); setHeadPassword(''); setHeadConfirmPassword('');
      setRegisterFormError(null);
      setIsRegisterModalOpen(false);
    } catch (err: any) {
      setRegisterFormError(`Erro inesperado: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Handle Retroactive User Creation ─────────────────────────────────────
  const handleCreateRetroactiveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retroactiveNucleo) return;

    if (!retroactivePassword || !retroactiveConfirmPassword) {
      addToast('error', 'Preencha a senha inicial e a confirmação.');
      return;
    }
    if (retroactivePassword !== retroactiveConfirmPassword) {
      addToast('error', 'As senhas informadas não coincidem.');
      return;
    }

    const existingUser = db.users.find(
      (u: any) => u.email.trim().toLowerCase() === retroactiveNucleo.headEmail.trim().toLowerCase()
    );

    setIsSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';

      if (existingUser) {
        if (getRoleLabel(existingUser.profile) === 'MASTER' || getRoleLabel(existingUser.profile) === 'RH') {
          addToast('error', 'Este e-mail está associado a um usuário MASTER ou RH. Não é permitido vinculá-lo como Head de Núcleo.');
          setIsSaving(false);
          return;
        }
        if (getRoleLabel(existingUser.profile) === 'NÚCLEO') {
          setConfirmModal({
            open: true,
            title: 'Usuário existente encontrado',
            description: `Já existe um usuário de Núcleo cadastrado com este e-mail (${existingUser.name}). Deseja vinculá-lo a este núcleo?`,
            confirmLabel: 'Vincular',
            variant: 'warning',
            onConfirm: () => {
              setConfirmModal(prev => ({ ...prev, open: false }));
              db.setUsers((prevUsers: any) => prevUsers.map((u: any) => {
                if (u.id === existingUser.id) {
                  return { ...u, nucleoId: retroactiveNucleo.id, role: `Head de ${retroactiveNucleo.name}` };
                }
                return u;
              }));
              addToast('success', 'Usuário de núcleo existente vinculado com sucesso!');
              setIsRetroactiveModalOpen(false);
            },
          });
          setIsSaving(false);
          return;
        }
      }

      const res = await createRetroactiveHeadUserAction(token, {
        nucleoId: retroactiveNucleo.id,
        headName: retroactiveNucleo.headName,
        headEmail: retroactiveNucleo.headEmail,
        initialPassword: retroactivePassword,
        confirmInitialPassword: retroactiveConfirmPassword,
      });

      if (!res.success) {
        addToast('error', `Erro ao criar usuário: ${res.error}`);
        setIsSaving(false);
        return;
      }

      if (res.profile) {
        const mappedUser = mapProfileToUser(res.profile);
        db.setUsers((prevUsers: any) => [mappedUser, ...prevUsers]);
        addToast('success', 'Usuário do Head criado retroativamente com sucesso!');
      }

      setIsRetroactiveModalOpen(false);
      setRetroactivePassword(''); setRetroactiveConfirmPassword('');
    } catch (err: any) {
      addToast('error', `Erro inesperado: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Handle Edit Nucleo ────────────────────────────────────────────────────
  const handleEditNucleoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNucleo) return;
    if (!editName || !editHeadName || !editHeadEmail) {
      setEditFormError('Preencha todos os campos obrigatórios.');
      return;
    }
    setIsSaving(true);
    try {
      db.setNucleos((prev: any[]) => prev.map(n => {
        if (n.id === editNucleo.id) {
          return { ...n, name: editName, headName: editHeadName, headEmail: editHeadEmail };
        }
        return n;
      }));
      addToast('success', 'Núcleo atualizado com sucesso!');
      setIsEditModalOpen(false);
      setEditFormError(null);
    } catch (err: any) {
      setEditFormError(`Erro ao atualizar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Handle Toggle Status ─────────────────────────────────────────────────
  const handleToggleStatus = (nuc: any) => {
    if (nuc.status === 'Ativo') {
      // Show inline text input via confirm modal — simplified: we ask for reason in description
      setConfirmModal({
        open: true,
        title: `Inativar núcleo "${nuc.name}"`,
        description: 'Esta ação realizará a inativação (soft delete) do núcleo. O registro será mantido no banco de dados. Confirme para prosseguir.',
        confirmLabel: 'Inativar',
        variant: 'danger',
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, open: false }));
          db.setNucleos((prev: any[]) => prev.map(n => {
            if (n.id === nuc.id) {
              return {
                ...n,
                status: 'Inativo',
                archivedAt: new Date().toISOString(),
                archivedBy: db.currentUser.id,
              };
            }
            return n;
          }));
          addToast('success', `Núcleo "${nuc.name}" inativado com sucesso.`);
        },
      });
    } else {
      setConfirmModal({
        open: true,
        title: `Reativar núcleo "${nuc.name}"`,
        description: 'O núcleo voltará a aparecer como ativo na listagem.',
        confirmLabel: 'Reativar',
        variant: 'warning',
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, open: false }));
          db.setNucleos((prev: any[]) => prev.map(n => {
            if (n.id === nuc.id) {
              return { ...n, status: 'Ativo', archivedAt: null, archivedBy: null, archiveReason: null };
            }
            return n;
          }));
          addToast('success', `Núcleo "${nuc.name}" reativado com sucesso.`);
        },
      });
    }
  };

  // ── Head User Status Badge ────────────────────────────────────────────────
  const renderHeadUserBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; border: string }> = {
      'Usuário criado':           { bg: 'var(--success-bg)',  text: 'var(--success-text)',  border: 'var(--success-border)' },
      'Primeiro acesso pendente': { bg: 'var(--warning-bg)',  text: 'var(--warning-text)',  border: 'var(--warning-border)' },
      'Usuário não criado':       { bg: 'var(--neutral-bg)',  text: 'var(--neutral-text)',  border: 'var(--neutral-border)' },
      'Usuário inativo':          { bg: 'var(--danger-bg)',   text: 'var(--danger-text)',   border: 'var(--danger-border)' },
    };
    const s = map[status] || map['Usuário não criado'];
    return (
      <span
        style={{ background: s.bg, color: s.text, borderColor: s.border }}
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border select-none"
      >
        {status}
      </span>
    );
  };

  const renderStatusBadge = (status: string) => {
    const active = status === 'Ativo';
    return (
      <span
        style={
          active
            ? { background: 'var(--success-bg)', color: 'var(--success-text)', borderColor: 'var(--success-border)' }
            : { background: 'var(--neutral-bg)', color: 'var(--neutral-text)', borderColor: 'var(--neutral-border)' }
        }
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wide select-none"
      >
        {status}
      </span>
    );
  };

  // ── Copy to clipboard helper ──────────────────────────────────────────────
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const openRegisterModal = () => {
    setName(''); setHeadName(''); setHeadEmail('');
    setCreateHeadUser(false); setHeadPassword(''); setHeadConfirmPassword('');
    setRegisterFormError(null);
    setIsRegisterModalOpen(true);
  };

  return (
    <div id="nucleos-panel-container" className="space-y-6 w-full min-w-0">

      {/* ── Toast Stack ──────────────────────────────────────────────────────── */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl shadow-lg border text-sm font-semibold animate-fade-in"
            style={{
              minWidth: 280,
              background:
                t.type === 'success' ? 'var(--success-bg)' :
                t.type === 'error'   ? 'var(--danger-bg)'  :
                t.type === 'warning' ? 'var(--warning-bg)' : 'var(--info-bg)',
              borderColor:
                t.type === 'success' ? 'var(--success-border)' :
                t.type === 'error'   ? 'var(--danger-border)'  :
                t.type === 'warning' ? 'var(--warning-border)' : 'var(--info-border)',
              color:
                t.type === 'success' ? 'var(--success-text)' :
                t.type === 'error'   ? 'var(--danger-text)'  :
                t.type === 'warning' ? 'var(--warning-text)' : 'var(--info-text)',
            }}
          >
            {t.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="shrink-0 opacity-60 hover:opacity-100 transition" aria-label="Fechar">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* ── Confirm Modal ─────────────────────────────────────────────────────── */}
      {confirmModal.open && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(6,17,31,0.72)', backdropFilter: 'blur(4px)' }}
          role="dialog" aria-modal="true"
        >
          <div
            className="w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)' }}
          >
            <div className="p-5 flex items-start gap-3">
              <div className="p-2 rounded-xl shrink-0" style={{ background: confirmModal.variant === 'danger' ? 'var(--danger-bg)' : 'var(--warning-bg)' }}>
                <AlertTriangle className="w-5 h-5" style={{ color: confirmModal.variant === 'danger' ? 'var(--danger-text)' : 'var(--warning-text)' }} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}>{confirmModal.title}</h3>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{confirmModal.description}</p>
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}
                className="flex-1 py-2.5 rounded-xl border font-bold text-sm cursor-pointer"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="flex-1 py-2.5 rounded-xl font-black text-sm cursor-pointer border"
                style={
                  confirmModal.variant === 'danger'
                    ? { background: 'var(--danger-bg)', borderColor: 'var(--danger-border)', color: 'var(--danger-text)' }
                    : { background: 'var(--warning-bg)', borderColor: 'var(--warning-border)', color: 'var(--warning-text)' }
                }
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Cadastro e Setorização de Núcleos
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Gerencie núcleos operacionais, Heads responsáveis e históricos de demandas e alocações.
          </p>
        </div>
        {canManage && (
          <button
            onClick={openRegisterModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm transition cursor-pointer shrink-0 shadow-sm"
            style={{ background: '#00BCD4', color: '#0F2342' }}
          >
            <Plus className="w-4 h-4" />
            Registrar Novo Núcleo
          </button>
        )}
      </div>

      {/* ── KPI Summary Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Núcleos Ativos', value: kpi.ativos, color: 'var(--success-text)', bg: 'var(--success-bg)', border: 'var(--success-border)' },
          { label: 'Sem Head', value: kpi.semHead, color: 'var(--warning-text)', bg: 'var(--warning-bg)', border: 'var(--warning-border)' },
          { label: 'Head s/ Usuário', value: kpi.headSemUsuario, color: 'var(--neutral-text)', bg: 'var(--neutral-bg)', border: 'var(--neutral-border)' },
          { label: 'Total Demandas', value: kpi.totalDemandas, color: 'var(--info-text)', bg: 'var(--info-bg)', border: 'var(--info-border)' },
          { label: 'Total Alocações', value: kpi.totalAlocacoes, color: 'var(--text-secondary)', bg: 'var(--bg-surface)', border: 'var(--border-soft)' },
        ].map(k => (
          <div
            key={k.label}
            className="rounded-2xl border p-3 sm:p-4 flex flex-col gap-1 select-none"
            style={{ background: k.bg, borderColor: k.border }}
          >
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: k.color, opacity: 0.8 }}>
              {k.label}
            </span>
            <span className="text-2xl font-extrabold" style={{ color: k.color }}>
              {k.value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Main table block ─────────────────────────────────────────────────── */}
      <div
        className="w-full rounded-3xl border shadow-sm overflow-hidden"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)' }}
      >
        {/* Block header */}
        <div
          className="px-6 py-4 border-b flex items-center gap-2"
          style={{ borderColor: 'var(--border-soft)', background: 'var(--table-header-bg)' }}
        >
          <Building className="w-4 h-4 shrink-0" style={{ color: 'var(--text-secondary)' }} />
          <span className="font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>
            Núcleos Ativos na Agência ({db.nucleos.length})
          </span>
        </div>

        {/* Filters row */}
        <div
          className="px-6 py-4 border-b grid grid-cols-1 sm:grid-cols-3 gap-3"
          style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-surface-elevated)' }}
        >
          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Buscar por núcleo, Head ou ID..."
              className="w-full border rounded-xl py-2.5 pl-9 pr-3 outline-none text-sm"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
              aria-label="Buscar núcleos"
            />
          </div>
          {/* Filter status */}
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
            className="border rounded-xl py-2.5 px-3 outline-none text-sm cursor-pointer"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
            aria-label="Filtrar por status"
          >
            <option value="all">Todos os status</option>
            <option value="Ativo">Ativo</option>
            <option value="Inativo">Inativo</option>
          </select>
          {/* Filter head user status */}
          <select
            value={filterHeadUserStatus}
            onChange={e => { setFilterHeadUserStatus(e.target.value); setCurrentPage(1); }}
            className="border rounded-xl py-2.5 px-3 outline-none text-sm cursor-pointer"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
            aria-label="Filtrar por usuário do Head"
          >
            <option value="all">Usuário do Head: todos</option>
            <option value="Usuário criado">Usuário criado</option>
            <option value="Primeiro acesso pendente">Primeiro acesso pendente</option>
            <option value="Usuário não criado">Usuário não criado</option>
            <option value="Usuário inativo">Usuário inativo</option>
          </select>
        </div>

        {/* ── Desktop Table ─────────────────────────────────────────────────── */}
        <div className="hidden md:block overflow-x-auto">
          {paginatedNucleos.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center select-none" style={{ color: 'var(--text-secondary)' }}>
              <Building className="w-10 h-10 mb-3" style={{ color: 'var(--text-disabled)' }} />
              <p className="font-bold text-base">
                {searchQuery || filterStatus !== 'all' || filterHeadUserStatus !== 'all'
                  ? 'Nenhum núcleo encontrado com os filtros aplicados.'
                  : 'Nenhum núcleo cadastrado ainda.'}
              </p>
            </div>
          ) : (
            <table
              className="w-full text-left"
              style={{ tableLayout: 'fixed', minWidth: 900 }}
            >
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '8%' }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--table-border)', background: 'var(--table-header-bg)' }}>
                  <SortableHeader label="Núcleo" sortKey="name" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-5 py-3" />
                  <SortableHeader label="Head / Líder" sortKey="headName" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-5 py-3" />
                  <SortableHeader label="Acesso do Head" sortKey="headUserStatus" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-5 py-3" />
                  <SortableHeader label="Demandas" sortKey="jobsCount" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-5 py-3" />
                  <SortableHeader label="Alocações" sortKey="allocationsCount" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-5 py-3" />
                  <SortableHeader label="Status" sortKey="status" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-5 py-3" />
                  <th className="px-5 py-3 text-right text-xs font-extrabold uppercase tracking-wider" style={{ color: 'var(--table-header-text)' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedNucleos.map((nuc: any) => (
                  <tr
                    key={nuc.id}
                    style={{
                      borderBottom: '1px solid var(--table-border)',
                      background: nuc.id === newNucleoId ? 'var(--accent-soft)' : undefined,
                      transition: 'background 0.8s ease',
                    }}
                  >
                    {/* Núcleo */}
                    <td className="px-5 py-3">
                      <p className="font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}>{nuc.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs truncate max-w-[160px]" style={{ color: 'var(--text-muted)' }} title={nuc.id}>
                          ID: {nuc.id.slice(0, 12)}…
                        </span>
                        <button
                          onClick={() => handleCopyId(nuc.id)}
                          className="p-0.5 rounded transition cursor-pointer shrink-0"
                          style={{ color: 'var(--text-muted)' }}
                          aria-label="Copiar ID"
                          title="Copiar ID"
                        >
                          {copiedId === nuc.id
                            ? <Check className="w-3 h-3" style={{ color: 'var(--success-text)' }} />
                            : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                    {/* Head / Líder */}
                    <td className="px-5 py-3">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{nuc.headName || '—'}</p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }} title={nuc.headEmail}>{nuc.headEmail || '—'}</p>
                    </td>
                    {/* Acesso do Head */}
                    <td className="px-5 py-3">
                      {renderHeadUserBadge(nuc.headUserStatus)}
                    </td>
                    {/* Demandas */}
                    <td className="px-5 py-3">
                      <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                        {nuc.jobsCount}
                      </span>
                      <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>total</span>
                    </td>
                    {/* Alocações */}
                    <td className="px-5 py-3">
                      <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                        {nuc.allocationsCount}
                      </span>
                      <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>alocações</span>
                    </td>
                    {/* Status */}
                    <td className="px-5 py-3">
                      {renderStatusBadge(nuc.status)}
                    </td>
                    {/* Ações */}
                    <td className="px-5 py-3 text-right">
                      {canManage ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditNucleo(nuc);
                              setEditName(nuc.name);
                              setEditHeadName(nuc.headName || '');
                              setEditHeadEmail(nuc.headEmail || '');
                              setEditFormError(null);
                              setIsEditModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-lg border font-bold text-xs cursor-pointer transition"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
                            title="Editar núcleo"
                          >
                            Editar
                          </button>
                          {nuc.headUserStatus === 'Usuário não criado' && nuc.headEmail && (
                            <button
                              onClick={() => {
                                setRetroactiveNucleo(nuc);
                                setRetroactivePassword('');
                                setRetroactiveConfirmPassword('');
                                setIsRetroactiveModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg border font-bold text-xs cursor-pointer transition"
                              style={{ background: 'var(--info-bg)', borderColor: 'var(--info-border)', color: 'var(--info-text)' }}
                              title="Criar usuário para o Head"
                            >
                              + Usuário
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleStatus(nuc)}
                            className="px-2.5 py-1.5 rounded-lg border font-bold text-xs cursor-pointer transition"
                            style={
                              nuc.status === 'Ativo'
                                ? { background: 'var(--danger-bg)', borderColor: 'var(--danger-border)', color: 'var(--danger-text)' }
                                : { background: 'var(--success-bg)', borderColor: 'var(--success-border)', color: 'var(--success-text)' }
                            }
                            title={nuc.status === 'Ativo' ? 'Inativar núcleo' : 'Ativar núcleo'}
                          >
                            {nuc.status === 'Ativo' ? 'Inativar' : 'Ativar'}
                          </button>
                          <button
                            onClick={() => db.setActiveTab('Gestão de Usuários')}
                            className="p-1.5 rounded-lg border cursor-pointer transition"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }}
                            title="Gerenciar usuários"
                            aria-label="Gerenciar usuários"
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-disabled)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Mobile Cards ─────────────────────────────────────────────────────── */}
        <div className="md:hidden p-4 space-y-3">
          {paginatedNucleos.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center select-none" style={{ color: 'var(--text-secondary)' }}>
              <Building className="w-10 h-10 mb-3" style={{ color: 'var(--text-disabled)' }} />
              <p className="font-bold">Nenhum núcleo encontrado.</p>
            </div>
          ) : paginatedNucleos.map((nuc: any) => (
            <div
              key={nuc.id}
              className="rounded-2xl border p-4 space-y-3"
              style={{
                background: nuc.id === newNucleoId ? 'var(--accent-soft)' : 'var(--bg-surface)',
                borderColor: 'var(--border-soft)',
                transition: 'background 0.8s ease',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}>{nuc.name}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>ID: {nuc.id.slice(0, 12)}…</p>
                </div>
                {renderStatusBadge(nuc.status)}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Head</p>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{nuc.headName || '—'}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{nuc.headEmail || '—'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {renderHeadUserBadge(nuc.headUserStatus)}
                <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                  {nuc.jobsCount} demanda{nuc.jobsCount !== 1 ? 's' : ''}
                </span>
                <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                  {nuc.allocationsCount} alocação{nuc.allocationsCount !== 1 ? 'ões' : ''}
                </span>
              </div>
              {canManage && (
                <div className="flex items-center gap-2 border-t pt-3" style={{ borderColor: 'var(--border-soft)' }}>
                  <button
                    onClick={() => {
                      setEditNucleo(nuc);
                      setEditName(nuc.name);
                      setEditHeadName(nuc.headName || '');
                      setEditHeadEmail(nuc.headEmail || '');
                      setEditFormError(null);
                      setIsEditModalOpen(true);
                    }}
                    className="flex-1 py-2 rounded-xl border font-bold text-sm cursor-pointer"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
                  >
                    Editar
                  </button>
                  {nuc.headUserStatus === 'Usuário não criado' && nuc.headEmail && (
                    <button
                      onClick={() => {
                        setRetroactiveNucleo(nuc);
                        setRetroactivePassword('');
                        setRetroactiveConfirmPassword('');
                        setIsRetroactiveModalOpen(true);
                      }}
                      className="flex-1 py-2 rounded-xl border font-bold text-sm cursor-pointer"
                      style={{ background: 'var(--info-bg)', borderColor: 'var(--info-border)', color: 'var(--info-text)' }}
                    >
                      + Usuário
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleStatus(nuc)}
                    className="flex-1 py-2 rounded-xl border font-bold text-sm cursor-pointer"
                    style={
                      nuc.status === 'Ativo'
                        ? { background: 'var(--danger-bg)', borderColor: 'var(--danger-border)', color: 'var(--danger-text)' }
                        : { background: 'var(--success-bg)', borderColor: 'var(--success-border)', color: 'var(--success-text)' }
                    }
                  >
                    {nuc.status === 'Ativo' ? 'Inativar' : 'Ativar'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Pagination ─────────────────────────────────────────────────────── */}
        {totalItems > 0 && (
          <div
            className="flex flex-col sm:flex-row items-center justify-between border-t px-6 py-4 gap-3 select-none text-sm"
            style={{ borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>
              {totalItems === 0 ? '0 itens' : `${((currentPage - 1) * pageSize) + 1}–${Math.min(currentPage * pageSize, totalItems)} de ${totalItems} núcleos`}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  className="p-2 rounded-xl border cursor-pointer disabled:opacity-40 transition"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-bold px-1" style={{ color: 'var(--text-primary)' }}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  className="p-2 rounded-xl border cursor-pointer disabled:opacity-40 transition"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
                  aria-label="Próxima página"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ REGISTER NUCLEO MODAL ═══════════════════════════════════════════════ */}
      {isRegisterModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(6,17,31,0.72)', backdropFilter: 'blur(4px)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-nucleo-title"
        >
          <div
            className="w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border flex flex-col max-h-[90vh]"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)' }}
          >
            {/* Header */}
            <div
              className="px-6 py-5 flex items-center justify-between border-b shrink-0"
              style={{ background: '#636466', borderColor: '#636466' }}
            >
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5" style={{ color: '#00BCD4' }} />
                <div>
                  <h3 id="register-nucleo-title" className="font-extrabold text-base text-[var(--text-primary)]">
                    Registrar Novo Núcleo
                  </h3>
                  <p className="text-xs text-[var(--text-disabled)] mt-0.5">
                    Cadastre a unidade operacional e defina o Head responsável.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="p-2 rounded-xl text-[var(--text-disabled)] hover:text-[var(--text-primary)] transition cursor-pointer"
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form
              onSubmit={handleCreateNucleo}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              {/* Inline form error */}
              {registerFormError && (
                <div
                  className="flex items-start gap-2.5 p-3 rounded-xl border text-sm"
                  style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger-border)', color: 'var(--danger-text)' }}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{registerFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="reg-nucleo-name" className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                    Nome do Núcleo *
                  </label>
                  <input
                    id="reg-nucleo-name"
                    type="text"
                    required
                    placeholder="Ex: Marketing Digital"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full border rounded-xl p-2.5 outline-none text-sm"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="reg-head-name" className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                    Nome do Head (Responsável) *
                  </label>
                  <input
                    id="reg-head-name"
                    type="text"
                    required
                    placeholder="Ex: Ana Clara"
                    value={headName}
                    onChange={e => setHeadName(e.target.value)}
                    className="w-full border rounded-xl p-2.5 outline-none text-sm"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="reg-head-email" className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                  E-mail Corporativo do Líder *
                </label>
                <input
                  id="reg-head-email"
                  type="email"
                  required
                  placeholder="Ex: ana@v3a.com.br"
                  value={headEmail}
                  onChange={e => setHeadEmail(e.target.value)}
                  className="w-full border rounded-xl p-2.5 outline-none text-sm"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Create Head User checkbox block */}
              <div
                className="p-4 rounded-2xl border space-y-3"
                style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}
              >
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={createHeadUser}
                    onChange={e => setCreateHeadUser(e.target.checked)}
                    className="h-4 w-4 accent-cyan-500 rounded"
                  />
                  <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                    Cadastrar usuário para o Head?
                  </span>
                </label>
                <p className="text-xs leading-relaxed pl-7" style={{ color: 'var(--text-secondary)' }}>
                  Ao concluir, o sistema criará um usuário do perfil NÚCLEO vinculado a este núcleo e disponibilizará as instruções de primeiro acesso conforme o fluxo atual.
                </p>

                {createHeadUser && (
                  <div className="pl-7 space-y-3 animate-fade-in">
                    <div className="space-y-1">
                      <label htmlFor="reg-head-pass" className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                        Senha Inicial Obrigatória *
                      </label>
                      <input
                        id="reg-head-pass"
                        type="password"
                        required={createHeadUser}
                        placeholder="Senha inicial corporativa..."
                        value={headPassword}
                        onChange={e => setHeadPassword(e.target.value)}
                        className="w-full border rounded-xl p-2.5 outline-none text-sm"
                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="reg-head-confirm" className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                        Confirmar Senha Inicial *
                      </label>
                      <input
                        id="reg-head-confirm"
                        type="password"
                        required={createHeadUser}
                        placeholder="Confirme a senha inicial..."
                        value={headConfirmPassword}
                        onChange={e => setHeadConfirmPassword(e.target.value)}
                        className="w-full border rounded-xl p-2.5 outline-none text-sm"
                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <p className="text-xs font-semibold leading-relaxed" style={{ color: 'var(--warning-text)' }}>
                      ⚠️ O Head precisará redefinir esta senha obrigatoriamente no primeiro login.
                    </p>
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div
                className="flex gap-3 pt-2 border-t"
                style={{ borderColor: 'var(--border-soft)' }}
              >
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border font-bold text-sm cursor-pointer transition"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 rounded-xl font-black text-sm cursor-pointer transition flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: '#636466', color: '#fff' }}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" style={{ color: '#00BCD4' }} />}
                  {isSaving ? 'Registrando...' : 'Registrar Núcleo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ RETROACTIVE USER CREATION MODAL ═══════════════════════════════════ */}
      {isRetroactiveModalOpen && retroactiveNucleo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(6,17,31,0.72)', backdropFilter: 'blur(4px)' }}
          role="dialog" aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)' }}
          >
            <div className="px-6 py-5 flex items-center justify-between border-b" style={{ background: '#636466', borderColor: '#636466' }}>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" style={{ color: '#00BCD4' }} />
                <h3 className="font-extrabold text-base text-[var(--text-primary)]">Criar Usuário do Head (Retroativo)</h3>
              </div>
              <button onClick={() => setIsRetroactiveModalOpen(false)} className="p-2 rounded-xl text-[var(--text-disabled)] hover:text-[var(--text-primary)] transition cursor-pointer" aria-label="Fechar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRetroactiveUser} className="p-6 space-y-4">
              {[
                { label: 'Nome do Head', value: retroactiveNucleo.headName },
                { label: 'E-mail do Head', value: retroactiveNucleo.headEmail },
                { label: 'Núcleo Vinculado', value: retroactiveNucleo.name },
              ].map(field => (
                <div key={field.label} className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                    {field.label}
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={field.value}
                    className="w-full border rounded-xl p-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}
                  />
                </div>
              ))}

              <div className="space-y-1">
                <label htmlFor="retro-pass" className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>Senha Inicial *</label>
                <input
                  id="retro-pass"
                  type="password"
                  required
                  placeholder="Defina a senha inicial..."
                  value={retroactivePassword}
                  onChange={e => setRetroactivePassword(e.target.value)}
                  className="w-full border rounded-xl p-2.5 outline-none text-sm"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="retro-confirm" className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>Confirmar Senha Inicial *</label>
                <input
                  id="retro-confirm"
                  type="password"
                  required
                  placeholder="Confirme a senha inicial..."
                  value={retroactiveConfirmPassword}
                  onChange={e => setRetroactiveConfirmPassword(e.target.value)}
                  className="w-full border rounded-xl p-2.5 outline-none text-sm"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRetroactiveModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border font-bold text-sm cursor-pointer"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: '#FFCB05', color: '#000' }}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {isSaving ? 'Criando...' : 'Criar usuário do Head'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ EDIT NUCLEO MODAL ════════════════════════════════════════════════════ */}
      {isEditModalOpen && editNucleo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(6,17,31,0.72)', backdropFilter: 'blur(4px)' }}
          role="dialog" aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)' }}
          >
            <div className="px-6 py-5 flex items-center justify-between border-b" style={{ background: '#636466', borderColor: '#636466' }}>
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5" style={{ color: '#00BCD4' }} />
                <h3 className="font-extrabold text-base text-[var(--text-primary)]">Editar Cadastro de Núcleo</h3>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 rounded-xl text-[var(--text-disabled)] hover:text-[var(--text-primary)] transition cursor-pointer" aria-label="Fechar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditNucleoSubmit} className="p-6 space-y-4">
              {editFormError && (
                <div
                  className="flex items-start gap-2.5 p-3 rounded-xl border text-sm"
                  style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger-border)', color: 'var(--danger-text)' }}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{editFormError}</span>
                </div>
              )}
              {[
                { id: 'edit-name',  label: 'Nome do Núcleo *',            value: editName,      onChange: setEditName,      type: 'text' },
                { id: 'edit-head',  label: 'Nome do Head (Responsável) *', value: editHeadName,  onChange: setEditHeadName,  type: 'text' },
                { id: 'edit-email', label: 'E-mail Corporativo do Líder *',value: editHeadEmail, onChange: setEditHeadEmail, type: 'email' },
              ].map(f => (
                <div key={f.id} className="space-y-1">
                  <label htmlFor={f.id} className="text-xs font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                    {f.label}
                  </label>
                  <input
                    id={f.id}
                    type={f.type}
                    required
                    value={f.value}
                    onChange={e => f.onChange(e.target.value)}
                    className="w-full border rounded-xl p-2.5 outline-none text-sm"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border font-bold text-sm cursor-pointer"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: '#636466', color: '#fff' }}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
