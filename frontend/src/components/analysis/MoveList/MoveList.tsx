/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/chess/MoveList/MoveList.tsx
import React from "react";
import {
  formatEvaluation,
  getMistakeColor,
  getMistakeIcon,
} from "../../../services/analysisApi";
import "./MoveList.css";

interface Move {
  san: string;
  from: string;
  to: string;
  piece: string;
  captured?: string;
  promotion?: string;
}

interface MoveAnalysisDetail {
  moveNumber: number;
  playerMove: string;
  evaluation: number;
  bestMove: string;
  mistakeSeverity?: string;
  analysisDepth?: number;
  positionFen?: string;
  bestLine?: string;
}

interface MoveListProps {
  /**
   * Array of moves from the game
   */
  moves: Move[];

  /**
   * Analysis details for moves
   */
  analysisDetails?: MoveAnalysisDetail[];

  /**
   * Current move index
   */
  currentMoveIndex: number;

  /**
   * Total number of moves
   */
  totalMoves: number;

  /**
   * Handler for move selection
   */
  onMoveClick: (moveIndex: number) => void;

  /**
   * Show move numbers
   */
  showMoveNumbers?: boolean;

  /**
   * Compact mode (smaller layout)
   */
  compact?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

interface MoveItemProps {
  moveNumber: number;
  move: Move;
  analysis?: MoveAnalysisDetail;
  isCurrent: boolean;
  isStartPosition?: boolean;
  compact?: boolean;
  onClick: () => void;
}

const MoveItem: React.FC<MoveItemProps> = ({
  moveNumber,
  move,
  analysis,
  isCurrent,
  isStartPosition = false,
  compact = false,
  onClick,
}) => {
  const getMoveTypeClass = (): string => {
    if (isStartPosition) return "move-item--start";
    if (!analysis?.mistakeSeverity) return "";

    switch (analysis.mistakeSeverity) {
      case "blunder":
        return "move-item--blunder";
      case "mistake":
        return "move-item--mistake";
      case "inaccuracy":
        return "move-item--inaccuracy";
      case "excellent":
        return "move-item--excellent";
      case "good":
        return "move-item--good";
      default:
        return "";
    }
  };

  const renderMoveNumber = () => {
    if (isStartPosition) return "Start";

    // Chess notation: 1. for white moves, 1... for black moves
    const isWhiteMove = moveNumber % 2 === 1;
    const fullMoveNumber = Math.ceil(moveNumber / 2);

    if (isWhiteMove) {
      return `${fullMoveNumber}.`;
    } else {
      return `${fullMoveNumber}...`;
    }
  };

  const renderMoveNotation = () => {
    if (isStartPosition) return "Starting Position";
    return move.san;
  };

  return (
    <div
      className={`move-item ${getMoveTypeClass()} ${
        isCurrent ? "move-item--current" : ""
      } ${compact ? "move-item--compact" : ""}`}
      onClick={onClick}
    >
      <div className="move-item__content">
        <span className="move-item__number">{renderMoveNumber()}</span>

        <span className="move-item__notation">{renderMoveNotation()}</span>

        {analysis && !isStartPosition && (
          <div className="move-item__analysis">
            <span className="move-item__evaluation">
              {formatEvaluation(analysis.evaluation)}
            </span>

            {analysis.mistakeSeverity && (
              <span
                className="move-item__mistake-indicator"
                style={{
                  color: getMistakeColor(analysis.mistakeSeverity),
                }}
                title={`${analysis.mistakeSeverity}: ${analysis.bestMove} was better`}
              >
                {getMistakeIcon(analysis.mistakeSeverity)}
              </span>
            )}
          </div>
        )}
      </div>

      {!compact && analysis && !isStartPosition && (
        <div className="move-item__details">
          <span className="move-item__best-move">
            Best: {analysis.bestMove}
          </span>

          {analysis.analysisDepth && (
            <span className="move-item__depth">
              Depth: {analysis.analysisDepth}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export const MoveList: React.FC<MoveListProps> = ({
  moves,
  analysisDetails = [],
  currentMoveIndex,
  totalMoves,
  onMoveClick,
  showMoveNumbers = true,
  compact = false,
  className = "",
}) => {
  // Create a map for quick analysis lookup
  const analysisMap = new Map(
    analysisDetails.map((detail) => [detail.moveNumber, detail])
  );

  const handleMoveClick = (moveIndex: number) => {
    onMoveClick(moveIndex);
  };

  return (
    <div
      className={`move-list ${
        compact ? "move-list--compact" : ""
      } ${className}`}
    >
      <div className="move-list__header">
        <h3 className="move-list__title">📝 Move List</h3>

        <div className="move-list__stats">
          <span className="stats-item">Moves: {totalMoves}</span>

          {analysisDetails.length > 0 && (
            <span className="stats-item">
              Analyzed: {analysisDetails.length}
            </span>
          )}
        </div>
      </div>

      <div className="move-list__container">
        {/* Starting Position */}
        <MoveItem
          moveNumber={0}
          move={{} as Move}
          isCurrent={currentMoveIndex === 0}
          isStartPosition
          compact={compact}
          onClick={() => handleMoveClick(0)}
        />

        {/* Game Moves */}
        {moves.map((move, index) => {
          const moveNumber = index + 1;
          const analysis = analysisMap.get(moveNumber);
          const isCurrent = currentMoveIndex === moveNumber;

          return (
            <MoveItem
              key={moveNumber}
              moveNumber={moveNumber}
              move={move}
              analysis={analysis}
              isCurrent={isCurrent}
              compact={compact}
              onClick={() => handleMoveClick(moveNumber)}
            />
          );
        })}
      </div>

      {/* Legend */}
      {!compact && analysisDetails.length > 0 && (
        <div className="move-list__legend">
          <h4 className="legend-title">Analysis Legend:</h4>
          <div className="legend-items">
            <div className="legend-item">
              <span
                className="legend-icon"
                style={{ color: getMistakeColor("excellent") }}
              >
                {getMistakeIcon("excellent")}
              </span>
              <span className="legend-text">Excellent</span>
            </div>

            <div className="legend-item">
              <span
                className="legend-icon"
                style={{ color: getMistakeColor("good") }}
              >
                {getMistakeIcon("good")}
              </span>
              <span className="legend-text">Good</span>
            </div>

            <div className="legend-item">
              <span
                className="legend-icon"
                style={{ color: getMistakeColor("inaccuracy") }}
              >
                {getMistakeIcon("inaccuracy")}
              </span>
              <span className="legend-text">Inaccuracy</span>
            </div>

            <div className="legend-item">
              <span
                className="legend-icon"
                style={{ color: getMistakeColor("mistake") }}
              >
                {getMistakeIcon("mistake")}
              </span>
              <span className="legend-text">Mistake</span>
            </div>

            <div className="legend-item">
              <span
                className="legend-icon"
                style={{ color: getMistakeColor("blunder") }}
              >
                {getMistakeIcon("blunder")}
              </span>
              <span className="legend-text">Blunder</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoveList;
