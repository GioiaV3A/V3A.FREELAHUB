'use client';

import React, { useState, useEffect } from 'react';
import { DatabaseProps } from '@/app/page';
import { 
  Briefcase, Calendar, CheckCircle, FileCheck, Sliders, 
  Download, Plus, RefreshCw, Key, ShieldAlert, Award, 
  MessageSquare, User, Building, QrCode, Link as LinkIcon, Info,
  AlertTriangle, FileText, CheckCircle2, Star, Check, Clock, Lock, Unlock
} from 'lucide-react';
import { 
  formatCurrencyBRL, 
  formatISODateToBR,
  simulatePaymentProjections
} from '@/lib/financial';
import ScoreStars from '@/components/ScoreStars';
import { supabase } from '@/lib/supabase';
import { 
  generatePaymentRequestAction, 
  registerFinanceCodeAction,
  exportPaymentRequestAction
} from '@/app/actions/admin';
import { 
  submitFreelancerAndDeliveryEvaluationAction 
} from '@/app/actions/evaluation';

export default function ConsolidatedAllocation({ db, jobId }: { db: DatabaseProps; jobId: string }) {
  const allocation = db.allocations.find(a => a.jobId === jobId && a.status !== 'Cancelado');

  // Loading & UI States
  const [loadingScheduleId, setLoadingScheduleId] = useState<string | null>(null);
  const [showFinanceForm, setShowFinanceForm] = useState<string | null>(null);
  const [financeCodeValue, setFinanceCodeValue] = useState('');
  const [reverseToken, setReverseToken] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Helper lists for schedules and requests used inside helpers
  const schedules = allocation
    ? db.paymentSchedules
        .filter(s => s.allocationId === allocation.id)
        .sort((a, b) => a.installmentNumber - b.installmentNumber)
    : [];

  const requests = allocation
    ? db.paymentRequests.filter(r => r.allocationId === allocation.id)
    : [];

  const successFee = allocation && db.allocationSuccessFees
    ? db.allocationSuccessFees.find(sf => sf.allocationId === allocation.id)
    : undefined;

  const isRh = db.currentUser.profile === 'RH';
  const isAllocationActive = allocation && ['booked', 'active', 'pendente', 'ativo'].includes(allocation.status.toLowerCase());

  const getPaymentStatusText = () => {
    if (!allocation) return { statusText: 'Sem alocação', details: '' };
    const total = schedules.length;
    if (total === 0) return { statusText: 'Aguardando encerramento do job', details: '' };

    const pending = schedules.filter(s => s.status === 'pending').length;
    const generated = schedules.filter(s => s.status === 'payment_request_generated').length;
    const exported = schedules.filter(s => s.status === 'exported').length;
    const sentToFinance = schedules.filter(s => s.status === 'sent_to_finance').length;
    const financeCodeRegistered = schedules.filter(s => s.status === 'finance_code_received').length;
    const paid = schedules.filter(s => s.status === 'paid').length;
    const cancelled = schedules.filter(s => s.status === 'cancelled').length;

    const exportedTotal = exported + sentToFinance + financeCodeRegistered + paid;

    if (allocation.paymentModel === 'monthly_recurring' || total > 1) {
      const nextSchedule = schedules.find(s => s.status === 'pending' || s.status === 'payment_request_generated');
      let details = `${exportedTotal} de ${total} solicitações exportadas`;
      if (nextSchedule) {
        const nextDateStr = nextSchedule.dueDate ? formatISODateToBR(nextSchedule.dueDate) : 'A definir';
        const nextValStr = formatCurrencyBRL(nextSchedule.amount);
        details += ` | Próxima parcela: ${nextDateStr} (${nextValStr})`;
      }
      
      let statusText = 'Pagamento recorrente';
      if (paid === total) statusText = 'Pago';
      else if (paid > 0) statusText = 'Pago parcialmente';
      else if (cancelled === total) statusText = 'Cancelado';
      else if (financeCodeRegistered > 0) statusText = 'Código financeiro registrado';
      else if (exported > 0 || sentToFinance > 0) statusText = 'Documento exportado';
      else if (generated > 0) statusText = 'Solicitação gerada';
      else statusText = 'Aguardando solicitação de pagamento';

      return { statusText, details };
    } else {
      const sch = schedules[0];
      if (!sch) return { statusText: 'Aguardando solicitação de pagamento', details: '' };
      let statusText = 'Aguardando solicitação de pagamento';
      if (sch.status === 'paid') statusText = 'Pago';
      else if (sch.status === 'finance_code_received') statusText = 'Código financeiro registrado';
      else if (sch.status === 'exported' || sch.status === 'sent_to_finance') statusText = 'Documento exportado';
      else if (sch.status === 'payment_request_generated') statusText = 'Solicitação gerada';
      else if (sch.status === 'cancelled') statusText = 'Cancelado';

      return { statusText, details: '' };
    }
  };

  const paymentStatus = getPaymentStatusText();
  const hasExportedAny = requests.some(r => ['exported', 'finance_code_registered', 'paid'].includes(r.documentStatus));

  const handleExportUniquePayment = async () => {
    if (isRh) {
      alert('Acesso negado: Usuários do RH não possuem permissão para exportar solicitações de faturamento.');
      return;
    }

    if (!isAllocationActive) {
      alert('Ação indisponível: A alocação precisa estar Bookada ou Ativa.');
      return;
    }

    const sch = schedules[0];
    if (!sch) {
      alert('Nenhuma agenda de faturamento cadastrada para esta alocação.');
      return;
    }

    setLoadingScheduleId(sch.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';
      if (!token) return;

      let reqId = '';
      const existingReq = requests.find(r => r.paymentScheduleId === sch.id);

      if (!existingReq) {
        const resGen = await generatePaymentRequestAction(token, sch.id, {});
        if (!resGen.success) {
          alert(`❌ Erro ao gerar solicitação: ${resGen.error}`);
          return;
        }
        reqId = resGen.data.id;
        window.open(`/public/faturamento/print/${reqId}`, '_blank');
        await exportPaymentRequestAction(token, reqId);
      } else {
        reqId = existingReq.id;
        window.open(`/public/faturamento/print/${reqId}`, '_blank');
        if (existingReq.documentStatus === 'generated') {
          await exportPaymentRequestAction(token, reqId);
        }
      }

      await db.reloadDatabase();
    } catch (err: any) {
      alert(`❌ Erro: ${err.message}`);
    } finally {
      setLoadingScheduleId(null);
    }
  };

  const handleExportScheduleItem = async (schId: string) => {
    if (isRh) {
      alert('Acesso negado: Usuários do RH não possuem permissão para exportar solicitações de faturamento.');
      return;
    }

    const sch = schedules.find(s => s.id === schId);
    if (!sch) return;

    setLoadingScheduleId(schId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';
      if (!token) return;

      let reqId = '';
      const existingReq = requests.find(r => r.paymentScheduleId === schId);

      if (!existingReq) {
        const resGen = await generatePaymentRequestAction(token, schId, {});
        if (!resGen.success) {
          alert(`❌ Erro ao gerar solicitação: ${resGen.error}`);
          return;
        }
        reqId = resGen.data.id;
        window.open(`/public/faturamento/print/${reqId}`, '_blank');
        await exportPaymentRequestAction(token, reqId);
      } else {
        reqId = existingReq.id;
        window.open(`/public/faturamento/print/${reqId}`, '_blank');
        if (existingReq.documentStatus === 'generated') {
          await exportPaymentRequestAction(token, reqId);
        }
      }

      await db.reloadDatabase();
    } catch (err: any) {
      alert(`❌ Erro: ${err.message}`);
    } finally {
      setLoadingScheduleId(null);
    }
  };

  const handleExportNextPending = async () => {
    const nextPending = schedules.find(s => s.status === 'pending' || s.status === 'payment_request_generated');
    if (!nextPending) {
      alert('Nenhuma parcela pendente de faturamento.');
      return;
    }
    await handleExportScheduleItem(nextPending.id);
  };

  // Evaluation form states
  const [activeEvalType, setActiveEvalType] = useState<'freelancer' | 'delivery' | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);

  // Evaluation state variables
  const [communication, setCommunication] = useState(5);
  const [autonomy, setAutonomy] = useState(5);
  const [reliability, setReliability] = useState(5);
  const [collaboration, setCollaboration] = useState(5);
  const [flexibility, setFlexibility] = useState(5);
  const [behavior, setBehavior] = useState(5);
  const [cultureProcesses, setCultureProcesses] = useState(5);
  const [behaviorComment, setBehaviorComment] = useState('');

  const [technicalQuality, setTechnicalQuality] = useState(5);
  const [briefingAdherence, setBriefingAdherence] = useState(5);
  const [deadline, setDeadline] = useState(5);
  const [rework, setRework] = useState(5);
  const [scopeAdherence, setScopeAdherence] = useState(5);
  const [costBenefit, setCostBenefit] = useState(5);
  const [materialsQuality, setMaterialsQuality] = useState(5);
  const [deliveryComment, setDeliveryComment] = useState('');
  const [wouldHireAgain, setWouldHireAgain] = useState<'sim' | 'talvez' | 'nao'>('sim');
  const [reworkLevel, setReworkLevel] = useState<'nao' | 'baixa' | 'media' | 'alta'>('nao');
  const [criticalProblem, setCriticalProblem] = useState(false);

  // Fetch reverse token on mount or when evaluations are completed
  useEffect(() => {
    async function loadToken() {
      if (!allocation) return;
      const { data } = await supabase
        .from('reverse_evaluation_links')
        .select('token')
        .eq('allocation_id', allocation.id)
        .eq('status', 'active')
        .maybeSingle();
      if (data) {
        setReverseToken(data.token);
      }
    }
    if (allocation?.evaluatedFreelancer && allocation?.evaluatedDelivery) {
      loadToken();
    }
  }, [allocation?.id, allocation?.evaluatedFreelancer, allocation?.evaluatedDelivery]);

  if (!allocation) {
    return (
      <div className="bg-white p-8 text-center text-text-secondary border border-border-subtle rounded-2xl">
        Nenhuma alocação consolidada ativa encontrada para esta oportunidade.
      </div>
    );
  }

  const freelancer = db.freelancers.find(f => f.id === allocation.freelancerId);
  const job = db.jobs.find(j => j.id === jobId);

  // Check if at least one payment request has been exported
  const firstRequestExported = requests.some(
    r => r.documentStatus !== 'generated'
  );

  const isNucleoOwner = db.currentUser.profile === 'NÚCLEO' ? db.currentUser.nucleoId === allocation.nucleoId : true;

  const handleGenerateRequest = async (schedId: string) => {
    if (isRh) {
      alert('Acesso negado: Usuários do RH não possuem permissão para emitir solicitações de faturamento.');
      return;
    }
    if (!isNucleoOwner) {
      alert('Acesso negado: Você não tem permissão para emitir solicitação de pagamento desta alocação.');
      return;
    }
    setLoadingScheduleId(schedId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';
      if (!token) return;

      const res = await generatePaymentRequestAction(token, schedId, {});
      if (!res.success) {
        alert(`❌ Erro ao gerar solicitação: ${res.error}`);
        return;
      }
      alert('✅ Solicitação de Pagamento gerada com sucesso!');
      await db.reloadDatabase();
    } catch (err: any) {
      alert(`❌ Erro ao processar faturamento: ${err.message}`);
    } finally {
      setLoadingScheduleId(null);
    }
  };

  const handleExportRequest = async (reqId: string) => {
    if (isRh) {
      alert('Acesso negado: Usuários do RH não possuem permissão para exportar solicitações de faturamento.');
      return;
    }
    if (!isNucleoOwner) {
      alert('Acesso negado: Você não tem permissão para emitir solicitação de pagamento desta alocação.');
      return;
    }
    
    // Open print page in a new window
    window.open(`/public/faturamento/print/${reqId}`, '_blank');

    // Transition status to exported if it was only generated
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';
      if (!token) return;

      const req = requests.find(r => r.id === reqId);
      if (req && req.documentStatus === 'generated') {
        await exportPaymentRequestAction(token, reqId);
        await db.reloadDatabase();
      }
    } catch (err) {
      console.error('Failed to trigger export status change on download:', err);
    }
  };

  const handleRegisterFinanceCode = async (reqId: string) => {
    if (isRh) {
      alert('Acesso negado: Usuários do RH não possuem permissão para registrar códigos de faturamento.');
      return;
    }
    if (!isNucleoOwner) {
      alert('Acesso negado: Você não tem permissão para registrar códigos de pagamento desta alocação.');
      return;
    }
    if (!financeCodeValue.trim()) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';
      if (!token) return;

      const res = await registerFinanceCodeAction(token, reqId, financeCodeValue);
      if (!res.success) {
        alert(`❌ Erro ao registrar código ERP: ${res.error}`);
        return;
      }
      alert('✅ Código financeiro ERP registrado com sucesso!');
      setShowFinanceForm(null);
      setFinanceCodeValue('');
      await db.reloadDatabase();
    } catch (err: any) {
      alert(`❌ Erro: ${err.message}`);
    }
  };

  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRh) {
      alert('Acesso negado: RH não pode submeter avaliações operacionais.');
      return;
    }
    if (!activeEvalType) return;

    setEvalLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';
      if (!token) return;

      const payload = activeEvalType === 'delivery' 
        ? {
            technicalQuality,
            briefingAdherence,
            deadline,
            rework,
            scopeAdherence,
            costBenefit,
            materialsQuality,
            comment: deliveryComment,
            wouldHireAgain,
            reworkLevel,
            criticalProblem
          }
        : {
            communication,
            autonomy,
            reliability,
            collaboration,
            flexibility,
            behavior,
            cultureProcesses,
            comment: behaviorComment
          };

      const res = await submitFreelancerAndDeliveryEvaluationAction(
        token,
        allocation.id,
        activeEvalType,
        payload
      );

      if (!res.success) {
        alert(`❌ Erro ao enviar avaliação: ${res.error}`);
        return;
      }

      alert(`✅ Avaliação de ${activeEvalType === 'delivery' ? 'Entrega/Qualidade' : 'Freelancer/Comportamento'} registrada com sucesso!`);
      setActiveEvalType(null);
      await db.reloadDatabase();
    } catch (err: any) {
      alert(`❌ Erro ao processar avaliação: ${err.message}`);
    } finally {
      setEvalLoading(false);
    }
  };

  // Reverse link values
  const reverseEvalUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/public/avaliacao/${reverseToken}`
    : '';
  const qrCodeUrl = reverseToken
    ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(reverseEvalUrl)}`
    : '';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Header Information */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            { (job?.jobCode || allocation.jobCode) && (
              <span className="bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                JOB: {job?.jobCode || allocation.jobCode}
              </span>
            )}
            <span className="bg-slate-800 text-slate-100 border border-slate-700 font-mono text-[10px] font-bold px-2 py-0.5 rounded">
              ALOC: {allocation.allocationCode || 'ALOC-PENDENTE'}
            </span>
            <span className="text-[11px] uppercase font-bold text-action-cyan tracking-wider">
              Booking Consolidado
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
              allocation.status === 'Concluído'
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                : 'bg-blue-950 text-blue-300 border-blue-800'
            }`}>
              {allocation.status}
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-white leading-tight">
            [{job?.client || 'Cliente'}] {job?.name || 'Projeto'}
          </h3>
          <p className="text-xs text-slate-300">
            Período de Alocação: <strong className="text-white">{formatISODateToBR(allocation.startDate)} a {formatISODateToBR(allocation.endDate)}</strong>
          </p>
        </div>

        <div className="text-right min-w-[200px]">
          <div className="text-[10px] uppercase font-bold text-slate-400">Total Homologado</div>
          <div className="text-xl font-extrabold text-action-cyan">
            {formatCurrencyBRL(allocation.totalContractValue || allocation.approvedValue)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Modelo: <strong className="text-white uppercase">{allocation.paymentModel === 'monthly_recurring' ? 'Recorrente Mensal' : 'Pagamento Único'}</strong>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. Freelancer Professional Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-border-subtle shadow-xs space-y-4">
          <div className="text-center pb-4 border-b border-border-subtle">
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/30 rounded-full flex items-center justify-center mx-auto mb-2 text-emerald-600">
              <User className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-sidebar-navy dark:text-action-cyan text-sm">{freelancer?.name || 'Profissional'}</h4>
            <p className="text-[11px] text-text-secondary">{freelancer?.mainRole} ({freelancer?.seniority})</p>
            <span className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-250 dark:border-emerald-900/40 inline-block mt-2">
              Status Operacional: {freelancer?.operationalStatus || 'Elegível'}
            </span>
          </div>

          <div className="text-xs space-y-3 pt-2">
            <div className="flex justify-between">
              <span className="text-text-secondary">WhatsApp:</span>
              <strong className="text-text-primary">{freelancer?.whatsapp}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">E-mail:</span>
              <strong className="text-text-primary">{freelancer?.email}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Score Geral 360°:</span>
              <div className="flex items-center">
                <ScoreStars score={freelancer?.consolidatedScore || freelancer?.averageScore} size="sm" showNumber={true} />
              </div>
            </div>
          </div>
        </div>

        {/* 2.1 Detalhes Administrativos do Booking Card */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-emerald-300 dark:border-emerald-900/40 shadow-xs space-y-5 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 bg-emerald-650 text-white text-[10px] font-bold p-1 px-4 rounded-bl-xl uppercase tracking-wider">
            Alocação Consolidada
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-bold text-sidebar-navy dark:text-action-cyan text-sm flex items-center gap-1.5">
                <FileCheck className="w-5 h-5 text-emerald-650" />
                <span>Detalhes Administrativos do Booking</span>
              </h4>
              <p className="text-[11px] text-text-secondary mt-0.5">Metadados fiscais e códigos vinculados à convocação.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-border-subtle space-y-1">
                <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Código de Alocação</span>
                <div className="font-mono text-base font-bold text-sidebar-navy dark:text-white">{allocation.allocationCode || 'ALOC-PENDENTE'}</div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-border-subtle space-y-1">
                <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Status do Pagamento</span>
                <div className="font-semibold text-xs flex flex-col gap-0.5 text-sidebar-navy dark:text-white">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-action-cyan shrink-0" />
                    <span className="font-bold">{paymentStatus.statusText}</span>
                  </div>
                  {paymentStatus.details && (
                    <span className="text-[10px] text-text-secondary font-medium mt-0.5 leading-tight">{paymentStatus.details}</span>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-border-subtle space-y-1">
                <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Tarifa Homologada</span>
                <div className="font-bold text-sm text-sidebar-navy dark:text-white">
                  {formatCurrencyBRL(allocation.totalContractValue || allocation.approvedValue)}
                  <span className="text-text-secondary text-xs font-normal"> ({allocation.paymentModel === 'monthly_recurring' ? 'Mensal / Salário' : 'Pagamento Único'})</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-border-subtle space-y-1">
                <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Período de Execução</span>
                <div className="font-semibold text-xs text-sidebar-navy dark:text-white">
                  {formatISODateToBR(allocation.startDate)} a {formatISODateToBR(allocation.endDate)}
                </div>
              </div>

              {successFee && (
                <div className="sm:col-span-2 bg-indigo-50/50 dark:bg-indigo-950/15 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/40 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-400 tracking-wider block">
                    Success Fee Potencial Vinculado
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-text-secondary block">Remuneração Potencial</span>
                      <strong className="text-indigo-900 dark:text-white text-sm">
                        {formatCurrencyBRL(successFee.potentialAmount)} 
                        <span className="text-text-secondary font-normal text-[10px]">
                          {' '}({successFee.feeType === 'fixed' ? 'Valor Fixo' : `${successFee.percentageRate}%`})
                        </span>
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-secondary block">Status do Gatilho</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold mt-0.5 border ${
                        successFee.status === 'eligible' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' :
                        successFee.status === 'not_eligible' ? 'bg-red-950 text-red-300 border-red-800' :
                        'bg-slate-800 text-slate-350 border-slate-700'
                      }`}>
                        {successFee.status === 'eligible' ? 'Atingido (Elegível)' :
                         successFee.status === 'not_eligible' ? 'Não Atingido (Inelegível)' :
                         'Aguardando Resultado'}
                      </span>
                    </div>
                    {successFee.termsSnapshot && (
                      <div className="sm:col-span-2 pt-1 border-t border-indigo-200/45 dark:border-indigo-900/30 text-[10.5px] text-indigo-850 dark:text-indigo-350 italic">
                        Regra: {successFee.termsSnapshot}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Export action button */}
          <div className="pt-4 border-t border-border-subtle flex justify-end items-center">
            <button
              onClick={allocation.paymentModel === 'monthly_recurring' ? () => setIsExportModalOpen(true) : handleExportUniquePayment}
              disabled={!isAllocationActive || schedules.length === 0}
              className={`font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                !isAllocationActive || schedules.length === 0
                  ? 'bg-slate-100 dark:bg-slate-850 text-slate-400 dark:text-slate-650 cursor-not-allowed border border-border-subtle'
                  : hasExportedAny
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-action-cyan hover:bg-action-cyan/85 text-white'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>{hasExportedAny ? 'Ver Solicitação Exportada' : 'Exportar Solicitação de Pagamento'}</span>
            </button>
          </div>
        </div>

        {/* Projeções de Faturamento & Compliance de RC (Supply) */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-border-subtle shadow-xs space-y-4">
          <div>
            <h4 className="font-bold text-sidebar-navy dark:text-action-cyan text-sm flex items-center gap-1.5">
              <Clock className="w-5 h-5 text-amber-500" />
              <span>Projeções de Faturamento & Compliance de RC (Supply)</span>
            </h4>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Visualização estimada do cronograma operacional de pagamentos, prazos regulamentares para abertura de RCs no ERP de Supply e classificação de risco de compliance.
            </p>
          </div>

          {(() => {
            const projections = simulatePaymentProjections(allocation.startDate, allocation.endDate, allocation.remunerationModel || job?.remunerationModel);
            if (projections.length === 0) return <p className="text-xs text-text-muted italic">Sem projeções de vencimento para este período.</p>;

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projections.map((p) => {
                  const alertColors = 
                    p.alertLevel === 'critical' ? 'border-red-500 bg-red-50/50 dark:bg-red-950/15 text-red-800 dark:text-red-400' :
                    p.alertLevel === 'urgent' ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/15 text-orange-850 dark:text-orange-400' :
                    p.alertLevel === 'attention' ? 'border-amber-500 bg-amber-55/50 dark:bg-amber-955/15 text-amber-900 dark:text-amber-400' :
                    'border-slate-200 bg-slate-50 dark:bg-slate-800/30 text-text-primary';

                  const badgeColors = 
                    p.alertLevel === 'critical' ? 'bg-red-500 text-white' :
                    p.alertLevel === 'urgent' ? 'bg-orange-500 text-white' :
                    p.alertLevel === 'attention' ? 'bg-amber-500 text-white' :
                    'bg-slate-500 text-white';

                  const riskLabel = 
                    p.alertLevel === 'critical' ? 'Risco Crítico (Prazo estourado/RC Bloqueado)' :
                    p.alertLevel === 'urgent' ? 'Risco Urgente (<3 dias)' :
                    p.alertLevel === 'attention' ? 'Atenção (<10 dias)' :
                    'Sob Controle (Dentro do prazo)';

                  return (
                    <div key={p.cycleNumber} className={`p-4 rounded-2xl border ${alertColors} flex flex-col justify-between space-y-3`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <strong className="text-[12px] block font-extrabold">Ciclo #{p.cycleNumber}</strong>
                          <span className="text-[10px] opacity-75">{formatISODateToBR(p.startDate)} a {formatISODateToBR(p.endDate)}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide shadow-xs ${badgeColors}`}>
                          {p.alertLevel === 'critical' ? 'Bloqueado' : p.alertLevel === 'urgent' ? 'Urgente' : p.alertLevel === 'attention' ? 'Atenção' : 'Normal'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-dashed border-current/20 text-xs">
                        <div>
                          <span className="text-[10px] opacity-70 block font-semibold uppercase">Vencimento Projetado</span>
                          <strong className="font-mono">{formatISODateToBR(p.suggestedPaymentDate)}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] opacity-70 block font-semibold uppercase">Prazo Limite RC</span>
                          <strong className="font-mono">{formatISODateToBR(p.suggestedRcDeadline)}</strong>
                        </div>
                      </div>

                      <div className="text-[10px] opacity-80 pt-1 leading-normal flex items-start gap-1 text-left">
                        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>Status: <strong>{riskLabel}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* 3. Payments Schedule Timeline (Full Width Below) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-border-subtle shadow-xs space-y-4">
        <div>
          <h4 className="font-bold text-sidebar-navy dark:text-action-cyan text-sm flex items-center gap-1.5">
            <FileCheck className="w-5 h-5 text-emerald-650" />
            <span>Agenda de Faturamentos & Parcelas</span>
          </h4>
          <p className="text-[11px] text-text-secondary mt-0.5">Gestão das tranches de pagamento vinculadas a esta contratação.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle text-text-secondary text-[11px] uppercase tracking-wider bg-slate-50 dark:bg-slate-800/40">
                <th className="p-3 font-semibold">Parc.</th>
                <th className="p-3 font-semibold">Período Ref.</th>
                <th className="p-3 font-semibold">Vencimento</th>
                <th className="p-3 font-semibold text-right">Valor</th>
                <th className="p-3 font-semibold text-center">Status</th>
                <th className="p-3 font-semibold">Código ERP</th>
                <th className="p-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(sch => {
                const req = requests.find(r => r.paymentScheduleId === sch.id);
                return (
                  <tr key={sch.id} className="border-b border-border-subtle hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="p-3 font-bold text-text-primary">#{sch.installmentNumber}</td>
                    <td className="p-3 text-text-secondary">
                      {formatISODateToBR(sch.referencePeriodStart)} a {formatISODateToBR(sch.referencePeriodEnd)}
                    </td>
                    <td className="p-3 text-text-secondary">{sch.dueDate ? formatISODateToBR(sch.dueDate) : '—'}</td>
                    <td className="p-3 text-right text-text-primary font-mono font-bold">
                      {formatCurrencyBRL(sch.amount)}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase ${
                        sch.status === 'pending'
                          ? 'bg-slate-100 text-slate-700'
                          : sch.status === 'payment_request_generated'
                            ? 'bg-amber-100 text-amber-800'
                            : ['exported', 'sent_to_finance'].includes(sch.status)
                              ? 'bg-blue-100 text-blue-800'
                              : sch.status === 'finance_code_received'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {sch.status === 'pending' ? 'Pendente' : 
                         sch.status === 'payment_request_generated' ? 'Emitido' :
                         ['exported', 'sent_to_finance'].includes(sch.status) ? 'Exportado' : 
                         sch.status === 'finance_code_received' ? 'Registrado ERP' : 'Pago'}
                      </span>
                    </td>
                    <td className="p-3 text-text-primary font-mono">
                      {sch.financeCode || '—'}
                    </td>
                    <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                      {!req && (
                        <button
                          disabled={loadingScheduleId !== null || isRh}
                          onClick={() => handleGenerateRequest(sch.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-extrabold p-1 px-2.5 rounded-lg text-[10px] transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          {loadingScheduleId === sch.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                          Emitir
                        </button>
                      )}

                      {req && (
                        <>
                          <button
                            disabled={isRh}
                            onClick={() => handleExportRequest(req.id)}
                            className="bg-slate-750 hover:bg-slate-650 disabled:opacity-40 text-white font-extrabold p-1 px-2.5 rounded-lg text-[10px] transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            PDF
                          </button>

                          {req.documentStatus === 'exported' && !isRh && (
                            <button
                              onClick={() => {
                                setShowFinanceForm(req.id);
                                setFinanceCodeValue('');
                              }}
                              className="bg-action-cyan/10 hover:bg-action-cyan/20 text-action-cyan border border-action-cyan/35 font-extrabold p-1 px-2.5 rounded-lg text-[10px] transition-colors cursor-pointer"
                            >
                              Cod. ERP
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ERP Code Input Dialog */}
        {showFinanceForm && (
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-border-subtle space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-xs text-text-primary">Registrar Código ERP do Financeiro</span>
              <button 
                onClick={() => setShowFinanceForm(null)}
                className="text-text-secondary hover:text-text-primary text-xs"
              >
                Cancelar
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: ERP-87364-PAG"
                value={financeCodeValue}
                onChange={(e) => setFinanceCodeValue(e.target.value)}
                className="flex-1 bg-white border border-border-subtle p-2 rounded-lg text-xs focus:outline-none focus:border-action-cyan text-text-primary"
              />
              <button
                onClick={() => handleRegisterFinanceCode(showFinanceForm)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 rounded-lg text-xs"
              >
                Salvar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Operations Evaluations and Reverse Token */}
      {allocation.status === 'Concluído' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-border-subtle shadow-xs space-y-6">
          <div>
            <h4 className="font-bold text-sidebar-navy dark:text-action-cyan text-sm flex items-center gap-1.5">
              <Award className="w-5 h-5 text-emerald-650" />
              <span>Avaliações e Auditoria Operacional 360°</span>
            </h4>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Avaliação final do projeto. A liberação está condicionada ao download/exportação do primeiro faturamento.
            </p>
          </div>

          {/* Lock Warning Banner */}
          {!firstRequestExported && (
            <div className="bg-amber-55 text-amber-900 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 p-4 rounded-2xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <strong className="text-xs block">Avaliações Bloqueadas por Governança</strong>
                <p className="text-[11px] mt-0.5 leading-relaxed">
                  Para liberar a avaliação do freelancer e da entrega técnica, você deve primeiro gerar e exportar (fazer o download/PDF) da primeira parcela de faturamento na tabela acima.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* A. Evaluation Freelancer */}
            <div className="border border-border-subtle p-5 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h5 className="font-bold text-xs text-sidebar-navy dark:text-action-cyan uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-4 h-4" />
                    <span>Avaliar Freelancer (Comportamental)</span>
                  </h5>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    allocation.evaluatedFreelancer
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {allocation.evaluatedFreelancer ? 'Concluída' : 'Pendente'}
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Analise critérios de comportamento, comunicação, autonomia, confiabilidade e aderência à cultura da V3A.
                </p>
              </div>

              <div className="pt-3 border-t border-border-subtle flex justify-end">
                <button
                  disabled={!firstRequestExported || allocation.evaluatedFreelancer || isRh}
                  onClick={() => setActiveEvalType('freelancer')}
                  className="bg-slate-900 hover:bg-slate-850 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <Sliders className="w-4 h-4" />
                  {allocation.evaluatedFreelancer ? 'Avaliação Enviada' : 'Avaliar Comportamento'}
                </button>
              </div>
            </div>

            {/* B. Evaluation Delivery */}
            <div className="border border-border-subtle p-5 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h5 className="font-bold text-xs text-sidebar-navy dark:text-action-cyan uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4" />
                    <span>Avaliar Entrega (Qualidade Técnica)</span>
                  </h5>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    allocation.evaluatedDelivery
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {allocation.evaluatedDelivery ? 'Concluída' : 'Pendente'}
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Analise qualidade técnica dos arquivos, cumprimento de briefing, pontualidade de prazos, refações e saving.
                </p>
              </div>

              <div className="pt-3 border-t border-border-subtle flex justify-end">
                <button
                  disabled={!firstRequestExported || allocation.evaluatedDelivery || isRh}
                  onClick={() => setActiveEvalType('delivery')}
                  className="bg-slate-900 hover:bg-slate-850 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <Sliders className="w-4 h-4" />
                  {allocation.evaluatedDelivery ? 'Avaliação Enviada' : 'Avaliar Técnica & Prazos'}
                </button>
              </div>
            </div>
          </div>

          {/* 5. Reverse Evaluation Link / QR Code Panel (Visible only when both are submitted) */}
          {allocation.evaluatedFreelancer && allocation.evaluatedDelivery && (
            <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200 dark:border-emerald-900/40 p-6 rounded-2xl space-y-4 animate-fade-in text-left">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <h5 className="font-bold text-sm text-emerald-850 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Link de Avaliação Reversa Gerado!</span>
                  </h5>
                  <p className="text-xs text-text-secondary">
                    Envie este link temporário de uso único ao freelancer para que ele avalie a liderança e condições de trabalho.
                  </p>
                </div>

                {reverseToken && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(reverseEvalUrl);
                      alert('📋 Link copiado para a área de transferência!');
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    Copiar Link Público
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
                {qrCodeUrl && (
                  <div className="bg-white p-3 rounded-2xl border border-border-subtle shadow-xs shrink-0">
                    <img src={qrCodeUrl} alt="QR Code Avaliação Reversa" className="w-36 h-36" />
                  </div>
                )}
                <div className="space-y-2 text-xs">
                  <div className="bg-white dark:bg-slate-850 p-3 rounded-xl border border-border-subtle font-mono text-[11px] text-text-primary break-all select-all">
                    {reverseEvalUrl}
                  </div>
                  <div className="text-[11px] text-text-secondary leading-relaxed space-y-1">
                    <p>&bull; O link expira automaticamente em 30 dias.</p>
                    <p>&bull; Link de uso único: será invalidado permanentemente após a submissão.</p>
                    <p>&bull; As respostas do freelancer serão 100% anônimas e auditadas para governança.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. Modals for Evaluations */}
      {activeEvalType && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden border border-border-subtle max-h-[90vh] flex flex-col animate-scale-up">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 px-6 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-action-cyan" />
                <span className="font-bold text-sm uppercase tracking-wider">
                  {activeEvalType === 'delivery' ? 'Avaliação de Entrega & Qualidade' : 'Avaliação do Profissional (Comportamento)'}
                </span>
              </div>
              <button 
                onClick={() => setActiveEvalType(null)} 
                className="text-slate-400 hover:text-white transition-colors font-extrabold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Scrollable Form */}
            <form onSubmit={handleSubmitEvaluation} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs text-left">
              {activeEvalType === 'freelancer' ? (
                // A. Freelancer sliders
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl space-y-3">
                    <span className="font-bold block text-text-primary">Critérios Comportamentais (Nota 1 a 5)</span>
                    
                    {/* Communication */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-medium">
                        <span className="text-text-secondary">Comunicação e Alinhamento:</span>
                        <strong className="text-text-primary font-bold">{communication}/5</strong>
                      </div>
                      <input
                        type="range" min="1" max="5" step="1"
                        value={communication}
                        onChange={(e) => setCommunication(Number(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>

                    {/* Autonomy */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-medium">
                        <span className="text-text-secondary">Autonomia e Resolução de Problemas:</span>
                        <strong className="text-text-primary font-bold">{autonomy}/5</strong>
                      </div>
                      <input
                        type="range" min="1" max="5" step="1"
                        value={autonomy}
                        onChange={(e) => setAutonomy(Number(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>

                    {/* Reliability */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-medium">
                        <span className="text-text-secondary">Confiabilidade Operacional (Acordos):</span>
                        <strong className="text-text-primary font-bold">{reliability}/5</strong>
                      </div>
                      <input
                        type="range" min="1" max="5" step="1"
                        value={reliability}
                        onChange={(e) => setReliability(Number(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>

                    {/* Collaboration */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-medium">
                        <span className="text-text-secondary">Trabalho em Equipe & Colaboração:</span>
                        <strong className="text-text-primary font-bold">{collaboration}/5</strong>
                      </div>
                      <input
                        type="range" min="1" max="5" step="1"
                        value={collaboration}
                        onChange={(e) => setCollaboration(Number(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>

                    {/* Flexibility */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-medium">
                        <span className="text-text-secondary">Flexibilidade de Escopo / Prazos:</span>
                        <strong className="text-text-primary font-bold">{flexibility}/5</strong>
                      </div>
                      <input
                        type="range" min="1" max="5" step="1"
                        value={flexibility}
                        onChange={(e) => setFlexibility(Number(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>

                    {/* Behavior */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-medium">
                        <span className="text-text-secondary">Postura Ética e Inteligência Emocional:</span>
                        <strong className="text-text-primary font-bold">{behavior}/5</strong>
                      </div>
                      <input
                        type="range" min="1" max="5" step="1"
                        value={behavior}
                        onChange={(e) => setBehavior(Number(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>

                    {/* Culture & Processes */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-medium">
                        <span className="text-text-secondary">Aderência aos Processos V3A:</span>
                        <strong className="text-text-primary font-bold">{cultureProcesses}/5</strong>
                      </div>
                      <input
                        type="range" min="1" max="5" step="1"
                        value={cultureProcesses}
                        onChange={(e) => setCultureProcesses(Number(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-text-secondary font-bold block mb-1">Feedback do Profissional *</label>
                    <textarea
                      required
                      placeholder="Descreva pontos fortes, atitude, postura e facilidade de trabalho..."
                      value={behaviorComment}
                      onChange={(e) => setBehaviorComment(e.target.value)}
                      className="w-full bg-white border border-border-subtle p-2.5 rounded-lg focus:outline-none focus:border-action-cyan text-text-primary resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              ) : (
                // B. Delivery sliders
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl space-y-3">
                    <span className="font-bold block text-text-primary">Critérios Técnicos de Entrega (Nota 1 a 5)</span>
                    
                    {/* Technical Quality */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-medium">
                        <span className="text-text-secondary">Qualidade e Rigor Técnico da Entrega:</span>
                        <strong className="text-text-primary font-bold">{technicalQuality}/5</strong>
                      </div>
                      <input
                        type="range" min="1" max="5" step="1"
                        value={technicalQuality}
                        onChange={(e) => setTechnicalQuality(Number(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>

                    {/* Briefing Adherence */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-medium">
                        <span className="text-text-secondary">Aderência e Fidelidade ao Briefing:</span>
                        <strong className="text-text-primary font-bold">{briefingAdherence}/5</strong>
                      </div>
                      <input
                        type="range" min="1" max="5" step="1"
                        value={briefingAdherence}
                        onChange={(e) => setBriefingAdherence(Number(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>

                    {/* Deadline */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-medium">
                        <span className="text-text-secondary">Cumprimento de Prazos e Cronogramas:</span>
                        <strong className="text-text-primary font-bold">{deadline}/5</strong>
                      </div>
                      <input
                        type="range" min="1" max="5" step="1"
                        value={deadline}
                        onChange={(e) => setDeadline(Number(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>

                    {/* Rework */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-medium">
                        <span className="text-text-secondary">Nível de Refações (5 = Nenhuma refação):</span>
                        <strong className="text-text-primary font-bold">{rework}/5</strong>
                      </div>
                      <input
                        type="range" min="1" max="5" step="1"
                        value={rework}
                        onChange={(e) => setRework(Number(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>

                    {/* Scope Adherence */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-medium">
                        <span className="text-text-secondary">Conformidade e Entrega Completa do Escopo:</span>
                        <strong className="text-text-primary font-bold">{scopeAdherence}/5</strong>
                      </div>
                      <input
                        type="range" min="1" max="5" step="1"
                        value={scopeAdherence}
                        onChange={(e) => setScopeAdherence(Number(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>

                    {/* Cost Benefit */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-medium">
                        <span className="text-text-secondary">Custo-Benefício da Entrega:</span>
                        <strong className="text-text-primary font-bold">{costBenefit}/5</strong>
                      </div>
                      <input
                        type="range" min="1" max="5" step="1"
                        value={costBenefit}
                        onChange={(e) => setCostBenefit(Number(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>

                    {/* Materials Quality */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-medium">
                        <span className="text-text-secondary">Organização e Qualidade dos Arquivos/Materiais:</span>
                        <strong className="text-text-primary font-bold">{materialsQuality}/5</strong>
                      </div>
                      <input
                        type="range" min="1" max="5" step="1"
                        value={materialsQuality}
                        onChange={(e) => setMaterialsQuality(Number(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-text-secondary font-bold block mb-1">Recontrataria o profissional? *</label>
                      <select
                        value={wouldHireAgain}
                        onChange={(e) => setWouldHireAgain(e.target.value as any)}
                        className="w-full bg-white border border-border-subtle p-2 rounded-lg focus:outline-none focus:border-action-cyan text-text-primary"
                      >
                        <option value="sim">Sim, com certeza</option>
                        <option value="talvez">Sim, com restrição</option>
                        <option value="nao">Não recomendo</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-text-secondary font-bold block mb-1">Nível de Refação Técnico *</label>
                      <select
                        value={reworkLevel}
                        onChange={(e) => setReworkLevel(e.target.value as any)}
                        className="w-full bg-white border border-border-subtle p-2 rounded-lg focus:outline-none focus:border-action-cyan text-text-primary"
                      >
                        <option value="nao">Nenhuma refação</option>
                        <option value="baixa">Baixo volume (aceitável)</option>
                        <option value="media">Médio volume (atrasos pontuais)</option>
                        <option value="alta">Alto volume (crítico)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 p-3 rounded-xl">
                    <input
                      type="checkbox"
                      id="criticalProblemCheckbox"
                      checked={criticalProblem}
                      onChange={(e) => setCriticalProblem(e.target.checked)}
                      className="w-4 h-4 text-red-650 bg-white border-slate-300 rounded focus:ring-red-500 cursor-pointer"
                    />
                    <label htmlFor="criticalProblemCheckbox" className="font-bold text-red-800 dark:text-red-400 cursor-pointer">
                      Houve algum problema operacional crítico com esta entrega?
                    </label>
                  </div>

                  <div>
                    <label className="text-text-secondary font-bold block mb-1">Comentários e Feedbacks do Projeto *</label>
                    <textarea
                      required
                      placeholder="Descreva a qualidade das entregas, pontualidade, refações necessárias, etc..."
                      value={deliveryComment}
                      onChange={(e) => setDeliveryComment(e.target.value)}
                      className="w-full bg-white border border-border-subtle p-2.5 rounded-lg focus:outline-none focus:border-action-cyan text-text-primary resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-border-subtle flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveEvalType(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold px-4 py-2.5 rounded-xl text-xs cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={evalLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs disabled:opacity-50 cursor-pointer transition-all flex items-center gap-1.5"
                >
                  {evalLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Salvar Avaliação</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal for Recurring Export */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-55 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden border border-border-subtle max-h-[90vh] flex flex-col animate-scale-up text-xs">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 px-6 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-action-cyan" />
                <span className="font-bold text-sm uppercase tracking-wider">
                  Exportar Solicitação de Pagamento — Parcelas
                </span>
              </div>
              <button 
                onClick={() => setIsExportModalOpen(false)} 
                className="text-slate-400 hover:text-white transition-colors font-extrabold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs text-left">
              {/* Header Action Card */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-border-subtle flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h5 className="font-bold text-text-primary">Fluxo de Pagamento Recorrente</h5>
                  <p className="text-[10px] text-text-secondary mt-0.5 font-medium">Gerencie e exporte as solicitações de faturamento periódico.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportNextPending}
                    className="bg-action-cyan hover:bg-action-cyan/85 text-white font-extrabold px-3 py-1.5 rounded-lg text-[10px] cursor-pointer"
                  >
                    Exportar próxima parcela pendente
                  </button>
                </div>
              </div>

              {/* Table of tranches */}
              <div className="space-y-3">
                <h5 className="font-bold text-text-primary text-xs uppercase tracking-wider">Histórico e Parcelas</h5>
                <div className="border border-border-subtle rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-border-subtle text-[10px] font-bold text-text-secondary uppercase">
                        <th className="p-3">Parcela</th>
                        <th className="p-3">Período de Ref.</th>
                        <th className="p-3">Vencimento</th>
                        <th className="p-3 text-right">Valor</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {schedules.map(sch => {
                        const req = requests.find(r => r.paymentScheduleId === sch.id);
                        const isExported = req && ['exported', 'finance_code_registered', 'paid'].includes(req.documentStatus);
                        return (
                          <tr key={sch.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                            <td className="p-3 font-bold text-text-primary">#{sch.installmentNumber}</td>
                            <td className="p-3 text-text-secondary">
                              {formatISODateToBR(sch.referencePeriodStart)} a {formatISODateToBR(sch.referencePeriodEnd)}
                            </td>
                            <td className="p-3 text-text-secondary">{sch.dueDate ? formatISODateToBR(sch.dueDate) : '—'}</td>
                            <td className="p-3 text-right text-text-primary font-bold font-mono">
                              {formatCurrencyBRL(sch.amount)}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-[4px] text-[9px] font-semibold uppercase ${
                                sch.status === 'pending'
                                  ? 'bg-slate-100 text-slate-700'
                                  : sch.status === 'payment_request_generated'
                                    ? 'bg-amber-100 text-amber-800'
                                    : ['exported', 'sent_to_finance'].includes(sch.status)
                                      ? 'bg-blue-100 text-blue-800'
                                      : sch.status === 'finance_code_received'
                                        ? 'bg-indigo-100 text-indigo-800'
                                        : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {sch.status === 'pending' ? 'Pendente' : 
                                 sch.status === 'payment_request_generated' ? 'Emitido' :
                                 ['exported', 'sent_to_finance'].includes(sch.status) ? 'Exportado' : 
                                 sch.status === 'finance_code_received' ? 'Registrado ERP' : 'Pago'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleExportScheduleItem(sch.id)}
                                className={`font-bold px-2.5 py-1 rounded-lg text-[10px] cursor-pointer transition-colors ${
                                  isExported
                                    ? 'bg-slate-150 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                }`}
                              >
                                {isExported ? 'Baixar PDF' : 'Exportar'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Histórico de solicitações */}
              {requests.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-border-subtle">
                  <h5 className="font-bold text-text-primary text-xs uppercase tracking-wider">Histórico de Solicitações Geradas</h5>
                  <div className="space-y-2">
                    {requests.map(req => (
                      <div key={req.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/20 border border-border-subtle rounded-xl text-xs">
                        <div className="space-y-0.5">
                          <div className="font-mono font-bold text-text-primary">{req.requestCode}</div>
                          <div className="text-[10px] text-text-secondary">
                            Ref: Parcela #{req.paymentNumber} de {req.totalPayments} &bull; Vencimento: {req.paymentDueDate ? formatISODateToBR(req.paymentDueDate) : '—'}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-text-primary font-mono">{formatCurrencyBRL(req.amount)}</span>
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-semibold uppercase ${
                            req.documentStatus === 'generated'
                              ? 'bg-amber-100 text-amber-800'
                              : ['exported', 'sent_to_finance'].includes(req.documentStatus)
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {req.documentStatus === 'generated' ? 'Emitido' :
                             ['exported', 'sent_to_finance'].includes(req.documentStatus) ? 'Exportado' : 'Registrado ERP/Pago'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 px-6 border-t border-border-subtle bg-slate-50 dark:bg-slate-800/40 flex justify-end">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold px-5 py-2 rounded-xl text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
