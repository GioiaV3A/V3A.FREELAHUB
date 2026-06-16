'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { exportPaymentRequestAction } from '@/app/actions/admin';
import { formatCurrencyBRL, formatISODateToBR } from '@/lib/financial';
import { Printer, Download, ArrowLeft, Loader2, FileText, CheckCircle2 } from 'lucide-react';

export default function PrintPaymentRequestPage() {
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestData, setRequestData] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function fetchDetails() {
      try {
        const { data, error: fetchErr } = await supabase
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
          .single();

        if (fetchErr) throw fetchErr;
        setRequestData(data);
      } catch (err: any) {
        console.error('Error fetching faturamento:', err);
        setError('Não foi possível carregar a Solicitação de Pagamento.');
      } finally {
        setLoading(false);
      }
    }

    fetchDetails();
  }, [id]);

  const handlePrintAndExport = async () => {
    window.print();
    
    // Register export in background
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
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-8 h-8 text-action-cyan animate-spin" />
        <p className="mt-2 text-xs text-text-secondary">Carregando documento...</p>
      </div>
    );
  }

  if (error || !requestData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-red-100 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded-full mb-3">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="font-bold text-text-primary text-base">Erro ao Carregar Documento</h3>
        <p className="text-xs text-text-secondary mt-1">{error || 'Solicitação de pagamento inválida.'}</p>
      </div>
    );
  }

  const { freelancer, job, allocation, nucleo, issuer } = requestData;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 font-sans antialiased pb-12">
      {/* 1. Header Toolbar (Hidden during Print) */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 sticky top-0 z-10 no-print">
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
      <div className="max-w-4xl mx-auto bg-white p-12 mt-6 border border-slate-200 shadow-sm print-doc min-h-[297mm] flex flex-col justify-between">
        
        {/* Document Header */}
        <div className="space-y-6">
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6">
            <div>
              {/* Logo / Company Info */}
              <div className="font-extrabold text-lg text-slate-900 tracking-wider">
                V3A <span className="text-slate-500">| FREELA HUB</span>
              </div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
                Plataforma de Alocação e Auditoria Comercial
              </p>
            </div>
            <div className="text-right">
              <span className="bg-slate-100 text-slate-900 font-mono text-xs font-bold px-3 py-1 rounded border border-slate-200">
                {requestData.request_code}
              </span>
              <div className="text-[10px] text-slate-400 mt-2">
                Emissão: <strong>{new Date(requestData.created_at).toLocaleDateString('pt-BR')}</strong>
              </div>
            </div>
          </div>

          <div className="text-center py-4 bg-slate-50 border border-slate-200 rounded-xl">
            <h1 className="text-base font-extrabold text-slate-900 uppercase tracking-wide">
              Solicitação Operacional de Pagamento de Freelancer
            </h1>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Este documento formaliza as tranches operacionais acordadas para envio ao departamento financeiro.
            </p>
          </div>

          {/* Section 1: Project Details */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-l-4 border-slate-800 pl-2">
              1. Dados da Oportunidade e Alocação
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl text-[11px] border border-slate-150">
              <div>
                <span className="text-slate-500 block">Job / Projeto:</span>
                <strong className="text-slate-900">{job?.title}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Cliente Final:</span>
                <strong className="text-slate-900">{job?.client_name}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Núcleo Responsável:</span>
                <strong className="text-slate-900">{nucleo?.name}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Código Alocação:</span>
                <strong className="text-slate-900 font-mono">{allocation?.allocation_code}</strong>
              </div>
            </div>
          </div>

          {/* Section 2: Freelancer Details */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-l-4 border-slate-800 pl-2">
              2. Informações Cadastrais do Profissional
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl text-[11px] border border-slate-150">
              <div>
                <span className="text-slate-500 block">Nome Completo:</span>
                <strong className="text-slate-900">{freelancer?.full_name}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">E-mail:</span>
                <strong className="text-slate-900">{freelancer?.email}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">WhatsApp:</span>
                <strong className="text-slate-900">{freelancer?.whatsapp}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Cidade / Estado:</span>
                <strong className="text-slate-900">{freelancer?.city} - {freelancer?.state}</strong>
              </div>
            </div>
          </div>

          {/* Section 3: Financial & Commercial Data */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-l-4 border-slate-800 pl-2">
              3. Dados Fiscais & Comerciais
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl text-[11px] border border-slate-150">
              <div>
                <span className="text-slate-500 block">Modelo Faturamento:</span>
                <strong className="text-slate-900 uppercase">
                  {requestData.request_type === 'recurring_installment' ? 'Recorrente Mensal' : 'Parcela Única'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Parcela Operacional:</span>
                <strong className="text-slate-900">
                  {requestData.payment_number} de {requestData.total_payments}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Período de Referência:</span>
                <strong className="text-slate-900">
                  {formatISODateToBR(requestData.reference_period_start)} a {formatISODateToBR(requestData.reference_period_end)}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Vencimento da Parcela:</span>
                <strong className="text-slate-900">
                  {formatISODateToBR(requestData.payment_due_date)}
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 bg-slate-50 p-4 rounded-xl text-[11px] border border-slate-150">
              <div>
                <span className="text-slate-500 block">Descrição do Faturamento:</span>
                <p className="text-slate-900 font-semibold">{requestData.payment_description || 'Faturamento operacional do freela.'}</p>
              </div>
              <div className="text-right flex flex-col justify-center">
                <span className="text-slate-500 block text-xs">VALOR DESTA PARCELA:</span>
                <strong className="text-lg text-emerald-700 font-mono font-extrabold">
                  {formatCurrencyBRL(requestData.amount)}
                </strong>
              </div>
            </div>
          </div>

          {/* Section 4: Audit & Authorization details */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 border-l-4 border-slate-800 pl-2">
              4. Auditoria e Controle de Alocação
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl text-[11px] border border-slate-150">
              <div>
                <span className="text-slate-500 block">Emissor V3A:</span>
                <strong className="text-slate-900">{issuer?.full_name || 'Usuário do Núcleo'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Cargo Emissor:</span>
                <strong className="text-slate-900 uppercase">{requestData.issued_by_role}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Saving do Job:</span>
                <strong className="text-slate-900">
                  {formatCurrencyBRL(allocation?.budget_saving_amount || 0)} ({Math.round(allocation?.budget_saving_percentage || 0)}%)
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Status Governança:</span>
                <strong className="text-slate-900 uppercase">Aprovado pelo Núcleo</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info (Standard A4 footer) */}
        <div className="border-t border-slate-350 pt-6 mt-12 text-center text-[10px] text-slate-400 space-y-1">
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
        }
      `}</style>
    </div>
  );
}

function AlertTriangle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
