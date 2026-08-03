import { User, Nucleo, Freelancer, Job, Shortlist, Negotiation, ValuePolicy, Allocation, Evaluation, PaymentCode, Suggestion, AllocationPaymentSchedule, PaymentRequest, ReverseEvaluationLink, ValueExceptionApproval } from './mockData';

// --- Seniority Mapping ---
export function mapSeniorityToUI(seniority: string | null): 'Júnior' | 'Pleno' | 'Sênior' | 'Especialista' {
  switch (seniority?.toLowerCase()) {
    case 'junior': return 'Júnior';
    case 'pleno': return 'Pleno';
    case 'senior': return 'Sênior';
    case 'especialista': return 'Especialista';
    default: return 'Pleno';
  }
}

export function mapSeniorityToDB(seniority: string): 'junior' | 'pleno' | 'senior' | 'especialista' {
  switch (seniority) {
    case 'Júnior': return 'junior';
    case 'Pleno': return 'pleno';
    case 'Sênior': return 'senior';
    case 'Especialista': return 'especialista';
    default: return 'pleno';
  }
}

// --- Freelancer Status Mapping ---
export function mapFreelancerStatusToUI(status: string | null): Freelancer['status'] {
  switch (status?.toLowerCase()) {
    case 'elegivel': return 'Elegível';
    case 'em_analise': return 'Em análise';
    case 'em_onboarding': return 'Em onboarding';
    case 'em_observacao': return 'Em observação';
    case 'bloqueado': return 'Bloqueado';
    case 'inativo': return 'Inativo';
    default: return 'Em análise';
  }
}

export function mapFreelancerStatusToDB(status: string): 'elegivel' | 'em_analise' | 'em_onboarding' | 'em_observacao' | 'bloqueado' | 'inativo' {
  switch (status) {
    case 'Elegível': return 'elegivel';
    case 'Em análise': return 'em_analise';
    case 'Em onboarding': return 'em_onboarding';
    case 'Em observação': return 'em_observacao';
    case 'Bloqueado': return 'bloqueado';
    case 'Inativo': return 'inativo';
    default: return 'em_analise';
  }
}

// --- Availability Mapping ---
export function mapAvailabilityToUI(availability: string | null): Freelancer['availability'] {
  switch (availability?.toLowerCase()) {
    case 'disponivel': return 'Imediata';
    case 'conflito_parcial': return '15 dias';
    case 'sob_consulta': return '30+ dias';
    case 'indisponivel': return 'Indisponível';
    default: return 'Imediata';
  }
}

export function mapAvailabilityToDB(availability: string): 'disponivel' | 'conflito_parcial' | 'sob_consulta' | 'indisponivel' {
  switch (availability) {
    case 'Imediata': return 'disponivel';
    case '15 dias': return 'conflito_parcial';
    case '30+ dias': return 'sob_consulta';
    case 'Indisponível': return 'indisponivel';
    default: return 'disponivel';
  }
}

// --- Billing Type Mapping ---
export function mapBillingTypeToUI(type: string | null): 'Diária' | 'Hora' | 'Job Fechado' | 'Mensal / Salário' {
  switch (type?.toLowerCase()) {
    case 'diaria': return 'Diária';
    case 'hora': return 'Hora';
    case 'pacote':
    case 'projeto':
    case 'closed_package':
      return 'Job Fechado';
    case 'mensal':
    case 'monthly_salary':
    case 'monthly':
      return 'Mensal / Salário';
    default: return 'Diária';
  }
}

export function mapBillingTypeToDB(type: string): string {
  switch (type) {
    case 'Diária': return 'diaria';
    case 'Hora': return 'hora';
    case 'Job Fechado': return 'pacote';
    case 'Mensal / Salário': return 'mensal';
    default: return 'diaria';
  }
}

// --- Job Status Mapping ---
export function mapJobStatusToUI(status: string | null): Job['status'] {
  switch (status?.toLowerCase()) {
    case 'opportunity_created':
    case 'oportunidade_criada':
      return 'Oportunidade criada';
    case 'waiting_competition_result':
    case 'aguardando_resultado_concorrencia':
      return 'Aguardando resultado de concorrência';
    case 'shortlist':
    case 'em_shortlist':
      return 'Em shortlist';
    case 'negotiation':
    case 'em_negociacao':
      return 'Em negociação';
    case 'pending_approval':
    case 'aguardando_rh':
      return 'Pendente aprovação';
    case 'allocation_ready':
      return 'Alocação pronta';
    case 'booked':
    case 'bookado':
      return 'Bookado';
    case 'delivered':
    case 'em_andamento':
      return 'Entregue';
    case 'completed':
    case 'concluido':
    case 'avaliacao_pendente':
      return 'Concluído';
    case 'released_for_payment':
      return 'Liberado para pagamento';
    case 'paid':
      return 'Pago';
    case 'closed':
    case 'encerrado':
      return 'Fechado';
    case 'cancelled':
    case 'cancelado':
      return 'Cancelado';
    default: return 'Oportunidade criada';
  }
}

export function mapJobStatusToDB(status: string): string {
  switch (status) {
    case 'Oportunidade criada': return 'oportunidade_criada';
    case 'Aguardando resultado de concorrência': return 'waiting_competition_result';
    case 'Em shortlist': return 'em_shortlist';
    case 'Em negociação': return 'em_negociacao';
    case 'Pendente aprovação': return 'aguardando_rh';
    case 'Alocação pronta': return 'oportunidade_criada';
    case 'Bookado': return 'bookado';
    case 'Entregue': return 'em_andamento';
    case 'Concluído': return 'concluido';
    case 'Liberado para pagamento': return 'concluido';
    case 'Pago': return 'concluido';
    case 'Fechado': return 'encerrado';
    case 'Cancelado': return 'cancelado';
    default: return 'oportunidade_criada';
  }
}

// --- Shortlist Candidate Status Mapping ---
export function mapCandidateStatusToUI(status: string | null): Shortlist['candidateStatus'] {
  switch (status?.toLowerCase()) {
    case 'shortlisted':
    case 'selecionado':
      return 'Selecionado';
    case 'em_negociacao':
      return 'Em negociação';
    case 'aguardando_retorno':
      return 'Aguardando retorno';
    case 'valor_fora_politica':
      return 'Valor fora da política';
    case 'aceitou':
    case 'aprovado_rh':
    case 'accepted':
      return 'Aceitou';
    case 'aceitou com ressalva':
    case 'accepted_with_reservations':
      return 'Aceitou com ressalva';
    case 'nao_aceitou':
    case 'não aceitou':
    case 'rejeitado':
    case 'indisponivel':
    case 'refused':
      return 'Não aceitou';
    case 'bloqueado_conflito_agenda':
      return 'Bloqueado por conflito de agenda';
    case 'pendente_aprovacao_rh':
      return 'Pendente aprovação RH';
    case 'pendente_aprovacao_head':
      return 'Pendente aprovação Head';
    case 'approved_by_head':
    case 'aprovado_pelo_head':
      return 'Aprovado pelo Head';
    case 'rejected_by_head':
    case 'reprovado_pelo_head':
      return 'Reprovado pelo Head';
    case 'aprovado_para_alocacao':
      return 'Aprovado para alocação';
    case 'selecionado_para_alocacao':
      return 'Selecionado para alocação';
    default: return 'Selecionado';
  }
}

export function mapCandidateStatusToDB(status: string): string {
  switch (status) {
    case 'Selecionado': return 'shortlisted';
    case 'Em negociação': return 'em_negociacao';
    case 'Aguardando retorno': return 'aguardando_retorno';
    case 'Valor fora da política': return 'valor_fora_politica';
    case 'Aceitou com ressalva': return 'accepted_with_reservations';
    case 'Aceitou': return 'aceitou';
    case 'Não aceitou': return 'nao_aceitou';
    case 'Bloqueado por conflito de agenda': return 'bloqueado_conflito_agenda';
    case 'Pendente aprovação RH': return 'pendente_aprovacao_rh';
    case 'Pendente aprovação Head': return 'pendente_aprovacao_head';
    case 'Aprovado pelo Head': return 'approved_by_head';
    case 'Reprovado pelo Head': return 'rejected_by_head';
    case 'Aprovado para alocação': return 'aprovado_para_alocacao';
    case 'Selecionado para alocação': return 'selecionado_para_alocacao';
    default: return 'shortlisted';
  }
}

export function mapCandidateStatusToDBEnum(status: string): 'selecionado' | 'em_negociacao' | 'indisponivel' | 'valor_fora_politica' | 'aprovado_rh' | 'rejeitado' {
  switch (status) {
    case 'Selecionado':
    case 'shortlisted':
      return 'selecionado';
    case 'Em negociação':
    case 'em_negociacao':
    case 'Aguardando retorno':
    case 'aguardando_retorno':
    case 'Aceitou com ressalva':
    case 'aceitou com ressalva':
    case 'accepted_with_reservations':
    case 'Pendente aprovação RH':
    case 'pendente_aprovacao_rh':
    case 'Pendente aprovação Head':
    case 'pendente_aprovacao_head':
      return 'em_negociacao';
    case 'Valor fora da política':
    case 'valor_fora_politica':
      return 'valor_fora_politica';
    case 'Aceitou':
    case 'aceitou':
    case 'accepted':
    case 'Aprovado para alocação':
    case 'aprovado_para_alocacao':
    case 'Selecionado para alocação':
    case 'selecionado_para_alocacao':
    case 'approved_by_head':
    case 'Aprovado pelo Head':
      return 'aprovado_rh';
    case 'Não aceitou':
    case 'não aceitou':
    case 'nao_aceitou':
    case 'refused':
    case 'rejected_by_head':
    case 'Reprovado pelo Head':
      return 'rejeitado';
    case 'Bloqueado por conflito de agenda':
    case 'bloqueado_conflito_agenda':
      return 'indisponivel';
    default:
      return 'selecionado';
  }
}

// --- Allocation Status Mapping ---
export function mapAllocationStatusToUI(status: string | null): Allocation['status'] {
  switch (status?.toLowerCase()) {
    case 'booked':
    case 'reservado':
    case 'bookado':
      return 'Pendente';
    case 'delivered':
    case 'em_andamento':
      return 'Ativo';
    case 'completed':
    case 'concluido':
      return 'Concluído';
    case 'released_for_payment':
      return 'Liberado para pagamento';
    case 'paid':
      return 'Pago';
    case 'cancelled':
    case 'cancelado':
      return 'Cancelado';
    default: return 'Pendente';
  }
}

export function mapAllocationStatusToDB(status: string): string {
  switch (status) {
    case 'Pendente': return 'booked';
    case 'Ativo': return 'delivered';
    case 'Concluído': return 'completed';
    case 'Liberado para pagamento': return 'released_for_payment';
    case 'Pago': return 'paid';
    case 'Cancelado': return 'cancelled';
    default: return 'booked';
  }
}

// --- Payment Status Mapping ---
export function mapPaymentStatusToUI(status: string | null): PaymentCode['paymentStatus'] {
  switch (status?.toLowerCase()) {
    case 'aguardando_conclusao': return 'Aguardando conclusão do job';
    case 'aguardando_avaliacao': return 'Aguardando avaliação';
    case 'liberado_para_pagamento': return 'Liberado para pagamento';
    case 'bloqueado': return 'Bloqueado';
    case 'encerrado': return 'Encerrado';
    default: return 'Aguardando conclusão do job';
  }
}

// --- Profile & User Mapping ---
export function getRoleLabel(role: string | null | undefined): string {
  if (!role) return '';
  const cleaned = role.toLowerCase().replace(/_/g, '-').trim();
  if (cleaned === 'master') return 'MASTER';
  if (cleaned === 'rh') return 'RH';
  if (cleaned === 'nucleo' || cleaned === 'núcleo') return 'NÚCLEO';
  if (cleaned === 'c-level' || cleaned === 'c_level') return 'C-LEVEL';
  if (cleaned === 'operacao' || cleaned === 'operação' || cleaned === 'operations') return 'OPERAÇÕES';
  return role.toUpperCase();
}

export function mapProfileToUser(profile: any): User {
  // Format last login: e.g. "Hoje, 14:06"
  let lastLoginStr = 'Nunca';
  if (profile.last_login_at) {
    const d = new Date(profile.last_login_at);
    lastLoginStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    profile: getRoleLabel(profile.role) as any,
    nucleoId: profile.nucleo_id || undefined,
    status: profile.status === 'active' ? 'Ativo' : 'Inativo',
    role: profile.job_title || '',
    firstAccessPending: profile.first_login_required,
    lastLogin: lastLoginStr,
    themePreference: profile.theme_preference || 'dark',
    isNucleusHead: profile.is_nucleus_head || false,
  };
}

// --- Nucleo Mapping ---
export function mapNucleoToUI(nucleo: any): Nucleo {
  return {
    id: nucleo.id,
    name: nucleo.name,
    headName: nucleo.head_name || '',
    headEmail: nucleo.head_email || '',
    status: nucleo.status === 'active' ? 'Ativo' : 'Inativo',
    jobCount: nucleo.job_count || 0,
    freelaUsedCount: nucleo.freela_used_count || 0,
    headUserId: nucleo.head_user_id || undefined,
    archivedAt: nucleo.archived_at || undefined,
    archivedBy: nucleo.archived_by || undefined,
    archiveReason: nucleo.archive_reason || undefined,
  };
}

// --- Freelancer Mapping ---
export function mapFreelancerToUI(f: any): Freelancer {
  return {
    id: f.id,
    name: f.full_name,
    email: f.email || '',
    whatsapp: f.whatsapp || '',
    city: f.city || '',
    state: f.state || '',
    mainRole: f.main_function?.name || 'Designer 3D',
    secondaryRoles: [],
    seniority: mapSeniorityToUI(f.seniority),
    industries: f.freelancer_industries?.map((fi: any) => fi.industry?.name).filter(Boolean) || [],
    portfolioUrl: f.portfolio_url || '',
    status: mapFreelancerStatusToUI(f.status),
    availability: mapAvailabilityToUI(f.availability),
    referenceValue: Number(f.reference_daily_rate || 0),
    averageScore: Number(f.average_score || 0),
    observations: f.observations || '',
    experienceWithV3A: f.evaluations_count > 0 || f.average_score > 0,
    // Extended fields mapping
    locationText: f.location_text || '',
    plannerScore: f.planner_score !== null && f.planner_score !== undefined ? Number(f.planner_score) : undefined,
    powerpointScore: f.powerpoint_score !== null && f.powerpoint_score !== undefined ? Number(f.powerpoint_score) : undefined,
    hasWorkedWithV3a: f.has_worked_with_v3a || '',
    v3aProjects: f.v3a_projects || '',
    currentSituation: f.current_situation || '',
    contractType: f.contract_type || '',
    brandsWorked: f.brands_worked || '',
    linkedinUrl: f.linkedin_url || '',
    instagramUrl: f.instagram_url || '',
    portfolioFileUrl: f.portfolio_file_url || '',
    portfolioFilePath: f.portfolio_file_path || '',
    portfolioFileName: f.portfolio_file_name || '',
    mergedIntoFreelancerId: f.merged_into_freelancer_id || null,
    consolidatedScore: Number(f.consolidated_score || 0),
    recommendationRate: Number(f.recommendation_rate || 0),
    operationalStatus: f.operational_status || 'Elegível',
    cnpj_normalized: f.cnpj_normalized || '',
    cnpj_is_mock: f.cnpj_is_mock || false,
    cnpj_mock_batch: f.cnpj_mock_batch || '',
    foreign_tax_id: f.foreign_tax_id || '',
    tax_country_code: f.tax_country_code || 'BR',
    cnpj_source: f.cnpj_source || '',
  };
}

// --- ValuePolicy Mapping ---
export function mapValuePolicyToUI(pol: any): ValuePolicy {
  let uiBillingType: 'Diária' | 'Hora' | 'Job Fechado' | 'Mensal / Salário' = 'Diária';
  if (pol.remuneration_model === 'daily') uiBillingType = 'Diária';
  else if (pol.remuneration_model === 'hourly') uiBillingType = 'Hora';
  else if (pol.remuneration_model === 'fixed_job') uiBillingType = 'Job Fechado';
  else if (pol.remuneration_model === 'monthly_salary') uiBillingType = 'Mensal / Salário';
  else {
    uiBillingType = mapBillingTypeToUI(pol.billing_type);
  }
  return {
    id: pol.id,
    role: pol.function?.name || 'Designer 3D',
    seniority: mapSeniorityToUI(pol.seniority),
    billingType: uiBillingType,
    referenceValue: Number(pol.reference_value || 0),
    ceilingValue: Number(pol.ceiling_value || 0),
    status: pol.status === 'inactive' ? 'Inativo' : 'Ativo',
    updatedAt: pol.updated_at ? new Date(pol.updated_at).toLocaleDateString('pt-BR') : '—',
    remunerationModel: pol.remuneration_model,
    approvalRequiredAbove: pol.approval_required_above !== null && pol.approval_required_above !== undefined ? Number(pol.approval_required_above) : undefined,
    notes: pol.notes || '',
    successFeeMaxPercent: pol.success_fee_max_percent ? Number(pol.success_fee_max_percent) : undefined,
  };
}

// --- Allocation Mapping ---
export function mapAllocationToUI(alloc: any): Allocation {
  return {
    id: alloc.id,
    allocationCode: alloc.allocation_code || '',
    jobId: alloc.job_id,
    freelancerId: alloc.freelancer_id,
    nucleoId: alloc.nucleo_id,
    startDate: alloc.start_date,
    endDate: alloc.end_date,
    approvedValue: Number(alloc.approved_value || 0),
    status: mapAllocationStatusToUI(alloc.status),
    createdAt: alloc.created_at || undefined,
    negotiatedTotal: alloc.negotiated_total !== null && alloc.negotiated_total !== undefined ? Number(alloc.negotiated_total) : undefined,
    budgetSavingAmount: alloc.budget_saving_amount !== null && alloc.budget_saving_amount !== undefined ? Number(alloc.budget_saving_amount) : undefined,
    budgetSavingPercentage: alloc.budget_saving_percentage !== null && alloc.budget_saving_percentage !== undefined ? Number(alloc.budget_saving_percentage) : undefined,
    dailyBudgetReference: alloc.daily_budget_reference !== null && alloc.daily_budget_reference !== undefined ? Number(alloc.daily_budget_reference) : undefined,
    dailySavingAmount: alloc.daily_saving_amount !== null && alloc.daily_saving_amount !== undefined ? Number(alloc.daily_saving_amount) : undefined,
    budgetDeltaStatus: alloc.budget_delta_status || 'not_calculated',
    estimatedHours: alloc.estimated_hours !== null && alloc.estimated_hours !== undefined ? Number(alloc.estimated_hours) : undefined,
    remunerationModel: alloc.remuneration_model || undefined,
    // Recurring & payment model fields
    paymentModel: alloc.payment_model || 'one_time',
    contractStartDate: alloc.contract_start_date || undefined,
    contractEndDate: alloc.contract_end_date || undefined,
    recurrenceFrequency: alloc.recurrence_frequency || 'none',
    recurringAmount: alloc.recurring_amount !== null && alloc.recurring_amount !== undefined ? Number(alloc.recurring_amount) : undefined,
    totalContractValue: alloc.total_contract_value !== null && alloc.total_contract_value !== undefined ? Number(alloc.total_contract_value) : undefined,
    paymentTerms: alloc.payment_terms || '',
    paymentNotes: alloc.payment_notes || '',
    paymentRequestStatus: alloc.payment_request_status || 'not_requested',
    success_fee_enabled: alloc.success_fee_enabled || false,
    evaluationStatus: alloc.evaluation_status || 'locked',
    reverseEvaluationStatus: alloc.reverse_evaluation_status || 'not_generated',
    evaluatedFreelancer: alloc.evaluated_freelancer || false,
    evaluatedDelivery: alloc.evaluated_delivery || false,
  };
}

// --- Evaluation Mapping ---
export function mapEvaluationToUI(ev: any): Evaluation {
  return {
    id: ev.id,
    jobId: ev.job_id,
    freelancerId: ev.freelancer_id,
    evaluatorId: ev.evaluator_id,
    technicalQuality: Number(ev.technical_quality),
    deadline: Number(ev.deadline),
    briefingAdherence: Number(ev.briefing_adherence),
    communication: Number(ev.communication),
    autonomy: Number(ev.autonomy),
    behavior: Number(ev.behavior),
    collaboration: ev.collaboration !== null && ev.collaboration !== undefined ? Number(ev.collaboration) : undefined,
    flexibility: ev.flexibility !== null && ev.flexibility !== undefined ? Number(ev.flexibility) : undefined,
    costBenefit: ev.cost_benefit !== null && ev.cost_benefit !== undefined ? Number(ev.cost_benefit) : undefined,
    finalScore: Number(ev.final_score || 0),
    score0to100: ev.score_0_100 !== null && ev.score_0_100 !== undefined ? Number(ev.score_0_100) : undefined,
    comment: ev.comment || '',
    recommendation: ev.recommendation === 'sim' ? 'Sim' : ev.recommendation === 'sim_com_restricao' ? 'Sim, com restrição' : 'Não',
    wouldHireAgain: ev.would_hire_again || undefined,
    reworkLevel: ev.rework_level || undefined,
    criticalProblem: ev.critical_problem || false,
    conditionalAnswers: ev.conditional_answers || undefined,
    // New behavioral and quality criteria
    reliability: ev.reliability !== null && ev.reliability !== undefined ? Number(ev.reliability) : undefined,
    cultureProcesses: ev.culture_processes !== null && ev.culture_processes !== undefined ? Number(ev.culture_processes) : undefined,
    rework: ev.rework !== null && ev.rework !== undefined ? Number(ev.rework) : undefined,
    scopeAdherence: ev.scope_adherence !== null && ev.scope_adherence !== undefined ? Number(ev.scope_adherence) : undefined,
    materialsQuality: ev.materials_quality !== null && ev.materials_quality !== undefined ? Number(ev.materials_quality) : undefined,
  };
}

// --- Allocation Payment Schedule Mapping ---
export function mapAllocationPaymentScheduleToUI(aps: any): AllocationPaymentSchedule {
  return {
    id: aps.id,
    allocationId: aps.allocation_id,
    jobId: aps.job_id,
    freelancerId: aps.freelancer_id,
    nucleoId: aps.nucleo_id,
    installmentNumber: Number(aps.installment_number),
    referencePeriodStart: aps.reference_period_start,
    referencePeriodEnd: aps.reference_period_end,
    dueDate: aps.due_date || undefined,
    amount: Number(aps.amount || 0),
    status: aps.status,
    paymentRequestId: aps.payment_request_id || undefined,
    financeCode: aps.finance_code || undefined,
    notes: aps.notes || '',
    createdAt: aps.created_at || undefined,
    updatedAt: aps.updated_at || undefined,
  };
}

// --- Payment Request Mapping ---
export function mapPaymentRequestToUI(pr: any): PaymentRequest {
  return {
    id: pr.id,
    requestCode: pr.request_code,
    allocationId: pr.allocation_id,
    paymentScheduleId: pr.payment_schedule_id || undefined,
    jobId: pr.job_id,
    freelancerId: pr.freelancer_id,
    nucleoId: pr.nucleo_id,
    issuedBy: pr.issued_by,
    issuedByRole: pr.issued_by_role,
    requestType: pr.request_type,
    paymentNumber: pr.payment_number !== null && pr.payment_number !== undefined ? Number(pr.payment_number) : undefined,
    totalPayments: pr.total_payments !== null && pr.total_payments !== undefined ? Number(pr.total_payments) : undefined,
    referencePeriodStart: pr.reference_period_start || undefined,
    referencePeriodEnd: pr.reference_period_end || undefined,
    amount: Number(pr.amount || 0),
    paymentDueDate: pr.payment_due_date || undefined,
    paymentDescription: pr.payment_description || '',
    paymentJustification: pr.payment_justification || '',
    documentStatus: pr.document_status,
    exportedAt: pr.exported_at || undefined,
    exportedBy: pr.exported_by || undefined,
    documentUrl: pr.document_url || undefined,
    documentFileName: pr.document_file_name || undefined,
    financeCode: pr.finance_code || undefined,
    financeCodeRegisteredAt: pr.finance_code_registered_at || undefined,
    financeCodeRegisteredBy: pr.finance_code_registered_by || undefined,
    createdAt: pr.created_at || undefined,
    updatedAt: pr.updated_at || undefined,
  };
}

// --- Reverse Evaluation Link Mapping ---
export function mapReverseEvaluationLinkToUI(rel: any): ReverseEvaluationLink {
  return {
    id: rel.id,
    token: rel.token,
    allocationId: rel.allocation_id,
    jobId: rel.job_id,
    freelancerId: rel.freelancer_id,
    nucleoId: rel.nucleo_id,
    status: rel.status,
    expiresAt: rel.expires_at || undefined,
    usedAt: rel.used_at || undefined,
    createdBy: rel.created_by || undefined,
    createdAt: rel.created_at || undefined,
    updatedAt: rel.updated_at || undefined,
  };
}

// --- PaymentCode Mapping ---
export function mapPaymentCodeToUI(pay: any): PaymentCode {
  return {
    id: pay.id,
    allocationCode: pay.allocation_code,
    jobId: pay.job_id,
    freelancerId: pay.freelancer_id,
    approvedValue: Number(pay.approved_value || 0),
    paymentStatus: mapPaymentStatusToUI(pay.payment_status),
  };
}

// --- Suggestion Mapping ---
export function mapSuggestionToUI(sug: any): Suggestion {
  return {
    id: sug.id,
    freelancerName: sug.freelancer_name,
    email: sug.email,
    whatsapp: sug.whatsapp || '',
    suggestedRole: sug.suggested_role || '',
    portfolioUrl: sug.portfolio_url || '',
    reason: sug.reason,
    relatedProject: sug.related_project,
    observations: sug.observations || undefined,
    nucleoId: sug.nucleo_id,
    suggestedBy: sug.suggested_by || '',
    status: sug.status || 'Pendente de análise RH',
  };
}

// --- Urgency Mapping ---
export function mapUrgencyToUI(urgency: string | null): 'Alta' | 'Média' | 'Baixa' {
  switch (urgency?.toLowerCase()) {
    case 'alta':
    case 'critica':
      return 'Alta';
    case 'media':
      return 'Média';
    case 'baixa':
    default:
      return 'Baixa';
  }
}

export function mapUrgencyToDB(urgency: string): 'alta' | 'media' | 'baixa' | 'critica' {
  switch (urgency) {
    case 'Alta': return 'alta';
    case 'Média': return 'media';
    case 'Baixa': return 'baixa';
    default: return 'media';
  }
}

// --- Job Mapping ---
export function mapJobToUI(req: any): Job {
  let normRemun = req.remuneration_model;
  if (normRemun) {
    const r = normRemun.toLowerCase();
    if (r === 'monthly' || r === 'monthly_salary' || r === 'mensal' || r === 'mensal / salário') normRemun = 'monthly_salary';
    else if (r === 'closed_package' || r === 'fixed_job' || r === 'pacote' || r === 'projeto' || r === 'job fechado') normRemun = 'fixed_job';
    else if (r === 'daily' || r === 'diaria' || r === 'diária') normRemun = 'daily';
    else if (r === 'hourly' || r === 'hora') normRemun = 'hourly';
  }

  return {
    id: req.id, // request_id represents the demand / UI Job ID
    jobId: req.job_id,
    job_code: req.jobs?.job_code || req.job_code || '',
    name: req.jobs?.title || req.job_title || '',
    client: req.jobs?.client_name || req.client_name || '',
    nucleoId: req.jobs?.nucleo_id || req.nucleo_id || '',
    requesterId: req.jobs?.requester_id || req.requester_id || '',
    roleNeeded: req.freela_functions?.name || req.function_name || 'Designer 3D',
    seniorityNeeded: mapSeniorityToUI(req.seniority),
    description: req.scope_description || '',
    deliverables: req.deliverables || '',
    startDate: req.start_date || '',
    endDate: req.end_date || '',
    budget: Number(req.budget_max || 0),
    urgency: mapUrgencyToUI(req.jobs?.urgency || req.urgency),
    status: mapJobStatusToUI(req.status),
    selectedFreelancerId: req.selected_freelancer_id || null,
    closedAt: req.closed_at || null,
    closedBy: req.closed_by || null,
    closureReason: req.closure_reason || null,
    paymentFlow: req.payment_flow,
    remunerationModel: normRemun,
    expectedRate: req.expected_rate !== null && req.expected_rate !== undefined ? Number(req.expected_rate) : undefined,
    expectedHours: req.expected_hours !== null && req.expected_hours !== undefined ? Number(req.expected_hours) : undefined,
    expectedPaymentDay: req.expected_payment_day !== null && req.expected_payment_day !== undefined ? Number(req.expected_payment_day) : undefined,
    expectedPaymentCount: req.expected_payment_count !== null && req.expected_payment_count !== undefined ? Number(req.expected_payment_count) : undefined,
    expectedTotalCompensation: req.expected_total_compensation !== null && req.expected_total_compensation !== undefined ? Number(req.expected_total_compensation) : undefined,
    expectedBudgetSavingAmount: req.expected_budget_saving_amount !== null && req.expected_budget_saving_amount !== undefined ? Number(req.expected_budget_saving_amount) : undefined,
    expectedBudgetSavingPercentage: req.expected_budget_saving_percentage !== null && req.expected_budget_saving_percentage !== undefined ? Number(req.expected_budget_saving_percentage) : undefined,
    paymentPolicyStatus: req.payment_policy_status,
    policyStatus: req.policy_status || (req.is_above_policy ? 'outside_policy' : 'inside_policy'),
    policyExceededAtCreation: req.policy_exceeded_at_creation || req.is_above_policy || false,
    policyLimitAmount: req.policy_ceiling_value !== null && req.policy_ceiling_value !== undefined ? Number(req.policy_ceiling_value) : undefined,
    policyReferenceAmount: req.policy_reference_value !== null && req.policy_reference_value !== undefined ? Number(req.policy_reference_value) : undefined,
    approvalRequired: req.approval_required || false,
    is_competitive_bid: req.is_competitive_bid || req.jobs?.is_competitive_bid || false,
    success_fee_enabled: req.success_fee_enabled || req.jobs?.success_fee_enabled || false,
    paymentDatesGenerated: req.payment_dates_generated || [],
    paymentDatesSelected: req.payment_dates_selected || [],
    paymentDatesExcluded: req.payment_dates_excluded || [],
    createdAt: req.created_at || null,
  };
}

export function mapNegotiationStatusToUI(status: string | null, isAbovePolicy?: boolean): string {
  switch (status?.toLowerCase()) {
    case 'aprovado_rh': return 'Aprovado pelo RH';
    case 'rejeitado_rh': return 'Rejeitado pelo RH';
    case 'em_andamento': return 'Em andamento';
    case 'pendente_aprovacao_rh': return 'Pendente aprovação RH';
    case 'pendente_aprovacao_head': return 'Pendente aprovação Head';
    case 'valor_fora_politica': return 'Valor fora da política';
    case 'bloqueado_conflito_agenda': return 'Bloqueado por conflito';
    case 'aceitou': return 'Aceitou';
    case 'nao_aceitou': return 'Não aceitou';
    case 'aguardando_retorno': return 'Aguardando retorno';
    default: return status || 'Pendente';
  }
}

// --- ValueExceptionApproval Mapping ---
export function mapValueExceptionApprovalToUI(row: any): ValueExceptionApproval {
  return {
    id: row.id,
    jobId: row.job_id,
    requestId: row.request_id || undefined,
    shortlistCandidateId: row.shortlist_candidate_id || undefined,
    freelancerId: row.freelancer_id || undefined,
    nucleusId: row.nucleus_id || undefined,
    approvalType: row.approval_type as 'value_exception' | 'schedule_conflict',
    status: row.status as 'pending' | 'approved' | 'rejected',
    requestedBy: row.requested_by || undefined,
    requestedTo: row.requested_to || undefined,
    approverId: row.approver_id || undefined,
    approverRole: row.approver_role || undefined,
    reason: row.reason || undefined,
    decisionNotes: row.decision_notes || undefined,
    policyReferenceValue: row.policy_reference_value !== null && row.policy_reference_value !== undefined ? Number(row.policy_reference_value) : undefined,
    policyCeilingValue: row.policy_ceiling_value !== null && row.policy_ceiling_value !== undefined ? Number(row.policy_ceiling_value) : undefined,
    negotiatedValue: row.negotiated_value !== null && row.negotiated_value !== undefined ? Number(row.negotiated_value) : undefined,
    requestedAmount: row.requested_amount !== null && row.requested_amount !== undefined ? Number(row.requested_amount) : undefined,
    remunerationModel: row.remuneration_model || undefined,
    calculatedPolicyReference: row.calculated_policy_reference !== null && row.calculated_policy_reference !== undefined ? Number(row.calculated_policy_reference) : undefined,
    calculatedPolicyLimit: row.calculated_policy_limit !== null && row.calculated_policy_limit !== undefined ? Number(row.calculated_policy_limit) : undefined,
    excessAmount: row.excess_amount !== null && row.excess_amount !== undefined ? Number(row.excess_amount) : undefined,
    excessPercent: row.excess_percent !== null && row.excess_percent !== undefined ? Number(row.excess_percent) : undefined,
    approvedBy: row.approved_by || undefined,
    approvedAt: row.approved_at || undefined,
    approvalComment: row.approval_comment || undefined,
    rejectedBy: row.rejected_by || undefined,
    rejectedAt: row.rejected_at || undefined,
    rejectionComment: row.rejection_comment || undefined,
    createdAt: row.created_at || undefined,
    decidedAt: row.decided_at || undefined,
  };
}
