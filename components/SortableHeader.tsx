import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { SortDirection } from '@/hooks/useSortableTable';

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  activeSortKey: string | null;
  direction: SortDirection;
  onSort: (key: string) => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
  style?: React.CSSProperties;
}

export function SortableHeader({
  label,
  sortKey,
  activeSortKey,
  direction,
  onSort,
  align = 'left',
  className = '',
  style,
}: SortableHeaderProps) {
  const isSorted = activeSortKey === sortKey;

  const alignClass =
    align === 'center' ? 'justify-center text-center' :
    align === 'right' ? 'justify-end text-right' :
    'justify-start text-left';

  const thAlignClass =
    align === 'center' ? 'text-center' :
    align === 'right' ? 'text-right' :
    'text-left';

  return (
    <th
      style={style}
      onClick={() => onSort(sortKey)}
      className={`px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-50 transition-colors select-none text-[10px] uppercase tracking-wider font-bold text-text-secondary ${thAlignClass} ${className}`}
      aria-sort={isSorted ? (direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none') : 'none'}
    >
      <div className={`flex items-center gap-1 ${alignClass}`}>
        <span>{label}</span>
        {isSorted && direction ? (
          direction === 'asc' ? (
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
    </th>
  );
}
