'use client';

import React from 'react';
import BrandLogo from './BrandLogo';

interface PublicFormLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export default function PublicFormLayout({ children, title, subtitle }: PublicFormLayoutProps) {
  return (
    <div className="min-h-screen bg-white text-[#636466] flex flex-col items-center justify-between p-4 md:p-8 selection:bg-[#FFCB05] selection:text-black font-sans relative">
      {/* Background radial glow effect */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#FFF6D6] blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[#F0F0F0] blur-[120px] rounded-full pointer-events-none"></div>

      {/* Header */}
      <header className="w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between py-6 border-b border-[var(--border-subtle)] relative z-10 gap-4">
        <div className="flex items-center gap-3.5">
          <BrandLogo variant="login" className="shrink-0" />
          <div className="text-center sm:text-left">
            <h1 className="text-xl font-black tracking-wider text-[var(--text-primary)] uppercase leading-tight select-none">
              Freela <span className="text-[#FFCB05]">Hub</span>
            </h1>
            <p className="text-[9px] text-[#A4A6A9] font-bold uppercase tracking-wider select-none mt-0.5">
              Portal Externo &bull; V3A Agência
            </p>
          </div>
        </div>
        <div className="text-[10px] text-[var(--text-disabled)] font-extrabold uppercase tracking-widest border border-[var(--border-default)] px-3 py-1.5 rounded-full select-none bg-[var(--bg-surface)]/30">
          Formulário Seguro
        </div>
      </header>

      {/* Main card viewport */}
      <main className="w-full max-w-3xl my-8 relative z-10 flex-1 flex flex-col justify-center">
        {(title || subtitle) && (
          <div className="text-center mb-6 space-y-2">
            {title && <h2 className="text-2xl font-extrabold text-[var(--text-primary)]">{title}</h2>}
            {subtitle && <p className="text-xs text-[var(--text-muted)] max-w-lg mx-auto leading-relaxed">{subtitle}</p>}
          </div>
        )}
        <div className="bg-[var(--bg-surface)] rounded-3xl p-6 md:p-10 border border-[var(--border-subtle)] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#FFF6D6] blur-xl rounded-full pointer-events-none"></div>
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl text-center py-6 border-t border-[var(--border-subtle)] relative z-10">
        <p className="text-[10px] text-[var(--text-disabled)] font-bold uppercase tracking-widest">
          Plataforma Interna V3A &copy; {new Date().getFullYear()} &bull; Todos os direitos reservados
        </p>
      </footer>
    </div>
  );
}
