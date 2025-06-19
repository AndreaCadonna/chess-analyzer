// src/components/analysis/CurrentMoveInfo/CurrentMoveInfo.tsx
import React from "react";
import LoadingSpinner from "../../ui/LoadingSpinner";
import {
  formatEvaluation,
  getMistakeColor,
  getMistakeIcon,
} from "../../../services/analysisApi";
import "./CurrentMoveInfo.css";

interface MoveAnalysis {
  moveNumber: number;
  playerMove: string;
  evaluation: number;
  bestMove: string;
  mistakeSeverity?: string;
  analysisDepth?: number;
  positionFen?: string;
  bestLine?: string;
}

interface LiveAnalysisLine {
  evaluation: number;
  bestMove: string;
  pv: string[];
  depth: number;
  multiPvIndex: number;
}

interface LiveAnalysisResult {
  lines: LiveAnalysisLine[];
  analysisTime: number;
  isComplete: boolean;
}

interface CurrentMoveInfoProps {
  /**
   * Current move index
   */
  currentMoveIndex: number;

  /**
   * Move notation (e.g., "Nf3")
   */
  moveNotation?: string;

  /**
   * Cached analysis from database
   */
  cachedAnalysis?: MoveAnalysis;

  /**
   * Live analysis result
   */
  liveAnalysisResult?: LiveAnalysisResult;

  /**
   * Whether live analysis is currently running
   */
  isAnalyzing: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

const CachedAnalysisSection: React.FC<{ analysis: MoveAnalysis }> = ({
  analysis,
}) => (
  <div className="cached-analysis">
    <h5 className="analysis-section-title">📊 Game Analysis:</h5>
    <div className="analysis-summary">
      <div className="analysis-item">
        <span className="analysis-label">Evaluation:</span>
        <strong className="analysis-value">
          {formatEvaluation(analysis.evaluation)}
        </strong>
      </div>

      <div className="analysis-item">
        <span className="analysis-label">Best:</span>
        <strong className="analysis-value">{analysis.bestMove}</strong>
      </div>

      {analysis.mistakeSeverity && (
        <div className="analysis-item">
          <div
            className="mistake-badge"
            style={{
              backgroundColor: getMistakeColor(analysis.mistakeSeverity),
            }}
          >
            {getMistakeIcon(analysis.mistakeSeverity)}{" "}
            {analysis.mistakeSeverity}
          </div>
        </div>
      )}
    </div>
  </div>
);

const LiveAnalysisSection: React.FC<{ result: LiveAnalysisResult }> = ({
  result,
}) => (
  <div className="live-analysis">
    <h5 className="analysis-section-title">🔄 Live Analysis:</h5>
    <div className="live-analysis-lines">
      {result.lines.map((line, index) => (
        <div key={index} className="analysis-line">
          <div className="line-header">
            <span className="line-number">#{line.multiPvIndex}</span>
            <span className="line-evaluation">
              <strong>{formatEvaluation(line.evaluation)}</strong>
            </span>
            <span className="line-move">{line.bestMove}</span>
          </div>
          <div className="line-pv">
            {line.pv.slice(0, 5).join(" ")}
            {line.pv.length > 5 && "..."}
          </div>
        </div>
      ))}
    </div>
    <div className="analysis-time">Analysis time: {result.analysisTime}ms</div>
  </div>
);

export const CurrentMoveInfo: React.FC<CurrentMoveInfoProps> = ({
  currentMoveIndex,
  moveNotation,
  cachedAnalysis,
  liveAnalysisResult,
  isAnalyzing,
  className = "",
}) => {
  // Don't show anything for starting position
  if (currentMoveIndex === 0 || !moveNotation) {
    return null;
  }

  return (
    <div className={`current-move-info ${className}`}>
      <h4 className="current-move-info__title">
        Move {currentMoveIndex}: {moveNotation}
      </h4>

      {/* Cached Analysis */}
      {cachedAnalysis && <CachedAnalysisSection analysis={cachedAnalysis} />}

      {/* Live Analysis */}
      {liveAnalysisResult && (
        <LiveAnalysisSection result={liveAnalysisResult} />
      )}

      {/* Analyzing Indicator */}
      {isAnalyzing && (
        <div className="analyzing-indicator">
          <LoadingSpinner
            variant="dots"
            size="sm"
            message="Analyzing current position..."
            color="primary"
          />
        </div>
      )}

      {/* No Analysis Available */}
      {!cachedAnalysis && !liveAnalysisResult && !isAnalyzing && (
        <div className="no-analysis">
          <p className="no-analysis-text">
            No analysis available for this position.
          </p>
        </div>
      )}
    </div>
  );
};

export default CurrentMoveInfo;
