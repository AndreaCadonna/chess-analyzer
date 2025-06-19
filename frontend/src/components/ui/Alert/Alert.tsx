// src/components/ui/Alert/Alert.tsx
import React from 'react';
import './Alert.css';

export interface AlertProps {
  /**
   * Alert variant/type
   */
  variant?: 'success' | 'error' | 'warning' | 'info';
  
  /**
   * Alert title (optional)
   */
  title?: string;
  
  /**
   * Alert content
   */
  children: React.ReactNode;
  
  /**
   * Show close button
   */
  dismissible?: boolean;
  
  /**
   * Callback when alert is dismissed
   */
  onDismiss?: () => void;
  
  /**
   * Custom icon (overrides default variant icon)
   */
  icon?: React.ReactNode;
  
  /**
   * Hide the default icon
   */
  hideIcon?: boolean;
  
  /**
   * Additional CSS classes
   */
  className?: string;
  
  /**
   * Additional props
   */
  [key: string]: unknown;
}

const defaultIcons = {
  success: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="alert__icon-svg">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="alert__icon-svg">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="alert__icon-svg">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="alert__icon-svg">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  ),
};

const closeIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="alert__close-icon">
    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  dismissible = false,
  onDismiss,
  icon,
  hideIcon = false,
  className = '',
  ...props
}) => {
  const baseClass = 'alert';
  const variantClass = `alert--${variant}`;
  const dismissibleClass = dismissible ? 'alert--dismissible' : '';
  
  const classes = [
    baseClass,
    variantClass,
    dismissibleClass,
    className
  ].filter(Boolean).join(' ');

  const displayIcon = icon || defaultIcons[variant];

  return (
    <div 
      className={classes}
      role="alert"
      {...props}
    >
      {/* Icon */}
      {!hideIcon && (
        <div className="alert__icon" aria-hidden="true">
          {displayIcon}
        </div>
      )}
      
      {/* Content */}
      <div className="alert__content">
        {title && (
          <div className="alert__title">
            {title}
          </div>
        )}
        <div className="alert__message">
          {children}
        </div>
      </div>
      
      {/* Dismiss button */}
      {dismissible && onDismiss && (
        <button
          type="button"
          className="alert__close"
          onClick={onDismiss}
          aria-label="Close alert"
        >
          {closeIcon}
        </button>
      )}
    </div>
  );
};

export default Alert;