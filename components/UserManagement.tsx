'use client';

import React, { useState } from 'react';
import { DatabaseProps } from '@/app/page';
import { User, ProfileType } from '@/lib/mockData';
import { getRoleLabel } from '@/lib/dbMapper';
import { useSortableTable } from '@/hooks/useSortableTable';
import { SortableHeader } from '@/components/SortableHeader';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Eye, 
  ChevronRight, 
  X, 
  Check, 
  UserPlus 
} from 'lucide-react';

export default function UserManagement({ db }: { db: DatabaseProps & { users: User[]; setUsers: React.Dispatch<React.SetStateAction<User[]>> } }) {
  const { users, setUsers, nucleos, currentUser } = db;

  // Search & Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [profileFilter, setProfileFilter] = useState<string>('todos');
  const [nucleoFilter, setNucleoFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [pendingFilter, setPendingFilter] = useState<string>('todos');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Modal States
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Form states
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formProfile, setFormProfile] = useState<ProfileType>('NÚCLEO');
  const [formNucleoId, setFormNucleoId] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirmPassword, setFormConfirmPassword] = useState('');
  const [formStatus, setFormStatus] = useState<'Ativo' | 'Inativo'>('Ativo');

  // Reset Password form state
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');

  // UI toast/notify trigger
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Check access permissions
  // Master sees all users. RH sees RH under operational rules + Nucleo users.
  const hasEditPermission = getRoleLabel(currentUser.profile) === 'MASTER' || getRoleLabel(currentUser.profile) === 'RH';

  const filteredUsers = users.filter(usr => {
    // 1. Search filter
    const matchesSearch = usr.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          usr.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    // 2. Profile filtration
    const matchesProfile = profileFilter === 'todos' || profileFilter === 'all' || getRoleLabel(usr.profile) === getRoleLabel(profileFilter);
    
    // 3. Nucleo filtration
    const matchesNucleo = nucleoFilter === 'todos' || usr.nucleoId === nucleoFilter;
    
    // 4. Status filtration
    const matchesStatus = statusFilter === 'todos' || usr.status === statusFilter;

    // 5. Pending filtration
    const matchesPending = pendingFilter === 'todos' || 
      (pendingFilter === 'pendente' && usr.firstAccessPending) ||
      (pendingFilter === 'concluido' && !usr.firstAccessPending);

    // 6. Access visibility constraint: RH can only show/manage RH and NÚCLEO. Master can see all.
    const isVisibleToCurrentUser = getRoleLabel(currentUser.profile) === 'MASTER' || getRoleLabel(usr.profile) !== 'MASTER';

    return matchesSearch && matchesProfile && matchesNucleo && matchesStatus && matchesPending && isVisibleToCurrentUser;
  });

  const usersWithCalculated = React.useMemo(() => {
    return filteredUsers.map(usr => {
      const linkedNucleo = nucleos.find(n => n.id === usr.nucleoId);
      let nucName = '';
      const userProfile = getRoleLabel(usr.profile);
      if (userProfile === 'MASTER') {
        nucName = 'Todos os núcleos';
      } else if (userProfile === 'RH') {
        nucName = 'Estratégico / Geral';
      } else if (userProfile === 'C-LEVEL') {
        nucName = 'Multi-núcleo';
      } else {
        nucName = linkedNucleo ? linkedNucleo.name : 'Não vinculado';
      }
      return {
        ...usr,
        nucleoName: nucName
      };
    });
  }, [filteredUsers, nucleos]);

  const { data: sortedUsers, sortKey, sortDirection, requestSort } = useSortableTable(
    usersWithCalculated,
    'name',
    'asc'
  );

  // Action handlers
  const openCreateModal = () => {
    setFormName('');
    setFormEmail('');
    setFormProfile('NÚCLEO');
    setFormNucleoId(nucleos[0]?.id || '');
    setFormRole('');
    setFormPassword('');
    setFormConfirmPassword('');
    setFormStatus('Ativo');
    setIsNewUserModalOpen(true);
  };

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim() || !formEmail.trim() || !formRole.trim() || !formPassword || !formConfirmPassword) {
      showToast('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }

    if (formPassword !== formConfirmPassword) {
      showToast('As senhas informadas não coincidem.', 'error');
      return;
    }

    if (getRoleLabel(formProfile) === 'NÚCLEO' && !formNucleoId) {
      showToast('Vínculo com núcleo é obrigatório para perfil NÚCLEO.', 'error');
      return;
    }

    // Email unique check
    if (users.some(u => u.email.trim().toLowerCase() === formEmail.trim().toLowerCase())) {
      showToast('Este endereço de e-mail já está cadastrado corporativamente.', 'error');
      return;
    }

    const finalRole = formRole.trim().startsWith('Outro ') 
      ? formRole.trim().substring(6).trim() 
      : formRole.trim();

    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: formName.trim(),
      email: formEmail.trim().toLowerCase(),
      profile: formProfile,
      nucleoId: getRoleLabel(formProfile) === 'NÚCLEO' ? formNucleoId : undefined,
      status: formStatus,
      role: finalRole,
      password: formPassword,
      firstAccessPending: true, // Marked "Primeiro acesso pendente"
      lastLogin: '-'
    };

    setUsers(prev => [newUser, ...prev]);
    setIsNewUserModalOpen(false);
    showToast('Usuário criado com sucesso. A troca de senha será solicitada no primeiro acesso.', 'success');
  };

  const openEditModal = (usr: User) => {
    setSelectedUser(usr);
    setFormName(usr.name);
    setFormEmail(usr.email);
    setFormProfile(usr.profile);
    setFormNucleoId(usr.nucleoId || nucleos[0]?.id || '');
    setFormRole(usr.role || '');
    setFormStatus(usr.status);
    setIsEditUserModalOpen(true);
  };

  const handleEditUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim() || !formEmail.trim() || !formRole.trim()) {
      showToast('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }

    if (getRoleLabel(formProfile) === 'NÚCLEO' && !formNucleoId) {
      showToast('Vínculo com núcleo é obrigatório para perfil NÚCLEO.', 'error');
      return;
    }

    // Email unique check excluding selected user
    if (users.some(u => u.id !== selectedUser?.id && u.email.trim().toLowerCase() === formEmail.trim().toLowerCase())) {
      showToast('Este e-mail está associado a outro registro ativo.', 'error');
      return;
    }

    const finalRole = formRole.trim().startsWith('Outro ') 
      ? formRole.trim().substring(6).trim() 
      : formRole.trim();

    setUsers(prev => prev.map(u => {
      if (u.id === selectedUser?.id) {
        return {
          ...u,
          name: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          profile: getRoleLabel(u.profile) === 'MASTER' ? 'MASTER' : formProfile,
          nucleoId: getRoleLabel(formProfile) === 'NÚCLEO' ? formNucleoId : undefined,
          role: finalRole,
          status: formStatus
        };
      }
      return u;
    }));

    setIsEditUserModalOpen(false);
    showToast('Os dados do usuário foram atualizados com sucesso.', 'success');
  };

  const handleToggleStatus = (usr: User) => {
    if (usr.id === currentUser.id) {
      showToast('Não é possível inativar seu próprio perfil logado.', 'error');
      return;
    }

    setUsers(prev => prev.map(u => {
      if (u.id === usr.id) {
        const nextStatus = u.status === 'Ativo' ? 'Inativo' : 'Ativo';
        return { ...u, status: nextStatus };
      }
      return u;
    }));

    showToast(`Usuário ${usr.name} foi ${usr.status === 'Ativo' ? 'inativado' : 'reativado'} com sucesso.`);
  };

  const openResetPasswordModal = (usr: User) => {
    setSelectedUser(usr);
    setResetPassword('');
    setResetConfirmPassword('');
    setIsResetPasswordModalOpen(true);
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!resetPassword || !resetConfirmPassword) {
      showToast('Preencha as senhas obrigatórias para redefinição.', 'error');
      return;
    }

    if (resetPassword !== resetConfirmPassword) {
      showToast('As senhas informadas não coincidem.', 'error');
      return;
    }

    setUsers(prev => prev.map(u => {
      if (u.id === selectedUser?.id) {
        return {
          ...u,
          password: resetPassword,
          firstAccessPending: true // Forces first access reset logic again
        };
      }
      return u;
    }));

    setIsResetPasswordModalOpen(false);
    showToast(`Senha inicial do usuário redefinida corporativamente. A troca de senha será solicitada no próximo login de ${selectedUser?.name}.`, 'success');
  };

  const openDetailsModal = (usr: User) => {
    setSelectedUser(usr);
    setIsDetailsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Alert UI */}
      {toastMessage && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 p-4 px-5 rounded-2xl shadow-xl border text-white animate-fade-in
          ${toastType === 'success' ? 'bg-sidebar-navy border-action-cyan text-white' : 'bg-red-600 border-red-500'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 
            ${toastType === 'success' ? 'bg-action-cyan/15 text-action-cyan' : 'bg-white/10 text-white'}`}>
            <CheckCircle className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold">{toastMessage}</p>
          <button onClick={() => setToastMessage(null)} className="opacity-70 hover:opacity-100 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Gestão de Usuários da Agência</h2>
          <p className="text-xs text-text-secondary">Controle de credenciais de segurança, troca de senha corporativa e atribuições por núcleos ou RH.</p>
        </div>

        {hasEditPermission && (
          <button
            onClick={openCreateModal}
            className="bg-action-cyan hover:bg-action-cyan/90 text-white font-extrabold p-2 px-4 rounded-xl flex items-center gap-1.5 transition-all text-xs shadow-xs"
          >
            <UserPlus className="w-4 h-4" /> Novo Usuário
          </button>
        )}
      </div>

      {/* Filters grid and Search widgets */}
      <div className="bg-white p-4 sm:p-5 border border-border-subtle rounded-2xl shadow-xs space-y-4">
        
        {/* Search Input bar & Filters toggle on mobile */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-secondary absolute left-3 top-3.5" />
            <input
              type="text"
              placeholder="Pesquisar usuários por nome completo ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 border border-border-subtle p-2.5 rounded-xl text-xs text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
            />
          </div>
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="md:hidden border border-border-subtle hover:bg-slate-50 text-text-primary p-2.5 px-3 rounded-xl text-xs flex items-center gap-1.5 shrink-0 font-bold"
          >
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Filtros</span>
            {((profileFilter !== 'todos' ? 1 : 0) + (nucleoFilter !== 'todos' ? 1 : 0) + (statusFilter !== 'todos' ? 1 : 0) + (pendingFilter !== 'todos' ? 1 : 0)) > 0 && (
              <span className="bg-action-cyan text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0">
                {(profileFilter !== 'todos' ? 1 : 0) + (nucleoFilter !== 'todos' ? 1 : 0) + (statusFilter !== 'todos' ? 1 : 0) + (pendingFilter !== 'todos' ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* Row of dropdown indicators */}
        <div className={`${showMobileFilters ? 'grid' : 'hidden'} md:grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 text-xs border-t border-dashed border-border-subtle md:border-none md:pt-0`}>
          
          {/* Filter 1: profile type */}
          <div>
            <label className="font-bold text-text-secondary block mb-1">Perfil de Acesso</label>
            <select
              value={profileFilter}
              onChange={(e) => setProfileFilter(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white focus:border-action-cyan font-semibold"
            >
              <option value="todos">Todos os Perfis</option>
              {getRoleLabel(currentUser.profile) === 'MASTER' && <option value="master">MASTER</option>}
              <option value="rh">RH</option>
              <option value="c_level">C-LEVEL</option>
              <option value="nucleo">NÚCLEO</option>
            </select>
          </div>

          {/* Filter 2: linked nucleo */}
          <div>
            <label className="font-bold text-text-secondary block mb-1">Núcleo Vinculado</label>
            <select
              value={nucleoFilter}
              onChange={(e) => setNucleoFilter(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white focus:border-action-cyan"
            >
              <option value="todos">Todos os Núcleos</option>
              {nucleos.map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>

          {/* Filter 3: active status */}
          <div>
            <label className="font-bold text-text-secondary block mb-1">Status Operacional</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white focus:border-action-cyan"
            >
              <option value="todos">Todos os Status</option>
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
            </select>
          </div>

          {/* Filter 4: first login pending */}
          <div>
            <label className="font-bold text-text-secondary block mb-1">Primeiro acesso pendente</label>
            <select
              value={pendingFilter}
              onChange={(e) => setPendingFilter(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white focus:border-action-cyan"
            >
              <option value="todos">Todas as Situações</option>
              <option value="pendente">Sim (Trocar Senha Obrigatória)</option>
              <option value="concluido">Não (Acesso Liberado)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Data View Container */}
      <div className="bg-white rounded-2xl border border-border-subtle overflow-hidden shadow-xs animate-fade-in">
        
        {/* DESKTOP TABLE VIEW */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#0A192F] text-white font-semibold border-b border-border-subtle">
              <tr>
                <SortableHeader label="Membro / E-mail" sortKey="name" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-5 py-3" />
                <SortableHeader label="Perfil de Acesso" sortKey="profile" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-5 py-3" />
                <SortableHeader label="Núcleo Vinculado" sortKey="nucleoName" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-5 py-3" />
                <SortableHeader label="Status" sortKey="status" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-5 py-3" />
                <SortableHeader label="Login Pendente" sortKey="firstAccessPending" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-5 py-3" />
                <SortableHeader label="Último Login" sortKey="lastLogin" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-5 py-3" />
                <th className="px-5 py-3 text-right">AÇÕES GOVERNANÇA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle font-medium text-text-primary">
              {sortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-text-secondary italic">
                    Nenhum usuário cadastrado atende aos filtros de pesquisa selecionados atualmente.
                  </td>
                </tr>
              ) : (
                sortedUsers.map((usr) => {
                  const linkedNucleo = nucleos.find(n => n.id === usr.nucleoId);
                  const canModifyThisUser = getRoleLabel(currentUser.profile) === 'MASTER' || (getRoleLabel(currentUser.profile) === 'RH' && getRoleLabel(usr.profile) === 'NÚCLEO' && !usr.isSeedMaster);

                  return (
                    <tr 
                      key={usr.id} 
                      className={`hover:bg-slate-50 transition-colors ${usr.status === 'Inativo' ? 'opacity-60 bg-slate-100/50' : ''}`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`role-avatar ${
                            getRoleLabel(usr.profile) === 'MASTER' ? 'role-avatar-master' :
                            getRoleLabel(usr.profile) === 'RH' ? 'role-avatar-rh' :
                            getRoleLabel(usr.profile) === 'C-LEVEL' ? 'role-avatar-clevel' :
                            'role-avatar-nucleo'
                          }`}>
                            {usr.name.slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-bold text-text-primary text-xs flex items-center gap-1.5">
                              {usr.name}
                              {usr.id === currentUser.id && (
                                <span className="bg-slate-200 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">Você</span>
                              )}
                            </p>
                            <p className="text-[10px] text-text-secondary mt-0.5">{usr.email}</p>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-5 py-4">
                        <span className={`role-badge ${
                          getRoleLabel(usr.profile) === 'MASTER' ? 'role-badge-master' :
                          getRoleLabel(usr.profile) === 'RH' ? 'role-badge-rh' :
                          getRoleLabel(usr.profile) === 'C-LEVEL' ? 'role-badge-clevel' :
                          'role-badge-nucleo'
                        }`}>
                          {getRoleLabel(usr.profile)}
                        </span>
                        {usr.role && (
                          <span className="block text-[10px] text-text-secondary mt-0.5 font-normal truncate max-w-[120px]" title={usr.role}>
                            {usr.role}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-text-primary font-semibold">
                        {getRoleLabel(usr.profile) === 'NÚCLEO' ? (
                          <span className="nucleo-chip nucleo-chip-nucleo">
                            💡 {linkedNucleo ? linkedNucleo.name : 'Não vinculado'}
                          </span>
                        ) : getRoleLabel(usr.profile) === 'C-LEVEL' ? (
                          <span className="nucleo-chip nucleo-chip-clevel">
                            🌐 Multi-núcleo
                          </span>
                        ) : getRoleLabel(usr.profile) === 'MASTER' ? (
                          <span className="nucleo-chip nucleo-chip-master">
                            👑 Todos os núcleos
                          </span>
                        ) : (
                          <span className="text-text-secondary font-semibold">Estratégico / Geral</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span className={`status-badge ${usr.status === 'Ativo' ? 'status-badge-active' : 'status-badge-inactive'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${usr.status === 'Ativo' ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                          {usr.status}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {usr.firstAccessPending ? (
                          <span className="login-badge login-badge-pending">
                            ⚠️ Primeiro acesso pendente
                          </span>
                        ) : (
                          <span className="login-badge login-badge-released">
                            ✓ Liberado
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-text-secondary text-xs">
                        {usr.lastLogin || '-'}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => openDetailsModal(usr)}
                            className="btn-gov btn-gov-details"
                            title="Ver Detalhes do Usuário"
                          >
                            Detalhes
                          </button>

                          {hasEditPermission && canModifyThisUser && (
                            <>
                              <button
                                onClick={() => openEditModal(usr)}
                                className={`btn-gov btn-gov-edit ${usr.status === 'Inativo' ? 'opacity-40 cursor-not-allowed' : ''}`}
                                disabled={usr.status === 'Inativo'}
                                title="Editar Cadastro"
                              >
                                Editar
                              </button>

                              <button
                                onClick={() => openResetPasswordModal(usr)}
                                className={`btn-gov btn-gov-reset ${usr.status === 'Inativo' ? 'opacity-40 cursor-not-allowed' : ''}`}
                                disabled={usr.status === 'Inativo'}
                                title="Redefinir Senha Inicial corporativa"
                              >
                                Redefinir Senha
                              </button>

                              <button
                                onClick={() => handleToggleStatus(usr)}
                                className={`btn-gov ${usr.status === 'Ativo' ? 'btn-gov-inactive' : 'btn-gov-active'}`}
                                title={usr.status === 'Ativo' ? 'Inativar Usuário' : 'Reativar Usuário'}
                              >
                                {usr.status === 'Ativo' ? 'Inativar' : 'Reativar'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS VIEW */}
        <div className="md:hidden divide-y divide-border-subtle bg-white">
          {sortedUsers.length === 0 ? (
            <div className="p-8 text-center text-text-secondary italic">
              Nenhum usuário cadastrado atende aos filtros de pesquisa selecionados atualmente.
            </div>
          ) : (
            sortedUsers.map((usr) => {
              const linkedNucleo = nucleos.find(n => n.id === usr.nucleoId);
              const canModifyThisUser = getRoleLabel(currentUser.profile) === 'MASTER' || (getRoleLabel(currentUser.profile) === 'RH' && getRoleLabel(usr.profile) === 'NÚCLEO' && !usr.isSeedMaster);
              return (
                <div key={usr.id} className={`p-4 space-y-3.5 ${usr.status === 'Inativo' ? 'opacity-65 bg-slate-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`role-avatar ${
                      getRoleLabel(usr.profile) === 'MASTER' ? 'role-avatar-master' :
                      getRoleLabel(usr.profile) === 'RH' ? 'role-avatar-rh' :
                      getRoleLabel(usr.profile) === 'C-LEVEL' ? 'role-avatar-clevel' :
                      'role-avatar-nucleo'
                    }`}>
                      {usr.name.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-text-primary text-xs flex items-center gap-1.5 truncate">
                        {usr.name}
                        {usr.id === currentUser.id && (
                          <span className="bg-slate-200 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0">Você</span>
                        )}
                      </p>
                      <p className="text-[10px] text-text-secondary truncate mt-0.5">{usr.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-[11px] pt-2 border-t border-dashed border-border-subtle">
                    <div>
                      <span className="text-[9px] text-text-secondary font-bold uppercase block">Perfil</span>
                      <span className={`role-badge mt-1 ${
                        getRoleLabel(usr.profile) === 'MASTER' ? 'role-badge-master' :
                        getRoleLabel(usr.profile) === 'RH' ? 'role-badge-rh' :
                        getRoleLabel(usr.profile) === 'C-LEVEL' ? 'role-badge-clevel' :
                        'role-badge-nucleo'
                      }`}>
                        {getRoleLabel(usr.profile)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-text-secondary font-bold uppercase block">Núcleo</span>
                      <span className="mt-1 block truncate">
                        {getRoleLabel(usr.profile) === 'NÚCLEO' ? (
                          <span className="nucleo-chip nucleo-chip-nucleo">
                            💡 {linkedNucleo ? linkedNucleo.name : 'Não vinculado'}
                          </span>
                        ) : getRoleLabel(usr.profile) === 'C-LEVEL' ? (
                          <span className="nucleo-chip nucleo-chip-clevel">
                            🌐 Multi-núcleo
                          </span>
                        ) : getRoleLabel(usr.profile) === 'MASTER' ? (
                          <span className="nucleo-chip nucleo-chip-master">
                            👑 Todos
                          </span>
                        ) : (
                          <span className="text-text-secondary font-semibold">Geral</span>
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-text-secondary font-bold uppercase block">Status</span>
                      <span className={`status-badge mt-1 ${usr.status === 'Ativo' ? 'status-badge-active' : 'status-badge-inactive'}`}>
                        {usr.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-text-secondary font-bold uppercase block">Login</span>
                      <span className={`login-badge mt-1 ${usr.firstAccessPending ? 'login-badge-pending' : 'login-badge-released'}`}>
                        {usr.firstAccessPending ? 'Senha Pendente' : 'Liberado'}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-1.5 pt-2.5 border-t border-dashed border-border-subtle">
                    <button
                      onClick={() => openDetailsModal(usr)}
                      className="btn-gov btn-gov-details px-3 py-1.5 text-[10px]"
                    >
                      Detalhes
                    </button>
                    {hasEditPermission && canModifyThisUser && (
                      <>
                        <button
                          onClick={() => openEditModal(usr)}
                          className="btn-gov btn-gov-edit px-3 py-1.5 text-[10px]"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => openResetPasswordModal(usr)}
                          className="btn-gov btn-gov-reset px-3 py-1.5 text-[10px]"
                          title="Redefinir Senha de Acesso"
                        >
                          Senha
                        </button>
                        <button
                          onClick={() => handleToggleStatus(usr)}
                          className={`btn-gov px-3 py-1.5 text-[10px] ${usr.status === 'Ativo' ? 'btn-gov-inactive' : 'btn-gov-active'}`}
                        >
                          {usr.status === 'Ativo' ? 'Inativar' : 'Reativar'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL 1: CREATE USER */}
      {isNewUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 w-full max-w-lg text-xs animate-scale-up flex flex-col max-h-[90vh]">
            <div className="p-5 bg-sidebar-navy text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-action-cyan" />
                <h3 className="font-extrabold text-sm">Criar Novo Usuário Interno</h3>
              </div>
              <button onClick={() => setIsNewUserModalOpen(false)} className="text-white hover:text-action-cyan transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="p-6 space-y-4 overflow-y-auto">
              
              <div>
                <label className="font-bold text-text-secondary block mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome completo do usuário..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                />
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">E-mail Corporativo *</label>
                <input
                  type="email"
                  required
                  placeholder="exemplo@v3a.ag"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-text-secondary block mb-1">Perfil de Acesso *</label>
                  {getRoleLabel(currentUser.profile) === 'RH' ? (
                    <input
                      type="text"
                      readOnly
                      value="NÚCLEO"
                      className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-slate-100 font-semibold"
                    />
                  ) : (
                    <select
                      value={formProfile}
                      onChange={(e) => {
                        const prof = e.target.value as ProfileType;
                        setFormProfile(prof);
                        if (getRoleLabel(prof) === 'RH' || getRoleLabel(prof) === 'C-LEVEL') setFormNucleoId('');
                        else if (!formNucleoId && nucleos.length > 0) setFormNucleoId(nucleos[0].id);
                      }}
                      className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white focus:outline-none focus:border-action-cyan font-semibold"
                    >
                      <option value="RH">RH</option>
                      <option value="NÚCLEO">NÚCLEO</option>
                      <option value="C-LEVEL">C-LEVEL</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Cargo / Função *</label>
                  {getRoleLabel(currentUser.profile) === 'RH' ? (
                    <div className="space-y-2">
                      <select
                        required
                        value={['Head do Núcleo', 'Coordenador', 'Atendimento', 'Produção', 'Planejamento', 'Operação'].includes(formRole) ? formRole : formRole ? 'Outro' : ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'Outro') {
                            setFormRole('Outro ');
                          } else {
                            setFormRole(val);
                          }
                        }}
                        className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white focus:outline-none focus:border-action-cyan"
                      >
                        <option value="" disabled>Selecione o cargo...</option>
                        <option value="Head do Núcleo">Head do Núcleo</option>
                        <option value="Coordenador">Coordenador</option>
                        <option value="Atendimento">Atendimento</option>
                        <option value="Produção">Produção</option>
                        <option value="Planejamento">Planejamento</option>
                        <option value="Operação">Operação</option>
                        <option value="Outro">Outro</option>
                      </select>
                      {(!['Head do Núcleo', 'Coordenador', 'Atendimento', 'Produção', 'Planejamento', 'Operação', ''].includes(formRole) || formRole.startsWith('Outro ')) && (
                        <input
                          type="text"
                          required
                          placeholder="Digite o cargo customizado..."
                          value={formRole.startsWith('Outro ') ? formRole.substring(6) : formRole}
                          onChange={(e) => setFormRole('Outro ' + e.target.value)}
                          className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white text-xs mt-1.5"
                        />
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="Ex: Designer Sênior"
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                      className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                    />
                  )}
                </div>
              </div>

              {getRoleLabel(formProfile) === 'NÚCLEO' ? (
                <div>
                  <label className="font-bold text-[#00BCD4] block mb-1">Vincular a qual Núcleo? *</label>
                  <select
                    required
                    value={formNucleoId}
                    onChange={(e) => setFormNucleoId(e.target.value)}
                    className="w-full border border-[#00BCD4]/40 p-2 rounded-lg text-text-primary bg-[#E0F7FA]/10 focus:outline-none focus:border-action-cyan font-semibold text-xs"
                  >
                    <option value="" disabled>Selecione um núcleo...</option>
                    {nucleos.map(n => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-text-secondary mt-1">O usuário do núcleo só poderá ver dados e criar demandas do núcleo vinculado.</p>
                </div>
              ) : getRoleLabel(formProfile) === 'C-LEVEL' ? (
                <div className="bg-purple-50/50 border border-purple-100 p-3 rounded-xl">
                  <p className="text-[10px] text-purple-900 leading-relaxed font-semibold">
                    💡 Usuários C-LEVEL possuem atuação multi-núcleo e podem operar oportunidades de qualquer núcleo.
                  </p>
                </div>
              ) : getRoleLabel(formProfile) === 'RH' ? (
                <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-xl">
                  <p className="text-[10px] text-blue-900 leading-relaxed font-semibold">
                    💡 Usuários RH possuem acesso operacional à gestão de usuários, núcleos, freelas e fluxos de aprovação.
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 border-b border-dashed border-slate-100">
                <div>
                  <label className="font-bold text-text-secondary block mb-1">Senha Inicial Obrigatória *</label>
                  <input
                    type="password"
                    required
                    placeholder="Senha inicial do usuário..."
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                  />
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Confirmar Senha *</label>
                  <input
                    type="password"
                    required
                    placeholder="Repita a senha inicial..."
                    value={formConfirmPassword}
                    onChange={(e) => setFormConfirmPassword(e.target.value)}
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Status Ativação</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      checked={formStatus === 'Ativo'}
                      onChange={() => setFormStatus('Ativo')}
                      className="accent-action-cyan"
                    />
                    Ativo (Permite Login)
                  </label>
                  <label className="flex items-center gap-1.5 font-semibold cursor-pointer text-text-secondary">
                    <input
                      type="radio"
                      checked={formStatus === 'Inativo'}
                      onChange={() => setFormStatus('Inativo')}
                      className="accent-action-cyan"
                    />
                    Inativo (Acesso Bloqueado)
                  </label>
                </div>
              </div>

              <div className="pt-4 flex gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => setIsNewUserModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold p-2.5 px-4 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-action-cyan hover:bg-action-cyan/95 text-white font-extrabold p-2.5 px-6 rounded-xl transition shadow-xs"
                >
                  Criar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT USER */}
      {/* MODAL 2: EDIT USER */}
      {isEditUserModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 w-full max-w-lg text-xs animate-scale-up flex flex-col max-h-[90vh]">
            <div className="p-5 bg-sidebar-navy text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-action-cyan" />
                <h3 className="font-extrabold text-sm">Editar Cadastro de Usuário</h3>
              </div>
              <button onClick={() => setIsEditUserModalOpen(false)} className="text-white hover:text-action-cyan transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditUserSubmit} className="p-6 space-y-4 overflow-y-auto">
              
              <div>
                <label className="font-bold text-text-secondary block mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome completo..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                />
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">E-mail Corporativo *</label>
                <input
                  type="email"
                  required
                  placeholder="exemplo@v3a.ag"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-text-secondary block mb-1">Perfil de Acesso *</label>
                  <select
                    disabled={getRoleLabel(selectedUser.profile) === 'MASTER' || getRoleLabel(currentUser.profile) === 'RH'}
                    value={formProfile}
                    onChange={(e) => {
                      const prof = e.target.value as ProfileType;
                      setFormProfile(prof);
                      if (getRoleLabel(prof) === 'RH' || getRoleLabel(prof) === 'C-LEVEL') setFormNucleoId('');
                      else if (!formNucleoId && nucleos.length > 0) setFormNucleoId(nucleos[0].id);
                    }}
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white focus:outline-none focus:border-action-cyan disabled:bg-slate-100 disabled:text-slate-500 font-semibold"
                  >
                    {getRoleLabel(selectedUser.profile) === 'MASTER' ? (
                      <option value="MASTER">MASTER</option>
                    ) : (
                      <>
                        <option value="RH">RH</option>
                        <option value="NÚCLEO">NÚCLEO</option>
                        <option value="C-LEVEL">C-LEVEL</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Cargo / Função *</label>
                  {getRoleLabel(currentUser.profile) === 'RH' ? (
                    <div className="space-y-2">
                      <select
                        required
                        value={['Head do Núcleo', 'Coordenador', 'Atendimento', 'Produção', 'Planejamento', 'Operação'].includes(formRole) ? formRole : formRole ? 'Outro' : ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'Outro') {
                            setFormRole('Outro ');
                          } else {
                            setFormRole(val);
                          }
                        }}
                        className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white focus:outline-none focus:border-action-cyan"
                      >
                        <option value="" disabled>Selecione o cargo...</option>
                        <option value="Head do Núcleo">Head do Núcleo</option>
                        <option value="Coordenador">Coordenador</option>
                        <option value="Atendimento">Atendimento</option>
                        <option value="Produção">Produção</option>
                        <option value="Planejamento">Planejamento</option>
                        <option value="Operação">Operação</option>
                        <option value="Outro">Outro</option>
                      </select>
                      {(!['Head do Núcleo', 'Coordenador', 'Atendimento', 'Produção', 'Planejamento', 'Operação', ''].includes(formRole) || formRole.startsWith('Outro ')) && (
                        <input
                          type="text"
                          required
                          placeholder="Digite o cargo customizado..."
                          value={formRole.startsWith('Outro ') ? formRole.substring(6) : formRole}
                          onChange={(e) => setFormRole('Outro ' + e.target.value)}
                          className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white text-xs mt-1.5"
                        />
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="Ex: Designer Sênior"
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                      className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                    />
                  )}
                </div>
              </div>

              {getRoleLabel(formProfile) === 'NÚCLEO' && getRoleLabel(selectedUser.profile) !== 'MASTER' ? (
                <div>
                  <label className="font-bold text-[#00BCD4] block mb-1">Vincular a qual Núcleo? *</label>
                  <select
                    required
                    value={formNucleoId}
                    onChange={(e) => setFormNucleoId(e.target.value)}
                    className="w-full border border-[#00BCD4]/40 p-2 rounded-lg text-text-primary bg-[#E0F7FA]/10 focus:outline-none focus:border-action-cyan font-semibold text-xs"
                  >
                    <option value="" disabled>Selecione um núcleo...</option>
                    {nucleos.map(n => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-text-secondary mt-1">O usuário do núcleo só poderá ver dados e criar demandas do núcleo vinculado.</p>
                </div>
              ) : getRoleLabel(formProfile) === 'C-LEVEL' ? (
                <div className="bg-purple-50/50 border border-purple-100 p-3 rounded-xl">
                  <p className="text-[10px] text-purple-900 leading-relaxed font-semibold">
                    💡 Usuários C-LEVEL possuem atuação multi-núcleo e podem operar oportunidades de qualquer núcleo.
                  </p>
                </div>
              ) : getRoleLabel(formProfile) === 'RH' ? (
                <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-xl">
                  <p className="text-[10px] text-blue-900 leading-relaxed font-semibold">
                    💡 Usuários RH possuem acesso operacional à gestão de usuários, núcleos, freelas e fluxos de aprovação.
                  </p>
                </div>
              ) : null}

              <div>
                <label className="font-bold text-text-secondary block mb-1">Status Ativação</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      disabled={selectedUser.id === currentUser.id}
                      checked={formStatus === 'Ativo'}
                      onChange={() => setFormStatus('Ativo')}
                      className="accent-action-cyan disabled:opacity-50"
                    />
                    Ativo
                  </label>
                  <label className="flex items-center gap-1.5 font-semibold cursor-pointer text-text-secondary">
                    <input
                      type="radio"
                      disabled={selectedUser.id === currentUser.id}
                      checked={formStatus === 'Inativo'}
                      onChange={() => setFormStatus('Inativo')}
                      className="accent-action-cyan disabled:opacity-50"
                    />
                    Inativo (Acesso Bloqueado)
                  </label>
                </div>
                {selectedUser.id === currentUser.id && (
                  <p className="text-[10px] text-yellow-600 font-semibold mt-1">⚠️ Você não pode inativar sua própria conta operacional logada.</p>
                )}
              </div>

              <div className="pt-4 flex gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditUserModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold p-2.5 px-4 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-action-cyan hover:bg-action-cyan/95 text-white font-extrabold p-2.5 px-6 rounded-xl transition"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REDEFINE INITIAL PASSWORD */}
      {isResetPasswordModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 w-full max-w-sm text-xs animate-scale-up flex flex-col max-h-[90vh]">
            <div className="p-4 bg-sidebar-navy text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-action-cyan" />
                <h3 className="font-extrabold text-xs uppercase tracking-wider">Redefinir Senha Inicial</h3>
              </div>
              <button onClick={() => setIsResetPasswordModalOpen(false)} className="text-white hover:text-action-cyan">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-5 space-y-4 overflow-y-auto">
              <div className="bg-amber-50 border border-amber-100 text-amber-900 p-3 rounded-xl space-y-1">
                <h4 className="font-bold text-[11px]">Atenção operacional:</h4>
                <p className="text-[10px] leading-relaxed">
                  Ao redefinir a senha de <strong>{selectedUser.name}</strong>, ele será novamente marcado com o status <strong>"Primeiro acesso pendente"</strong>.
                  Sendo assim, ele terá que alterar obrigatoriamente essa senha no próximo login.
                </p>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Nova Senha Inicial *</label>
                <input
                  type="password"
                  required
                  placeholder="Nova senha temporária..."
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                />
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Confirmar Nova Senha *</label>
                <input
                  type="password"
                  required
                  placeholder="Repita a senha temporária..."
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                />
              </div>

              <div className="pt-2 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsResetPasswordModalOpen(false)}
                  className="bg-slate-100 text-slate-700 font-bold p-2 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-action-cyan hover:bg-action-cyan/95 text-white font-extrabold p-2 px-4 rounded-lg flex items-center gap-1"
                >
                  Redefinir e Forçar Troca
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DETAILS MODEL */}
      {isDetailsModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 w-full max-w-sm text-xs animate-scale-up flex flex-col max-h-[90vh]">
            <div className="p-4 bg-sidebar-navy text-white flex justify-between items-center shrink-0">
              <h3 className="font-extrabold text-xs uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-action-cyan" /> Detalhes do Usuário
              </h3>
              <button onClick={() => setIsDetailsModalOpen(false)} className="text-white hover:text-action-cyan">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-full bg-[#E0F7FA] text-cyan-800 font-extrabold flex items-center justify-center text-sm uppercase">
                  {selectedUser.name.slice(0, 2)}
                </div>
                <div>
                  <h4 className="font-bold text-text-primary text-sm">{selectedUser.name}</h4>
                  <p className="text-[10px] text-text-secondary uppercase font-bold tracking-wider color-[var(--color-primary-600)]">
                    Perfil: {getRoleLabel(selectedUser.profile)}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                  <span className="text-text-secondary font-bold">E-mail corporativo:</span>
                  <span className="text-text-primary font-semibold">{selectedUser.email}</span>
                </div>

                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                  <span className="text-text-secondary font-bold">Cargo/Função:</span>
                  <span className="text-text-primary font-semibold">{selectedUser.role || '—'}</span>
                </div>

                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                  <span className="text-text-secondary font-bold">Situação Operacional:</span>
                  <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] uppercase
                    ${selectedUser.status === 'Ativo' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>
                    {selectedUser.status}
                  </span>
                </div>

                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                  <span className="text-text-secondary font-bold">Primeiro Login:</span>
                  <span className={`font-bold text-[10px]
                    ${selectedUser.firstAccessPending ? 'text-amber-700' : 'text-slate-600'}`}>
                    {selectedUser.firstAccessPending ? 'Pendente de Redefinição' : 'Senha Alterada'}
                  </span>
                </div>

                {getRoleLabel(selectedUser.profile) === 'NÚCLEO' && (
                  <div className="flex justify-between items-center bg-[#E0F7FA]/20 border border-cyan-150 p-2.5 rounded-lg">
                    <span className="text-cyan-800 font-bold">Núcleo Autorizado:</span>
                    <span className="text-cyan-900 font-extrabold uppercase">
                      {nucleos.find(n => n.id === selectedUser.nucleoId)?.name || 'Desconhecido'}
                    </span>
                  </div>
                )}

                {getRoleLabel(selectedUser.profile) === 'C-LEVEL' && (
                  <div className="flex justify-between items-center bg-purple-50 border border-purple-150 p-2.5 rounded-lg">
                    <span className="text-purple-800 font-bold">Núcleo Autorizado:</span>
                    <span className="text-purple-950 font-extrabold uppercase">
                      🌐 Multi-núcleo
                    </span>
                  </div>
                )}

                {(getRoleLabel(selectedUser.profile) === 'MASTER' || getRoleLabel(selectedUser.profile) === 'RH') && (
                  <div className="flex justify-between items-center bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                    <span className="text-slate-800 font-bold">Núcleo Autorizado:</span>
                    <span className="text-slate-900 font-extrabold uppercase">
                      {getRoleLabel(selectedUser.profile) === 'MASTER' ? 'Todos os núcleos' : 'Estratégico / Geral'}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="bg-sidebar-navy hover:bg-slate-800 text-white font-bold p-2 px-5 rounded-lg"
                >
                  OK, Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
