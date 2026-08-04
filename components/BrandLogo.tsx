'use client';

import React, { useState } from 'react';

interface BrandLogoProps {
  variant?: 'login' | 'sidebar' | 'compact' | 'report' | 'fallback';
  className?: string;
}

export default function BrandLogo({ variant = 'compact', className = '' }: BrandLogoProps) {
  const [imgSrc, setImgSrc] = useState<string>(
    variant === 'login' ? '/brand/v3a-logo-yellow.png' : '/brand/v3a-mark-yellow.png'
  );
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    setHasError(true);
  };

  const renderTextFallback = () => {
    switch (variant) {
      case 'login':
        return (
          <div className="h-14 w-14 rounded-2xl bg-amber-100 flex items-center justify-center border border-action-cyan/40 text-[var(--text-primary)] font-black text-xl tracking-wider select-none">
            V3A
          </div>
        );
      case 'sidebar':
        return (
          <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center border border-[var(--border-strong)] text-[var(--text-primary)] font-black text-sm tracking-wider select-none">
            V3A
          </div>
        );
      case 'report':
        return (
          <div className="h-12 w-12 rounded-xl bg-[var(--bg-surface)]/10 flex items-center justify-center border border-[#0F2342]/20 text-black font-black text-base tracking-wider select-none">
            V3A
          </div>
        );
      case 'compact':
      default:
        return (
          <div className="h-6 w-6 rounded-md bg-amber-100 flex items-center justify-center text-amber-600 font-black text-[9px] tracking-wider select-none">
            V3A
          </div>
        );
    }
  };

  if (variant === 'fallback' || hasError) {
    return <div className={className}>{renderTextFallback()}</div>;
  }

  let imgClass = '';
  let containerClass = 'flex items-center';

  switch (variant) {
    case 'login':
      imgClass = 'h-14 w-14 object-contain rounded-2xl shadow-lg border border-[var(--border-default)]';
      containerClass = 'flex items-center justify-center';
      break;
    case 'sidebar':
      imgClass = 'h-10 w-10 object-contain rounded-xl shadow-md border border-[var(--border-subtle)]';
      containerClass = 'flex items-center justify-start';
      break;
    case 'report':
      imgClass = 'h-12 w-12 object-contain rounded-xl shadow-sm border border-slate-200';
      containerClass = 'flex items-center justify-start';
      break;
    case 'compact':
    default:
      imgClass = 'h-6 w-6 object-contain rounded-md border border-slate-100';
      containerClass = 'flex items-center justify-start';
      break;
  }

  return (
    <div className={`${containerClass} ${className}`}>
      <img
        src={imgSrc}
        alt="V3A Logo"
        onError={handleError}
        className={imgClass}
        style={{ display: 'block' }}
      />
    </div>
  );
}
