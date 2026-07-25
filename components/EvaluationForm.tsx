'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DatabaseProps } from '@/app/page';
import { 
  Award, Star, ClipboardCheck, AlertTriangle, ShieldCheck, Scale, 
  ArrowRight, Copy, Check, QrCode, RefreshCw, Printer, AlertCircle, FileText
} from 'lucide-react';
import { submitLeaderEvaluationAction } from '@/app/actions/evaluation';
import QRCode from 'qrcode';

export default function EvaluationForm({ db }: { db: DatabaseProps }) {
  const [selectedAllocationId, setSelectedAllocationId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluationToken, setEvaluationToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const successCanvasRef = useRef<HTMLCanvasElement>(null);

  // Form criteria states (1 to 5)
  const [technicalQuality, setTechnicalQuality] = useState(5); // 25%
  const [briefingAdherence, setBriefingAdherence] = useState(5);// 15%
  const [deadline, setDeadline] = useState(5);                 // 15%
  const [autonomy, setAutonomy] = useState(5);                 // 10%
  const [communication, setCommunication] = useState(5);        // 10%
  const [behavior, setBehavior] = useState(5);                 // 10%
  const [collaboration, setCollaboration] = useState(5);        // 5%
  const [flexibility, setFlexibility] = useState(5);            // 5%
  const [costBenefit, setCostBenefit] = useState(5);            // 5%

  // Additional questions
  const [comment, setComment] = useState('');
  const [recommendation, setRecommendation] = useState<'Sim' | 'Sim, com restrição' | 'Não'>('Sim');
  const [wouldHireAgain, setWouldHireAgain] = useState<'sim' | 'talvez' | 'nao'>('sim');
  const [reworkLevel, setReworkLevel] = useState<'nao' | 'baixa' | 'media' | 'alta'>('nao');
  const [criticalProblem, setCriticalProblem] = useState(false);
  const [criticalProblemDetails, setCriticalProblemDetails] = useState('');

  // Conditional answers states
  const [techIssues, setTechIssues] = useState<string[]>([]);
  const [techIssueOther, setTechIssueOther] = useState('');
  const [behaviorIssues, setBehaviorIssues] = useState<string[]>([]);
  const [behaviorIssueOther, setBehaviorIssueOther] = useState('');
  
  const [restrictionType, setRestrictionType] = useState<'Técnica' | 'Comportamental' | 'Prazos' | 'Outros'>('Técnica');
  const [restrictionScope, setRestrictionScope] = useState<'Apenas para este núcleo' | 'Para toda a V3A'>('Apenas para este núcleo');
  const [restrictionJustification, setRestrictionJustification] = useState('');

  const selectedAlloc = db.allocations.find(a => a.id === selectedAllocationId);
  const selectedJob = selectedAlloc ? db.jobs.find(j => j.id === selectedAlloc.jobId) : null;
  const selectedFreela = selectedAlloc ? db.freelancers.find(f => f.id === selectedAlloc.freelancerId) : null;

  // Render QR Code when success screen is active
  useEffect(() => {
    if (evaluationToken && successCanvasRef.current) {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${origin}/public/avaliacao/${evaluationToken}`;
      QRCode.toCanvas(
        successCanvasRef.current,
        url,
        {
          width: 180,
          margin: 1,
          color: {
            dark: '#0A192F', // matching V3A dark navy
            light: '#FFFFFF'
          }
        },
        (error) => {
          if (error) console.error('Error generating reverse evaluation QR Code:', error);
        }
      );
    }
  }, [evaluationToken]);

  // Filter allocations that are pending evaluation
  const pendingCodes = db.paymentCodes.filter(c => c.paymentStatus === 'Aguardando avaliação');

  // Real-time score calculations
  const calculateScores = () => {
    const weightedAvg = 
      (technicalQuality * 0.25) +
      (briefingAdherence * 0.15) +
      (deadline * 0.15) +
      (autonomy * 0.10) +
      (communication * 0.10) +
      (behavior * 0.10) +
      (collaboration * 0.05) +
      (flexibility * 0.05) +
      (costBenefit * 0.05);

    // Scaled 0-100
    const score0to100 = ((weightedAvg - 1) / 4) * 100;
    
    // Status color and label based on consolidated score
    let statusLabel = 'Elegível';
    let statusColor = 'text-blue-500 bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30';
    let statusBadgeColor = 'bg-blue-500';

    if (score0to100 >= 90) {
      statusLabel = 'Preferencial';
      statusColor = 'text-emerald-500 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30';
      statusBadgeColor = 'bg-emerald-500';
    } else if (score0to100 >= 80) {
      statusLabel = 'Recomendado';
      statusColor = 'text-teal-500 bg-teal-50 border-teal-100 dark:bg-teal-950/20 dark:border-teal-900/30';
      statusBadgeColor = 'bg-teal-500';
    } else if (score0to100 >= 65) {
      statusLabel = 'Elegível';
      statusColor = 'text-blue-500 bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30';
      statusBadgeColor = 'bg-blue-500';
    } else if (score0to100 >= 50) {
      statusLabel = 'Em observação';
      statusColor = 'text-amber-500 bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30';
      statusBadgeColor = 'bg-amber-500';
    } else if (score0to100 >= 35) {
      statusLabel = 'Restrito';
      statusColor = 'text-orange-500 bg-orange-50 border-orange-100 dark:bg-orange-950/20 dark:border-orange-900/30';
      statusBadgeColor = 'bg-orange-500';
    } else {
      statusLabel = 'Não recomendado';
      statusColor = 'text-rose-500 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30';
      statusBadgeColor = 'bg-rose-500';
    }

    return {
      average: Number(weightedAvg.toFixed(2)),
      score: Number(score0to100.toFixed(1)),
      label: statusLabel,
      colorClass: statusColor,
      badgeColor: statusBadgeColor
    };
  };

  const currentScores = calculateScores();

  const handleOpenEvaluate = (allocId: string) => {
    setSelectedAllocationId(allocId);
    setEvaluationToken(null);
    setTechnicalQuality(5);
    setBriefingAdherence(5);
    setDeadline(5);
    setAutonomy(5);
    setCommunication(5);
    setBehavior(5);
    setCollaboration(5);
    setFlexibility(5);
    setCostBenefit(5);
    setComment('');
    setRecommendation('Sim');
    setWouldHireAgain('sim');
    setReworkLevel('nao');
    setCriticalProblem(false);
    setCriticalProblemDetails('');
    setTechIssues([]);
    setTechIssueOther('');
    setBehaviorIssues([]);
    setBehaviorIssueOther('');
    setRestrictionJustification('');
  };

  // Toggle checklist values
  const toggleTechIssue = (val: string) => {
    setTechIssues(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
  };

  const toggleBehaviorIssue = (val: string) => {
    setBehaviorIssues(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
  };

  const handleCopyLink = () => {
    if (evaluationToken) {
      const origin = window.location.origin;
      const url = `${origin}/public/avaliacao/${evaluationToken}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrintQRCode = () => {
    const canvas = successCanvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - Avaliação Reversa</title>
          <style>
            body {
              font-family: sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background-color: white;
            }
            .card {
              border: 2px solid #0A192F;
              border-radius: 20px;
              padding: 30px;
              text-align: center;
              max-width: 400px;
            }
            img {
              width: 200px;
              height: 200px;
              margin: 20px 0;
            }
            h1 { font-size: 20px; color: #0A192F; margin: 0; }
            p { font-size: 13px; color: #4A5568; }
            .footer { font-size: 10px; color: #718096; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Avaliação Reversa - Freela Hub</h1>
            <p>Escaneie o QR Code abaixo para responder anonimamente sobre sua experiência no projeto.</p>
            <img src="${dataUrl}" />
            <p><strong>Freelancer:</strong> ${selectedFreela?.name || ''}</p>
            <p><strong>Job:</strong> ${selectedJob?.name || ''}</p>
            <div class="footer">Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlloc) return;

    // Validate conditional mandatory questions
    if (technicalQuality <= 2) {
      if (techIssues.length === 0 && !techIssueOther.trim()) {
        alert('Por favor, indique o que comprometeu a qualidade técnica.');
        return;
      }
    }
    if (behavior <= 2) {
      if (behaviorIssues.length === 0 && !behaviorIssueOther.trim()) {
        alert('Por favor, indique qual foi o problema comportamental observado.');
        return;
      }
    }
    if (recommendation !== 'Sim') {
      if (!restrictionJustification.trim() || restrictionJustification.length < 15) {
        alert('Por favor, insira uma justificativa detalhada para a restrição/rejeição (mínimo 15 caracteres).');
        return;
      }
    }
    if (criticalProblem && !criticalProblemDetails.trim()) {
      alert('Por favor, descreva os detalhes do problema crítico.');
      return;
    }

    setIsSubmitting(true);

    // Prepare conditional answers payload
    const conditionalAnswers: any = {};
    if (technicalQuality <= 2) {
      conditionalAnswers.technical_quality_reasons = {
        options: techIssues,
        other: techIssueOther
      };
    }
    if (behavior <= 2) {
      conditionalAnswers.behavior_reasons = {
        options: behaviorIssues,
        other: behaviorIssueOther
      };
    }
    if (recommendation !== 'Sim') {
      conditionalAnswers.restriction_details = {
        type: restrictionType,
        scope: restrictionScope,
        justification: restrictionJustification
      };
    }
    if (criticalProblem) {
      conditionalAnswers.critical_problem_details = criticalProblemDetails;
    }

    const evaluationPayload = {
      evaluatorId: db.currentUser.id,
      evaluatorRole: db.currentUser.profile?.toLowerCase() === 'master' ? 'master' : 'nucleo',
      technicalQuality,
      briefingAdherence,
      deadline,
      autonomy,
      communication,
      behavior,
      collaboration,
      flexibility,
      costBenefit,
      comment,
      recommendation,
      wouldHireAgain,
      reworkLevel,
      criticalProblem,
      conditionalAnswers
    };

    try {
      const result = (await submitLeaderEvaluationAction(selectedAlloc.id, evaluationPayload)) as any;

      if (result.success && result.reverseToken) {
        setEvaluationToken(result.reverseToken);
        // Refresh global state so statuses update
        await db.reloadDatabase();
      } else {
        alert(`Erro ao registrar avaliação: ${result.error || 'Erro desconhecido'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Ocorreu um erro no servidor ao registrar a avaliação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Star selector component
  const RatingSelector = ({ value, onChange }: { value: number, onChange: (v: number) => void }) => {
    return (
      <div className="flex gap-1.5 select-none">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition border cursor-pointer
              ${star <= value 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 dark:bg-amber-500/20' 
                : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-800'
              }
              hover:scale-105 active:scale-95
            `}
          >
            {star}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 font-sans text-xs">
      {/* Banner */}
      <div className="bg-sidebar-navy text-white p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-[#1e293b]">
        <div className="space-y-1">
          <h3 className="font-bold text-sm text-action-cyan uppercase tracking-widest flex items-center gap-2">
            <Award className="w-4 h-4" /> Governança & Avaliação 360°
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed font-medium">
            Avalie o profissional em 9 critérios para liberar o faturamento. O freela também receberá um link anônimo para avaliar o núcleo.
          </p>
        </div>
        <div className="shrink-0 bg-white/15 p-2 px-3 border border-white/10 rounded-xl flex items-center gap-1.5 text-xs font-bold">
          <ShieldCheck className="w-4 h-4 text-action-cyan" /> Pagamento Vinculado à Avaliação
        </div>
      </div>

      {!selectedAllocationId ? (
        /* LIST OF PENDING EVALUATIONS */
        <div className="bg-white dark:bg-[#0d1627] border border-slate-150 dark:border-slate-850 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-150 dark:border-slate-850 flex justify-between items-center">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Profissionais Aguardando Avaliação</h4>
            <span className="text-slate-500 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
              {pendingCodes.length} pendências
            </span>
          </div>

          <div className="overflow-x-auto">
            {pendingCodes.length === 0 ? (
              <div className="p-12 text-center text-slate-500 italic">
                Nenhum profissional com status &ldquo;Aguardando avaliação&rdquo;.
              </div>
            ) : (
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-900/30 text-slate-500 font-bold border-b border-slate-150 dark:border-slate-850">
                  <tr>
                    <th className="px-4 py-3">Código Alocação</th>
                    <th className="px-4 py-3">Profissional</th>
                    <th className="px-4 py-3">Job / Projeto</th>
                    <th className="px-4 py-3">Período</th>
                    <th className="px-4 py-3">Taxa / Valor</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {pendingCodes.map((code) => {
                    const alloc = db.allocations.find(a => a.allocationCode === code.allocationCode);
                    const freela = db.freelancers.find(f => f.id === code.freelancerId);
                    const job = db.jobs.find(j => j.id === code.jobId);
                    
                    if (!alloc) return null;

                    return (
                      <tr key={code.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors">
                        <td className="px-4 py-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {code.allocationCode}
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-850 dark:text-slate-100">
                          {freela?.name || 'Carregando...'}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{job?.name || 'Job'}</div>
                          <div className="text-[10px] text-slate-500">Cliente: {job?.client || 'N/A'}</div>
                        </td>
                        <td className="px-4 py-4 text-slate-600 dark:text-slate-400 font-medium">
                          {alloc.startDate ? alloc.startDate.split('T')[0].split('-').reverse().join('/') : ''} a {alloc.endDate ? alloc.endDate.split('T')[0].split('-').reverse().join('/') : ''}
                        </td>
                        <td className="px-4 py-4 font-bold text-slate-800 dark:text-slate-100">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(code.approvedValue)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => handleOpenEvaluate(alloc.id)}
                            className="bg-status-error hover:bg-status-error-dark text-white font-extrabold p-2 px-3.5 rounded-xl flex items-center gap-1.5 inline-flex shadow-2xs hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" /> Avaliar & Desbloquear
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : evaluationToken ? (
        /* SUCCESS SCREEN WITH PUBLIC LINK & QR CODE */
        <div className="bg-white dark:bg-[#0d1627] border border-slate-150 dark:border-slate-850 rounded-2xl p-6 shadow-sm space-y-6 max-w-2xl mx-auto animate-fade-in">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/50">
              <Check className="w-7 h-7 text-emerald-500" />
            </div>
            <h3 className="font-extrabold text-lg text-slate-800 dark:text-slate-200">Avaliação Enviada com Sucesso!</h3>
            <p className="text-slate-500 max-w-md">
              A avaliação do profissional foi registrada e o código de faturamento <strong>{selectedAlloc?.allocationCode}</strong> foi desbloqueado no financeiro.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-50 dark:bg-slate-900/30 p-5 rounded-2xl border border-slate-100 dark:border-slate-850 items-center">
            {/* Left Col: QR Code */}
            <div className="md:col-span-5 flex flex-col items-center space-y-2.5">
              <div className="p-3 bg-white rounded-xl shadow-2xs border border-slate-100">
                <canvas ref={successCanvasRef} className="block" />
              </div>
              <button
                onClick={handlePrintQRCode}
                className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-bold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimir QR Code
              </button>
            </div>

            {/* Right Col: Details & Link */}
            <div className="md:col-span-7 space-y-4 text-left">
              <div>
                <h5 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Link de Avaliação Reversa</h5>
                <p className="text-slate-500 mt-1">
                  Compartilhe este link de token único com o freelancer para que ele avalie anonimamente o projeto/núcleo.
                </p>
              </div>

              <div className="flex items-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden pr-2">
                <input
                  type="text"
                  readOnly
                  value={typeof window !== 'undefined' ? `${window.location.origin}/public/avaliacao/${evaluationToken}` : ''}
                  className="flex-1 bg-transparent p-3 outline-none font-mono text-[10px] text-slate-600 dark:text-slate-400 truncate border-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="p-2 bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg shadow-3xs shrink-0 cursor-pointer"
                  title="Copiar Link"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex gap-2">
                <a
                  href={typeof window !== 'undefined' ? `/public/avaliacao/${evaluationToken}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-slate-800 dark:bg-slate-200 dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 text-white font-extrabold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition text-center"
                >
                  Visualizar Formulário <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          <div className="flex justify-center border-t border-slate-100 dark:border-slate-850 pt-4">
            <button
              onClick={() => setSelectedAllocationId(null)}
              className="bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold py-2.5 px-6 rounded-xl transition cursor-pointer"
            >
              Voltar para a Lista
            </button>
          </div>
        </div>
      ) : (
        /* DETAILED EVALUATION FORM */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start animate-fade-in">
          {/* Left Column: Form Inputs */}
          <div className="xl:col-span-8 bg-white dark:bg-[#0d1627] border border-slate-150 dark:border-slate-850 rounded-2xl p-5 shadow-xs space-y-6">
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-850 pb-3">
              <div>
                <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4 text-status-error" />
                  <span>Formulário de Avaliação Pós-Job</span>
                </h4>
                <p className="text-[10px] text-slate-500 mt-1">
                  Profissional: <span className="font-bold text-slate-700 dark:text-slate-350">{selectedFreela?.name}</span> &bull; 
                  Campanha: <span className="font-bold text-slate-700 dark:text-slate-350">{selectedJob?.name}</span>
                </p>
              </div>
              <button 
                onClick={() => setSelectedAllocationId(null)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-extrabold text-sm p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Criterion 9 WEIGHTED GROUP */}
              <div className="space-y-4">
                <h5 className="font-extrabold text-slate-800 dark:text-slate-200 border-b border-slate-50 dark:border-slate-900 pb-1 flex items-center gap-1.5 text-xs">
                  <Scale className="w-3.5 h-3.5 text-action-cyan" /> 1. Critérios de Desempenho Ponderados
                </h5>

                {/* Qualidade Técnica */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-850/50">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Qualidade Técnica</span>
                      <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-extrabold px-2 py-0.5 rounded-full text-[9px]">Peso: 25%</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Nível técnico, refino estético e precisão da entrega.</p>
                  </div>
                  <RatingSelector value={technicalQuality} onChange={setTechnicalQuality} />
                </div>

                {/* Conditional Tech Quality Issues */}
                {technicalQuality <= 2 && (
                  <div className="p-4 bg-rose-50/50 dark:bg-rose-950/10 rounded-xl border border-rose-100 dark:border-rose-900/20 space-y-3 animate-fade-in">
                    <label className="font-bold text-rose-700 dark:text-rose-400 block">
                      <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                      O que comprometeu a qualidade técnica? <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                      {[
                        'Erros técnicos ou de execução frequentes',
                        'Entregas parciais / incompletas',
                        'Falta de acabamento ou refino estético',
                        'Desvio grave do briefing/escopo solicitado'
                      ].map((issue) => (
                        <label key={issue} className="flex items-center gap-2 font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={techIssues.includes(issue)}
                            onChange={() => toggleTechIssue(issue)}
                            className="rounded-sm text-status-error"
                          />
                          <span>{issue}</span>
                        </label>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 dark:text-slate-400 block">Outro motivo técnico:</label>
                      <input
                        type="text"
                        value={techIssueOther}
                        onChange={(e) => setTechIssueOther(e.target.value)}
                        placeholder="Especifique o motivo..."
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none focus:border-status-error/45 text-xs text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </div>
                )}

                {/* Aderência ao Briefing */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-850/50">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Aderência ao Briefing</span>
                      <span className="bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-extrabold px-2 py-0.5 rounded-full text-[9px]">Peso: 15%</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Respeito às diretrizes, escopo e restrições do job.</p>
                  </div>
                  <RatingSelector value={briefingAdherence} onChange={setBriefingAdherence} />
                </div>

                {/* Cumprimento de Prazos */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-850/50">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Cumprimento de Prazos</span>
                      <span className="bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-extrabold px-2 py-0.5 rounded-full text-[9px]">Peso: 15%</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Pontualidade nas entregas parciais e final.</p>
                  </div>
                  <RatingSelector value={deadline} onChange={setDeadline} />
                </div>

                {/* Autonomia */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-850/50">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Autonomia</span>
                      <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-extrabold px-2 py-0.5 rounded-full text-[9px]">Peso: 10%</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Resolução independente de problemas sem microgestão.</p>
                  </div>
                  <RatingSelector value={autonomy} onChange={setAutonomy} />
                </div>

                {/* Comunicação */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-850/50">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Comunicação</span>
                      <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-extrabold px-2 py-0.5 rounded-full text-[9px]">Peso: 10%</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Clareza, agilidade nas respostas e proatividade no contato.</p>
                  </div>
                  <RatingSelector value={communication} onChange={setCommunication} />
                </div>

                {/* Postura e Comportamento */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-850/50">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Postura e Comportamento</span>
                      <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-extrabold px-2 py-0.5 rounded-full text-[9px]">Peso: 10%</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Profissionalismo, respeito com a equipe e postura corporativa.</p>
                  </div>
                  <RatingSelector value={behavior} onChange={setBehavior} />
                </div>

                {/* Conditional Behavior Issues */}
                {behavior <= 2 && (
                  <div className="p-4 bg-rose-50/50 dark:bg-rose-950/10 rounded-xl border border-rose-100 dark:border-rose-900/20 space-y-3 animate-fade-in">
                    <label className="font-bold text-rose-700 dark:text-rose-400 block">
                      <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                      Qual foi o problema comportamental observado? <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                      {[
                        'Falta de postura profissional / postura inadequada',
                        'Conflitos ou atritos com a equipe de coordenação',
                        'Inflexibilidade / recusa em seguir instruções',
                        'Atrasos ou sumiços sem dar retorno'
                      ].map((issue) => (
                        <label key={issue} className="flex items-center gap-2 font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={behaviorIssues.includes(issue)}
                            onChange={() => toggleBehaviorIssue(issue)}
                            className="rounded-sm text-status-error"
                          />
                          <span>{issue}</span>
                        </label>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 dark:text-slate-400 block">Outro motivo comportamental:</label>
                      <input
                        type="text"
                        value={behaviorIssueOther}
                        onChange={(e) => setBehaviorIssueOther(e.target.value)}
                        placeholder="Especifique o comportamento..."
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none focus:border-status-error/45 text-xs text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </div>
                )}

                {/* Colaboração */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-850/50">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Colaboração</span>
                      <span className="bg-slate-200 dark:bg-slate-850 text-slate-500 font-extrabold px-2 py-0.5 rounded-full text-[9px]">Peso: 5%</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Facilidade de trabalhar em equipe e apoiar colegas.</p>
                  </div>
                  <RatingSelector value={collaboration} onChange={setCollaboration} />
                </div>

                {/* Flexibilidade */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-850/50">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Flexibilidade</span>
                      <span className="bg-slate-200 dark:bg-slate-850 text-slate-500 font-extrabold px-2 py-0.5 rounded-full text-[9px]">Peso: 5%</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Adaptação a eventuais mudanças razoáveis de escopo.</p>
                  </div>
                  <RatingSelector value={flexibility} onChange={setFlexibility} />
                </div>

                {/* Custo-benefício */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-850/50">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Custo-benefício</span>
                      <span className="bg-slate-200 dark:bg-slate-850 text-slate-500 font-extrabold px-2 py-0.5 rounded-full text-[9px]">Peso: 5%</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Retorno em valor da entrega frente à taxa cobrada.</p>
                  </div>
                  <RatingSelector value={costBenefit} onChange={setCostBenefit} />
                </div>

              </div>

              {/* SECTION 2: ADITIONAL OPERATIONAL QUESTIONS */}
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-850">
                <h5 className="font-extrabold text-slate-800 dark:text-slate-200 pb-1 flex items-center gap-1.5 text-xs">
                  <FileText className="w-3.5 h-3.5 text-action-cyan" /> 2. Aspectos Operacionais & Faturamento
                </h5>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Rework Level */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">Nível de Refação:</label>
                    <select
                      value={reworkLevel}
                      onChange={(e: any) => setReworkLevel(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl p-2.5 outline-none focus:border-action-cyan/45 text-xs font-semibold text-slate-800 dark:text-slate-250 cursor-pointer"
                    >
                      <option value="nao">Não houve refação significativa</option>
                      <option value="baixa">Refação baixa (ajustes pontuais)</option>
                      <option value="media">Refação média (múltiplas rodadas de alteração)</option>
                      <option value="alta">Refação alta (retrabalho completo de peças)</option>
                    </select>
                  </div>

                  {/* Would hire again */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">Recontrataria este profissional?</label>
                    <select
                      value={wouldHireAgain}
                      onChange={(e: any) => setWouldHireAgain(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl p-2.5 outline-none focus:border-action-cyan/45 text-xs font-semibold text-slate-800 dark:text-slate-250 cursor-pointer"
                    >
                      <option value="sim">Sim, com certeza</option>
                      <option value="talvez">Talvez, dependendo da demanda</option>
                      <option value="nao">Não recomendo</option>
                    </select>
                  </div>
                </div>

                {/* Recommendation Selector */}
                <div className="space-y-2.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">Recomendação Geral de Governança:</label>
                  <div className="flex gap-4">
                    {['Sim', 'Sim, com restrição', 'Não'].map((recOption) => (
                      <label key={recOption} className="flex items-center gap-1.5 font-bold cursor-pointer text-slate-750 dark:text-slate-300">
                        <input
                          type="radio"
                          name="recommendation"
                          checked={recommendation === recOption}
                          onChange={() => setRecommendation(recOption as any)}
                          className="text-status-error focus:ring-0"
                        />
                        <span>{recOption}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Conditional Recommendation/Restriction Justification */}
                {recommendation !== 'Sim' && (
                  <div className="p-4 bg-orange-50/40 dark:bg-orange-950/10 rounded-xl border border-orange-100 dark:border-orange-900/20 space-y-4 animate-fade-in">
                    <label className="font-bold text-orange-700 dark:text-orange-400 block">
                      <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                      Justificativa da Restrição ou Não Recomendação <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 block">Tipo de Restrição:</label>
                        <select
                          value={restrictionType}
                          onChange={(e: any) => setRestrictionType(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 outline-none text-xs cursor-pointer text-slate-800 dark:text-slate-200"
                        >
                          <option value="Técnica">Técnica</option>
                          <option value="Comportamental">Comportamental</option>
                          <option value="Prazos">Prazos</option>
                          <option value="Outros">Outros</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 block">Escopo da Restrição:</label>
                        <select
                          value={restrictionScope}
                          onChange={(e: any) => setRestrictionScope(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 outline-none text-xs cursor-pointer text-slate-800 dark:text-slate-200"
                        >
                          <option value="Apenas para este núcleo">Apenas para este núcleo ({selectedJob?.nucleoId ? db.nucleos.find(n=>n.id===selectedJob.nucleoId)?.name : 'Meu Núcleo'})</option>
                          <option value="Para toda a V3A">Bloqueio para toda a V3A</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 block">Justificativa Detalhada (Mínimo 15 caracteres):</label>
                      <textarea
                        value={restrictionJustification}
                        onChange={(e) => setRestrictionJustification(e.target.value)}
                        placeholder="Explique o motivo pelo qual este profissional possui restrições para novos agendamentos..."
                        rows={3}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none focus:border-orange-500/40 text-xs text-slate-800 dark:text-slate-200 font-medium"
                      />
                    </div>
                  </div>
                )}

                {/* Critical Problem Checkbox */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 font-bold cursor-pointer text-slate-850 dark:text-slate-250">
                    <input
                      type="checkbox"
                      checked={criticalProblem}
                      onChange={(e) => setCriticalProblem(e.target.checked)}
                      className="rounded-sm text-status-error focus:ring-0"
                    />
                    <span>Ocorreu algum problema crítico (ex: vazamento de dados, conduta inapropriada grave)?</span>
                  </label>
                  
                  {criticalProblem && (
                    <div className="space-y-1 animate-fade-in">
                      <label className="text-[10px] text-rose-500 font-bold block">Descreva os detalhes do problema crítico: *</label>
                      <textarea
                        value={criticalProblemDetails}
                        onChange={(e) => setCriticalProblemDetails(e.target.value)}
                        placeholder="Forneça detalhes precisos sobre o incidente ocorrido..."
                        rows={3}
                        className="w-full bg-slate-50 border-2 border-rose-200 dark:bg-slate-900 dark:border-rose-950/30 rounded-xl p-2.5 outline-none focus:border-rose-500 text-xs text-slate-850 dark:text-slate-100 font-medium"
                      />
                    </div>
                  )}
                </div>

                {/* General Comment */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">Observações & Feedback Geral:</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Deixe uma nota de avaliação livre sobre o desempenho do freelancer..."
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl p-3 outline-none focus:border-action-cyan/45 text-xs text-slate-850 dark:text-slate-200 font-medium"
                  />
                </div>
              </div>

              {/* ACTION ACTIONS */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-850 flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-status-error hover:bg-status-error-dark text-white font-extrabold py-3 rounded-xl flex items-center justify-center gap-1.5 transition text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Registrando...
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="w-4 h-4" /> Finalizar Avaliação & Liberar Pagamento
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Score Display & Policy Rules Card */}
          <div className="xl:col-span-4 space-y-6 self-start">
            {/* SCORE DISPLAY CARD */}
            <div className="bg-[#0b1322] text-white p-5 rounded-2xl border border-slate-850 space-y-4">
              <h5 className="font-bold text-xs uppercase tracking-wider text-slate-400">Score da Avaliação Atual</h5>
              
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full border-4 border-slate-800 flex flex-col items-center justify-center bg-slate-900/50 shadow-inner">
                  <span className="text-2xl font-black text-white">{currentScores.score}</span>
                  <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Score</span>
                </div>

                <div className="space-y-1 flex-1">
                  <p className="text-[10px] text-slate-400 font-bold">Média Ponderada: <span className="text-white">{currentScores.average} / 5.0</span></p>
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-extrabold border ${currentScores.colorClass}`}>
                    <span className={`w-2 h-2 rounded-full mr-1.5 ${currentScores.badgeColor}`}></span>
                    {currentScores.label}
                  </div>
                </div>
              </div>

              {/* Weight list breakdown summary */}
              <div className="space-y-1.5 bg-slate-900/35 border border-slate-850 p-3 rounded-xl text-[10px] text-slate-400 font-medium">
                <div className="flex justify-between">
                  <span>Qualidade Técnica (25%)</span>
                  <span className="font-bold text-slate-200">{technicalQuality}</span>
                </div>
                <div className="flex justify-between">
                  <span>Aderência ao Briefing (15%)</span>
                  <span className="font-bold text-slate-200">{briefingAdherence}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cumprimento de Prazos (15%)</span>
                  <span className="font-bold text-slate-200">{deadline}</span>
                </div>
                <div className="flex justify-between">
                  <span>Autonomia (10%)</span>
                  <span className="font-bold text-slate-200">{autonomy}</span>
                </div>
                <div className="flex justify-between">
                  <span>Comunicação (10%)</span>
                  <span className="font-bold text-slate-200">{communication}</span>
                </div>
                <div className="flex justify-between">
                  <span>Postura e Comportamento (10%)</span>
                  <span className="font-bold text-slate-200">{behavior}</span>
                </div>
                <div className="flex justify-between">
                  <span>Colaboração / Flexibilidade / Cust. (15%)</span>
                  <span className="font-bold text-slate-200">
                    {Number(((collaboration * 0.05 + flexibility * 0.05 + costBenefit * 0.05) / 0.15).toFixed(1))}
                  </span>
                </div>
              </div>
            </div>

            {/* DIRECTIVES BANNER */}
            <div className="bg-white dark:bg-[#0d1627] border border-slate-150 dark:border-slate-850 rounded-2xl p-5 space-y-3 shadow-xs">
              <h5 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Diretrizes de Compliance
              </h5>
              <ul className="space-y-2 text-slate-500 list-disc list-inside leading-relaxed font-medium">
                <li>O faturamento é desbloqueado no financeiro assim que você finalizar o preenchimento.</li>
                <li>Qualidade Técnica ≤ 2 ou Postura ≤ 2 exigem preenchimento de justificativas estruturadas obrigatórias para auditoria do RH.</li>
                <li>Caso o freelancer receba classificação &ldquo;Restrito&rdquo; ou &ldquo;Não recomendado&rdquo;, novos agendamentos dele serão travados para toda a V3A.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
