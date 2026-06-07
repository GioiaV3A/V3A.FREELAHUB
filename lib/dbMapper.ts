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
    case 'oportunidade_criada': return 'Oportunidade criada';
    case 'em_shortlist': return 'Em shortlist';
    case 'em_negociacao': return 'Em negociação';
    case 'aguardando_rh': return 'Aguardando RH';
    case 'bookado': return 'Bookado';
    case 'em_andamento': return 'Em andamento';
    case 'concluido': return 'Concluído';
    case 'avaliacao_pendente': return 'Avaliação pendente';
    case 'encerrado': return 'Encerrado';
    default: return 'Oportunidade criada';
  }
}

export function mapJobStatusToDB(status: string): 'oportunidade_criada' | 'em_shortlist' | 'em_negociacao' | 'aguardando_rh' | 'bookado' | 'em_andamento' | 'concluido' | 'avaliacao_pendente' | 'encerrado' {
  switch (status) {
    case 'Oportunidade criada': return 'oportunidade_criada';
    case 'Em shortlist': return 'em_shortlist';
    case 'Em negociação': return 'em_negociacao';
    case 'Aguardando RH': return 'aguardando_rh';
    case 'Bookado': return 'bookado';
    case 'Em andamento': return 'em_andamento';
    case 'Concluído': return 'concluido';
    case 'Avaliação pendente': return 'avaliacao_pendente';
    case 'Encerrado': return 'encerrado';
    default: return 'oportunidade_criada';
  }
}

// --- Shortlist Candidate Status Mapping ---
export function mapCandidateStatusToUI(status: string | null): Shortlist['candidateStatus'] {
  switch (status?.toLowerCase()) {
    case 'selecionado': return 'Selecionado';
    case 'em_negociacao': return 'Em negociação';
    case 'aprovado_rh': return 'Aprovado pelo RH';
    case 'rejeitado': return 'Rejeitado';
    case 'indisponivel': return 'Indisponível';
    case 'valor_fora_politica': return 'Valor fora da política';
    default: return 'Selecionado';
  }
}

export function mapCandidateStatusToDB(status: string): 'selecionado' | 'em_negociacao' | 'aprovado_rh' | 'rejeitado' | 'indisponivel' | 'valor_fora_politica' {
  switch (status) {
    case 'Selecionado': return 'selecionado';
    case 'Em negociação': return 'em_negociacao';
    case 'Aprovado pelo RH':
    case 'Aprovado RH':
    case 'Aceitou':
      return 'aprovado_rh';
    case 'Rejeitado': return 'rejeitado';
    case 'Indisponível':
    case 'Não aceitou':
      return 'indisponivel';
    case 'Valor fora da política': return 'valor_fora_politica';
    case 'Aguardando retorno': return 'em_negociacao';
    default: return 'selecionado';
  }
}

// --- Negotiation Status Mapping ---
export function mapNegotiationStatusToUI(status: string | null, isAbovePolicy = false): Negotiation['status'] {
  switch (status?.toLowerCase()) {
    case 'aprovado_rh': return 'Aprovado pelo RH';
    case 'rejeitado': return 'Rejeitado pelo RH';
    case 'em_negociacao':
    default:
      return isAbovePolicy ? 'Pendente aprovação RH' : 'Em andamento';
  }
}

// --- Allocation Status Mapping ---
export function mapAllocationStatusToUI(status: string | null): Allocation['status'] {
  switch (status?.toLowerCase()) {
    case 'reservado':
    case 'bookado':
      return 'Pendente';
    case 'em_andamento': return 'Ativo';
    case 'concluido': return 'Concluído';
    default: return 'Pendente';
  }
}

export function mapAllocationStatusToDB(status: string): 'bookado' | 'em_andamento' | 'concluido' {
  switch (status) {
    case 'Pendente': return 'bookado';
    case 'Ativo': return 'em_andamento';
    case 'Concluído': return 'concluido';
    default: return 'bookado';
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
    finalScore: Number(ev.final_score || 0),
    comment: ev.comment || '',
    recommendation: ev.recommendation === 'sim' ? 'Sim' : ev.recommendation === 'sim_com_restricao' ? 'Sim, com restrição' : 'Não',
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
