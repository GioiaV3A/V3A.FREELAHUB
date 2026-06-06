'use client';

import React, { useState } from 'react';
import { DatabaseProps } from '@/app/page';
import { 
  ClipboardList, 
  Search, 
  Check, 
  X, 
  FileText, 
  AlertTriangle, 
  Building, 
  PhoneCall, 
  Mail, 
  Award,
  HelpCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { generateUniqueId } from '@/lib/utils';
import ScoreStars from './ScoreStars';

export default function SugestoesPanel({ db }: { db: any }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [selectedSuggestion, setSelectedSuggestion] = useState<any | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [complementNotes, setComplementNotes] = useState('');
  const [isComplementModalOpen, setIsComplementModalOpen] = useState(false);

  // Status values mapped to readable Brazilian Portuguese labels
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Pendente de análise RH':
      case 'pendente_analise':
        return 'Pendente de análise RH';
      case 'em_analise':
        return 'Em análise';
      case 'Aprovada':
      case 'aprovado':
      case 'convertido':
        return 'Aprovada / Concluída';
      case 'Rejeitada':
      case 'rejeitado':
        return 'Rejeitada';
      case 'Duplicada':
      case 'duplicado':
        return 'Duplicada';
      case 'complemento_solicitado':
        return 'Complemento Solicitado';
      default:
        return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Pendente de análise RH':
      case 'pendente_analise':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'em_analise':
        return 'bg-blue-50 text-blue-75 border-blue-200';
      case 'Aprovada':
      case 'aprovado':
      case 'convertido':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Rejeitada':
      case 'rejeitado':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Duplicada':
      case 'duplicado':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'complemento_solicitado':
        return 'bg-purple-50 text-purple-75 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const handleApprove = (sug: any) => {
    // Check redundancy
    const isRedundant = db.freelancers.some((f: any) => f.email?.toLowerCase() === sug.email?.toLowerCase());
    if (isRedundant) {
      alert(`O e-mail ${sug.email} já está cadastrado no banco ativo. Marcado como duplicado!`);
      db.setSuggestions((prev: any[]) => prev.map(s => s.id === sug.id ? { ...s, status: 'Duplicada' } : s));
      return;
    }

    // Insert freelancer record
    const newFreela = {
      id: generateUniqueId('free'),
      name: sug.freelancerName,
      email: sug.email,
      whatsapp: sug.whatsapp,
      city: 'São Paulo', // Default
      state: 'SP',
      mainRole: sug.suggestedRole,
      secondaryRoles: [],
      seniority: 'Pleno',
      industries: ['Tecnologia'],
      portfolioUrl: sug.portfolioUrl,
      status: 'Elegível',
      availability: 'Imediata',
      referenceValue: 450,
      averageScore: 0,
      observations: `Aprovado via indicação do núcleo para projeto "${sug.relatedProject}". Justificativa: ${sug.reason}`,
      experienceWithV3A: false
    };

    db.setFreelancers((prev: any[]) => [newFreela, ...prev]);
    
    // Update suggestion status
    db.setSuggestions((prev: any[]) => prev.map(s => s.id === sug.id ? { ...s, status: 'Aprovada' } : s));
    alert(`Sugestão de ${sug.freelancerName} aprovada! Perfil criado com sucesso como 'Elegível'.`);
    setIsDetailsModalOpen(false);
  };

  const handleReject = (sugId: string) => {
    db.setSuggestions((prev: any[]) => prev.map(s => s.id === sugId ? { ...s, status: 'Rejeitada' } : s));
    alert('Indicação rejeitada.');
    setIsDetailsModalOpen(false);
  };

  const handleMarkDuplicate = (sugId: string) => {
    db.setSuggestions((prev: any[]) => prev.map(s => s.id === sugId ? { ...s, status: 'Duplicada' } : s));
    alert('Indicação marcada como duplicada.');
    setIsDetailsModalOpen(false);
  };

  const handleRequestComplement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSuggestion) return;
    if (!complementNotes.trim()) {
      alert('Por favor, informe quais informações adicionais são necessárias.');
      return;
    }

    db.setSuggestions((prev: any[]) => prev.map(s => s.id === selectedSuggestion.id ? { 
      ...s, 
      status: 'complemento_solicitado',
      observations: complementNotes.trim()
    } : s));

    alert('Solicitação de complemento enviada ao núcleo.');
    setIsComplementModalOpen(false);
    setIsDetailsModalOpen(false);
    setComplementNotes('');
  };

  // Filter list
  const filteredSuggestions = db.suggestions.filter((sug: any) => {
    const matchesSearch = 
      sug.freelancerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sug.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sug.suggestedRole?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sug.relatedProject?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = 
      statusFilter === 'todos' || 
      sug.status === statusFilter || 
      (statusFilter === 'pendente_analise' && (sug.status === 'Pendente de análise RH' || sug.status === 'pendente_analise')) ||
      (statusFilter === 'aprovado' && (sug.status === 'Aprovada' || sug.status === 'aprovado' || sug.status === 'convertido')) ||
      (statusFilter === 'rejeitado' && (sug.status === 'Rejeitada' || sug.status === 'rejeitado')) ||
      (statusFilter === 'duplicado' && (sug.status === 'Duplicada' || sug.status === 'duplicado'));

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Homologação de Indicações de Freelancers</h2>
          <p className="text-xs text-text-secondary">Analise pré-cadastros enviados pelos Heads de Núcleo e decida a importação para o banco oficial.</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-border-subtle shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-text-secondary absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail, função ou projeto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-action-cyan bg-slate-50"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto overflow-x-auto no-scrollbar py-1">
          {[
            { value: 'todos', label: 'Todos' },
            { value: 'pendente_analise', label: 'Pendentes' },
            { value: 'complemento_solicitado', label: 'Comp. Solicitado' },
            { value: 'aprovado', label: 'Aprovados' },
            { value: 'rejeitado', label: 'Rejeitados' },
            { value: 'duplicado', label: 'Duplicados' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`p-2 px-3.5 rounded-xl font-bold border transition whitespace-nowrap cursor-pointer
                ${statusFilter === tab.value 
                  ? 'bg-[#0F2342] text-white border-[#0F2342]' 
                  : 'bg-white text-text-secondary border-border-subtle hover:text-text-primary'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Listing Grid */}
      <div className="bg-white rounded-2xl border border-border-subtle shadow-xs overflow-hidden">
        <div className="p-4 bg-surface border-b border-border-subtle flex justify-between items-center">
          <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-text-secondary" />
            <span>Lista de Indicações ({filteredSuggestions.length})</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-surface font-semibold text-text-secondary border-b border-border-subtle">
              <tr>
                <th className="px-6 py-3">PROFISSIONAL / CONTATO</th>
                <th className="px-6 py-3">FUNÇÃO SUGERIDA</th>
                <th className="px-6 py-3">PROJETO RELACIONADO</th>
                <th className="px-6 py-3">INDICADO POR</th>
                <th className="px-6 py-3">STATUS</th>
                <th className="px-6 py-3 text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredSuggestions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-secondary italic">
                    Nenhuma sugestão de freelancer encontrada com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredSuggestions.map((sug: any) => (
                  <tr key={sug.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-text-primary">{sug.freelancerName}</p>
                      <p className="text-[10px] text-text-secondary mt-0.5">{sug.email}</p>
                    </td>
                    <td className="px-6 py-4 font-semibold text-text-primary">
                      {sug.suggestedRole}
                    </td>
                    <td className="px-6 py-4 text-text-secondary font-mono">
                      {sug.relatedProject}
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      {sug.suggestedBy || 'Head'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusClass(sug.status)}`}>
                        {getStatusLabel(sug.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedSuggestion(sug);
                            setIsDetailsModalOpen(true);
                          }}
                          className="bg-slate-50 hover:bg-slate-100 font-bold text-[10px] text-text-primary p-1 px-3 border border-border-subtle rounded-lg"
                        >
                          Ver Detalhes
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {isDetailsModalOpen && selectedSuggestion && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 w-full max-w-lg text-xs animate-scale-up">
            <div className="p-5 bg-sidebar-navy text-white flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <FileText className="w-5 h-5 text-action-cyan" />
                <span>Avaliar Indicação de Freelancer</span>
              </h3>
              <button 
                onClick={() => setIsDetailsModalOpen(false)}
                className="text-white hover:text-action-cyan"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="bg-cyan-50/20 p-4 border border-cyan-150 rounded-2xl flex gap-3 items-center">
                <Sparkles className="w-5 h-5 text-action-cyan animate-pulse shrink-0" />
                <div>
                  <h4 className="font-extrabold text-cyan-900 text-xs uppercase">Sugestão enviada pelo Núcleo</h4>
                  <p className="text-[10px] text-text-secondary mt-0.5">Triagem de talentos para homologação pelo RH da agência.</p>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="bg-slate-50 p-3 rounded-xl border border-border-subtle space-y-1">
                  <span className="text-[10px] font-bold text-text-secondary block">DADOS DO TALENTO</span>
                  <p className="font-bold text-text-primary text-xs">{selectedSuggestion.freelancerName}</p>
                  <p className="text-[10px] text-text-secondary flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" /> {selectedSuggestion.email}</p>
                  {selectedSuggestion.whatsapp && (
                    <p className="text-[10px] text-text-secondary flex items-center gap-1"><PhoneCall className="w-3 h-3 text-slate-400" /> {selectedSuggestion.whatsapp}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-border-subtle">
                    <span className="text-[10px] font-bold text-text-secondary block">FUNÇÃO PROPOSTA</span>
                    <span className="font-bold text-text-primary text-xs mt-1 block">{selectedSuggestion.suggestedRole}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-border-subtle">
                    <span className="text-[10px] font-bold text-text-secondary block">PROJETO DE ORIGEM</span>
                    <span className="font-bold text-text-primary text-xs mt-1 block font-mono text-cyan-700">{selectedSuggestion.relatedProject}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-border-subtle space-y-1.5">
                  <span className="text-[10px] font-bold text-text-secondary block">MOTIVAÇÃO DO NÚCLEO</span>
                  <p className="text-text-primary leading-relaxed italic bg-white p-2.5 rounded-lg border border-slate-100">
                    &ldquo;{selectedSuggestion.reason}&rdquo;
                  </p>
                </div>

                {selectedSuggestion.portfolioUrl && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-border-subtle">
                    <span className="text-[10px] font-bold text-text-secondary block">LINKS E PORTFÓLIO</span>
                    <a 
                      href={selectedSuggestion.portfolioUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-action-cyan hover:underline font-bold text-[11px] mt-1 block truncate"
                    >
                      {selectedSuggestion.portfolioUrl}
                    </a>
                  </div>
                )}

                {selectedSuggestion.observations && (
                  <div className="bg-amber-50/50 p-3 border border-amber-100 rounded-xl">
                    <span className="text-[10px] font-bold text-amber-800 block">OBSERVAÇÕES DO RH / COMPLEMENTOS:</span>
                    <p className="text-amber-900 mt-1 font-semibold leading-relaxed">{selectedSuggestion.observations}</p>
                  </div>
                )}
              </div>

              {/* Status display */}
              <div className="flex items-center justify-between p-3 border border-dashed border-border-subtle rounded-xl">
                <span className="font-bold text-text-secondary">Status atual:</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold border ${getStatusClass(selectedSuggestion.status)}`}>
                  {getStatusLabel(selectedSuggestion.status)}
                </span>
              </div>

              {/* Action buttons (only show if status is pending or complement requested or in analysis) */}
              {(selectedSuggestion.status === 'Pendente de análise RH' || 
                selectedSuggestion.status === 'pendente_analise' || 
                selectedSuggestion.status === 'complemento_solicitado') ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleApprove(selectedSuggestion)}
                    className="bg-status-success text-white font-bold p-2.5 rounded-xl flex items-center justify-center gap-1.5 hover:brightness-95 shadow-sm cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" /> Aprovar
                  </button>
                  
                  <button
                    onClick={() => handleReject(selectedSuggestion.id)}
                    className="bg-status-error text-white font-bold p-2.5 rounded-xl flex items-center justify-center gap-1.5 hover:brightness-95 shadow-sm cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" /> Rejeitar
                  </button>

                  <button
                    onClick={() => handleMarkDuplicate(selectedSuggestion.id)}
                    className="bg-slate-200 text-slate-700 font-bold p-2.5 rounded-xl flex items-center justify-center gap-1 hover:bg-slate-300 transition cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Duplicado
                  </button>

                  <button
                    onClick={() => setIsComplementModalOpen(true)}
                    className="bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold p-2.5 rounded-xl flex items-center justify-center gap-1 transition cursor-pointer border border-purple-200"
                  >
                    <Clock className="w-3.5 h-3.5" /> Complemento
                  </button>
                </div>
              ) : (
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => setIsDetailsModalOpen(false)}
                    className="bg-slate-100 hover:bg-slate-250 text-slate-750 font-bold p-2.5 px-5 rounded-xl transition cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* COMPLEMENT REQUEST MODAL */}
      {isComplementModalOpen && selectedSuggestion && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 w-full max-w-sm text-xs animate-scale-up">
            <div className="p-4 bg-sidebar-navy text-white flex justify-between items-center">
              <h3 className="font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-action-cyan" /> Solicitar Informações Adicionais
              </h3>
              <button 
                onClick={() => setIsComplementModalOpen(false)}
                className="text-white hover:text-action-cyan"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRequestComplement} className="p-5 space-y-4">
              <div>
                <label className="font-bold text-text-secondary block mb-1">Quais informações ou documentos faltam? *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Ex: Faltam as marcas que atendeu anteriormente ou número de telefone de contato válido..."
                  value={complementNotes}
                  onChange={(e) => setComplementNotes(e.target.value)}
                  className="w-full border border-border-subtle p-2.5 rounded-xl text-text-primary focus:outline-none focus:border-action-cyan"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsComplementModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-250 text-slate-750 font-bold p-2 rounded-lg cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="bg-purple-650 bg-purple-600 hover:bg-purple-700 text-white font-extrabold p-2 px-4 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  Solicitar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
