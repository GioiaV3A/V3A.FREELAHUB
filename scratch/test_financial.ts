import { calculateInclusiveDays, calculatePolicyLimitForJob, getJobClosedDiscount } from '../lib/financial';

console.log('--- RUNNING FINANCIAL CALCULATIONS TEST ---');

// Test Case 1: Inclusive duration check
// Início = 2026-07-01, Fim = 2026-07-10
const startDate = '2026-07-01';
const endDate = '2026-07-10';
const calculatedDays = calculateInclusiveDays(startDate, endDate);
console.log(`Inclusive Days (2026-07-01 to 2026-07-10): Expected = 10, Actual = ${calculatedDays}`);
if (calculatedDays !== 10) {
  console.error('FAIL: calculatedDays is not 10');
  process.exit(1);
}

// Test Case 2: Job Fechado policy calculations
const mockPolicies = [
  {
    role: 'Diretor de Arte',
    seniority: 'Sênior',
    billingType: 'Diária',
    referenceValue: 600,
    ceilingValue: 800,
    remunerationModel: 'daily'
  }
];

const result = calculatePolicyLimitForJob({
  role: 'Diretor de Arte',
  seniority: 'Sênior',
  remunerationModel: 'Job fechado',
  startDate,
  endDate,
  proposedAmount: 10000,
  policies: mockPolicies
});

console.log('Policy limit result:', JSON.stringify(result, null, 2));

const discount = getJobClosedDiscount(10);
console.log(`Discount for 10 days: Expected = 0.05, Actual = ${discount}`);
if (discount !== 0.05) {
  console.error(`FAIL: discount is not 0.05 (got ${discount})`);
  process.exit(1);
}

// Check referenceAmount
// 600 * 10 * (1 - 0.05) = 6000 * 0.95 = 5700
console.log(`Reference Amount: Expected = 5700, Actual = ${result.referenceAmount}`);
if (result.referenceAmount !== 5700) {
  console.error('FAIL: referenceAmount is not 5700');
  process.exit(1);
}

// Check limitAmount
// 800 * 10 * (1 - 0.05) = 8000 * 0.95 = 7600
console.log(`Limit Amount: Expected = 7600, Actual = ${result.limitAmount}`);
if (result.limitAmount !== 7600) {
  console.error('FAIL: limitAmount is not 7600');
  process.exit(1);
}

// Check excessAmount
// 10000 - 7600 = 2400
console.log(`Excess Amount: Expected = 2400, Actual = ${result.excessAmount}`);
if (result.excessAmount !== 2400) {
  console.error('FAIL: excessAmount is not 2400');
  process.exit(1);
}

// Check excessPercent
// (2400 / 7600) * 100 = 31.5789... %
console.log(`Excess Percent: Expected ~31.6%, Actual = ${result.excessPercent.toFixed(1)}%`);
if (Math.abs(result.excessPercent - 31.5789) > 0.01) {
  console.error('FAIL: excessPercent is not ~31.6%');
  process.exit(1);
}

// Check policyStatus
console.log(`Policy Status: Expected = above_policy, Actual = ${result.policyStatus}`);
if (result.policyStatus !== 'above_policy') {
  console.error('FAIL: policyStatus is not above_policy');
  process.exit(1);
}

console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
