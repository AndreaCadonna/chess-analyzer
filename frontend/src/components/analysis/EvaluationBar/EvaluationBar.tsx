import React, { useMemo } from "react";
import "./EvaluationBar.css";

interface EvaluationBarProps {
  evaluation: number | null;
  className?: string;
}

/**
 * Converts a centipawn evaluation to a percentage (0-100) using a sigmoid transform.
 * 0% = fully black advantage, 100% = fully white advantage, 50% = equal.
 */
function evalToPercentage(cp: number): number {
  // Sigmoid: 50 + 50 * (2 / (1 + e^(-0.004 * cp)) - 1)
  const sigmoid = 2 / (1 + Math.exp(-0.004 * cp)) - 1;
  return Math.max(2, Math.min(98, 50 + 50 * sigmoid));
}

function formatEval(cp: number): string {
  if (Math.abs(cp) > 9000) {
    return cp > 0 ? "M" : "-M";
  }
  const pawns = cp / 100;
  if (pawns > 0) return `+${pawns.toFixed(1)}`;
  return pawns.toFixed(1);
}

const EvaluationBar: React.FC<EvaluationBarProps> = ({ evaluation, className }) => {
  const percentage = useMemo(() => {
    if (evaluation === null) return 50;
    return evalToPercentage(evaluation);
  }, [evaluation]);

  const displayEval = useMemo(() => {
    if (evaluation === null) return "0.0";
    return formatEval(evaluation);
  }, [evaluation]);

  const isWhiteAdvantage = (evaluation ?? 0) >= 0;

  return (
    <div className={`eval-bar ${className ?? ""}`}>
      <div className="eval-bar__track">
        <div
          className="eval-bar__white"
          style={{ height: `${percentage}%` }}
        />
        <div className="eval-bar__label-container">
          <span className={`eval-bar__label ${isWhiteAdvantage ? "eval-bar__label--white" : "eval-bar__label--black"}`}>
            {displayEval}
          </span>
        </div>
      </div>
    </div>
  );
};

export default EvaluationBar;
