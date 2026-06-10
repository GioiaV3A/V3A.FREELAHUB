'use client';

import React, { use, useEffect, useState } from 'react';
import { validateEvaluationTokenAction, submitReverseEvaluationAction } from '@/app/actions/evaluation';
import { Star, CheckCircle, AlertTriangle, MessageSquare, ShieldCheck, Heart, Sparkles, Send, Loader2 } from 'lucide-react';

export default function PublicReverseEvaluationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [loading, setLoading] = useState(true);
  const [validatingError, setValidatingError] = useState<string | null>(null);
  const [tokenDetails, setTokenDetails] = useState<any>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Form states (1 to 5)
  const [briefingClarity, setBriefingClarity] = useState(5);
  const [scopeAlignment, setScopeAlignment] = useState(5);
  const [directLeadership, setDirectLeadership] = useState(5);
  const [decisionSpeed, setDecisionSpeed] = useState(5);
  const [communication, setCommunication] = useState(5);
  const [projectOrganization, setProjectOrganization] = useState(5);
  const [workingConditions, setWorkingConditions] = useState(5);
  const [administrativeFlow, setAdministrativeFlow] = useState(5);

  // CSAT (1-5)
  const [csatProject, setCsatProject] = useState(5);
  
  // CES (1-5)
  const [cesOperational, setCesOperational] = useState(5);
  
  // NPS (0-10)
  const [npsProject, setNpsProject] = useState(10);
  
  // Observations
  const [observations, setObservations] = useState('');

  // Validate token on mount
  useEffect(() => {
    async function validate() {
      try {
        const res = await validateEvaluationTokenAction(token);
        if (res.success && res.tokenDetails) {
          setTokenDetails(res.tokenDetails);
        } else {
          setValidatingError(res.error || 'Link de avaliação inválido ou expirado.');
        }
      } catch (err) {
        console.error(err);
        setValidatingError('Erro ao conectar ao servidor. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    }
    if (token) {
      validate();
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSubmitting(true);
    try {
      const payload = {
        briefingClarity,
        scopeAlignment,
        directLeadership,
        decisionSpeed,
        communication,
        projectOrganization,
        workingConditions,
        administrativeFlow,
        csatProject,
        cesOperational,
        npsProject,
        observations
      };

      const res = await submitReverseEvaluationAction(token, payload);
      if (res.success) {
        setSubmittedSuccess(true);
      } else {
        alert(res.error || 'Erro ao enviar avaliação.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro inesperado ao enviar avaliação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Star selector helper
  const StarRating = ({ value, onChange }: { value: number, onChange: (v: number) => void }) => {
    return (
      <div className="flex gap-2 justify-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="group focus:outline-none transition cursor-pointer hover:scale-110 active:scale-95"
          >
            <Star 
              className={`w-9 h-9 transition ${
                star <= value 
                  ? 'text-amber-400 fill-amber-400 drop-shadow-sm' 
                  : 'text-slate-600 hover:text-amber-300'
              }`} 
            />
          </button>
        ))}
      </div>
    );
  };

  // CES description helper
  const getCesLabel = (val: number) => {
    switch(val) {
      case 1: return 'Muito Difícil';
      case 2: return 'Difícil';
      case 3: return 'Neutro';
      case 4: return 'Fácil';
      case 5: return 'Muito Fácil';
      default: return 'Fácil';
    }
  };

  // Slider component helper
  const SliderCriterion = ({ 
    label, 
    description, 
    value, 
    onChange 
  }: { 
    label: string, 
    description: string, 
    value: number, 
    onChange: (v: number) => void 
  }) => {
    return (
      <div className="p-4 bg-slate-900/35 border border-slate-800 rounded-2xl space-y-3">
        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <h4 className="font-bold text-slate-200 text-xs sm:text-sm">{label}</h4>
            <p className="text-[10px] sm:text-xs text-slate-400">{description}</p>
          </div>
          <span className="font-black text-sm text-action-cyan bg-action-cyan/10 px-3 py-1 rounded-lg border border-action-cyan/20">
            {value} ★
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-slate-500 font-bold uppercase select-none">1 (Fraco)</span>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-action-cyan"
          />
          <span className="text-[10px] text-slate-500 font-bold uppercase select-none">5 (Excelente)</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070d19] flex flex-col items-center justify-center p-6 text-white font-sans text-xs">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-10 h-10 text-action-cyan animate-spin" />
          <p className="text-slate-400 font-bold">Validando link de avaliação...</p>
        </div>
      </div>
    );
  }

  if (validatingError) {
    return (
      <div className="min-h-screen bg-[#070d19] flex flex-col items-center justify-center p-6 text-white font-sans text-xs">
        <div className="max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
          </div>
          <div className="space-y-2">
            <h3 className="font-extrabold text-slate-200 text-lg">Erro ao Acessar Avaliação</h3>
            <p className="text-slate-400 text-xs leading-relaxed">{validatingError}</p>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-4 font-semibold uppercase tracking-wider">
            V3A Freela Hub B2B
          </div>
        </div>
      </div>
    );
  }

  if (submittedSuccess) {
    return (
      <div className="min-h-screen bg-[#070d19] flex flex-col items-center justify-center p-6 text-white font-sans text-xs">
        <div className="max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <div className="space-y-2">
            <h3 className="font-extrabold text-slate-200 text-lg">Avaliação Enviada!</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Obrigado por compartilhar seu feedback sobre a V3A. Suas respostas foram coletadas de forma 100% anônima e nos ajudam a evoluir nossos núcleos.
            </p>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-4 font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-action-cyan" /> Compliance de Anonimato Ativo
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070d19] text-slate-200 font-sans py-12 px-4 text-xs">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* HEADER BRAND */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-1.5 rounded-full text-[10px] font-bold text-action-cyan uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" /> Avaliação Reversa de Projeto
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Freela Hub V3A</h1>
          <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
            Sua opinião é fundamental para aprimorarmos nossa organização, condições de trabalho e liderança. Este formulário é totalmente <strong>anônimo</strong>.
          </p>
        </div>

        {/* DETAILS CARD */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-4 text-left border-l-4 border-l-action-cyan">
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Campanha / Job</p>
            <h3 className="text-sm font-extrabold text-white mt-0.5">{tokenDetails?.jobTitle}</h3>
            <p className="text-xs text-slate-400 mt-1">Cliente: {tokenDetails?.clientName}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Núcleo & Coordenação</p>
            <h3 className="text-sm font-extrabold text-white mt-0.5">{tokenDetails?.nucleoName}</h3>
            <p className="text-xs text-slate-400 mt-1">Líder Relacionado: {tokenDetails?.leaderName}</p>
          </div>
        </div>

        {/* EVALUATION FORM */}
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-8">
          
          {/* Section 1: 8 sliders */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-action-cyan"></span>
              1. Critérios de Experiência no Projeto
            </h3>

            <div className="grid grid-cols-1 gap-4">
              <SliderCriterion
                label="Clareza do Briefing"
                description="Clareza e precisão nas instruções iniciais, metas e briefings de entrega."
                value={briefingClarity}
                onChange={setBriefingClarity}
              />
              <SliderCriterion
                label="Alinhamento de Escopo"
                description="Equilíbrio entre o que foi combinado previamente na contratação e o que foi solicitado na prática."
                value={scopeAlignment}
                onChange={setScopeAlignment}
              />
              <SliderCriterion
                label="Liderança Direta"
                description="Apoio técnico, feedback e direcionamento fornecidos pelo líder do projeto."
                value={directLeadership}
                onChange={setDirectLeadership}
              />
              <SliderCriterion
                label="Velocidade de Decisão"
                description="Agilidade na validação de etapas e aprovações necessárias para o andamento do trabalho."
                value={decisionSpeed}
                onChange={setDecisionSpeed}
              />
              <SliderCriterion
                label="Comunicação do Núcleo"
                description="Abertura, clareza e agilidade nas respostas durante as trocas de mensagens e reuniões."
                value={communication}
                onChange={setCommunication}
              />
              <SliderCriterion
                label="Organização do Projeto"
                description="Planejamento de cronogramas, organização de materiais de apoio e fluxos operacionais."
                value={projectOrganization}
                onChange={setProjectOrganization}
              />
              <SliderCriterion
                label="Condições de Trabalho"
                description="Infraestrutura, ferramentas fornecidas, ambiente colaborativo e respeito profissional."
                value={workingConditions}
                onChange={setWorkingConditions}
              />
              <SliderCriterion
                label="Fluxo Administrativo B2B"
                description="Facilidade para envio de contratos, nota fiscal, faturamento e clareza no processo financeiro."
                value={administrativeFlow}
                onChange={setAdministrativeFlow}
              />
            </div>
          </div>

          {/* Section 2: CSAT, CES, NPS */}
          <div className="space-y-6 pt-6 border-t border-slate-800">
            <h3 className="text-sm font-extrabold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-action-cyan"></span>
              2. Satisfação Geral & Métricas de Relacionamento
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* CSAT (Satisfação) */}
              <div className="p-5 bg-slate-900/35 border border-slate-800 rounded-2xl space-y-4 text-center">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-200 text-xs sm:text-sm">Satisfação Geral (CSAT)</h4>
                  <p className="text-[10px] text-slate-400">Qual o seu nível de satisfação geral com este job?</p>
                </div>
                <StarRating value={csatProject} onChange={setCsatProject} />
                <div className="text-[11px] font-black text-amber-400 capitalize">
                  {csatProject === 5 ? 'Excelente' : csatProject === 4 ? 'Muito Bom' : csatProject === 3 ? 'Regular' : csatProject === 2 ? 'Ruim' : 'Muito Ruim'}
                </div>
              </div>

              {/* CES (Esforço) */}
              <div className="p-5 bg-slate-900/35 border border-slate-800 rounded-2xl space-y-4 flex flex-col justify-between">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="font-bold text-slate-200 text-xs sm:text-sm">Índice de Esforço (CES)</h4>
                  <p className="text-[10px] text-slate-400">Quão fácil foi realizar seu trabalho operacional e administrativo com o núcleo?</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase">
                    <span>1 (Muito Difícil)</span>
                    <span className="text-action-cyan bg-action-cyan/10 px-2 py-0.5 rounded border border-action-cyan/15 font-black">
                      {getCesLabel(cesOperational)}
                    </span>
                    <span>5 (Muito Fácil)</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={cesOperational}
                    onChange={(e) => setCesOperational(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-action-cyan"
                  />
                </div>
              </div>

            </div>

            {/* NPS (Recomendação) */}
            <div className="p-5 bg-slate-900/35 border border-slate-800 rounded-2xl space-y-4">
              <div className="text-center md:text-left space-y-0.5">
                <h4 className="font-bold text-slate-200 text-xs sm:text-sm">Probabilidade de Recomendação (NPS)</h4>
                <p className="text-[10px] text-slate-400">Qual a probabilidade de você recomendar trabalhar com este núcleo a um colega freelancer?</p>
              </div>

              <div className="flex flex-wrap justify-between gap-1.5 md:flex-nowrap">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setNpsProject(score)}
                    className={`flex-1 h-9 rounded-xl font-black transition text-xs border cursor-pointer
                      ${npsProject === score 
                        ? 'bg-action-cyan border-action-cyan text-slate-900 scale-105 shadow-md shadow-action-cyan/10' 
                        : 'bg-slate-950/45 border-slate-800 text-slate-400 hover:border-slate-600'
                      }
                    `}
                  >
                    {score}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                <span>0 (Jamais recomendaria)</span>
                <span>10 (Recomendaria com certeza)</span>
              </div>
            </div>

            {/* Suggestions / Observations */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-350 block flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-action-cyan" />
                Comentários ou Sugestões de Melhoria (Opcional):
              </label>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Compartilhe feedbacks livres ou observações sobre o projeto. Não se preocupe, suas observações não serão associadas ao seu nome."
                rows={4}
                className="w-full bg-slate-950/65 border border-slate-800 rounded-2xl p-3 outline-none focus:border-action-cyan/45 text-slate-200 font-medium"
              />
            </div>

          </div>

          {/* Submit */}
          <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Sua avaliação é anônima e segura
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-3.5 bg-action-cyan hover:bg-cyan-400 text-slate-900 font-black rounded-xl text-xs uppercase tracking-widest transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Enviar Avaliação Anônima
                </>
              )}
            </button>
          </div>

        </form>

        {/* footer */}
        <div className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-wider py-4 border-t border-slate-900">
          V3A Freela Hub &bull; Portal de Governança e Qualidade
        </div>

      </div>
    </div>
  );
}
