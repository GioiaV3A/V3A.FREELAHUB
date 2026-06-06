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
  console.log("=== DIAGNÓSTICO DE DUPLICATAS NO BANCO DE FREELANCERS ===");

  // 1. Fetch all freelancers and their functions
  const { data: freelancers, error: freelaError } = await supabase
    .from('freelancers')
    .select(`
      id,
      full_name,
      email,
      whatsapp,
      city,
      state,
      seniority,
      status,
      created_at,
      email_normalized,
      whatsapp_normalized,
      full_name_normalized,
      merged_into_freelancer_id,
      main_function:freela_functions(id, name)
    `);

  if (freelaError || !freelancers) {
    console.error("Erro ao buscar freelancers:", freelaError);
    process.exit(1);
    return;
  }

  console.log(`Total de registros de freelancers encontrados: ${freelancers.length}`);

  // Filter out already merged freelancers to analyze active/canonical ones
  const activeFreelas = freelancers.filter(f => !f.merged_into_freelancer_id);
  console.log(`Freelancers ativos (não mesclados): ${activeFreelas.length}\n`);

  // Group by:
  // - Name (normalized)
  // - Email (normalized) - if not null

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

  // Combine duplicates groups based on either matching email or matching name
  // To avoid combining unrelated people with same name or email, we will do a union-find or connected components.
  // In our case, the duplicate groups are very clear:
  // - Arthur Lopes
  // - Evellyn Roberta
  // - Jose Gioia
  // - Test Pending
  // Let's build a mapping from freelancer_id to its duplicate set.

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

  let groupCount = 0;

  for (const [_, ids] of duplicateGroups.entries()) {
    if (ids.length < 2) continue; // Not a duplicate group
    groupCount++;

    const groupMembers = freelancers.filter(f => ids.includes(f.id));
    const firstMember = groupMembers[0];

    console.log(`--------------------------------------------------`);
    console.log(`GRUPO DUPLICADO DE CÓDIGO #${groupCount}: ${firstMember.full_name_normalized} (${firstMember.full_name})`);
    console.log(`--------------------------------------------------`);

    const membersReport = [];

    for (const member of groupMembers) {
      // Query relation counts
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

      // Filled fields score
      let filledFields = 0;
      if (member.city) filledFields++;
      if (member.state) filledFields++;
      if (member.seniority) filledFields++;
      if (member.email) filledFields++;
      if (member.whatsapp) filledFields++;

      const score = (evalCount * 100) + (allocCount * 50) + (shCount * 20) + (negCount * 10) + (subCount * 5) + (linkCount * 2) + (filledFields * 1);

      membersReport.push({
        id: member.id,
        name: member.full_name,
        email: member.email,
        whatsapp: member.whatsapp,
        function: (member.main_function as any)?.name || '—',
        seniority: member.seniority,
        status: member.status,
        created_at: member.created_at,
        evalCount,
        allocCount,
        shCount,
        negCount,
        subCount,
        linkCount,
        score
      });
    }

    // Recommend canonical based on scoring:
    // 1. Highest scoring relations.
    // 2. Oldest created_at is preferred over newer, BUT "Mais recente, apenas em último caso"
    // So to sorting, we sort by score desc, then by created_at asc (oldest first).
    membersReport.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const recommendedCanonical = membersReport[0];

    membersReport.forEach(m => {
      const isCanonical = m.id === recommendedCanonical.id;
      console.log(`[${isCanonical ? 'RECOMENDADO CANÔNICO' : 'DUPLICADO'}] ID: ${m.id}`);
      console.log(`  Nome: ${m.name} | E-mail: ${m.email} | WhatsApp: ${m.whatsapp}`);
      console.log(`  Função: ${m.function} | Senioridade: ${m.seniority} | Status: ${m.status}`);
      console.log(`  Criado em: ${m.created_at}`);
      console.log(`  Vínculos: Avaliações: ${m.evalCount} | Alocações: ${m.allocCount} | Shortlists: ${m.shCount} | Negociações: ${m.negCount} | Submissões: ${m.subCount} | Links: ${m.linkCount}`);
      console.log(`  Score de Importância: ${m.score}`);
      console.log();
    });

    console.log(`Recomendação Canônica: ID ${recommendedCanonical.id} (${recommendedCanonical.name})\n`);
  }
}

run().catch(err => {
  console.error("Erro na execução do script:", err);
  process.exit(1);
});
