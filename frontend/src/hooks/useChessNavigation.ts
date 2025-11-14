// frontend/src/hooks/useChessNavigation.ts
import { useState, useCallback } from "react";

export interface UseChessNavigationOptions {
  totalMoves: number;
  initialMoveIndex?: number;
}

export interface UseChessNavigationReturn {
  currentMoveIndex: number;
  goToStart: () => void;
  goToPrevious: () => void;
  goToNext: () => void;
  goToEnd: () => void;
  goToMove: (moveIndex: number) => void;
  isAtStart: boolean;
  isAtEnd: boolean;
}

/**
 * Custom hook for managing chess game navigation
 * Provides functions to navigate through game moves
 */
export const useChessNavigation = (
  options: UseChessNavigationOptions
): UseChessNavigationReturn => {
  const { totalMoves, initialMoveIndex = 0 } = options;
  const [currentMoveIndex, setCurrentMoveIndex] = useState(initialMoveIndex);

  const goToStart = useCallback(() => {
    setCurrentMoveIndex(0);
  }, []);

  const goToPrevious = useCallback(() => {
    setCurrentMoveIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentMoveIndex((prev) => Math.min(totalMoves, prev + 1));
  }, [totalMoves]);

  const goToEnd = useCallback(() => {
    setCurrentMoveIndex(totalMoves);
  }, [totalMoves]);

  const goToMove = useCallback((moveIndex: number) => {
    setCurrentMoveIndex(moveIndex);
  }, []);

  const isAtStart = currentMoveIndex === 0;
  const isAtEnd = currentMoveIndex >= totalMoves;

  return {
    currentMoveIndex,
    goToStart,
    goToPrevious,
    goToNext,
    goToEnd,
    goToMove,
    isAtStart,
    isAtEnd,
  };
};
