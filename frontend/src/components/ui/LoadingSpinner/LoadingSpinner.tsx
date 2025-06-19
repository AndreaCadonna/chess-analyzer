// src/components/ui/LoadingSpinner/LoadingSpinner.tsx
import React from "react";
import "./LoadingSpinner.css";

export interface LoadingSpinnerProps {
  /**
   * Size of the spinner
   */
  size?: "sm" | "md" | "lg" | "xl";

  /**
   * Spinner variant/style
   */
  variant?: "spinner" | "dots" | "pulse" | "bars";

  /**
   * Loading message to display
   */
  message?: string;

  /**
   * Show as an overlay (covers parent container)
   */
  overlay?: boolean;

  /**
   * Center the spinner in its container
   */
  centered?: boolean;

  /**
   * Color theme
   */
  color?: "primary" | "secondary" | "white" | "dark";

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Progress percentage (0-100) for progress indicators
   */
  progress?: number;

  /**
   * Hide the spinner but keep the message (useful for completed states)
   */
  hideSpinner?: boolean;
}

const SpinnerIcon: React.FC<{ variant: string; size: string }> = ({
  variant,
  size,
}) => {
  switch (variant) {
    case "spinner":
      return (
        <svg
          className={`loading-spinner__icon loading-spinner__icon--${size}`}
          viewBox="0 0 24 24"
        >
          <circle
            className="loading-spinner__circle"
            cx="12"
            cy="12"
            r="10"
            fill="none"
            strokeWidth="2"
          />
        </svg>
      );

    case "dots":
      return (
        <div className={`loading-dots loading-dots--${size}`}>
          <div className="loading-dots__dot" />
          <div className="loading-dots__dot" />
          <div className="loading-dots__dot" />
        </div>
      );

    case "pulse":
      return (
        <div className={`loading-pulse loading-pulse--${size}`}>
          <div className="loading-pulse__circle" />
        </div>
      );

    case "bars":
      return (
        <div className={`loading-bars loading-bars--${size}`}>
          <div className="loading-bars__bar" />
          <div className="loading-bars__bar" />
          <div className="loading-bars__bar" />
          <div className="loading-bars__bar" />
        </div>
      );

    default:
      return (
        <svg
          className={`loading-spinner__icon loading-spinner__icon--${size}`}
          viewBox="0 0 24 24"
        >
          <circle
            className="loading-spinner__circle"
            cx="12"
            cy="12"
            r="10"
            fill="none"
            strokeWidth="2"
          />
        </svg>
      );
  }
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  variant = "spinner",
  message,
  overlay = false,
  centered = false,
  color = "primary",
  className = "",
  progress,
  hideSpinner = false,
  ...props
}) => {
  const baseClass = "loading-spinner";
  const sizeClass = `loading-spinner--${size}`;
  const colorClass = `loading-spinner--${color}`;
  const overlayClass = overlay ? "loading-spinner--overlay" : "";
  const centeredClass = centered ? "loading-spinner--centered" : "";

  const classes = [
    baseClass,
    sizeClass,
    colorClass,
    overlayClass,
    centeredClass,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <div className="loading-spinner__content">
      {!hideSpinner && (
        <div className="loading-spinner__icon-container">
          <SpinnerIcon variant={variant} size={size} />
        </div>
      )}

      {message && <div className="loading-spinner__message">{message}</div>}

      {typeof progress === "number" && (
        <div className="loading-spinner__progress">
          <div className="loading-spinner__progress-bar">
            <div
              className="loading-spinner__progress-fill"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="loading-spinner__progress-text">
            {Math.round(progress)}%
          </div>
        </div>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div className={classes} {...props}>
        <div className="loading-spinner__backdrop" />
        {content}
      </div>
    );
  }

  return (
    <div className={classes} {...props}>
      {content}
    </div>
  );
};

export default LoadingSpinner;
