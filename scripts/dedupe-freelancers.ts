import { createClient } from '@supabase/supabase-js';

declare const process: any;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Erro: Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function run() {
  console.log("=== MESCLANDO FREELANCERS DUPLICADOS COM SEGURANÇA ===");

  // 1. Fetch all freelancers
  const { data: freelancers, error: freelaError } = await supabase
    .from('freelancers')
    .select('*');

  if (freelaError || !freelancers) {
    console.error("Erro ao buscar freelancers:", freelaError);
    process.exit(1);
    return;
  }

  // Filter out already merged freelancers
  const activeFreelas = freelancers.filter(f => !f.merged_into_freelancer_id);

  // Group by name and email using Union-Find to match check-freelancer-duplicates logic
  const parent = new Map<string, string>();
  function find(id: string): string {
    if (!parent.has(id)) {
      parent.set(id, id);
      return id;
    }
    let p = parent.get(id)!;
    while (p !== parent.get(p)) {
      p = parent.get(p)!;
    }
    return p;
  }
  function union(id1: string, id2: string) {
    const root1 = find(id1);
    const root2 = find(id2);
    if (root1 !== root2) {
      parent.set(root1, root2);
    }
  }

  const groupsByName = new Map<string, NonNullable<typeof freelancers>>();
  const groupsByEmail = new Map<string, NonNullable<typeof freelancers>>();

  for (const f of activeFreelas) {
    if (f.full_name_normalized) {
      const arr = groupsByName.get(f.full_name_normalized) || [];
      arr.push(f);
      groupsByName.set(f.full_name_normalized, arr);
    }
    if (f.email_normalized) {
      const arr = groupsByEmail.get(f.email_normalized) || [];
      arr.push(f);
      groupsByEmail.set(f.email_normalized, arr);
    }
  }

  // Union by name
  for (const [_, list] of groupsByName.entries()) {
    if (list.length < 2) continue;
    for (let i = 1; i < list.length; i++) {
      union(list[i].id, list[0].id);
    }
  }

  // Union by email
  for (const [_, list] of groupsByEmail.entries()) {
    if (list.length < 2) continue;
    for (let i = 1; i < list.length; i++) {
      union(list[i].id, list[0].id);
    }
  }

  // Group by root parent
  const duplicateGroups = new Map<string, string[]>();
  for (const f of activeFreelas) {
    const root = find(f.id);
    const arr = duplicateGroups.get(root) || [];
    arr.push(f.id);
    duplicateGroups.set(root, arr);
  }

  // Process duplicate groups
  for (const [_, ids] of duplicateGroups.entries()) {
    if (ids.length < 2) continue; // Not a duplicate

    const groupMembers = freelancers.filter(f => ids.includes(f.id));
    
    // Evaluate scores for each member to elect canonical
    const membersWithScores = [];
    for (const member of groupMembers) {
      const [
        evaluations,
        allocations,
        shortlists,
        negotiations,
        submissions,
        formLinks
      ] = await Promise.all([
        supabase.from('evaluations').select('id', { count: 'exact', head: true }).eq('freelancer_id', member.id),
        supabase.from('allocations').select('id', { count: 'exact', head: true }).eq('freelancer_id', member.id),
        supabase.from('shortlist_candidates').select('id', { count: 'exact', head: true }).eq('freelancer_id', member.id),
        supabase.from('negotiations').select('id', { count: 'exact', head: true }).eq('freelancer_id', member.id),
        supabase.from('freelancer_public_submissions').select('id', { count: 'exact', head: true }).eq('freelancer_id', member.id),
        supabase.from('public_form_links').select('id', { count: 'exact', head: true }).eq('freelancer_id', member.id),
      ]);

      const evalCount = evaluations.count || 0;
      const allocCount = allocations.count || 0;
      const shCount = shortlists.count || 0;
      const negCount = negotiations.count || 0;
      const subCount = submissions.count || 0;
      const linkCount = formLinks.count || 0;

      let filledFields = 0;
      if (member.city) filledFields++;
      if (member.state) filledFields++;
      if (member.seniority) filledFields++;
      if (member.email) filledFields++;
      if (member.whatsapp) filledFields++;
      if (member.portfolio_url) filledFields++;
      if (member.linkedin_url) filledFields++;

      const score = (evalCount * 100) + (allocCount * 50) + (shCount * 20) + (negCount * 10) + (subCount * 5) + (linkCount * 2) + (filledFields * 1);

      membersWithScores.push({
        ...member,
        evalCount,
        allocCount,
        shCount,
        negCount,
        subCount,
        linkCount,
        score
      });
    }

    // Sort to elect canonical: score DESC, created_at ASC (oldest first).
    membersWithScores.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const canonical = membersWithScores[0];
    const duplicates = membersWithScores.slice(1);

    console.log(`\nMesclando no canônico: ${canonical.full_name} (${canonical.id})`);
    console.log(`  Score: ${canonical.score} | Registros duplicados a mesclar: ${duplicates.length}`);

    // Update canonical data with missing values from duplicates
    const updatedData: Record<string, any> = {};
    const fieldsToMerge = [
      'email', 'whatsapp', 'city', 'state', 'seniority', 'portfolio_url', 
      'linkedin_url', 'reference_daily_rate', 'average_score', 'technical_score', 
      'deadline_score', 'communication_score', 'behavior_score', 'evaluations_count', 
      'observations'
    ];

    for (const field of fieldsToMerge) {
      if (!canonical[field]) {
        // Find a duplicate that has this field
        const fallback = duplicates.find(d => d[field]);
        if (fallback) {
          updatedData[field] = fallback[field];
          console.log(`  Preenchendo campo '${field}' com valor do duplicado: ${fallback[field]}`);
        }
      }
    }

    // If there are updates, apply them to canonical
    if (Object.keys(updatedData).length > 0) {
      const { error: updateError } = await supabase
        .from('freelancers')
        .update(updatedData)
        .eq('id', canonical.id);

      if (updateError) {
        console.error(`  Erro ao atualizar canônico ${canonical.id}:`, updateError);
        continue;
      }
    }

    // Perform merge operations for each duplicate
    for (const dup of duplicates) {
      console.log(`  -> Processando duplicado: ${dup.full_name} (${dup.id})`);

      // 1. Relink shortlist candidates safely (avoiding UNIQUE constraint violations)
      const { data: dupCandidates } = await supabase
        .from('shortlist_candidates')
        .select('*')
        .eq('freelancer_id', dup.id);

      if (dupCandidates && dupCandidates.length > 0) {
        for (const cand of dupCandidates) {
          const { data: existing } = await supabase
            .from('shortlist_candidates')
            .select('id')
            .eq('request_id', cand.request_id)
            .eq('freelancer_id', canonical.id)
            .maybeSingle();

          if (existing) {
            // Canonical is already in this shortlist request, delete duplicate candidate mapping
            await supabase.from('shortlist_candidates').delete().eq('id', cand.id);
            console.log(`    Deletado shortlist candidate duplicado: ID ${cand.id}`);
          } else {
            // Relink candidate to canonical
            await supabase
              .from('shortlist_candidates')
              .update({ freelancer_id: canonical.id })
              .eq('id', cand.id);
            console.log(`    Reapontado shortlist candidate ID ${cand.id} para canônico`);
          }
        }
      }

      // 2. Relink other tables
      const tablesToRelink = [
        { name: 'negotiations', col: 'freelancer_id' },
        { name: 'exception_approvals', col: 'freelancer_id' },
        { name: 'allocations', col: 'freelancer_id' },
        { name: 'evaluations', col: 'freelancer_id' },
        { name: 'payment_codes', col: 'freelancer_id' },
        { name: 'freelancer_public_submissions', col: 'freelancer_id' },
        { name: 'public_form_links', col: 'freelancer_id' }
      ];

      for (const t of tablesToRelink) {
        const { error: relinkError } = await supabase
          .from(t.name)
          .update({ [t.col]: canonical.id })
          .eq(t.col, dup.id);

        if (relinkError) {
          console.error(`    Erro ao reapontar tabela ${t.name}:`, relinkError);
        } else {
          console.log(`    Tabela ${t.name} reapontada com sucesso`);
        }
      }

      // Also relink converted_freelancer_id in freelancer_public_submissions
      await supabase
        .from('freelancer_public_submissions')
        .update({ converted_freelancer_id: canonical.id })
        .eq('converted_freelancer_id', dup.id);

      // 3. Relink industries & skills
      // Industries
      const { data: dupIndustries } = await supabase
        .from('freelancer_industries')
        .select('*')
        .eq('freelancer_id', dup.id);

      if (dupIndustries) {
        for (const ind of dupIndustries) {
          const { data: hasInd } = await supabase
            .from('freelancer_industries')
            .select('freelancer_id')
            .eq('freelancer_id', canonical.id)
            .eq('industry_id', ind.industry_id)
            .maybeSingle();

          if (!hasInd) {
            await supabase.from('freelancer_industries').insert({
              freelancer_id: canonical.id,
              industry_id: ind.industry_id
            });
          }
          await supabase
            .from('freelancer_industries')
            .delete()
            .eq('freelancer_id', dup.id)
            .eq('industry_id', ind.industry_id);
        }
      }

      // Skills
      const { data: dupSkills } = await supabase
        .from('freelancer_skills')
        .select('*')
        .eq('freelancer_id', dup.id);

      if (dupSkills) {
        for (const sk of dupSkills) {
          const { data: hasSk } = await supabase
            .from('freelancer_skills')
            .select('freelancer_id')
            .eq('freelancer_id', canonical.id)
            .eq('skill_id', sk.skill_id)
            .maybeSingle();

          if (!hasSk) {
            await supabase.from('freelancer_skills').insert({
              freelancer_id: canonical.id,
              skill_id: sk.skill_id,
              level: sk.level
            });
          }
          await supabase
            .from('freelancer_skills')
            .delete()
            .eq('freelancer_id', dup.id)
            .eq('skill_id', sk.skill_id);
        }
      }

      // 4. Inactivate duplicate freelancer record
      const { error: inactivateError } = await supabase
        .from('freelancers')
        .update({
          merged_into_freelancer_id: canonical.id,
          merged_at: new Date().toISOString(),
          status: 'inativo'
        })
        .eq('id', dup.id);

      if (inactivateError) {
        console.error(`    Erro ao inativar freelancer duplicado ${dup.id}:`, inactivateError);
      } else {
        console.log(`    Freelancer duplicado marcado como mesclado/inativo`);
      }

      // 5. Create merge audit log entry
      const { error: logError } = await supabase
        .from('freelancer_merge_logs')
        .insert({
          canonical_freelancer_id: canonical.id,
          merged_freelancer_id: dup.id,
          reason: 'Deduplicação automática por e-mail/nome normalizado.',
          previous_data: dup,
          merged_data: { ...canonical, ...updatedData }
        });

      if (logError) {
        console.error(`    Erro ao registrar log de merge para ${dup.id}:`, logError);
      } else {
        console.log(`    Log de merge registrado com sucesso`);
      }
    }
  }

  console.log("\nDeduplicação concluída com sucesso!");
}

run().catch(err => {
  console.error("Erro na execução do script:", err);
  process.exit(1);
});
