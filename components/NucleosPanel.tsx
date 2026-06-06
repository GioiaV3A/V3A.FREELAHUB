'use client';

import React, { useState } from 'react';
import { DatabaseProps } from '@/app/page';
import { Building, Plus, Save, Users, Trash2, Edit2, ShieldAlert, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { mapNucleoToUI, mapProfileToUser } from '@/lib/dbMapper';
import { 
  createNucleoWithOptionalHeadUserAction, 
  createRetroactiveHeadUserAction 
} from '@/app/actions/admin';
import { useSortableTable } from '@/hooks/useSortableTable';
import { SortableHeader } from '@/components/SortableHeader';

export default function NucleosPanel({ db }: { db: any }) {
  const [name, setName] = useState('');
  const [headName, setHeadName] = useState('');
  const [headEmail, setHeadEmail] = useState('');
  const [createHeadUser, setCreateHeadUser] = useState(false);
  const [headPassword, setHeadPassword] = useState('');
  const [headConfirmPassword, setHeadConfirmPassword] = useState('');
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

  // Determine "Usuário do Head" status for a given nucleo
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

  const nucleosWithCalculated = React.useMemo(() => {
    return db.nucleos.map((nuc: any) => ({
      ...nuc,
      headUserStatus: getHeadUserStatus(nuc),
      jobsCount: db.jobs.filter((j: any) => j.nucleoId === nuc.id).length,
      allocationsCount: db.allocations.filter((a: any) => a.nucleoId === nuc.id).length,
    }));
  }, [db.nucleos, db.jobs, db.allocations, getHeadUserStatus]);

  const { data: sortedNucleos, sortKey, sortDirection, requestSort } = useSortableTable(
    nucleosWithCalculated,
    'name',
    'asc'
  );

  const handleCreateNucleo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !headName || !headEmail) {
      alert('Por favor, preencha todos os campos obrigatórios (Nome do Núcleo, Líder de Núcleo e E-mail corporativo).');
      return;
    }

    if (createHeadUser) {
      if (!headPassword || !headConfirmPassword) {
        alert('Por favor, preencha a senha inicial corporativa e a confirmação para o novo usuário do Head.');
        return;
      }
      if (headPassword !== headConfirmPassword) {
        alert('As senhas informadas não coincidem.');
        return;
      }
    }

    const existingUser = db.users.find(
      (u: any) => u.email.trim().toLowerCase() === headEmail.trim().toLowerCase()
    );

    setIsSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';

      let shouldCreateUser = createHeadUser;
      let initialPass = headPassword;
      let confirmPass = headConfirmPassword;

      if (createHeadUser && existingUser) {
        if (existingUser.profile === 'MASTER' || existingUser.profile === 'RH') {
          alert('Este e-mail está associado a um usuário MASTER ou RH. Não é permitido vinculá-lo como Head de Núcleo.');
          setIsSaving(false);
          return;
        }
        if (existingUser.profile === 'NÚCLEO') {
          if (!confirm(`Já existe um usuário de Núcleo cadastrado com este e-mail (${existingUser.name}). Deseja vinculá-lo a este novo núcleo?`)) {
            setIsSaving(false);
            return;
          }
          shouldCreateUser = false; // Bypass creation, we link instead
        }
      }

      const res = await createNucleoWithOptionalHeadUserAction(token, {
        nucleoName: name,
        headName,
        headEmail,
        createHeadUser: shouldCreateUser,
        initialPassword: initialPass,
        confirmInitialPassword: confirmPass,
      });

      if (!res.success) {
        alert(`Erro ao salvar núcleo/usuário: ${res.error}`);
        setIsSaving(false);
        return;
      }

      // Update local state for nucleos
      const mappedNuc = mapNucleoToUI(res.nucleo);
      db.setNucleos((prev: any) => [...prev, mappedNuc]);

      // Update local state for users
      if (res.userCreated && res.profile) {
        const mappedUser = mapProfileToUser(res.profile);
        db.setUsers((prevUsers: any) => [mappedUser, ...prevUsers]);
        alert(`Núcleo "${name}" criado com sucesso. O usuário do Head foi cadastrado e deverá alterar a senha no primeiro acesso.`);
      } else if (createHeadUser && existingUser && existingUser.profile === 'NÚCLEO') {
        // Update linkage on existing user
        db.setUsers((prevUsers: any) => prevUsers.map((u: any) => {
          if (u.id === existingUser.id) {
            return {
              ...u,
              nucleoId: res.nucleo.id,
              role: `Head de ${name}`
            };
          }
          return u;
        }));
        alert(`Núcleo "${name}" cadastrado com sucesso e vinculado ao usuário existente do Head.`);
      } else {
        alert('Núcleo criado com sucesso. Nenhum usuário foi criado para o Head.');
      }

      setName('');
      setHeadName('');
      setHeadEmail('');
      setCreateHeadUser(false);
      setHeadPassword('');
      setHeadConfirmPassword('');
    } catch (err: any) {
      alert(`Erro inesperado: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateRetroactiveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retroactiveNucleo) return;

    if (!retroactivePassword || !retroactiveConfirmPassword) {
      alert('Por favor, preencha a senha inicial e a confirmação.');
      return;
    }
    if (retroactivePassword !== retroactiveConfirmPassword) {
      alert('As senhas informadas não coincidem.');
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
        if (existingUser.profile === 'MASTER' || existingUser.profile === 'RH') {
          alert('Este e-mail está associado a um usuário MASTER ou RH. Não é permitido vinculá-lo como Head de Núcleo.');
          setIsSaving(false);
          return;
        }
        if (existingUser.profile === 'NÚCLEO') {
          if (confirm(`Já existe um usuário de Núcleo cadastrado com este e-mail (${existingUser.name}). Deseja vinculá-lo a este núcleo?`)) {
            db.setUsers((prevUsers: any) => prevUsers.map((u: any) => {
              if (u.id === existingUser.id) {
                return {
                  ...u,
                  nucleoId: retroactiveNucleo.id,
                  role: `Head de ${retroactiveNucleo.name}`
                };
              }
              return u;
            }));
            alert('Usuário de núcleo existente vinculado com sucesso!');
            setIsRetroactiveModalOpen(false);
          }
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
        alert(`Erro ao criar usuário: ${res.error}`);
        setIsSaving(false);
        return;
      }

      if (res.profile) {
        const mappedUser = mapProfileToUser(res.profile);
        db.setUsers((prevUsers: any) => [mappedUser, ...prevUsers]);
        alert('Usuário do Head criado retroativamente com sucesso!');
      }

      setIsRetroactiveModalOpen(false);
      setRetroactivePassword('');
      setRetroactiveConfirmPassword('');
    } catch (err: any) {
      alert(`Erro inesperado: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditNucleoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNucleo) return;

    if (!editName || !editHeadName || !editHeadEmail) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setIsSaving(true);
    try {
      db.setNucleos((prev: any[]) => prev.map(n => {
        if (n.id === editNucleo.id) {
          return {
            ...n,
            name: editName,
            headName: editHeadName,
            headEmail: editHeadEmail,
          };
        }
        return n;
      }));

      alert('Núcleo atualizado com sucesso!');
      setIsEditModalOpen(false);
    } catch (err: any) {
      alert(`Erro ao atualizar núcleo: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = (id: string) => {
    const nuc = db.nucleos.find((n: any) => n.id === id);
    if (!nuc) return;

    if (nuc.status === 'Ativo') {
      const reason = prompt('Por favor, informe a justificativa de inativação (soft delete) para este núcleo:');
      if (reason === null) return; // cancelado
      if (!reason.trim()) {
        alert('A justificativa é obrigatória para inativar o núcleo.');
        return;
      }
      db.setNucleos((prev: any[]) => prev.map(n => {
        if (n.id === id) {
          return {
            ...n,
            status: 'Inativo',
            archivedAt: new Date().toISOString(),
            archivedBy: db.currentUser.id,
            archiveReason: reason.trim()
          };
        }
        return n;
      }));
      alert(`Núcleo "${nuc.name}" inativado com sucesso.`);
    } else {
      if (confirm(`Deseja reativar o núcleo "${nuc.name}"?`)) {
        db.setNucleos((prev: any[]) => prev.map(n => {
          if (n.id === id) {
            return {
              ...n,
              status: 'Ativo',
              archivedAt: null,
              archivedBy: null,
              archiveReason: null
            };
          }
          return n;
        }));
        alert(`Núcleo "${nuc.name}" reativado com sucesso.`);
      }
    }
  };

  return (
    <div id="nucleos-panel-container" className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Cadastro e Setorização de Núcleos</h2>
          <p className="text-xs text-text-secondary">Explore e gerencie os núcleos operacionais estruturados da agência.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 animate-fade-in">
        {/* Left column: Registered nuclei list */}
        <div className="xl:col-span-8 bg-white rounded-2xl border border-border-subtle overflow-hidden shadow-xs">
          <div className="p-4 bg-surface border-b border-border-subtle flex justify-between items-center text-xs font-semibold">
            <span className="text-text-primary font-bold text-sm flex items-center gap-2">
              <Building className="w-4 h-4 text-text-secondary" />
              <span>Núcleos Ativos na Agência ({db.nucleos.length})</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-surface font-semibold text-text-secondary border-b border-border-subtle">
                <tr>
                  <SortableHeader label="Código / Núcleo" sortKey="name" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-6 py-3" />
                  <SortableHeader label="Head / Líder" sortKey="headName" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-6 py-3" />
                  <SortableHeader label="Usuário do Head" sortKey="headUserStatus" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-6 py-3" />
                  <SortableHeader label="Demandas Críticas" sortKey="jobsCount" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-6 py-3" />
                  <SortableHeader label="Histórico Freelas" sortKey="allocationsCount" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-6 py-3" />
                  <th className="px-6 py-3 text-right font-bold text-text-secondary">AÇÕES GOVERNANÇA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {sortedNucleos.map((nuc: any) => {
                  const status = nuc.headUserStatus;
                  return (
                    <tr key={nuc.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-text-primary text-xs">{nuc.name}</p>
                        <p className="text-[10px] text-text-secondary">ID: {nuc.id}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-text-primary">{nuc.headName || '—'}</p>
                        <p className="text-[10px] text-text-secondary">{nuc.headEmail || '—'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold border
                          ${status === 'Usuário criado' ? 'bg-emerald-50 text-emerald-700 border-emerald-150' : ''}
                          ${status === 'Primeiro acesso pendente' ? 'bg-amber-50 text-amber-700 border-amber-150' : ''}
                          ${status === 'Usuário não criado' ? 'bg-slate-100 text-slate-650 border-slate-200' : ''}
                          ${status === 'Usuário inativo' ? 'bg-rose-50 text-rose-700 border-rose-150' : ''}
                        `}>
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-text-primary font-mono">
                        {db.jobs.filter((j: any) => j.nucleoId === nuc.id).length} jobs criados
                      </td>
                      <td className="px-6 py-4 text-text-secondary text-xs">
                        {db.allocations.filter((a: any) => a.nucleoId === nuc.id).length} alocações
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          {(db.currentUser.profile === 'MASTER' || db.currentUser.profile === 'RH') && (
                            <>
                              <button
                                onClick={() => {
                                  setEditNucleo(nuc);
                                  setEditName(nuc.name);
                                  setEditHeadName(nuc.headName);
                                  setEditHeadEmail(nuc.headEmail);
                                  setIsEditModalOpen(true);
                                }}
                                className="bg-slate-50 hover:bg-slate-100 font-bold text-[10px] text-text-primary p-1 px-2 border border-border-subtle rounded-lg"
                              >
                                Editar
                              </button>

                              <button
                                onClick={() => db.setActiveTab('Gestão de Usuários')}
                                className="bg-slate-50 hover:bg-slate-100 font-bold text-[10px] text-text-primary p-1 px-2 border border-border-subtle rounded-lg"
                              >
                                Gerenciar Usuários
                              </button>

                              {status === 'Usuário não criado' && nuc.headEmail && (
                                <button
                                  onClick={() => {
                                    setRetroactiveNucleo(nuc);
                                    setRetroactivePassword('');
                                    setRetroactiveConfirmPassword('');
                                    setIsRetroactiveModalOpen(true);
                                  }}
                                  className="bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-800 font-bold text-[10px] p-1 px-2 rounded-lg"
                                >
                                  Criar Usuário do Head
                                </button>
                              )}

                              <button
                                onClick={() => handleToggleStatus(nuc.id)}
                                className={`font-bold text-[10px] p-1 px-2 border rounded-lg 
                                  ${nuc.status === 'Ativo' 
                                    ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700' 
                                    : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'}`}
                              >
                                {nuc.status === 'Ativo' ? 'Inativar' : 'Ativar'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column: Form to add new core/núcleo (RH / Master only) */}
        <div className="xl:col-span-4 space-y-6">
          {(db.currentUser.profile === 'MASTER' || db.currentUser.profile === 'RH') ? (
            <div className="bg-white p-5 rounded-2xl border border-border-subtle space-y-4 text-xs">
              <div className="flex gap-1.5 items-center">
                <Plus className="w-5 h-5 text-action-cyan" />
                <h3 className="font-bold text-text-primary text-sm">Registrar Novo Núcleo</h3>
              </div>
              <p className="text-[10px] text-text-secondary">Adicione divisões técnicas de live marketing e autorize o head associado à convocar freelancers.</p>

              <form onSubmit={handleCreateNucleo} className="space-y-4">
                <div>
                  <label className="font-bold text-text-secondary block mb-1">Nome do Núcleo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Marketing Digital"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan focus:ring-1 focus:ring-action-cyan bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Nome do Head (Responsável) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Ana Clara"
                    value={headName}
                    onChange={e => setHeadName(e.target.value)}
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan focus:ring-1 focus:ring-action-cyan bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">E-mail Corporativo do Líder *</label>
                  <input
                    type="email"
                    required
                    placeholder="Ex: ana@v3a.com.br"
                    value={headEmail}
                    onChange={e => setHeadEmail(e.target.value)}
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan focus:ring-1 focus:ring-action-cyan bg-white"
                  />
                </div>

                <div className="bg-cyan-50/40 p-3 rounded-xl border border-cyan-150 space-y-2.5">
                  <label className="flex items-center gap-2 font-bold text-cyan-800 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={createHeadUser}
                      onChange={e => setCreateHeadUser(e.target.checked)}
                      className="accent-action-cyan h-4 w-4"
                    />
                    <span>Cadastrar usuário para o Head?</span>
                  </label>
                  <p className="text-[10px] text-text-secondary pl-6">
                    Se marcado, cria automaticamente um usuário perfil "NÚCLEO" vinculado a este núcleo de live marketing.
                  </p>

                  {createHeadUser && (
                    <div className="pl-6 space-y-3.5 animate-fade-in">
                      <div>
                        <label className="block text-[10px] font-bold text-cyan-800 uppercase mb-1">Senha Inicial Obrigatória *</label>
                        <input
                          type="password"
                          required={createHeadUser}
                          placeholder="Senha inicial corporativa..."
                          value={headPassword}
                          onChange={e => setHeadPassword(e.target.value)}
                          className="w-full border border-[#00BCD4]/40 p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-cyan-800 uppercase mb-1">Confirmar Senha Inicial *</label>
                        <input
                          type="password"
                          required={createHeadUser}
                          placeholder="Confirme a senha inicial..."
                          value={headConfirmPassword}
                          onChange={e => setHeadConfirmPassword(e.target.value)}
                          className="w-full border border-[#00BCD4]/40 p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white text-xs"
                        />
                      </div>
                      <p className="text-[9px] text-amber-600 font-semibold leading-relaxed">⚠️ O Head precisará redefinir esta senha obrigatoriamente no primeiro login.</p>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-sidebar-navy text-white font-bold p-2 w-full rounded-xl flex items-center justify-center gap-1.5 hover:bg-slate-850 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4 text-action-cyan" /> {isSaving ? 'Gravando...' : 'Gravar Núcleo'}
                </button>
              </form>
            </div>
          ) : (
            <div className="p-4 bg-surface rounded-xl border border-border-subtle text-center text-text-secondary">
              Apenas perfis MASTER ou de RH possuem prerrogativa para cadastrar novos núcleos operacionais no painel.
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: RETROACTIVE USER CREATION */}
      {isRetroactiveModalOpen && retroactiveNucleo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 w-full max-w-md text-xs animate-scale-up">
            <div className="p-5 bg-sidebar-navy text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-action-cyan" />
                <h3 className="font-extrabold text-sm">Criar Usuário do Head (Retroativo)</h3>
              </div>
              <button onClick={() => setIsRetroactiveModalOpen(false)} className="text-white hover:text-action-cyan transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRetroactiveUser} className="p-6 space-y-4">
              <div>
                <label className="font-bold text-text-secondary block mb-1">Nome do Head</label>
                <input
                  type="text"
                  readOnly
                  value={retroactiveNucleo.headName}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-secondary bg-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">E-mail do Head</label>
                <input
                  type="text"
                  readOnly
                  value={retroactiveNucleo.headEmail}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-secondary bg-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Núcleo Vinculado</label>
                <input
                  type="text"
                  readOnly
                  value={retroactiveNucleo.name}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-secondary bg-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Senha Inicial *</label>
                <input
                  type="password"
                  required
                  placeholder="Defina a senha inicial..."
                  value={retroactivePassword}
                  onChange={e => setRetroactivePassword(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                />
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Confirmar Senha Inicial *</label>
                <input
                  type="password"
                  required
                  placeholder="Confirme a senha inicial..."
                  value={retroactiveConfirmPassword}
                  onChange={e => setRetroactiveConfirmPassword(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsRetroactiveModalOpen(false)}
                  className="border border-border-subtle p-1.5 px-3 rounded-lg hover:bg-slate-55 font-semibold text-text-primary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-action-cyan hover:bg-action-cyan/90 text-white font-bold p-1.5 px-4 rounded-lg disabled:opacity-50"
                >
                  {isSaving ? 'Criando...' : 'Criar usuário do Head'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT NUCLEO */}
      {isEditModalOpen && editNucleo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 w-full max-w-md text-xs animate-scale-up">
            <div className="p-5 bg-sidebar-navy text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-action-cyan" />
                <h3 className="font-extrabold text-sm">Editar Cadastro de Núcleo</h3>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-white hover:text-action-cyan transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditNucleoSubmit} className="p-6 space-y-4">
              <div>
                <label className="font-bold text-text-secondary block mb-1">Nome do Núcleo *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                />
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Nome do Head (Responsável) *</label>
                <input
                  type="text"
                  required
                  value={editHeadName}
                  onChange={e => setEditHeadName(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                />
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">E-mail Corporativo do Líder *</label>
                <input
                  type="email"
                  required
                  value={editHeadEmail}
                  onChange={e => setEditHeadEmail(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="border border-border-subtle p-1.5 px-3 rounded-lg hover:bg-slate-55 font-semibold text-text-primary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-sidebar-navy text-white font-bold p-1.5 px-4 rounded-lg disabled:opacity-50"
                >
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
