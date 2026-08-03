'use client';

import React, { useState, useEffect } from 'react';
import { formatCnpj, normalizeCnpj, validateCnpj } from '@/lib/cnpj';

type CnpjInputProps = {
  value: string;
  onChange: (normalizedValue: string) => void;
  required?: boolean;
  disabled?: boolean;
  showValidationStatus?: boolean;
  allowMockIndicator?: boolean;
  error?: string;
  className?: string;
};

export default function CnpjInput({
  value,
  onChange,
  required = false,
  disabled = false,
  showValidationStatus = true,
  allowMockIndicator = true,
  error: externalError,
  className = '',
}: CnpjInputProps) {
  const [displayValue, setDisplayValue] = useState('');
  const [validationError, setValidationError] = useState<string | undefined>(undefined);
  const [isMock, setIsMock] = useState(false);

  // Synchronize internal display value with external value
  useEffect(() => {
    setDisplayValue(formatCnpj(value));
    
    // Check if the value is mock if needed
    if (value && value.length === 14) {
      const validation = validateCnpj(value);
      if (showValidationStatus) {
        setValidationError(validation.valid ? undefined : validation.errorMessage);
      }
    } else if (value && value.length > 0) {
      if (showValidationStatus) {
        setValidationError('O CNPJ informado possui formato inválido.');
      }
    } else {
      setValidationError(undefined);
    }
  }, [value, showValidationStatus]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const normalized = normalizeCnpj(rawValue).slice(0, 14); // Limit to 14 characters
    
    // Call parent onChange with normalized value
    onChange(normalized);
  };

  // Determine border and text styling based on validation states
  const displayError = externalError || validationError;
  const isValid = !displayError && value && value.length === 14;

  let borderClass = 'border-[var(--border-default)] focus:border-action-cyan';
  if (disabled) {
    borderClass = 'border-[var(--border-subtle)] opacity-50 cursor-not-allowed';
  } else if (displayError) {
    borderClass = 'border-red-500/80 focus:border-red-500';
  } else if (isValid && showValidationStatus) {
    borderClass = 'border-emerald-500/80 focus:border-emerald-500';
  }

  return (
    <div className={`flex flex-col space-y-1 w-full ${className}`}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          disabled={disabled}
          required={required}
          autoComplete="off"
          placeholder="00.000.000/0000-00"
          className={`w-full bg-[var(--bg-input)] p-3 pr-10 rounded-xl text-[var(--text-primary)] outline-none transition-colors border ${borderClass}`}
        />
        {showValidationStatus && !disabled && (
          <div className="absolute right-3 flex items-center pointer-events-none">
            {displayError && (
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            {isValid && (
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        )}
      </div>
      
      {displayError && (
        <span className="text-[11px] text-red-400 font-medium px-1">
          {displayError}
        </span>
      )}
      
      {isValid && !displayError && showValidationStatus && (
        <span className="text-[10px] text-emerald-400 font-semibold px-1 uppercase tracking-wider">
          CNPJ Válido {validateCnpj(value).format === 'alphanumeric' ? '(Alfanumérico)' : ''}
        </span>
      )}
    </div>
  );
}
