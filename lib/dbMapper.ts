import { User, Nucleo, Freelancer, Job, Shortlist, Negotiation, ValuePolicy, Allocation, Evaluation, PaymentCode, Suggestion } from './mockData';

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
export function mapBillingTypeToUI(type: string | null): 'Diária' | 'Hora' | 'Job Fechado' {
  switch (type?.toLowerCase()) {
    case 'diaria': return 'Diária';
    case 'hora': return 'Hora';
    case 'pacote':
    case 'projeto':
      return 'Job Fechado';
    default: return 'Diária';
  }
}

export function mapBillingTypeToDB(type: string): 'diaria' | 'hora' | 'pacote' | 'projeto' {
  switch (type) {
    case 'Diária': return 'diaria';
    case 'Hora': return 'hora';
    case 'Job Fechado': return 'pacote';
    default: return 'diaria';
  }
}

// --- Job Status Mapping ---
export function mapJobStatusToUI(status: string | null): Job['status'] {
  switch (status?.toLowerCase()) {
    case 'opportunity_created':
    case 'oportunidade_criada':
      return 'Oportunidade criada';
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
    case 'Oportunidade criada': return 'opportunity_created';
    case 'Em shortlist': return 'shortlist';
    case 'Em negociação': return 'negotiation';
    case 'Pendente aprovação': return 'pending_approval';
    case 'Alocação pronta': return 'allocation_ready';
    case 'Bookado': return 'booked';
    case 'Entregue': return 'delivered';
    case 'Concluído': return 'completed';
    case 'Liberado para pagamento': return 'released_for_payment';
    case 'Pago': return 'paid';
    case 'Fechado': return 'closed';
    case 'Cancelado': return 'cancelled';
    default: return 'opportunity_created';
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
      return 'Aceitou';
    case 'nao_aceitou':
    case 'rejeitado':
    case 'indisponivel':
      return 'Não aceitou';
    case 'bloqueado_conflito_agenda':
      return 'Bloqueado por conflito de agenda';
    case 'pendente_aprovacao_rh':
      return 'Pendente aprovação RH';
    case 'pendente_aprovacao_head':
      return 'Pendente aprovação Head';
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
    case 'Aceitou': return 'aceitou';
    case 'Não aceitou': return 'nao_aceitou';
    case 'Bloqueado por conflito de agenda': return 'bloqueado_conflito_agenda';
    case 'Pendente aprovação RH': return 'pendente_aprovacao_rh';
    case 'Pendente aprovação Head': return 'pendente_aprovacao_head';
    case 'Aprovado para alocação': return 'aprovado_para_alocacao';
    case 'Selecionado para alocação': return 'selecionado_para_alocacao';
    default: return 'shortlisted';
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
  };
}

// --- ValuePolicy Mapping ---
export function mapValuePolicyToUI(pol: any): ValuePolicy {
  return {
    id: pol.id,
    role: pol.function?.name || 'Designer 3D',
    seniority: mapSeniorityToUI(pol.seniority),
    billingType: mapBillingTypeToUI(pol.billing_type),
    referenceValue: Number(pol.reference_value || 0),
    ceilingValue: Number(pol.ceiling_value || 0),
    status: pol.status === 'inactive' ? 'Inativo' : 'Ativo',
    updatedAt: pol.updated_at ? new Date(pol.updated_at).toLocaleDateString('pt-BR') : '—',
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
    negotiatedTotal: alloc.negotiated_total !== null && alloc.negotiated_total !== undefined ? Number(alloc.negotiated_total) : undefined,
    budgetSavingAmount: alloc.budget_saving_amount !== null && alloc.budget_saving_amount !== undefined ? Number(alloc.budget_saving_amount) : undefined,
    budgetSavingPercentage: alloc.budget_saving_percentage !== null && alloc.budget_saving_percentage !== undefined ? Number(alloc.budget_saving_percentage) : undefined,
    dailyBudgetReference: alloc.daily_budget_reference !== null && alloc.daily_budget_reference !== undefined ? Number(alloc.daily_budget_reference) : undefined,
    dailySavingAmount: alloc.daily_saving_amount !== null && alloc.daily_saving_amount !== undefined ? Number(alloc.daily_saving_amount) : undefined,
    budgetDeltaStatus: alloc.budget_delta_status || 'not_calculated',
    estimatedHours: alloc.estimated_hours !== null && alloc.estimated_hours !== undefined ? Number(alloc.estimated_hours) : undefined,
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
  return {
    id: req.id, // request_id represents the demand / UI Job ID
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
