/**
 * Backfill script to generate unique valid mock CNPJs for existing Brazilian freelancers who lack one.
 * Run in dry-run mode by default. Run with --commit to execute the changes.
 * Usage: node scratch/backfill_cnpjs.js [--commit]
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Load env variables manually from .env
const envPath = path.resolve(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error(`Erro: Arquivo .env não encontrado em: ${envPath}`);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const getEnvVar = (key) => {
  const match = envContent.match(new RegExp(`^${key}=["']?([^"'\r\n]+)["']?`, 'm'));
  return match ? match[1] : undefined;
};

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const serviceRoleKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas no .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// Helper to generate a valid CNPJ modulo 11
function generateValidMockCnpj(index) {
  // Use a mock prefix starting with 99.
  // 5 digits (99999) + 6 digits (padded index) + 1 digit (1) = 12 digits base
  const pad = String(index).padStart(6, '0');
  const base = `99999${pad}1`;

  // Calculate 1st check digit
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum1 = 0;
  for (let i = 0; i < 12; i++) {
    sum1 += parseInt(base[i], 10) * weights1[i];
  }
  const remainder1 = sum1 % 11;
  const digit1 = remainder1 < 2 ? 0 : 11 - remainder1;

  // Calculate 2nd check digit
  const base2 = base + digit1;
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum2 = 0;
  for (let i = 0; i < 13; i++) {
    sum2 += parseInt(base2[i], 10) * weights2[i];
  }
  const remainder2 = sum2 % 11;
  const digit2 = remainder2 < 2 ? 0 : 11 - remainder2;

  return base2 + digit2;
}

async function run() {
  const commit = process.argv.includes('--commit');
  console.log("=== INICIANDO BACKFILL DE CNPJS MOCK ===");
  console.log(`Modo: ${commit ? 'EFETIVAR ALTERAÇÕES (COMMIT)' : 'SIMULAÇÃO (DRY-RUN)'}`);

  // Fetch all freelancers to check existing CNPJs and identify which ones need backfill
  const { data: freelancers, error: fetchErr } = await supabase
    .from('freelancers')
    .select('id, full_name, tax_country_code, cnpj_normalized');

  if (fetchErr) {
    console.error("Erro ao buscar freelancers:", fetchErr);
    process.exit(1);
  }

  console.log(`Total de freelancers cadastrados: ${freelancers.length}`);

  // Collect all existing CNPJs to avoid collisions
  const existingCnpjs = new Set(
    freelancers
      .map(f => f.cnpj_normalized)
      .filter(cnpj => cnpj && cnpj.trim() !== '')
  );

  // Filter Brazilian freelancers lacking a CNPJ
  const toBackfill = freelancers.filter(f => {
    const isBr = !f.tax_country_code || f.tax_country_code === 'BR';
    const hasNoCnpj = !f.cnpj_normalized || f.cnpj_normalized.trim() === '';
    return isBr && hasNoCnpj;
  });

  console.log(`Freelancers residentes no Brasil sem CNPJ: ${toBackfill.length}`);

  if (toBackfill.length === 0) {
    console.log("Nenhum freelancer precisa de backfill.");
    return;
  }

  const updates = [];
  let cnpjIndex = 1;

  for (const f of toBackfill) {
    let mockCnpj;
    // Keep generating until we find a unique CNPJ that does not exist in the DB
    do {
      mockCnpj = generateValidMockCnpj(cnpjIndex);
      cnpjIndex++;
    } while (existingCnpjs.has(mockCnpj));

    // Register it to prevent collision in the same batch
    existingCnpjs.add(mockCnpj);

    updates.push({
      id: f.id,
      cnpj_normalized: mockCnpj,
      cnpj_is_mock: true,
      cnpj_source: 'migration_mock',
      cnpj_mock_batch: 'BACKFILL_CNPJ_2026_01',
      cnpj_updated_at: new Date().toISOString()
    });

    console.log(`[PREPARAÇÃO] ID: ${f.id} | Nome: ${f.full_name} -> Mock CNPJ: ${mockCnpj}`);
  }

  if (commit) {
    console.log(`Salvando ${updates.length} registros no banco de dados sequencialmente...`);
    
    for (const update of updates) {
      const { error: updateErr } = await supabase
        .from('freelancers')
        .update({
          cnpj_normalized: update.cnpj_normalized,
          cnpj_is_mock: update.cnpj_is_mock,
          cnpj_source: update.cnpj_source,
          cnpj_mock_batch: update.cnpj_mock_batch,
          cnpj_updated_at: update.cnpj_updated_at
        })
        .eq('id', update.id);

      if (updateErr) {
        console.error(`Erro ao atualizar ID ${update.id} (${update.cnpj_normalized}):`, updateErr);
        process.exit(1);
      }
    }
    console.log("Backfill finalizado com SUCESSO!");
  } else {
    console.log("\nSimulação concluída. Nenhuma alteração foi feita no banco de dados.");
    console.log("Para efetivar, execute: node scratch/backfill_cnpjs.js --commit");
  }
}

run().catch(err => {
  console.error("Erro inesperado na execução do script:", err);
  process.exit(1);
});
