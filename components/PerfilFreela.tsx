'use client';

import React, { useState } from 'react';
import { DatabaseProps } from '@/app/page';
import { ChevronLeft, Star, Phone, Mail, MapPin, Briefcase, ExternalLink, Calendar, AlertTriangle, ShieldCheck, Scale, History, User, Linkedin, Instagram, QrCode, Loader2 } from 'lucide-react';
import ScoreStars from '@/components/ScoreStars';
import QRCodeModal from './QRCodeModal';
import { generatePublicFormLinkAction } from '@/app/actions/adminPublicForm';

export default function PerfilFreela({ db }: { db: DatabaseProps }) {
  const [activeTab, setActiveTab2] = useState<'geral' | 'portfolio' | 'alocacoes' | 'avaliacoes'>('geral');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrModalData, setQrModalData] = useState<{
    token: string;
    expiresAt: string | null;
  } | null>(null);

  const fId = db.selectedFreelancerId;
  const f = db.freelancers.find(item => item.id === fId);

  const handleGenerateUpdateLink = async () => {
    if (!f) return;
    setIsGeneratingLink(true);
    try {
      const { data: { session } } = await import('@/lib/supabase').then(m => m.supabase.auth.getSession());
      const token = session?.access_token || '';
      
      const res = await generatePublicFormLinkAction(token, {
        type: 'update_freelancer',
        freelancerId: f.id,
        expiresDays: 7 // Default 7 days
      });

      if (res.success) {
        setQrModalData({
          token: res.token || '',
          expiresAt: res.expiresAt || null
        });
        setQrModalOpen(true);
      } else {
        alert(res.error || 'Erro ao gerar o link.');
      }
    } catch (err) {
      console.error('Error generating update link:', err);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  if (!f) {
    return (
      <div className="p-8 text-center text-text-secondary bg-white rounded-2xl border border-border-subtle">
        <AlertTriangle className="w-8 h-8 text-status-error mx-auto mb-2" />
        <p className="text-sm font-semibold">Perfil de freelancer não localizado no banco ativo.</p>
        <button onClick={() => db.setActiveTab('Banco de Freelancers')} className="text-action-cyan hover:underline text-xs mt-4">
          Voltar para buscar freelancers
        </button>
      </div>
    );
  }

  // Find allocations related to this freelancer
  const myAllocations = db.allocations.filter(a => a.freelancerId === f.id);
  const myEvaluations = db.evaluations.filter(ev => ev.freelancerId === f.id);

  // Compute average of specific evaluation sub-indices if any evaluations exist
  const getSubIndexAverage = (key: 'technicalQuality' | 'deadline' | 'briefingAdherence' | 'communication' | 'autonomy' | 'behavior') => {
    if (myEvaluations.length === 0) return 0;
    const sum = myEvaluations.reduce((s, ev) => s + ev[key], 0);
    return Number((sum / myEvaluations.length).toFixed(1));
  };

  const getWeightPercentage = (key: string) => {
    switch (key) {
      case 'técnica': return '30%';
      case 'prazo': return '20%';
      case 'briefing': return '15%';
      case 'comunicação': return '15%';
      case 'autonomia': return '10%';
      case 'postura': return '10%';
      default: return '0%';
    }
  };

  return (
    <div id="perfil-freela-container" className="space-y-6">
      {/* Back button and actions */}
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <button
          onClick={() => db.setActiveTab('Banco de Freelancers')}
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors font-medium border border-border-subtle p-1.5 px-3 rounded-lg bg-white cursor-pointer select-none"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar para o Banco de Freelancers
        </button>

        {(db.currentUser?.profile === 'MASTER' || db.currentUser?.profile === 'RH') && (
          <button
            onClick={handleGenerateUpdateLink}
            disabled={isGeneratingLink}
            className="flex items-center gap-1.5 text-xs bg-[#0F2342] hover:bg-[#152e54] text-white font-bold py-2 px-3 rounded-xl transition-colors cursor-pointer select-none disabled:opacity-50"
          >
            {isGeneratingLink ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-action-cyan shrink-0" /> Gerando Link...
              </>
            ) : (
              <>
                <QrCode className="w-3.5 h-3.5 text-action-cyan shrink-0" /> Gerar Link de Atualização
              </>
            )}
          </button>
        )}
      </div>

      {/* Main Identity Header Card */}
      <div className="bg-white border border-border-subtle rounded-2xl p-6 shadow-xs relative overflow-hidden">
        {f.status === 'Bloqueado' && (
          <div className="absolute top-0 left-0 right-0 bg-status-error text-white text-center py-1 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Profissional possui bloqueio ativo por inconformidade com governança
          </div>
        )}

        <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${f.status === 'Bloqueado' ? 'pt-4' : ''}`}>
          <div className="flex items-center gap-4">
            {/* Avatar block */}
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white uppercase shrink-0 
              ${f.status === 'Bloqueado' ? 'bg-status-error/40' : 'bg-sidebar-navy'}`}>
              {f.name.charAt(0)}{f.name.split(' ').length > 1 ? f.name.split(' ')[1].charAt(0) : ''}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-text-primary">{f.name}</h2>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold
                  ${f.status === 'Elegível' ? 'bg-status-success/15 text-status-success' : ''}
                  ${f.status === 'Em onboarding' ? 'bg-action-cyan/15 text-action-cyan' : ''}
                  ${f.status === 'Em observação' ? 'bg-[#B28900]/10 text-[#B28900]' : ''}
                  ${f.status === 'Bloqueado' ? 'bg-status-error/15 text-status-error border border-status-error/20' : ''}
                  ${f.status === 'Inativo' ? 'bg-disabled text-text-secondary' : ''}
                `}>
                  {f.status}
                </span>
                {f.experienceWithV3A && (
                  <span className="bg-primary/10 border border-primary/20 text-text-primary text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-action-cyan" /> Legado V3A
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary font-medium">
                {f.mainRole} &bull; <span className="font-bold">{f.seniority}</span>
              </p>
            </div>
          </div>

          {/* Rating Badge */}
          <div className="flex items-center gap-4 border-l border-border-subtle pl-0 md:pl-6">
            <div>
              <span className="text-[10px] text-text-secondary block font-bold uppercase tracking-wider">Score Geral</span>
              <div className="mt-0.5">
                <ScoreStars score={f.averageScore} size="md" showNumber={true} evalCount={myEvaluations.length} />
              </div>
            </div>
          </div>
        </div>

        {/* Contact and address block */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-dashed border-border-subtle text-xs">
          <div className="flex items-center gap-2 text-text-secondary">
            <Phone className="w-4 h-4 text-text-secondary shrink-0" />
            <span>{f.whatsapp}</span>
          </div>
          <div className="flex items-center gap-2 text-text-secondary">
            <Mail className="w-4 h-4 text-text-secondary shrink-0" />
            <span className="truncate">{f.email}</span>
          </div>
          <div className="flex items-center gap-2 text-text-secondary">
            <MapPin className="w-4 h-4 text-text-secondary shrink-0" />
            <span>{f.city} — {f.state}</span>
          </div>
          <div className="flex items-center gap-2 text-text-secondary">
            <Calendar className="w-4 h-4 text-text-secondary shrink-0" />
            <span>Agenda: <strong className="text-text-primary font-bold">{f.availability}</strong></span>
          </div>
        </div>
      </div>

      {/* Tabs list */}
      <div className="border-b border-border-subtle flex gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab2('geral')}
          className={`pb-2.5 border-b-2 transition-all ${activeTab === 'geral' ? 'border-action-cyan text-action-cyan' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Resumo & Observações
        </button>
        <button
          onClick={() => setActiveTab2('portfolio')}
          className={`pb-2.5 border-b-2 transition-all ${activeTab === 'portfolio' ? 'border-action-cyan text-action-cyan' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Portfólio / Niches ({f.industries.length})
        </button>
        <button
          onClick={() => setActiveTab2('alocacoes')}
          className={`pb-2.5 border-b-2 transition-all ${activeTab === 'alocacoes' ? 'border-action-cyan text-action-cyan' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Histórico de Alocações ({myAllocations.length})
        </button>
        <button
          onClick={() => setActiveTab2('avaliacoes')}
          className={`pb-2.5 border-b-2 transition-all ${activeTab === 'avaliacoes' ? 'border-action-cyan text-action-cyan' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          Pesos & Avaliações Operacionais ({myEvaluations.length})
        </button>
      </div>

      {/* TABS CONTENT */}
      <div className="bg-white border border-border-subtle p-6 rounded-2xl shadow-xs min-h-[250px]">
        {/* TAB 1: GERAL/OVERVIEW */}
        {activeTab === 'geral' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                <User className="w-4 h-4 text-text-secondary" />
                <span>Parecer Técnico do RH & Anotações de Campo</span>
              </h3>
              <p className="text-xs text-text-primary leading-relaxed bg-surface p-4 rounded-xl border border-border-subtle italic">
                &ldquo;{f.observations || 'Nenhuma ressalva cadastrada para este profissional.'}&rdquo;
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2">
                <h4 className="font-semibold text-text-primary text-xs uppercase tracking-wider text-text-secondary">Informações Gerais de Base</h4>
                <div className="space-y-1.5 text-xs">
                  <p className="text-text-secondary">Valor sugerido de diária (Ref): <strong className="text-text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(f.referenceValue)}
                  </strong></p>
                  <p className="text-text-secondary">E-mail de convocação: <strong className="text-text-primary">{f.email}</strong></p>
                  <p className="text-text-secondary">Celular WA: <strong className="text-text-primary">{f.whatsapp}</strong></p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-text-primary text-xs uppercase tracking-wider text-text-secondary">Papéis Adicionais Homologados</h4>
                <div className="flex flex-wrap gap-1.5">
                  <span className="bg-secondary-container text-on-secondary-container px-2 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-border-subtle">
                    {f.mainRole} (Principal)
                  </span>
                  {f.secondaryRoles.map(role => (
                    <span key={role} className="bg-surface text-text-primary border border-border-subtle px-2.5 py-1 text-[11px] font-semibold rounded-lg">
                      {role}
                    </span>
                  ))}
                  {f.secondaryRoles.length === 0 && (
                    <span className="text-xs text-text-secondary italic">Nenhum papel secundário federado.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PORTFOLIO & INDUSTRIES */}
        {activeTab === 'portfolio' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-text-secondary" />
                <span>Segmentos Industrial-Ativos & Marcas Conhecidas</span>
              </h3>
              <p className="text-xs text-text-secondary">Setores onde o profissional demonstrou fit de briefing, portfólio rico ou campanhas integradas com sucesso:</p>
              
              <div className="flex flex-wrap gap-2 pt-2">
                {f.industries.map(niche => (
                  <span key={niche} className="bg-action-cyan/10 border border-action-cyan/30 text-text-primary text-[11px] font-bold px-3 py-1 rounded-xl">
                    🏢 Segmento: {niche}
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t border-border-subtle pt-6 space-y-3">
              <h4 className="font-bold text-text-primary text-xs uppercase tracking-wider text-text-secondary">Links de Portfólio &amp; Redes Sociais</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Portfolio site */}
                <div className="bg-surface border border-border-subtle p-3 rounded-xl flex justify-between items-center">
                  <div className="truncate pr-3 text-xs">
                    <p className="font-bold text-text-secondary text-[9px] uppercase tracking-wider mb-0.5">Portfólio / Site</p>
                    <p className="text-text-primary font-medium truncate">{f.portfolioUrl || 'Não informado'}</p>
                  </div>
                  {f.portfolioUrl && (
                    <a
                      href={f.portfolioUrl.startsWith('http') ? f.portfolioUrl : `https://${f.portfolioUrl}`}
                      target="_blank" rel="noreferrer"
                      className="bg-action-cyan hover:bg-action-cyan/90 text-white font-bold text-[10px] p-1.5 px-2.5 rounded-lg flex items-center gap-1 shrink-0"
                    >
                      Abrir <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* LinkedIn */}
                <div className="bg-surface border border-border-subtle p-3 rounded-xl flex justify-between items-center">
                  <div className="truncate pr-3 text-xs">
                    <p className="font-bold text-text-secondary text-[9px] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                      <Linkedin className="w-3 h-3" /> LinkedIn
                    </p>
                    <p className="text-text-primary font-medium truncate">{(f as any).linkedinUrl || 'Não informado'}</p>
                  </div>
                  {(f as any).linkedinUrl && (
                    <a
                      href={(f as any).linkedinUrl.startsWith('http') ? (f as any).linkedinUrl : `https://${(f as any).linkedinUrl}`}
                      target="_blank" rel="noreferrer"
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] p-1.5 px-2.5 rounded-lg flex items-center gap-1 shrink-0"
                    >
                      Abrir <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Instagram */}
                <div className="bg-surface border border-border-subtle p-3 rounded-xl flex justify-between items-center">
                  <div className="truncate pr-3 text-xs">
                    <p className="font-bold text-text-secondary text-[9px] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                      <Instagram className="w-3 h-3" /> Instagram
                    </p>
                    <p className="text-text-primary font-medium truncate">{(f as any).instagramUrl || 'Não informado'}</p>
                  </div>
                  {(f as any).instagramUrl && (
                    <a
                      href={(f as any).instagramUrl.startsWith('http') ? (f as any).instagramUrl : `https://instagram.com/${(f as any).instagramUrl.replace('@','')}`}
                      target="_blank" rel="noreferrer"
                      className="bg-gradient-to-tr from-pink-600 to-orange-400 text-white font-bold text-[10px] p-1.5 px-2.5 rounded-lg flex items-center gap-1 shrink-0"
                    >
                      Abrir <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Portfolio file */}
                {(f as any).portfolioFileName && (
                  <div className="bg-surface border border-border-subtle p-3 rounded-xl flex justify-between items-center">
                    <div className="truncate pr-3 text-xs">
                      <p className="font-bold text-text-secondary text-[9px] uppercase tracking-wider mb-0.5">Arquivo de Portfólio</p>
                      <p className="text-text-primary font-medium truncate">{(f as any).portfolioFileName}</p>
                    </div>
                    {(f as any).portfolioFileUrl && (
                      <a
                        href={(f as any).portfolioFileUrl}
                        target="_blank" rel="noreferrer"
                        className="bg-sidebar-navy hover:bg-sidebar-navy/90 text-white font-bold text-[10px] p-1.5 px-2.5 rounded-lg flex items-center gap-1 shrink-0"
                      >
                        Download <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ALLOCATIONS LIST */}
        {activeTab === 'alocacoes' && (
          <div className="space-y-4">
            <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
              <History className="w-4 h-4 text-text-secondary" />
              <span>Dossiê Histórico de Alocações na Agência ({myAllocations.length})</span>
            </h3>

            {myAllocations.length === 0 ? (
              <div className="text-center py-10 text-text-secondary text-xs italic">
                Nenhuma alocação histórica registrada no banco para este freelancer.
              </div>
            ) : (
              <div className="overflow-x-auto border border-border-subtle rounded-xl">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-surface font-semibold text-text-secondary border-b border-border-subtle">
                    <tr>
                      <th className="px-4 py-2.5">CÓDIGO DE ALOCAÇÃO</th>
                      <th className="px-4 py-2.5">JOB / CLIENTE</th>
                      <th className="px-4 py-2.5">VALOR DIÁRIA</th>
                      <th className="px-4 py-2.5">CRONOGRAMA</th>
                      <th className="px-4 py-2.5">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {myAllocations.map(alloc => {
                      const job = db.jobs.find(j => j.id === alloc.jobId);
                      return (
                        <tr key={alloc.id} className="hover:bg-surface-container-low">
                          <td className="px-4 py-3 font-mono font-bold text-text-primary text-[11px]">
                            {alloc.allocationCode}
                          </td>
                          <td className="px-4 py-3 text-text-primary font-medium">
                            {job?.name} <span className="text-[10px] text-text-secondary">({job?.client})</span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-text-primary">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(alloc.approvedValue)}
                          </td>
                          <td className="px-4 py-3 text-text-secondary">
                            {alloc.startDate} a {alloc.endDate}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold
                              ${alloc.status === 'Ativo' ? 'bg-status-success/10 text-status-success' : 'bg-surface-container-highest text-text-secondary'}`}>
                              {alloc.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: EVALUATIONS WEIGHTED FORM */}
        {activeTab === 'avaliacoes' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
                <Scale className="w-4 h-4 text-text-secondary" />
                <span>Balanço de Notas por Critério Ponderado B2B</span>
              </h3>
              <p className="text-xs text-text-secondary">Indicadores baseados nas ponderações de governança (Média dos índices históricos de avaliações):</p>
            </div>

            {myEvaluations.length === 0 ? (
              <div className="text-center py-10 text-text-secondary text-xs italic">
                Ainda não há notas e pareceres preenchidos para este voluntário no portal.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Visual scorecard grids */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  {/* index 1 */}
                  <div className="bg-surface p-3 rounded-xl border border-border-subtle text-center">
                    <span className="text-[10px] text-text-secondary block font-bold uppercase">Técnica ({getWeightPercentage('técnica')})</span>
                    <span className="text-xl font-bold text-text-primary block mt-1">{getSubIndexAverage('technicalQuality')}</span>
                    <div className="flex justify-center text-status-warning text-[10px] mt-0.5">★★★★★</div>
                  </div>

                  {/* index 2 */}
                  <div className="bg-surface p-3 rounded-xl border border-border-subtle text-center">
                    <span className="text-[10px] text-text-secondary block font-bold uppercase">Prazo ({getWeightPercentage('prazo')})</span>
                    <span className="text-xl font-bold text-text-primary block mt-1">{getSubIndexAverage('deadline')}</span>
                    <div className="flex justify-center text-status-warning text-[10px] mt-0.5">★★★★★</div>
                  </div>

                  {/* index 3 */}
                  <div className="bg-surface p-3 rounded-xl border border-border-subtle text-center">
                    <span className="text-[10px] text-text-secondary block font-bold uppercase">Briefing ({getWeightPercentage('briefing')})</span>
                    <span className="text-xl font-bold text-text-primary block mt-1">{getSubIndexAverage('briefingAdherence')}</span>
                    <div className="flex justify-center text-status-warning text-[10px] mt-0.5">★★★★★</div>
                  </div>

                  {/* index 4 */}
                  <div className="bg-surface p-3 rounded-xl border border-border-subtle text-center">
                    <span className="text-[10px] text-text-secondary block font-bold uppercase">Comunicação ({getWeightPercentage('comunicação')})</span>
                    <span className="text-xl font-bold text-text-primary block mt-1">{getSubIndexAverage('communication')}</span>
                    <div className="flex justify-center text-status-warning text-[10px] mt-0.5">★★★★★</div>
                  </div>

                  {/* index 5 */}
                  <div className="bg-surface p-3 rounded-xl border border-border-subtle text-center">
                    <span className="text-[10px] text-text-secondary block font-bold uppercase">Autonomia ({getWeightPercentage('autonomia')})</span>
                    <span className="text-xl font-bold text-text-primary block mt-1">{getSubIndexAverage('autonomy')}</span>
                    <div className="flex justify-center text-status-warning text-[10px] mt-0.5">★★★★★</div>
                  </div>

                  {/* index 6 */}
                  <div className="bg-surface p-3 rounded-xl border border-border-subtle text-center">
                    <span className="text-[10px] text-text-secondary block font-bold uppercase">Postura ({getWeightPercentage('postura')})</span>
                    <span className="text-xl font-bold text-text-primary block mt-1">{getSubIndexAverage('behavior')}</span>
                    <div className="flex justify-center text-status-warning text-[10px] mt-0.5">★★★★★</div>
                  </div>
                </div>

                {/* Historical feedbacks */}
                <div className="space-y-3 pt-2">
                  <h4 className="font-bold text-text-primary text-xs uppercase tracking-wider text-text-secondary">Pareceres das entregas</h4>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {myEvaluations.map(ev => {
                      const job = db.jobs.find(j => j.id === ev.jobId);
                      return (
                        <div key={ev.id} className="p-3.5 bg-surface border border-border-subtle rounded-xl space-y-1.5">
                          <div className="flex justify-between items-start text-xs">
                            <div>
                              <strong className="text-text-primary">{job?.name || 'Projeto Concluído'}</strong>
                              <p className="text-[10px] text-text-secondary">Execução em {job?.startDate} a {job?.endDate}</p>
                            </div>
                            <span className="font-bold text-status-success bg-status-success/15 px-2.5 py-0.5 rounded-full text-[10px]">
                              Média ponderada: {ev.finalScore.toFixed(2)} ★
                            </span>
                          </div>
                          <p className="text-xs text-text-primary italic leading-relaxed pt-1">&ldquo;{ev.comment}&rdquo;</p>
                          <p className="text-[10px] text-text-secondary pt-1.5 border-t border-dashed border-border-subtle font-medium">Recomendação do avaliador: {ev.recommendation}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {qrModalOpen && qrModalData && (
        <QRCodeModal
          isOpen={qrModalOpen}
          onClose={() => {
            setQrModalOpen(false);
            setQrModalData(null);
          }}
          token={qrModalData.token}
          linkType="update_freelancer"
          freelancerName={f.name}
          expiresAt={qrModalData.expiresAt}
          status="active"
        />
      )}
    </div>
  );
}
