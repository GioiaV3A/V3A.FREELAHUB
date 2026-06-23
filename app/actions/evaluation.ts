'use server';

import { getSupabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';

/**
 * Validates a public evaluation token.
 * Returns evaluation details if token is active and valid.
 */
export async function validateEvaluationTokenAction(token: string) {
  try {
    if (!token) {
      return { success: false, error: 'Token não fornecido.' };
    }

    const adminClient = getSupabaseAdmin();

    // Fetch token details from reverse_evaluation_links
    const { data: tokenData, error: tokenErr } = await adminClient
      .from('reverse_evaluation_links')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (tokenErr) {
      console.error('Error fetching evaluation token:', tokenErr);
      return { success: false, error: 'Erro ao validar token.' };
    }

    if (!tokenData) {
      return { success: false, error: 'Token inválido.' };
    }

    if (tokenData.status !== 'active') {
      return { success: false, error: `Este link de avaliação já foi ${tokenData.status === 'used' ? 'utilizado' : 'cancelado/expirado'}.` };
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      await adminClient
        .from('reverse_evaluation_links')
        .update({ status: 'expired' })
        .eq('id', tokenData.id);
      return { success: false, error: 'Este link de avaliação expirou.' };
    }

    // Load details about the allocation, job, request, freelancer, leader
    const { data: alloc, error: allocErr } = await adminClient
      .from('allocations')
      .select(`
        id,
        start_date,
        end_date,
        approved_value,
        status,
        freelancer:freelancers(id, full_name, main_function_id, seniority),
        job:jobs(id, title, client_name, nucleo_id),
        request:job_freelancer_requests(id, function_id, seniority, scope_description)
      `)
      .eq('id', tokenData.allocation_id)
      .single();

    if (allocErr || !alloc) {
      console.error('Error fetching allocation details:', allocErr);
      return { success: false, error: 'Erro ao carregar dados da alocação.' };
    }

    // Join with function name
    let functionName = 'Designer';
    const functionId = (alloc as any).request?.function_id || (alloc as any).freelancer?.main_function_id;
    if (functionId) {
      const { data: func } = await adminClient
        .from('freela_functions')
        .select('name')
        .eq('id', functionId)
        .single();
      if (func) {
        functionName = func.name;
      }
    }

    // Get leader details
    let leaderName = 'Líder do Núcleo';
    const { data: profile } = await adminClient
      .from('profiles')
      .select('full_name')
      .eq('nucleo_id', (alloc as any).job?.nucleo_id)
      .eq('role', 'nucleo')
      .limit(1)
      .maybeSingle();
    if (profile) {
      leaderName = profile.full_name;
    }

    // Get Nucleo details
    let nucleoName = 'Núcleo';
    const { data: nucleo } = await adminClient
      .from('nucleos')
      .select('name')
      .eq('id', (alloc as any).job?.nucleo_id)
      .single();
    if (nucleo) {
      nucleoName = nucleo.name;
    }

    return {
      success: true,
      tokenDetails: {
        id: tokenData.id,
        allocationId: tokenData.allocation_id,
        jobId: tokenData.job_id,
        freelancerId: tokenData.freelancer_id,
        freelancerName: (alloc as any).freelancer?.full_name || '',
        leaderName,
        nucleoName,
        nucleoId: (alloc as any).job?.nucleo_id,
        clientName: (alloc as any).job?.client_name || '',
        jobTitle: (alloc as any).job?.title || '',
        startDate: alloc.start_date,
        endDate: alloc.end_date,
        agreedRate: alloc.approved_value,
        functionContracted: functionName,
        seniorityContracted: (alloc as any).request?.seniority || (alloc as any).freelancer?.seniority || 'Pleno',
      }
    };
  } catch (err: any) {
    console.error('validateEvaluationTokenAction error:', err);
    return { success: false, error: 'Erro inesperado no servidor.' };
  }
}

/**
 * Submits the freelancer's anonymous reverse evaluation of V3A leader and project.
 */
export async function submitReverseEvaluationAction(token: string, evaluationData: any) {
  try {
    if (!token) {
      return { success: false, error: 'Token inválido.' };
    }

    const adminClient = getSupabaseAdmin();

    // 1. Verify token status and update to 'used' atomically on reverse_evaluation_links
    const { data: tokenData, error: tokenErr } = await adminClient
      .from('reverse_evaluation_links')
      .update({
        status: 'used',
        used_at: new Date().toISOString()
      })
      .eq('token', token)
      .eq('status', 'active')
      .is('used_at', null)
      .select('*')
      .maybeSingle();

    if (tokenErr || !tokenData) {
      return { success: false, error: 'Token inválido, expirado ou já utilizado.' };
    }

    // 2. Fetch Leader ID and Client details from allocation
    const { data: alloc } = await adminClient
      .from('allocations')
      .select('job_id, request_id, nucleo_id, jobs(requester_id, client_name)')
      .eq('id', tokenData.allocation_id)
      .single();

    const leaderId = (alloc as any)?.jobs?.requester_id || null;
    const client = (alloc as any)?.jobs?.client_name || '';

    // 3. Insert reverse evaluation row (Trigger automatically computes the scores)
    const { error: insertErr } = await adminClient
      .from('reverse_evaluations')
      .insert({
        allocation_id: tokenData.allocation_id,
        job_id: tokenData.job_id,
        request_id: alloc?.request_id || null,
        freelancer_id: tokenData.freelancer_id,
        leader_id: leaderId,
        nucleo_id: alloc?.nucleo_id,
        client,
        briefing_clarity: Number(evaluationData.briefingClarity),
        scope_alignment: Number(evaluationData.scopeAlignment),
        direct_leadership: Number(evaluationData.directLeadership),
        leadership_quality: Number(evaluationData.leadershipQuality || evaluationData.directLeadership || 5),
        decision_speed: Number(evaluationData.decisionSpeed),
        communication: Number(evaluationData.communication),
        project_organization: Number(evaluationData.projectOrganization),
        working_conditions: Number(evaluationData.workingConditions),
        administrative_flow: Number(evaluationData.administrativeFlow),
        nps_project: Number(evaluationData.npsProject),
        csat_project: Number(evaluationData.csatProject),
        ces_operational: Number(evaluationData.cesOperational),
        observations: evaluationData.observations || '',
        reverse_evaluation_link_id: tokenData.id,
        status: 'completed'
      });

    if (insertErr) {
      console.error('Error inserting reverse evaluation:', insertErr);
      // Rollback token state
      await adminClient
        .from('reverse_evaluation_links')
        .update({
          status: 'active',
          used_at: null
        })
        .eq('id', tokenData.id);
      return { success: false, error: 'Erro ao salvar avaliação. Tente novamente.' };
    }

    // Update allocation reverse evaluation status to completed
    await adminClient
      .from('allocations')
      .update({
        reverse_evaluation_status: 'completed'
      })
      .eq('id', tokenData.allocation_id);

    return { success: true, message: 'Obrigado! Sua avaliação reversa foi enviada com sucesso.' };
  } catch (err: any) {
    console.error('submitReverseEvaluationAction error:', err);
    return { success: false, error: 'Erro inesperado no servidor.' };
  }
}

/**
 * Submits split freelancer and/or delivery evaluations.
 * Unlocks faturamento / payment code and generates reverse evaluation token when both are completed.
 */
export async function submitFreelancerAndDeliveryEvaluationAction(
  accessToken: string,
  allocationId: string,
  type: 'freelancer' | 'delivery',
  payload: any
) {
  try {
    const adminClient = getSupabaseAdmin();

    // 1. Verify requester session
    const { data: { user: requester }, error: authErr } = await adminClient.auth.getUser(accessToken);
    if (authErr || !requester) {
      return { success: false, error: 'Não autorizado. Sessão inválida.' };
    }

    const { data: requesterProfile, error: profileErr } = await adminClient
      .from('profiles')
      .select('role, status')
      .eq('id', requester.id)
      .single();

    if (profileErr || !requesterProfile || requesterProfile.status !== 'active') {
      return { success: false, error: 'Perfil do solicitante inativo ou inexistente.' };
    }

    // 2. Fetch the allocation
    const { data: alloc, error: allocErr } = await adminClient
      .from('allocations')
      .select('*, jobs(*), job_freelancer_requests(*)')
      .eq('id', allocationId)
      .single();

    if (allocErr || !alloc) {
      return { success: false, error: 'Alocação associada não encontrada.' };
    }

    // 3. Find or create an evaluation row for this allocation
    const { data: existingEval } = await adminClient
      .from('evaluations')
      .select('*')
      .eq('allocation_id', allocationId)
      .maybeSingle();

    const evalData: any = {};
    if (type === 'delivery') {
      evalData.technical_quality = Number(payload.technicalQuality);
      evalData.briefing_adherence = Number(payload.briefingAdherence);
      evalData.deadline = Number(payload.deadline);
      evalData.rework = Number(payload.rework);
      evalData.scope_adherence = Number(payload.scopeAdherence);
      evalData.cost_benefit = Number(payload.costBenefit);
      evalData.materials_quality = Number(payload.materialsQuality);
      evalData.comment = payload.comment || existingEval?.comment || '';
      evalData.would_hire_again = payload.wouldHireAgain || existingEval?.would_hire_again || 'sim';
      evalData.rework_level = payload.reworkLevel || existingEval?.rework_level || 'nao';
      evalData.critical_problem = payload.criticalProblem || existingEval?.critical_problem || false;
    } else if (type === 'freelancer') {
      evalData.communication = Number(payload.communication);
      evalData.autonomy = Number(payload.autonomy);
      evalData.reliability = Number(payload.reliability);
      evalData.collaboration = Number(payload.collaboration);
      evalData.flexibility = Number(payload.flexibility);
      evalData.behavior = Number(payload.behavior);
      evalData.culture_processes = Number(payload.cultureProcesses);
      evalData.comment = payload.comment || existingEval?.comment || '';
    }

    // General fields that are always needed
    evalData.evaluator_id = requester.id;
    evalData.evaluator_role = requesterProfile.role || 'nucleo';
    evalData.client = alloc.jobs?.client_name || '';
    evalData.function_contracted = alloc.job_freelancer_requests?.function_name || '';
    evalData.seniority_contracted = alloc.job_freelancer_requests?.seniority || 'Pleno';
    evalData.agreed_rate = alloc.approved_value;
    evalData.policy_status = alloc.policy_status || 'within_policy';

    let savedEval;
    if (existingEval) {
      const { data: updated, error: updateErr } = await adminClient
        .from('evaluations')
        .update(evalData)
        .eq('id', existingEval.id)
        .select('*')
        .single();
      if (updateErr) {
        console.error('Error updating evaluation:', updateErr);
        return { success: false, error: 'Erro ao atualizar a avaliação.' };
      }
      savedEval = updated;
    } else {
      evalData.job_id = alloc.job_id;
      evalData.request_id = alloc.request_id;
      evalData.allocation_id = allocationId;
      evalData.freelancer_id = alloc.freelancer_id;
      evalData.nucleo_id = alloc.nucleo_id;
      evalData.status = 'submitted';

      const { data: inserted, error: insertErr } = await adminClient
        .from('evaluations')
        .insert(evalData)
        .select('*')
        .single();
      if (insertErr) {
        console.error('Error inserting evaluation:', insertErr);
        return { success: false, error: 'Erro ao criar a avaliação.' };
      }
      savedEval = inserted;
    }

    // 4. Update the flags on allocation
    const allocUpdate: any = {};
    if (type === 'delivery') {
      allocUpdate.evaluated_delivery = true;
    } else {
      allocUpdate.evaluated_freelancer = true;
    }

    // Check if both parts are evaluated
    const isDeliveryEvaluated = type === 'delivery' || alloc.evaluated_delivery;
    const isFreelancerEvaluated = type === 'freelancer' || alloc.evaluated_freelancer;

    if (isDeliveryEvaluated && isFreelancerEvaluated) {
      allocUpdate.status = 'completed';
      allocUpdate.evaluation_status = 'completed';
      allocUpdate.completed_at = new Date().toISOString();
      allocUpdate.released_for_payment_at = new Date().toISOString();
      allocUpdate.reverse_evaluation_status = 'generated';
    } else {
      allocUpdate.evaluation_status = 'pending';
    }

    const { error: allocUpdateErr } = await adminClient
      .from('allocations')
      .update(allocUpdate)
      .eq('id', allocationId);

    if (allocUpdateErr) {
      console.error('Error updating allocation flags:', allocUpdateErr);
    }

    // 5. If both are evaluated:
    // - Generate reverse evaluation token link in `reverse_evaluation_links`
    // - Update job freelancer request status
    // - Update payment status in payment_codes to 'liberado_para_pagamento'
    let reverseToken = null;
    if (isDeliveryEvaluated && isFreelancerEvaluated) {
      const token = randomUUID();
      const expires = new Date();
      expires.setDate(expires.getDate() + 30); // 30 days validation

      const { data: linkData, error: linkErr } = await adminClient
        .from('reverse_evaluation_links')
        .insert({
          allocation_id: allocationId,
          job_id: alloc.job_id,
          freelancer_id: alloc.freelancer_id,
          nucleo_id: alloc.nucleo_id,
          token,
          status: 'active',
          expires_at: expires.toISOString(),
          created_by: requester.id
        })
        .select('token')
        .single();

      if (!linkErr && linkData) {
        reverseToken = linkData.token;
      } else {
        console.error('Error inserting reverse evaluation link:', linkErr);
      }

      // Update job request status
      await adminClient
        .from('job_freelancer_requests')
        .update({ status: 'concluido' })
        .eq('id', alloc.request_id);

      // Unlock payment status in payment_codes
      await adminClient
        .from('payment_codes')
        .update({
          payment_status: 'liberado_para_pagamento',
          released_at: new Date().toISOString(),
          released_by: requester.id
        })
        .eq('allocation_id', allocationId);
    }

    return {
      success: true,
      evaluation: savedEval,
      bothCompleted: isDeliveryEvaluated && isFreelancerEvaluated,
      reverseToken
    };
  } catch (err: any) {
    console.error('submitFreelancerAndDeliveryEvaluationAction error:', err);
    return { success: false, error: 'Erro inesperado no servidor.' };
  }
}

/**
 * Submits leader's evaluation of a freelancer. (Deprecated / compatibility fallback)
 */
export async function submitLeaderEvaluationAction(allocationId: string, evaluationData: any) {
  try {
    const adminClient = getSupabaseAdmin();
    // Simulate by submitting as 'delivery' then 'freelancer' to satisfy both parts
    const res1 = await submitFreelancerAndDeliveryEvaluationAction(
      evaluationData.accessToken || '', 
      allocationId, 
      'delivery', 
      evaluationData
    );
    if (!res1.success) return res1;
    
    const res2 = await submitFreelancerAndDeliveryEvaluationAction(
      evaluationData.accessToken || '', 
      allocationId, 
      'freelancer', 
      evaluationData
    );
    return res2;
  } catch (err: any) {
    console.error('submitLeaderEvaluationAction fallback error:', err);
    return { success: false, error: 'Erro inesperado no servidor.' };
  }
}

/**
 * Creates a new approval request for either value policy exception or schedule conflict.
 */
export async function createApprovalRequestAction(accessToken: string, approvalData: any) {
  try {
    const adminClient = getSupabaseAdmin();

    // 1. Verify requester session
    const { data: { user: requester }, error: authErr } = await adminClient.auth.getUser(accessToken);
    if (authErr || !requester) {
      return { success: false, error: 'Não autorizado. Sessão inválida ou expirada.' };
    }

    // Check requester profile permissions
    const { data: requesterProfile, error: profileErr } = await adminClient
      .from('profiles')
      .select('role, status, nucleo_id')
      .eq('id', requester.id)
      .single();

    if (profileErr || !requesterProfile || requesterProfile.status !== 'active') {
      return { success: false, error: 'Perfil do solicitante inativo ou inexistente.' };
    }

    // 2. Validate shortlist candidate
    if (!approvalData.shortlistCandidateId) {
      return { success: false, error: 'Candidato da shortlist não identificado.' };
    }

    // Fetch candidate details from db (authenticating relationships)
    const { data: candidate, error: candErr } = await adminClient
      .from('shortlist_candidates')
      .select('job_id, request_id, freelancer_id, schedule_conflict, negotiation_status')
      .eq('id', approvalData.shortlistCandidateId)
      .single();

    if (candErr || !candidate) {
      console.error('Candidate not found for approval request:', candErr);
      return { success: false, error: 'Candidato da shortlist não encontrado no banco de dados.' };
    }

    // 3. Validate job exists and check Nucleo head constraint
    const { data: job, error: jobErr } = await adminClient
      .from('jobs')
      .select('nucleo_id')
      .eq('id', candidate.job_id)
      .single();

    if (jobErr || !job) {
      console.error('Job not found for approval request:', jobErr);
      return { success: false, error: 'Oportunidade correspondente não encontrada.' };
    }

    if (requesterProfile.role === 'nucleo') {
      if (job.nucleo_id !== requesterProfile.nucleo_id) {
        return { success: false, error: 'Você não tem permissão para solicitar aprovação em jobs de outro núcleo.' };
      }
    } else if (
      requesterProfile.role !== 'master' &&
      requesterProfile.role !== 'rh' &&
      requesterProfile.role !== 'c_level' &&
      requesterProfile.role !== 'operations' &&
      requesterProfile.role !== 'operacao'
    ) {
      return { success: false, error: 'Seu perfil de acesso não tem permissão para solicitar aprovações.' };
    }

    // 4. Confirm agenda conflict exists if requested
    if (approvalData.approvalType === 'schedule_conflict' && !candidate.schedule_conflict) {
      return { success: false, error: 'Este profissional não possui conflito de agenda registrado.' };
    }

    // 5. Avoid duplicates / Update existing pending request
    const { data: existingApproval } = await adminClient
      .from('allocation_approvals')
      .select('id')
      .eq('job_id', candidate.job_id)
      .eq('shortlist_candidate_id', approvalData.shortlistCandidateId)
      .eq('freelancer_id', candidate.freelancer_id)
      .eq('approval_type', approvalData.approvalType)
      .eq('status', 'pending')
      .maybeSingle();

    const excessAmount = approvalData.negotiatedValue && approvalData.policyCeilingValue
      ? Number(approvalData.negotiatedValue) - Number(approvalData.policyCeilingValue)
      : 0;
    const excessPercent = approvalData.negotiatedValue && approvalData.policyCeilingValue && Number(approvalData.policyCeilingValue) > 0
      ? (excessAmount / Number(approvalData.policyCeilingValue)) * 100
      : 0;

    const requestPayload: any = {
      job_id: candidate.job_id,
      request_id: candidate.request_id,
      shortlist_candidate_id: approvalData.shortlistCandidateId,
      freelancer_id: candidate.freelancer_id,
      approval_type: approvalData.approvalType,
      status: 'pending',
      requested_by: requester.id,
      requested_to: approvalData.requestedTo || null,
      reason: approvalData.reason,
      policy_reference_value: approvalData.policyReferenceValue || null,
      policy_ceiling_value: approvalData.policyCeilingValue || null,
      negotiated_value: approvalData.negotiatedValue || null,
      nucleus_id: job.nucleo_id,
      requested_amount: approvalData.negotiatedValue || null,
      calculated_policy_reference: approvalData.policyReferenceValue || null,
      calculated_policy_limit: approvalData.policyCeilingValue || null,
      excess_amount: excessAmount > 0 ? excessAmount : null,
      excess_percent: excessPercent > 0 ? excessPercent : null
    };

    let created;
    if (existingApproval) {
      const { data: updated, error: updateErr } = await adminClient
        .from('allocation_approvals')
        .update(requestPayload)
        .eq('id', existingApproval.id)
        .select('*')
        .single();
      
      if (updateErr) {
        console.error('Error updating approval request:', updateErr);
        return { success: false, error: 'Erro ao atualizar solicitação de aprovação no banco de dados.' };
      }
      created = updated;
    } else {
      const { data: inserted, error: insertErr } = await adminClient
        .from('allocation_approvals')
        .insert(requestPayload)
        .select('*')
        .single();

      if (insertErr) {
        console.error('Error creating approval request:', insertErr);
        return { success: false, error: 'Erro ao salvar solicitação de aprovação no banco de dados.' };
      }
      created = inserted;
    }

    // 7. Update candidate negotiation status & reference ID
    const nextStatus = approvalData.approvalType === 'schedule_conflict' 
      ? 'pendente_aprovacao_rh' 
      : 'pendente_aprovacao_head';

    const updatePayload: any = {
      negotiation_status: nextStatus,
      requires_rh_approval: approvalData.approvalType === 'schedule_conflict',
      requires_head_approval: approvalData.approvalType === 'value_exception'
    };

    if (approvalData.approvalType === 'schedule_conflict') {
      updatePayload.schedule_approval_id = created.id;
    } else {
      updatePayload.value_approval_id = created.id;
    }

    const { error: updateErr } = await adminClient
      .from('shortlist_candidates')
      .update(updatePayload)
      .eq('id', approvalData.shortlistCandidateId);

    if (updateErr) {
      console.error('Error updating candidate:', updateErr);
      return { success: false, error: 'Erro ao atualizar o candidato na shortlist.' };
    }

    // 8. Record in negotiation_history
    const previousStatus = candidate.negotiation_status || 'shortlisted';
    const { error: histErr } = await adminClient
      .from('negotiation_history')
      .insert({
        job_id: candidate.job_id,
        request_id: candidate.request_id,
        shortlist_candidate_id: approvalData.shortlistCandidateId,
        freelancer_id: candidate.freelancer_id,
        previous_status: previousStatus,
        new_status: nextStatus,
        notes: approvalData.reason,
        changed_by: requester.id,
        changed_by_role: requesterProfile.role
      });

    if (histErr) {
      console.warn('Could not record negotiation history:', histErr.message);
    }

    return { success: true, approval: created };
  } catch (err: any) {
    console.error('createApprovalRequestAction error:', err);
    return { success: false, error: 'Erro inesperado no servidor.' };
  }
}

/**
 * Submits decision on a pending approval override.
 */
export async function decideApprovalAction(
  accessToken: string,
  approvalId: string,
  status: 'approved' | 'rejected',
  approverId: string,
  approverRole: string,
  notes: string
) {
  try {
    const adminClient = getSupabaseAdmin();

    // 1. Verify requester session
    const { data: { user: requester }, error: authErr } = await adminClient.auth.getUser(accessToken);
    if (authErr || !requester) {
      return { success: false, error: 'Não autorizado. Sessão inválida.' };
    }

    // Check requester profile permissions
    const { data: requesterProfile, error: profileErr } = await adminClient
      .from('profiles')
      .select('role, status, nucleo_id, is_nucleus_head')
      .eq('id', requester.id)
      .single();

    if (profileErr || !requesterProfile || requesterProfile.status !== 'active') {
      return { success: false, error: 'Perfil do aprovador inativo ou inexistente.' };
    }

    // 2. Resolve the approval record
    const { data: appData, error: loadErr } = await adminClient
      .from('allocation_approvals')
      .select('*')
      .eq('id', approvalId)
      .single();

    if (loadErr || !appData) {
      console.error('Error loading approval request:', loadErr);
      return { success: false, error: 'Solicitação de aprovação não encontrada.' };
    }

    // Get the job's nucleo_id to verify head relationship
    let targetNucleusId = appData.nucleus_id;
    if (!targetNucleusId) {
      const { data: jobObj } = await adminClient
        .from('jobs')
        .select('nucleo_id')
        .eq('id', appData.job_id)
        .single();
      if (jobObj) {
        targetNucleusId = jobObj.nucleo_id;
      }
    }

    // 3. Verify permissions based on approval type
    if (appData.approval_type === 'schedule_conflict') {
      if (requesterProfile.role !== 'master' && requesterProfile.role !== 'rh') {
        return { success: false, error: 'Apenas MASTER e RH podem aprovar conflitos de agenda.' };
      }
    } else if (appData.approval_type === 'value_exception') {
      const isAuthorizedAdmin = requesterProfile.role === 'master' || requesterProfile.role === 'rh' || requesterProfile.role === 'c_level';
      const isNucleusHead = requesterProfile.role === 'nucleo' &&
        requesterProfile.is_nucleus_head === true &&
        requesterProfile.nucleo_id === targetNucleusId;

      if (!isAuthorizedAdmin && !isNucleusHead) {
        return { success: false, error: 'Perfil sem autorização para aprovar exceção de valor.' };
      }
    }

    // 4. Update the approval request
    const { data: updatedApp, error: appErr } = await adminClient
      .from('allocation_approvals')
      .update({
        status,
        approver_id: requester.id,
        approver_role: requesterProfile.role,
        decision_notes: notes,
        decided_at: new Date().toISOString()
      })
      .eq('id', approvalId)
      .select('*')
      .single();

    if (appErr || !updatedApp) {
      console.error('Error updating approval status:', appErr);
      return { success: false, error: 'Erro ao salvar a decisão de aprovação no banco de dados.' };
    }

    // 5. Determine the candidate's next status
    let nextStatus = 'em_negociacao';
    let nextCandidateStatus: 'selecionado' | 'em_negociacao' | 'indisponivel' | 'valor_fora_politica' | 'aprovado_rh' | 'rejeitado' = 'em_negociacao';

    if (status === 'approved') {
      if (appData.approval_type === 'value_exception') {
        nextStatus = 'approved_by_head';
        nextCandidateStatus = 'aprovado_rh';
      } else {
        nextStatus = 'aceitou';
        nextCandidateStatus = 'aprovado_rh';
      }
    } else {
      if (appData.approval_type === 'value_exception') {
        nextStatus = 'rejected_by_head';
        nextCandidateStatus = 'rejeitado';
      } else {
        nextStatus = 'nao_aceitou';
        nextCandidateStatus = 'rejeitado';
      }
    }

    // 6. Update candidate status and flags
    const updatePayload: any = {
      negotiation_status: nextStatus,
      candidate_status: nextCandidateStatus
    };

    if (appData.approval_type === 'schedule_conflict') {
      updatePayload.requires_rh_approval = false;
    } else if (appData.approval_type === 'value_exception') {
      updatePayload.requires_head_approval = false;
    }

    const { error: candUpdateErr } = await adminClient
      .from('shortlist_candidates')
      .update(updatePayload)
      .eq('id', appData.shortlist_candidate_id);

    if (candUpdateErr) {
      console.error('Error updating candidate after decision:', candUpdateErr);
      return { success: false, error: 'Erro ao atualizar o status do candidato na shortlist.' };
    }

    // 7. Record in negotiation_history
    const previousStatus = appData.approval_type === 'schedule_conflict' 
      ? 'pendente_aprovacao_rh' 
      : 'pendente_aprovacao_head';

    const { error: histErr } = await adminClient
      .from('negotiation_history')
      .insert({
        job_id: appData.job_id,
        request_id: appData.request_id,
        shortlist_candidate_id: appData.shortlist_candidate_id,
        freelancer_id: appData.freelancer_id,
        previous_status: previousStatus,
        new_status: nextStatus,
        notes: `Decisão de aprovação registrada: ${status === 'approved' ? 'APROVADO' : 'REJEITADO'}. Notas: ${notes}`,
        changed_by: requester.id,
        changed_by_role: requesterProfile.role
      });

    if (histErr) {
      console.warn('Could not record negotiation history for decision:', histErr.message);
    }

    return { success: true, approval: updatedApp };
  } catch (err: any) {
    console.error('decideApprovalAction error:', err);
    return { success: false, error: 'Erro inesperado no servidor.' };
  }
}
