import React from 'react';

interface StatusBadgeProps {
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  children: React.ReactNode;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ variant, children, className = '' }) => {
  return (
    <span className={`badge-custom badge-${variant} ${className}`}>
      {children}
    </span>
  );
};
