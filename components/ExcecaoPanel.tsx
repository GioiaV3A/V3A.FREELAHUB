'use client';

import React, { useState } from 'react';
import { DatabaseProps } from '@/app/page';
import { generateUniqueId } from '@/lib/utils';
import { 
  Scale, 
  Plus, 
  ShieldCheck, 
  Check, 
  X, 
  Tag, 
  ListFilter, 
  AlertTriangle, 
  Edit2, 
  Copy, 
  Eye, 
  Power,
  RotateCcw
} from 'lucide-react';
import { ValuePolicy } from '@/lib/mockData';
import { useSortableTable } from '@/hooks/useSortableTable';
import { SortableHeader } from '@/components/SortableHeader';

export default function ExcecaoPanel({ db }: { db: any }) {
  const [activeTab, setActiveTab2] = useState<'politica' | 'excecoes' | 'industrias'>('politica');
  
  // Advanced filters state
  const [filterRole, setFilterRole] = useState('todos');
  const [filterSeniority, setFilterSeniority] = useState('todos');
  const [filterBillingType, setFilterBillingType] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');

  // Policy Modal state
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policyModalMode, setPolicyModalMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [selectedPolicy, setSelectedPolicy] = useState<ValuePolicy | null>(null);

  // Form states inside modal
  const [formRole, setFormRole] = useState('Designer 3D');
  const [formSeniority, setFormSeniority] = useState<'Júnior' | 'Pleno' | 'Sênior' | 'Especialista'>('Sênior');
  const [formBillingType, setFormBillingType] = useState<'Diária' | 'Hora' | 'Job Fechado'>('Diária');
  const [formReferenceValue, setFormReferenceValue] = useState(600);
  const [formCeilingValue, setFormCeilingValue] = useState(800);
  const [formStatus, setFormStatus] = useState<'Ativo' | 'Inativo'>('Ativo');

  const pendingExceptions = db.negotiations.filter((n: any) => n.status === 'Pendente aprovação RH');

  const openCreateModal = () => {
    setPolicyModalMode('create');
    setSelectedPolicy(null);
    setFormRole('Designer 3D');
    setFormSeniority('Sênior');
    setFormBillingType('Diária');
    setFormReferenceValue(600);
    setFormCeilingValue(800);
    setFormStatus('Ativo');
    setIsPolicyModalOpen(true);
  };

  const openEditModal = (pol: ValuePolicy) => {
    setPolicyModalMode('edit');
    setSelectedPolicy(pol);
    setFormRole(pol.role);
    setFormSeniority(pol.seniority);
    setFormBillingType(pol.billingType);
    setFormReferenceValue(pol.referenceValue);
    setFormCeilingValue(pol.ceilingValue);
    setFormStatus(pol.status || 'Ativo');
    setIsPolicyModalOpen(true);
  };

  const openDuplicateModal = (pol: ValuePolicy) => {
    setPolicyModalMode('duplicate');
    setSelectedPolicy(pol);
    setFormRole(pol.role);
    setFormSeniority(pol.seniority);
    setFormBillingType(pol.billingType);
    setFormReferenceValue(pol.referenceValue);
    setFormCeilingValue(pol.ceilingValue);
    setFormStatus('Ativo'); // Default duplicated to active
    setIsPolicyModalOpen(true);
  };

  const handlePolicyFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formReferenceValue <= 0 || formCeilingValue <= 0) {
      alert('Os valores de referência e teto máximo devem ser maiores que zero.');
      return;
    }

    if (formReferenceValue > formCeilingValue) {
      alert('O valor de referência não pode ser maior que o teto máximo permitido.');
      return;
    }

    // Check duplicate role + seniority (only for create / duplicate, or if we changed them in edit)
    const isDuplicate = db.policies.some((p: any) => 
      p.role === formRole && 
      p.seniority === formSeniority && 
      p.billingType === formBillingType &&
      p.id !== (selectedPolicy?.id || '')
    );

    if (isDuplicate) {
      alert('Já existe uma política de valores cadastrada para esta mesma Função, Senioridade e Tipo de Cobrança.');
      return;
    }

    if (policyModalMode === 'create' || policyModalMode === 'duplicate') {
      const newPol = {
        id: generateUniqueId('pol'),
        role: formRole,
        seniority: formSeniority,
        billingType: formBillingType,
        referenceValue: formReferenceValue,
        ceilingValue: formCeilingValue,
        status: formStatus,
        updatedAt: new Date().toLocaleDateString('pt-BR')
      };
      db.setPolicies((prev: any[]) => [...prev, newPol]);
      alert(`Nova política para "${formRole} ${formSeniority}" salva com sucesso!`);
    } else if (policyModalMode === 'edit' && selectedPolicy) {
      db.setPolicies((prev: any[]) => prev.map(p => 
        p.id === selectedPolicy.id 
          ? { 
              ...p, 
              role: formRole, 
              seniority: formSeniority, 
              billingType: formBillingType, 
              referenceValue: formReferenceValue, 
              ceilingValue: formCeilingValue,
              status: formStatus,
              updatedAt: new Date().toLocaleDateString('pt-BR')
            } 
          : p
      ));
      alert(`Política de valores atualizada com sucesso!`);
    }

    setIsPolicyModalOpen(false);
  };

  const handleToggleStatus = (pol: ValuePolicy) => {
    const nextStatus = (pol.status || 'Ativo') === 'Ativo' ? 'Inativo' : 'Ativo';
    const actionText = nextStatus === 'Ativo' ? 'reativar' : 'inativar';
    
    if (confirm(`Deseja realmente ${actionText} a política de valores para "${pol.role} ${pol.seniority}"?`)) {
      db.setPolicies((prev: any[]) => prev.map(p => 
        p.id === pol.id 
          ? { 
              ...p, 
              status: nextStatus,
              updatedAt: new Date().toLocaleDateString('pt-BR')
            } 
          : p
      ));
      alert(`Política ${nextStatus === 'Ativo' ? 'reativada' : 'inativada'} com sucesso.`);
    }
  };

  // Exception decisions
  const handleDecision = (negId: string, approve: boolean) => {
    const neg = db.negotiations.find((n: any) => n.id === negId);
    if (!neg) return;

    if (approve) {
      // Approve Exception
      db.setNegotiations((prev: any[]) => prev.map(n => n.id === negId ? { ...n, status: 'Aprovado pelo RH' } : n));
      
      db.setShortlists((prev: any[]) => prev.map(s => 
        s.jobId === neg.jobId && s.freelancerId === neg.freelancerId 
          ? { ...s, candidateStatus: 'Aprovado pelo RH' }
          : s
      ));

      // Transition the JOB status to "Bookado" which allows booking
      db.setJobs((prev: any[]) => prev.map(j => j.id === neg.jobId ? { 
        ...j, 
        status: 'Bookado',
        selectedFreelancerId: neg.freelancerId,
        closedAt: new Date().toISOString(),
        closedBy: db.currentUser.id,
        closureReason: 'Contratação excepcional aprovada pelo RH.'
      } : j));

      // Generate allocation code
      const nextNumString = String(db.allocations.length + 1).padStart(4, '0');
      const allocCode = `ALOC-2026-${nextNumString}`;

      const newAlloc = {
        id: generateUniqueId('alloc'),
        allocationCode: allocCode,
        jobId: neg.jobId,
        freelancerId: neg.freelancerId,
        nucleoId: db.jobs.find((j: any) => j.id === neg.jobId)?.nucleoId || (db.nucleos && db.nucleos[0]?.id) || '55d9d7c0-d3cb-4f1e-84ad-e77ff961805b',
        startDate: db.jobs.find((j: any) => j.id === neg.jobId)?.startDate || '2026-06-01',
        endDate: db.jobs.find((j: any) => j.id === neg.jobId)?.endDate || '2026-06-08',
        approvedValue: neg.negotiatedValue,
        status: 'Ativo' as const
      };

      db.setAllocations((prev: any[]) => [...prev, newAlloc]);
      db.setPaymentCodes((prev: any[]) => [
        ...prev,
        {
          id: generateUniqueId('pay'),
          allocationCode: allocCode,
          jobId: neg.jobId,
          freelancerId: neg.freelancerId,
          approvedValue: neg.negotiatedValue,
          paymentStatus: 'Aguardando conclusão do job'
        }
      ]);

      alert(`✅ Exceção Aprovada! Código de Alocação ${allocCode} emitido com sucesso.`);
    } else {
      // Reject exception
      db.setNegotiations((prev: any[]) => prev.map(n => n.id === negId ? { ...n, status: 'Rejeitado pelo RH' } : n));
      db.setShortlists((prev: any[]) => prev.map(s => 
        s.jobId === neg.jobId && s.freelancerId === neg.freelancerId 
          ? { ...s, candidateStatus: 'Valor fora da política' }
          : s
      ));
      alert('❌ Exceção rejeitada pelo RH da agência. O núcleo deve negociar abaixo do teto.');
    }
  };

  // Filter policies list
  const filteredPolicies = db.policies.filter((pol: any) => {
    const matchesRole = filterRole === 'todos' || pol.role === filterRole;
    const matchesSeniority = filterSeniority === 'todos' || pol.seniority === filterSeniority;
    const matchesBillingType = filterBillingType === 'todos' || pol.billingType === filterBillingType;
    const matchesStatus = filterStatus === 'todos' || (pol.status || 'Ativo') === filterStatus;
    return matchesRole && matchesSeniority && matchesBillingType && matchesStatus;
  });

  const {
    data: sortedPolicies,
    sortKey,
    sortDirection,
    requestSort
  } = useSortableTable(filteredPolicies, 'role', 'asc');

  const hasWritePermission = db.currentUser.profile === 'MASTER' || db.currentUser.profile === 'RH';

  return (
    <div id="governance-panel-container" className="space-y-6">
      {/* Visual Sub tabs */}
      <div className="border-b border-border-subtle flex gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab2('politica')}
          className={`pb-2.5 border-b-2 transition-all cursor-pointer ${activeTab === 'politica' ? 'border-action-cyan text-action-cyan' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Tabela Política de Valores ({db.policies.length})
        </button>
        <button
          onClick={() => setActiveTab2('excecoes')}
          className={`pb-2.5 border-b-2 transition-all cursor-pointer ${activeTab === 'excecoes' ? 'border-action-cyan text-action-cyan' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Controle de Exceções Pendentes ({pendingExceptions.length})
        </button>
        <button
          onClick={() => setActiveTab2('industrias')}
          className={`pb-2.5 border-b-2 transition-all cursor-pointer ${activeTab === 'industrias' ? 'border-action-cyan text-action-cyan' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Nayos & Indústrias Homologadas
        </button>
      </div>

      {/* CONTAINER CARDS */}
      <div className="bg-white rounded-2xl border border-border-subtle p-6 shadow-xs min-h-[300px]">
        {/* TAB 1: VALORESPOLICY */}
        {activeTab === 'politica' && (
          <div className="space-y-6">
            <div className="flex md:flex-row flex-col justify-between items-start md:items-center border-b border-border-subtle pb-4 gap-4">
              <div>
                <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-[#B28900]" />
                  <span>Matriz de Políticas de Valores e Tetos Máximos</span>
                </h3>
                <p className="text-[10px] text-text-secondary mt-0.5">Tabela de conformidade de contratações por diária e cargo, pactuada com a diretoria.</p>
              </div>

              {/* Botão Nova Politica */}
              {hasWritePermission && (
                <button
                  onClick={openCreateModal}
                  className="bg-action-cyan hover:bg-action-cyan/95 text-white font-extrabold p-2 px-4 rounded-xl flex items-center gap-1.5 shadow-xs text-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Nova Política
                </button>
              )}
            </div>

            {/* Filter controls */}
            <div className="bg-slate-50 p-4 rounded-xl border border-border-subtle grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="font-bold text-text-secondary block mb-1">Função / Cargo</label>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white focus:outline-none focus:border-action-cyan"
                >
                  <option value="todos">Todas as funções</option>
                  <option value="Diretor de Arte">Diretor de Arte</option>
                  <option value="Designer 3D">Designer 3D</option>
                  <option value="Planejamento">Planejamento</option>
                  <option value="Produtor Executivo">Produtor Executivo</option>
                  <option value="Produtor de Campo">Produtor de Campo</option>
                  <option value="Atendimento">Atendimento</option>
                  <option value="Redator">Redator</option>
                  <option value="Motion Designer">Motion Designer</option>
                  <option value="Cenógrafo">Cenógrafo</option>
                  <option value="Conteúdo">Conteúdo</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Senioridade</label>
                <select
                  value={filterSeniority}
                  onChange={(e) => setFilterSeniority(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white focus:outline-none focus:border-action-cyan"
                >
                  <option value="todos">Todos os níveis</option>
                  <option value="Júnior">Júnior</option>
                  <option value="Pleno">Pleno</option>
                  <option value="Sênior">Sênior</option>
                  <option value="Especialista">Especialista</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Cobrança</label>
                <select
                  value={filterBillingType}
                  onChange={(e) => setFilterBillingType(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white focus:outline-none focus:border-action-cyan"
                >
                  <option value="todos">Todos os formatos</option>
                  <option value="Diária">Diária</option>
                  <option value="Hora">Hora</option>
                  <option value="Job Fechado">Job Fechado</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white focus:outline-none focus:border-action-cyan"
                >
                  <option value="todos">Todos os status</option>
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                </select>
              </div>
            </div>

            {/* List Table */}
            <div className="overflow-x-auto border border-border-subtle rounded-xl bg-white shadow-xs">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-surface font-semibold text-text-secondary border-b border-border-subtle">
                  <tr>
                    <SortableHeader label="FUNÇÃO / CARGO" sortKey="role" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-6 py-3" />
                    <SortableHeader label="SENIORIDADE" sortKey="seniority" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-6 py-3" />
                    <SortableHeader label="TIPO DE COBRANÇA" sortKey="billingType" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-6 py-3" />
                    <SortableHeader label="VALOR DESIGNADO DE REFERÊNCIA" sortKey="referenceValue" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} align="right" className="px-6 py-3" />
                    <SortableHeader label="TETO MÁXIMO AUTORIZADO" sortKey="ceilingValue" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} align="right" className="px-6 py-3" />
                    <th className="px-6 py-3">APROVAÇÃO EXIGIDA</th>
                    <SortableHeader label="STATUS" sortKey="status" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-6 py-3" />
                    <SortableHeader label="ÚLTIMA ATUALIZAÇÃO" sortKey="updatedAt" activeSortKey={sortKey} direction={sortDirection} onSort={requestSort} className="px-6 py-3" />
                    {hasWritePermission && <th className="px-6 py-3 text-right">AÇÕES</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-medium text-text-primary">
                  {sortedPolicies.length === 0 ? (
                    <tr>
                      <td colSpan={hasWritePermission ? 9 : 8} className="px-6 py-8 text-center text-text-secondary italic">
                        Nenhuma diretriz de política cadastrada com os filtros informados.
                      </td>
                    </tr>
                  ) : (
                    sortedPolicies.map((pol: any) => {
                      const isAtivo = (pol.status || 'Ativo') === 'Ativo';
                      return (
                        <tr key={pol.id} className={`hover:bg-slate-50 transition-colors ${!isAtivo ? 'opacity-60 bg-slate-50/55' : ''}`}>
                          <td className="px-6 py-3.5 font-bold">{pol.role}</td>
                          <td className="px-6 py-3.5 text-text-secondary font-semibold">{pol.seniority}</td>
                          <td className="px-6 py-3.5 text-text-secondary">{pol.billingType}</td>
                          <td className="px-6 py-3.5 text-right text-status-success font-bold">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pol.referenceValue)}
                          </td>
                          <td className="px-6 py-3.5 text-right font-extrabold text-[#B28900]">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pol.ceilingValue)}
                          </td>
                          <td className="px-6 py-3.5 font-semibold">
                            <span className="bg-amber-50 text-[#B28900] px-2 py-0.5 rounded text-[10px] font-bold">
                              Acima de R$ {pol.ceilingValue}
                            </span>
                          </td>
                          <td className="px-6 py-3.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border 
                              ${isAtivo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-650 border-slate-200'}`}>
                              {pol.status || 'Ativo'}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-text-secondary text-[11px] font-semibold">{pol.updatedAt || '—'}</td>
                          {hasWritePermission && (
                            <td className="px-6 py-3.5 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => openEditModal(pol)}
                                  className="text-blue-700 hover:bg-blue-50 border border-blue-200 p-1 px-2 rounded-lg font-bold text-[10px] cursor-pointer"
                                  title="Editar Parâmetros"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => openDuplicateModal(pol)}
                                  className="text-slate-700 hover:bg-slate-50 border border-slate-200 p-1 px-2 rounded-lg font-bold text-[10px] cursor-pointer"
                                  title="Duplicar Política"
                                >
                                  Duplicar
                                </button>
                                <button
                                  onClick={() => handleToggleStatus(pol)}
                                  className={`p-1 px-2 rounded-lg font-bold text-[10px] border cursor-pointer
                                    ${isAtivo 
                                      ? 'text-red-700 bg-red-50 hover:bg-red-100 border-red-200' 
                                      : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'}`}
                                  title={isAtivo ? 'Inativar Política' : 'Reativar Política'}
                                >
                                  {isAtivo ? 'Inativar' : 'Reativar'}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: EXCEÇÕES APROVAÇÕES */}
        {activeTab === 'excecoes' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-status-error" />
                <span>Auditoria e Resolução de Exceções de Valor</span>
              </h3>
              <p className="text-[10px] text-text-secondary mt-0.5">Aprovações financeiras operadas em regime de urgência pelos núcleos de live marketing.</p>
            </div>

            {pendingExceptions.length === 0 ? (
              <div className="p-12 text-center text-text-secondary text-xs italic border border-dashed border-border-subtle rounded-xl">
                Nenhum desvio ou exceção de tarifas pendente no momento. Compliance ativo e auditado!
              </div>
            ) : (
              <div className="space-y-4">
                {pendingExceptions.map((neg: any) => {
                  const job = db.jobs.find((j: any) => j.id === neg.jobId);
                  const freela = db.freelancers.find((f: any) => f.id === neg.freelancerId);
                  const policy = db.policies.find((p: any) => p.role === job?.roleNeeded && p.seniority === job?.seniorityNeeded);
                  const ceiling = policy ? policy.ceilingValue : 0;
                  const delta = neg.negotiatedValue - ceiling;

                  return (
                    <div key={neg.id} className="p-4 border border-border-subtle rounded-xl bg-surface space-y-3 text-xs">
                      <div className="flex md:flex-row flex-col justify-between items-start gap-2">
                        <div>
                          <strong className="text-text-primary text-sm">{freela?.name}</strong>
                          <p className="text-text-secondary text-[11px]">Core Role: {candSpecialRole(job, freela)} • Job: {job?.name} ({job?.client})</p>
                        </div>

                        {/* rh or master actions */}
                        {(db.currentUser.profile === 'MASTER' || db.currentUser.profile === 'RH') ? (
                          <div className="flex gap-1.5 self-end md:self-start">
                            <button
                              onClick={() => handleDecision(neg.id, true)}
                              className="bg-status-success text-white font-bold p-1 px-3 rounded-lg flex items-center gap-1 hover:brightness-95 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" /> Aprovar Exceção
                            </button>
                            <button
                              onClick={() => handleDecision(neg.id, false)}
                              className="bg-status-error text-white font-bold p-1 px-3 rounded-lg flex items-center gap-1 hover:brightness-95 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" /> Rejeitar Exceção
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-[#B28900] bg-status-warning/10 p-1 px-2.5 rounded-lg">
                            ⚠️ Pendente de Liberação por RH Sênior
                          </span>
                        )}
                      </div>

                      {/* comparative summary card */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-white border border-border-subtle rounded-lg text-[11px]">
                        <div>
                          <span className="text-text-secondary block">Cargo de Referência</span>
                          <span className="font-semibold text-text-primary">{job?.roleNeeded} ({job?.seniorityNeeded})</span>
                        </div>
                        <div>
                          <span className="text-text-secondary block">Teto Governança</span>
                          <span className="font-semibold text-text-primary">R$ {ceiling} / diária</span>
                        </div>
                        <div>
                          <span className="text-text-secondary block font-bold text-status-error">Diária Requerida</span>
                          <span className="font-bold text-status-error">R$ {neg.negotiatedValue}</span>
                        </div>
                        <div>
                          <span className="text-text-secondary block">Desvio Financeiro GAP</span>
                          <span className="font-bold text-status-error">+{ceiling > 0 ? Math.round((delta / ceiling) * 100) : 0}% (+R$ {delta})</span>
                        </div>
                      </div>

                      <div className="bg-status-warning/5 border border-status-warning/20 p-2.5 rounded-lg text-text-primary leading-relaxed italic text-[11px]">
                        <strong>Justificativa do Núcleo:</strong> &ldquo;{neg.justificationIfAbovePolicy}&rdquo;
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CATEGORIAS / INDÚSTRIAS */}
        {activeTab === 'industrias' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-primary" />
                <span>Indústrias & Segmentações de Ativação Homologadas</span>
              </h3>
              <p className="text-[10px] text-text-secondary mt-0.5">Pilares de nicho corporativos para cruzamento de briefings na shortlist de campanhas.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Beverages */}
              <div className="border border-border-subtle p-4 rounded-xl bg-surface space-y-2">
                <h4 className="font-bold text-xs text-text-primary flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-status-success"></span> Bebidas / Alimentos (FMCG)
                </h4>
                <p className="text-[11px] text-text-secondary leading-relaxed">Foco em ativações em bares, camarotes de carnaval, mega festivals de música e stands imersivos de degustação sensorial.</p>
              </div>

              {/* Technologies */}
              <div className="border border-border-subtle p-4 rounded-xl bg-surface space-y-2">
                <h4 className="font-bold text-xs text-text-primary flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-action-cyan"></span> Tecnologia & Games
                </h4>
                <p className="text-[11px] text-text-secondary leading-relaxed">Palcos corporativos complexos, stands da CCXP, hotsites virais integrados à geolocalização e projeções mapeadas interativas.</p>
              </div>

              {/* Automotive */}
              <div className="border border-border-subtle p-4 rounded-xl bg-surface space-y-2">
                <h4 className="font-bold text-xs text-text-primary flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-status-warning"></span> Automotivos & Estrutura Agro
                </h4>
                <p className="text-[11px] text-text-secondary leading-relaxed">Feiras agrícolas gigantes, montagem de autódromos virtuais, stands de test-drive e apresentações estéticas de novos veículos.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* POLICY CREATE/EDIT/DUPLICATE MODAL */}
      {isPolicyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-xs">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 w-full max-w-md animate-scale-up">
            <div className="p-5 bg-sidebar-navy text-white flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Scale className="w-5 h-5 text-action-cyan" />
                <span>
                  {policyModalMode === 'create' && 'Criar Nova Diretriz de Política'}
                  {policyModalMode === 'edit' && 'Editar Diretriz de Política'}
                  {policyModalMode === 'duplicate' && 'Duplicar Diretriz de Política'}
                </span>
              </h3>
              <button 
                onClick={() => setIsPolicyModalOpen(false)}
                className="text-white hover:text-action-cyan cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePolicyFormSubmit} className="p-6 space-y-4">
              <div>
                <label className="font-bold text-text-secondary block mb-1">Função / Cargo *</label>
                <select 
                  value={formRole} 
                  onChange={e => setFormRole(e.target.value)} 
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white focus:outline-none focus:border-action-cyan"
                  required
                >
                  <option value="Diretor de Arte">Diretor de Arte</option>
                  <option value="Designer 3D">Designer 3D</option>
                  <option value="Planejamento">Planejamento</option>
                  <option value="Produtor Executivo">Produtor Executivo</option>
                  <option value="Produtor de Campo">Produtor de Campo</option>
                  <option value="Atendimento">Atendimento</option>
                  <option value="Redator">Redator</option>
                  <option value="Motion Designer">Motion Designer</option>
                  <option value="Cenógrafo">Cenógrafo</option>
                  <option value="Conteúdo">Conteúdo</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-text-secondary block mb-1">Nível / Senioridade *</label>
                  <select 
                    value={formSeniority} 
                    onChange={e => setFormSeniority(e.target.value as any)} 
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white focus:outline-none focus:border-action-cyan"
                    required
                  >
                    <option value="Júnior">Júnior</option>
                    <option value="Pleno">Pleno</option>
                    <option value="Sênior">Sênior</option>
                    <option value="Especialista">Especialista</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Formato de Cobrança *</label>
                  <select 
                    value={formBillingType} 
                    onChange={e => setFormBillingType(e.target.value as any)} 
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white focus:outline-none focus:border-action-cyan"
                    required
                  >
                    <option value="Diária">Diária</option>
                    <option value="Hora">Hora</option>
                    <option value="Job Fechado">Job Fechado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-text-secondary block mb-1">Valor de Referência (R$) *</label>
                  <input 
                    type="number" 
                    value={formReferenceValue} 
                    onChange={e => setFormReferenceValue(Number(e.target.value))} 
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50 font-semibold"
                    required
                    min={1}
                  />
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Teto Máximo Permitido (R$) *</label>
                  <input 
                    type="number" 
                    value={formCeilingValue} 
                    onChange={e => setFormCeilingValue(Number(e.target.value))} 
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50 font-semibold"
                    required
                    min={1}
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Status da Regra</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      checked={formStatus === 'Ativo'}
                      onChange={() => setFormStatus('Ativo')}
                      className="accent-action-cyan"
                    />
                    Ativa
                  </label>
                  <label className="flex items-center gap-1.5 font-semibold cursor-pointer text-text-secondary">
                    <input
                      type="radio"
                      checked={formStatus === 'Inativo'}
                      onChange={() => setFormStatus('Inativo')}
                      className="accent-action-cyan"
                    />
                    Inativa (Não usada no cálculo)
                  </label>
                </div>
              </div>

              <div className="pt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsPolicyModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold p-2.5 px-4 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-action-cyan hover:bg-action-cyan/95 text-white font-extrabold p-2.5 px-6 rounded-xl transition cursor-pointer"
                >
                  Salvar Diretriz
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper formatting function
function candSpecialRole(job: any, freela: any) {
  if (!job || !freela) return '';
  return `${freela.mainRole} (${freela.seniority})`;
}
