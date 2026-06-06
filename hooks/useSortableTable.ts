import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export function useSortableTable<T>(
  items: T[],
  defaultKey: string = '',
  defaultDirection: SortDirection = null
) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: defaultKey,
    direction: defaultDirection,
  });

  const requestSort = (key: string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfig.direction === 'desc') {
        direction = null;
      } else {
        direction = 'asc';
      }
    }
    setSortConfig({ key: direction ? key : '', direction });
  };

  const sortedItems = useMemo(() => {
    if (!items || !Array.isArray(items)) return [];
    const sortableItems = [...items];
    const { key, direction } = sortConfig;

    if (!key || !direction) {
      return sortableItems;
    }

    return sortableItems.sort((a: any, b: any) => {
      const getVal = (obj: any, path: string) => {
        if (!obj) return '';
        const parts = path.split('.');
        let current = obj;
        for (const part of parts) {
          current = current[part];
          if (current === undefined || current === null) return '';
        }
        return current;
      };

      let aVal = getVal(a, key);
      let bVal = getVal(b, key);

      // Handle boolean
      if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        return direction === 'asc'
          ? (aVal === bVal ? 0 : aVal ? 1 : -1)
          : (aVal === bVal ? 0 : aVal ? -1 : 1);
      }

      // Handle numbers / currencies (remove currency symbol formatting if it's parsed as string)
      if (typeof aVal === 'string' && (aVal.includes('R$') || aVal.includes('%'))) {
        const cleanA = parseFloat(aVal.replace(/[^\d,-]/g, '').replace(',', '.'));
        const cleanB = parseFloat(bVal.replace(/[^\d,-]/g, '').replace(',', '.'));
        if (!isNaN(cleanA) && !isNaN(cleanB)) {
          return direction === 'asc' ? cleanA - cleanB : cleanB - cleanA;
        }
      }

      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum) && typeof aVal !== 'object' && typeof bVal !== 'object' && aVal !== '' && bVal !== '') {
        return direction === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // Handle dates (standard format like DD/MM/YYYY or ISO strings)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        // Check for DD/MM/YYYY DD/MM/YYYY, hh:mm
        const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})/;
        if (dateRegex.test(aVal) && dateRegex.test(bVal)) {
          const parseCustomDate = (str: string) => {
            const parts = str.split(',')[0].trim().split('/');
            const timePart = str.split(',')[1]?.trim() || '00:00';
            const [hours, minutes] = timePart.split(':');
            return new Date(
              parseInt(parts[2]),
              parseInt(parts[1]) - 1,
              parseInt(parts[0]),
              parseInt(hours || '0'),
              parseInt(minutes || '0')
            ).getTime();
          };
          const timeA = parseCustomDate(aVal);
          const timeB = parseCustomDate(bVal);
          return direction === 'asc' ? timeA - timeB : timeB - timeA;
        }

        const aDate = Date.parse(aVal);
        const bDate = Date.parse(bVal);
        if (!isNaN(aDate) && !isNaN(bDate) && aVal.includes('-')) {
          return direction === 'asc' ? aDate - bDate : bDate - aDate;
        }
      }

      // String comparison
      const aStr = String(aVal).toLowerCase().trim();
      const bStr = String(bVal).toLowerCase().trim();

      return direction === 'asc'
        ? aStr.localeCompare(bStr, 'pt-BR', { numeric: true })
        : bStr.localeCompare(aStr, 'pt-BR', { numeric: true });
    });
  }, [items, sortConfig]);

  return {
    data: sortedItems,
    sortKey: sortConfig.key,
    sortDirection: sortConfig.direction,
    requestSort,
    setSort: (key: string, direction: SortDirection) => setSortConfig({ key, direction }),
  };
}
