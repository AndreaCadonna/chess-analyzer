// src/components/analysis/EngineStatusPanel/EngineStatusPanel.tsx
import React from "react";
import Alert from "../../ui/Alert";
import "./EngineStatusPanel.css";

interface EngineStatus {
  engineReady: boolean;
  engineType: string;
  version?: string;
  error?: string;
}

interface LiveAnalysisState {
  isConnected: boolean;
  isAnalyzing: boolean;
  connectionError?: string;
  sessionId: string | null;
}

interface EngineStatusPanelProps {
  /**
   * Traditional engine status (for game analysis)
   */
  engineStatus: EngineStatus | null;

  /**
   * Live analysis connection state
   */
  liveAnalysisState: LiveAnalysisState;

  /**
   * Additional CSS classes
   */
  className?: string;
}

const StatusIndicator: React.FC<{
  isReady: boolean;
  label: string;
  details?: string;
  error?: string;
}> = ({ isReady, label, details, error }) => (
  <div className="status-item">
    <span className="status-label">{label}:</span>
    <div className={`status ${isReady ? "status--ready" : "status--error"}`}>
      <span className="status-indicator">{isReady ? "✅" : "❌"}</span>
      <span className="status-text">
        {isReady ? details || "Ready" : error || "Not available"}
      </span>
    </div>
  </div>
);

export const EngineStatusPanel: React.FC<EngineStatusPanelProps> = ({
  engineStatus,
  liveAnalysisState,
  className = "",
}) => {
  const hasErrors =
    (engineStatus && !engineStatus.engineReady) ||
    !liveAnalysisState.isConnected;

  return (
    <div className={`engine-status-panel ${className}`}>
      <h3 className="engine-status-panel__title">🔥 Engine Status</h3>

      {/* Status Grid */}
      <div className="engine-status-panel__grid">
        {/* Traditional Engine Status */}
        <StatusIndicator
          isReady={engineStatus?.engineReady ?? false}
          label="Game Analysis Engine"
          details={
            engineStatus?.engineReady
              ? `${engineStatus.engineType} Ready`
              : undefined
          }
          error={engineStatus?.error || "Engine not available"}
        />

        {/* Live Analysis Status */}
        <StatusIndicator
          isReady={liveAnalysisState.isConnected}
          label="Live Analysis"
          details={
            liveAnalysisState.isConnected
              ? `Connected (${
                  liveAnalysisState.isAnalyzing ? "Analyzing" : "Ready"
                })`
              : undefined
          }
          error={liveAnalysisState.connectionError || "Disconnected"}
        />
      </div>

      {/* Error Alert */}
      {hasErrors && (
        <Alert
          variant="warning"
          hideIcon
          className="engine-status-panel__alert"
        >
          <strong>Limited Functionality:</strong> Some analysis features may not
          be available due to engine connectivity issues.
        </Alert>
      )}

      {/* Success State */}
      {!hasErrors && (
        <Alert
          variant="success"
          hideIcon
          className="engine-status-panel__alert"
        >
          <strong>All Systems Ready:</strong> Both game analysis and live
          analysis engines are operational.
        </Alert>
      )}
    </div>
  );
};

export default EngineStatusPanel;
