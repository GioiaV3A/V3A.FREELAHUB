'use server';

import { getSupabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

// Helper to compute SHA-256 hash of the public token
function computeHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Validates a public link token.
 * Returns the link status and details. If it's a freelancer update link, 
 * it also returns the current freelancer data.
 */
export async function validatePublicLinkAction(token: string) {
  try {
    if (!token) {
      return { success: false, status: 'invalid', error: 'Token não fornecido.' };
    }

    const adminClient = getSupabaseAdmin();
    const tokenHash = computeHash(token);

    // Fetch link details
    const { data: link, error: linkErr } = await adminClient
      .from('public_form_links')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (linkErr) {
      console.error('Error fetching token:', linkErr);
      return { success: false, status: 'invalid', error: 'Erro ao validar o link.' };
    }

    if (!link) {
      return { success: false, status: 'invalid', error: 'Link inválido.' };
    }

    // Check revoked status
    if (link.status === 'revoked' || link.revoked_at) {
      return { success: false, status: 'revoked', error: 'Este link foi desativado pelo RH.' };
    }

    // Check used status
    if (link.status === 'used' || link.used_at) {
      return { success: false, status: 'used', error: 'Este link já foi utilizado. Caso precise atualizar informações, solicite um novo link ao RH.' };
    }

    // Check expiration status
    if (link.status === 'expired' || (link.expires_at && new Date(link.expires_at) < new Date())) {
      // Auto-update status to expired if it was active but time passed
      if (link.status === 'active') {
        await adminClient
          .from('public_form_links')
          .update({ status: 'expired' })
          .eq('id', link.id);
      }
      return { success: false, status: 'expired', error: 'Este link expirou. Solicite um novo acesso ao RH.' };
    }

    if (link.status !== 'active') {
      return { success: false, status: 'invalid', error: 'Link inválido.' };
    }

    // Link is active! Let's load the necessary form support data (functions and industries)
    const { data: functions } = await adminClient
      .from('freela_functions')
      .select('id, name')
      .eq('status', 'active')
      .order('name');

    const { data: industries } = await adminClient
      .from('industries')
      .select('id, name')
      .eq('status', 'active')
      .order('name');

    // If type is update_freelancer, fetch existing freelancer data
    let freelancerData = null;
    if (link.link_type === 'update_freelancer' && link.freelancer_id) {
      const { data: freela, error: freelaErr } = await adminClient
        .from('freelancers')
        .select('*, freelancer_industries(industry_id)')
        .eq('id', link.freelancer_id)
        .single();

      if (freelaErr || !freela) {
        return { success: false, status: 'invalid', error: 'Freelancer associado não encontrado.' };
      }

      // Format current industries as array of IDs
      const industryIds = freela.freelancer_industries?.map((fi: any) => fi.industry_id) || [];

      freelancerData = {
        id: freela.id,
        full_name: freela.full_name,
        email: freela.email || '',
        whatsapp: freela.whatsapp || '',
        city: freela.city || '',
        state: freela.state || '',
        main_function_id: freela.main_function_id || '',
        seniority: freela.seniority || '',
        portfolio_url: freela.portfolio_url || '',
        linkedin_url: freela.linkedin_url || '',
        instagram_url: freela.instagram_url || '',
        availability: freela.availability || 'sob_consulta',
        observations: freela.observations || '',
        location_text: freela.location_text || '',
        has_worked_with_v3a: freela.has_worked_with_v3a || '',
        v3a_projects: freela.v3a_projects || '',
        current_situation: freela.current_situation || '',
        brands_worked: freela.brands_worked || '',
        portfolio_file_url: freela.portfolio_file_url || '',
        portfolio_file_name: freela.portfolio_file_name || '',
        portfolio_file_path: freela.portfolio_file_path || '',
        industries: industryIds,
        cnpj_normalized: freela.cnpj_normalized || '',
        foreign_tax_id: freela.foreign_tax_id || '',
        tax_country_code: freela.tax_country_code || '',
      };
    }

    return {
      success: true,
      status: 'active',
      linkType: link.link_type,
      linkId: link.id,
      freelancerId: link.freelancer_id,
      functions: functions || [],
      industries: industries || [],
      freelancerData,
    };
  } catch (err: any) {
    console.error('Validation Error:', err);
    return { success: false, status: 'invalid', error: 'Erro inesperado no servidor.' };
  }
}

/**
 * Submits the public form data.
 * Checks token validity, invalidates the link, saves the submission.
 */
export async function submitPublicFormAction(token: string, formData: any) {
  try {
    if (!token) {
      return { success: false, error: 'Token inválido ou ausente.' };
    }

    const adminClient = getSupabaseAdmin();
    const tokenHash = computeHash(token);

    // 1. Verify link status and update to 'used' atomically to prevent double submission
    const { data: updatedLink, error: updateErr } = await adminClient
      .from('public_form_links')
      .update({
        status: 'used',
        used_at: new Date().toISOString()
      })
      .eq('token_hash', tokenHash)
      .eq('status', 'active') // only update if currently active
      .is('used_at', null)
      .select('*')
      .maybeSingle();

    if (updateErr) {
      console.error('Error invalidating link:', updateErr);
      return { success: false, error: 'Erro ao processar envio do formulário.' };
    }

    if (!updatedLink) {
      return { success: false, error: 'Link expirado, desativado ou já utilizado.' };
    }

    const linkId = updatedLink.id;
    const linkType = updatedLink.link_type;
    const freelancerId = updatedLink.freelancer_id;

    // Backend validations and normalizations
    if (formData.state) {
      formData.state = formData.state.toUpperCase().trim();
    }
    if (formData.city) {
      formData.city = formData.city.toUpperCase().trim();
    }
    if (formData.whatsapp) {
      const cleanDigits = formData.whatsapp.replace(/\D/g, '');
      const dialCode = formData.phone_country_code || formData.whatsapp_dial_code || '+55';
      const dialDigits = dialCode.replace(/\D/g, '');
      
      // Enforce minimum length: DDI + at least 6 digits
      if (cleanDigits.length < dialDigits.length + 6) {
        // Rollback link status to active
        await adminClient
          .from('public_form_links')
          .update({
            status: 'active',
            used_at: null
          })
          .eq('id', linkId);
          
        return { success: false, error: 'Número de WhatsApp inválido (muito curto).' };
      }
      
      formData.whatsapp_raw_digits = cleanDigits;
    }

    // 2. Prepare snapshot and diff for freelancer updates
    let currentSnapshot: any = null;
    let diffData: any = null;

    if (linkType === 'update_freelancer' && freelancerId) {
      // Get current data snapshot
      const { data: freela } = await adminClient
        .from('freelancers')
        .select('*, freelancer_industries(industry_id)')
        .eq('id', freelancerId)
        .single();

      if (freela) {
        const industryIds = freela.freelancer_industries?.map((fi: any) => fi.industry_id) || [];
        
        currentSnapshot = {
          full_name: freela.full_name,
          email: freela.email || '',
          whatsapp: freela.whatsapp || '',
          city: freela.city || '',
          state: freela.state || '',
          main_function_id: freela.main_function_id || '',
          seniority: freela.seniority || '',
          portfolio_url: freela.portfolio_url || '',
          linkedin_url: freela.linkedin_url || '',
          instagram_url: freela.instagram_url || '',
          availability: freela.availability || '',
          observations: freela.observations || '',
          location_text: freela.location_text || '',
          has_worked_with_v3a: freela.has_worked_with_v3a || '',
          v3a_projects: freela.v3a_projects || '',
          current_situation: freela.current_situation || '',
          brands_worked: freela.brands_worked || '',
          portfolio_file_url: freela.portfolio_file_url || '',
          portfolio_file_name: freela.portfolio_file_name || '',
          portfolio_file_path: freela.portfolio_file_path || '',
          industries: industryIds,
          cnpj_normalized: freela.cnpj_normalized || '',
          foreign_tax_id: freela.foreign_tax_id || '',
          tax_country_code: freela.tax_country_code || '',
        };

        // Compute diff
        diffData = {} as any;
        const allKeys = Array.from(new Set([...Object.keys(currentSnapshot), ...Object.keys(formData)]));
        for (const key of allKeys) {
          const valSnapshot = currentSnapshot[key];
          const valForm = formData[key];

          if (Array.isArray(valSnapshot) || Array.isArray(valForm)) {
            const arrSnap = (valSnapshot || []).sort().join(',');
            const arrForm = (valForm || []).sort().join(',');
            if (arrSnap !== arrForm) {
              diffData[key] = { from: valSnapshot, to: valForm };
            }
          } else if (valSnapshot !== valForm) {
            diffData[key] = { from: valSnapshot, to: valForm };
          }
        }
      }
    }

    // 3. Create the submission
    const { data: submission, error: submitErr } = await adminClient
      .from('freelancer_public_submissions')
      .insert({
        link_id: linkId,
        submission_type: linkType,
        freelancer_id: freelancerId || null,
        submitted_data: formData,
        current_data_snapshot: currentSnapshot,
        diff_data: diffData,
        status: 'pending_review',
      })
      .select('id')
      .single();

    if (submitErr || !submission) {
      console.error('Error saving submission:', submitErr);
      // Rollback link status to active (in case of submission insert failure)
      await adminClient
        .from('public_form_links')
        .update({
          status: 'active',
          used_at: null
        })
        .eq('id', linkId);
        
      return { success: false, error: 'Erro ao registrar as respostas. Tente novamente.' };
    }

    // 4. Update the link with the submission ID reference
    await adminClient
      .from('public_form_links')
      .update({ submitted_submission_id: submission.id })
      .eq('id', linkId);

    return { success: true, message: 'Informações enviadas com sucesso. Seu cadastro foi enviado para análise do RH da V3A.' };
  } catch (err: any) {
    console.error('Submission processing error:', err);
    return { success: false, error: 'Erro interno no servidor.' };
  }
}

/**
 * Handles portfolio file upload for public forms.
 * Validates the token before allowing upload.
 */
export async function uploadPublicPortfolioAction(
  token: string,
  formData: FormData
) {
  try {
    if (!token) {
      return { success: false, error: 'Token inválido ou ausente.' };
    }

    const adminClient = getSupabaseAdmin();
    const tokenHash = computeHash(token);

    // Verify token is active
    const { data: link, error: linkErr } = await adminClient
      .from('public_form_links')
      .select('id, status, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (linkErr || !link || link.status !== 'active') {
      return { success: false, error: 'Link expirado, desativado ou inválido.' };
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return { success: false, error: 'Link expirou.' };
    }

    const file = formData.get('file') as File | null;
    if (!file) {
      return { success: false, error: 'Nenhum arquivo enviado.' };
    }

    // Max 20MB
    if (file.size > 20 * 1024 * 1024) {
      return { success: false, error: 'Arquivo excede limite de 20MB.' };
    }

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `public-submissions/${link.id}/${timestamp}-${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to 'freelancer-portfolios' bucket
    const { data: uploadData, error: uploadErr } = await adminClient.storage
      .from('freelancer-portfolios')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr);
      return { success: false, error: `Erro no upload: ${uploadErr.message}` };
    }

    // Get a signed URL valid for 365 days
    const { data: signedData, error: signedErr } = await adminClient.storage
      .from('freelancer-portfolios')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    if (signedErr || !signedData) {
      return { success: false, error: 'Falha ao gerar URL assinada do portfólio.' };
    }

    return {
      success: true,
      url: signedData.signedUrl,
      path: storagePath,
      name: file.name,
    };
  } catch (err: any) {
    console.error('Public upload error:', err);
    return { success: false, error: 'Erro inesperado no upload.' };
  }
}

/**
 * Public action to check if a CNPJ already exists in the database.
 * Returns only a boolean to protect personal data.
 */
export async function checkPublicDuplicateAction(cnpj: string, excludeFreelancerId?: string) {
  try {
    if (!cnpj) return { hasDuplicate: false };
    const clean = cnpj.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (clean.length !== 14) return { hasDuplicate: false };

    const adminClient = getSupabaseAdmin();
    let query = adminClient
      .from('freelancers')
      .select('id')
      .eq('cnpj_normalized', clean)
      .is('merged_into_freelancer_id', null);

    if (excludeFreelancerId) {
      query = query.neq('id', excludeFreelancerId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('Error checking public CNPJ duplicate:', error);
      return { hasDuplicate: false };
    }

    return { hasDuplicate: !!data };
  } catch (err) {
    console.error('checkPublicDuplicateAction error:', err);
    return { hasDuplicate: false };
  }
}

