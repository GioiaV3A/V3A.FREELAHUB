'use client';

import React, { useState, useEffect } from 'react';
import { DatabaseProps } from '@/app/page';
import { 
  Search, 
  Eye, 
  ShieldAlert, 
  Check, 
  Plus, 
  AlertCircle, 
  Sparkles, 
  FilterX, 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  UserPlus, 
  Edit2, 
  X, 
  Save,
  Upload,
  Link,
  Linkedin,
  Instagram
} from 'lucide-react';
import ScoreStars from '@/components/ScoreStars';
import { maskCurrencyBRL, parseCurrencyBR } from '@/lib/financial';
import { supabase } from '@/lib/supabase';
import { countries } from '@/lib/countries';
import CnpjInput from './CnpjInput';
import { validateCnpj, formatCnpj } from '@/lib/cnpj';

export default function BancoFreelas({ db }: { db: any }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedSeniority, setSelectedSeniority] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedAvailability, setSelectedAvailability] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedWorkedV3a, setSelectedWorkedV3a] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [minScore, setMinScore] = useState(0);

  // Sorting state
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Loading skeleton state
  const [isLoading, setIsLoading] = useState(true);

  // Edit Freelancer Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFreelancer, setEditingFreelancer] = useState<any | null>(null);

  // Edit Form Fields
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editSeniority, setEditSeniority] = useState<'Júnior' | 'Pleno' | 'Sênior' | 'Especialista'>('Pleno');
  const [editStatus, setEditStatus] = useState<'Elegível' | 'Em análise' | 'Em onboarding' | 'Em observação' | 'Bloqueado' | 'Inativo'>('Elegível');
  const [editAvailability, setEditAvailability] = useState<'Imediata' | '15 dias' | '30+ dias' | 'Indisponível'>('Imediata');
  const [editReferenceValue, setEditReferenceValue] = useState(0);
  const [editReferenceValueVisual, setEditReferenceValueVisual] = useState('');
  const [editObservations, setEditObservations] = useState('');
  const [editLocationText, setEditLocationText] = useState('');
  const [editBrandsWorked, setEditBrandsWorked] = useState('');
  const [editHasWorkedWithV3a, setEditHasWorkedWithV3a] = useState('Nunca');
  const [editPortfolioUrl, setEditPortfolioUrl] = useState('');
  const [editLinkedinUrl, setEditLinkedinUrl] = useState('');
  const [editInstagramUrl, setEditInstagramUrl] = useState('');
  const [editPortfolioFileUrl, setEditPortfolioFileUrl] = useState('');
  const [editPortfolioFilePath, setEditPortfolioFilePath] = useState('');
  const [editPortfolioFileName, setEditPortfolioFileName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [editCountryCode, setEditCountryCode] = useState('BR');
  const [editCnpjNormalized, setEditCnpjNormalized] = useState('');
  const [editForeignTaxId, setEditForeignTaxId] = useState('');
  const [editCnpjIsMock, setEditCnpjIsMock] = useState(false);
  const [editCnpjSource, setEditCnpjSource] = useState('');


  // Trigger loading skeleton simulation on mount / data loads
  useEffect(() => {
    if (db.freelancers && db.freelancers.length > 0) {
      const timer = setTimeout(() => setIsLoading(false), 450);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => setIsLoading(false), 900);
      return () => clearTimeout(timer);
    }
  }, [db.freelancers]);

  // Derive filter option sets dynamically
  const roles = Array.from(new Set(db.freelancers.map((f: any) => f.mainRole).filter(Boolean))) as string[];
  const seniorities = ['Júnior', 'Pleno', 'Sênior', 'Especialista'];
  const statuses = ['Elegível', 'Em análise', 'Em onboarding', 'Em observação', 'Bloqueado', 'Inativo'];
  const availabilities = ['Imediata', '15 dias', '30+ dias', 'Indisponível'];
  const locations = Array.from(new Set(db.freelancers.map((f: any) => f.locationText).filter(Boolean))) as string[];
  const workedWithV3aOptions = Array.from(new Set(db.freelancers.map((f: any) => f.hasWorkedWithV3a).filter(Boolean))) as string[];
  const industries = Array.from(new Set(db.freelancers.flatMap((f: any) => f.industries).filter(Boolean))) as string[];

  // Filter freelancers array
  const filteredFreelancers = db.freelancers.filter((f: any) => {
    const term = searchTerm.toLowerCase().trim();
    const cleanSearch = term.replace(/[^A-Za-z0-9]/g, '');
    const matchesSearch = !term ? true : (
      f.name.toLowerCase().includes(term) ||
      f.email.toLowerCase().includes(term) ||
      f.whatsapp.toLowerCase().includes(term) ||
      f.mainRole.toLowerCase().includes(term) ||
      f.seniority.toLowerCase().includes(term) ||
      f.city.toLowerCase().includes(term) ||
      f.state.toLowerCase().includes(term) ||
      (f.locationText && f.locationText.toLowerCase().includes(term)) ||
      (f.brandsWorked && f.brandsWorked.toLowerCase().includes(term)) ||
      f.industries.some((i: string) => i.toLowerCase().includes(term)) ||
      (f.hasWorkedWithV3a && f.hasWorkedWithV3a.toLowerCase().includes(term)) ||
      (f.cnpj_normalized && f.cnpj_normalized.includes(cleanSearch)) ||
      (f.foreign_tax_id && f.foreign_tax_id.toLowerCase().includes(term))
    );
    
    const matchesRole = selectedRole ? f.mainRole === selectedRole : true;
    const matchesSeniority = selectedSeniority ? f.seniority === selectedSeniority : true;
    const matchesStatus = selectedStatus ? f.status === selectedStatus : true;
    const matchesAvailability = selectedAvailability ? f.availability === selectedAvailability : true;
    const matchesLocation = selectedLocation ? f.locationText === selectedLocation : true;
    const matchesWorkedV3a = selectedWorkedV3a ? f.hasWorkedWithV3a === selectedWorkedV3a : true;
    const matchesIndustry = selectedIndustry ? f.industries.includes(selectedIndustry) : true;
    const matchesScore = f.averageScore >= minScore;

    return matchesSearch && matchesRole && matchesSeniority && matchesStatus && 
           matchesAvailability && matchesLocation && matchesWorkedV3a && 
           matchesIndustry && matchesScore;
  });

  // Sort freelancers
  const sortedFreelancers = [...filteredFreelancers].sort((a, b) => {
    let aVal: any = '';
    let bVal: any = '';

    if (sortBy === 'name') {
      aVal = a.name;
      bVal = b.name;
    } else if (sortBy === 'role') {
      aVal = a.mainRole;
      bVal = b.mainRole;
    } else if (sortBy === 'seniority') {
      const weights: Record<string, number> = { 'Júnior': 1, 'Pleno': 2, 'Sênior': 3, 'Especialista': 4 };
      aVal = weights[a.seniority] || 0;
      bVal = weights[b.seniority] || 0;
    } else if (sortBy === 'score') {
      aVal = a.averageScore || 0;
      bVal = b.averageScore || 0;
    } else if (sortBy === 'status') {
      aVal = a.status;
      bVal = b.status;
    } else if (sortBy === 'location') {
      aVal = a.locationText || '';
      bVal = b.locationText || '';
    } else if (sortBy === 'availability') {
      const weights: Record<string, number> = { 'Imediata': 1, '15 dias': 2, '30+ dias': 3, 'Indisponível': 4 };
      aVal = weights[a.availability] || 0;
      bVal = weights[b.availability] || 0;
    } else if (sortBy === 'experience') {
      aVal = a.experienceWithV3A ? 1 : 0;
      bVal = b.experienceWithV3A ? 1 : 0;
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginated freelancers
  const totalItems = sortedFreelancers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  // Correct page if filters reduce size
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedFreelancers = sortedFreelancers.slice(startIndex, startIndex + pageSize);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const handleToggleBlock = (id: string, currentStatus: string) => {
    if (db.currentUser.profile === 'NÚCLEO') {
      alert('Erro: Apenas perfis de RH ou MASTER possuem governança para alterar bloqueios cadastrais.');
      return;
    }

    const newStatus = currentStatus === 'Bloqueado' ? 'Elegível' : 'Bloqueado';
    const reason = newStatus === 'Bloqueado' ? prompt('Qual a justificativa de compliance para o bloqueio deste profissional?') : '';

    if (newStatus === 'Bloqueado' && !reason) {
      alert('Operação cancelada. A justificativa de bloqueio é obrigatória por termos de governança.');
      return;
    }

    db.setFreelancers((prev: any[]) => prev.map(f => {
      if (f.id === id) {
        return {
          ...f,
          status: newStatus as any,
          observations: newStatus === 'Bloqueado' 
            ? `🚨 BLOQUEADO EM COMPLIANCE: ${reason}.` 
            : `Desbloqueado para reintegração comum.`,
          availability: newStatus === 'Bloqueado' ? 'Indisponível' : f.availability
        };
      }
      return f;
    }));

    alert(`Freelancer atualizado! Status alterado para ${newStatus}.`);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedRole('');
    setSelectedSeniority('');
    setSelectedStatus('');
    setSelectedAvailability('');
    setSelectedLocation('');
    setSelectedWorkedV3a('');
    setSelectedIndustry('');
    setMinScore(0);
    setCurrentPage(1);
  };

  // Add to active job shortlist direct
  const handleAddToShortlistDirect = (f: any) => {
    if (!db.selectedJobId) {
      alert('Selecione um job ativo na aba Shortlist & Negociação antes de adicionar candidatos.');
      return;
    }
    const activeJob = db.jobs.find((j: any) => j.id === db.selectedJobId);
    if (!activeJob) {
      alert('Job selecionado inválido ou não encontrado.');
      return;
    }

    if (f.status === 'Bloqueado') {
      alert(`⚠️ Veto de Compliance: O freelancer "${f.name}" está com bloqueio ativo e não pode ser adicionado à shortlist.`);
      return;
    }

    const alreadyShortlisted = db.shortlists.some((sl: any) => sl.jobId === db.selectedJobId && sl.freelancerId === f.id);
    if (alreadyShortlisted) {
      alert('Este freelancer já está na shortlist deste job.');
      return;
    }

    const newSl = {
      id: `short-${Date.now()}`,
      jobId: db.selectedJobId,
      freelancerId: f.id,
      candidateStatus: 'Selecionado' as const
    };

    db.setShortlists((prev: any) => [...prev, newSl]);
    
    // Update Job status
    db.setJobs((prev: any) => prev.map((j: any) => j.id === db.selectedJobId ? { ...j, status: 'Em shortlist' } : j));
    alert(`${f.name} adicionado à shortlist do job "${activeJob.name}" com sucesso!`);
  };

  // Open edit modal
  const openEditModal = (f: any) => {
    setEditingFreelancer(f);
    setEditName(f.name);
    setEditEmail(f.email || '');
    setEditWhatsapp(f.whatsapp || '');
    setEditCity(f.city || '');
    setEditState(f.state || '');
    setEditRole(f.mainRole || '');
    setEditSeniority(f.seniority || 'Pleno');
    setEditStatus(f.status || 'Elegível');
    setEditAvailability(f.availability || 'Imediata');
    setEditReferenceValue(f.referenceValue || 0);
    setEditReferenceValueVisual(f.referenceValue ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(f.referenceValue) : '');
    setEditObservations(f.observations || '');
    setEditLocationText(f.locationText || '');
    setEditBrandsWorked(f.brandsWorked || '');
    setEditHasWorkedWithV3a(f.hasWorkedWithV3a || 'Nunca');
    setEditPortfolioUrl(f.portfolioUrl || '');
    setEditLinkedinUrl(f.linkedinUrl || '');
    setEditInstagramUrl(f.instagramUrl || '');
    setEditPortfolioFileUrl(f.portfolioFileUrl || '');
    setEditPortfolioFilePath(f.portfolioFilePath || '');
    setEditPortfolioFileName(f.portfolioFileName || '');
    setEditCountryCode(f.tax_country_code || 'BR');
    setEditCnpjNormalized(f.cnpj_normalized || '');
    setEditForeignTaxId(f.foreign_tax_id || '');
    setEditCnpjIsMock(f.cnpj_is_mock || false);
    setEditCnpjSource(f.cnpj_source || '');
    setIsEditModalOpen(true);
  };

  // Save edit form
  const handleEditFreelancerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFreelancer) return;

    if (!editName || !editEmail || !editWhatsapp || !editCity || !editState) {
      alert('Por favor, preencha os campos obrigatórios (Nome, E-mail, Celular, Cidade e Estado).');
      return;
    }

    if (editCountryCode === 'BR') {
      const cnpjVal = validateCnpj(editCnpjNormalized);
      if (!cnpjVal.valid) {
        alert(cnpjVal.errorMessage || 'CNPJ inválido.');
        return;
      }
    } else {
      if (!editForeignTaxId.trim()) {
        alert('Identificador Fiscal Estrangeiro é obrigatório para residentes fora do Brasil.');
        return;
      }
    }

    setIsSaving(true);
    try {
      // Check CNPJ duplicate
      if (editCountryCode === 'BR') {
        const { data: dupCnpj } = await supabase
          .from('freelancers')
          .select('id, full_name')
          .eq('cnpj_normalized', editCnpjNormalized)
          .neq('id', editingFreelancer.id)
          .is('merged_into_freelancer_id', null)
          .maybeSingle();

        if (dupCnpj) {
          const confirmOverride = window.confirm(
            `Possível duplicidade por CNPJ!\n\n` +
            `O CNPJ informado já está associado ao freelancer "${dupCnpj.full_name}".\n` +
            `Deseja salvar esta duplicidade mesmo assim?`
          );
          if (!confirmOverride) {
            setIsSaving(false);
            return;
          }

          const justification = window.prompt('Informe a justificativa administrativa para CNPJ duplicado:');
          if (!justification || !justification.trim()) {
            alert('Justificativa obrigatória.');
            setIsSaving(false);
            return;
          }

          // audit log
          await supabase.from('audit_logs').insert({
            action: 'manual_rh_duplicate_override',
            entity: 'freelancers',
            new_data: { cnpj: editCnpjNormalized, name: editName, justification, freelancer_id: editingFreelancer.id }
          });
        }
      }

      db.setFreelancers((prev: any[]) => prev.map(f => {
        if (f.id === editingFreelancer.id) {
          return {
            ...f,
            name: editName,
            email: editEmail,
            whatsapp: editWhatsapp,
            city: editCity,
            state: editState,
            mainRole: editRole,
            seniority: editSeniority,
            status: editStatus,
            availability: editAvailability,
            referenceValue: parseCurrencyBR(editReferenceValueVisual),
            observations: editObservations,
            locationText: editLocationText,
            brandsWorked: editBrandsWorked,
            hasWorkedWithV3a: editHasWorkedWithV3a,
            portfolioUrl: editPortfolioUrl,
            linkedinUrl: editLinkedinUrl,
            instagramUrl: editInstagramUrl,
            portfolioFileUrl: editPortfolioFileUrl,
            portfolioFilePath: editPortfolioFilePath,
            portfolioFileName: editPortfolioFileName,
            cnpj_normalized: editCountryCode === 'BR' ? editCnpjNormalized : '',
            foreign_tax_id: editCountryCode !== 'BR' ? editForeignTaxId : '',
            tax_country_code: editCountryCode,
            cnpj_is_mock: editCnpjIsMock,
            cnpj_source: editCnpjSource || 'manual_rh',
          };
        }
        return f;
      }));

      alert('Cadastro do freelancer atualizado com sucesso!');
      setIsEditModalOpen(false);
    } catch (err: any) {
      alert(`Erro ao salvar alterações: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Rendering helpers for table formatting
  const renderChipsWithTooltip = (items: string[], max = 2) => {
    if (!items || items.length === 0) return <span className="text-text-secondary text-xs">—</span>;
    const visibleItems = items.slice(0, max);
    const hiddenItemsCount = items.length - max;
    const tooltipText = items.join(', ');

    return (
      <div className="flex flex-wrap gap-1 items-center max-w-[200px]" title={tooltipText}>
        {visibleItems.map((item, idx) => (
          <span key={idx} className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-800 text-[10px] rounded-md font-medium truncate max-w-[90px]">
            {item}
          </span>
        ))}
        {hiddenItemsCount > 0 && (
          <span className="inline-block px-1.5 py-0.5 bg-cyan-50 text-cyan-800 text-[10px] rounded-md font-bold cursor-help" title={tooltipText}>
            +{hiddenItemsCount}
          </span>
        )}
      </div>
    );
  };

  const renderBrandsWithTooltip = (brandsStr?: string, max = 2) => {
    if (!brandsStr) return <span className="text-text-secondary text-xs">—</span>;
    const items = brandsStr.split(',').map(s => s.trim()).filter(Boolean);
    return renderChipsWithTooltip(items, max);
  };

  const SortableHeader = ({ field, label, width }: { field: string, label: string, width?: string }) => {
    const isSorted = sortBy === field;
    return (
      <th 
        style={width ? { width } : undefined}
        onClick={() => handleSort(field)} 
        className={`px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors select-none text-[10px] uppercase tracking-wider font-bold text-text-secondary`}
      >
        <div className="flex items-center gap-1">
          <span>{label}</span>
          {isSorted ? (
            sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-action-cyan shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-action-cyan shrink-0" />
          ) : (
            <div className="w-3.5 h-3.5 opacity-20 hover:opacity-100 flex flex-col items-center justify-center shrink-0">
              <ChevronUp className="w-2.5 h-2.5" />
              <ChevronDown className="w-2.5 h-2.5 -mt-1.5" />
            </div>
          )}
        </div>
      </th>
    );
  };

  // Skeleton rows loader
  const SkeletonRow = () => (
    <tr className="animate-pulse">
      <td className="px-6 py-4"><div className="bg-slate-200 h-10 w-48 rounded-lg"></div></td>
      <td className="px-6 py-4"><div className="bg-slate-200 h-8 w-32 rounded-lg"></div></td>
      <td className="px-6 py-4"><div className="bg-slate-200 h-6 w-20 rounded-lg"></div></td>
      <td className="px-6 py-4"><div className="bg-slate-200 h-6 w-24 rounded-lg"></div></td>
      <td className="px-6 py-4"><div className="bg-slate-200 h-6 w-24 rounded-lg"></div></td>
      <td className="px-6 py-4"><div className="bg-slate-200 h-6 w-16 rounded-lg"></div></td>
      <td className="px-6 py-4"><div className="bg-slate-200 h-6 w-32 rounded-lg"></div></td>
      <td className="px-6 py-4"><div className="bg-slate-200 h-6 w-32 rounded-lg"></div></td>
      <td className="px-6 py-4"><div className="bg-slate-200 h-6 w-20 rounded-lg"></div></td>
      <td className="px-6 py-4 text-center"><div className="bg-slate-200 h-8 w-20 rounded-lg mx-auto"></div></td>
    </tr>
  );

  return (
    <div id="banco-freelas-container" className="space-y-6">
      {/* Upper bar with buttons to register / suggest */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Banco de Freelancers da Agência</h2>
          <p className="text-xs text-text-secondary">Explore o banco de talentos de live marketing. Registre contratações e configure filtros estratégicos.</p>
        </div>
        
        {/* Profile-bound buttons */}
        <div className="flex gap-2 shrink-0">
          {(db.currentUser.profile === 'MASTER' || db.currentUser.profile === 'RH') ? (
            <button
              onClick={() => db.setActiveTab('Cadastrar Freelancer')}
              className="bg-action-cyan hover:bg-action-cyan/90 text-white font-bold p-1.5 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Cadastrar Novo Freela
            </button>
          ) : (
            <button
              onClick={() => db.setActiveTab('Sugerir Freelancer')}
              className="bg-primary hover:bg-primary/95 text-white font-bold p-1.5 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-action-cyan fill-action-cyan" /> Sugerir Novo Freela
            </button>
          )}
        </div>
      </div>

      {/* Filter and search bar card */}
      <div className="bg-white p-5 rounded-2xl border border-border-subtle shadow-xs space-y-4">
        <div className="flex md:flex-row flex-col gap-3">
          {/* Main search text field */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              placeholder="Buscar por nome, e-mail, marcas, segmento, cidade ou experiência com V3A..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 border border-border-subtle rounded-xl text-xs text-text-primary focus:outline-none focus:border-action-cyan focus:ring-1 focus:ring-action-cyan bg-slate-50"
            />
          </div>

          <div className="flex gap-2">
            <button 
              onClick={handleClearFilters}
              className="border border-border-subtle hover:bg-slate-50 text-text-primary p-2.5 px-4 rounded-xl text-xs flex items-center gap-1.5 shrink-0 font-bold"
              title="Limpar filtros"
            >
              <FilterX className="w-4 h-4" />
              <span>Limpar Filtros</span>
            </button>
          </div>
        </div>

        {/* Detailed Filters grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
          {/* Filter 1: Main Role */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-text-secondary block mb-1">Função Principal</label>
            <select
              value={selectedRole}
              onChange={(e) => { setSelectedRole(e.target.value); setCurrentPage(1); }}
              className="w-full border border-border-subtle rounded-lg p-2 text-xs text-text-primary focus:outline-none focus:border-action-cyan bg-white"
            >
              <option value="">Todas as Funções</option>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Filter 2: Seniority */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-text-secondary block mb-1">Senioridade</label>
            <select
              value={selectedSeniority}
              onChange={(e) => { setSelectedSeniority(e.target.value); setCurrentPage(1); }}
              className="w-full border border-border-subtle rounded-lg p-2 text-xs text-text-primary focus:outline-none focus:border-action-cyan bg-white"
            >
              <option value="">Todas</option>
              {seniorities.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Filter 3: Availability */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-text-secondary block mb-1">Disponibilidade</label>
            <select
              value={selectedAvailability}
              onChange={(e) => { setSelectedAvailability(e.target.value); setCurrentPage(1); }}
              className="w-full border border-border-subtle rounded-lg p-2 text-xs text-text-primary focus:outline-none focus:border-action-cyan bg-white"
            >
              <option value="">Todas</option>
              {availabilities.map(av => <option key={av} value={av}>{av}</option>)}
            </select>
          </div>

          {/* Filter 4: Status */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-text-secondary block mb-1">Status Base</label>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
              className="w-full border border-border-subtle rounded-lg p-2 text-xs text-text-primary focus:outline-none focus:border-action-cyan bg-white"
            >
              <option value="">Todos</option>
              {statuses.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>

          {/* Filter 5: Minimum Star Score */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-text-secondary block mb-1">Avaliação Mínima</label>
            <select
              value={minScore}
              onChange={(e) => { setMinScore(Number(e.target.value)); setCurrentPage(1); }}
              className="w-full border border-border-subtle rounded-lg p-2 text-xs text-text-primary focus:outline-none focus:border-action-cyan bg-white"
            >
              <option value="0">Qualquer média</option>
              <option value="4.5">Acima de 4.5 ★ (Excelência)</option>
              <option value="4.0">Acima de 4.0 ★ (Bom)</option>
              <option value="3.5">Acima de 3.5 ★ (Regular)</option>
            </select>
          </div>

          {/* Filter 6: Location */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-text-secondary block mb-1">Localização</label>
            <select
              value={selectedLocation}
              onChange={(e) => { setSelectedLocation(e.target.value); setCurrentPage(1); }}
              className="w-full border border-border-subtle rounded-lg p-2 text-xs text-text-primary focus:outline-none focus:border-action-cyan bg-white"
            >
              <option value="">Todas as Localidades</option>
              {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>

          {/* Filter 7: Worked with V3A */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-text-secondary block mb-1">Já trabalhou com V3A?</label>
            <select
              value={selectedWorkedV3a}
              onChange={(e) => { setSelectedWorkedV3a(e.target.value); setCurrentPage(1); }}
              className="w-full border border-border-subtle rounded-lg p-2 text-xs text-text-primary focus:outline-none focus:border-action-cyan bg-white"
            >
              <option value="">Qualquer experiência</option>
              {workedWithV3aOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          {/* Filter 8: Segment/Industry */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-text-secondary block mb-1">Segmento / Indústria</label>
            <select
              value={selectedIndustry}
              onChange={(e) => { setSelectedIndustry(e.target.value); setCurrentPage(1); }}
              className="w-full border border-border-subtle rounded-lg p-2 text-xs text-text-primary focus:outline-none focus:border-action-cyan bg-white"
            >
              <option value="">Todos os Segmentos</option>
              {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Main card database view */}
      <div className="bg-white rounded-2xl border border-border-subtle shadow-xs overflow-hidden">
        
        {/* DESKTOP TABLE VIEW */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap table-fixed">
            <thead className="bg-[#0A192F] text-white font-bold border-b border-border-subtle">
              <tr>
                <SortableHeader field="name" label="Freela" width="310px" />
                <SortableHeader field="role" label="Função / Senioridade" width="180px" />
                <SortableHeader field="location" label="Localização" width="140px" />
                <SortableHeader field="availability" label="Disponibilidade" width="150px" />
                <SortableHeader field="experience" label="Experiência V3A" width="140px" />
                <SortableHeader field="score" label="Score Inicial" width="120px" />
                <th style={{ width: '220px' }} className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-text-secondary">Segmentos</th>
                <th style={{ width: '220px' }} className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-text-secondary">Marcas</th>
                <SortableHeader field="status" label="Status" width="130px" />
                <th style={{ width: '120px' }} className="px-4 py-3 text-center text-[10px] uppercase tracking-wider font-bold text-text-secondary">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle align-middle">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              ) : paginatedFreelancers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-text-secondary italic">
                    Nenhum freelancer encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                paginatedFreelancers.map((f) => {
                  const isBlocked = f.status === 'Bloqueado';
                  const initials = f.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
                  
                  return (
                    <tr 
                      key={f.id} 
                      className={`hover:bg-slate-50 transition-colors h-[76px]
                        ${isBlocked ? 'bg-rose-50/40 text-rose-950/80' : ''}`}
                    >
                      {/* Identity contact cell */}
                      <td className="px-6 py-3 overflow-hidden">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white uppercase text-[10px] shrink-0
                            ${isBlocked ? 'bg-rose-600/40' : 'bg-sidebar-navy'}`}>
                            {initials}
                          </div>
                          <div className="truncate">
                            <p 
                              onClick={() => { db.setSelectedFreelancerId(f.id); db.setActiveTab('Perfil do Freelancer'); }} 
                              className="font-bold text-text-primary hover:text-action-cyan cursor-pointer transition-colors hover:underline truncate"
                            >
                              {f.name}
                            </p>
                            <p className="text-[10px] text-text-secondary truncate mt-0.5" title={`${f.email} • ${f.whatsapp}`}>
                              {f.email} • {f.whatsapp}
                            </p>
                            {f.cnpj_normalized ? (
                              <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                CNPJ: {formatCnpj(f.cnpj_normalized)} {f.cnpj_is_mock && <span className="bg-amber-100 text-amber-800 text-[8px] font-bold px-1 rounded-sm ml-1 select-none">CNPJ de teste</span>}
                              </p>
                            ) : f.foreign_tax_id ? (
                              <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                Tax ID: {f.foreign_tax_id} ({f.tax_country_code})
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Role & Seniority */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-text-primary truncate">{f.mainRole}</span>
                            {(f.mainRole === 'Planejamento' || f.mainRole?.includes('Planejamento')) && (
                              <span className="bg-cyan-50 text-cyan-800 text-[8px] font-bold px-1 rounded-md">PLANNER</span>
                            )}
                          </div>
                          <span className="text-[10px] text-text-secondary mt-0.5">{f.seniority}</span>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3">
                        <span className="text-text-primary font-medium truncate block">
                          {f.locationText || `${f.city}, ${f.state}`}
                        </span>
                      </td>

                      {/* Availability */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold border
                            ${f.availability === 'Imediata' ? 'bg-emerald-50 text-emerald-700 border-emerald-150' : ''}
                            ${f.availability === '15 dias' ? 'bg-blue-50 text-blue-700 border-blue-150' : ''}
                            ${f.availability === '30+ dias' ? 'bg-amber-50 text-[#B28900] border-amber-150' : ''}
                            ${f.availability === 'Indisponível' ? 'bg-slate-100 text-slate-650 border-slate-200' : ''}
                          `}>
                            {f.availability}
                          </span>
                          {f.contractType && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-150">
                              {f.contractType}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Experience V3A */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border bg-slate-50 text-slate-700 border-slate-200`}>
                          {f.hasWorkedWithV3a || (f.experienceWithV3A ? 'Sim' : 'Nunca')}
                        </span>
                      </td>

                      {/* Average Stars score */}
                      <td className="px-4 py-3">
                        <ScoreStars score={f.averageScore} size="sm" showNumber={true} />
                      </td>

                      {/* Segmentos */}
                      <td className="px-4 py-3">
                        {renderChipsWithTooltip(f.industries, 2)}
                      </td>

                      {/* Marcas */}
                      <td className="px-4 py-3">
                        {renderBrandsWithTooltip(f.brandsWorked, 2)}
                      </td>

                      {/* Core Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border
                          ${f.status === 'Elegível' ? 'bg-emerald-50 text-emerald-700 border-emerald-150' : ''}
                          ${f.status === 'Em onboarding' ? 'bg-cyan-50 text-cyan-800 border-cyan-150' : ''}
                          ${f.status === 'Em observação' ? 'bg-amber-50 text-[#B28900] border-amber-150' : ''}
                          ${f.status === 'Em análise' ? 'bg-amber-50 text-[#B28900] border-amber-150' : ''}
                          ${f.status === 'Bloqueado' ? 'bg-rose-50 text-rose-700 border-rose-150' : ''}
                          ${f.status === 'Inativo' ? 'bg-slate-100 text-slate-600 border-slate-200' : ''}
                        `}>
                          {f.status}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => { db.setSelectedFreelancerId(f.id); db.setActiveTab('Perfil do Freelancer'); }}
                            className="p-1 text-slate-500 hover:text-action-cyan hover:bg-slate-100 rounded-lg transition-colors"
                            title="Visualizar dossiê"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {(db.currentUser.profile === 'MASTER' || db.currentUser.profile === 'RH') && (
                            <>
                              <button
                                onClick={() => openEditModal(f)}
                                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Editar Cadastro"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleToggleBlock(f.id, f.status)}
                                className={`p-1 rounded-lg transition-colors ${isBlocked 
                                  ? 'text-emerald-600 hover:bg-emerald-50' 
                                  : 'text-rose-600 hover:bg-rose-50'}`}
                                title={isBlocked ? 'Desbloquear Profissional' : 'Bloquear / Aplicar Veto'}
                              >
                                {isBlocked ? <Check className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                              </button>
                            </>
                          )}

                          {db.selectedJobId && f.status === 'Elegível' && (
                            <button
                              onClick={() => handleAddToShortlistDirect(f)}
                              className="p-1 text-slate-500 hover:text-cyan-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Adicionar à Shortlist"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
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
        <div className="md:hidden divide-y divide-border-subtle">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="p-4 space-y-3 animate-pulse bg-white">
                <div className="flex justify-between items-center">
                  <div className="bg-slate-200 h-8 w-32 rounded-lg"></div>
                  <div className="bg-slate-200 h-5 w-16 rounded-full"></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-200 h-6 w-24 rounded-lg"></div>
                  <div className="bg-slate-200 h-6 w-20 rounded-lg"></div>
                </div>
              </div>
            ))
          ) : paginatedFreelancers.length === 0 ? (
            <div className="p-8 text-center text-text-secondary italic">
              Nenhum freelancer encontrado com os filtros selecionados.
            </div>
          ) : (
            paginatedFreelancers.map((f) => {
              const isBlocked = f.status === 'Bloqueado';
              return (
                <div 
                  key={f.id} 
                  className={`p-4 bg-white space-y-3.5
                    ${isBlocked ? 'bg-rose-50/45 text-rose-950/80' : ''}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 
                        onClick={() => { db.setSelectedFreelancerId(f.id); db.setActiveTab('Perfil do Freelancer'); }} 
                        className="font-bold text-text-primary text-sm hover:underline cursor-pointer"
                      >
                        {f.name}
                      </h4>
                      <p className="text-[10px] text-text-secondary mt-0.5">{f.email} • {f.whatsapp}</p>
                      {f.cnpj_normalized ? (
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                          CNPJ: {formatCnpj(f.cnpj_normalized)} {f.cnpj_is_mock && <span className="bg-amber-100 text-amber-800 text-[8px] font-bold px-1 rounded-sm ml-1 select-none">CNPJ de teste</span>}
                        </p>
                      ) : f.foreign_tax_id ? (
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                          Tax ID: {f.foreign_tax_id} ({f.tax_country_code})
                        </p>
                      ) : null}
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 border
                      ${f.status === 'Elegível' ? 'bg-emerald-50 text-emerald-700 border-emerald-150' : ''}
                      ${f.status === 'Bloqueado' ? 'bg-rose-50 text-rose-700 border-rose-150' : ''}
                      ${f.status === 'Em onboarding' ? 'bg-cyan-50 text-cyan-850 border-cyan-150' : 'bg-slate-100 text-slate-700 border-slate-200'}
                    `}>
                      {f.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-[11px] pt-1.5 border-t border-dashed border-border-subtle">
                    <div>
                      <span className="text-[9px] text-text-secondary font-bold uppercase block">Função / Sênior</span>
                      <span className="font-semibold text-text-primary leading-tight mt-0.5 block">{f.mainRole} ({f.seniority})</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-text-secondary font-bold uppercase block">Disponibilidade</span>
                      <span className="font-medium text-text-primary mt-0.5 block">{f.availability}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-text-secondary font-bold uppercase block">Localização</span>
                      <span className="font-medium text-text-primary mt-0.5 block">{f.locationText || `${f.city}/${f.state}`}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-text-secondary font-bold uppercase block">Avaliação</span>
                      <span className="font-semibold text-text-primary mt-0.5 block">
                        {f.averageScore > 0 ? `${f.averageScore.toFixed(2)} ★` : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-dashed border-border-subtle">
                    <button
                      onClick={() => { db.setSelectedFreelancerId(f.id); db.setActiveTab('Perfil do Freelancer'); }}
                      className="bg-slate-50 hover:bg-slate-100 border border-border-subtle text-text-primary font-bold px-3 py-1.5 rounded-xl text-[10px]"
                    >
                      Ver Perfil
                    </button>

                    {(db.currentUser.profile === 'MASTER' || db.currentUser.profile === 'RH') && (
                      <button
                        onClick={() => openEditModal(f)}
                        className="bg-slate-50 hover:bg-slate-100 border border-border-subtle text-text-primary font-bold px-3 py-1.5 rounded-xl text-[10px]"
                      >
                        Editar
                      </button>
                    )}

                    {db.selectedJobId && f.status === 'Elegível' && (
                      <button
                        onClick={() => handleAddToShortlistDirect(f)}
                        className="bg-cyan-50 hover:bg-cyan-100 border border-cyan-250 text-cyan-800 font-bold px-3 py-1.5 rounded-xl text-[10px]"
                      >
                        Shortlist
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* PAGINATION PANEL FOOTER */}
        {totalItems > 0 && (
          <div className="p-4 bg-slate-50 border-t border-border-subtle flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-text-secondary">
            <div className="flex items-center gap-2">
              <span>Itens por página:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="border border-border-subtle rounded-lg p-1 text-xs text-text-primary bg-white focus:outline-none focus:border-action-cyan"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <span className="ml-2">
                Exibindo <strong>{startIndex + 1}–{endIndex}</strong> de <strong>{totalItems}</strong> freelancers
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="border border-border-subtle bg-white hover:bg-slate-50 p-1.5 rounded-lg disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4 text-text-primary" />
              </button>

              <div className="flex items-center gap-1">
                <span className="px-2 py-1 font-semibold text-text-primary bg-white border border-border-subtle rounded-lg">
                  {currentPage}
                </span>
                <span>de</span>
                <span className="font-semibold text-text-primary">{totalPages}</span>
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="border border-border-subtle bg-white hover:bg-slate-50 p-1.5 rounded-lg disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4 text-text-primary" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* EDIT FREELANCER MODAL */}
      {isEditModalOpen && editingFreelancer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 w-full max-w-2xl text-xs animate-scale-up my-8">
            <div className="p-5 bg-sidebar-navy text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-action-cyan" />
                <h3 className="font-extrabold text-sm">Editar Cadastro de Freelancer</h3>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-white hover:text-action-cyan transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditFreelancerSubmit} className="p-6 space-y-4 max-h-[calc(100vh-160px)] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-text-secondary block mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                  />
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">E-mail Corporativo/Pessoal *</label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                  />
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">WhatsApp / Celular *</label>
                  <input
                    type="text"
                    required
                    value={editWhatsapp}
                    onChange={e => setEditWhatsapp(e.target.value)}
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                  />
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Localização Descritiva (Ex: SP Capital) *</label>
                  <input
                    type="text"
                    required
                    value={editLocationText}
                    onChange={e => setEditLocationText(e.target.value)}
                    placeholder="Ex: RJ Capital, SP Capital, Fora do Brasil"
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                  />
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">País de Residência *</label>
                  <select
                    value={editCountryCode}
                    onChange={e => {
                      setEditCountryCode(e.target.value);
                      if (e.target.value !== 'BR') {
                        setEditCnpjNormalized('');
                      } else {
                        setEditForeignTaxId('');
                      }
                    }}
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white"
                  >
                    {countries.map(c => (
                      <option key={c.iso2} value={c.iso2}>{c.name_pt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  {editCountryCode === 'BR' ? (
                    <div className="flex flex-col">
                      <label className="font-bold text-text-secondary block mb-1">CNPJ *</label>
                      <CnpjInput
                        value={editCnpjNormalized}
                        onChange={setEditCnpjNormalized}
                        required
                        showValidationStatus={true}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="font-bold text-text-secondary block mb-1">Identificador Fiscal Estrangeiro *</label>
                      <input
                        type="text"
                        required
                        value={editForeignTaxId}
                        onChange={e => setEditForeignTaxId(e.target.value)}
                        className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                        placeholder="ID Fiscal ou equivalente"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Cidade *</label>
                  <input
                    type="text"
                    required
                    value={editCity}
                    onChange={e => setEditCity(e.target.value)}
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                  />
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Estado (UF) *</label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={editState}
                    onChange={e => setEditState(e.target.value)}
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50 text-center uppercase"
                  />
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Função Principal</label>
                  <select
                    value={editRole}
                    onChange={e => setEditRole(e.target.value)}
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white"
                  >
                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Senioridade</label>
                  <select
                    value={editSeniority}
                    onChange={e => setEditSeniority(e.target.value as any)}
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white"
                  >
                    <option value="Júnior">Júnior</option>
                    <option value="Pleno">Pleno</option>
                    <option value="Sênior">Sênior</option>
                    <option value="Especialista">Especialista</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Disponibilidade</label>
                  <select
                    value={editAvailability}
                    onChange={e => setEditAvailability(e.target.value as any)}
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white"
                  >
                    <option value="Imediata">Imediata</option>
                    <option value="15 dias">15 dias</option>
                    <option value="30+ dias">30+ dias</option>
                    <option value="Indisponível">Indisponível</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Status Base</label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value as any)}
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white"
                  >
                    <option value="Elegível">Elegível</option>
                    <option value="Em análise">Em análise</option>
                    <option value="Em onboarding">Em onboarding</option>
                    <option value="Em observação">Em observação</option>
                    <option value="Bloqueado">Bloqueado</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Valor da Diária Referência (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-text-secondary select-none">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editReferenceValueVisual}
                      onChange={e => {
                        const rawVal = e.target.value;
                        const masked = maskCurrencyBRL(rawVal);
                        setEditReferenceValueVisual(masked);
                        setEditReferenceValue(parseCurrencyBR(masked));
                      }}
                      onBlur={() => {
                        const numeric = parseCurrencyBR(editReferenceValueVisual);
                        if (numeric > 0) {
                          const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric);
                          setEditReferenceValueVisual(formatted);
                        }
                      }}
                      className="w-full border border-border-subtle p-2 pl-8 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Já trabalhou com V3A? (Frequência)</label>
                  <input
                    type="text"
                    value={editHasWorkedWithV3a}
                    onChange={e => setEditHasWorkedWithV3a(e.target.value)}
                    placeholder="Ex: Nunca, Uma vez, Mais de uma vez"
                    className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Marcas Atendidas (separadas por vírgula)</label>
                <input
                  type="text"
                  value={editBrandsWorked}
                  onChange={e => setEditBrandsWorked(e.target.value)}
                  placeholder="Ex: Coca-Cola, Nike, Americanas"
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                />
              </div>

              {/* Social / Portfolio section */}
              <div className="border border-border-subtle rounded-xl p-4 space-y-3 bg-slate-50/50">
                <h4 className="font-bold text-text-secondary text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                  <Link className="w-3.5 h-3.5" /> Portfólio &amp; Presença Digital
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-text-secondary block mb-1">URL Portfólio (Behance / Site)</label>
                    <input
                      type="text"
                      value={editPortfolioUrl}
                      onChange={e => setEditPortfolioUrl(e.target.value)}
                      placeholder="Ex: behance.net/nome"
                      className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-text-secondary block mb-1 flex items-center gap-1">
                      <Linkedin className="w-3 h-3" /> LinkedIn
                    </label>
                    <input
                      type="text"
                      value={editLinkedinUrl}
                      onChange={e => setEditLinkedinUrl(e.target.value)}
                      placeholder="Ex: linkedin.com/in/nome"
                      className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-text-secondary block mb-1 flex items-center gap-1">
                      <Instagram className="w-3 h-3" /> Instagram
                    </label>
                    <input
                      type="text"
                      value={editInstagramUrl}
                      onChange={e => setEditInstagramUrl(e.target.value)}
                      placeholder="Ex: @handle ou instagram.com/handle"
                      className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white"
                    />
                  </div>
                  {editPortfolioFileName && (
                    <div className="flex items-center gap-2 p-2 bg-white border border-border-subtle rounded-lg text-[11px]">
                      <Upload className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                      <span className="truncate text-text-primary font-medium">{editPortfolioFileName}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Observações Operacionais</label>
                <textarea
                  rows={2}
                  value={editObservations}
                  onChange={e => setEditObservations(e.target.value)}
                  className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="border border-border-subtle p-1.5 px-3 rounded-lg hover:bg-slate-50 font-semibold text-text-primary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-sidebar-navy text-white font-bold p-1.5 px-4 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4 text-action-cyan" /> {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
