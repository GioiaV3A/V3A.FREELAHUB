'use client';

import React, { useState } from 'react';
import { 
  calculateAllocationDays,
  calculateNegotiatedTotal,
  calculateBudgetSaving,
  formatCurrencyBRL,
  formatPercentage,
  getBudgetDeltaStatus
} from '@/lib/financial';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle, 
  ChevronDown, 
  ChevronUp,
  Calendar,
  Clock,
  DollarSign
} from 'lucide-react';

interface NegotiationFinancialSummaryProps {
  budget: number;
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  negotiatedRate: number | null | undefined;
  remunerationModel: string | null | undefined;
  estimatedHours?: number | null | undefined;
  showDetailedBreakdown?: boolean;
  variant?: 'compact' | 'detailed';
}

export default function NegotiationFinancialSummary({
  budget,
  startDate,
  endDate,
  negotiatedRate,
  remunerationModel,
  estimatedHours,
  showDetailedBreakdown = true,
  variant = 'detailed'
}: NegotiationFinancialSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);

  const allocationDays = calculateAllocationDays(startDate, endDate);
  const negotiatedTotal = calculateNegotiatedTotal({
    negotiatedRate,
    remunerationModel,
    allocationDays,
    estimatedHours
  });

  const { savingAmount, savingPercentage } = calculateBudgetSaving({
    budget,
    negotiatedTotal
  });

  const deltaStatus = getBudgetDeltaStatus({
    budget,
    negotiatedTotal
  });

  const dailyBudgetReference = allocationDays > 0 ? budget / allocationDays : budget;
  
  const dailySavingAmount = (remunerationModel?.toLowerCase() === 'diária' || remunerationModel?.toLowerCase() === 'diaria')
    ? (negotiatedRate !== null && negotiatedRate !== undefined ? dailyBudgetReference - negotiatedRate : null)
    : null;

  // Visual Styling Mapping based on financial status
  let themeStyles = {
    bg: 'bg-slate-50 dark:bg-slate-800/40',
    border: 'border-slate-200 dark:border-slate-700/50',
    text: 'text-slate-700 dark:text-slate-350',
    accentText: 'text-slate-900 dark:text-slate-200',
    badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    icon: <DollarSign className="w-5 h-5 text-slate-500" />,
    label: 'Sem cálculo',
    statusLabel: 'not_calculated'
  };

  if (deltaStatus === 'saving') {
    themeStyles = {
      bg: 'bg-emerald-50/70 dark:bg-emerald-950/20',
      border: 'border-emerald-200 dark:border-emerald-900/40',
      text: 'text-emerald-800 dark:text-emerald-350',
      accentText: 'text-emerald-900 dark:text-emerald-255',
      badgeBg: 'bg-emerald-100/90 dark:bg-emerald-950/45 text-emerald-800 dark:text-emerald-300 border-emerald-300/80 dark:border-emerald-800/70',
      icon: <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />,
      label: 'Saving gerado',
      statusLabel: 'Dentro do budget'
    };
  } else if (deltaStatus === 'neutral') {
    themeStyles = {
      bg: 'bg-slate-50 dark:bg-slate-800/40',
      border: 'border-slate-200 dark:border-slate-700/50',
      text: 'text-slate-700 dark:text-slate-350',
      accentText: 'text-slate-900 dark:text-slate-200',
      badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
      icon: <CheckCircle className="w-5 h-5 text-slate-600 dark:text-slate-400" />,
      label: 'Sem saving',
      statusLabel: 'Sem saving'
    };
  } else if (deltaStatus === 'over_budget') {
    themeStyles = {
      bg: 'bg-red-50/70 dark:bg-red-950/20',
      border: 'border-red-200 dark:border-red-900/40',
      text: 'text-red-800 dark:text-red-350',
      accentText: 'text-red-900 dark:text-red-255',
      badgeBg: 'bg-red-100/90 dark:bg-red-950/45 text-red-800 dark:text-red-300 border-red-300/85 dark:border-red-800/70',
      icon: <AlertCircle className="w-5 h-5 text-red-650 dark:text-red-500" />,
      label: 'Estouro de budget',
      statusLabel: 'Acima do budget'
    };
  }

  const formattedPeriod = (startDate && endDate)
    ? `${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}`
    : 'A definir';

  // RENDER COMPACT VARIANT
  if (variant === 'compact') {
    return (
      <div className={`p-4 rounded-xl border ${themeStyles.bg} ${themeStyles.border} space-y-2`}>
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            {themeStyles.icon}
            <span className="text-xs font-bold text-sidebar-navy dark:text-white uppercase tracking-wider">
              Resumo Financeiro
            </span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${themeStyles.badgeBg}`}>
            {themeStyles.statusLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
          <div>
            <span className="text-[10px] text-text-secondary block">Total Negociado:</span>
            <strong className="text-sidebar-navy dark:text-white font-extrabold">{formatCurrencyBRL(negotiatedTotal)}</strong>
          </div>
          <div>
            <span className="text-[10px] text-text-secondary block">Budget Job:</span>
            <strong className="text-sidebar-navy dark:text-white font-bold">{formatCurrencyBRL(budget)}</strong>
          </div>
          <div className="col-span-2">
            <span className="text-[10px] text-text-secondary block">
              {deltaStatus === 'over_budget' ? 'Estouro vs Budget:' : 'Saving Gerado:'}
            </span>
            <strong className={`${deltaStatus === 'over_budget' ? 'text-red-600 dark:text-red-400' : deltaStatus === 'saving' ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-primary'} font-extrabold`}>
              {deltaStatus === 'over_budget' 
                ? `Estouro: ${formatCurrencyBRL(savingAmount !== null ? Math.abs(savingAmount) : null)}` 
                : formatCurrencyBRL(savingAmount)
              }
              {savingPercentage !== null && (
                <span className="text-[10px] font-normal text-text-secondary ml-1">
                  ({deltaStatus === 'over_budget' 
                    ? `${Math.abs(Math.round(savingPercentage))}% acima` 
                    : formatPercentage(savingPercentage)
                  })
                </span>
              )}
            </strong>
          </div>
        </div>
      </div>
    );
  }

  // RENDER DETAILED VARIANT
  return (
    <div className={`p-5 rounded-2xl border ${themeStyles.bg} ${themeStyles.border} space-y-4`}>
      {/* Header */}
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {themeStyles.icon}
          <div>
            <h4 className="font-extrabold text-sidebar-navy dark:text-white text-xs uppercase tracking-wider">
              Resumo Financeiro da Negociação
            </h4>
            <p className="text-[10px] text-text-secondary">Comparação do rate acordado com o budget planejado.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border uppercase tracking-wide ${themeStyles.badgeBg}`}>
            {themeStyles.label}
          </span>
        </div>
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-dashed border-slate-200 dark:border-slate-700/50 pb-4">
        <div className="bg-white/40 dark:bg-slate-900/30 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/30">
          <span className="text-[10px] text-text-secondary block uppercase font-bold tracking-wider mb-0.5">Budget do Job</span>
          <div className="text-base font-extrabold text-sidebar-navy dark:text-white">{formatCurrencyBRL(budget)}</div>
          <span className="text-[10px] text-text-secondary">
            Ref. Diária: <strong>{formatCurrencyBRL(dailyBudgetReference)}</strong>
          </span>
        </div>

        <div className="bg-white/40 dark:bg-slate-900/30 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/30">
          <span className="text-[10px] text-text-secondary block uppercase font-bold tracking-wider mb-0.5">Total Negociado</span>
          <div className="text-base font-extrabold text-sidebar-navy dark:text-white">
            {negotiatedTotal !== null ? formatCurrencyBRL(negotiatedTotal) : '—'}
          </div>
          <span className="text-[10px] text-text-secondary">
            Taxa: <strong>{formatCurrencyBRL(negotiatedRate)}</strong> ({remunerationModel || 'Diária'})
          </span>
        </div>

        <div className="bg-white/40 dark:bg-slate-900/30 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/30">
          <span className="text-[10px] text-text-secondary block uppercase font-bold tracking-wider mb-0.5">
            {deltaStatus === 'over_budget' ? 'Estouro de Budget' : 'Saving Gerado'}
          </span>
          <div className={`text-base font-extrabold ${
            deltaStatus === 'over_budget' 
              ? 'text-red-650 dark:text-red-400' 
              : deltaStatus === 'saving' 
                ? 'text-emerald-650 dark:text-emerald-400' 
                : 'text-slate-600 dark:text-slate-300'
          }`}>
            {deltaStatus === 'over_budget' 
              ? `-${formatCurrencyBRL(savingAmount !== null ? Math.abs(savingAmount) : null)}` 
              : formatCurrencyBRL(savingAmount)
            }
          </div>
          <span className="text-[10px] text-text-secondary">
            {deltaStatus === 'over_budget' 
              ? `${savingPercentage !== null ? Math.abs(Math.round(savingPercentage)) : 0}% acima do budget` 
              : `${savingPercentage !== null ? Math.round(savingPercentage) : 0}% de saving`
            }
          </span>
        </div>
      </div>

      {/* Accordion Detailed Calculations */}
      {showDetailedBreakdown && (
        <div className="text-xs">
          {/* Mobile Accordion Toggle */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex sm:hidden w-full items-center justify-between p-2 bg-slate-100 dark:bg-slate-800 rounded-lg font-bold text-sidebar-navy dark:text-white transition-colors"
          >
            <span>{isOpen ? 'Ocultar Detalhes' : 'Ver Cálculo Detalhado'}</span>
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Table Container - Visible always on Desktop, Toggleable on Mobile */}
          <div className={`${isOpen ? 'block' : 'hidden sm:block'} pt-2 sm:pt-0 space-y-2`}>
            <div className="bg-white/20 dark:bg-slate-900/10 border border-slate-200/60 dark:border-slate-800/25 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <tbody>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50">
                    <td className="p-2.5 text-text-secondary font-medium">Período considerado:</td>
                    <td className="p-2.5 text-right font-semibold text-sidebar-navy dark:text-white flex justify-end items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-text-secondary" />
                      <span>{formattedPeriod}</span>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50">
                    <td className="p-2.5 text-text-secondary font-medium">Dias alocados:</td>
                    <td className="p-2.5 text-right font-semibold text-sidebar-navy dark:text-white">
                      {allocationDays} {allocationDays === 1 ? 'dia' : 'dias'}
                    </td>
                  </tr>
                  {remunerationModel?.toLowerCase() === 'hora' && (
                    <tr className="border-b border-slate-100 dark:border-slate-800/50">
                      <td className="p-2.5 text-text-secondary font-medium">Horas estimadas:</td>
                      <td className="p-2.5 text-right font-semibold text-sidebar-navy dark:text-white">
                        {estimatedHours ? `${estimatedHours}h` : <span className="text-red-500 font-bold">Não informada</span>}
                      </td>
                    </tr>
                  )}
                  {dailySavingAmount !== null && (
                    <tr>
                      <td className="p-2.5 text-text-secondary font-medium">Saving diário (se aplicável):</td>
                      <td className={`p-2.5 text-right font-semibold ${dailySavingAmount > 0 ? 'text-emerald-650 dark:text-emerald-450' : 'text-slate-600'}`}>
                        {formatCurrencyBRL(dailySavingAmount)}/dia
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Warn when over budget */}
            {deltaStatus === 'over_budget' && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl text-[11px] text-red-800 dark:text-red-400 flex items-start gap-2 leading-relaxed">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-500" />
                <div>
                  <span className="font-bold block">Alerta de Orçamento Estourado</span>
                  Esta negociação ultrapassa o budget definido. É necessário solicitar e anexar aprovação do Head do Núcleo.
                </div>
              </div>
            )}
            
            {/* Warning if Hora billing model and hours missing */}
            {remunerationModel?.toLowerCase() === 'hora' && !estimatedHours && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-[11px] text-amber-800 dark:text-amber-400 flex items-start gap-2 leading-relaxed">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-650 dark:text-amber-500" />
                <div>
                  <span className="font-bold block">Horas Estimadas Pendentes</span>
                  Insira a estimativa de horas para que seja calculado o total negociado. A homologação da alocação está bloqueada até que as horas sejam especificadas.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
