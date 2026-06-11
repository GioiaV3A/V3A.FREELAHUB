'use server';

import { getSupabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

// Helper to compute SHA-256 hash of the token
function computeHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const isUuid = (id: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
};

/**
 * Verifies if the requester has administrative permissions (MASTER or RH).
 */
async function verifyAdminRequester(adminClient: any, accessToken: string) {
  const { data: { user }, error: authErr } = await adminClient.auth.getUser(accessToken);
  if (authErr || !user) {
    throw new Error('Não autorizado. Sessão inválida.');
  }

  const { data: profile, error: profileErr } = await adminClient
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile || profile.status !== 'active') {
    throw new Error('Perfil do solicitante inativo ou inexistente.');
  }

  if (profile.role !== 'master' && profile.role !== 'rh') {
    throw new Error('Você não tem permissão para realizar esta ação.');
  }

  return user;
}

/**
 * Generates a public form link (token) and saves its hash in the database.
 */
export async function generatePublicFormLinkAction(
  accessToken: string,
  payload: {
    type: 'new_freelancer' | 'update_freelancer';
    freelancerId?: string;
    expiresDays?: number;
  }
) {
  try {
    const adminClient = getSupabaseAdmin();
    const requester = await verifyAdminRequester(adminClient, accessToken);

    if (payload.type === 'update_freelancer') {
      if (!payload.freelancerId) {
        return { success: false, error: 'Freelancer é obrigatório para links de atualização.' };
      }
      if (!isUuid(payload.freelancerId)) {
        console.error('[Technical Error] generatePublicFormLinkAction: invalid freelancerId UUID format:', {
          freelancerId: payload.freelancerId,
          requester: requester.id,
          timestamp: new Date().toISOString()
        });
        return { success: false, error: 'ID inválido do freelancer. Selecione novamente a partir da base oficial.' };
      }

      const { data: freelaExists, error: freelaErr } = await adminClient
        .from('freelancers')
        .select('id, full_name')
        .eq('id', payload.freelancerId)
        .maybeSingle();

      if (freelaErr) {
        console.error('[Technical Error] generatePublicFormLinkAction: failed to check freelancer existence:', {
          freelancerId: payload.freelancerId,
          error: freelaErr,
          timestamp: new Date().toISOString()
        });
        return { success: false, error: 'Erro ao verificar existência do freelancer no banco.' };
      }

      if (!freelaExists) {
        console.error('[Technical Error] generatePublicFormLinkAction: freelancer does not exist in database:', {
          freelancerId: payload.freelancerId,
          timestamp: new Date().toISOString()
        });
        return { success: false, error: 'Freelancer selecionado não existe na base de dados.' };
      }
    }

    // Generate random secure token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = computeHash(token);

    let expiresAt = null;
    if (payload.expiresDays && payload.expiresDays > 0) {
      expiresAt = new Date(Date.now() + payload.expiresDays * 24 * 60 * 60 * 1000).toISOString();
    }

    const { data: link, error: insertErr } = await adminClient
      .from('public_form_links')
      .insert({
        token_hash: tokenHash,
        link_type: payload.type,
        freelancer_id: payload.type === 'update_freelancer' ? payload.freelancerId : null,
        created_by: requester.id,
        status: 'active',
        expires_at: expiresAt,
        metadata: { token },
      })
      .select('*')
      .single();

    if (insertErr || !link) {
      console.error('Error generating link:', insertErr);
      return { success: false, error: `Erro ao salvar link no banco: ${insertErr?.message}` };
    }

    return {
      success: true,
      token, // Return clear token so it can be displayed/copied
      linkId: link.id,
      linkType: link.link_type,
      expiresAt: link.expires_at,
      message: 'Link gerado com sucesso.',
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro interno no servidor.' };
  }
}

/**
 * Revokes an active public form link.
 */
export async function revokePublicFormLinkAction(accessToken: string, linkId: string) {
  try {
    const adminClient = getSupabaseAdmin();
    const requester = await verifyAdminRequester(adminClient, accessToken);

    const { error: updateErr } = await adminClient
      .from('public_form_links')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: requester.id,
      })
      .eq('id', linkId);

    if (updateErr) {
      console.error('Error revoking link:', updateErr);
      return { success: false, error: `Erro ao revogar o link: ${updateErr.message}` };
    }

    return { success: true, message: 'Link revogado com sucesso.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro interno no servidor.' };
  }
}

/**
 * Lists all generated public form links with detailed relations.
 */
export async function listPublicFormLinksAction(accessToken: string) {
  try {
    const adminClient = getSupabaseAdmin();
    await verifyAdminRequester(adminClient, accessToken);

    const { data: links, error: fetchErr } = await adminClient
      .from('public_form_links')
      .select(`
        *, 
        freelancer:freelancers!public_form_links_freelancer_id_fkey(id, full_name, email, whatsapp), 
        creator:profiles!public_form_links_created_by_fkey(id, full_name),
        submission:freelancer_public_submissions!fk_submitted_submission(
          id, 
          status, 
          submission_type, 
          submitted_data, 
          created_at, 
          reviewed_at, 
          reviewed_by, 
          converted_freelancer_id,
          reviewer:profiles!freelancer_public_submissions_reviewed_by_fkey(id, full_name)
        )
      `)
      .order('created_at', { ascending: false });

    if (fetchErr) {
      console.error('Error fetching links:', fetchErr);
      return { success: false, error: `Erro ao buscar links: ${fetchErr.message}` };
    }

    return { success: true, links: links || [] };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro interno no servidor.' };
  }
}

/**
 * Clears the public form links history according to the chosen option.
 */
export async function clearPublicFormLinksHistoryAction(accessToken: string, option: number) {
  try {
    const adminClient = getSupabaseAdmin();
    await verifyAdminRequester(adminClient, accessToken);

    if (option === 1) {
      // 1. Limpar apenas links sem submissão
      const { error } = await adminClient
        .from('public_form_links')
        .delete()
        .is('submitted_submission_id', null);

      if (error) throw error;
    } else if (option === 2) {
      // 2. Limpar links usados e submissões pendentes de teste
      // Step A: Find submission IDs that are pending_review or under_review
      const { data: subs, error: subErr } = await adminClient
        .from('freelancer_public_submissions')
        .select('id')
        .in('status', ['pending_review', 'under_review']);

      if (subErr) throw subErr;

      const subIds = subs?.map(s => s.id) || [];

      if (subIds.length > 0) {
        // Step B: Set submitted_submission_id to null for links referencing these submissions
        const { error: updateErr } = await adminClient
          .from('public_form_links')
          .update({ submitted_submission_id: null })
          .in('submitted_submission_id', subIds);

        if (updateErr) throw updateErr;

        // Step C: Delete the submissions themselves
        const { error: delSubErr } = await adminClient
          .from('freelancer_public_submissions')
          .delete()
          .in('id', subIds);

        if (delSubErr) throw delSubErr;
      }

      // Step D: Delete any used links that no longer have a submission (or never had one)
      const { error: delLinksErr } = await adminClient
        .from('public_form_links')
        .delete()
        .eq('status', 'used')
        .is('submitted_submission_id', null);

      if (delLinksErr) throw delLinksErr;

      // Also clean up any active or expired/revoked links that have no submission
      const { error: delUnusedLinksErr } = await adminClient
        .from('public_form_links')
        .delete()
        .is('submitted_submission_id', null);

      if (delUnusedLinksErr) throw delUnusedLinksErr;

    } else if (option === 3) {
      // 3. Limpar todo o histórico de links e submissões, preservando freelancers oficiais
      // Step A: Nullify submitted_submission_id on all links first to prevent FK constraint errors
      const { error: updateErr } = await adminClient
        .from('public_form_links')
        .update({ submitted_submission_id: null })
        .not('id', 'is', null);

      if (updateErr) throw updateErr;

      // Step B: Delete all submissions
      const { error: delSubErr } = await adminClient
        .from('freelancer_public_submissions')
        .delete()
        .not('id', 'is', null);

      if (delSubErr) throw delSubErr;

      // Step C: Delete all links
      const { error: delLinksErr } = await adminClient
        .from('public_form_links')
        .delete()
        .not('id', 'is', null);

      if (delLinksErr) throw delLinksErr;
    } else {
      return { success: false, error: 'Opção de limpeza inválida.' };
    }

    return { success: true, message: 'Limpeza executada com sucesso.' };
  } catch (err: any) {
    console.error('Error clearing links history:', err);
    return { success: false, error: err.message || 'Erro interno no servidor.' };
  }
}


/**
 * Lists all public form submissions.
 */
export async function listPublicSubmissionsAction(accessToken: string) {
  try {
    const adminClient = getSupabaseAdmin();
    await verifyAdminRequester(adminClient, accessToken);

    const { data: submissions, error: fetchErr } = await adminClient
      .from('freelancer_public_submissions')
      .select('*, freelancer:freelancers!freelancer_public_submissions_freelancer_id_fkey(full_name), reviewer:profiles!freelancer_public_submissions_reviewed_by_fkey(full_name)')
      .order('created_at', { ascending: false });

    if (fetchErr) {
      console.error('Error fetching submissions:', fetchErr);
      return { success: false, error: `Erro ao buscar submissões: ${fetchErr.message}` };
    }

    return { success: true, submissions: submissions || [] };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro interno no servidor.' };
  }
}

/**
 * Approves or rejects a public form submission.
 */
function normalizeName(name: string): string {
  if (!name) return '';
  const map: Record<string, string> = {
    'Á':'A','À':'A','Â':'A','Ã':'A','Ä':'A','É':'E','È':'E','Ê':'E','Ë':'E','Í':'I','Ì':'I','Î':'I','Ï':'I','Ó':'O','Ò':'O','Ô':'O','Õ':'O','Ö':'O','Ú':'U','Ù':'U','Û':'U','Ü':'U','Ç':'C','Ý':'Y'
  };
  return name.toUpperCase().trim().replace(/\s+/g, ' ').split('').map(c => map[c] || c).join('');
}

/**
 * Approves or rejects a public form submission.
 */
export async function reviewPublicSubmissionAction(
  accessToken: string,
  submissionId: string,
  action: 'approve' | 'reject',
  notes?: string,
  options?: {
    bypassDuplicateCheck?: boolean;
    justification?: string;
    mergeToFreelancerId?: string;
  }
) {
  try {
    const adminClient = getSupabaseAdmin();
    const requester = await verifyAdminRequester(adminClient, accessToken);

    // 1. Atomic Lock: Claim processing by setting status to under_review only if it's currently pending_review
    const { data: lockResult, error: lockErr } = await adminClient
      .from('freelancer_public_submissions')
      .update({ status: 'under_review' })
      .eq('id', submissionId)
      .in('status', ['pending_review', 'under_review'])
      .select('*');

    if (lockErr || !lockResult || lockResult.length === 0) {
      return { success: false, error: 'Esta submissão já está sendo processada ou já foi revisada.' };
    }

    const submission = lockResult[0];

    if (action === 'reject') {
      if (!notes || !notes.trim()) {
        // Rollback status to pending_review
        await adminClient.from('freelancer_public_submissions').update({ status: 'pending_review' }).eq('id', submissionId);
        return { success: false, error: 'Justificativa/Notas de revisão são obrigatórias para rejeitar.' };
      }

      await adminClient
        .from('freelancer_public_submissions')
        .update({
          status: 'rejected',
          reviewed_by: requester.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
        })
        .eq('id', submissionId);

      return { success: true, message: 'Atualização rejeitada. A base oficial não foi alterada.' };
    }

    // Process approval
    const sData = submission.submitted_data;
    const emailNormalized = sData.email ? sData.email.trim().toLowerCase() : null;
    const whatsappNormalized = sData.whatsapp ? sData.whatsapp.replace(/\D/g, '') : null;
    const nameNormalized = sData.full_name ? normalizeName(sData.full_name) : null;

    if (submission.submission_type === 'new_freelancer') {
      if (options?.mergeToFreelancerId) {
        // MERGE FLOW: update existing instead of insert
        const targetId = options.mergeToFreelancerId;
        const { error: updateErr } = await adminClient
          .from('freelancers')
          .update({
            full_name: sData.full_name,
            email: sData.email?.trim().toLowerCase() || null,
            whatsapp: sData.whatsapp?.trim() || null,
            city: sData.city || null,
            state: sData.state || null,
            main_function_id: sData.main_function_id || null,
            seniority: sData.seniority || null,
            portfolio_url: sData.portfolio_url || null,
            linkedin_url: sData.linkedin_url || null,
            instagram_url: sData.instagram_url || null,
            availability: sData.availability || 'sob_consulta',
            observations: sData.observations || null,
            location_text: sData.location_text || null,
            has_worked_with_v3a: sData.has_worked_with_v3a || null,
            v3a_projects: sData.v3a_projects || null,
            current_situation: sData.current_situation || null,
            brands_worked: sData.brands_worked || null,
            portfolio_file_url: sData.portfolio_file_url || null,
            portfolio_file_name: sData.portfolio_file_name || null,
            portfolio_file_path: sData.portfolio_file_path || null,
            updated_by: requester.id,
          })
          .eq('id', targetId);

        if (updateErr) {
          console.error('Error merging freelancer:', updateErr);
          await adminClient.from('freelancer_public_submissions').update({ status: 'pending_review' }).eq('id', submissionId);
          return { success: false, error: `Erro ao mesclar dados no freelancer: ${updateErr.message}` };
        }

        // Sync industries
        await adminClient.from('freelancer_industries').delete().eq('freelancer_id', targetId);
        if (sData.industries && Array.isArray(sData.industries)) {
          for (const indId of sData.industries) {
            await adminClient.from('freelancer_industries').insert({
              freelancer_id: targetId,
              industry_id: indId,
            });
          }
        }

        // Update submission
        await adminClient
          .from('freelancer_public_submissions')
          .update({
            status: 'converted',
            converted_freelancer_id: targetId,
            reviewed_by: requester.id,
            reviewed_at: new Date().toISOString(),
            review_notes: notes || 'Dados mesclados no cadastro existente.',
          })
          .eq('id', submissionId);

        return { success: true, message: 'Dados mesclados no cadastro existente com sucesso.', freelancerId: targetId };
      }

      // Check duplicates
      let duplicateFound = null;
      if (!options?.bypassDuplicateCheck) {
        if (emailNormalized) {
          const { data: dupEmail } = await adminClient
            .from('freelancers')
            .select('id, full_name, main_function:freela_functions(name)')
            .eq('email_normalized', emailNormalized)
            .is('merged_into_freelancer_id', null)
            .maybeSingle();

          if (dupEmail) duplicateFound = dupEmail;
        }

        if (!duplicateFound && whatsappNormalized && whatsappNormalized !== '5521999999999') {
          const { data: dupWhatsapp } = await adminClient
            .from('freelancers')
            .select('id, full_name, main_function:freela_functions(name)')
            .eq('whatsapp_normalized', whatsappNormalized)
            .is('merged_into_freelancer_id', null)
            .maybeSingle();

          if (dupWhatsapp) duplicateFound = dupWhatsapp;
        }

        if (!duplicateFound && nameNormalized && sData.main_function_id) {
          const { data: dupNameFunc } = await adminClient
            .from('freelancers')
            .select('id, full_name, main_function:freela_functions(name)')
            .eq('full_name_normalized', nameNormalized)
            .eq('main_function_id', sData.main_function_id)
            .is('merged_into_freelancer_id', null)
            .maybeSingle();

          if (dupNameFunc) duplicateFound = dupNameFunc;
        }

        if (duplicateFound) {
          await adminClient.from('freelancer_public_submissions').update({ status: 'pending_review' }).eq('id', submissionId);
          return {
            success: false,
            error: 'Possível freelancer já existente na base.',
            duplicateFreelancer: {
              id: duplicateFound.id,
              name: duplicateFound.full_name,
              mainRole: (duplicateFound.main_function as any)?.name || ''
            },
          };
        }
      } else {
        // Creating anyway, verify justification
        if (!options.justification || !options.justification.trim()) {
          await adminClient.from('freelancer_public_submissions').update({ status: 'pending_review' }).eq('id', submissionId);
          return {
            success: false,
            error: 'Justificativa administrativa é obrigatória para criar freelancer com duplicidade.',
          };
        }
        // Save justification in audit log
        await adminClient.from('audit_logs').insert({
          user_id: requester.id,
          action: 'approve_duplicate_freelancer',
          entity: 'freelancers',
          new_data: { submitted_data: sData, justification: options.justification }
        });
      }

      // 2. Insert freelancer
      const { data: newFreela, error: insertErr } = await adminClient
        .from('freelancers')
        .insert({
          full_name: sData.full_name,
          email: sData.email?.trim().toLowerCase() || null,
          whatsapp: sData.whatsapp?.trim() || null,
          city: sData.city || null,
          state: sData.state || null,
          main_function_id: sData.main_function_id || null,
          seniority: sData.seniority || null,
          portfolio_url: sData.portfolio_url || null,
          linkedin_url: sData.linkedin_url || null,
          instagram_url: sData.instagram_url || null,
          availability: sData.availability || 'sob_consulta',
          status: 'elegivel', // Standard active status
          observations: sData.observations || null,
          location_text: sData.location_text || null,
          has_worked_with_v3a: sData.has_worked_with_v3a || null,
          v3a_projects: sData.v3a_projects || null,
          current_situation: sData.current_situation || null,
          brands_worked: sData.brands_worked || null,
          portfolio_file_url: sData.portfolio_file_url || null,
          portfolio_file_name: sData.portfolio_file_name || null,
          portfolio_file_path: sData.portfolio_file_path || null,
          created_by: requester.id,
        })
        .select('id')
        .single();

      if (insertErr || !newFreela) {
        console.error('Error inserting freelancer:', insertErr);
        await adminClient.from('freelancer_public_submissions').update({ status: 'pending_review' }).eq('id', submissionId);
        return { success: false, error: `Erro ao inserir freelancer: ${insertErr?.message}` };
      }

      // 3. Link industries
      if (sData.industries && Array.isArray(sData.industries)) {
        for (const indId of sData.industries) {
          await adminClient.from('freelancer_industries').insert({
            freelancer_id: newFreela.id,
            industry_id: indId,
          });
        }
      }

      // 4. Update submission
      await adminClient
        .from('freelancer_public_submissions')
        .update({
          status: 'converted',
          converted_freelancer_id: newFreela.id,
          reviewed_by: requester.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || `Aprovado e cadastrado no Banco Geral.${options?.justification ? ` Justificativa: ${options.justification}` : ''}`,
        })
        .eq('id', submissionId);

      return { success: true, message: 'Freela aprovado e incluído no Banco Geral.', freelancerId: newFreela.id };
    } else {
      // Update existing freelancer
      const freelaId = submission.freelancer_id;
      if (!freelaId) {
        await adminClient.from('freelancer_public_submissions').update({ status: 'pending_review' }).eq('id', submissionId);
        return { success: false, error: 'Atualização cadastral sem freelancer vinculado. Gere um novo link de atualização a partir do perfil do freela.' };
      }

      // Check if updated email or whatsapp belongs to another active freelancer
      if (emailNormalized) {
        const { data: otherEmail } = await adminClient
          .from('freelancers')
          .select('id, full_name')
          .eq('email_normalized', emailNormalized)
          .neq('id', freelaId)
          .is('merged_into_freelancer_id', null)
          .maybeSingle();

        if (otherEmail) {
          await adminClient.from('freelancer_public_submissions').update({ status: 'pending_review' }).eq('id', submissionId);
          return {
            success: false,
            error: `Este e-mail/WhatsApp já pertence a outro freelancer da base: ${sData.email} (Nome: ${otherEmail.full_name}).`,
          };
        }
      }

      if (whatsappNormalized && whatsappNormalized !== '5521999999999') {
        const { data: otherWhatsapp } = await adminClient
          .from('freelancers')
          .select('id, full_name')
          .eq('whatsapp_normalized', whatsappNormalized)
          .neq('id', freelaId)
          .is('merged_into_freelancer_id', null)
          .maybeSingle();

        if (otherWhatsapp) {
          await adminClient.from('freelancer_public_submissions').update({ status: 'pending_review' }).eq('id', submissionId);
          return {
            success: false,
            error: `Este e-mail/WhatsApp já pertence a outro freelancer da base: ${sData.whatsapp} (Nome: ${otherWhatsapp.full_name}).`,
          };
        }
      }

      // 1. Update freelancer profile
      const { error: updateErr } = await adminClient
        .from('freelancers')
        .update({
          full_name: sData.full_name,
          email: sData.email?.trim().toLowerCase() || null,
          whatsapp: sData.whatsapp?.trim() || null,
          city: sData.city || null,
          state: sData.state || null,
          main_function_id: sData.main_function_id || null,
          seniority: sData.seniority || null,
          portfolio_url: sData.portfolio_url || null,
          linkedin_url: sData.linkedin_url || null,
          instagram_url: sData.instagram_url || null,
          availability: sData.availability || 'sob_consulta',
          observations: sData.observations || null,
          location_text: sData.location_text || null,
          has_worked_with_v3a: sData.has_worked_with_v3a || null,
          v3a_projects: sData.v3a_projects || null,
          current_situation: sData.current_situation || null,
          brands_worked: sData.brands_worked || null,
          portfolio_file_url: sData.portfolio_file_url || null,
          portfolio_file_name: sData.portfolio_file_name || null,
          portfolio_file_path: sData.portfolio_file_path || null,
          updated_by: requester.id,
        })
        .eq('id', freelaId);

      if (updateErr) {
        console.error('Error updating freelancer:', updateErr);
        await adminClient.from('freelancer_public_submissions').update({ status: 'pending_review' }).eq('id', submissionId);
        return { success: false, error: `Erro ao atualizar freelancer: ${updateErr.message}` };
      }

      // 2. Sync industries (delete old and insert new)
      await adminClient
        .from('freelancer_industries')
        .delete()
        .eq('freelancer_id', freelaId);

      if (sData.industries && Array.isArray(sData.industries)) {
        for (const indId of sData.industries) {
          await adminClient.from('freelancer_industries').insert({
            freelancer_id: freelaId,
            industry_id: indId,
          });
        }
      }

      // 3. Update submission status
      await adminClient
        .from('freelancer_public_submissions')
        .update({
          status: 'approved',
          reviewed_by: requester.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || 'Atualização aprovada e aplicada.',
        })
        .eq('id', submissionId);

      return { success: true, message: 'Atualização aprovada e aplicada ao perfil do freela.' };
    }
  } catch (err: any) {
    console.error('Review submission error:', err);
    return { success: false, error: err.message || 'Erro interno no servidor.' };
  }
}
