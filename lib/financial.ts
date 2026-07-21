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
  installmentsCount?: number | null | undefined;
}

export function calculateNegotiatedTotal({
  negotiatedRate,
  remunerationModel,
  allocationDays,
  estimatedHours,
  installmentsCount
}: CalculateNegotiatedTotalArgs): number | null {
  if (negotiatedRate === null || negotiatedRate === undefined || isNaN(negotiatedRate)) return null;
  const model = remunerationModel?.toLowerCase() || '';

  if (model === 'diária' || model === 'diaria' || model === 'daily') {
    return negotiatedRate * (allocationDays || 0);
  } else if (
    model === 'job fechado' ||
    model === 'valor fechado' ||
    model === 'pacote' ||
    model === 'projeto' ||
    model === 'fixed_job'
  ) {
    return negotiatedRate;
  } else if (model === 'hora' || model === 'hourly') {
    if (estimatedHours === null || estimatedHours === undefined || isNaN(estimatedHours) || estimatedHours <= 0) {
      return null;
    }
    return negotiatedRate * estimatedHours;
  } else if (
    model === 'mensal / salário' ||
    model === 'mensal' ||
    model === 'monthly_salary' ||
    model === 'monthly'
  ) {
    return negotiatedRate * (installmentsCount || 1);
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

export function formatCurrencyBR(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function parseCurrencyBR(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  
  let cleanValue = value.trim();
  cleanValue = cleanValue.replace(/R\$\s?/gi, '');
  cleanValue = cleanValue.replace(/[^\d,.-]/g, '');
  
  if (cleanValue.includes(',')) {
    cleanValue = cleanValue.replace(/\./g, '').replace(/,/g, '.');
  } else {
    if (/\.\d{3}$/.test(cleanValue)) {
      cleanValue = cleanValue.replace(/\./g, '');
    }
  }
  
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
}

export function maskCurrencyBRL(value: string): string {
  let clean = value.replace(/[^\d,]/g, '');
  
  const parts = clean.split(',');
  if (parts.length > 2) {
    clean = parts[0] + ',' + parts.slice(1).join('');
  }
  
  const commaIndex = clean.indexOf(',');
  let integerPart = commaIndex !== -1 ? clean.slice(0, commaIndex) : clean;
  let decimalPart = commaIndex !== -1 ? clean.slice(commaIndex + 1) : null;
  
  integerPart = integerPart.replace(/^0+(?!$)/, '');
  if (integerPart === '' && decimalPart !== null) {
    integerPart = '0';
  }
  
  if (integerPart) {
    const num = parseInt(integerPart, 10);
    if (!isNaN(num)) {
      integerPart = new Intl.NumberFormat('pt-BR').format(num);
    }
  }
  
  if (decimalPart !== null) {
    decimalPart = decimalPart.slice(0, 2);
    return `${integerPart},${decimalPart}`;
  }
  
  return integerPart;
}

export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '—';
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

export function parseBrazilianDateToISODate(value: string | null | undefined): string {
  if (!value) return '';
  const parts = value.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return value;
}

export function formatISODateToBR(value: string | null | undefined): string {
  if (!value) return '';
  const parts = value.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    return `${day}/${month}/${year}`;
  }
  return value;
}

export function calculateInclusiveDays(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): number {
  if (!startDate || !endDate) return 0;
  const startParts = startDate.split('-');
  const endParts = endDate.split('-');
  if (startParts.length !== 3 || endParts.length !== 3) return 0;
  
  const startYear = parseInt(startParts[0], 10);
  const startMonth = parseInt(startParts[1], 10) - 1;
  const startDay = parseInt(startParts[2], 10);
  
  const endYear = parseInt(endParts[0], 10);
  const endMonth = parseInt(endParts[1], 10) - 1;
  const endDay = parseInt(endParts[2], 10);
  
  const start = new Date(startYear, startMonth, startDay);
  const end = new Date(endYear, endMonth, endDay);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (end < start) return -1;
  
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}

export interface MonthlyPaymentScheduleResult {
  paymentDates: Date[];
  installmentsCount: number;
  suggestedMonthlyAmount: number;
  totalSuggestedAmount: number;
}

/**
 * Calculates a recurring monthly payment schedule.
 *
 * Rules:
 * - One payment per month on `paymentDay`.
 * - If the month doesn't have `paymentDay`, use the last day of that month.
 * - First included payment date must be >= startDate.
 * - Last included payment date must be <= endDate.
 *
 * @param startDate  ISO string "YYYY-MM-DD"
 * @param endDate    ISO string "YYYY-MM-DD"
 * @param paymentDay Day of the month (1-31)
 * @param budgetAmount Total budget amount
 */
export function calculateMonthlyPaymentSchedule(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  paymentDay: number,
  budgetAmount: number | null | undefined
): MonthlyPaymentScheduleResult {
  const empty: MonthlyPaymentScheduleResult = {
    paymentDates: [],
    installmentsCount: 0,
    suggestedMonthlyAmount: 0,
    totalSuggestedAmount: 0,
  };

  if (!startDate || !endDate) return empty;

  const startParts = startDate.split('-');
  const endParts = endDate.split('-');
  if (startParts.length !== 3 || endParts.length !== 3) return empty;

  const sYear = parseInt(startParts[0], 10);
  const sMonth = parseInt(startParts[1], 10) - 1; // 0-indexed
  const sDay = parseInt(startParts[2], 10);
  const eYear = parseInt(endParts[0], 10);
  const eMonth = parseInt(endParts[1], 10) - 1; // 0-indexed
  const eDay = parseInt(endParts[2], 10);

  const start = new Date(sYear, sMonth, sDay);
  const end = new Date(eYear, eMonth, eDay);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return empty;

  const day = Math.max(1, Math.min(31, Math.round(paymentDay)));
  const paymentDates: Date[] = [];

  // Iterate month by month starting from the month of startDate
  let curYear = sYear;
  let curMonth = sMonth;

  while (true) {
    // Find the last day of curYear/curMonth
    const lastDayOfMonth = new Date(curYear, curMonth + 1, 0).getDate();
    const actualDay = Math.min(day, lastDayOfMonth);
    const candidate = new Date(curYear, curMonth, actualDay);

    // If we've gone past the end date in month terms, stop
    if (candidate > end) break;

    // Include only if candidate is within [start, end]
    if (candidate >= start && candidate <= end) {
      paymentDates.push(candidate);
    }

    // Advance to next month
    curMonth += 1;
    if (curMonth > 11) {
      curMonth = 0;
      curYear += 1;
    }

    // Safety guard against infinite loop (max 120 months)
    if (paymentDates.length > 120) break;
  }

  const installmentsCount = paymentDates.length;
  const budget = budgetAmount ?? 0;
  const suggestedMonthlyAmount =
    installmentsCount > 0 && budget > 0
      ? Math.round((budget / installmentsCount) * 100) / 100
      : 0;
  const totalSuggestedAmount = suggestedMonthlyAmount * installmentsCount;

  return {
    paymentDates,
    installmentsCount,
    suggestedMonthlyAmount,
    totalSuggestedAmount,
  };
}

// ============================================================
// POLÍTICA DE VALORES — Cálculo de limite e status
// ============================================================

/**
 * Retorna o desconto de escopo fechado conforme a tabela de governança:
 * 1-5 dias: 0% | 6-10 dias: 5% | 11-20 dias: 10% | 21-30 dias: 15% | >30 dias: 20%
 */
export function getJobClosedDiscount(days: number): number {
  if (days <= 5) return 0;
  if (days <= 10) return 0.05;
  if (days <= 20) return 0.10;
  if (days <= 30) return 0.15;
  return 0.20;
}

export interface PolicyLimitArgs {
  /** Nome da função/cargo (ex: "Diretor de Arte") */
  role: string;
  /** Senioridade (ex: "Sênior") */
  seniority: string;
  /**
   * Modelo de remuneração negociado/configurado.
   * Valores esperados: 'daily' | 'diaria' | 'Diária' |
   *                    'monthly_salary' | 'mensal' | 'Mensal / Salário' |
   *                    'fixed_job' | 'pacote' | 'projeto' | 'Job Fechado'
   */
  remunerationModel: string;
  /** Data de início ISO (YYYY-MM-DD) */
  startDate: string;
  /** Data de fim ISO (YYYY-MM-DD) */
  endDate: string;
  /** Valor proposto (diária unitária, mensal unitária ou total fechado) */
  proposedAmount: number;
  /**
   * Lista de políticas carregadas do banco.
   * Cada policy deve ter: role, seniority, billingType, referenceValue, ceilingValue, remunerationModel
   */
  policies: Array<{
    role: string;
    seniority: string;
    billingType: string;
    referenceValue: number;
    ceilingValue: number;
    remunerationModel?: string;
    status?: string;
  }>;
  /** Número de parcelas (para modelo mensal). Se não informado, calcula pela quantidade de meses. */
  installmentsCount?: number;
}

export interface PolicyLimitResult {
  /** Status da política */
  policyStatus: 'inside_policy' | 'above_policy' | 'policy_missing';
  /** Valor de referência aplicável (total) */
  referenceAmount: number | null;
  /** Teto aplicável (total) */
  limitAmount: number | null;
  /** Valor total proposto (calculado) */
  proposedTotal: number;
  /** Valor excedente (0 se dentro) */
  excessAmount: number;
  /** Percentual excedente (0 se dentro) */
  excessPercent: number;
  /** Dias alocados calculados */
  calculatedDays: number;
  /** Desconto aplicado (apenas para Job Fechado, 0 a 0.20) */
  appliedDiscount: number;
  /** Modelo base que originou o cálculo */
  baseModel: 'daily' | 'monthly' | 'fixed_job' | 'unknown';
  /** Diária teto da política (valor unitário) */
  dailyCeilingUnit: number | null;
  /** Mensal teto da política (valor unitário) */
  monthlyCeilingUnit: number | null;
  /** Mensagem descritiva para exibição no UI */
  message: string;
}

/**
 * Calcula o limite de política para um job com base no modelo de remuneração,
 * período e políticas cadastradas.
 *
 * Regras:
 * - Diária: limit = diaria_teto * dias
 * - Mensal: limit = mensal_teto * qtd_parcelas
 * - Job Fechado: teto_bruto = diaria_teto * dias; aplicar desconto de duração
 */
export function calculatePolicyLimitForJob(args: PolicyLimitArgs): PolicyLimitResult {
  const { role, seniority, remunerationModel, startDate, endDate, proposedAmount, policies, installmentsCount } = args;

  const calculatedDays = calculateInclusiveDays(startDate, endDate);

  const empty: PolicyLimitResult = {
    policyStatus: 'policy_missing',
    referenceAmount: null,
    limitAmount: null,
    proposedTotal: proposedAmount,
    excessAmount: 0,
    excessPercent: 0,
    calculatedDays,
    appliedDiscount: 0,
    baseModel: 'unknown',
    dailyCeilingUnit: null,
    monthlyCeilingUnit: null,
    message: 'Não existe política cadastrada para esta função/senioridade/modelo.',
  };

  if (!role || !seniority || !remunerationModel || proposedAmount <= 0) return empty;

  // Normalizar modelo de remuneração
  const modelRaw = remunerationModel.toLowerCase().trim();
  const isDaily = ['daily', 'diaria', 'diária'].includes(modelRaw);
  const isMonthly = ['monthly_salary', 'mensal', 'mensal / salário', 'salário por período', 'monthly'].includes(modelRaw);
  const isFixedJob = ['fixed_job', 'pacote', 'projeto', 'job fechado', 'valor fechado', 'fixed'].includes(modelRaw);

  // Normalizar role e seniority para comparação
  const normalizeStr = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normRole = normalizeStr(role);
  const normSeniority = normalizeStr(seniority);

  // Encontrar política diária para este cargo/senioridade
  const dailyPolicy = policies.find(p => {
    if (p.status === 'Inativo') return false;
    const pNormRole = normalizeStr(p.role);
    const pNormSeniority = normalizeStr(p.seniority);
    const isRoleMatch = pNormRole === normRole;
    const isSeniorityMatch = pNormSeniority === normSeniority;
    const isDailyBilling = ['Diária', 'daily'].includes(p.billingType) || p.remunerationModel === 'daily';
    return isRoleMatch && isSeniorityMatch && isDailyBilling;
  });

  // Encontrar política mensal
  const monthlyPolicy = policies.find(p => {
    if (p.status === 'Inativo') return false;
    const pNormRole = normalizeStr(p.role);
    const pNormSeniority = normalizeStr(p.seniority);
    const isRoleMatch = pNormRole === normRole;
    const isSeniorityMatch = pNormSeniority === normSeniority;
    const isMonthlyBilling = ['Mensal / Salário', 'monthly_salary'].includes(p.billingType) || p.remunerationModel === 'monthly_salary';
    return isRoleMatch && isSeniorityMatch && isMonthlyBilling;
  });

  // Capturar unidades
  const dailyCeilingUnit = dailyPolicy ? Number(dailyPolicy.ceilingValue) : null;
  const dailyReferenceUnit = dailyPolicy ? Number(dailyPolicy.referenceValue) : null;
  const monthlyCeilingUnit = monthlyPolicy ? Number(monthlyPolicy.ceilingValue) : null;
  const monthlyReferenceUnit = monthlyPolicy ? Number(monthlyPolicy.referenceValue) : null;

  // --- Modelo: Diária ---
  if (isDaily) {
    if (!dailyPolicy || dailyCeilingUnit === null) {
      return { ...empty, dailyCeilingUnit, monthlyCeilingUnit, baseModel: 'daily' };
    }
    const days = calculatedDays > 0 ? calculatedDays : 1;
    const refTotal = dailyReferenceUnit! * days;
    const limitTotal = dailyCeilingUnit * days;
    const proposedTotal = proposedAmount; // proposedAmount = diária unitária
    const proposedTotalAll = proposedAmount * days;
    const excessAmount = Math.max(0, proposedTotal - dailyCeilingUnit);
    const excessPercent = dailyCeilingUnit > 0 ? (excessAmount / dailyCeilingUnit) * 100 : 0;
    const policyStatus: PolicyLimitResult['policyStatus'] = proposedTotal > dailyCeilingUnit ? 'above_policy' : 'inside_policy';

    return {
      policyStatus,
      referenceAmount: refTotal,
      limitAmount: limitTotal,
      proposedTotal: proposedTotalAll,
      excessAmount: Math.max(0, proposedTotalAll - limitTotal),
      excessPercent: limitTotal > 0 ? (Math.max(0, proposedTotalAll - limitTotal) / limitTotal) * 100 : 0,
      calculatedDays: days,
      appliedDiscount: 0,
      baseModel: 'daily',
      dailyCeilingUnit,
      monthlyCeilingUnit,
      message: policyStatus === 'above_policy'
        ? `Diária R$ ${proposedAmount} excede o teto de R$ ${dailyCeilingUnit} por ${excessPercent.toFixed(1)}%.`
        : `Diária R$ ${proposedAmount} dentro do teto de R$ ${dailyCeilingUnit}.`,
    };
  }

  // --- Modelo: Mensal ---
  if (isMonthly) {
    if (!monthlyPolicy || monthlyCeilingUnit === null) {
      return { ...empty, dailyCeilingUnit, monthlyCeilingUnit, baseModel: 'monthly' };
    }
    // Calcular parcelas: se informado usa, senão calcula pelos meses do período
    let parcelas = installmentsCount ?? 1;
    if (!installmentsCount && startDate && endDate) {
      const sched = calculateMonthlyPaymentSchedule(startDate, endDate, 15, 1);
      parcelas = Math.max(1, sched.installmentsCount);
    }
    const refTotal = monthlyReferenceUnit! * parcelas;
    const limitTotal = monthlyCeilingUnit * parcelas;
    const proposedTotal = proposedAmount * parcelas;
    const excessTotal = Math.max(0, proposedTotal - limitTotal);
    const excessPercent = limitTotal > 0 ? (excessTotal / limitTotal) * 100 : 0;
    const policyStatus: PolicyLimitResult['policyStatus'] = proposedAmount > monthlyCeilingUnit ? 'above_policy' : 'inside_policy';

    return {
      policyStatus,
      referenceAmount: refTotal,
      limitAmount: limitTotal,
      proposedTotal,
      excessAmount: excessTotal,
      excessPercent,
      calculatedDays,
      appliedDiscount: 0,
      baseModel: 'monthly',
      dailyCeilingUnit,
      monthlyCeilingUnit,
      message: policyStatus === 'above_policy'
        ? `Mensal R$ ${proposedAmount} excede o teto de R$ ${monthlyCeilingUnit} por ${excessPercent.toFixed(1)}%.`
        : `Mensal R$ ${proposedAmount} dentro do teto de R$ ${monthlyCeilingUnit}.`,
    };
  }

  // --- Modelo: Job Fechado (derivado da diária) ---
  if (isFixedJob) {
    if (!dailyPolicy || dailyCeilingUnit === null) {
      return {
        ...empty,
        dailyCeilingUnit,
        monthlyCeilingUnit,
        baseModel: 'fixed_job',
        message: 'Não existe política diária cadastrada para calcular o teto de job fechado.',
      };
    }
    const days = calculatedDays > 0 ? calculatedDays : 1;
    const discount = getJobClosedDiscount(days);
    const tetoBruto = dailyCeilingUnit * days;
    const tetoFechado = tetoBruto * (1 - discount);
    const refBruto = dailyReferenceUnit! * days;
    const refFechado = refBruto * (1 - discount);

    // proposedAmount = valor total do job fechado
    const excessAmount = Math.max(0, proposedAmount - tetoFechado);
    const excessPercent = tetoFechado > 0 ? (excessAmount / tetoFechado) * 100 : 0;
    const policyStatus: PolicyLimitResult['policyStatus'] = proposedAmount > tetoFechado ? 'above_policy' : 'inside_policy';

    return {
      policyStatus,
      referenceAmount: refFechado,
      limitAmount: tetoFechado,
      proposedTotal: proposedAmount,
      excessAmount,
      excessPercent,
      calculatedDays: days,
      appliedDiscount: discount,
      baseModel: 'fixed_job',
      dailyCeilingUnit,
      monthlyCeilingUnit,
      message: policyStatus === 'above_policy'
        ? `Job Fechado R$ ${proposedAmount.toFixed(2)} excede o teto estimado de R$ ${tetoFechado.toFixed(2)} (diária teto R$ ${dailyCeilingUnit} × ${days} dias × desconto ${(discount * 100).toFixed(0)}%).`
        : `Job Fechado R$ ${proposedAmount.toFixed(2)} dentro do teto estimado de R$ ${tetoFechado.toFixed(2)}.`,
    };
  }

  return empty;
}

export interface PaymentProjectionSim {
  cycleNumber: number;
  startDate: string;
  endDate: string;
  suggestedPaymentDate: string;
  suggestedRcDeadline: string;
  alertLevel: 'informational' | 'attention' | 'urgent' | 'critical';
  memory: string;
}

function findLastTuesdayOrBefore(targetDate: Date): Date {
  const d = new Date(targetDate);
  const day = d.getDay();
  const diff = (day - 2 + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function simulatePaymentProjections(
  startDateStr: string,
  endDateStr: string
): PaymentProjectionSim[] {
  const projections: PaymentProjectionSim[] = [];
  if (!startDateStr || !endDateStr) return projections;

  const startParts = startDateStr.split('-');
  const endParts = endDateStr.split('-');
  if (startParts.length !== 3 || endParts.length !== 3) return projections;
  
  const start = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]));
  const end = new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2]));
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return projections;

  const duration = Math.round((end.getTime() - start.getTime()) / (1005 * 60 * 60 * 24)) + 1; // Wait, duration inclusive calculation: end - start + 1
  const actualDuration = end.getDate() - start.getDate() + 1; // Actually, let's use reliable date difference:
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const formatDateISO = (d: Date): string => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getAlertLevel = (rcDeadline: Date, allocationStart: Date): 'informational' | 'attention' | 'urgent' | 'critical' => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rc = new Date(rcDeadline);
    rc.setHours(0, 0, 0, 0);
    const allocStart = new Date(allocationStart);
    allocStart.setHours(0, 0, 0, 0);

    const diffDays = Math.round((rc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0 || rc < allocStart) {
      return 'critical';
    } else if (diffDays <= 3) {
      return 'urgent';
    } else if (diffDays <= 10) {
      return 'attention';
    } else {
      return 'informational';
    }
  };

  if (diffDays <= 15) {
    const limitDate = new Date(end);
    limitDate.setDate(limitDate.getDate() + 15);
    let payDate = findLastTuesdayOrBefore(limitDate);
    if (payDate <= end) {
      payDate.setDate(payDate.getDate() + 7);
    }
    const rcDate = new Date(payDate);
    rcDate.setDate(rcDate.getDate() - 10);

    projections.push({
      cycleNumber: 1,
      startDate: startDateStr,
      endDate: endDateStr,
      suggestedPaymentDate: formatDateISO(payDate),
      suggestedRcDeadline: formatDateISO(rcDate),
      alertLevel: getAlertLevel(rcDate, start),
      memory: `Faixa 1-15 dias (Duração: ${diffDays} dias). Limite de 15 dias pós-fim (${formatDateISO(limitDate)}). Projeção na terça-feira.`
    });
  } else if (diffDays <= 21) {
    const limitDate = new Date(end);
    limitDate.setDate(limitDate.getDate() + 7);
    let payDate = findLastTuesdayOrBefore(limitDate);
    if (payDate <= end) {
      payDate.setDate(payDate.getDate() + 7);
    }
    const rcDate = new Date(payDate);
    rcDate.setDate(rcDate.getDate() - 10);

    projections.push({
      cycleNumber: 1,
      startDate: startDateStr,
      endDate: endDateStr,
      suggestedPaymentDate: formatDateISO(payDate),
      suggestedRcDeadline: formatDateISO(rcDate),
      alertLevel: getAlertLevel(rcDate, start),
      memory: `Faixa 16-21 dias (Duração: ${diffDays} dias). Limite de 7 dias pós-fim (${formatDateISO(limitDate)}). Projeção na terça-feira.`
    });
  } else if (diffDays <= 30) {
    let payDate = findLastTuesdayOrBefore(end);
    if (payDate < start) {
      payDate = new Date(start);
      const day = payDate.getDay();
      const diff = (2 - day + 7) % 7;
      payDate.setDate(payDate.getDate() + diff);
    }
    const rcDate = new Date(payDate);
    rcDate.setDate(rcDate.getDate() - 10);

    projections.push({
      cycleNumber: 1,
      startDate: startDateStr,
      endDate: endDateStr,
      suggestedPaymentDate: formatDateISO(payDate),
      suggestedRcDeadline: formatDateISO(rcDate),
      alertLevel: getAlertLevel(rcDate, start),
      memory: `Faixa 22-30 dias (Duração: ${diffDays} dias). Última terça-feira do período.`
    });
  } else {
    let cycleStart = new Date(start);
    let cycleNum = 1;

    while (cycleStart <= end) {
      let cycleEnd = new Date(cycleStart);
      cycleEnd.setMonth(cycleEnd.getMonth() + 1);
      cycleEnd.setDate(cycleEnd.getDate() - 1);

      const remainingTime = end.getTime() - cycleEnd.getTime();
      const remainingDays = Math.round(remainingTime / (1000 * 60 * 60 * 24));
      if (remainingDays <= 15) {
        cycleEnd = new Date(end);
      }

      let payDate = findLastTuesdayOrBefore(cycleEnd);
      if (payDate < cycleStart) {
        payDate = new Date(cycleStart);
        const day = payDate.getDay();
        const diff = (2 - day + 7) % 7;
        payDate.setDate(payDate.getDate() + diff);
      }
      const rcDate = new Date(payDate);
      rcDate.setDate(rcDate.getDate() - 10);

      projections.push({
        cycleNumber: cycleNum,
        startDate: formatDateISO(cycleStart),
        endDate: formatDateISO(cycleEnd),
        suggestedPaymentDate: formatDateISO(payDate),
        suggestedRcDeadline: formatDateISO(rcDate),
        alertLevel: getAlertLevel(rcDate, start),
        memory: `Faixa 31+ dias (Ciclo ${cycleNum}). Última terça-feira do ciclo.`
      });

      cycleNum++;
      cycleStart = new Date(cycleEnd);
      cycleStart.setDate(cycleStart.getDate() + 1);
    }
  }

  return projections;
}

