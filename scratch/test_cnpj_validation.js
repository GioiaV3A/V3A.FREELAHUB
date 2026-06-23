/**
 * Unit tests for CNPJ validation logic (numeric and alphanumeric).
 * Run using: npx tsx scratch/test_cnpj_validation.js
 */

const { validateCnpj, isValidCnpjCheckDigits, formatCnpj, normalizeCnpj } = require('../lib/cnpj');

const testCases = [
  // 1. Valid traditional numeric CNPJs
  {
    cnpj: '06.990.590/0001-23', // Google Brasil
    shouldBeValid: true,
    expectedFormat: 'numeric',
  },
  {
    cnpj: '12.345.678/0001-95',
    shouldBeValid: true,
    expectedFormat: 'numeric',
  },
  {
    cnpj: '12345678000195', // Unmasked
    shouldBeValid: true,
    expectedFormat: 'numeric',
  },

  // 2. Valid alphanumeric CNPJs (New Receita Federal guidelines)
  {
    cnpj: '12.ABC.345/0001-88', // Mock valid alphanumeric
    shouldBeValid: true,
    expectedFormat: 'alphanumeric',
  },
  {
    cnpj: 'AB.CDE.FGH/0001-95', // Mock valid alphanumeric
    shouldBeValid: true,
    expectedFormat: 'alphanumeric',
  },
  {
    cnpj: 'ABCDEFGH000195', // Unmasked alphanumeric
    shouldBeValid: true,
    expectedFormat: 'alphanumeric',
  },

  // 3. Invalid formats/lengths
  {
    cnpj: '12345',
    shouldBeValid: false,
    expectedError: 'CNPJ_INVALID_LENGTH',
  },
  {
    cnpj: '12.345.678/0001-999',
    shouldBeValid: false,
    expectedError: 'CNPJ_INVALID_LENGTH',
  },

  // 4. Invalid characters
  {
    cnpj: '12.345.678/0001-9A', // Last 2 digits must be numeric
    shouldBeValid: false,
    expectedError: 'CNPJ_INVALID_CHARACTERS',
  },
  {
    cnpj: '12.345.67@/0001-95', // Invalid symbol '@'
    shouldBeValid: false,
    expectedError: 'CNPJ_INVALID_CHARACTERS',
  },

  // 5. Invalid check digits (Modulo 11 fail)
  {
    cnpj: '06.990.590/0001-24', // Google with wrong check digit (4 instead of 3)
    shouldBeValid: false,
    expectedError: 'CNPJ_INVALID_CHECK_DIGITS',
  },
  {
    cnpj: '12.ABC.345/0001-51', // Wrong check digit for alphanumeric
    shouldBeValid: false,
    expectedError: 'CNPJ_INVALID_CHECK_DIGITS',
  },

  // 6. Repeating digits (numeric only check)
  {
    cnpj: '00.000.000/0000-00',
    shouldBeValid: false,
    expectedError: 'CNPJ_INVALID_CHECK_DIGITS',
  },
  {
    cnpj: '11.111.111/1111-11',
    shouldBeValid: false,
    expectedError: 'CNPJ_INVALID_CHECK_DIGITS',
  },
];

let passedTests = 0;
let failedTests = 0;

console.log("=== INICIANDO TESTES UNITÁRIOS DE VALIDAÇÃO DE CNPJ ===\n");

// Test normalizer and formatter first
console.log("--- Testando Normalização e Formatação ---");
const rawInput = " 12.abc-345/0001_50 ";
const norm = normalizeCnpj(rawInput);
const formatted = formatCnpj(rawInput);

if (norm === "12ABC345000150") {
  console.log("✔ Normalização: OK");
  passedTests++;
} else {
  console.error(`❌ Normalização falhou: obtido "${norm}", esperado "12ABC345000150"`);
  failedTests++;
}

if (formatted === "12.ABC.345/0001-50") {
  console.log("✔ Formatação: OK");
  passedTests++;
} else {
  console.error(`❌ Formatação falhou: obtido "${formatted}", esperado "12.ABC.345/0001-50"`);
  failedTests++;
}

console.log("\n--- Testando Casos de Uso ---");

testCases.forEach((tc, idx) => {
  const result = validateCnpj(tc.cnpj);
  
  let success = true;
  let detail = "";

  if (result.valid !== tc.shouldBeValid) {
    success = false;
    detail = `Validade esperada: ${tc.shouldBeValid}, obtida: ${result.valid}`;
  } else if (result.valid) {
    if (result.format !== tc.expectedFormat) {
      success = false;
      detail = `Formato esperado: ${tc.expectedFormat}, obtido: ${result.format}`;
    }
  } else {
    if (result.errorCode !== tc.expectedError) {
      success = false;
      detail = `Erro esperado: ${tc.expectedError}, obtido: ${result.errorCode} (${result.errorMessage})`;
    }
  }

  if (success) {
    console.log(`✔ Caso #${idx + 1} [${tc.cnpj}]: PASSOU`);
    passedTests++;
  } else {
    console.error(`❌ Caso #${idx + 1} [${tc.cnpj}]: FALHOU - ${detail}`);
    failedTests++;
  }
});

console.log("\n==============================================");
console.log(`RESULTADO FINAL: ${passedTests} aprovados, ${failedTests} falhos.`);
console.log("==============================================");

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
