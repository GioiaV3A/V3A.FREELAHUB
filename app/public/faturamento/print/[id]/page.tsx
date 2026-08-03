'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { exportPaymentRequestAction } from '@/app/actions/admin';
import { formatCurrencyBRL, formatISODateToBR } from '@/lib/financial';
import { Printer, Loader2, AlertTriangle, FileText, CheckCircle2, Calendar } from 'lucide-react';
import { formatCnpj } from '@/lib/cnpj';

export default function PrintPaymentRequestPage() {
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docType, setDocType] = useState<'single' | 'unified'>('single');
  const [requestData, setRequestData] = useState<any>(null);
  const [allocationData, setAllocationData] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function fetchDetails() {
      try {
        // Try fetching payment request first
        const { data: reqData, error: fetchErr } = await supabase
          .from('payment_requests')
          .select(`
            *,
            freelancer:freelancers(*),
            job:jobs(*),
            allocation:allocations(*),
            nucleo:nucleos(*),
            issuer:profiles!payment_requests_issued_by_fkey(*)
          `)
          .eq('id', id)
          .maybeSingle();

        if (reqData) {
          setRequestData(reqData);
          setDocType('single');
          setLoading(false);
          return;
        }

        // If not found, try fetching allocation for unified print
        const { data: allocData, error: allocErr } = await supabase
          .from('allocations')
          .select(`
            *,
            freelancer:freelancers(*),
            job:jobs(*),
            nucleo:nucleos(*),
            schedules:allocation_payment_schedules(*),
            requests:payment_requests(*)
          `)
          .eq('id', id)
          .maybeSingle();

        if (allocData) {
          setAllocationData(allocData);
          setDocType('unified');
          setLoading(false);
          return;
        }

        throw new Error('Documento não localizado.');
      } catch (err: any) {
        console.error('Error fetching print details:', err);
        setError('Não foi possível carregar o documento solicitado.');
      } finally {
        setLoading(false);
      }
    }

    fetchDetails();
  }, [id]);

  const handlePrintAndExport = async () => {
    window.print();
    
    if (docType === 'single') {
      setIsExporting(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          await exportPaymentRequestAction(token, id);
        }
      } catch (err) {
        console.warn('Failed to register export action:', err);
      } finally {
        setIsExporting(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-8 h-8 text-action-cyan animate-spin" />
        <p className="mt-2 text-xs text-text-secondary">Carregando documento...</p>
      </div>
    );
  }

  if (error || (!requestData && !allocationData)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-red-100 dark:bg-red-955/20 text-red-700 dark:text-red-405 rounded-full mb-3">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="font-bold text-text-primary text-base">Erro ao Carregar Documento</h3>
        <p className="text-xs text-text-secondary mt-1">{error || 'Solicitação de pagamento inválida.'}</p>
      </div>
    );
  }

  if (docType === 'unified') {
    const { freelancer, job, nucleo, schedules = [], requests = [] } = allocationData;
    const totalValue = allocationData.total_contract_value || allocationData.approved_value || 0;
    const sortedSchedules = [...schedules].sort((a: any, b: any) => a.installment_number - b.installment_number);

    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-905 font-sans antialiased pb-12">
        {/* Header Toolbar */}
        <div className="bg-white dark:bg-white border-b border-slate-200 dark:border-slate-200 p-4 sticky top-0 z-10 no-print">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-sidebar-navy dark:text-action-cyan uppercase tracking-wider">
                Relatório Unificado de Faturamentos
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.close()}
                className="bg-slate-150 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                Fechar Aba
              </button>
              <button
                onClick={handlePrintAndExport}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / Salvar PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Print Document */}
        <div className="relative max-w-4xl mx-auto bg-white p-12 mt-6 border border-slate-200 shadow-sm print-doc min-h-[297mm] flex flex-col justify-between overflow-hidden">
          {freelancer?.cnpj_is_mock && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-[100] opacity-[0.08]">
              <div className="watermark-text text-red-600 text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-widest whitespace-nowrap rotate-[-30deg] text-center leading-none">
                DOCUMENTO DE TESTE — CNPJ MOCK — NÃO PROCESSAR PAGAMENTO
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div className="flex justify-between items-start border-b-2 border-slate-200 pb-6">
              <div>
                <div className="font-extrabold text-lg text-slate-900 tracking-wider">
                  V3A <span className="text-slate-600">| FREELA HUB</span>
                </div>
                <p className="text-[10px] text-slate-600 uppercase tracking-widest mt-1">
                  Plataforma de Alocação e Auditoria Comercial
                </p>
              </div>
              <div className="text-right">
                <span className="bg-slate-100 text-slate-900 font-mono text-xs font-bold px-3 py-1 rounded border border-slate-200">
                  {allocationData.allocation_code}
                </span>
                <div className="text-[10px] text-slate-600 mt-2">
                  Gerado em: <strong>{new Date().toLocaleDateString('pt-BR')}</strong>
                </div>
              </div>
            </div>

            <div className="text-center py-4 bg-slate-50 border border-slate-200 rounded-xl">
              <h1 className="text-base font-extrabold text-slate-900 uppercase tracking-wide">
                Relatório Unificado de Faturamento
              </h1>
              <p className="text-[10px] text-slate-600 mt-0.5">
                Este relatório compila todas as parcelas e solicitações de faturamento programadas para esta alocação.
              </p>
            </div>

            {/* Section 1: Project Details */}
            <div className="space-y-2 text-left">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-l-4 border-slate-200 pl-2">
                1. Dados da Oportunidade e Alocação
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl text-[11px] border border-slate-150">
                <div>
                  <span className="text-slate-600 block">Job / Projeto:</span>
                  <strong className="text-slate-900">{job?.title || '—'}</strong>
                </div>
                <div>
                  <span className="text-slate-600 block">Cliente Final:</span>
                  <strong className="text-slate-900">{job?.client_name || '—'}</strong>
                </div>
                <div>
                  <span className="text-slate-600 block">Núcleo Responsável:</span>
                  <strong className="text-slate-900">{nucleo?.name || '—'}</strong>
                </div>
                <div>
                  <span className="text-slate-600 block">Período Contrato:</span>
                  <strong className="text-slate-900">
                    {formatISODateToBR(allocationData.start_date)} a {formatISODateToBR(allocationData.end_date)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-600 block">Modelo de Pagamento:</span>
                  <strong className="text-slate-900 uppercase">
                    {allocationData.payment_model === 'monthly_recurring' ? 'Recorrente Mensal' : 'Pagamento Único'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-600 block">Condições de Pagamento:</span>
                  <strong className="text-slate-900">{allocationData.payment_terms || '—'}</strong>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-600 block">Valor Total Homologado:</span>
                  <strong className="text-slate-900 text-sm font-bold font-mono">
                    {formatCurrencyBRL(totalValue)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Section 2: Freelancer Details */}
            <div className="space-y-2 text-left">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-l-4 border-slate-200 pl-2">
                2. Informações Cadastrais do Profissional
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl text-[11px] border border-slate-150">
                <div className="sm:col-span-2">
                  <span className="text-slate-600 block">Nome Completo:</span>
                  <strong className="text-slate-900">{freelancer?.full_name}</strong>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-550 block">E-mail:</span>
                  <strong className="text-slate-900">{freelancer?.email}</strong>
                </div>
                <div>
                  <span className="text-slate-600 block">WhatsApp:</span>
                  <strong className="text-slate-900">{freelancer?.whatsapp}</strong>
                </div>
                <div>
                  <span className="text-slate-550 block">Cidade / Estado:</span>
                  <strong className="text-slate-900">{freelancer?.city} - {freelancer?.state}</strong>
                </div>
                <div>
                  {(!freelancer?.tax_country_code || freelancer?.tax_country_code === 'BR') ? (
                    <>
                      <span className="text-slate-600 block">CNPJ:</span>
                      <strong className="text-slate-900 font-mono">
                        {freelancer?.cnpj_normalized ? formatCnpj(freelancer.cnpj_normalized) : 'Não informado'}
                      </strong>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-600 block">Tax ID Estrangeiro:</span>
                      <strong className="text-slate-900 font-mono">
                        {freelancer?.foreign_tax_id || 'Não informado'}
                      </strong>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Section 3: Periodic Installments Details Table */}
            <div className="space-y-2 text-left">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-l-4 border-slate-200 pl-2">
                3. Detalhamento do Cronograma de Parcelas
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                      <th className="p-2.5">Parcela</th>
                      <th className="p-2.5">Período de Ref.</th>
                      <th className="p-2.5">Vencimento</th>
                      <th className="p-2.5">Cód. ERP</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {sortedSchedules.map((sch: any) => {
                      const req = requests.find((r: any) => r.payment_schedule_id === sch.id);
                      return (
                        <tr key={sch.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-bold">#{sch.installment_number}</td>
                          <td className="p-2.5 text-slate-600">
                            {formatISODateToBR(sch.reference_period_start)} a {formatISODateToBR(sch.reference_period_end)}
                          </td>
                          <td className="p-2.5 text-slate-600">{sch.due_date ? formatISODateToBR(sch.due_date) : '—'}</td>
                          <td className="p-2.5 font-mono text-slate-700">{sch.finance_code || (req?.finance_code) || '—'}</td>
                          <td className="p-2.5 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-[4px] text-[9px] font-bold uppercase ${
                              sch.status === 'pending'
                                ? 'bg-slate-150 text-slate-700 border border-slate-250'
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
                          <td className="p-2.5 text-right font-bold font-mono text-slate-900">
                            {formatCurrencyBRL(sch.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-350 pt-6 mt-12 text-center text-[10px] text-slate-600 space-y-1">
            <p>Este relatório unificado foi gerado e homologado digitalmente através da plataforma V3A Freela Hub.</p>
            <p>&copy; {new Date().getFullYear()} V3A Live Marketing S.A. Todos os direitos reservados.</p>
          </div>
        </div>
      </div>
    );
  }

  const { freelancer, job, allocation, nucleo, issuer } = requestData;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 font-sans antialiased pb-12">
      {/* 1. Header Toolbar (Hidden during Print) */}
      <div className="bg-white dark:bg-white border-b border-slate-200 dark:border-slate-200 p-4 sticky top-0 z-10 no-print">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-sidebar-navy dark:text-action-cyan uppercase tracking-wider">
              Solicitação de Faturamento
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => window.close()}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              Fechar Aba
            </button>
            <button
              onClick={handlePrintAndExport}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Salvar PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Print Document (Premium A4 Layout) */}
      <div className="relative max-w-4xl mx-auto bg-white p-12 mt-6 border border-slate-200 shadow-sm print-doc min-h-[297mm] flex flex-col justify-between overflow-hidden">
        {freelancer?.cnpj_is_mock && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-[100] opacity-[0.08]">
            <div className="watermark-text text-red-600 text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-widest whitespace-nowrap rotate-[-30deg] text-center leading-none">
              DOCUMENTO DE TESTE — CNPJ MOCK — NÃO PROCESSAR PAGAMENTO
            </div>
          </div>
        )}
        
        {/* Document Header */}
        <div className="space-y-6">
          <div className="flex justify-between items-start border-b-2 border-slate-200 pb-6">
            <div>
              {/* Logo / Company Info */}
              <div className="font-extrabold text-lg text-slate-900 tracking-wider">
                V3A <span className="text-slate-600">| FREELA HUB</span>
              </div>
              <p className="text-[10px] text-slate-600 uppercase tracking-widest mt-1">
                Plataforma de Alocação e Auditoria Comercial
              </p>
            </div>
            <div className="text-right">
              <span className="bg-slate-100 text-slate-900 font-mono text-xs font-bold px-3 py-1 rounded border border-slate-200">
                {requestData.request_code}
              </span>
              <div className="text-[10px] text-slate-600 mt-2">
                Emissão: <strong>{new Date(requestData.created_at).toLocaleDateString('pt-BR')}</strong>
              </div>
            </div>
          </div>

          <div className="text-center py-4 bg-slate-50 border border-slate-200 rounded-xl">
            <h1 className="text-base font-extrabold text-slate-900 uppercase tracking-wide">
              Solicitação Operacional de Pagamento de Freelancer
            </h1>
            <p className="text-[10px] text-slate-600 mt-0.5">
              Este documento formaliza as tranches operacionais acordadas para envio ao departamento financeiro.
            </p>
          </div>

          {/* Section 1: Project Details */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-l-4 border-slate-200 pl-2">
              1. Dados da Oportunidade e Alocação
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl text-[11px] border border-slate-150">
              <div>
                <span className="text-slate-600 block">Job / Projeto:</span>
                <strong className="text-slate-900">{job?.title}</strong>
              </div>
              <div>
                <span className="text-slate-600 block">Cliente Final:</span>
                <strong className="text-slate-900">{job?.client_name}</strong>
              </div>
              <div>
                <span className="text-slate-600 block">Núcleo Responsável:</span>
                <strong className="text-slate-900">{nucleo?.name}</strong>
              </div>
              <div>
                <span className="text-slate-600 block">Código Alocação:</span>
                <strong className="text-slate-900 font-mono">{allocation?.allocation_code}</strong>
              </div>
            </div>
          </div>

          {/* Section 2: Freelancer Details */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-l-4 border-slate-200 pl-2">
              2. Informações Cadastrais do Profissional
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl text-[11px] border border-slate-150">
              <div className="sm:col-span-2">
                <span className="text-slate-600 block">Nome Completo:</span>
                <strong className="text-slate-900">{freelancer?.full_name}</strong>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-550 block">E-mail:</span>
                <strong className="text-slate-900">{freelancer?.email}</strong>
              </div>
              <div>
                <span className="text-slate-600 block">WhatsApp:</span>
                <strong className="text-slate-900">{freelancer?.whatsapp}</strong>
              </div>
              <div>
                <span className="text-slate-550 block">Cidade / Estado:</span>
                <strong className="text-slate-900">{freelancer?.city} - {freelancer?.state}</strong>
              </div>
              <div>
                <span className="text-slate-550 block">País de Residência:</span>
                <strong className="text-slate-900 uppercase">{freelancer?.tax_country_code || 'BR'}</strong>
              </div>
              <div>
                {(!freelancer?.tax_country_code || freelancer?.tax_country_code === 'BR') ? (
                  <>
                    <span className="text-slate-550 block">CNPJ:</span>
                    <strong className="text-slate-900 font-mono">
                      {freelancer?.cnpj_normalized ? formatCnpj(freelancer.cnpj_normalized) : 'Não informado'}
                      {freelancer?.cnpj_is_mock && (
                        <span className="ml-1 text-[9px] bg-red-100 text-red-800 px-1 py-0.5 rounded font-sans font-bold">
                          MOCK
                        </span>
                      )}
                    </strong>
                  </>
                ) : (
                  <>
                    <span className="text-slate-550 block">Tax ID Estrangeiro:</span>
                    <strong className="text-slate-900 font-mono">
                      {freelancer?.foreign_tax_id || 'Não informado'}
                    </strong>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Financial & Commercial Data */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-l-4 border-slate-200 pl-2">
              3. Dados Fiscais & Comerciais
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl text-[11px] border border-slate-150">
              <div>
                <span className="text-slate-550 block">Modelo Faturamento:</span>
                <strong className="text-slate-900 uppercase">
                  {requestData.request_type === 'recurring_installment' ? 'Recorrente Mensal' : 'Parcela Única'}
                </strong>
              </div>
              <div>
                <span className="text-slate-550 block">Parcela Operacional:</span>
                <strong className="text-slate-900">
                  {requestData.payment_number} de {requestData.total_payments}
                </strong>
              </div>
              <div>
                <span className="text-slate-555 block">Período de Referência:</span>
                <strong className="text-slate-900">
                  {formatISODateToBR(requestData.reference_period_start)} a {formatISODateToBR(requestData.reference_period_end)}
                </strong>
              </div>
              <div>
                <span className="text-slate-555 block">Vencimento da Parcela:</span>
                <strong className="text-slate-900">
                  {formatISODateToBR(requestData.payment_due_date)}
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 bg-slate-50 p-4 rounded-xl text-[11px] border border-slate-150">
              <div>
                <span className="text-slate-555 block">Descrição do Faturamento:</span>
                <p className="text-slate-900 font-semibold">{requestData.payment_description || 'Faturamento operacional do freela.'}</p>
              </div>
              <div className="text-right flex flex-col justify-center">
                <span className="text-slate-555 block text-xs">VALOR DESTA PARCELA:</span>
                <strong className="text-lg text-emerald-700 font-mono font-extrabold">
                  {formatCurrencyBRL(requestData.amount)}
                </strong>
              </div>
            </div>
          </div>

          {/* Section 4: Audit & Authorization details */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-l-4 border-slate-200 pl-2">
              4. Auditoria e Controle de Alocação
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl text-[11px] border border-slate-150">
              <div>
                <span className="text-slate-555 block">Emissor V3A:</span>
                <strong className="text-slate-900">{issuer?.full_name || 'Usuário do Núcleo'}</strong>
              </div>
              <div>
                <span className="text-slate-555 block">Cargo Emissor:</span>
                <strong className="text-slate-900 uppercase">{requestData.issued_by_role}</strong>
              </div>
              <div>
                <span className="text-slate-555 block">Saving do Job:</span>
                <strong className="text-slate-900">
                  {formatCurrencyBRL(allocation?.budget_saving_amount || 0)} ({Math.round(allocation?.budget_saving_percentage || 0)}%)
                </strong>
              </div>
              <div>
                <span className="text-slate-555 block">Status Governança:</span>
                <strong className="text-slate-900 uppercase">Aprovado pelo Núcleo</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info (Standard A4 footer) */}
        <div className="border-t border-slate-350 pt-6 mt-12 text-center text-[10px] text-slate-600 space-y-1">
          <p>Este documento foi emitido e homologado digitalmente através da plataforma V3A Freela Hub.</p>
          <p>&copy; {new Date().getFullYear()} V3A Live Marketing S.A. Todos os direitos reservados.</p>
        </div>
      </div>

      {/* Print Specific CSS Rules */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-doc {
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
          .watermark-text {
            color: rgba(220, 38, 38, 0.12) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
