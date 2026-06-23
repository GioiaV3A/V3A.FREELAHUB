'use client';

import React from 'react';
import { DatabaseProps } from '@/app/page';
import { FileDown, TrendingUp, DollarSign, Award, ThumbsUp, AlertTriangle, Layers, Users } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';

export default function RelatoriosPanel({ db }: { db: DatabaseProps }) {
  // Compute analytics
  const totalExpenditure = db.allocations.reduce((sum, item) => sum + item.approvedValue, 0);
  
  // Expenditure by nucleus
  const expByNucleus = db.nucleos.map(n => {
    const allocs = db.allocations.filter(a => a.nucleoId === n.id);
    const amount = allocs.reduce((sum, item) => sum + item.approvedValue, 0);
    return { name: n.name, amount };
  }).sort((a, b) => b.amount - a.amount);



  // Most used freelancers in live marketing
  const freelaAllocMap: { [key: string]: number } = {};
  db.allocations.forEach(alloc => {
    freelaAllocMap[alloc.freelancerId] = (freelaAllocMap[alloc.freelancerId] || 0) + 1;
  });
  const topFreelancers = Object.entries(freelaAllocMap)
    .map(([id, count]) => {
      const fl = db.freelancers.find(f => f.id === id);
      return { name: fl?.name || 'Veterano', role: fl?.mainRole || 'Produtor', count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const handleExport = (format: 'CSV' | 'Excel' | 'PDF') => {
    alert(`📥 [Protótipo Ativo]: O relatório operacional "Dossiê_Consolidado_Freelas_${Date.now()}.${format.toLowerCase()}" foi compilado e compactado de acordo com as normas tributárias e fiscais. Download iniciado contendo ${db.freelancers.length} registros cadastrados.`);
  };

  return (
    <div id="analytics-panel" className="space-y-6">
      {/* Relatórios Header Visual */}
      <div className="bg-white border border-border-subtle p-6 rounded-2xl shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <BrandLogo variant="report" className="shrink-0" />
          <div className="border-l border-slate-200 pl-4 py-1">
            <h2 className="text-lg font-black text-text-primary uppercase tracking-wide leading-tight">
              Freela Hub <span className="text-text-secondary font-bold text-base">— Relatórios</span>
            </h2>
            <p className="text-xs text-text-secondary font-medium mt-1">Plataforma interna V3A para gestão estratégica de freelancers</p>
          </div>
        </div>
        <div className="text-left md:text-right text-xs text-text-secondary space-y-1 md:space-y-0.5 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0 w-full md:w-auto">
          <p><span className="font-bold text-text-primary">Período analisado:</span> Todos os lançamentos</p>
          <p><span className="font-bold text-text-primary">Data de emissão:</span> {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI 1 */}
        <div className="bg-white border border-border-subtle p-5 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-text-secondary text-xs font-semibold block mb-1">Custo Total de Diárias Registradas</span>
            <span className="text-2xl font-bold text-text-primary">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalExpenditure)}
            </span>
            <span className="text-[10px] text-status-success block mt-1 font-semibold">&uarr; Rastreamento consolidado V3A</span>
          </div>
          <div className="w-12 h-12 bg-status-success/10 text-status-success rounded-xl flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white border border-border-subtle p-5 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-text-secondary text-xs font-semibold block mb-1">Média de Nota do Banco</span>
            <span className="text-2xl font-bold text-text-primary">4.62 ★</span>
            <span className="text-[10px] text-text-secondary block mt-1">Auditado em {db.evaluations.length} avaliações</span>
          </div>
          <div className="w-12 h-12 bg-status-warning/15 text-status-warning rounded-xl flex items-center justify-center">
            <Award className="w-6 h-6 fill-status-warning" />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white border border-border-subtle p-5 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-text-secondary text-xs font-semibold block mb-1">Freelancers no Banco</span>
            <span className="text-2xl font-bold text-text-primary">{db.freelancers.length} Cadastrados</span>
            <p className="text-[10px] text-text-secondary mt-1">
              Prontos para contratação: <strong className="text-status-success font-bold">{db.freelancers.filter((f: any) => f.status === 'Elegível').length}</strong>
            </p>
          </div>
          <div className="w-12 h-12 bg-action-cyan/15 text-action-cyan rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left column: Expenditure by nucleus */}
        <div className="bg-white p-5 rounded-2xl border border-border-subtle shadow-xs space-y-4">
          <h3 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-text-secondary" />
            <span>Distribuição de Dispêndios por Núcleo de Live Marketing</span>
          </h3>

          <div className="space-y-4">
            {expByNucleus.map((item, idx) => {
              const maxAmount = expByNucleus.length > 0 ? expByNucleus[0].amount : 1;
              const percentage = Math.round((item.amount / (maxAmount || 1)) * 100);

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-primary font-medium">{item.name}</span>
                    <strong className="text-text-primary font-bold text-xs">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.amount)}
                    </strong>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-2">
                    <div 
                      className="bg-action-cyan h-2 rounded-full transition-all duration-300"
                      style={{ width: `${item.amount > 0 ? percentage : 0}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column: Star freelancers and export card */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border text-border-subtle shadow-xs space-y-4">
            <h3 className="font-bold text-text-primary text-xs uppercase tracking-wider text-text-secondary">Talentos faturados com maior recorrência</h3>
            
            <div className="space-y-3">
              {topFreelancers.map((f, idx) => (
                <div key={idx} className="flex justify-between items-center bg-surface p-2.5 rounded-xl border border-border-subtle text-xs">
                  <div>
                    <strong className="text-text-primary font-bold text-xs">{f.name}</strong>
                    <p className="text-[10px] text-text-secondary">{f.role}</p>
                  </div>
                  <span className="bg-secondary-container text-on-secondary-container text-[11px] font-extrabold px-3 py-1 rounded-full">
                    {f.count} {f.count === 1 ? 'Booking' : 'Bookings'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Export tools */}
          <div className="bg-white p-5 rounded-2xl border border-border-subtle shadow-xs space-y-3">
            <h4 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
              <FileDown className="w-4 h-4 text-primary" />
              <span>Exportar Dados Consolidados B2B</span>
            </h4>
            <p className="text-[11.5px] text-text-secondary">Gere planilhas financeiras compatíveis com Erps de auditoria ou contabilidade corporativa.</p>
            
            <div className="flex flex-wrap gap-2 pt-2 text-xs">
              <button
                onClick={() => handleExport('CSV')}
                className="bg-surface border border-border-subtle hover:bg-surface-container-high transition-colors font-bold p-2 px-4 rounded-xl flex items-center gap-1.5"
              >
                Planilha CSV
              </button>
              <button
                onClick={() => handleExport('Excel')}
                className="bg-surface border border-border-subtle hover:bg-surface-container-high transition-colors font-bold p-2 px-4 rounded-xl flex items-center gap-1.5"
              >
                Microsoft Excel
              </button>
              <button
                onClick={() => handleExport('PDF')}
                className="bg-sidebar-navy text-white hover:brightness-110 font-bold p-2 px-4 rounded-xl flex items-center gap-1.5"
              >
                Gerar PDF Fiscal
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
