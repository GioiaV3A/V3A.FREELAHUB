const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = "https://vehkccapjpsebtmoezfm.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlaGtjY2FwanBzZWJ0bW9lemZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ4ODY0MiwiZXhwIjoyMDk2MDY0NjQyfQ.2Zw5xqE499boJzYjO9bEJm3frehU3aoD2DP5Rf29KAQ";

const adminClient = createClient(supabaseUrl, serviceRoleKey);

const isUuid = (id) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
};

function computeHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function testValidation(freelancerId, type) {
  console.log(`\nTesting validation for type: "${type}", freelancerId: "${freelancerId}"`);
  
  if (type === 'update_freelancer') {
    if (!freelancerId) {
      console.log("FAIL: Freelancer é obrigatório para links de atualização.");
      return;
    }
    if (!isUuid(freelancerId)) {
      console.log("SUCCESS (caught invalid UUID): ID inválido do freelancer. Selecione novamente a partir da base oficial.");
      return;
    }

    const { data: freelaExists, error: freelaErr } = await adminClient
      .from('freelancers')
      .select('id, full_name')
      .eq('id', freelancerId)
      .maybeSingle();

    if (freelaErr) {
      console.error("FAIL: Erro ao verificar existência no banco:", freelaErr);
      return;
    }

    if (!freelaExists) {
      console.log("SUCCESS (caught non-existent freelancer): Freelancer selecionado não existe na base de dados.");
      return;
    }
    
    console.log(`SUCCESS: Freelancer exists! (${freelaExists.full_name})`);
  } else {
    console.log("SUCCESS: New freelancer link logic passed check.");
  }
}

async function runAll() {
  // 1. Test invalid ID format (e.g. temporary "free-123")
  await testValidation("free-123", "update_freelancer");

  // 2. Test non-existent valid UUID format
  await testValidation("9cbd9ce1-1302-4035-b571-56e073f4fec5", "update_freelancer");

  // 3. Test existing freelancer UUID
  const { data: sample } = await adminClient.from('freelancers').select('id').limit(1).single();
  if (sample) {
    await testValidation(sample.id, "update_freelancer");
  } else {
    console.log("No freelancers in database to test existing ID.");
  }
}

runAll();
