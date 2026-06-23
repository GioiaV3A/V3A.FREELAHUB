/**
 * Script to reversibly clear all mocked CNPJs (where cnpj_is_mock = true)
 * from the freelancers database without deleting the freelancer records.
 * Run in dry-run mode by default. Run with --commit to execute the changes.
 * Usage: node scratch/clear_mock_cnpjs.js [--commit]
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

async function run() {
  const commit = process.argv.includes('--commit');
  console.log("=== INICIANDO CLEAR DE CNPJS MOCK ===");
  console.log(`Modo: ${commit ? 'EFETIVAR REMOÇÃO (COMMIT)' : 'SIMULAÇÃO (DRY-RUN)'}`);

  // Fetch freelancers with mock CNPJs
  const { data: mockFreelancers, error: fetchErr } = await supabase
    .from('freelancers')
    .select('id, full_name, cnpj_normalized, cnpj_mock_batch')
    .eq('cnpj_is_mock', true);

  if (fetchErr) {
    console.error("Erro ao buscar freelancers com CNPJ mock:", fetchErr);
    process.exit(1);
  }

  console.log(`Total de freelancers com CNPJ mock encontrados: ${mockFreelancers.length}`);

  if (mockFreelancers.length === 0) {
    console.log("Nenhum freelancer com CNPJ mock para remover.");
    return;
  }

  const updates = [];

  for (const f of mockFreelancers) {
    updates.push({
      id: f.id,
      cnpj_normalized: null,
      cnpj_is_mock: false,
      cnpj_source: null,
      cnpj_mock_batch: null,
      cnpj_updated_at: new Date().toISOString()
    });

    console.log(`[PREPARAÇÃO REMOÇÃO] ID: ${f.id} | Nome: ${f.full_name} | CNPJ atual: ${f.cnpj_normalized} | Lote: ${f.cnpj_mock_batch}`);
  }

  if (commit) {
    console.log(`Limpando ${updates.length} registros no banco de dados sequencialmente...`);
    
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
        console.error(`Erro ao limpar ID ${update.id}:`, updateErr);
        process.exit(1);
      }
    }
    console.log("Remoção de CNPJs mock finalizada com SUCESSO!");
  } else {
    console.log("\nSimulação concluída. Nenhuma alteração foi feita no banco de dados.");
    console.log("Para efetivar, execute: node scratch/clear_mock_cnpjs.js --commit");
  }
}

run().catch(err => {
  console.error("Erro inesperado na execução do script:", err);
  process.exit(1);
});
