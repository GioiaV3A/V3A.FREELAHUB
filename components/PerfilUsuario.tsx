'use client';

import React, { useState } from 'react';
import { DatabaseProps } from '@/app/page';
import { User } from '@/lib/mockData';
import { ShieldCheck, UserCheck, Key, Lock, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

export default function PerfilUsuario({ db }: { db: DatabaseProps & { users: User[]; setUsers: React.Dispatch<React.SetStateAction<User[]>> } }) {
  const { currentUser, setUsers, nucleos, setCurrentUser } = db;
  const { theme, setTheme } = useTheme();

  // Change password form states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Notifications
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);
  const [notifyType, setNotifyType] = useState<'success' | 'error'>('success');

  const triggerNotification = (msg: string, type: 'success' | 'error' = 'success') => {
    setNotifyMsg(msg);
    setNotifyType(type);
    setTimeout(() => setNotifyMsg(null), 5000);
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      triggerNotification('Por favor, preencha todos os campos para a troca de senha.', 'error');
      return;
    }

    // Verify current password matching
    // Note: in our state system, we also check DB matches
    if (currentUser.password !== currentPassword) {
      triggerNotification('A senha atual está incorreta.', 'error');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      triggerNotification('As senhas informadas não coincidem o novo padrão.', 'error');
      return;
    }

    // Update database user lists
    setUsers(prev => prev.map(u => {
      if (u.id === currentUser.id) {
        return {
          ...u,
          password: newPassword,
          firstAccessPending: false // Clear the first login flag if any
        };
      }
      return u;
    }));

    // Update current session user
    setCurrentUser((prev: any) => ({
      ...prev,
      password: newPassword,
      firstAccessPending: false
    }));

    // Clear form inputs
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');

    triggerNotification('Sua senha corporativa foi atualizada com sucesso no banco de dados!', 'success');
  };

  const userNucleo = nucleos.find(n => n.id === currentUser.nucleoId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Visual Header */}
      <div>
        <h2 className="text-xl font-bold text-text-primary">Configurações de Meu Perfil</h2>
        <p className="text-xs text-text-secondary">Visualize suas credenciais de acesso corporativas e realize a rotação segura de senhas.</p>
      </div>

      {notifyMsg && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-3 border shadow-xs animate-fade-in
          ${notifyType === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-red-50 text-red-800 border-red-200'}`}>
          {notifyType === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{notifyMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left Column: Profile Card Overview */}
        <div className="md:col-span-5 bg-white border border-border-subtle rounded-2xl p-6 flex flex-col items-center text-center shadow-xs">
          <div className="w-16 h-16 rounded-full bg-[var(--bg-surface)] text-[var(--text-primary)] font-extrabold text-xl flex items-center justify-center uppercase shadow-sm">
            {currentUser.name.slice(0, 2)}
          </div>

          <h3 className="font-bold text-text-primary text-base mt-4">{currentUser.name}</h3>
          <p className="text-xs text-text-secondary">{currentUser.email}</p>

          <div className="w-full border-t border-border-subtle my-5 pt-5 space-y-3.5 text-left text-xs">
            <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-text-secondary font-bold">Perfil de Acesso:</span>
              <span className={`font-extrabold px-2.5 py-0.5 rounded-full text-[10px] tracking-wider uppercase
                ${currentUser.profile === 'MASTER' ? 'bg-white text-slate-800' : currentUser.profile === 'RH' ? 'bg-blue-150 text-blue-800' : 'bg-cyan-150 text-cyan-800'}`}>
                {currentUser.profile}
              </span>
            </div>

            {currentUser.profile === 'NÚCLEO' && (
              <div className="flex justify-between items-center bg-cyan-50/50 p-2.5 border border-cyan-150 rounded-lg">
                <span className="text-cyan-800 font-bold">Núcleo Vinculado:</span>
                <span className="text-cyan-900 font-extrabold uppercase">{userNucleo?.name || (currentUser.isMasterAccount ? 'TODOS OS NÚCLEOS (Modo Master)' : 'Vínculo Ausente')}</span>
              </div>
            )}

            <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-text-secondary font-bold">Cargo Organizacional:</span>
              <span className="text-text-primary font-bold">{currentUser.role || 'Colaborador V3A'}</span>
            </div>

            <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="text-text-secondary font-bold">Status da Conta:</span>
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">Ativo</span>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-border-subtle inline-flex items-center gap-2 text-[10px] text-text-secondary w-full text-center">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mx-auto" />
            <p className="text-left font-medium leading-relaxed">Suas credenciais são gerenciadas internamente pela TI corporativa da V3A.</p>
          </div>
        </div>

        {/* Left Column Part 2: Theme Settings */}
        <div className="md:col-span-5 bg-white border border-border-subtle rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
            <Sparkles className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-text-primary text-sm">Preferências de Interface</h3>
          </div>

          <div className="space-y-3">
            <label className="block font-bold text-[10px] text-text-secondary uppercase tracking-wider">Tema da plataforma</label>
            <div className="grid grid-cols-3 gap-2">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`py-2 px-1 rounded-xl border text-center font-extrabold text-[11px] capitalize transition cursor-pointer select-none
                    ${theme === t
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[#0F2342]'
                      : 'bg-slate-50 text-text-secondary border-border-subtle hover:bg-slate-100'}`}
                >
                  {t === 'light' ? 'Claro' : t === 'dark' ? 'Escuro' : 'Sistema'}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-text-secondary leading-relaxed mt-1">
              Altere a exibição entre os modos claro, escuro ou siga a preferência do seu sistema.
            </p>
          </div>
        </div>

        {/* Right Column: Change Password Forms */}
        <div className="md:col-span-7 bg-white border border-border-subtle rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
            <Key className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-text-primary text-sm">Atualizar Senha de Segurança</h3>
          </div>

          <p className="text-[11px] text-text-secondary leading-relaxed">
            Recomenda-se utilizar caracteres especiais, números e letras maiúsculas para manter a segurança do portal Freela Hub corporativo.
          </p>

          <form onSubmit={handleChangePasswordSubmit} className="space-y-4 text-xs font-semibold text-text-secondary">
            
            <div>
              <label className="block mb-1 font-bold">Senha Atual Corporativa *</label>
              <input
                type="password"
                required
                placeholder="Insira sua senha atual..."
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full border border-border-subtle p-2.5 rounded-xl text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50 font-normal"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block mb-1 font-bold">Nova Senha *</label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo de caracteres recomendados..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-border-subtle p-2.5 rounded-xl text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50 font-normal"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold">Confirmar Nova Senha *</label>
                <input
                  type="password"
                  required
                  placeholder="Repita sua nova senha..."
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full border border-border-subtle p-2.5 rounded-xl text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50 font-normal"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="bg-white hover:bg-slate-50 text-[var(--text-primary)] font-extrabold p-2.5 px-6 rounded-xl transition flex items-center gap-1.5 shadow-xs text-xs"
              >
                <Lock className="w-4 h-4 text-amber-600" /> Salvar nova senha
              </button>
            </div>

          </form>
        </div>

      </div>

    </div>
  );
}
