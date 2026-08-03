'use client';

import React from 'react';

interface SidebarBrandProps {
  collapsed: boolean;
}

export default function SidebarBrand({ collapsed }: SidebarBrandProps) {
  return (
    <div className={`relative select-none transition-all duration-300 ${collapsed ? 'w-full h-12' : 'flex-1 h-full'}`}>
      {/* Expanded Logo (Slides in from left, fades and scales up) */}
      <div
        className={`absolute inset-0 flex items-center justify-start transition-all duration-300 ease-in-out origin-left
          ${collapsed 
            ? 'opacity-0 scale-75 pointer-events-none -translate-x-4 blur-[1px]' 
            : 'opacity-100 scale-100 pointer-events-auto translate-x-0 blur-0'
          }`}
      >
        <img
          src="/brand/v3a-logo-yellow.png"
          alt="Freela Hub V3A"
          draggable={false}
          className="max-w-[150px] max-h-[60px] object-contain block ml-1"
          style={{ display: 'block' }}
        />
      </div>

      {/* Collapsed Logo (Centers, fades and scales up from slightly below) */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ease-in-out origin-center
          ${collapsed 
            ? 'opacity-100 scale-100 pointer-events-auto blur-0' 
            : 'opacity-0 scale-75 pointer-events-none translate-y-2 blur-[1px]'
          }`}
      >
        <img
          src="/brand/v3a-mark-yellow.png"
          alt="Freela Hub V3A Compact"
          draggable={false}
          className="w-10 h-10 object-contain block"
          style={{ display: 'block' }}
        />
      </div>
    </div>
  );
}
