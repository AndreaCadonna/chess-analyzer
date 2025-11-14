// frontend/src/hooks/usePagination.ts
import { useState, useMemo } from 'react';

interface UsePaginationOptions {
  initialPage?: number;
  itemsPerPage: number;
}

interface UsePaginationReturn {
  currentPage: number;
  offset: number;
  itemsPerPage: number;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  hasNext: (totalItems: number) => boolean;
  hasPrev: () => boolean;
  totalPages: (totalItems: number) => number;
  reset: () => void;
}

/**
 * Simple pagination hook
 *
 * @param options - Pagination configuration
 * @returns Pagination state and controls
 *
 * @example
 * const { currentPage, offset, nextPage, prevPage, hasNext, hasPrev } = usePagination({
 *   itemsPerPage: 20
 * });
 */
export const usePagination = (options: UsePaginationOptions): UsePaginationReturn => {
  const { initialPage = 0, itemsPerPage } = options;
  const [currentPage, setCurrentPage] = useState(initialPage);

  const offset = useMemo(() => currentPage * itemsPerPage, [currentPage, itemsPerPage]);

  const nextPage = () => {
    setCurrentPage(prev => prev + 1);
  };

  const prevPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(0, page));
  };

  const hasNext = (totalItems: number) => {
    return (currentPage + 1) * itemsPerPage < totalItems;
  };

  const hasPrev = () => {
    return currentPage > 0;
  };

  const totalPages = (totalItems: number) => {
    return Math.ceil(totalItems / itemsPerPage);
  };

  const reset = () => {
    setCurrentPage(initialPage);
  };

  return {
    currentPage,
    offset,
    itemsPerPage,
    nextPage,
    prevPage,
    goToPage,
    hasNext,
    hasPrev,
    totalPages,
    reset
  };
};
