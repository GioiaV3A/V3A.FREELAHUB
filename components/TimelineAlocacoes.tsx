'use client';

import React, { useState, useMemo } from 'react';
import { DatabaseProps } from '@/app/page';
import { Calendar, AlertTriangle, HelpCircle, Layers, CheckCircle, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { useSortableTable } from '@/hooks/useSortableTable';

export default function TimelineAlocacoes({ db }: { db: DatabaseProps }) {
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);

  const currentUser = db.currentUser;
  const isNucleoProfile = currentUser.profile === 'NÚCLEO';
  const myNucleoId = currentUser.nucleoId || (db.nucleos && db.nucleos[0]?.id) || '55d9d7c0-d3cb-4f1e-84ad-e77ff961805b';
  
  // Filter allocations based on profile
  const allocationsToDisplay = db.allocations.filter(alloc => {
    if (isNucleoProfile && alloc.nucleoId !== myNucleoId) {
      return false;
    }
    if (filterActiveOnly && alloc.status !== 'Ativo') {
      return false;
    }
    return true;
  });

  const allocationsWithDetails = useMemo(() => {
    return allocationsToDisplay.map(alloc => {
      const fl = db.freelancers.find(f => f.id === alloc.freelancerId);
      const job = db.jobs.find(j => j.id === alloc.jobId);
      const ncl = db.nucleos.find(n => n.id === alloc.nucleoId);
      return {
        ...alloc,
        freelancerName: fl?.name || '',
        freelancerRole: fl?.mainRole || '',
        jobName: job?.name || '',
        nucleoName: ncl?.name || '',
      };
    });
  }, [allocationsToDisplay, db]);

  const {
    data: sortedAllocations,
    sortKey,
    sortDirection,
    requestSort
  } = useSortableTable(allocationsWithDetails, 'freelancerName', 'asc');

  // Calculate schedule overlap for each freelancer
  const checkOverlap = (allocId: string, freelancerId: string, start: string, end: string) => {
    const overlaps = db.allocations.filter(other => 
      other.id !== allocId && 
      other.freelancerId === freelancerId &&
      other.status === 'Ativo' &&
      // Overlap calculation formula
      ((start <= other.endDate && end >= other.startDate))
    );
    return overlaps;
  };

  return (
    <div id="timeline-component-container" className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Timeline Operacional de Alocações</h2>
          <p className="text-xs text-text-secondary">
            {isNucleoProfile 
              ? `Exibindo cronograma logístico de fornecedores do núcleo: ${db.nucleos.find(n => n.id === myNucleoId)?.name || 'Ativo'}.`
              : 'Gantt consolidado da agência. Verificação em tempo real de conformidade de agendas.'
            }
          </p>
        </div>

        {/* Filters bar */}
        <div className="flex gap-2 text-xs shrink-0 bg-white border border-border-subtle p-1.5 rounded-xl">
          <button
            onClick={() => setFilterActiveOnly(!filterActiveOnly)}
            className={`p-1.5 px-3 rounded-lg font-bold transition-all ${filterActiveOnly ? 'bg-action-cyan text-white' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Apenas Ativas
          </button>
        </div>
      </div>

      {/* Grid resource gantt board */}
      <div className="bg-white rounded-2xl border border-border-subtle overflow-hidden shadow-xs">
        {/* Header dates mock representing June 2026 */}
        <div className="bg-surface p-4 border-b border-border-subtle grid grid-cols-1 md:grid-cols-12 gap-2 text-xs font-semibold text-text-secondary">
          <div
            onClick={() => requestSort('freelancerName')}
            className="md:col-span-4 flex items-center gap-1.5 text-text-primary font-bold cursor-pointer hover:text-action-cyan transition-colors select-none"
          >
            <Layers className="w-4 h-4 text-text-secondary shrink-0" />
            <span>ALOCAÇÃO / FREELANCER</span>
            {sortKey === 'freelancerName' && sortDirection ? (
              sortDirection === 'asc' ? (
                <ChevronUp className="w-3.5 h-3.5 text-action-cyan shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-action-cyan shrink-0" />
              )
            ) : (
              <div className="w-3.5 h-3.5 opacity-20 hover:opacity-100 flex flex-col items-center justify-center shrink-0">
                <ChevronUp className="w-2.5 h-2.5" />
                <ChevronDown className="w-2.5 h-2.5 -mt-1.5" />
              </div>
            )}
          </div>
          <div className="md:col-span-8 grid grid-cols-4 text-center text-[10px] uppercase font-bold tracking-wider hidden md:grid">
            <div className="border-r border-border-subtle/50">Semana 1 (01-07/Jun)</div>
            <div className="border-r border-border-subtle/50">Semana 2 (08-14/Jun)</div>
            <div className="border-r border-border-subtle/50">Semana 3 (15-21/Jun)</div>
            <div>Semana 4 (22-30/Jun)</div>
          </div>
        </div>

        <div className="divide-y divide-border-subtle">
          {sortedAllocations.length === 0 ? (
            <div className="p-12 text-center text-text-secondary text-xs italic">
              Nenhuma alocação registrada no cronograma correspondente.
            </div>
          ) : (
            sortedAllocations.map((alloc) => {
              const fl = db.freelancers.find(f => f.id === alloc.freelancerId);
              const job = db.jobs.find(j => j.id === alloc.jobId);
              const ncl = db.nucleos.find(n => n.id === alloc.nucleoId);

              // Analyze conflict
              const overlaps = checkOverlap(alloc.id, alloc.freelancerId, alloc.startDate, alloc.endDate);
              const hasConflict = overlaps.length > 0 && alloc.status === 'Ativo';

              // Visual calculations for progress bar placement
              // June has 30 days. Let's make an approximation using startDate day
              const getDayFromDate = (dateString: string) => {
                const dayStr = dateString.split('-')[2];
                return dayStr ? parseInt(dayStr) : 1;
              };

              const startDay = Math.max(1, getDayFromDate(alloc.startDate));
              const endDay = Math.min(30, getDayFromDate(alloc.endDate));
              const leftPercent = Math.max(0, Math.min(100, Math.round(((startDay - 1) / 30) * 100)));
              const widthPercent = Math.max(10, Math.min(100 - leftPercent, Math.round(((endDay - startDay + 1) / 30) * 100)));

              return (
                <div key={alloc.id} className={`p-4 hover:bg-surface-container-low transition-colors ${hasConflict ? 'bg-status-error/[0.02]' : ''}`}>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    {/* Panel 1: details */}
                    <div className="md:col-span-4 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <strong className="text-text-primary text-xs font-semibold">{fl?.name || 'Incompleto'}</strong>
                        <span className="font-mono text-[10px] font-bold text-text-secondary bg-surface-container border border-border-subtle px-1.5 py-0.5 rounded-lg">
                          {alloc.allocationCode}
                        </span>
                      </div>
                      
                      <p className="text-[11px] text-text-secondary">
                        <span className="font-semibold text-text-primary">{fl?.mainRole}</span> &bull; {ncl?.name}
                      </p>
                      
                      {/* Conflict visual alerts */}
                      {hasConflict ? (
                        <div className="inline-flex items-center gap-1 bg-status-error/10 text-status-error text-[10px] font-bold p-1 px-2 rounded-lg animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Conflito: {overlaps.length} {overlaps.length === 1 ? 'Job' : 'Jobs'} sobrepostos</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 bg-status-success/15 text-status-success text-[10px] font-bold p-1 px-2 rounded-lg">
                          <CheckCircle className="w-3 h-3" />
                          <span>Agenda Disponível / Livre</span>
                        </div>
                      )}
                    </div>

                    {/* Panel 2: Gantt timeline progress block */}
                    <div className="md:col-span-8 space-y-2">
                      <div className="relative w-full h-8 bg-surface border border-border-subtle/50 rounded-lg overflow-hidden hidden md:block">
                        {/* Weekly gridlines */}
                        <div className="absolute inset-0 grid grid-cols-4 pointer-events-none opacity-20">
                          <div className="border-r border-text-secondary h-full"></div>
                          <div className="border-r border-text-secondary h-full"></div>
                          <div className="border-r border-text-secondary h-full"></div>
                          <div className="h-full"></div>
                        </div>

                        {/* Bar */}
                        <div
                          className={`absolute top-1.5 bottom-1.5 rounded-md flex items-center justify-between px-3 text-[10px] text-white font-extrabold shadow-sm cursor-pointer hover:brightness-105 transition-all
                            ${hasConflict ? 'bg-status-error' : 'bg-sidebar-navy'}`}
                          style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                          title={`Projeto: ${job?.name}\nPeríodo: ${alloc.startDate} a ${alloc.endDate}\nValor Diário: R$ ${alloc.approvedValue}`}
                        >
                          <span className="truncate">{job?.name || 'Job'}</span>
                        </div>
                      </div>

                      {/* Small mobile date fallback display */}
                      <div className="md:hidden space-y-1.5 text-xs bg-surface p-2.5 rounded-lg border border-border-subtle">
                        <p className="text-text-primary"><span className="font-bold">Campanha:</span> {job?.name} ({job?.client})</p>
                        <p className="text-text-secondary"><span className="font-bold">Cronograma:</span> {alloc.startDate} a {alloc.endDate}</p>
                        <p className="text-text-secondary"><span className="font-bold">Taxa Diária:</span> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(alloc.approvedValue)}</p>
                        {hasConflict && (
                          <div className="mt-2 text-status-error font-semibold flex items-center gap-1 text-[10px]">
                            <AlertTriangle className="w-3.5 h-3.5" /> Agenda encavalada com outro(s) job(s) ativos!
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
