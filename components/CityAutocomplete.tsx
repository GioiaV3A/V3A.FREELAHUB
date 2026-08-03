'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  stateValue: string;
  onStateChange: (value: string) => void;
  countryCode: string;
}

export default function CityAutocomplete({
  value,
  onChange,
  stateValue,
  onStateChange,
  countryCode,
}: CityAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Helper to remove accents/diacritics
  const removeAccents = (str: string): string => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (term: string) => {
    onChange(term);

    if (term.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const normalizedQuery = removeAccents(term).toUpperCase().trim();
      
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .eq('country_code', countryCode)
        .ilike('city_name_normalized', `%${normalizedQuery}%`)
        .limit(8);

      if (error) {
        console.error('Error fetching city suggestions:', error);
      } else if (data && data.length > 0) {
        setSuggestions(data);
        setIsOpen(true);
      } else {
        setSuggestions([]);
        setIsOpen(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (city: any) => {
    // Save in UPPERCASE as per requirement
    onChange(city.city_name.toUpperCase());
    onStateChange(city.state_code.toUpperCase());
    setIsOpen(false);
  };

  const handleBlur = () => {
    // When leaving the input, normalize the manually typed text to UPPERCASE
    setTimeout(() => {
      onChange(value.toUpperCase().trim());
      onStateChange(stateValue.toUpperCase().trim());
    }, 200);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => handleSearch(e.target.value)}
        onBlur={handleBlur}
        className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] p-3 rounded-xl text-[var(--text-primary)] outline-none focus:border-action-cyan transition-colors"
        placeholder="Digite para buscar a cidade..."
        autoComplete="off"
      />
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-55 left-0 right-0 mt-1 bg-[var(--bg-input)] border border-white/15 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-white/5 select-none">
          {suggestions.map((city) => (
            <li
              key={city.id}
              onClick={() => handleSelect(city)}
              className="p-3 text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)] cursor-pointer flex justify-between items-center transition-colors text-xs font-semibold"
            >
              <span>{city.city_name}</span>
              <span className="text-[10px] text-action-cyan font-extrabold uppercase border border-action-cyan/30 px-1.5 py-0.5 rounded">
                {city.state_code}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
