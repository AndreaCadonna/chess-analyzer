/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/chess/MoveList/MoveList.tsx
import React, { useEffect, useRef } from "react";
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
  moves: Move[];
  analysisDetails?: MoveAnalysisDetail[];
  currentMoveIndex: number;
  totalMoves: number;
  onMoveClick: (moveIndex: number) => void;
  showMoveNumbers?: boolean;
  compact?: boolean;
  className?: string;
}

interface MovePair {
  fullMoveNumber: number;
  white: { move: Move; index: number; analysis?: MoveAnalysisDetail } | null;
  black: { move: Move; index: number; analysis?: MoveAnalysisDetail } | null;
}

interface MoveCellProps {
  move: Move;
  moveIndex: number;
  analysis?: MoveAnalysisDetail;
  isCurrent: boolean;
  onClick: () => void;
}

const MoveCell: React.FC<MoveCellProps> = ({ move, analysis, isCurrent, onClick }) => {
  const severityClass = analysis?.mistakeSeverity ? `move-cell--${analysis.mistakeSeverity}` : "";

  return (
    <button
      className={`move-cell ${severityClass} ${isCurrent ? "move-cell--current" : ""}`}
      onClick={onClick}
      type="button"
    >
      <span className="move-cell__notation">{move.san}</span>
      {analysis && (
        <span className="move-cell__eval">
          {formatEvaluation(analysis.evaluation)}
          {analysis.mistakeSeverity && (
            <span
              className="move-cell__icon"
              style={{ color: getMistakeColor(analysis.mistakeSeverity) }}
            >
              {getMistakeIcon(analysis.mistakeSeverity)}
            </span>
          )}
        </span>
      )}
    </button>
  );
};

export const MoveList: React.FC<MoveListProps> = ({
  moves,
  analysisDetails = [],
  currentMoveIndex,
  totalMoves,
  onMoveClick,
  showMoveNumbers: _showMoveNumbers = true,
  compact = false,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const analysisMap = new Map(
    analysisDetails.map((detail) => [detail.moveNumber, detail])
  );

  // Get display analysis for a move: keep severity/bestMove from the move itself,
  // but show the eval of the resulting position (from the next move's analysis).
  const getDisplayAnalysis = (moveIndex: number): MoveAnalysisDetail | undefined => {
    const moveAnalysis = analysisMap.get(moveIndex);
    if (!moveAnalysis) return undefined;
    const nextAnalysis = analysisMap.get(moveIndex + 1);
    return {
      ...moveAnalysis,
      evaluation: nextAnalysis?.evaluation ?? moveAnalysis.evaluation,
    };
  };

  // Group moves into pairs (white + black)
  const movePairs: MovePair[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    const fullMoveNumber = Math.floor(i / 2) + 1;
    const whiteIndex = i + 1;
    const blackIndex = i + 2;

    movePairs.push({
      fullMoveNumber,
      white: {
        move: moves[i],
        index: whiteIndex,
        analysis: getDisplayAnalysis(whiteIndex),
      },
      black: i + 1 < moves.length
        ? { move: moves[i + 1], index: blackIndex, analysis: getDisplayAnalysis(blackIndex) }
        : null,
    });
  }

  // Auto-scroll to current move
  useEffect(() => {
    if (!containerRef.current) return;
    const currentEl = containerRef.current.querySelector(".move-cell--current");
    if (currentEl) {
      currentEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [currentMoveIndex]);

  return (
    <div className={`move-list ${compact ? "move-list--compact" : ""} ${className}`}>
      <div className="move-list__header">
        <h3 className="move-list__title">Moves</h3>
        <div className="move-list__stats">
          <span className="stats-item">{totalMoves} moves</span>
          {analysisDetails.length > 0 && (
            <span className="stats-item">{analysisDetails.length} analyzed</span>
          )}
        </div>
      </div>

      <div className="move-list__container" ref={containerRef}>
        {/* Starting position row */}
        <button
          className={`move-list__start ${currentMoveIndex === 0 ? "move-list__start--current" : ""}`}
          onClick={() => onMoveClick(0)}
          type="button"
        >
          Starting Position
        </button>

        {/* Paired move rows */}
        <div className="move-list__grid">
          {movePairs.map((pair) => (
            <div key={pair.fullMoveNumber} className="move-row">
              <span className="move-row__number">{pair.fullMoveNumber}.</span>

              {pair.white && (
                <MoveCell
                  move={pair.white.move}
                  moveIndex={pair.white.index}
                  analysis={pair.white.analysis}
                  isCurrent={currentMoveIndex === pair.white.index}
                  onClick={() => onMoveClick(pair.white!.index)}
                />
              )}

              {pair.black ? (
                <MoveCell
                  move={pair.black.move}
                  moveIndex={pair.black.index}
                  analysis={pair.black.analysis}
                  isCurrent={currentMoveIndex === pair.black.index}
                  onClick={() => onMoveClick(pair.black!.index)}
                />
              ) : (
                <span className="move-cell move-cell--empty" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      {!compact && analysisDetails.length > 0 && (
        <div className="move-list__legend">
          {(["blunder", "mistake", "inaccuracy", "good", "excellent"] as const).map((severity) => (
            <span key={severity} className="legend-item">
              <span className="legend-icon" style={{ color: getMistakeColor(severity) }}>
                {getMistakeIcon(severity)}
              </span>
              <span className="legend-text">{severity}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default MoveList;
