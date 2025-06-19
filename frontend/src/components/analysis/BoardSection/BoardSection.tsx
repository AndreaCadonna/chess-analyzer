/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/chess/BoardSection/BoardSection.tsx
import React from "react";
import { Chessboard } from "react-chessboard";
// import type { Square } from "react-chessboard/dist/chessboard/types";
import Button from "../../ui/Button";
import "./BoardSection.css";

interface BoardSectionProps {
  /**
   * Current position FEN
   */
  position: string;

  /**
   * Board orientation
   */
  orientation: "white" | "black";

  /**
   * Move arrows to display
   */
  moveArrows?: any[];

  /**
   * Square highlights
   */
  squareStyles?: Record<string, any>;

  /**
   * Current move index
   */
  currentMoveIndex: number;

  /**
   * Total number of moves
   */
  totalMoves: number;

  /**
   * Navigation handlers
   */
  onGoToStart: () => void;
  onGoToPrevious: () => void;
  onGoToNext: () => void;
  onGoToEnd: () => void;
  onFlipBoard: () => void;

  /**
   * Board options
   */
  showBestMoveArrow: boolean;
  onToggleBestMoveArrow: (show: boolean) => void;
  autoAnalyzeEnabled: boolean;
  onToggleAutoAnalyze: (enabled: boolean) => void;

  /**
   * Board size
   */
  boardWidth?: number;

  /**
   * Additional CSS classes
   */
  className?: string;
}

export const BoardSection: React.FC<BoardSectionProps> = ({
  position,
  orientation,
  moveArrows = [],
  squareStyles = {},
  currentMoveIndex,
  totalMoves,
  onGoToStart,
  onGoToPrevious,
  onGoToNext,
  onGoToEnd,
  onFlipBoard,
  showBestMoveArrow,
  onToggleBestMoveArrow,
  autoAnalyzeEnabled,
  onToggleAutoAnalyze,
  boardWidth = 450,
  className = "",
}) => {
  return (
    <div className={`board-section ${className}`}>
      {/* Chess Board */}
      <div className="board-section__container">
        <Chessboard
          position={position}
          boardOrientation={orientation}
          customArrows={moveArrows}
          customSquareStyles={squareStyles}
          boardWidth={boardWidth}
          arePiecesDraggable={false}
          customBoardStyle={{
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
          }}
        />
      </div>

      {/* Navigation Controls */}
      <div className="board-section__controls">
        <Button
          variant="ghost"
          size="sm"
          onClick={onGoToStart}
          disabled={currentMoveIndex === 0}
          title="Go to start (Home)"
        >
          ⏮
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onGoToPrevious}
          disabled={currentMoveIndex === 0}
          title="Previous move (←)"
        >
          ◀
        </Button>

        <div className="board-section__move-counter">
          <span className="current-move">{currentMoveIndex}</span>
          <span className="separator">/</span>
          <span className="total-moves">{totalMoves}</span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onGoToNext}
          disabled={currentMoveIndex >= totalMoves}
          title="Next move (→)"
        >
          ▶
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onGoToEnd}
          disabled={currentMoveIndex >= totalMoves}
          title="Go to end (End)"
        >
          ⏭
        </Button>
      </div>

      {/* Board Options */}
      <div className="board-section__options">
        <Button
          variant="secondary"
          size="sm"
          onClick={onFlipBoard}
          leftIcon={<span>🔄</span>}
        >
          Flip Board
        </Button>

        <label className="board-section__option">
          <input
            type="checkbox"
            checked={showBestMoveArrow}
            onChange={(e) => onToggleBestMoveArrow(e.target.checked)}
          />
          <span className="option-text">Show Best Moves</span>
        </label>

        <label className="board-section__option">
          <input
            type="checkbox"
            checked={autoAnalyzeEnabled}
            onChange={(e) => onToggleAutoAnalyze(e.target.checked)}
          />
          <span className="option-text">Auto-analyze</span>
        </label>
      </div>
    </div>
  );
};

export default BoardSection;
