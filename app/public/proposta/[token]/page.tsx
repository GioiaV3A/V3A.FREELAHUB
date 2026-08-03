'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getProposalByTokenAction, submitProposalResponseAction } from '@/app/actions/proposalActions';
import PublicFormLayout from '@/components/PublicFormLayout';
import { CheckCircle2, XCircle, AlertTriangle, FileText, Calendar, Building, User, DollarSign, Send, ShieldAlert } from 'lucide-react';

export default function PublicProposalPage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [proposalData, setProposalData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [responseType, setResponseType] = useState<'accepted' | 'accepted_with_reservations' | 'refused' | null>(null);
  const [refusalReason, setRefusalReason] = useState('');
  const [freelancerNotes, setFreelancerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  useEffect(() => {
    async function loadProposal() {
      if (!token) {
        setErrorMessage('Token de proposta não fornecido.');
        setLoading(false);
        return;
      }

      const res = await getProposalByTokenAction(token);
      if (res && res.success) {
        setProposalData(res);
      } else {
        setErrorMessage(res?.error || 'Não foi possível carregar a proposta.');
      }
      setLoading(false);
    }

    loadProposal();
  }, [token]);

  const handleSubmit = async (type: 'accepted' | 'accepted_with_reservations' | 'refused') => {
    if (type === 'refused' && !refusalReason.trim()) {
      alert('Por favor, informe o motivo da recusa.');
      return;
    }

    setIsSubmitting(true);
    const res = await submitProposalResponseAction({
      token,
      responseType: type,
      refusalReason: type === 'refused' ? refusalReason : undefined,
      freelancerNotes: freelancerNotes.trim() ? freelancerNotes : undefined,
    });

    setIsSubmitting(false);

    if (res.success) {
      setSubmittedSuccess(true);
    } else {
      alert(res.error || 'Erro ao enviar resposta da proposta.');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'A definir';
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  const formatRemuneration = (rm?: string) => {
    if (!rm) return 'Diária';
    const lower = rm.toLowerCase();
    if (lower === 'monthly' || lower === 'monthly_salary') return 'Mensal';
    if (lower === 'hourly') return 'Por Hora';
    if (lower === 'fixed_job') return 'Job Fechado / Por Projeto';
    if (lower === 'daily') return 'Diária';
    return rm;
  };

  return (
    <PublicFormLayout title="Avaliação de Proposta — V3A">
      <div className="max-w-3xl mx-auto space-y-8">
        {loading ? (
          <div className="bg-[#0f172a] border border-white/5 rounded-3xl p-16 text-center text-slate-600 space-y-4 shadow-2xl">
            <div className="inline-block animate-spin w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full shadow-[0_0_15px_rgba(6,182,212,0.5)]" />
            <p className="font-medium text-slate-700 text-lg">Preparando sua proposta oficial...</p>
          </div>
        ) : errorMessage ? (
          <div className="bg-[#0f172a] border border-rose-500/20 rounded-3xl p-10 text-center space-y-5 shadow-2xl">
            <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/30 rounded-full flex items-center justify-center mx-auto text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.15)]">
              <AlertTriangle size={40} />
            </div>
            <h2 className="text-2xl font-bold text-white">Ops! Não foi possível acessar a proposta</h2>
            <p className="text-slate-600 text-base max-w-md mx-auto">{errorMessage}</p>
          </div>
        ) : submittedSuccess ? (
          <div className="bg-gradient-to-b from-[#0f172a] to-[#0A192F] border border-emerald-500/20 rounded-3xl p-12 text-center space-y-6 shadow-[0_20px_50px_-12px_rgba(16,185,129,0.15)]">
            <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">Resposta Registrada!</h2>
            <p className="text-slate-700 max-w-lg mx-auto text-base leading-relaxed font-light">
              Muito obrigado por responder à proposta da V3A. A equipe responsável foi notificada em tempo real e dará andamento aos próximos passos.
            </p>
            <div className="pt-6 mt-2 border-t border-white/5 text-[10px] text-slate-600 font-bold tracking-widest uppercase">
              FREELA HUB | V3A Live Marketing
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Header Badge */}
            <div className="bg-gradient-to-br from-[#0f172a] to-[#131b2e] border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 px-5 py-2 bg-cyan-500 text-[#0f172a] text-[10px] font-black uppercase tracking-widest rounded-bl-2xl shadow-[-5px_5px_15px_rgba(6,182,212,0.2)]">
                Job ID: {proposalData.job_code}
              </div>

              <div className="space-y-4">
                <span className="text-[10px] uppercase tracking-widest font-black text-cyan-400 bg-cyan-950/40 border border-cyan-800/30 px-3 py-1.5 rounded-full inline-flex">
                  Proposta Oficial
                </span>
                <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">{proposalData.job_title}</h1>
                <p className="text-base text-slate-600 flex items-center gap-2.5 font-light">
                  <User size={16} className="text-cyan-500" /> Olá, <strong className="text-white font-bold">{proposalData.freelancer_name}</strong>
                </p>
              </div>
            </div>

            {/* Read-Only Details Card */}
            <div className="bg-[#0f172a] border border-white/5 rounded-3xl p-8 space-y-8 shadow-xl">
              <h3 className="text-xs font-black text-cyan-500 uppercase tracking-widest border-b border-white/5 pb-4">
                Visão Geral do Projeto
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.03]">
                  <div className="p-2.5 bg-slate-50/50 rounded-xl text-slate-700">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-600 block uppercase tracking-widest font-bold mb-0.5">Cliente</span>
                    <strong className="text-slate-800 text-base">{proposalData.client_name}</strong>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.03]">
                  <div className="p-2.5 bg-slate-50/50 rounded-xl text-slate-700">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-600 block uppercase tracking-widest font-bold mb-0.5">Núcleo</span>
                    <strong className="text-slate-800 text-base">{proposalData.nucleo_name}</strong>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.03]">
                  <div className="p-2.5 bg-cyan-950/50 rounded-xl text-cyan-400">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-600 block uppercase tracking-widest font-bold mb-0.5">Período</span>
                    <strong className="text-slate-800 text-base block">{formatDate(proposalData.start_date)}</strong>
                    <strong className="text-slate-800 text-base block">a {formatDate(proposalData.end_date)}</strong>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl bg-gradient-to-br from-emerald-950/30 to-emerald-900/10 border border-emerald-500/20 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]">
                  <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-400/70 block uppercase tracking-widest font-black mb-0.5">Valor Base / Remuneração</span>
                    <strong className="text-emerald-400 text-xl block mb-1">{formatCurrency(proposalData.expected_total_value)}</strong>
                    <span className="text-[11px] text-emerald-100/60 font-semibold uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded inline-block">
                      {formatRemuneration(proposalData.remuneration_model)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description & Scope */}
              {proposalData.description && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">Descrição do Escopo / Atividades</span>
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-200 text-slate-700 text-sm whitespace-pre-line leading-relaxed">
                    {proposalData.description}
                  </div>
                </div>
              )}

              {/* Mandatory Supply Disclaimer */}
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                <span>
                  <strong>⚠️ Aviso Importante:</strong> O pagamento depende da abertura e aprovação da RC pelo núcleo contratante no ERP de Supply, respeitando os prazos e políticas internas.
                </span>
              </div>
            </div>

            {/* Actions Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xl">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-3">
                Sua Resposta à Proposta
              </h3>

              {responseType === 'refused' && (
                <div className="space-y-4 p-4 rounded-xl bg-rose-950/20 border border-rose-500/30">
                  <label className="block text-xs font-semibold text-rose-300 uppercase tracking-wider">
                    Motivo da Recusa *
                  </label>
                  <select
                    className="w-full bg-slate-950 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 focus:outline-none focus:border-rose-500"
                    value={refusalReason}
                    onChange={(e) => setRefusalReason(e.target.value)}
                  >
                    <option value="">Selecione o motivo principal...</option>
                    <option value="Indisponibilidade de agenda no período">Indisponibilidade de agenda no período</option>
                    <option value="Valor proposto abaixo da expectativa">Valor proposto abaixo da expectativa</option>
                    <option value="Conflito de escopo ou modelo de contratação">Conflito de escopo ou modelo de contratação</option>
                    <option value="Motivos pessoais">Motivos pessoais</option>
                    <option value="Outros">Outros</option>
                  </select>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Observações adicionais (opcional)</label>
                    <textarea
                      className="w-full bg-slate-950 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 focus:outline-none focus:border-slate-600"
                      rows={2}
                      placeholder="Detalhes adicionais sobre a recusa..."
                      value={freelancerNotes}
                      onChange={(e) => setFreelancerNotes(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSubmit('refused')}
                      className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30"
                    >
                      <XCircle size={18} /> Confirmar Recusa
                    </button>
                    <button
                      type="button"
                      onClick={() => setResponseType(null)}
                      className="px-4 py-2.5 bg-slate-50 hover:bg-slate-700 text-slate-700 font-medium rounded-xl text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {responseType === 'accepted_with_reservations' && (
                <div className="space-y-4 p-4 rounded-xl bg-amber-950/20 border border-amber-500/30">
                  <label className="block text-xs font-semibold text-amber-300 uppercase tracking-wider">
                    Descreva suas ressalvas de valores ou condições *
                  </label>
                  <textarea
                    className="w-full bg-slate-950 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 focus:outline-none focus:border-amber-500"
                    rows={3}
                    placeholder="Informe sua contraproposta de diária/valor ou observações sobre o período..."
                    value={freelancerNotes}
                    onChange={(e) => setFreelancerNotes(e.target.value)}
                  />

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      disabled={isSubmitting || !freelancerNotes.trim()}
                      onClick={() => handleSubmit('accepted_with_reservations')}
                      className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-900/30 disabled:opacity-50"
                    >
                      <Send size={18} /> Enviar Aceite com Ressalvas
                    </button>
                    <button
                      type="button"
                      onClick={() => setResponseType(null)}
                      className="px-4 py-2.5 bg-slate-50 hover:bg-slate-700 text-slate-700 font-medium rounded-xl text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {responseType === null && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleSubmit('accepted')}
                    className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50"
                  >
                    <CheckCircle2 size={18} /> Aceitar Proposta
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setResponseType('accepted_with_reservations')}
                    className="py-3 px-4 bg-amber-600/90 hover:bg-amber-500 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50"
                  >
                    <FileText size={18} /> Aceitar com Ressalvas
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setResponseType('refused')}
                    className="py-3 px-4 bg-rose-600/90 hover:bg-rose-500 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50"
                  >
                    <XCircle size={18} /> Recusar Proposta
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PublicFormLayout>
  );
}
