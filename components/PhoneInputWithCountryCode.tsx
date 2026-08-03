'use client';

import React, { useEffect, useState } from 'react';
import { Country } from '@/lib/countries';

interface PhoneInputProps {
  selectedCountry: Country;
  value: string;
  onChange: (formatted: string, raw: string) => void;
}

export default function PhoneInputWithCountryCode({
  selectedCountry,
  value,
  onChange,
}: PhoneInputProps) {
  const [inputValue, setInputValue] = useState('');

  // Normalize and format value based on selected country
  const formatPhoneNumber = (input: string, country: Country) => {
    // Extract digits only
    let digits = input.replace(/\D/g, '');
    const dialDigits = country.dial_code.replace(/\D/g, '');

    // If the input digits start with the country's dial code, remove it to get the local number
    if (digits.startsWith(dialDigits) && digits.length > dialDigits.length) {
      digits = digits.slice(dialDigits.length);
    }

    let formatted = '';
    let raw = dialDigits + digits;

    if (country.iso2 === 'BR') {
      // Limit local digits to 11 (2 for DDD + 9 for mobile phone)
      const local = digits.slice(0, 11);
      raw = dialDigits + local;
      
      if (local.length === 0) {
        formatted = `${country.dial_code} `;
      } else if (local.length <= 2) {
        formatted = `${country.dial_code} (${local}`;
      } else if (local.length <= 6) {
        formatted = `${country.dial_code} (${local.slice(0, 2)}) ${local.slice(2)}`;
      } else if (local.length <= 10) {
        // Landline: (XX) XXXX-XXXX
        formatted = `${country.dial_code} (${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
      } else {
        // Mobile: (XX) XXXXX-XXXX
        formatted = `${country.dial_code} (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
      }
    } else {
      // Generic formatting for other countries: +DDI XXXXXXXXXXXXX (max 15 local digits)
      const local = digits.slice(0, 15);
      raw = dialDigits + local;
      if (local.length === 0) {
        formatted = `${country.dial_code} `;
      } else {
        formatted = `${country.dial_code} ${local}`;
      }
    }

    return { formatted, raw };
  };

  // Format phone number on mount or when value/country changes
  useEffect(() => {
    const { formatted, raw } = formatPhoneNumber(value || '', selectedCountry);
    setInputValue(formatted);
  }, [value, selectedCountry]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    
    // Prevent deleting the prefix
    if (text.length < selectedCountry.dial_code.length) {
      const emptyVal = formatPhoneNumber('', selectedCountry);
      setInputValue(emptyVal.formatted);
      onChange(emptyVal.formatted, emptyVal.raw);
      return;
    }

    const { formatted, raw } = formatPhoneNumber(text, selectedCountry);
    setInputValue(formatted);
    onChange(formatted, raw);
  };

  return (
    <input
      type="text"
      value={inputValue}
      onChange={handleTextChange}
      className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] p-3 rounded-xl text-[var(--text-primary)] outline-none focus:border-action-cyan transition-colors"
      placeholder={`${selectedCountry.dial_code} ${selectedCountry.iso2 === 'BR' ? '(11) 99999-9999' : '999999999'}`}
    />
  );
}
