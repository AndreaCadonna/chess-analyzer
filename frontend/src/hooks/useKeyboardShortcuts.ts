// frontend/src/hooks/useKeyboardShortcuts.ts
import { useEffect } from "react";

export interface KeyboardShortcuts {
  ArrowLeft?: () => void;
  ArrowRight?: () => void;
  Home?: () => void;
  End?: () => void;
}

/**
 * Custom hook for managing keyboard shortcuts
 * Automatically sets up and cleans up keyboard event listeners
 */
export const useKeyboardShortcuts = (shortcuts: KeyboardShortcuts): void => {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (event.target instanceof HTMLInputElement) return;

      switch (event.key) {
        case "ArrowLeft":
          if (shortcuts.ArrowLeft) {
            event.preventDefault();
            shortcuts.ArrowLeft();
          }
          break;
        case "ArrowRight":
          if (shortcuts.ArrowRight) {
            event.preventDefault();
            shortcuts.ArrowRight();
          }
          break;
        case "Home":
          if (shortcuts.Home) {
            event.preventDefault();
            shortcuts.Home();
          }
          break;
        case "End":
          if (shortcuts.End) {
            event.preventDefault();
            shortcuts.End();
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [shortcuts]);
};
