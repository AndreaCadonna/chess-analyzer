// src/components/ui/ProgressBar/ProgressBar.tsx
import React from "react";
import "./ProgressBar.css";

export interface ProgressBarProps {
  /**
   * Progress value (0-100)
   */
  value: number;

  /**
   * Maximum value (default: 100)
   */
  max?: number;

  /**
   * Progress bar variant/style
   */
  variant?: "bar" | "circle" | "steps";

  /**
   * Size of the progress indicator
   */
  size?: "sm" | "md" | "lg";

  /**
   * Color theme
   */
  color?: "primary" | "success" | "warning" | "error" | "info";

  /**
   * Show percentage text
   */
  showPercentage?: boolean;

  /**
   * Show progress text (e.g., "5 of 10")
   */
  showProgress?: boolean;

  /**
   * Custom label/message
   */
  label?: string;

  /**
   * Animated progress fill
   */
  animated?: boolean;

  /**
   * Striped pattern
   */
  striped?: boolean;

  /**
   * Hide the progress bar (show only text)
   */
  hideBar?: boolean;

  /**
   * Current step for steps variant
   */
  currentStep?: number;

  /**
   * Step labels for steps variant
   */
  steps?: string[];

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Estimated time remaining (in seconds)
   */
  timeRemaining?: number;

  /**
   * Speed/rate information
   */
  speed?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  variant = "bar",
  size = "md",
  color = "primary",
  showPercentage = true,
  showProgress = false,
  label,
  animated = false,
  striped = false,
  hideBar = false,
  currentStep,
  steps = [],
  className = "",
  timeRemaining,
  speed,
}) => {
  // Calculate percentage
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const roundedPercentage = Math.round(percentage);

  // Format time remaining
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const baseClass = "progress";
  const variantClass = `progress--${variant}`;
  const sizeClass = `progress--${size}`;
  const colorClass = `progress--${color}`;
  const animatedClass = animated ? "progress--animated" : "";
  const stripedClass = striped ? "progress--striped" : "";

  const classes = [
    baseClass,
    variantClass,
    sizeClass,
    colorClass,
    animatedClass,
    stripedClass,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (variant === "circle") {
    return (
      <div className={classes}>
        <div className="progress__circle-container">
          <svg className="progress__circle-svg" viewBox="0 0 100 100">
            <circle
              className="progress__circle-bg"
              cx="50"
              cy="50"
              r="45"
              fill="none"
              strokeWidth="8"
            />
            <circle
              className="progress__circle-fill"
              cx="50"
              cy="50"
              r="45"
              fill="none"
              strokeWidth="8"
              strokeDasharray={`${percentage * 2.827} 282.7`}
              transform="rotate(-90 50 50)"
            />
          </svg>

          <div className="progress__circle-content">
            {showPercentage && (
              <span className="progress__circle-percentage">
                {roundedPercentage}%
              </span>
            )}
            {label && <span className="progress__circle-label">{label}</span>}
          </div>
        </div>

        {(timeRemaining || speed) && (
          <div className="progress__info">
            {timeRemaining && (
              <span className="progress__time">
                {formatTime(timeRemaining)} remaining
              </span>
            )}
            {speed && <span className="progress__speed">{speed}</span>}
          </div>
        )}
      </div>
    );
  }

  if (variant === "steps") {
    const totalSteps = steps.length;
    const activeStep =
      currentStep ?? Math.ceil((percentage / 100) * totalSteps);

    return (
      <div className={classes}>
        <div className="progress__steps-container">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < activeStep;
            const isActive = stepNumber === activeStep;

            return (
              <div
                key={index}
                className={`progress__step ${
                  isCompleted ? "progress__step--completed" : ""
                } ${isActive ? "progress__step--active" : ""}`}
              >
                <div className="progress__step-indicator">
                  {isCompleted ? (
                    <svg
                      className="progress__step-check"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <span className="progress__step-number">{stepNumber}</span>
                  )}
                </div>

                <div className="progress__step-content">
                  <span className="progress__step-title">{step}</span>
                </div>

                {index < steps.length - 1 && (
                  <div
                    className={`progress__step-connector ${
                      isCompleted ? "progress__step-connector--completed" : ""
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Bar variant (default)
  return (
    <div className={classes}>
      {(label || showPercentage || showProgress) && (
        <div className="progress__header">
          <div className="progress__labels">
            {label && <span className="progress__label">{label}</span>}
            {showProgress && (
              <span className="progress__progress-text">
                {Math.round(value)} of {max}
              </span>
            )}
          </div>

          <div className="progress__values">
            {showPercentage && (
              <span className="progress__percentage">{roundedPercentage}%</span>
            )}
          </div>
        </div>
      )}

      {!hideBar && (
        <div className="progress__bar-container">
          <div className="progress__bar-track">
            <div
              className="progress__bar-fill"
              style={{ width: `${percentage}%` }}
              role="progressbar"
              aria-valuenow={value}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-label={label || `Progress: ${roundedPercentage}%`}
            />
          </div>
        </div>
      )}

      {(timeRemaining || speed) && (
        <div className="progress__footer">
          {timeRemaining && (
            <span className="progress__time">
              {formatTime(timeRemaining)} remaining
            </span>
          )}
          {speed && <span className="progress__speed">{speed}</span>}
        </div>
      )}
    </div>
  );
};

export default ProgressBar;
