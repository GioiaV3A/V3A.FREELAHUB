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
import { StatusBadge } from './StatusBadge';

export interface GroupedPolicy {
  key: string;
  role: string;
  seniority: 'Júnior' | 'Pleno' | 'Sênior' | 'Especialista';
  dailyRef?: number;
  dailyCeiling?: number;
  dailyId?: string;
  dailyStatus?: 'Ativo' | 'Inativo';
  dailyNotes?: string;
  monthlyRef?: number;
  monthlyCeiling?: number;
  monthlyId?: string;
  monthlyStatus?: 'Ativo' | 'Inativo';
  monthlyNotes?: string;
  hourlyRef?: number;
  hourlyCeiling?: number;
  hourlyId?: string;
  hourlyStatus?: 'Ativo' | 'Inativo';
  hourlyNotes?: string;
  fixedRef?: number;
  fixedCeiling?: number;
  fixedId?: string;
  fixedStatus?: 'Ativo' | 'Inativo';
  fixedNotes?: string;
  status: 'Ativo' | 'Inativo' | 'Incompleta';
  updatedAt: string;
  isDailyDefined: boolean;
  isMonthlyDefined: boolean;
  isHourlyDefined: boolean;
  isFixedDefined: boolean;
  successFeeMaxPercent?: number;
}

export default function ExcecaoPanel({ db }: { db: any }) {
  const [activeTab, setActiveTab2] = useState<'politica' | 'excecoes' | 'industrias'>('politica');
  
  // Advanced filters state
  const [filterRole, setFilterRole] = useState('todos');
  const [filterSeniority, setFilterSeniority] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterIncompleteOnly, setFilterIncompleteOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [subTab, setSubTab] = useState<'matriz' | 'outros'>('matriz');

  // Policy Modal state
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policyModalMode, setPolicyModalMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [selectedPolicy, setSelectedPolicy] = useState<GroupedPolicy | null>(null);

  // Form states inside modal
  const [formRole, setFormRole] = useState('Designer 3D');
  const [formSeniority, setFormSeniority] = useState<'Júnior' | 'Pleno' | 'Sênior' | 'Especialista'>('Sênior');
  const [formStatus, setFormStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
  
  const [formDailyRef, setFormDailyRef] = useState<number | ''>('');
  const [formDailyCeiling, setFormDailyCeiling] = useState<number | ''>('');
  
  const [formMonthlyRef, setFormMonthlyRef] = useState<number | ''>('');
  const [formMonthlyCeiling, setFormMonthlyCeiling] = useState<number | ''>('');

  const [formHourlyRef, setFormHourlyRef] = useState<number | ''>('');
  const [formHourlyCeiling, setFormHourlyCeiling] = useState<number | ''>('');

  const [formFixedRef, setFormFixedRef] = useState<number | ''>('');
  const [formFixedCeiling, setFormFixedCeiling] = useState<number | ''>('');
  const [formSuccessFeeMaxPercent, setFormSuccessFeeMaxPercent] = useState<number | ''>('');

  const [formNotes, setFormNotes] = useState('');

  const pendingExceptions = db.negotiations.filter((n: any) => n.status === 'Pendente aprovação RH');

  // Helper function to convert BR date to ISO
  const parseBRDateToISO = (value: string | null | undefined): string => {
    if (!value) return '';
    const parts = value.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return value;
  };

  // Helper to group policies
  const groupedPoliciesList = React.useMemo(() => {
    const map = new Map<string, GroupedPolicy>();

    db.policies.forEach((pol: ValuePolicy) => {
      const key = `${pol.role}-${pol.seniority}`;
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          role: pol.role,
          seniority: pol.seniority,
          status: 'Inativo',
          updatedAt: '—',
          isDailyDefined: false,
          isMonthlyDefined: false,
          isHourlyDefined: false,
          isFixedDefined: false,
        };
        map.set(key, group);
      }

      if (pol.updatedAt && pol.updatedAt !== '—') {
        if (group.updatedAt === '—' || new Date(parseBRDateToISO(pol.updatedAt)) > new Date(parseBRDateToISO(group.updatedAt))) {
          group.updatedAt = pol.updatedAt;
        }
      }

      if (pol.billingType === 'Diária') {
        group.dailyRef = pol.referenceValue;
        group.dailyCeiling = pol.ceilingValue;
        group.dailyId = pol.id;
        group.dailyStatus = pol.status || 'Ativo';
        group.dailyNotes = pol.notes || '';
        group.isDailyDefined = true;
      } else if (pol.billingType === 'Mensal / Salário') {
        group.monthlyRef = pol.referenceValue;
        group.monthlyCeiling = pol.ceilingValue;
        group.monthlyId = pol.id;
        group.monthlyStatus = pol.status || 'Ativo';
        group.monthlyNotes = pol.notes || '';
        group.isMonthlyDefined = true;
      } else if (pol.billingType === 'Hora') {
        group.hourlyRef = pol.referenceValue;
        group.hourlyCeiling = pol.ceilingValue;
        group.hourlyId = pol.id;
        group.hourlyStatus = pol.status || 'Ativo';
        group.hourlyNotes = pol.notes || '';
        group.isHourlyDefined = true;
      } else if (pol.billingType === 'Job Fechado') {
        group.fixedRef = pol.referenceValue;
        group.fixedCeiling = pol.ceilingValue;
        group.fixedId = pol.id;
        group.fixedStatus = pol.status || 'Ativo';
        group.fixedNotes = pol.notes || '';
        group.isFixedDefined = true;
      }

      if (pol.successFeeMaxPercent !== undefined && pol.successFeeMaxPercent !== null && pol.successFeeMaxPercent !== 0) {
        group.successFeeMaxPercent = pol.successFeeMaxPercent;
      }
    });

    // Compute consolidated status
    map.forEach(group => {
      const hasDaily = group.isDailyDefined;
      const hasMonthly = group.isMonthlyDefined;
      
      const dailyActive = group.dailyStatus === 'Ativo';
      const monthlyActive = group.monthlyStatus === 'Ativo';
      
      let isActive = false;
      if (hasDaily && dailyActive) isActive = true;
      if (hasMonthly && monthlyActive) isActive = true;
      
      if (!hasDaily || !hasMonthly) {
        group.status = 'Incompleta';
      } else if (isActive) {
        group.status = 'Ativo';
      } else {
        group.status = 'Inativo';
      }
    });

    return Array.from(map.values());
  }, [db.policies]);

  const openCreateModal = () => {
    setPolicyModalMode('create');
    setSelectedPolicy(null);
    setFormRole('Designer 3D');
    setFormSeniority('Sênior');
    setFormStatus('Ativo');
    setFormDailyRef('');
    setFormDailyCeiling('');
    setFormMonthlyRef('');
    setFormMonthlyCeiling('');
    setFormHourlyRef('');
    setFormHourlyCeiling('');
    setFormFixedRef('');
    setFormFixedCeiling('');
    setFormSuccessFeeMaxPercent('');
    setFormNotes('');
    setIsPolicyModalOpen(true);
  };

  const openEditModal = (group: GroupedPolicy) => {
    setPolicyModalMode('edit');
    setSelectedPolicy(group);
    setFormRole(group.role);
    setFormSeniority(group.seniority);
    setFormStatus(group.status === 'Inativo' ? 'Inativo' : 'Ativo');
    
    setFormDailyRef(group.dailyRef || '');
    setFormDailyCeiling(group.dailyCeiling || '');
    
    setFormMonthlyRef(group.monthlyRef || '');
    setFormMonthlyCeiling(group.monthlyCeiling || '');

    setFormHourlyRef(group.hourlyRef || '');
    setFormHourlyCeiling(group.hourlyCeiling || '');

    setFormFixedRef(group.fixedRef || '');
    setFormFixedCeiling(group.fixedCeiling || '');
    setFormSuccessFeeMaxPercent(group.successFeeMaxPercent || '');

    setFormNotes(group.dailyNotes || group.monthlyNotes || group.hourlyNotes || group.fixedNotes || '');
    setIsPolicyModalOpen(true);
  };

  const openDuplicateModal = (group: GroupedPolicy) => {
    setPolicyModalMode('duplicate');
    setSelectedPolicy(group);
    setFormRole(group.role);
    setFormSeniority(group.seniority);
    setFormStatus('Ativo');
    
    setFormDailyRef(group.dailyRef || '');
    setFormDailyCeiling(group.dailyCeiling || '');
    
    setFormMonthlyRef(group.monthlyRef || '');
    setFormMonthlyCeiling(group.monthlyCeiling || '');

    setFormHourlyRef(group.hourlyRef || '');
    setFormHourlyCeiling(group.hourlyCeiling || '');

    setFormFixedRef(group.fixedRef || '');
    setFormFixedCeiling(group.fixedCeiling || '');
    setFormSuccessFeeMaxPercent(group.successFeeMaxPercent || '');

    setFormNotes(group.dailyNotes || group.monthlyNotes || group.hourlyNotes || group.fixedNotes || '');
    setIsPolicyModalOpen(true);
  };

  const handlePolicyFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate daily
    if (formDailyRef !== '' || formDailyCeiling !== '') {
      if (formDailyRef === '' || formDailyCeiling === '') {
        alert('Informe referência e teto para diária, ou deixe ambos vazios.');
        return;
      }
      if (formDailyRef <= 0 || formDailyCeiling <= 0) {
        alert('Os valores de diária devem ser maiores que zero.');
        return;
      }
      if (formDailyRef > formDailyCeiling) {
        alert('O valor de referência da diária não pode ser maior que o teto autorizado.');
        return;
      }
    }

    // Validate monthly
    if (formMonthlyRef !== '' || formMonthlyCeiling !== '') {
      if (formMonthlyRef === '' || formMonthlyCeiling === '') {
        alert('Informe referência e teto para mensal/salário, ou deixe ambos vazios.');
        return;
      }
      if (formMonthlyRef <= 0 || formMonthlyCeiling <= 0) {
        alert('Os valores mensais devem ser maiores que zero.');
        return;
      }
      if (formMonthlyRef > formMonthlyCeiling) {
        alert('O valor de referência mensal não pode ser maior que o teto autorizado.');
        return;
      }
    }

    // Validate hourly
    if (formHourlyRef !== '' || formHourlyCeiling !== '') {
      if (formHourlyRef === '' || formHourlyCeiling === '') {
        alert('Informe referência e teto para hora, ou deixe ambos vazios.');
        return;
      }
      if (formHourlyRef <= 0 || formHourlyCeiling <= 0) {
        alert('Os valores de hora devem ser maiores que zero.');
        return;
      }
      if (formHourlyRef > formHourlyCeiling) {
        alert('O valor de referência de hora não pode ser maior que o teto autorizado.');
        return;
      }
    }

    // Validate fixed
    if (formFixedRef !== '' || formFixedCeiling !== '') {
      if (formFixedRef === '' || formFixedCeiling === '') {
        alert('Informe referência e teto para job fechado, ou deixe ambos vazios.');
        return;
      }
      if (formFixedRef <= 0 || formFixedCeiling <= 0) {
        alert('Os valores de job fechado devem ser maiores que zero.');
        return;
      }
      if (formFixedRef > formFixedCeiling) {
        alert('O valor de referência de job fechado não pode ser maior que o teto autorizado.');
        return;
      }
    }

    // Validate success fee max percent
    if (formSuccessFeeMaxPercent !== '') {
      if (Number(formSuccessFeeMaxPercent) < 0 || Number(formSuccessFeeMaxPercent) > 100) {
        alert('O teto máximo de Success Fee deve ser entre 0% e 100%.');
        return;
      }
    }

    const hasAnyFilled = formDailyRef !== '' || formMonthlyRef !== '' || formHourlyRef !== '' || formFixedRef !== '';
    if (!hasAnyFilled) {
      alert('Preencha as informações de pelo menos um modelo de remuneração (Diária, Mensal, Hora ou Job Fechado).');
      return;
    }

    // Check duplicate role + seniority
    const isDuplicate = groupedPoliciesList.some(g => 
      g.role === formRole && 
      g.seniority === formSeniority && 
      g.key !== (selectedPolicy?.key || '')
    );

    if (isDuplicate) {
      alert('Já existe uma política de valores cadastrada para esta mesma Função e Senioridade.');
      return;
    }

    const updatedPolicies = [...db.policies];

    const saveModel = (
      modelName: 'daily' | 'monthly_salary' | 'hourly' | 'fixed_job',
      billingType: 'Diária' | 'Mensal / Salário' | 'Hora' | 'Job Fechado',
      refVal: number | '',
      ceilVal: number | '',
      existingId?: string
    ) => {
      const isFilled = refVal !== '' && ceilVal !== '';
      if (!isFilled) {
        if (existingId && policyModalMode === 'edit') {
          const idx = updatedPolicies.findIndex(p => p.id === existingId);
          if (idx !== -1) {
            updatedPolicies[idx] = {
              ...updatedPolicies[idx],
              status: 'Inativo',
              referenceValue: 0,
              ceilingValue: 0,
              notes: formNotes,
              successFeeMaxPercent: formSuccessFeeMaxPercent !== '' ? Number(formSuccessFeeMaxPercent) : undefined,
              updatedAt: new Date().toLocaleDateString('pt-BR')
            };
          }
        }
        return;
      }

      if (existingId && policyModalMode === 'edit') {
        const idx = updatedPolicies.findIndex(p => p.id === existingId);
        if (idx !== -1) {
          updatedPolicies[idx] = {
            ...updatedPolicies[idx],
            role: formRole,
            seniority: formSeniority,
            billingType,
            referenceValue: Number(refVal),
            ceilingValue: Number(ceilVal),
            status: formStatus,
            notes: formNotes,
            successFeeMaxPercent: formSuccessFeeMaxPercent !== '' ? Number(formSuccessFeeMaxPercent) : undefined,
            updatedAt: new Date().toLocaleDateString('pt-BR')
          };
        }
      } else {
        const newPol = {
          id: generateUniqueId('pol'),
          role: formRole,
          seniority: formSeniority,
          billingType,
          referenceValue: Number(refVal),
          ceilingValue: Number(ceilVal),
          status: formStatus,
          notes: formNotes,
          remunerationModel: modelName,
          successFeeMaxPercent: formSuccessFeeMaxPercent !== '' ? Number(formSuccessFeeMaxPercent) : undefined,
          updatedAt: new Date().toLocaleDateString('pt-BR')
        };
        updatedPolicies.push(newPol);
      }
    };

    saveModel('daily', 'Diária', formDailyRef, formDailyCeiling, selectedPolicy?.dailyId);
    saveModel('monthly_salary', 'Mensal / Salário', formMonthlyRef, formMonthlyCeiling, selectedPolicy?.monthlyId);
    saveModel('hourly', 'Hora', formHourlyRef, formHourlyCeiling, selectedPolicy?.hourlyId);
    saveModel('fixed_job', 'Job Fechado', formFixedRef, formFixedCeiling, selectedPolicy?.fixedId);

    db.setPolicies(updatedPolicies);
    alert(`Política para "${formRole} ${formSeniority}" salva com sucesso!`);
    setIsPolicyModalOpen(false);
  };

  const handleToggleStatus = (group: GroupedPolicy) => {
    const isCurrentlyAtivo = group.status === 'Ativo';
    const nextStatus = isCurrentlyAtivo ? 'Inativo' : 'Ativo';
    const actionText = isCurrentlyAtivo ? 'inativar' : 'reativar';
    const uiStatusValue = nextStatus === 'Ativo' ? 'Ativo' : 'Inativo';
    
    if (confirm(`Deseja realmente ${actionText} a política de valores para "${group.role} ${group.seniority}"?`)) {
      const updatedPolicies = db.policies.map((p: any) => {
        if (p.role === group.role && p.seniority === group.seniority) {
          return {
            ...p,
            status: uiStatusValue,
            updatedAt: new Date().toLocaleDateString('pt-BR')
          };
        }
        return p;
      });
      db.setPolicies(updatedPolicies);
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
  const filteredGroupedPolicies = groupedPoliciesList.filter(g => {
    const matchesRole = filterRole === 'todos' || g.role === filterRole;
    const matchesSeniority = filterSeniority === 'todos' || g.seniority === filterSeniority;
    const matchesStatus = filterStatus === 'todos' || g.status === filterStatus;
    const matchesIncomplete = !filterIncompleteOnly || g.status === 'Incompleta';
    const matchesSearch = !searchTerm || g.role.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesRole && matchesSeniority && matchesStatus && matchesIncomplete && matchesSearch;
  });

  const [sortKey, setSortKey] = useState<string>('role');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortKey === key && sortDirection === 'asc') {
      direction = 'desc';
    }
    setSortKey(key);
    setSortDirection(direction);
  };

  const sortedGroupedPolicies = React.useMemo(() => {
    const list = [...filteredGroupedPolicies];
    list.sort((a, b) => {
      let valA: any = a[sortKey as keyof GroupedPolicy];
      let valB: any = b[sortKey as keyof GroupedPolicy];

      if (sortKey === 'role') {
        valA = a.role;
        valB = b.role;
      } else if (sortKey === 'seniority') {
        const order = { 'Júnior': 1, 'Pleno': 2, 'Sênior': 3, 'Especialista': 4 };
        valA = order[a.seniority as keyof typeof order] || 0;
        valB = order[b.seniority as keyof typeof order] || 0;
      } else if (sortKey === 'dailyRef') {
        valA = a.dailyRef || 0;
        valB = b.dailyRef || 0;
      } else if (sortKey === 'dailyCeiling') {
        valA = a.dailyCeiling || 0;
        valB = b.dailyCeiling || 0;
      } else if (sortKey === 'monthlyRef') {
        valA = a.monthlyRef || 0;
        valB = b.monthlyRef || 0;
      } else if (sortKey === 'monthlyCeiling') {
        valA = a.monthlyCeiling || 0;
        valB = b.monthlyCeiling || 0;
      } else if (sortKey === 'hourlyRef') {
        valA = a.hourlyRef || 0;
        valB = b.hourlyRef || 0;
      } else if (sortKey === 'hourlyCeiling') {
        valA = a.hourlyCeiling || 0;
        valB = b.hourlyCeiling || 0;
      } else if (sortKey === 'fixedRef') {
        valA = a.fixedRef || 0;
        valB = b.fixedRef || 0;
      } else if (sortKey === 'fixedCeiling') {
        valA = a.fixedCeiling || 0;
        valB = b.fixedCeiling || 0;
      } else if (sortKey === 'successFeeMaxPercent') {
        valA = a.successFeeMaxPercent || 0;
        valB = b.successFeeMaxPercent || 0;
      } else if (sortKey === 'status') {
        valA = a.status;
        valB = b.status;
      } else if (sortKey === 'updatedAt') {
        valA = a.updatedAt === '—' ? '' : parseBRDateToISO(a.updatedAt);
        valB = b.updatedAt === '—' ? '' : parseBRDateToISO(b.updatedAt);
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [filteredGroupedPolicies, sortKey, sortDirection]);

  // Card summary metrics
  const totalRoles = React.useMemo(() => new Set(groupedPoliciesList.map(p => p.role)).size, [groupedPoliciesList]);
  const activeCount = React.useMemo(() => groupedPoliciesList.filter(p => p.status === 'Ativo').length, [groupedPoliciesList]);
  const incompleteCount = React.useMemo(() => groupedPoliciesList.filter(p => p.status === 'Incompleta').length, [groupedPoliciesList]);
  const pendingExceptionsCount = pendingExceptions.length;

  const hasWritePermission = db.currentUser.profile === 'MASTER' || db.currentUser.profile === 'RH';

  const formatCurrencyBRL = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div id="governance-panel-container" className="space-y-6">
      {/* Visual Sub tabs */}
      <div className="border-b border-border-subtle flex gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab2('politica')}
          className={`pb-2.5 border-b-2 transition-all cursor-pointer ${activeTab === 'politica' ? 'border-action-cyan text-amber-600' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Tabela Política de Valores ({groupedPoliciesList.length})
        </button>
        <button
          onClick={() => setActiveTab2('excecoes')}
          className={`pb-2.5 border-b-2 transition-all cursor-pointer ${activeTab === 'excecoes' ? 'border-b-2 border-action-cyan text-amber-600' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Controle de Exceções Pendentes ({pendingExceptions.length})
        </button>
        <button
          onClick={() => setActiveTab2('industrias')}
          className={`pb-2.5 border-b-2 transition-all cursor-pointer ${activeTab === 'industrias' ? 'border-b-2 border-action-cyan text-amber-600' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Nayos & Indústrias Homologadas
        </button>
      </div>

      {/* CONTAINER CARDS */}
      <div className="bg-white dark:bg-white rounded-2xl border border-border-subtle p-6 shadow-xs min-h-[300px]">
        {/* TAB 1: VALORESPOLICY */}
        {activeTab === 'politica' && (
          <div className="space-y-6">
            <div className="flex md:flex-row flex-col justify-between items-start md:items-center border-b border-border-subtle pb-4 gap-4">
              <div>
                <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-[#B28900] dark:text-amber-500" />
                  <span>Política de Valores</span>
                </h3>
                <p className="text-[10px] text-text-secondary mt-0.5">
                  Matriz de referência e teto para contratação de freelancers por função, senioridade e modelo de remuneração.
                </p>
              </div>

              {/* Botão Nova Politica */}
              {hasWritePermission && (
                <button
                  onClick={openCreateModal}
                  className="bg-action-cyan hover:brightness-95 text-[var(--text-primary)] font-extrabold p-2 px-4 rounded-xl flex items-center gap-1.5 shadow-xs text-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Nova Política
                </button>
              )}
            </div>

            {/* Resumo Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 dark:bg-slate-50/40 p-4 rounded-xl border border-border-subtle shadow-xs">
                <span className="text-[10px] uppercase font-bold text-text-secondary">Funções Cadastradas</span>
                <div className="text-xl font-extrabold text-text-primary mt-1">{totalRoles}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-50/40 p-4 rounded-xl border border-border-subtle shadow-xs">
                <span className="text-[10px] uppercase font-bold text-text-secondary">Políticas Ativas</span>
                <div className="text-xl font-extrabold text-text-primary mt-1">{activeCount}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-50/40 p-4 rounded-xl border border-border-subtle shadow-xs">
                <span className="text-[10px] uppercase font-bold text-text-secondary">Políticas Incompletas</span>
                <div className="text-xl font-extrabold text-amber-600 dark:text-amber-500 mt-1 flex items-center gap-1.5">
                  <span>{incompleteCount}</span>
                  {incompleteCount > 0 && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-50/40 p-4 rounded-xl border border-border-subtle shadow-xs">
                <span className="text-[10px] uppercase font-bold text-text-secondary">Exceções Pendentes</span>
                <div className="text-xl font-extrabold text-status-error mt-1">{pendingExceptionsCount}</div>
              </div>
            </div>

            {/* Filtros */}
            <div className="bg-slate-50 dark:bg-slate-50/50 p-4 rounded-xl border border-border-subtle grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="font-bold text-text-secondary block mb-1">Buscar por Cargo</label>
                <input
                  type="text"
                  placeholder="Ex: Diretor, Produtor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white dark:bg-slate-50 focus:outline-none focus:border-action-cyan"
                />
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Senioridade</label>
                <select
                  value={filterSeniority}
                  onChange={(e) => setFilterSeniority(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white dark:bg-slate-50 focus:outline-none focus:border-action-cyan"
                >
                  <option value="todos">Todos os níveis</option>
                  <option value="Júnior">Júnior</option>
                  <option value="Pleno">Pleno</option>
                  <option value="Sênior">Sênior</option>
                  <option value="Especialista">Especialista</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white dark:bg-slate-50 focus:outline-none focus:border-action-cyan"
                >
                  <option value="todos">Todos os status</option>
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                  <option value="Incompleta">Incompleta</option>
                </select>
              </div>

              <div className="flex items-center pt-5 pl-2">
                <label className="flex items-center gap-2 font-bold text-text-secondary cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filterIncompleteOnly}
                    onChange={(e) => setFilterIncompleteOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 accent-action-cyan cursor-pointer"
                  />
                  <span>Apenas políticas incompletas</span>
                </label>
              </div>
            </div>

            {/* Sub-abas de Modelos */}
            <div className="flex border-b border-border-subtle gap-4 text-xs font-bold pt-2">
              <button
                onClick={() => setSubTab('matriz')}
                className={`pb-2 border-b-2 cursor-pointer transition-all ${subTab === 'matriz' ? 'border-action-cyan text-amber-600' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
              >
                Matriz Diária / Mensal
              </button>
              <button
                onClick={() => setSubTab('outros')}
                className={`pb-2 border-b-2 cursor-pointer transition-all ${subTab === 'outros' ? 'border-action-cyan text-amber-600' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
              >
                Outros Modelos (Hora / Job Fechado)
              </button>
            </div>

            {/* Matrix Card Header details */}
            <div className="pt-2">
              <h4 className="font-bold text-text-primary text-xs">
                {subTab === 'matriz' ? 'Matriz de Diária e Mensalidade por Função' : 'Tabela de Outros Modelos de Remuneração'}
              </h4>
              <p className="text-[10px] text-text-secondary mt-0.5">
                {subTab === 'matriz'
                  ? 'Cada linha consolida os valores de referência e teto para diária e mensal/salário.'
                  : 'Valores de referência e teto autorizados para contratações por hora ou pacotes fechados.'}
              </p>
            </div>

            {/* TABLE MATRIZ DIARIA / MENSAL */}
            {subTab === 'matriz' && (
              <div className="hidden sm:block overflow-x-auto border border-border-subtle rounded-xl bg-white dark:bg-white shadow-xs">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-50 font-bold text-text-secondary border-b border-border-subtle">
                    <tr>
                      <th className="px-6 py-3 cursor-pointer select-none" onClick={() => requestSort('role')}>
                        FUNÇÃO / CARGO {sortKey === 'role' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th className="px-6 py-3 cursor-pointer select-none" onClick={() => requestSort('seniority')}>
                        SENIORIDADE {sortKey === 'seniority' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th className="px-6 py-3 text-right cursor-pointer select-none" onClick={() => requestSort('dailyRef')}>
                        DIÁRIA REF. {sortKey === 'dailyRef' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th className="px-6 py-3 text-right cursor-pointer select-none" onClick={() => requestSort('dailyCeiling')}>
                        DIÁRIA TETO {sortKey === 'dailyCeiling' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th className="px-6 py-3 text-right cursor-pointer select-none" onClick={() => requestSort('monthlyRef')}>
                        MENSAL REF. {sortKey === 'monthlyRef' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th className="px-6 py-3 text-right cursor-pointer select-none" onClick={() => requestSort('monthlyCeiling')}>
                        MENSAL TETO {sortKey === 'monthlyCeiling' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th className="px-6 py-3 text-right cursor-pointer select-none" onClick={() => requestSort('successFeeMaxPercent')}>
                        SF MÁX. (%) {sortKey === 'successFeeMaxPercent' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th className="px-6 py-3">APROVAÇÃO EXIGIDA</th>
                      <th className="px-6 py-3 cursor-pointer select-none" onClick={() => requestSort('status')}>
                        STATUS {sortKey === 'status' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th className="px-6 py-3 cursor-pointer select-none" onClick={() => requestSort('updatedAt')}>
                        ÚLTIMA ATUALIZAÇÃO {sortKey === 'updatedAt' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      {hasWritePermission && <th className="px-6 py-3 text-right">AÇÕES</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle font-medium text-text-primary">
                    {sortedGroupedPolicies.length === 0 ? (
                      <tr>
                        <td colSpan={hasWritePermission ? 11 : 10} className="px-6 py-8 text-center text-text-secondary italic">
                          Nenhuma diretriz de política cadastrada com os filtros informados.
                        </td>
                      </tr>
                    ) : (
                      sortedGroupedPolicies.map((group) => {
                        const isAtivo = group.status === 'Ativo';
                        const isIncompleta = group.status === 'Incompleta';
                        
                        return (
                          <tr 
                            key={group.key} 
                            className={`hover:bg-slate-50 dark:hover:bg-slate-50/30 transition-colors 
                              ${!isAtivo && !isIncompleta ? 'opacity-65 bg-slate-50/50 dark:bg-white/40' : ''} 
                              ${isIncompleta ? 'border-l-4 border-amber-500 bg-amber-50/5 dark:bg-amber-50' : ''}`}
                          >
                            <td className="px-6 py-3.5 font-bold">{group.role}</td>
                            <td className="px-6 py-3.5 text-text-secondary font-semibold">{group.seniority}</td>
                            
                            {/* Diária */}
                            <td className="px-6 py-3.5 text-right font-semibold">
                              {group.isDailyDefined ? (
                                <span className="text-status-success dark:text-emerald-600 font-bold">
                                  {formatCurrencyBRL(group.dailyRef)}
                                </span>
                              ) : (
                                <span className="text-text-secondary italic text-[10px]">Não definido</span>
                              )}
                            </td>
                            <td className="px-6 py-3.5 text-right font-extrabold">
                              {group.isDailyDefined ? (
                                <span className="text-[#B28900] dark:text-amber-550 font-extrabold">
                                  {formatCurrencyBRL(group.dailyCeiling)}
                                </span>
                              ) : (
                                <span className="text-text-secondary italic text-[10px]">Não definido</span>
                              )}
                            </td>
 
                            {/* Mensal */}
                            <td className="px-6 py-3.5 text-right font-semibold">
                              {group.isMonthlyDefined ? (
                                <span className="text-status-success dark:text-emerald-600 font-bold">
                                  {formatCurrencyBRL(group.monthlyRef)}
                                </span>
                              ) : (
                                <span className="text-text-secondary italic text-[10px]">Não definido</span>
                              )}
                            </td>
                            <td className="px-6 py-3.5 text-right font-extrabold">
                              {group.isMonthlyDefined ? (
                                <span className="text-[#B28900] dark:text-amber-550 font-extrabold">
                                  {formatCurrencyBRL(group.monthlyCeiling)}
                                </span>
                              ) : (
                                <span className="text-text-secondary italic text-[10px]">Não definido</span>
                              )}
                            </td>
 
                            {/* SF Máx */}
                            <td className="px-6 py-3.5 text-right font-extrabold text-indigo-600 dark:text-indigo-400">
                              {group.successFeeMaxPercent !== undefined && group.successFeeMaxPercent !== null ? (
                                <span>{group.successFeeMaxPercent}%</span>
                              ) : (
                                <span className="text-text-secondary italic text-[10px]">Não definido</span>
                              )}
                            </td>

                            <td className="px-6 py-3.5 font-semibold text-text-secondary">
                              {group.isDailyDefined || group.isMonthlyDefined ? (
                                <div className="flex flex-col gap-0.5 text-[9px] font-bold">
                                  {group.isDailyDefined && (
                                    <StatusBadge variant="warning" className="text-[9px] px-1.5 py-0.5 rounded w-max">
                                      Diária &gt; {formatCurrencyBRL(group.dailyCeiling)}
                                    </StatusBadge>
                                  )}
                                  {group.isMonthlyDefined && (
                                    <StatusBadge variant="warning" className="text-[9px] px-1.5 py-0.5 rounded w-max mt-0.5">
                                      Mensal &gt; {formatCurrencyBRL(group.monthlyCeiling)}
                                    </StatusBadge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-text-secondary">—</span>
                              )}
                            </td>

                            <td className="px-6 py-3.5">
                              <StatusBadge variant={isAtivo ? 'success' : isIncompleta ? 'warning' : 'neutral'} className="text-[10px] py-0.5 rounded-full uppercase">
                                {group.status}
                              </StatusBadge>
                            </td>
                            <td className="px-6 py-3.5 text-text-secondary text-[11px] font-semibold">{group.updatedAt}</td>
                            
                            {hasWritePermission && (
                              <td className="px-6 py-3.5 text-right font-semibold">
                                <div className="flex justify-end gap-1.5">
                                  {isIncompleta && (
                                    <button
                                      onClick={() => openEditModal(group)}
                                      className="btn-gov btn-gov-reset text-[10px]"
                                      title="Completar Política"
                                    >
                                      Completar política
                                    </button>
                                  )}
                                  <button
                                    onClick={() => openEditModal(group)}
                                    className="btn-gov btn-gov-edit text-[10px]"
                                    title="Editar Parâmetros"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => openDuplicateModal(group)}
                                    className="btn-gov btn-gov-details text-[10px]"
                                    title="Duplicar Política"
                                  >
                                    Duplicar
                                  </button>
                                  <button
                                    onClick={() => handleToggleStatus(group)}
                                    className={`btn-gov text-[10px] ${isAtivo || isIncompleta ? 'btn-gov-inactive' : 'btn-gov-active'}`}
                                    title={isAtivo || isIncompleta ? 'Inativar Política' : 'Reativar Política'}
                                  >
                                    {isAtivo || isIncompleta ? 'Inativar' : 'Reativar'}
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
            )}

            {/* TABLE OUTROS MODELOS */}
            {subTab === 'outros' && (
              <div className="hidden sm:block overflow-x-auto border border-border-subtle rounded-xl bg-white dark:bg-white shadow-xs">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-50 font-bold text-text-secondary border-b border-border-subtle">
                    <tr>
                      <th className="px-6 py-3 cursor-pointer select-none" onClick={() => requestSort('role')}>
                        FUNÇÃO / CARGO {sortKey === 'role' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th className="px-6 py-3 cursor-pointer select-none" onClick={() => requestSort('seniority')}>
                        SENIORIDADE {sortKey === 'seniority' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th className="px-6 py-3 text-right cursor-pointer select-none" onClick={() => requestSort('hourlyRef')}>
                        HORA REF. {sortKey === 'hourlyRef' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th className="px-6 py-3 text-right cursor-pointer select-none" onClick={() => requestSort('hourlyCeiling')}>
                        HORA TETO {sortKey === 'hourlyCeiling' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th className="px-6 py-3 text-right cursor-pointer select-none" onClick={() => requestSort('fixedRef')}>
                        JOB FECHADO REF. {sortKey === 'fixedRef' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th className="px-6 py-3 text-right cursor-pointer select-none" onClick={() => requestSort('fixedCeiling')}>
                        JOB FECHADO TETO {sortKey === 'fixedCeiling' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th className="px-6 py-3 text-right cursor-pointer select-none" onClick={() => requestSort('successFeeMaxPercent')}>
                        SF MÁX. (%) {sortKey === 'successFeeMaxPercent' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th className="px-6 py-3">APROVAÇÃO EXIGIDA</th>
                      <th className="px-6 py-3 cursor-pointer select-none" onClick={() => requestSort('status')}>
                        STATUS {sortKey === 'status' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      <th className="px-6 py-3 cursor-pointer select-none" onClick={() => requestSort('updatedAt')}>
                        ÚLTIMA ATUALIZAÇÃO {sortKey === 'updatedAt' && (sortDirection === 'asc' ? ' ▲' : ' ▼')}
                      </th>
                      {hasWritePermission && <th className="px-6 py-3 text-right">AÇÕES</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle font-medium text-text-primary">
                    {sortedGroupedPolicies.length === 0 ? (
                      <tr>
                        <td colSpan={hasWritePermission ? 11 : 10} className="px-6 py-8 text-center text-text-secondary italic">
                          Nenhuma diretriz de política cadastrada com os filtros informados.
                        </td>
                      </tr>
                    ) : (
                      sortedGroupedPolicies.map((group) => {
                        const isAtivo = group.hourlyStatus === 'Ativo' || group.fixedStatus === 'Ativo';
                        
                        return (
                          <tr 
                            key={group.key} 
                            className={`hover:bg-slate-50 dark:hover:bg-slate-50/30 transition-colors 
                              ${!isAtivo ? 'opacity-65 bg-slate-50/50 dark:bg-white/40' : ''}`}
                          >
                            <td className="px-6 py-3.5 font-bold">{group.role}</td>
                            <td className="px-6 py-3.5 text-text-secondary font-semibold">{group.seniority}</td>
                            
                            {/* Hora */}
                            <td className="px-6 py-3.5 text-right font-semibold">
                              {group.isHourlyDefined ? (
                                <span className="text-status-success dark:text-emerald-600 font-bold">
                                  {formatCurrencyBRL(group.hourlyRef)}
                                </span>
                              ) : (
                                <span className="text-text-secondary italic text-[10px]">Não definido</span>
                              )}
                            </td>
                            <td className="px-6 py-3.5 text-right font-extrabold">
                              {group.isHourlyDefined ? (
                                <span className="text-[#B28900] dark:text-amber-550 font-extrabold">
                                  {formatCurrencyBRL(group.hourlyCeiling)}
                                </span>
                              ) : (
                                <span className="text-text-secondary italic text-[10px]">Não definido</span>
                              )}
                            </td>
 
                            {/* Job Fechado */}
                            <td className="px-6 py-3.5 text-right font-semibold">
                              {group.isFixedDefined ? (
                                <span className="text-status-success dark:text-emerald-600 font-bold">
                                  {formatCurrencyBRL(group.fixedRef)}
                                </span>
                              ) : (
                                <span className="text-text-secondary italic text-[10px]">Não definido</span>
                              )}
                            </td>
                            <td className="px-6 py-3.5 text-right font-extrabold">
                              {group.isFixedDefined ? (
                                <span className="text-[#B28900] dark:text-amber-550 font-extrabold">
                                  {formatCurrencyBRL(group.fixedCeiling)}
                                </span>
                              ) : (
                                <span className="text-text-secondary italic text-[10px]">Não definido</span>
                              )}
                            </td>

                            {/* SF Máx */}
                            <td className="px-6 py-3.5 text-right font-extrabold text-indigo-600 dark:text-indigo-400">
                              {group.successFeeMaxPercent !== undefined && group.successFeeMaxPercent !== null ? (
                                <span>{group.successFeeMaxPercent}%</span>
                              ) : (
                                <span className="text-text-secondary italic text-[10px]">Não definido</span>
                              )}
                            </td>
                            
                            <td className="px-6 py-3.5 font-semibold text-text-secondary">
                              {group.isHourlyDefined || group.isFixedDefined ? (
                                <div className="flex flex-col gap-0.5 text-[9px] font-bold">
                                  {group.isHourlyDefined && (
                                    <StatusBadge variant="warning" className="text-[9px] px-1.5 py-0.5 rounded w-max">
                                      Hora &gt; {formatCurrencyBRL(group.hourlyCeiling)}
                                    </StatusBadge>
                                  )}
                                  {group.isFixedDefined && (
                                    <StatusBadge variant="warning" className="text-[9px] px-1.5 py-0.5 rounded w-max mt-0.5">
                                      Job &gt; {formatCurrencyBRL(group.fixedCeiling)}
                                    </StatusBadge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-text-secondary">—</span>
                              )}
                            </td>

                            <td className="px-6 py-3.5">
                              <StatusBadge variant={isAtivo ? 'success' : 'neutral'} className="text-[10px] py-0.5 rounded-full uppercase">
                                {isAtivo ? 'Ativo' : 'Inativo'}
                              </StatusBadge>
                            </td>
                            <td className="px-6 py-3.5 text-text-secondary text-[11px] font-semibold">{group.updatedAt}</td>
                            
                            {hasWritePermission && (
                              <td className="px-6 py-3.5 text-right font-semibold">
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => openEditModal(group)}
                                    className="btn-gov btn-gov-edit text-[10px]"
                                    title="Editar Parâmetros"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => openDuplicateModal(group)}
                                    className="btn-gov btn-gov-details text-[10px]"
                                    title="Duplicar Política"
                                  >
                                    Duplicar
                                  </button>
                                  <button
                                    onClick={() => handleToggleStatus(group)}
                                    className={`btn-gov text-[10px] ${isAtivo ? 'btn-gov-inactive' : 'btn-gov-active'}`}
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
            )}

            {/* MOBILE CARDS VIEW */}
            <div className="block sm:hidden space-y-4 pt-2">
              {sortedGroupedPolicies.length === 0 ? (
                <div className="p-8 text-center text-text-secondary italic bg-white dark:bg-white border border-border-subtle rounded-xl">
                  Nenhuma diretriz de política cadastrada com os filtros informados.
                </div>
              ) : (
                sortedGroupedPolicies.map(group => {
                  const isAtivo = group.status === 'Ativo';
                  const isIncompleta = group.status === 'Incompleta';
                  
                  return (
                    <div 
                      key={group.key} 
                      className={`p-4 bg-white dark:bg-white border rounded-2xl space-y-3 relative shadow-xs
                        ${isIncompleta ? 'border-amber-400 border-l-4' : 'border-border-subtle'}
                        ${!isAtivo && !isIncompleta ? 'opacity-65' : ''}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-text-primary text-xs">{group.role}</h4>
                          <span className="text-[10px] text-text-secondary font-semibold">{group.seniority}</span>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border 
                          ${isAtivo ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-50 dark:text-emerald-600 dark:border-emerald-900' : 
                            isIncompleta ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-50 dark:text-amber-600 dark:border-amber-900' :
                            'bg-slate-100 text-slate-650 border-slate-200 dark:bg-slate-50 dark:text-[var(--text-disabled)] dark:border-slate-200'}`}>
                          {group.status}
                        </span>
                      </div>

                      {subTab === 'matriz' ? (
                        <div className="grid grid-cols-2 gap-3 text-[10px] pt-1 border-t border-border-subtle">
                          <div>
                            <strong className="text-text-secondary block font-bold">DIÁRIA</strong>
                            {group.isDailyDefined ? (
                              <div className="mt-0.5 text-text-primary">
                                Ref: <span className="font-bold text-status-success dark:text-emerald-600">{formatCurrencyBRL(group.dailyRef)}</span>
                                <br />
                                Teto: <span className="font-bold text-[#B28900] dark:text-amber-500">{formatCurrencyBRL(group.dailyCeiling)}</span>
                              </div>
                            ) : (
                              <span className="text-text-secondary italic">Não definido</span>
                            )}
                          </div>

                          <div>
                            <strong className="text-text-secondary block font-bold">MENSALIDADE</strong>
                            {group.isMonthlyDefined ? (
                              <div className="mt-0.5 text-text-primary">
                                Ref: <span className="font-bold text-status-success dark:text-emerald-600">{formatCurrencyBRL(group.monthlyRef)}</span>
                                <br />
                                Teto: <span className="font-bold text-[#B28900] dark:text-amber-550">{formatCurrencyBRL(group.monthlyCeiling)}</span>
                              </div>
                            ) : (
                              <span className="text-text-secondary italic">Não definido</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 text-[10px] pt-1 border-t border-border-subtle">
                          <div>
                            <strong className="text-text-secondary block font-bold">HORA</strong>
                            {group.isHourlyDefined ? (
                              <div className="mt-0.5 text-text-primary">
                                Ref: <span className="font-bold text-status-success dark:text-emerald-600">{formatCurrencyBRL(group.hourlyRef)}</span>
                                <br />
                                Teto: <span className="font-bold text-[#B28900] dark:text-amber-550">{formatCurrencyBRL(group.hourlyCeiling)}</span>
                              </div>
                            ) : (
                              <span className="text-text-secondary italic">Não definido</span>
                            )}
                          </div>

                          <div>
                            <strong className="text-text-secondary block font-bold">JOB FECHADO</strong>
                            {group.isFixedDefined ? (
                              <div className="mt-0.5 text-text-primary">
                                Ref: <span className="font-bold text-status-success dark:text-emerald-600">{formatCurrencyBRL(group.fixedRef)}</span>
                                <br />
                                Teto: <span className="font-bold text-[#B28900] dark:text-amber-550">{formatCurrencyBRL(group.fixedCeiling)}</span>
                              </div>
                            ) : (
                              <span className="text-text-secondary italic">Não definido</span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-[10px] text-text-secondary pt-2 border-t border-border-subtle">
                        <span>Att: {group.updatedAt}</span>
                        {hasWritePermission && (
                          <div className="flex gap-2">
                            {isIncompleta && (
                              <button
                                onClick={() => openEditModal(group)}
                                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-2 py-1 rounded text-[9px] cursor-pointer"
                              >
                                Completar
                              </button>
                            )}
                            <button
                              onClick={() => openEditModal(group)}
                              className="text-blue-700 dark:text-blue-700 font-bold px-2 py-1 border border-blue-200 dark:border-blue-900 rounded text-[9px] cursor-pointer"
                            >
                              Editar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
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
                  const policy = db.policies.find((p: any) => 
                    p.role === job?.roleNeeded && 
                    p.seniority === job?.seniorityNeeded && 
                    p.billingType === neg.billingType
                  );
                  const ceiling = policy ? policy.ceilingValue : 0;
                  const delta = neg.negotiatedValue - ceiling;

                  return (
                    <div key={neg.id} className="p-4 border border-border-subtle rounded-xl bg-surface dark:bg-slate-50/15 space-y-3 text-xs">
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
                              className="bg-status-success text-[var(--text-primary)] font-bold p-1 px-3 rounded-lg flex items-center gap-1 hover:brightness-95 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" /> Aprovar Exceção
                            </button>
                            <button
                              onClick={() => handleDecision(neg.id, false)}
                              className="bg-status-error text-[var(--text-primary)] font-bold p-1 px-3 rounded-lg flex items-center gap-1 hover:brightness-95 cursor-pointer"
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
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-white dark:bg-slate-50 border border-border-subtle rounded-lg text-[11px]">
                        <div>
                          <span className="text-text-secondary block">Cargo de Referência</span>
                          <span className="font-semibold text-text-primary">{job?.roleNeeded} ({job?.seniorityNeeded})</span>
                        </div>
                        <div>
                          <span className="text-text-secondary block">Teto Governança</span>
                          <span className="font-semibold text-text-primary">{formatCurrencyBRL(ceiling)} / {neg.billingType.toLowerCase()}</span>
                        </div>
                        <div>
                          <span className="text-text-secondary block font-bold text-status-error">Tarifa Requerida</span>
                          <span className="font-bold text-status-error">{formatCurrencyBRL(neg.negotiatedValue)}</span>
                        </div>
                        <div>
                          <span className="text-text-secondary block">Desvio Financeiro GAP</span>
                          <span className="font-bold text-status-error">+{ceiling > 0 ? Math.round((delta / ceiling) * 100) : 0}% (+{formatCurrencyBRL(delta)})</span>
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
              <div className="border border-border-subtle p-4 rounded-xl bg-surface dark:bg-slate-50/20 space-y-2">
                <h4 className="font-bold text-xs text-text-primary flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-status-success"></span> Bebidas / Alimentos (FMCG)
                </h4>
                <p className="text-[11px] text-text-secondary leading-relaxed">Foco em ativações em bares, camarotes de carnaval, mega festivals de música e stands imersivos de degustação sensorial.</p>
              </div>

              {/* Technologies */}
              <div className="border border-border-subtle p-4 rounded-xl bg-surface dark:bg-slate-50/20 space-y-2">
                <h4 className="font-bold text-xs text-text-primary flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-action-cyan"></span> Tecnologia & Games
                </h4>
                <p className="text-[11px] text-text-secondary leading-relaxed">Palcos corporativos complexos, stands da CCXP, hotsites virais integrados à geolocalização e projeções mapeadas interativas.</p>
              </div>

              {/* Automotive */}
              <div className="border border-border-subtle p-4 rounded-xl bg-surface dark:bg-slate-50/20 space-y-2">
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
        <div className="fixed inset-0 bg-white/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-xs">
          <div className="bg-white dark:bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-up">
            <div className="p-5 bg-white text-[var(--text-primary)] flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-600" />
                <span>
                  {policyModalMode === 'create' && 'Criar Nova Diretriz de Política'}
                  {policyModalMode === 'edit' && 'Editar Diretriz de Política'}
                  {policyModalMode === 'duplicate' && 'Duplicar Diretriz de Política'}
                </span>
              </h3>
              <button 
                onClick={() => setIsPolicyModalOpen(false)}
                className="text-[var(--text-primary)] hover:text-amber-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePolicyFormSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-text-secondary block mb-1">Função / Cargo *</label>
                  <select 
                    value={formRole} 
                    onChange={e => setFormRole(e.target.value)} 
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white dark:bg-slate-50 focus:outline-none focus:border-action-cyan text-[11px] font-semibold"
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

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Nível / Senioridade *</label>
                  <select 
                    value={formSeniority} 
                    onChange={e => setFormSeniority(e.target.value as any)} 
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white dark:bg-slate-50 focus:outline-none focus:border-action-cyan text-[11px] font-semibold"
                    required
                  >
                    <option value="Júnior">Júnior</option>
                    <option value="Pleno">Pleno</option>
                    <option value="Sênior">Sênior</option>
                    <option value="Especialista">Especialista</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Status da Regra *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 font-semibold cursor-pointer text-text-primary">
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

              {/* Seção 1: Diária & Mensalidade */}
              <div className="border-t border-border-subtle pt-4 space-y-4">
                <h4 className="font-bold text-text-primary text-xs uppercase tracking-wider text-amber-600">Diária e Mensalidade</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-50/40 p-3.5 rounded-xl border border-border-subtle space-y-2">
                    <span className="font-bold text-text-primary block text-[11px]">DIÁRIA</span>
                    <div>
                      <label className="text-[10px] text-text-secondary font-bold block mb-0.5">Referência (R$)</label>
                      <input 
                        type="number" 
                        value={formDailyRef} 
                        onChange={e => setFormDailyRef(e.target.value === '' ? '' : Number(e.target.value))} 
                        placeholder="Ex: 500"
                        className="w-full border border-border-subtle p-1.5 rounded-lg text-text-primary bg-white dark:bg-slate-50 focus:outline-none focus:border-action-cyan text-[11px] font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-secondary font-bold block mb-0.5">Teto Máximo (R$)</label>
                      <input 
                        type="number" 
                        value={formDailyCeiling} 
                        onChange={e => setFormDailyCeiling(e.target.value === '' ? '' : Number(e.target.value))} 
                        placeholder="Ex: 700"
                        className="w-full border border-border-subtle p-1.5 rounded-lg text-text-primary bg-white dark:bg-slate-50 focus:outline-none focus:border-action-cyan text-[11px] font-semibold"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-50/40 p-3.5 rounded-xl border border-border-subtle space-y-2">
                    <span className="font-bold text-text-primary block text-[11px]">MENSAL / SALÁRIO</span>
                    <div>
                      <label className="text-[10px] text-text-secondary font-bold block mb-0.5">Referência (R$)</label>
                      <input 
                        type="number" 
                        value={formMonthlyRef} 
                        onChange={e => setFormMonthlyRef(e.target.value === '' ? '' : Number(e.target.value))} 
                        placeholder="Ex: 5000"
                        className="w-full border border-border-subtle p-1.5 rounded-lg text-text-primary bg-white dark:bg-slate-50 focus:outline-none focus:border-action-cyan text-[11px] font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-secondary font-bold block mb-0.5">Teto Máximo (R$)</label>
                      <input 
                        type="number" 
                        value={formMonthlyCeiling} 
                        onChange={e => setFormMonthlyCeiling(e.target.value === '' ? '' : Number(e.target.value))} 
                        placeholder="Ex: 7000"
                        className="w-full border border-border-subtle p-1.5 rounded-lg text-text-primary bg-white dark:bg-slate-50 focus:outline-none focus:border-action-cyan text-[11px] font-semibold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 2: Outros Modelos */}
              <div className="border-t border-border-subtle pt-4 space-y-4">
                <h4 className="font-bold text-text-primary text-xs uppercase tracking-wider text-amber-600">Outros Modelos de Remuneração</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-50/40 p-3.5 rounded-xl border border-border-subtle space-y-2">
                    <span className="font-bold text-text-primary block text-[11px]">HORA</span>
                    <div>
                      <label className="text-[10px] text-text-secondary font-bold block mb-0.5">Referência (R$)</label>
                      <input 
                        type="number" 
                        value={formHourlyRef} 
                        onChange={e => setFormHourlyRef(e.target.value === '' ? '' : Number(e.target.value))} 
                        placeholder="Ex: 80"
                        className="w-full border border-border-subtle p-1.5 rounded-lg text-text-primary bg-white dark:bg-slate-50 focus:outline-none focus:border-action-cyan text-[11px] font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-secondary font-bold block mb-0.5">Teto Máximo (R$)</label>
                      <input 
                        type="number" 
                        value={formHourlyCeiling} 
                        onChange={e => setFormHourlyCeiling(e.target.value === '' ? '' : Number(e.target.value))} 
                        placeholder="Ex: 120"
                        className="w-full border border-border-subtle p-1.5 rounded-lg text-text-primary bg-white dark:bg-slate-50 focus:outline-none focus:border-action-cyan text-[11px] font-semibold"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-50/40 p-3.5 rounded-xl border border-border-subtle space-y-2">
                    <span className="font-bold text-text-primary block text-[11px]">JOB FECHADO</span>
                    <div>
                      <label className="text-[10px] text-text-secondary font-bold block mb-0.5">Referência (R$)</label>
                      <input 
                        type="number" 
                        value={formFixedRef} 
                        onChange={e => setFormFixedRef(e.target.value === '' ? '' : Number(e.target.value))} 
                        placeholder="Ex: 3000"
                        className="w-full border border-border-subtle p-1.5 rounded-lg text-text-primary bg-white dark:bg-slate-50 focus:outline-none focus:border-action-cyan text-[11px] font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-secondary font-bold block mb-0.5">Teto Máximo (R$)</label>
                      <input 
                        type="number" 
                        value={formFixedCeiling} 
                        onChange={e => setFormFixedCeiling(e.target.value === '' ? '' : Number(e.target.value))} 
                        placeholder="Ex: 5000"
                        className="w-full border border-border-subtle p-1.5 rounded-lg text-text-primary bg-white dark:bg-slate-50 focus:outline-none focus:border-action-cyan text-[11px] font-semibold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 3: Success Fee */}
              <div className="border-t border-border-subtle pt-4 space-y-4">
                <h4 className="font-bold text-text-primary text-xs uppercase tracking-wider text-amber-600">Bônus por Performance (Success Fee)</h4>
                <div className="bg-slate-50 dark:bg-slate-50/40 p-3.5 rounded-xl border border-border-subtle space-y-2 max-w-xs">
                  <span className="font-bold text-text-primary block text-[11px]">PERCENTUAL MÁXIMO</span>
                  <div>
                    <label className="text-[10px] text-text-secondary font-bold block mb-0.5">Teto Autorizado (%)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        step="0.1"
                        min="0"
                        max="100"
                        value={formSuccessFeeMaxPercent} 
                        onChange={e => setFormSuccessFeeMaxPercent(e.target.value === '' ? '' : Number(e.target.value))} 
                        placeholder="Ex: 15"
                        className="w-full border border-border-subtle p-1.5 pr-7 rounded-lg text-text-primary bg-white dark:bg-slate-50 focus:outline-none focus:border-action-cyan text-[11px] font-semibold"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-text-secondary select-none">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="font-bold text-text-secondary block mb-1">Observações Internas</label>
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Justificativa técnica da política ou data de vigência acordada..."
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary bg-white dark:bg-slate-50 focus:outline-none focus:border-action-cyan h-20"
                />
              </div>

              <div className="pt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsPolicyModalOpen(false)}
                  className="bg-slate-150 hover:bg-slate-200 text-slate-700 font-bold p-2.5 px-4 rounded-xl transition cursor-pointer dark:bg-slate-50 dark:text-slate-600 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-action-cyan hover:brightness-95 text-[var(--text-primary)] font-extrabold p-2.5 px-6 rounded-xl transition cursor-pointer"
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
