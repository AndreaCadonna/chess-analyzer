// src/components/analysis/LiveAnalysisControls/LiveAnalysisControls.tsx
import React from "react";
import Button from "../../ui/Button";
import "./LiveAnalysisControls.css";

interface LiveAnalysisSettings {
  depth: number;
  timeLimit: number;
  multiPV: number;
}

interface LiveAnalysisControlsProps {
  /**
   * Current analysis settings
   */
  settings: LiveAnalysisSettings;

  /**
   * Whether live analysis is connected
   */
  isConnected: boolean;

  /**
   * Whether analysis is currently running
   */
  isAnalyzing: boolean;

  /**
   * Handler for settings updates
   */
  onUpdateSettings: (newSettings: Partial<LiveAnalysisSettings>) => void;

  /**
   * Handler for manual analysis trigger
   */
  onAnalyzeNow: () => void;

  /**
   * Additional CSS classes
   */
  className?: string;
}

interface SettingControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}

const SettingControl: React.FC<SettingControlProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  disabled = false,
  onChange,
  formatValue,
}) => {
  const displayValue = formatValue ? formatValue(value) : `${value}${unit}`;

  return (
    <div className="setting-control">
      <label className="setting-control__label">
        {label}: <span className="setting-control__value">{displayValue}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        disabled={disabled}
        className="setting-control__slider"
      />
      <div className="setting-control__range">
        <span className="range-min">
          {formatValue ? formatValue(min) : `${min}${unit}`}
        </span>
        <span className="range-max">
          {formatValue ? formatValue(max) : `${max}${unit}`}
        </span>
      </div>
    </div>
  );
};

export const LiveAnalysisControls: React.FC<LiveAnalysisControlsProps> = ({
  settings,
  isConnected,
  isAnalyzing,
  onUpdateSettings,
  onAnalyzeNow,
  className = "",
}) => {
  const handleDepthChange = (depth: number) => {
    onUpdateSettings({ depth });
  };

  const handleTimeLimitChange = (timeLimit: number) => {
    onUpdateSettings({ timeLimit });
  };

  const formatTimeLimit = (value: number) => {
    return `${value / 1000}s`;
  };

  const getDepthDescription = (depth: number): string => {
    if (depth <= 12) return "Fast";
    if (depth <= 18) return "Balanced";
    if (depth <= 24) return "Deep";
    return "Very Deep";
  };

  const getTimeLimitDescription = (timeLimit: number): string => {
    const seconds = timeLimit / 1000;
    if (seconds <= 5) return "Quick";
    if (seconds <= 15) return "Standard";
    if (seconds <= 25) return "Thorough";
    return "Comprehensive";
  };

  return (
    <div className={`live-analysis-controls ${className}`}>
      <div className="live-analysis-controls__header">
        <h3 className="live-analysis-controls__title">
          🔄 Live Analysis Controls
        </h3>

        <div
          className={`connection-indicator ${
            isConnected ? "connected" : "disconnected"
          }`}
        >
          <span className="connection-dot" />
          <span className="connection-text">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      <div className="live-analysis-controls__grid">
        {/* Analysis Depth */}
        <div className="control-group">
          <SettingControl
            label="Analysis Depth"
            value={settings.depth}
            min={10}
            max={30}
            disabled={!isConnected}
            onChange={handleDepthChange}
          />
          <div className="control-description">
            {getDepthDescription(settings.depth)} analysis
          </div>
        </div>

        {/* Time Limit */}
        <div className="control-group">
          <SettingControl
            label="Time Limit"
            value={settings.timeLimit}
            min={5000}
            max={30000}
            step={1000}
            disabled={!isConnected}
            onChange={handleTimeLimitChange}
            formatValue={formatTimeLimit}
          />
          <div className="control-description">
            {getTimeLimitDescription(settings.timeLimit)} evaluation
          </div>
        </div>

        {/* Multi-PV Display */}
        <div className="control-group">
          <div className="setting-info">
            <label className="setting-info__label">
              Alternative Lines:{" "}
              <span className="setting-info__value">{settings.multiPV}</span>
            </label>
            <div className="control-description">
              Shows top {settings.multiPV} candidate moves
            </div>
          </div>
        </div>

        {/* Analyze Now Button */}
        <div className="control-group">
          <Button
            variant="primary"
            size="md"
            onClick={onAnalyzeNow}
            disabled={!isConnected || isAnalyzing}
            loading={isAnalyzing}
            fullWidth
          >
            {isAnalyzing ? "Analyzing..." : "Analyze Current Position"}
          </Button>
        </div>
      </div>

      {/* Current Settings Summary */}
      <div className="settings-summary">
        <div className="settings-summary__title">Current Configuration:</div>
        <div className="settings-summary__items">
          <span className="summary-item">
            Depth: <strong>{settings.depth}</strong>
          </span>
          <span className="summary-item">
            Time: <strong>{settings.timeLimit / 1000}s</strong>
          </span>
          <span className="summary-item">
            Lines: <strong>{settings.multiPV}</strong>
          </span>
        </div>
      </div>

      {/* Status Messages */}
      {!isConnected && (
        <div className="status-message status-message--warning">
          ⚠️ Live analysis is not available. Check your connection.
        </div>
      )}

      {isConnected && !isAnalyzing && (
        <div className="status-message status-message--success">
          ✅ Ready for analysis. Move to a position or click "Analyze Now".
        </div>
      )}
    </div>
  );
};

export default LiveAnalysisControls;
