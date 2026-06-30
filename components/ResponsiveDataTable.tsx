import React from 'react';
import { SortableHeader } from './SortableHeader';

export interface Column<T> {
  key: string;
  label: React.ReactNode;
  sortKey?: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  style?: React.CSSProperties;
  render: (item: T) => React.ReactNode;
}

interface ResponsiveDataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (item: T) => string | number;
  isLoading?: boolean;
  skeletonRowsCount?: number;
  renderSkeletonRow?: () => React.ReactNode;
  emptyState?: React.ReactNode;
  activeSortKey?: string | null;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: (key: string) => void;
  mobileRenderer: (item: T) => React.ReactNode;
  stickyHeader?: boolean;
  rowClassName?: (item: T) => string;
  tableLayout?: 'fixed' | 'auto';
  minWidth?: number | string;
}

export function ResponsiveDataTable<T>({
  columns,
  data,
  rowKey,
  isLoading = false,
  skeletonRowsCount = 5,
  renderSkeletonRow,
  emptyState,
  activeSortKey = null,
  sortDirection = null,
  onSort,
  mobileRenderer,
  stickyHeader = true,
  rowClassName,
  tableLayout = 'fixed',
  minWidth,
}: ResponsiveDataTableProps<T>) {
  
  // Render Desktop Header Cell
  const renderHeaderCell = (col: Column<T>) => {
    if (col.sortKey && onSort) {
      return (
        <SortableHeader
          key={col.key}
          label={col.label as string}
          sortKey={col.sortKey}
          activeSortKey={activeSortKey}
          direction={sortDirection || 'asc'}
          onSort={onSort}
          align={col.align || 'left'}
          className={col.className}
          style={{ ...col.style, width: col.width }}
        />
      );
    }

    const thAlignClass =
      col.align === 'center' ? 'text-center' :
      col.align === 'right' ? 'text-right' :
      'text-left';

    return (
      <th
        key={col.key}
        style={{ ...col.style, width: col.width }}
        className={`px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-text-secondary ${thAlignClass} ${col.className || ''}`}
      >
        {col.label}
      </th>
    );
  };

  // Default desktop skeleton rows
  const renderDefaultSkeletonRows = () => {
    return Array.from({ length: skeletonRowsCount }).map((_, rIdx) => {
      if (renderSkeletonRow) return <React.Fragment key={rIdx}>{renderSkeletonRow()}</React.Fragment>;
      
      return (
        <tr key={rIdx} className="animate-pulse">
          {columns.map((col, cIdx) => (
            <td key={col.key || cIdx} className="px-4 py-4">
              <div className="h-3.5 bg-slate-200 dark:bg-slate-700/60 rounded w-5/6"></div>
            </td>
          ))}
        </tr>
      );
    });
  };

  // Default mobile skeleton cards
  const renderMobileSkeletons = () => {
    return Array.from({ length: 4 }).map((_, idx) => (
      <div 
        key={idx} 
        className="rounded-2xl border border-border-soft p-4 space-y-3 animate-pulse bg-white dark:bg-bg-card"
      >
        <div className="flex justify-between items-center">
          <div className="bg-slate-200 dark:bg-slate-700/60 h-4 w-32 rounded-lg"></div>
          <div className="bg-slate-200 dark:bg-slate-700/60 h-5 w-16 rounded-full"></div>
        </div>
        <div className="space-y-2">
          <div className="bg-slate-200 dark:bg-slate-700/60 h-3.5 w-full rounded-lg"></div>
          <div className="bg-slate-200 dark:bg-slate-700/60 h-3.5 w-2/3 rounded-lg"></div>
        </div>
      </div>
    ));
  };

  return (
    <div className="w-full">
      {/* ── Desktop View (>= 1280px) ────────────────────────────────────────────── */}
      <div className="hidden xl:block">
        <table
          className={`w-full text-left ${stickyHeader ? 'sticky-table-header' : ''}`}
          style={{ tableLayout, width: '100%', minWidth }}
        >
          <thead>
            <tr className="bg-table-header-bg border-b border-table-border">
              {columns.map(renderHeaderCell)}
            </tr>
          </thead>
          <tbody className="divide-y divide-table-border align-middle">
            {isLoading ? (
              renderDefaultSkeletonRows()
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-text-secondary italic">
                  {emptyState || 'Nenhum registro localizado.'}
                </td>
              </tr>
            ) : (
              data.map((item) => {
                const keyVal = rowKey(item);
                const trClass = rowClassName ? rowClassName(item) : '';
                return (
                  <tr
                    key={keyVal}
                    className={`bg-table-row-bg hover:bg-table-row-hover transition-colors ${trClass}`}
                  >
                    {columns.map((col) => {
                      const tdAlignClass =
                        col.align === 'center' ? 'text-center' :
                        col.align === 'right' ? 'text-right' :
                        'text-left';
                      return (
                        <td
                          key={col.key}
                          className={`px-4 py-3 align-middle ${tdAlignClass}`}
                          style={col.style}
                        >
                          {col.render(item)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile/Tablet View (< 1280px) ──────────────────────────────────────── */}
      <div className="xl:hidden">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderMobileSkeletons()}
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-12 text-text-secondary italic bg-white dark:bg-bg-card rounded-2xl border border-border-soft">
            {emptyState || 'Nenhum registro localizado.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.map((item) => (
              <div key={rowKey(item)}>
                {mobileRenderer(item)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
