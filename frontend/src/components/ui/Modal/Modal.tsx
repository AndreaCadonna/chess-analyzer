// src/components/ui/Modal/Modal.tsx
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./Modal.css";

export interface ModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;

  /**
   * Callback when modal should be closed
   */
  onClose: () => void;

  /**
   * Modal title
   */
  title?: string;

  /**
   * Modal content
   */
  children: React.ReactNode;

  /**
   * Modal size
   */
  size?: "sm" | "md" | "lg" | "xl" | "full";

  /**
   * Whether clicking the backdrop closes the modal
   */
  closeOnBackdropClick?: boolean;

  /**
   * Whether pressing Escape closes the modal
   */
  closeOnEscape?: boolean;

  /**
   * Show close button in header
   */
  showCloseButton?: boolean;

  /**
   * Footer content (typically buttons)
   */
  footer?: React.ReactNode;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Prevent body scroll when modal is open
   */
  preventBodyScroll?: boolean;

  /**
   * Custom header content (replaces title and close button)
   */
  customHeader?: React.ReactNode;

  /**
   * Remove default padding from content area
   */
  noPadding?: boolean;

  /**
   * Modal z-index (for stacking modals)
   */
  zIndex?: number;
}

const CloseIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="modal__close-icon">
    <path
      fillRule="evenodd"
      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
      clipRule="evenodd"
    />
  </svg>
);

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  closeOnBackdropClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  footer,
  className = "",
  preventBodyScroll = true,
  customHeader,
  noPadding = false,
  zIndex = 1000,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  // Handle body scroll prevention
  useEffect(() => {
    if (!preventBodyScroll) return;

    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, preventBodyScroll]);

  // Handle focus management
  useEffect(() => {
    if (isOpen) {
      // Store the previously focused element
      previouslyFocusedElement.current = document.activeElement as HTMLElement;

      // Focus the modal
      setTimeout(() => {
        modalRef.current?.focus();
      }, 100);
    } else {
      // Restore focus to previously focused element
      if (previouslyFocusedElement.current) {
        previouslyFocusedElement.current.focus();
      }
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!closeOnEscape || !isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [closeOnEscape, isOpen, onClose]);

  // Handle backdrop click
  const handleBackdropClick = (event: React.MouseEvent) => {
    if (closeOnBackdropClick && event.target === event.currentTarget) {
      onClose();
    }
  };

  // Don't render if not open
  if (!isOpen) return null;

  const baseClass = "modal";
  const sizeClass = `modal--${size}`;
  const noPaddingClass = noPadding ? "modal--no-padding" : "";

  const modalClasses = [baseClass, sizeClass, noPaddingClass, className]
    .filter(Boolean)
    .join(" ");

  const modalContent = (
    <div
      className="modal-backdrop"
      onClick={handleBackdropClick}
      style={{ zIndex }}
    >
      <div
        ref={modalRef}
        className={modalClasses}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        tabIndex={-1}
      >
        {/* Header */}
        {(title || customHeader || showCloseButton) && (
          <div className="modal__header">
            {customHeader ? (
              customHeader
            ) : (
              <>
                {title && (
                  <h2 id="modal-title" className="modal__title">
                    {title}
                  </h2>
                )}
                {showCloseButton && (
                  <button
                    type="button"
                    className="modal__close-button"
                    onClick={onClose}
                    aria-label="Close modal"
                  >
                    <CloseIcon />
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Content */}
        <div className="modal__content">{children}</div>

        {/* Footer */}
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );

  // Render modal in a portal
  return createPortal(modalContent, document.body);
};

export default Modal;
