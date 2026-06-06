'use client';

import React, { useState } from 'react';
import { DatabaseProps } from '@/app/page';
import { Sparkles, Save, HelpCircle, Briefcase, Plus, Scale, Building } from 'lucide-react';

// Form 1: Cadastrar Freelancer (Master & RH)
export function FormFreela({ db, onCancel }: { db: DatabaseProps; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [mainRole, setMainRole] = useState('Diretor de Arte');
  const [seniority, setSeniority] = useState<'Júnior' | 'Pleno' | 'Sênior' | 'Especialista'>('Pleno');
  const [industries, setIndustries] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [referenceValue, setReferenceValue] = useState(500);
  const [observations, setObservations] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !whatsapp || !city || !state) {
      alert('Por favor preencha os campos obrigatórios (Nome, E-mail, Celular, Cidade e Estado).');
      return;
    }

    const newFreela = {
      id: `free-${Date.now()}`,
      name,
      email,
      whatsapp,
      city,
      state,
      mainRole,
      secondaryRoles: [],
      seniority,
      industries: industries ? industries.split(',').map(s => s.trim()) : ['Bebidas'],
      portfolioUrl,
      status: 'Elegível' as const,
      availability: 'Imediata' as const,
      referenceValue: Number(referenceValue),
      averageScore: 0,
      observations: observations || 'Onboarding inicial efetuado no banco.',
      experienceWithV3A: false,
    };

    db.setFreelancers(prev => [newFreela, ...prev]);
    alert(`Success: Freelancer "${name}" cadastrado com sucesso!`);
    db.setActiveTab('Banco de Freelancers');
  };

  return (
    <div className="bg-white border border-border-subtle p-6 rounded-2xl shadow-xs max-w-2xl mx-auto space-y-6">
      <div>
        <h3 className="font-bold text-text-primary text-base">Cadastrar Novo Freelancer</h3>
        <p className="text-xs text-text-secondary mt-0.5">Cadastre um profissional diretamente no banco central como elegível.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-text-secondary block mb-1">Nome Completo *</label>
            <input
              type="text"
              placeholder="Ex: Pedro Alvares"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
              required
            />
          </div>
          <div>
            <label className="font-bold text-text-secondary block mb-1">E-mail *</label>
            <input
              type="email"
              placeholder="Ex: pedro@outlook.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="font-bold text-text-secondary block mb-1">Celular / WhatsApp *</label>
            <input
              type="text"
              placeholder="Ex: (11) 99123-1122"
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
              required
            />
          </div>
          <div>
            <label className="font-bold text-text-secondary block mb-1">Cidade *</label>
            <input
              type="text"
              placeholder="Ex: São Paulo"
              value={city}
              onChange={e => setCity(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
              required
            />
          </div>
          <div>
            <label className="font-bold text-text-secondary block mb-1">Estado (UF) *</label>
            <input
              type="text"
              placeholder="Ex: SP"
              value={state}
              maxLength={2}
              onChange={e => setState(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan uppercase"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="font-bold text-text-secondary block mb-1">Função Primária</label>
            <select
              value={mainRole}
              onChange={e => setMainRole(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white"
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
            <label className="font-bold text-text-secondary block mb-1">Senioridade</label>
            <select
              value={seniority}
              onChange={e => setSeniority(e.target.value as any)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white"
            >
              <option value="Júnior">Júnior</option>
              <option value="Pleno">Pleno</option>
              <option value="Sênior">Sênior</option>
              <option value="Especialista">Especialista</option>
            </select>
          </div>
          <div>
            <label className="font-bold text-text-secondary block mb-1">Valor Referência de Diária (R$)</label>
            <input
              type="number"
              value={referenceValue}
              onChange={e => setReferenceValue(Number(e.target.value))}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-text-secondary block mb-1">URL Portfólio</label>
            <input
              type="text"
              placeholder="Ex: behance.net/nome"
              value={portfolioUrl}
              onChange={e => setPortfolioUrl(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
            />
          </div>
          <div>
            <label className="font-bold text-text-secondary block mb-1">Niches industriais (Separado por vírgula)</label>
            <input
              type="text"
              placeholder="Ex: Bebidas, Automotivo, Beleza"
              value={industries}
              onChange={e => setIndustries(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
            />
          </div>
        </div>

        <div>
          <label className="font-bold text-text-secondary block mb-1">Observações de onboarding</label>
          <textarea
            placeholder="Anotações internas..."
            value={observations}
            onChange={e => setObservations(e.target.value)}
            rows={3}
            className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="border border-border-subtle p-2 px-4 rounded-xl hover:bg-surface font-semibold text-text-primary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="bg-action-cyan hover:bg-action-cyan/90 text-white font-bold p-2 px-5 rounded-xl flex items-center gap-1 shadow-sm"
          >
            <Save className="w-4 h-4" /> Cadastrar Profissional
          </button>
        </div>
      </form>
    </div>
  );
}

// Form 2: Sugerir Freelancer pelos Núcleos (NÚCLEO)
export function FormSugerir({ db, onCancel }: { db: DatabaseProps; onCancel: () => void }) {
  const [freelancerName, setFreelancerName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [suggestedRole, setSuggestedRole] = useState('Designer 3D');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [relatedProject, setRelatedProject] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!freelancerName || !email || !reason || !relatedProject) {
      alert('Por favor, preencha os dados de indicação obrigatórios (Nome, E-mail, Projeto Relacionado e Justificativa).');
      return;
    }

    const nextId = `sug-${Date.now()}`;
    const newSug = {
      id: nextId,
      freelancerName,
      email,
      whatsapp: whatsapp || '(Indisponível)',
      suggestedRole,
      portfolioUrl,
      reason,
      relatedProject,
      nucleoId: db.currentUser.nucleoId || '55d9d7c0-d3cb-4f1e-84ad-e77ff961805b',
      suggestedBy: db.currentUser.name,
      status: 'Pendente de análise RH' as const,
    };

    db.setSuggestions(prev => [newSug, ...prev]);
    alert(`Sucesso! Indicação de ${freelancerName} gravada e enviada para triagem do RH no painel organizacional.`);
    db.setActiveTab('Dashboard');
  };

  return (
    <div className="bg-white border border-border-subtle p-6 rounded-2xl shadow-xs max-w-2xl mx-auto space-y-6">
      <div className="flex gap-2.5 items-center">
        <Sparkles className="w-5 h-5 text-action-cyan fill-action-cyan animate-pulse shrink-0" />
        <div>
          <h3 className="font-bold text-text-primary text-base">Pré-cadastro de Freela</h3>
          <p className="text-xs text-text-secondary mt-0.5">Indique um profissional externo para ser analisado e homologado pelo RH da agência.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-text-secondary block mb-1">Nome Completo do Indicado *</label>
            <input
              type="text"
              placeholder="Ex: Carlos Costa"
              value={freelancerName}
              onChange={e => setFreelancerName(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
              required
            />
          </div>
          <div>
            <label className="font-bold text-text-secondary block mb-1">E-mail do profissional *</label>
            <input
              type="email"
              placeholder="Ex: carlos.creative@gmail.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="font-bold text-text-secondary block mb-1">Whatsapp</label>
            <input
              type="text"
              placeholder="Ex: (21) 98111-9988"
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
            />
          </div>
          <div>
            <label className="font-bold text-text-secondary block mb-1">Função Recomendada</label>
            <select
              value={suggestedRole}
              onChange={e => setSuggestedRole(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white"
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
            <label className="font-bold text-text-secondary block mb-1">Projeto / Job Vinculado *</label>
            <input
              type="text"
              placeholder="Ex: Ativação Coca-Cola"
              value={relatedProject}
              onChange={e => setRelatedProject(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
              required
            />
          </div>
        </div>

        <div>
          <label className="font-bold text-text-secondary block mb-1">Link de Portfólio relevante</label>
          <input
            type="text"
            placeholder="Ex: behance.net/carlos"
            value={portfolioUrl}
            onChange={e => setPortfolioUrl(e.target.value)}
            className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
          />
        </div>

        <div>
          <label className="font-bold text-text-secondary block mb-1">Por que este profissional é necessário? (Justificativa técnica) *</label>
          <textarea
            rows={3}
            placeholder="Descreva as qualificações diferenciais dele para o projeto..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="border border-border-subtle p-2 px-4 rounded-xl hover:bg-surface font-semibold text-text-primary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="bg-action-cyan hover:bg-action-cyan-dark text-white font-bold p-2 px-5 rounded-xl flex items-center gap-1.5 shadow-sm"
          >
            <Save className="w-4 h-4" /> Enviar Sugestão à Triagem do RH
          </button>
        </div>
      </form>
    </div>
  );
}

// Form 3: Criar Oportunidade / Job (NÚCLEO and MASTER)
export function FormOportunidade({ db, onCancel }: { db: DatabaseProps; onCancel: () => void }) {
  const isMaster = db.currentUser.profile === 'MASTER';

  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [roleNeeded, setRoleNeeded] = useState('Diretor de Arte');
  const [seniorityNeeded, setSeniorityNeeded] = useState<'Júnior' | 'Pleno' | 'Sênior' | 'Especialista'>('Sênior');
  const [description, setDescription] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [startDate, setStartDate] = useState('2026-06-15');
  const [endDate, setEndDate] = useState('2026-06-25');
  const [budget, setBudget] = useState(15000);
  const [urgency, setUrgency] = useState<'Alta' | 'Média' | 'Baixa'>('Média');
  // MASTER must select a nucleo; NÚCLEO auto-fills
  const [selectedNucleoId, setSelectedNucleoId] = useState(
    isMaster ? '' : (db.currentUser.nucleoId || '')
  );

  // Active nucleos only (for MASTER selector)
  const activeNucleos = db.nucleos.filter((n: any) => n.status === 'Ativo');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !client || !description) {
      alert('Por favor, preencha os dados mínimos da demanda (Título da Campanha, Cliente, Descrição Técnica e Escopo).');
      return;
    }

    // MASTER must pick a nucleo
    if (isMaster && !selectedNucleoId) {
      alert('Por favor, selecione o Núcleo Responsável para este job.');
      return;
    }

    const nucleoId = isMaster ? selectedNucleoId : (db.currentUser.nucleoId || '');

    if (!nucleoId) {
      alert('Núcleo não identificado. Verifique seu perfil.');
      return;
    }

    const nextId = `job-${Date.now()}`;
    const newJob = {
      id: nextId,
      name,
      client,
      nucleoId,
      requesterId: db.currentUser.id,
      roleNeeded,
      seniorityNeeded,
      description,
      deliverables,
      startDate,
      endDate,
      budget: Number(budget),
      urgency,
      status: 'Oportunidade criada' as const,
    };

    db.setJobs(prev => [newJob, ...prev]);
    alert(`Campanha e Demanda "${name}" registrada com sucesso! Prossiga para a fase de shortlist.`);
    db.setSelectedJobId(nextId);
    db.setActiveTab('Shortlist');
  };

  return (
    <div className="bg-white border border-border-subtle p-6 rounded-2xl shadow-xs max-w-2xl mx-auto space-y-6">
      <div className="flex gap-2 items-center">
        <Briefcase className="w-5 h-5 text-action-cyan shrink-0" />
        <div>
          <h3 className="font-bold text-text-primary text-base">Registrar Nova Demanda de Freelancer (Job)</h3>
          <p className="text-xs text-text-secondary mt-0.5">Registre as especificações do projeto para iniciar o processo automatizado de shortlist.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">

        {/* MASTER: Nucleo selector */}
        {isMaster && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2">
            <label className="font-bold text-amber-800 block text-xs flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5" />
              Núcleo Responsável pelo Job *
            </label>
            <select
              required
              value={selectedNucleoId}
              onChange={e => setSelectedNucleoId(e.target.value)}
              className="w-full border border-amber-300 p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white"
            >
              <option value="">— Selecione o núcleo —</option>
              {activeNucleos.map((n: any) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            {activeNucleos.length === 0 && (
              <p className="text-[10px] text-amber-700">Nenhum núcleo ativo cadastrado no sistema.</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-text-secondary block mb-1">Título do Projeto / Job *</label>
            <input
              type="text"
              placeholder="Ex: Arena Real Gamer"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
              required
            />
          </div>
          <div>
            <label className="font-bold text-text-secondary block mb-1">Cliente Solicitante *</label>
            <input
              type="text"
              placeholder="Ex: Coca-Cola Inc"
              value={client}
              onChange={e => setClient(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="font-bold text-text-secondary block mb-1">Função Requerida</label>
            <select
              value={roleNeeded}
              onChange={e => setRoleNeeded(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white"
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
            <label className="font-bold text-text-secondary block mb-1">Senioridade Requerida</label>
            <select
              value={seniorityNeeded}
              onChange={e => setSeniorityNeeded(e.target.value as any)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white"
            >
              <option value="Júnior">Júnior</option>
              <option value="Pleno">Pleno</option>
              <option value="Sênior">Sênior</option>
              <option value="Especialista">Especialista</option>
            </select>
          </div>
          <div>
            <label className="font-bold text-text-secondary block mb-1">Regime de Urgência</label>
            <select
              value={urgency}
              onChange={e => setUrgency(e.target.value as any)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan bg-white"
            >
              <option value="Baixa">Baixa (Padrão)</option>
              <option value="Média">Média (Atenção)</option>
              <option value="Alta">Alta (Imediato)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="font-bold text-text-secondary block mb-1">Início Estimado</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
            />
          </div>
          <div>
            <label className="font-bold text-text-secondary block mb-1">Fim Estimado</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
            />
          </div>
          <div>
            <label className="font-bold text-text-secondary block mb-1">Budget Previsto Máx. (R$)</label>
            <input
              type="number"
              value={budget}
              onChange={e => setBudget(Number(e.target.value))}
              className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
            />
          </div>
        </div>

        <div>
          <label className="font-bold text-text-secondary block mb-1">Descrição Técnico / Escopo da Atividade *</label>
          <textarea
            rows={3}
            placeholder="Descreva as tarefas e responsabilidades do freelancer..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
            required
          />
        </div>

        <div>
          <label className="font-bold text-text-secondary block mb-1">Entregáveis (Milestones para quitação financeira)</label>
          <input
            type="text"
            placeholder="Ex: Arquivo 3D FBX do stand, manual de aplicação visual, arquivos PSD abertos"
            value={deliverables}
            onChange={e => setDeliverables(e.target.value)}
            className="w-full border border-border-subtle p-2 rounded-lg text-text-primary focus:outline-none focus:border-action-cyan"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="border border-border-subtle p-2 px-4 rounded-xl hover:bg-surface font-semibold text-text-primary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="bg-action-cyan hover:bg-action-cyan-dark text-white font-bold p-2 px-5 rounded-xl flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Criar Demanda &amp; Ver Shortlist
          </button>
        </div>
      </form>
    </div>
  );
}
