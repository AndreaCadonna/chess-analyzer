/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/ui/Button/Button.tsx
import React from "react";
import "./Button.css";

// Base button props
interface BaseButtonProps {
  /**
   * Button visual variant
   */
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";

  /**
   * Button size
   */
  size?: "sm" | "md" | "lg";

  /**
   * Loading state
   */
  loading?: boolean;

  /**
   * Icon to display before text
   */
  leftIcon?: React.ReactNode;

  /**
   * Icon to display after text
   */
  rightIcon?: React.ReactNode;

  /**
   * Full width button
   */
  fullWidth?: boolean;

  /**
   * Button children
   */
  children: React.ReactNode;

  /**
   * Additional CSS classes
   */
  className?: string;
}

// Button as HTML button
export interface ButtonAsButton
  extends BaseButtonProps,
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseButtonProps> {
  as?: "button";
}

// Button as any other component
export interface ButtonAsComponent extends BaseButtonProps {
  as: React.ElementType;
  [key: string]: any;
}

export type ButtonProps = ButtonAsButton | ButtonAsComponent;

export const Button = React.forwardRef<any, ButtonProps>(
  (
    {
      as: Component = "button",
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = "",
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseClass = "btn";
    const variantClass = `btn--${variant}`;
    const sizeClass = `btn--${size}`;
    const fullWidthClass = fullWidth ? "btn--full-width" : "";
    const loadingClass = loading ? "btn--loading" : "";

    const classes = [
      baseClass,
      variantClass,
      sizeClass,
      fullWidthClass,
      loadingClass,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <Component
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="btn__spinner" aria-hidden="true">
            <svg className="btn__spinner-icon" viewBox="0 0 24 24">
              <circle
                className="btn__spinner-circle"
                cx="12"
                cy="12"
                r="10"
                fill="none"
                strokeWidth="2"
              />
            </svg>
          </span>
        )}

        {!loading && leftIcon && (
          <span className="btn__icon btn__icon--left" aria-hidden="true">
            {leftIcon}
          </span>
        )}

        <span className={`btn__text ${loading ? "btn__text--loading" : ""}`}>
          {children}
        </span>

        {!loading && rightIcon && (
          <span className="btn__icon btn__icon--right" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </Component>
    );
  }
);

Button.displayName = "Button";

export default Button;
