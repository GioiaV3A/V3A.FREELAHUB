export function calculateAllocationDays(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays > 0 ? diffDays : 0;
}

export interface CalculateNegotiatedTotalArgs {
  negotiatedRate: number | null | undefined;
  remunerationModel: string | null | undefined;
  allocationDays: number;
  estimatedHours?: number | null | undefined;
}

export function calculateNegotiatedTotal({
  negotiatedRate,
  remunerationModel,
  allocationDays,
  estimatedHours
}: CalculateNegotiatedTotalArgs): number | null {
  if (negotiatedRate === null || negotiatedRate === undefined || isNaN(negotiatedRate)) return null;
  const model = remunerationModel?.toLowerCase() || '';

  if (model === 'diária' || model === 'diaria') {
    return negotiatedRate * (allocationDays || 0);
  } else if (
    model === 'job fechado' ||
    model === 'valor fechado' ||
    model === 'pacote' ||
    model === 'projeto'
  ) {
    return negotiatedRate;
  } else if (model === 'hora') {
    if (estimatedHours === null || estimatedHours === undefined || isNaN(estimatedHours) || estimatedHours <= 0) {
      return null;
    }
    return negotiatedRate * estimatedHours;
  }
  return null;
}

export function calculateBudgetSaving({
  budget,
  negotiatedTotal
}: {
  budget: number | null | undefined;
  negotiatedTotal: number | null | undefined;
}) {
  if (
    budget === null ||
    budget === undefined ||
    isNaN(budget) ||
    negotiatedTotal === null ||
    negotiatedTotal === undefined ||
    isNaN(negotiatedTotal)
  ) {
    return { savingAmount: null, savingPercentage: null };
  }
  const savingAmount = budget - negotiatedTotal;
  const savingPercentage = budget > 0 ? (savingAmount / budget) * 100 : 0;
  return {
    savingAmount,
    savingPercentage
  };
}

export function formatCurrencyBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '—';
  // Round to nearest integer per example (e.g. 74%)
  return `${Math.round(value)}%`;
}

export function getBudgetDeltaStatus({
  budget,
  negotiatedTotal
}: {
  budget: number | null | undefined;
  negotiatedTotal: number | null | undefined;
}): 'saving' | 'neutral' | 'over_budget' | 'not_calculated' {
  if (
    budget === null ||
    budget === undefined ||
    isNaN(budget) ||
    negotiatedTotal === null ||
    negotiatedTotal === undefined ||
    isNaN(negotiatedTotal)
  ) {
    return 'not_calculated';
  }
  const saving = budget - negotiatedTotal;
  if (saving > 0) return 'saving';
  if (saving === 0) return 'neutral';
  return 'over_budget';
}
