'use client';

import React from 'react';
import { mapSeniorityToUI, mapAvailabilityToUI } from '@/lib/dbMapper';

interface SubmissionDiffViewerProps {
  currentData: any; // Snapshot from DB
  submittedData: any; // Data submitted by freelancer
  functions: Array<{ id: string; name: string }>;
  industries: Array<{ id: string; name: string }>;
}

export default function SubmissionDiffViewer({
  currentData,
  submittedData,
  functions,
  industries
}: SubmissionDiffViewerProps) {
  if (!currentData) {
    return (
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-slate-500 text-center select-none">
        Nenhum snapshot de dados anteriores disponível.
      </div>
    );
  }

  // Map database keys to user friendly UI labels in Portuguese
  const fieldLabels: Record<string, string> = {
    full_name: 'Nome Completo',
    email: 'E-mail',
    whatsapp: 'WhatsApp',
    city: 'Cidade',
    state: 'Estado',
    location_text: 'País',
    main_function_id: 'Função Principal',
    seniority: 'Senioridade',
    availability: 'Disponibilidade',
    current_situation: 'Situação Atual',
    has_worked_with_v3a: 'Já trabalhou com V3A?',
    v3a_projects: 'Projetos Realizados',
    brands_worked: 'Marcas Atendidas',
    portfolio_url: 'URL Portfólio',
    linkedin_url: 'LinkedIn',
    instagram_url: 'Instagram',
    portfolio_file_url: 'Anexo de Portfólio',
    observations: 'Observações / Comentários',
    industries: 'Segmentos / Indústrias'
  };

  // Resolve values to user friendly strings (e.g. resolve UUIDs to names)
  const formatValue = (key: string, value: any) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-slate-400 italic font-semibold">Vazio</span>;
    }

    if (key === 'main_function_id') {
      const func = functions.find(f => f.id === value);
      return func ? func.name : <span className="text-slate-500 font-bold">{value}</span>;
    }

    if (key === 'industries') {
      if (!Array.isArray(value) || value.length === 0) return <span className="text-slate-400 italic">Nenhum</span>;
      const names = value
        .map(id => industries.find(i => i.id === id)?.name)
        .filter(Boolean);
      return names.join(', ');
    }

    if (key === 'seniority') {
      return mapSeniorityToUI(value);
    }

    if (key === 'availability') {
      return mapAvailabilityToUI(value);
    }

    if (key === 'portfolio_file_url') {
      // If portfolio upload is a snapshot, display name if available
      const name = key === 'portfolio_file_url' ? (submittedData?.portfolio_file_name || currentData?.portfolio_file_name || 'Ver Arquivo') : 'Ver Arquivo';
      return (
        <a 
          href={value} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-600 font-bold hover:underline inline-flex items-center gap-1"
        >
          {name}
        </a>
      );
    }

    return String(value);
  };

  // Check if a field value actually changed
  const hasFieldChanged = (key: string) => {
    const valSnap = currentData[key];
    const valForm = submittedData[key];

    if (Array.isArray(valSnap) || Array.isArray(valForm)) {
      const arrSnap = (valSnap || []).sort().join(',');
      const arrForm = (valForm || []).sort().join(',');
      return arrSnap !== arrForm;
    }
    return valSnap !== valForm;
  };

  const keysToCompare = Object.keys(fieldLabels);

  return (
    <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-xs text-xs select-none">
      {/* Table header */}
      <div className="grid grid-cols-3 bg-slate-50 p-3 border-b border-slate-100 font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">
        <span>Campo / Atributo</span>
        <span>Dado Atual (Banco Oficial)</span>
        <span>Dado Proposto (Alterado)</span>
      </div>

      {/* Table rows */}
      <div className="divide-y divide-slate-100 bg-white">
        {keysToCompare.map(key => {
          const changed = hasFieldChanged(key);
          const label = fieldLabels[key];
          
          // Skip showing file uploads keys if not relevant (they are covered in portfolio_file_url)
          if (key === 'portfolio_file_name' || key === 'portfolio_file_path') return null;

          return (
            <div 
              key={key} 
              className={`grid grid-cols-3 p-3 items-center transition
                ${changed ? 'bg-amber-50/25' : 'hover:bg-slate-50/30'}`}
            >
              {/* Field Label */}
              <span className={`font-bold ${changed ? 'text-slate-800' : 'text-slate-500'}`}>
                {label}
              </span>

              {/* Original Snapshot Data */}
              <div className={`pr-4 truncate ${changed ? 'bg-red-50 text-red-700 font-bold px-2.5 py-1.5 rounded-lg border border-red-100 mr-2' : 'text-slate-600'}`}>
                {formatValue(key, currentData[key])}
              </div>

              {/* Proposed Updated Data */}
              <div className={`truncate ${changed ? 'bg-emerald-50 text-emerald-800 font-black px-2.5 py-1.5 rounded-lg border border-emerald-100' : 'text-slate-600'}`}>
                {formatValue(key, submittedData[key])}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
