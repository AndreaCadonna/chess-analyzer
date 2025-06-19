# UI Components Library Documentation

This documentation covers the comprehensive UI component library created for the Chess Analyzer application. These components provide a consistent, accessible, and modern design system that can be used throughout the application.

## Table of Contents

1. [Overview](#overview)
2. [Installation & Setup](#installation--setup)
3. [Button Component](#button-component)
4. [Alert Component](#alert-component)
5. [LoadingSpinner Component](#loadingspinner-component)
6. [Modal Component](#modal-component)
7. [ProgressBar Component](#progressbar-component)
8. [Best Practices](#best-practices)
9. [Migration Guide](#migration-guide)

---

## Overview

The UI component library consists of 5 core components that handle the most common interface patterns:

- **Button**: All button variants with polymorphic support
- **Alert**: Notification system with multiple variants
- **LoadingSpinner**: Loading states and progress indicators
- **Modal**: Dialogs, confirmations, and overlays
- **ProgressBar**: Progress tracking with multiple visual styles

### Design Principles

- **Consistency**: All components follow the same design patterns
- **Accessibility**: Built-in ARIA support, keyboard navigation, and screen reader compatibility
- **Responsive**: Mobile-first design that works on all devices
- **Customizable**: Extensive props for different use cases
- **Type Safety**: Full TypeScript support with comprehensive prop types

---

## Installation & Setup

### File Structure

```
src/
├── components/
│   └── ui/
│       ├── Button/
│       │   ├── Button.tsx
│       │   ├── Button.css
│       │   └── index.ts
│       ├── Alert/
│       │   ├── Alert.tsx
│       │   ├── Alert.css
│       │   └── index.ts
│       ├── LoadingSpinner/
│       │   ├── LoadingSpinner.tsx
│       │   ├── LoadingSpinner.css
│       │   └── index.ts
│       ├── Modal/
│       │   ├── Modal.tsx
│       │   ├── Modal.css
│       │   └── index.ts
│       └── ProgressBar/
│           ├── ProgressBar.tsx
│           ├── ProgressBar.css
│           └── index.ts
```

### Import Patterns

```typescript
// Named imports
import { Button, Alert, LoadingSpinner } from '../components/ui';

// Default imports
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

// Specific imports with types
import { Button, type ButtonProps } from '../components/ui/Button';
```

---

## Button Component

The Button component consolidates all button patterns with polymorphic support, allowing it to render as different HTML elements or React components.

### Props

```typescript
interface ButtonProps<C extends React.ElementType = 'button'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  as?: C; // Polymorphic prop
  children: React.ReactNode;
  // + all props of the target element/component
}
```

### Usage Examples

```typescript
import Button from '../components/ui/Button';
import { Link } from 'react-router-dom';

// Basic buttons
<Button variant="primary">Primary Button</Button>
<Button variant="secondary" size="lg">Large Secondary</Button>
<Button variant="danger" size="sm">Delete</Button>

// With loading state
<Button loading>Processing...</Button>

// With icons
<Button leftIcon={<SaveIcon />}>Save Game</Button>
<Button rightIcon={<ArrowIcon />}>Continue</Button>

// As React Router Link
<Button as={Link} to="/games" variant="primary">
  View Games
</Button>

// As external link
<Button as="a" href="https://chess.com" target="_blank">
  Chess.com
</Button>

// Full width
<Button variant="primary" fullWidth>
  Full Width Button
</Button>
```

### Variants

- **primary**: Main action buttons (gradient background)
- **secondary**: Secondary actions (gray background)
- **danger**: Destructive actions (red background)
- **ghost**: Subtle actions (transparent background)
- **outline**: Outlined buttons (border only)

---

## Alert Component

The Alert component provides a consistent notification system with multiple variants and dismissible functionality.

### Props

```typescript
interface AlertProps {
  variant?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: React.ReactNode;
  hideIcon?: boolean;
  className?: string;
}
```

### Usage Examples

```typescript
import Alert from '../components/ui/Alert';

// Basic alerts
<Alert variant="success">Operation completed successfully!</Alert>
<Alert variant="error">Failed to save the game.</Alert>
<Alert variant="warning">This action cannot be undone.</Alert>
<Alert variant="info">New features are available.</Alert>

// With title
<Alert variant="error" title="Connection Failed">
  Unable to connect to the chess analysis engine.
</Alert>

// Dismissible alerts
<Alert 
  variant="warning" 
  dismissible 
  onDismiss={() => setShowAlert(false)}
>
  Large import detected. This may take several minutes.
</Alert>

// Custom icon
<Alert 
  variant="info" 
  icon={<CustomIcon />}
  title="Pro Tip"
>
  Enable auto-analysis for real-time evaluation.
</Alert>

// No icon
<Alert variant="warning" hideIcon>
  Clean alert without icon.
</Alert>
```

### State Management Example

```typescript
const [alerts, setAlerts] = useState({
  success: null,
  error: null
});

const showSuccess = (message: string) => {
  setAlerts(prev => ({ ...prev, success: message }));
};

const clearAlert = (type: keyof typeof alerts) => {
  setAlerts(prev => ({ ...prev, [type]: null }));
};

// In JSX
{alerts.success && (
  <Alert 
    variant="success" 
    dismissible 
    onDismiss={() => clearAlert('success')}
  >
    {alerts.success}
  </Alert>
)}
```

---

## LoadingSpinner Component

The LoadingSpinner component handles all loading states with multiple variants, sizes, and overlay capabilities.

### Props

```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'spinner' | 'dots' | 'pulse' | 'bars';
  message?: string;
  overlay?: boolean;
  centered?: boolean;
  color?: 'primary' | 'secondary' | 'white' | 'dark';
  progress?: number;
  hideSpinner?: boolean;
  className?: string;
}
```

### Usage Examples

```typescript
import LoadingSpinner from '../components/ui/LoadingSpinner';

// Basic loading states
<LoadingSpinner message="Loading games..." centered />
<LoadingSpinner variant="dots" size="sm" color="primary" />

// Overlay loading
<LoadingSpinner 
  overlay 
  message="Importing games..." 
  color="primary" 
/>

// With progress
<LoadingSpinner 
  message="Analyzing positions..." 
  progress={65} 
  size="lg" 
/>

// Different variants
<LoadingSpinner variant="spinner" message="Processing..." />
<LoadingSpinner variant="dots" message="Loading..." />
<LoadingSpinner variant="pulse" message="Connecting..." />
<LoadingSpinner variant="bars" message="Analyzing..." />

// Button loading state
<Button loading={isLoading} disabled={isLoading}>
  {isLoading ? 'Saving...' : 'Save Game'}
</Button>
```

### Integration with Components

```typescript
const GamesList = () => {
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState([]);

  if (loading) {
    return (
      <LoadingSpinner 
        message="Loading your chess games..." 
        centered 
        size="lg" 
      />
    );
  }

  return (
    <div>
      {/* Games content */}
      {games.map(game => <GameCard key={game.id} game={game} />)}
    </div>
  );
};
```

---

## Modal Component

The Modal component provides professional dialogs with proper accessibility, focus management, and responsive design.

### Props

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  footer?: React.ReactNode;
  customHeader?: React.ReactNode;
  noPadding?: boolean;
  preventBodyScroll?: boolean;
  className?: string;
}
```

### Usage Examples

```typescript
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';

// Basic modal
const [isOpen, setIsOpen] = useState(false);

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Confirm Action"
  size="sm"
>
  <p>Are you sure you want to delete this game?</p>
</Modal>

// Modal with footer
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Delete Game"
  footer={
    <>
      <Button variant="secondary" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
      <Button variant="danger" onClick={handleDelete}>
        Delete
      </Button>
    </>
  }
>
  <p>This action cannot be undone.</p>
</Modal>

// Settings modal
<Modal
  isOpen={settingsOpen}
  onClose={() => setSettingsOpen(false)}
  title="Analysis Settings"
  size="md"
>
  <div className="settings-form">
    {/* Settings form content */}
  </div>
</Modal>

// Full-screen modal
<Modal
  isOpen={fullscreenOpen}
  onClose={() => setFullscreenOpen(false)}
  size="full"
  noPadding
>
  <div className="full-content">
    {/* Full-screen content */}
  </div>
</Modal>
```

### Reusable Modal Patterns

```typescript
// Confirmation Modal
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    size="sm"
    footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={() => { onConfirm(); onClose(); }}>
          Confirm
        </Button>
      </>
    }
  >
    <p>{message}</p>
  </Modal>
);

// Usage
<ConfirmationModal
  isOpen={showDeleteModal}
  onClose={() => setShowDeleteModal(false)}
  onConfirm={handleDeleteGame}
  title="Delete Game"
  message="Are you sure you want to delete this game? This action cannot be undone."
/>
```

---

## ProgressBar Component

The ProgressBar component handles all progress indication needs with multiple variants and rich information display.

### Props

```typescript
interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: 'bar' | 'circle' | 'steps';
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info';
  showPercentage?: boolean;
  showProgress?: boolean;
  label?: string;
  animated?: boolean;
  striped?: boolean;
  steps?: string[];
  currentStep?: number;
  timeRemaining?: number;
  speed?: string;
  className?: string;
}
```

### Usage Examples

```typescript
import ProgressBar from '../components/ui/ProgressBar';

// Basic progress bar
<ProgressBar 
  value={progress} 
  label="Loading games..." 
  showPercentage 
/>

// Import progress with time estimate
<ProgressBar
  value={imported}
  max={total}
  label="Importing chess games"
  showProgress
  showPercentage
  animated
  striped
  timeRemaining={120}
  speed="~3 games/sec"
  color="primary"
/>

// Analysis progress
<ProgressBar
  value={currentMove}
  max={totalMoves}
  label={`Analyzing game ${gameId}`}
  showProgress
  color="success"
  size="lg"
/>

// Circular progress
<ProgressBar
  variant="circle"
  value={depth}
  max={maxDepth}
  label="Analyzing..."
  showPercentage
  color="primary"
  size="md"
/>

// Step-by-step process
<ProgressBar
  variant="steps"
  steps={[
    'Load Game',
    'Parse Moves', 
    'Engine Analysis',
    'Generate Report'
  ]}
  currentStep={2}
/>
```

### Real-time Progress Example

```typescript
const ImportProgress = () => {
  const [progress, setProgress] = useState({
    fetched: 0,
    imported: 0,
    total: 100,
    timeRemaining: 180
  });

  // Update progress in real-time
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => ({
        ...prev,
        fetched: Math.min(prev.fetched + 2, prev.total),
        imported: Math.min(prev.imported + 1, prev.fetched),
        timeRemaining: Math.max(0, prev.timeRemaining - 1)
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <ProgressBar
        value={progress.fetched}
        max={progress.total}
        label="Fetching games from Chess.com"
        showProgress
        showPercentage
        animated
        striped
        timeRemaining={progress.timeRemaining}
        speed="~2 games/sec"
      />
      
      <ProgressBar
        value={progress.imported}
        max={progress.total}
        label="Processing and saving games"
        showProgress
        color="success"
        size="sm"
      />
    </div>
  );
};
```

---

## Best Practices

### Component Usage

1. **Consistent Styling**: Always use the component library instead of custom CSS classes
2. **Accessibility**: Components include built-in accessibility features - don't override them
3. **Responsive Design**: Components are mobile-first - test on different screen sizes
4. **Type Safety**: Use TypeScript props for better development experience

### Performance

1. **Button Loading**: Use the `loading` prop instead of disabling buttons
2. **Modal Rendering**: Modals use React portals - no z-index conflicts
3. **Progress Updates**: Throttle rapid progress updates to avoid performance issues
4. **Loading States**: Use appropriate spinner variants for different contexts

### Accessibility

1. **Keyboard Navigation**: All components support keyboard navigation
2. **Screen Readers**: ARIA labels and roles are included automatically
3. **Focus Management**: Modals properly manage focus trapping and restoration
4. **Color Contrast**: All color variants meet WCAG contrast requirements

### State Management

```typescript
// Good: Centralized alert state
const [alerts, setAlerts] = useState({
  success: null,
  error: null,
  warning: null
});

const showAlert = (type: string, message: string) => {
  setAlerts(prev => ({ ...prev, [type]: message }));
};

// Good: Modal state management
const [modals, setModals] = useState({
  deleteGame: false,
  settings: false,
  confirmation: false
});

const openModal = (modal: string) => {
  setModals(prev => ({ ...prev, [modal]: true }));
};
```

---

## Migration Guide

### From Old Button Patterns

```typescript
// Before
<button className="primary-button">Save</button>
<Link to="/games" className="cta-button">View Games</Link>
<button className="danger-button">Delete</button>

// After
<Button variant="primary">Save</Button>
<Button as={Link} to="/games" variant="primary">View Games</Button>
<Button variant="danger">Delete</Button>
```

### From Old Alert Patterns

```typescript
// Before
<div className="alert error">
  <strong>Error:</strong> {errorMessage}
</div>

// After
<Alert variant="error" dismissible onDismiss={clearError}>
  {errorMessage}
</Alert>
```

### From Old Loading Patterns

```typescript
// Before
<div className="loading">Loading games...</div>
<div className="loading-overlay">Processing...</div>

// After
<LoadingSpinner message="Loading games..." centered />
<LoadingSpinner overlay message="Processing..." />
```

### From Browser Confirmations

```typescript
// Before
const handleDelete = () => {
  if (confirm('Are you sure?')) {
    deleteGame();
  }
};

// After
const [showModal, setShowModal] = useState(false);

const handleDelete = () => setShowModal(true);

<Modal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  title="Confirm Delete"
  footer={
    <>
      <Button variant="secondary" onClick={() => setShowModal(false)}>
        Cancel
      </Button>
      <Button variant="danger" onClick={deleteGame}>
        Delete
      </Button>
    </>
  }
>
  <p>Are you sure you want to delete this game?</p>
</Modal>
```

### From Custom Progress Bars

```typescript
// Before
<div className="progress-bar">
  <div className="progress-fill" style={{ width: `${percent}%` }} />
</div>
<div className="progress-text">{message}</div>

// After
<ProgressBar
  value={percent}
  label={message}
  showPercentage
  animated
/>
```

---
