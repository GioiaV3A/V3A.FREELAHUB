/**
 * Automated tests for OPERAÇÕES (operations) role permissions and constraints.
 * Run using: npx tsx scratch/test_operations_auth.js
 */

const { can, hasDataScope } = require('../lib/permissions');

// 1. Simulação da lógica de validação de createUserAction
function simulateCreateUser(requesterRole, targetRole, targetNucleoId, targetJobTitle) {
  // Simula a verificação de status e existência do perfil do solicitante
  const requesterProfile = { role: requesterRole, status: 'active' };

  // Normalizar role recebido
  let normalizedRole = targetRole?.toLowerCase();
  if (normalizedRole === 'operacao') {
    normalizedRole = 'operations';
  }

  if (!['master', 'rh', 'nucleo', 'c_level', 'operations'].includes(normalizedRole)) {
    return { success: false, code: 'ROLE_NOT_AVAILABLE', error: 'O perfil selecionado não está disponível para seleção.' };
  }

  // Validar permissão por perfil de quem cria quem
  if (normalizedRole === 'operations') {
    if (!['master', 'rh', 'c_level'].includes(requesterProfile.role)) {
      return {
        success: false,
        code: 'ROLE_ASSIGNMENT_NOT_ALLOWED',
        error: 'Seu perfil não possui permissão para cadastrar usuários com o perfil OPERAÇÕES.'
      };
    }
  } else {
    if (requesterProfile.role !== 'master' && requesterProfile.role !== 'rh') {
      return { success: false, error: 'Você não tem permissão para cadastrar usuários.' };
    }
    if (requesterProfile.role === 'rh' && normalizedRole !== 'nucleo') {
      return { success: false, error: 'RH pode cadastrar apenas usuários com perfil de acesso NÚCLEO.' };
    }
  }

  // Se cargo vier vazio
  if (!targetJobTitle || !targetJobTitle.trim()) {
    return { success: false, error: 'Informe o cargo/função do usuário.' };
  }

  // Validar nucleus_id baseado no role
  if (normalizedRole === 'operations' && targetNucleoId !== null && targetNucleoId !== undefined && targetNucleoId !== '') {
    return {
      success: false,
      code: 'OPERATIONS_USER_CANNOT_HAVE_NUCLEUS',
      error: 'O perfil OPERAÇÕES não deve possuir núcleo vinculado.'
    };
  }

  if (normalizedRole === 'nucleo' && (!targetNucleoId || targetNucleoId === '')) {
    return { success: false, error: 'Usuários do perfil NÚCLEO devem possuir núcleo vinculado.' };
  }

  return { success: true, message: 'Usuário validado com sucesso para criação.' };
}

// Execução dos cenários de testes
let passedTests = 0;
let failedTests = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`✔ [PASSOU] ${description}`);
    passedTests++;
  } else {
    console.error(`❌ [FALHOU] ${description}`);
    failedTests++;
  }
}

console.log("=== INICIANDO TESTES DE PERMISSÕES DO PERFIL OPERAÇÕES ===\n");

// --- GRUPO A: Validação do Modelo de Autorização Centralizado ---
console.log("--- Grupo A: Modelo de Autorização ---");
assert("Operations pode ver oportunidades", can({ role: 'operations' }, 'opportunities.view') === true);
assert("Operations pode criar oportunidades", can({ role: 'operations' }, 'opportunities.create') === true);
assert("Operations pode emitir solicitações de pagamento", can({ role: 'operations' }, 'paymentRequests.create') === true);
assert("Operations NÃO pode gerenciar usuários", can({ role: 'operations' }, 'users.create') === false);
assert("Operations NÃO pode criar núcleos", can({ role: 'operations' }, 'nuclei.create') === false);
assert("Operations tem escopo de dados multi-núcleo (all_nuclei)", hasDataScope({ role: 'operations' }, 'all_nuclei') === true);
assert("Núcleo tem escopo de dados restrito (single_nucleus)", hasDataScope({ role: 'nucleo' }, 'single_nucleus') === true);

// --- GRUPO B: Validação das Regras de Criação de Usuário (Cenários 1 a 5) ---
console.log("\n--- Grupo B: Regras de Criação (Cenários 1 a 5) ---");

// Teste 1 - MASTER cria OPERAÇÕES
const t1 = simulateCreateUser('master', 'operations', null, 'Gerente de Contratos');
assert("MASTER pode criar OPERAÇÕES", t1.success === true);

// Teste 2 - RH cria OPERAÇÕES
const t2 = simulateCreateUser('rh', 'operations', null, 'Coordenador Operacional');
assert("RH pode criar OPERAÇÕES", t2.success === true);

// Teste 3 - C-LEVEL cria OPERAÇÕES
const t3 = simulateCreateUser('c_level', 'operations', null, 'Analista de Operações');
assert("C-LEVEL pode criar OPERAÇÕES", t3.success === true);

// Teste 4 - OPERAÇÕES tenta criar OPERAÇÕES
const t4 = simulateCreateUser('operations', 'operations', null, 'Analista');
assert("OPERAÇÕES não pode criar OPERAÇÕES (ROLE_ASSIGNMENT_NOT_ALLOWED)", 
  t4.success === false && t4.code === 'ROLE_ASSIGNMENT_NOT_ALLOWED'
);

// Teste 5 - NÚCLEO tenta criar OPERAÇÕES
const t5 = simulateCreateUser('nucleo', 'operations', null, 'Analista');
assert("NÚCLEO não pode criar OPERAÇÕES", t5.success === false);

// Teste 6 - OPERAÇÕES tenta ser criado com núcleo vinculado
const t6 = simulateCreateUser('master', 'operations', 'uuid-nucleo-123', 'Gerente');
assert("OPERAÇÕES não pode ter núcleo vinculado (OPERATIONS_USER_CANNOT_HAVE_NUCLEUS)", 
  t6.success === false && t6.code === 'OPERATIONS_USER_CANNOT_HAVE_NUCLEUS'
);

// Teste 7 - NÚCLEO tenta ser criado sem núcleo vinculado
const t7 = simulateCreateUser('master', 'nucleo', null, 'Head');
assert("NÚCLEO deve ter núcleo vinculado", t7.success === false);

console.log("\n==============================================");
console.log(`RESULTADO DOS TESTES: ${passedTests} aprovados, ${failedTests} falhos.`);
console.log("==============================================");

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
