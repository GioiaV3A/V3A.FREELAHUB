export type CnpjValidationResult = {
  valid: boolean;
  normalized: string;
  formatted: string;
  format: "numeric" | "alphanumeric" | "invalid";
  errorCode?: string;
  errorMessage?: string;
};

/**
 * Normalizes a CNPJ string by removing spaces, dots, slashes, dashes and converting to uppercase.
 */
export function normalizeCnpj(value: string): string {
  if (!value) return '';
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Applies a progressive mask to a CNPJ string as it is being typed.
 * Mask format: XX.XXX.XXX/XXXX-XX
 */
export function formatCnpj(value: string): string {
  const clean = normalizeCnpj(value);
  if (clean.length === 0) return '';
  
  if (clean.length <= 2) {
    return clean;
  }
  if (clean.length <= 5) {
    return `${clean.slice(0, 2)}.${clean.slice(2)}`;
  }
  if (clean.length <= 8) {
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5)}`;
  }
  if (clean.length <= 12) {
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8)}`;
  }
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12, 14)}`;
}

/**
 * Verifies if the normalized CNPJ format matches the standard regex.
 * Format: 12 alphanumeric characters followed by 2 numeric digits.
 */
export function isValidCnpjFormat(value: string): boolean {
  const normalized = normalizeCnpj(value);
  return /^[A-Z0-9]{12}[0-9]{2}$/.test(normalized);
}

/**
 * Validates the check digits of a CNPJ using the Modulo 11 algorithm.
 * Converts alphanumeric characters 'A'-'Z' to numeric values by subtracting 48 from their ASCII code.
 */
export function isValidCnpjCheckDigits(value: string): boolean {
  const normalized = normalizeCnpj(value);
  
  if (normalized.length !== 14) return false;

  // Filter out known repeating sequences of numeric CNPJ
  if (/^(\d)\1{13}$/.test(normalized)) return false;

  // Convert chars to values using Receita Federal rule: charCode - 48
  const digits = Array.from(normalized).map(char => char.charCodeAt(0) - 48);

  // Validate 1st check digit
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum1 = 0;
  for (let i = 0; i < 12; i++) {
    sum1 += digits[i] * weights1[i];
  }
  const remainder1 = sum1 % 11;
  const expectedDigit1 = remainder1 < 2 ? 0 : 11 - remainder1;
  if (digits[12] !== expectedDigit1) return false;

  // Validate 2nd check digit
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum2 = 0;
  for (let i = 0; i < 13; i++) {
    sum2 += digits[i] * weights2[i];
  }
  const remainder2 = sum2 % 11;
  const expectedDigit2 = remainder2 < 2 ? 0 : 11 - remainder2;
  if (digits[13] !== expectedDigit2) return false;

  return true;
}

/**
 * Comprehensive CNPJ validation function returning a structured result.
 */
export function validateCnpj(value: string): CnpjValidationResult {
  if (!value || value.trim() === '') {
    return {
      valid: false,
      normalized: '',
      formatted: '',
      format: 'invalid',
      errorCode: 'CNPJ_REQUIRED',
      errorMessage: 'Informe o CNPJ utilizado para prestação dos serviços.'
    };
  }

  // Check for invalid characters (anything other than alphanumeric, dots, slashes, dashes, and spaces)
  if (/[^A-Za-z0-9\s\.\/\-]/.test(value)) {
    return {
      valid: false,
      normalized: normalizeCnpj(value),
      formatted: formatCnpj(value),
      format: 'invalid',
      errorCode: 'CNPJ_INVALID_CHARACTERS',
      errorMessage: 'O CNPJ informado possui formato inválido.'
    };
  }

  const normalized = normalizeCnpj(value);
  const formatted = formatCnpj(value);

  if (normalized.length !== 14) {
    return {
      valid: false,
      normalized,
      formatted,
      format: 'invalid',
      errorCode: 'CNPJ_INVALID_LENGTH',
      errorMessage: 'O CNPJ informado possui formato inválido.'
    };
  }

  if (!isValidCnpjFormat(normalized)) {
    return {
      valid: false,
      normalized,
      formatted,
      format: 'invalid',
      errorCode: 'CNPJ_INVALID_CHARACTERS',
      errorMessage: 'O CNPJ informado possui formato inválido.'
    };
  }

  if (!isValidCnpjCheckDigits(normalized)) {
    return {
      valid: false,
      normalized,
      formatted,
      format: 'invalid',
      errorCode: 'CNPJ_INVALID_CHECK_DIGITS',
      errorMessage: 'O CNPJ informado não passou na validação.'
    };
  }

  // Determine if it is numeric or alphanumeric
  const isNumeric = /^[0-9]{14}$/.test(normalized);

  return {
    valid: true,
    normalized,
    formatted,
    format: isNumeric ? 'numeric' : 'alphanumeric'
  };
}
