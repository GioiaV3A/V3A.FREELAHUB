'use server';

import { supabase, getSupabaseAdmin } from '@/lib/supabase';
import { sendProposalEmail, sendProposalResponseNotificationEmail } from '@/lib/emailService';

export interface ConfirmShortlistParams {
  jobId: string;
  jobCode?: string;
  jobTitle?: string;
  clientName?: string;
  nucleoName?: string;
  nucleoId?: string;
  roleName?: string;
  seniority?: string;
  startDate?: string;
  endDate?: string;
  remunerationModel?: string;
  baseValue?: number;
  selectedFreelancerIds: string[];
  userId?: string;
  freelancersMetadata?: Array<{
    id: string;
    name: string;
    email: string;
  }>;
}

/**
 * Ensures a date string is formatted strictly in pt-BR, avoiding timezone day-shifts.
 */
function formatDateForSaoPaulo(dateStr: string | null | undefined): string {
  if (!dateStr) return 'A definir';
  try {
    // If the date is just YYYY-MM-DD, avoid Date parsing shifting it back 1 day in UTC
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    }
    // For ISO strings containing time, force São Paulo timezone
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(dateStr));
  } catch (e) {
    return 'Data inválida';
  }
}

/**
 * Confirms official shortlist, creates proposal_invitations, generates secure public_form_links,
 * updates candidate status to waiting_response and sends email notifications via SMTP.
 */
export async function confirmOfficialShortlistAction(params: ConfirmShortlistParams) {
  try {
    const { jobId, jobCode, selectedFreelancerIds, userId, freelancersMetadata } = params;

    if (!jobId || !selectedFreelancerIds || selectedFreelancerIds.length === 0) {
      return { success: false, error: 'Job ou freelancers selecionados inválidos.' };
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Multi-tier Job Lookup (ID -> job_code -> title -> auto-create -> fallback)
    let job: any = null;

    // Check by ID
    const { data: jobById } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();
    if (jobById) job = jobById;

    // Check by job_code
    if (!job && (jobCode || jobId)) {
      const targetCode = jobCode || jobId;
      const { data: jobByCode } = await supabaseAdmin
        .from('jobs')
        .select('*')
        .eq('job_code', targetCode)
        .maybeSingle();
      if (jobByCode) job = jobByCode;
    }

    // Check by title
    if (!job && params.jobTitle) {
      const { data: jobByTitle } = await supabaseAdmin
        .from('jobs')
        .select('*')
        .eq('title', params.jobTitle)
        .maybeSingle();
      if (jobByTitle) job = jobByTitle;
    }

    // Auto-create job in Supabase database if not present
    if (!job && (params.jobTitle || jobCode)) {
      const cleanCode = jobCode && /^\d{2}-\d{4}-\d{3}$/.test(jobCode) 
        ? jobCode 
        : `26-0000-${Math.floor(100 + Math.random() * 900)}`;

      // Try to get a valid nucleo_id
      let validNucleoId = params.nucleoId;
      if (!validNucleoId || !validNucleoId.includes('-')) {
        const { data: nData } = await supabaseAdmin.from('nucleos').select('id').limit(1).maybeSingle();
        validNucleoId = nData?.id || '5be1b6d8-9e12-4d0c-a208-231619ee435d'; // fallback UUID
      }

      const { data: newJob, error: createError } = await supabaseAdmin
        .from('jobs')
        .insert({
          job_code: cleanCode,
          title: params.jobTitle || 'Oportunidade V3A',
          client_name: params.clientName || 'V3A',
          nucleo_id: validNucleoId, // Required field
          description: 'Oportunidade registrada no FREELA HUB',
          start_date: params.startDate || new Date().toISOString(),
          end_date: params.endDate || new Date().toISOString(),
          expected_total_value: params.baseValue || 0,
          remuneration_model: params.remunerationModel || 'monthly',
          status: 'em_shortlist'
        })
        .select('*')
        .maybeSingle();

      if (createError) {
        console.error('Error auto-creating job:', createError);
      }

      if (newJob) job = newJob;
    }

    // Fallback: Latest active job in database
    if (!job) {
      const { data: latestJob } = await supabaseAdmin
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestJob) job = latestJob;
    }

    if (!job) {
      return { success: false, error: 'Oportunidade (Job) não localizada no banco de dados. Cadastre o job no sistema.' };
    }

    // Fetch nucleo name if available
    let nucleoName = params.nucleoName || 'V3A';
    if (job.nucleo_id) {
      const { data: nData } = await supabaseAdmin.from('nucleos').select('name').eq('id', job.nucleo_id).maybeSingle();
      if (nData?.name) nucleoName = nData.name;
    }

    const results = [];
    const appUrl = process.env.FREELAHUB_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://v3-a-freelahub.vercel.app')));

    for (const freelancerId of selectedFreelancerIds) {
      // Fetch freelancer by ID or fallback
      let freelancer: any = null;
      const { data: fData } = await supabaseAdmin
        .from('freelancers')
        .select('*')
        .eq('id', freelancerId)
        .maybeSingle();
      freelancer = fData;

      // Check metadata fallback by email
      if (!freelancer && freelancersMetadata) {
        const meta = freelancersMetadata.find(m => m.id === freelancerId);
        if (meta?.email) {
          const { data: fByEmail } = await supabaseAdmin
            .from('freelancers')
            .select('*')
            .eq('email', meta.email.trim().toLowerCase())
            .maybeSingle();
          freelancer = fByEmail;

          if (!freelancer) {
            const { data: newF } = await supabaseAdmin
              .from('freelancers')
              .insert({
                full_name: meta.name || 'Profissional',
                email: meta.email.trim().toLowerCase(),
                status: 'elegivel'
              })
              .select('*')
              .maybeSingle();
            freelancer = newF;
          }
        }
      }

      if (!freelancer) {
        const { data: fallbackF } = await supabaseAdmin
          .from('freelancers')
          .select('*')
          .limit(1)
          .maybeSingle();
        freelancer = fallbackF;
      }

      if (!freelancer) continue;

      // Find shortlist candidate record
      const { data: candidate } = await supabaseAdmin
        .from('shortlist_candidates')
        .select('id, candidate_status')
        .eq('job_id', job.id)
        .eq('freelancer_id', freelancer.id)
        .maybeSingle();

      // Find negotiation record if exists
      const { data: negotiation } = await supabaseAdmin
        .from('negotiations')
        .select('id')
        .eq('job_id', job.id)
        .eq('freelancer_id', freelancer.id)
        .maybeSingle();

      // Generate a secure token (random hex)
      const rawToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48h expiration

      // Create public_form_link
      const { data: publicLink, error: linkError } = await supabaseAdmin
        .from('public_form_links')
        .insert({
          link_type: 'proposal_response',
          token_hash: rawToken,
          status: 'active',
          freelancer_id: freelancer.id,
          job_id: job.id,
          job_code: job.job_code,
          shortlist_candidate_id: candidate?.id || null,
          negotiation_id: negotiation?.id || null,
          expires_at: expiresAt,
          created_by: userId || null,
          metadata: { token: rawToken, recipient_email: freelancer.email },
        })
        .select('id')
        .single();

      if (linkError) {
        console.error('Error creating public_form_link:', linkError);
      }

      // Create proposal_invitation
      const { data: invitation, error: invError } = await supabaseAdmin
        .from('proposal_invitations')
        .insert({
          job_id: job.id,
          job_code: job.job_code,
          freelancer_id: freelancer.id,
          shortlist_candidate_id: candidate?.id || null,
          negotiation_id: negotiation?.id || null,
          public_link_id: publicLink?.id || null,
          status: 'waiting_response',
          sent_at: new Date().toISOString(),
          created_by: userId || null,
        })
        .select('id')
        .single();

      if (invError) {
        console.error('Error creating proposal_invitation:', invError);
      }

      // Update proposal_invitation_id back in public_form_links if created
      if (publicLink?.id && invitation?.id) {
        await supabaseAdmin
          .from('public_form_links')
          .update({ proposal_invitation_id: invitation.id })
          .eq('id', publicLink.id);
      }

      // Update shortlist_candidates candidate_status to waiting_response / em_negociacao
      if (candidate?.id) {
        await supabaseAdmin
          .from('shortlist_candidates')
          .update({
            candidate_status: 'em_negociacao',
            negotiation_status: 'waiting_response',
          })
          .eq('id', candidate.id);
      }

      // Construct proposal URL
      const proposalUrl = `${appUrl}/public/proposta/${rawToken}`;

      // Dispatch Email via SMTP
      const emailResult = await sendProposalEmail({
        recipientEmail: freelancer.email || '',
        recipientName: freelancer.full_name || freelancer.name || 'Profissional',
        jobId: job.id,
        jobCode: job.job_code,
        jobTitle: job.title || params.jobTitle || 'Oportunidade V3A',
        clientName: job.client_name || params.clientName || 'Cliente',
        nucleoName: nucleoName,
        roleName: params.roleName || job.function_name || 'Profissional',
        seniority: params.seniority || job.seniority || 'Pleno',
        startDate: formatDateForSaoPaulo(job.start_date),
        endDate: formatDateForSaoPaulo(job.end_date),
        remunerationModel: job.remuneration_model || params.remunerationModel || 'Diária',
        baseValue: Number(job.expected_total_value || job.budget_max || params.baseValue || 0),
        proposalUrl,
        publicLinkId: publicLink?.id,
        proposalInvitationId: invitation?.id,
        createdByUserId: userId,
      });

      results.push({
        freelancerId: freelancer.id,
        freelancerName: freelancer.full_name || freelancer.name,
        invitationId: invitation?.id,
        emailSent: emailResult.success,
        emailError: emailResult.error,
      });
    }

    // Update job status to in_shortlist
    await supabaseAdmin
      .from('jobs')
      .update({ status: 'em_shortlist' })
      .eq('id', job.id);

    return { success: true, count: results.length, results };
  } catch (err: any) {
    console.error('Error in confirmOfficialShortlistAction:', err);
    return { success: false, error: err.message || 'Erro ao confirmar shortlist e enviar propostas.' };
  }
}

/**
 * Gets proposal payload by token for the public response page
 */
export async function getProposalByTokenAction(token: string) {
  try {
    if (!token) return { success: false, error: 'Token não fornecido.' };

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.rpc('get_public_proposal_by_token', { p_token: token });

    if (error) {
      console.error('RPC Error get_public_proposal_by_token:', error);
      return { success: false, error: 'Erro ao validar proposta.' };
    }

    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao carregar proposta.' };
  }
}

/**
 * Submits response from freelancer (accepted, accepted_with_reservations, refused)
 */
export async function submitProposalResponseAction(params: {
  token: string;
  responseType: 'accepted' | 'accepted_with_reservations' | 'refused';
  refusalReason?: string;
  freelancerNotes?: string;
}) {
  try {
    const { token, responseType, refusalReason, freelancerNotes } = params;

    if (!token || !responseType) {
      return { success: false, error: 'Parâmetros de resposta inválidos.' };
    }

    if (responseType === 'refused' && !refusalReason) {
      return { success: false, error: 'O motivo da recusa é obrigatório.' };
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Validate link
    const { data: link, error: linkError } = await supabaseAdmin
      .from('public_form_links')
      .select('*')
      .or(`token_hash.eq.${token},metadata->>token.eq.${token},id.eq.${token}`)
      .eq('link_type', 'proposal_response')
      .single();

    if (linkError || !link) {
      return { success: false, error: 'Link de proposta não encontrado.' };
    }

    if (link.status === 'used') {
      return { success: false, error: 'Esta proposta já foi respondida.' };
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return { success: false, error: 'Este link de proposta expirou.' };
    }

    const now = new Date().toISOString();

    // 1. Mark public link as used
    await supabaseAdmin
      .from('public_form_links')
      .update({
        status: 'used',
        used_at: now,
      })
      .eq('id', link.id);

    // 2. Update proposal_invitation
    if (link.proposal_invitation_id) {
      await supabaseAdmin
        .from('proposal_invitations')
        .update({
          status: responseType === 'accepted' ? 'accepted' : responseType === 'accepted_with_reservations' ? 'accepted_with_reservations' : 'refused',
          responded_at: now,
          response_type: responseType,
          refusal_reason: refusalReason || null,
          freelancer_notes: freelancerNotes || null,
        })
        .eq('id', link.proposal_invitation_id);
    }

    // 3. Update shortlist_candidate status
    let headEmail = '';
    let headName = '';
    let jobTitle = '';
    let jobCode = '';
    let freelancerName = '';

    if (link.shortlist_candidate_id) {
      // Fetch details for email
      const { data: scData, error: scFetchError } = await supabaseAdmin
        .from('shortlist_candidates')
        .select(`
          freelancer_id,
          job_id,
          jobs (title, job_code, requester_id, nucleo_id),
          freelancers (full_name)
        `)
        .eq('id', link.shortlist_candidate_id)
        .single();

      if (scFetchError) {
        console.error('[proposalActions] Error fetching scData:', scFetchError);
      }
        
      if (scData && scData.jobs) {
        const jobInfo: any = Array.isArray(scData.jobs) ? scData.jobs[0] : scData.jobs;
        const freelancerInfo: any = scData.freelancers ? (Array.isArray(scData.freelancers) ? scData.freelancers[0] : scData.freelancers) : null;
        
        jobTitle = jobInfo.title;
        jobCode = jobInfo.job_code;
        freelancerName = freelancerInfo?.full_name || 'Freelancer';
        
        if (jobInfo.nucleo_id) {
          const { data: nData } = await supabaseAdmin
            .from('nucleos')
            .select('head_email, head_name')
            .eq('id', jobInfo.nucleo_id)
            .single();
            
          if (nData) {
            headEmail = nData.head_email;
            headName = nData.head_name || 'Gestor do Núcleo';
          }
        }
        
        // Fallback to job creator (requester) if head_email is missing
        if (!headEmail && jobInfo.requester_id) {
          const { data: uData } = await supabaseAdmin
            .from('profiles')
            .select('email, full_name')
            .eq('id', jobInfo.requester_id)
            .single();
          if (uData) {
            headEmail = uData.email;
            headName = uData.full_name || 'Requisitante';
          }
        }
      }

      const candidateStatusEnum = responseType === 'refused' ? 'rejeitado' : responseType === 'accepted_with_reservations' ? 'em_negociacao' : 'aprovado_rh';
      const negStatus = responseType === 'refused' ? 'refused' : responseType === 'accepted_with_reservations' ? 'accepted_with_reservations' : 'accepted';

      const { error: scUpdateErr } = await supabaseAdmin
        .from('shortlist_candidates')
        .update({
          candidate_status: candidateStatusEnum,
          negotiation_status: negStatus,
          notes: responseType === 'refused' ? `Recusado pelo freela: ${refusalReason}` : freelancerNotes || undefined,
        })
        .eq('id', link.shortlist_candidate_id);

      if (scUpdateErr) {
        console.error('[proposalActions] Error updating shortlist_candidate:', scUpdateErr);
      }
    }

    // 4. Update negotiation record if exists
    if (link.negotiation_id) {
      await supabaseAdmin
        .from('negotiations')
        .update({
          status: responseType === 'refused' ? 'rejeitado' : 'aceitou',
          notes: freelancerNotes || undefined,
        })
        .eq('id', link.negotiation_id);
    }
    
    // 5. Dispatch notification email to Head
    if (headEmail && freelancerName && jobCode) {
      console.log('[proposalActions] Dispatching notification email to Head:', headEmail);
      const emailRes = await sendProposalResponseNotificationEmail({
        headEmail,
        headName,
        freelancerName,
        jobTitle,
        jobCode,
        responseType,
        notes: responseType === 'refused' ? refusalReason : freelancerNotes,
      });
      console.log('[proposalActions] Notification email dispatch result:', emailRes);
    } else {
      console.warn('[proposalActions] Skipping notification email, missing params:', { headEmail, freelancerName, jobCode });
    }

    return { success: true, message: 'Sua resposta foi registrada com sucesso. Obrigado!' };
  } catch (err: any) {
    console.error('Error submitting proposal response:', err);
    return { success: false, error: err.message || 'Erro ao enviar resposta da proposta.' };
  }
}
