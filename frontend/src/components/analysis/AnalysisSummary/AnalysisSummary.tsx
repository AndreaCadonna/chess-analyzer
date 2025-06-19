// src/components/analysis/AnalysisSummary/AnalysisSummary.tsx
import React from "react";
import ProgressBar from "../../ui/ProgressBar";
import "./AnalysisSummary.css";

interface AnalysisResult {
  gameId: string;
  totalPositions: number;
  analyzedPositions: number;
  analysisTime: number;
  averageDepth: number;
  mistakes: {
    blunders: number;
    mistakes: number;
    inaccuracies: number;
  };
  accuracy: {
    white: number;
    black: number;
  };
}

interface AnalysisSummaryProps {
  /**
   * Analysis results to display
   */
  analysisResult: AnalysisResult;

  /**
   * Additional CSS classes
   */
  className?: string;
}

interface SummaryItemProps {
  label: string;
  value: string | number;
  icon?: string;
  variant?: "default" | "blunders" | "mistakes" | "inaccuracies" | "accuracy";
  description?: string;
}

const SummaryItem: React.FC<SummaryItemProps> = ({
  label,
  value,
  icon,
  variant = "default",
  description,
}) => {
  return (
    <div className={`summary-item summary-item--${variant}`}>
      <div className="summary-item__header">
        {icon && <span className="summary-item__icon">{icon}</span>}
        <span className="summary-item__label">{label}</span>
      </div>
      <div className="summary-item__value">{value}</div>
      {description && (
        <div className="summary-item__description">{description}</div>
      )}
    </div>
  );
};

const AccuracyMeter: React.FC<{
  label: string;
  percentage: number;
  color: "white" | "black";
}> = ({ label, percentage, color }) => {
  const getAccuracyColor = (
    accuracy: number
  ): "success" | "warning" | "error" => {
    if (accuracy >= 85) return "success";
    if (accuracy >= 70) return "warning";
    return "error";
  };

  const getAccuracyGrade = (accuracy: number): string => {
    if (accuracy >= 95) return "A+";
    if (accuracy >= 90) return "A";
    if (accuracy >= 85) return "B+";
    if (accuracy >= 80) return "B";
    if (accuracy >= 75) return "C+";
    if (accuracy >= 70) return "C";
    if (accuracy >= 65) return "D+";
    if (accuracy >= 60) return "D";
    return "F";
  };

  return (
    <div className={`accuracy-meter accuracy-meter--${color}`}>
      <div className="accuracy-meter__header">
        <span className="accuracy-meter__label">{label}</span>
        <span className="accuracy-meter__grade">
          {getAccuracyGrade(percentage)}
        </span>
      </div>

      <ProgressBar
        variant="circle"
        value={percentage}
        max={100}
        size="sm"
        color={getAccuracyColor(percentage)}
        showPercentage
      />
    </div>
  );
};

export const AnalysisSummary: React.FC<AnalysisSummaryProps> = ({
  analysisResult,
  className = "",
}) => {
  const {
    totalPositions,
    analyzedPositions,
    mistakes,
    accuracy,
    analysisTime,
    averageDepth,
  } = analysisResult;

  const completionPercentage = (analyzedPositions / totalPositions) * 100;
  const totalMistakes =
    mistakes.blunders + mistakes.mistakes + mistakes.inaccuracies;

  const formatTime = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className={`analysis-summary ${className}`}>
      <div className="analysis-summary__header">
        <h3 className="analysis-summary__title">📊 Analysis Summary</h3>

        {completionPercentage < 100 && (
          <div className="analysis-summary__progress">
            <ProgressBar
              value={analyzedPositions}
              max={totalPositions}
              label="Analysis Progress"
              showProgress
              size="sm"
              color="primary"
            />
          </div>
        )}
      </div>

      {/* Main Statistics Grid */}
      <div className="analysis-summary__grid">
        {/* Analysis Stats */}
        <SummaryItem
          label="Positions Analyzed"
          value={`${analyzedPositions}/${totalPositions}`}
          icon="🔍"
          description={`${Math.round(completionPercentage)}% complete`}
        />

        <SummaryItem
          label="Analysis Time"
          value={formatTime(analysisTime)}
          icon="⏱️"
          description={`Avg depth: ${averageDepth.toFixed(1)}`}
        />

        {/* Mistake Categories */}
        <SummaryItem
          label="Blunders"
          value={mistakes.blunders}
          icon="💥"
          variant="blunders"
          description="Serious mistakes (-2.0+ eval)"
        />

        <SummaryItem
          label="Mistakes"
          value={mistakes.mistakes}
          icon="❌"
          variant="mistakes"
          description="Bad moves (-1.0+ eval)"
        />

        <SummaryItem
          label="Inaccuracies"
          value={mistakes.inaccuracies}
          icon="⚠️"
          variant="inaccuracies"
          description="Suboptimal moves (-0.5+ eval)"
        />

        <SummaryItem
          label="Total Mistakes"
          value={totalMistakes}
          icon="📈"
          description={`${((totalMistakes / analyzedPositions) * 100).toFixed(
            1
          )}% of moves`}
        />
      </div>

      {/* Accuracy Section */}
      <div className="analysis-summary__accuracy">
        <h4 className="accuracy-section-title">🎯 Player Accuracy</h4>

        <div className="accuracy-meters">
          <AccuracyMeter
            label="White Accuracy"
            percentage={accuracy.white}
            color="white"
          />

          <AccuracyMeter
            label="Black Accuracy"
            percentage={accuracy.black}
            color="black"
          />
        </div>

        <div className="accuracy-comparison">
          <div className="accuracy-comparison__item">
            <span className="comparison-label">Performance Gap:</span>
            <span
              className={`comparison-value ${
                Math.abs(accuracy.white - accuracy.black) > 10
                  ? "comparison-value--significant"
                  : "comparison-value--normal"
              }`}
            >
              {Math.abs(accuracy.white - accuracy.black).toFixed(1)}%
            </span>
          </div>

          <div className="accuracy-comparison__item">
            <span className="comparison-label">Game Quality:</span>
            <span className="comparison-value">
              {((accuracy.white + accuracy.black) / 2).toFixed(1)}% avg
            </span>
          </div>
        </div>
      </div>

      {/* Analysis Insights */}
      <div className="analysis-insights">
        <h4 className="insights-title">💡 Key Insights</h4>

        <div className="insights-list">
          {mistakes.blunders > 0 && (
            <div className="insight-item insight-item--critical">
              <span className="insight-icon">🚨</span>
              <span className="insight-text">
                {mistakes.blunders} critical blunder
                {mistakes.blunders !== 1 ? "s" : ""} detected
              </span>
            </div>
          )}

          {accuracy.white > 90 || accuracy.black > 90 ? (
            <div className="insight-item insight-item--positive">
              <span className="insight-icon">⭐</span>
              <span className="insight-text">
                Excellent play detected (90%+ accuracy)
              </span>
            </div>
          ) : null}

          {Math.abs(accuracy.white - accuracy.black) > 15 && (
            <div className="insight-item insight-item--notable">
              <span className="insight-icon">⚖️</span>
              <span className="insight-text">
                Significant performance gap between players
              </span>
            </div>
          )}

          {totalMistakes / analyzedPositions < 0.1 && (
            <div className="insight-item insight-item--positive">
              <span className="insight-icon">🎯</span>
              <span className="insight-text">
                Very low mistake rate - high quality game
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisSummary;
