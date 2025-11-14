/* eslint-disable @typescript-eslint/no-explicit-any */
// frontend/src/components/LiveAnalysisTest.tsx
import React, { useState } from "react";
import { useLiveAnalysis } from "../hooks/useLiveAnalysis";

const LiveAnalysisTest: React.FC = () => {
  const [liveState, liveActions] = useLiveAnalysis();
  const [testFen, setTestFen] = useState(
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  );
  const [customDepth, setCustomDepth] = useState(18);
  const [customTimeLimit, setCustomTimeLimit] = useState(10000);

  const formatEvaluation = (evaluation: number): string => {
    if (Math.abs(evaluation) >= 10) {
      const mateIn = Math.ceil(
        evaluation > 0 ? evaluation / 10 : -evaluation / 10
      );
      return evaluation > 0 ? `+M${mateIn}` : `-M${mateIn}`;
    }
    return evaluation > 0 ? `+${evaluation.toFixed(1)}` : evaluation.toFixed(1);
  };

  const handleAnalyzePosition = async () => {
    try {
      await liveActions.analyzePosition(testFen, {
        depth: customDepth,
        timeLimit: customTimeLimit,
      });
    } catch (error) {
      console.error("Analysis failed:", error);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      await liveActions.updateSettings({
        depth: customDepth,
        timeLimit: customTimeLimit,
      });
    } catch (error) {
      console.error("Settings update failed:", error);
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "20px auto", padding: "20px" }}>
      <h2>🧪 Live Analysis Test</h2>

      {/* Connection Status */}
      <div
        style={{
          padding: "15px",
          marginBottom: "20px",
          backgroundColor: liveState.isConnected ? "#d4edda" : "#f8d7da",
          border: `1px solid ${liveState.isConnected ? "#c3e6cb" : "#f5c6cb"}`,
          borderRadius: "4px",
        }}
      >
        <h3>Connection Status</h3>
        <p>
          <strong>Connected:</strong>{" "}
          {liveState.isConnected ? "✅ Yes" : "❌ No"}
        </p>
        <p>
          <strong>Session ID:</strong> {liveState.sessionId || "None"}
        </p>
        <p>
          <strong>Analyzing:</strong>{" "}
          {liveState.isAnalyzing ? "🔄 Yes" : "⏸️ No"}
        </p>

        {liveState.connectionError && (
          <p style={{ color: "#721c24" }}>
            <strong>Connection Error:</strong> {liveState.connectionError}
          </p>
        )}

        {liveState.error && (
          <p style={{ color: "#721c24" }}>
            <strong>Error:</strong> {liveState.error}
          </p>
        )}
      </div>

      {/* Session Controls */}
      <div style={{ marginBottom: "20px" }}>
        <h3>Session Controls</h3>
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <button
            onClick={liveActions.createSession}
            disabled={liveState.isConnected}
            style={{
              padding: "8px 16px",
              backgroundColor: liveState.isConnected ? "#6c757d" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: liveState.isConnected ? "not-allowed" : "pointer",
            }}
          >
            Create Session
          </button>

          <button
            onClick={liveActions.closeSession}
            disabled={!liveState.isConnected}
            style={{
              padding: "8px 16px",
              backgroundColor: !liveState.isConnected ? "#6c757d" : "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: !liveState.isConnected ? "not-allowed" : "pointer",
            }}
          >
            Close Session
          </button>

          <button
            onClick={liveActions.clearError}
            style={{
              padding: "8px 16px",
              backgroundColor: "#ffc107",
              color: "#212529",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Clear Errors
          </button>
        </div>
      </div>

      {/* Analysis Settings */}
      <div style={{ marginBottom: "20px" }}>
        <h3>Analysis Settings</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "15px",
          }}
        >
          <div>
            <label style={{ display: "block", marginBottom: "5px" }}>
              <strong>Depth:</strong> {customDepth}
            </label>
            <input
              type="range"
              min="10"
              max="30"
              value={customDepth}
              onChange={(e) => setCustomDepth(parseInt(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px" }}>
              <strong>Time Limit:</strong> {customTimeLimit / 1000}s
            </label>
            <input
              type="range"
              min="5000"
              max="30000"
              step="1000"
              value={customTimeLimit}
              onChange={(e) => setCustomTimeLimit(parseInt(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px" }}>
              <strong>Current Settings:</strong>
            </label>
            <div style={{ fontSize: "0.9em", color: "#666" }}>
              Depth: {liveState.settings.depth}
              <br />
              Time: {liveState.settings.timeLimit / 1000}s<br />
              MultiPV: {liveState.settings.multiPV}
            </div>
          </div>
        </div>

        <button
          onClick={handleUpdateSettings}
          disabled={!liveState.isConnected}
          style={{
            padding: "8px 16px",
            backgroundColor: !liveState.isConnected ? "#6c757d" : "#28a745",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: !liveState.isConnected ? "not-allowed" : "pointer",
            marginTop: "10px",
          }}
        >
          Update Settings
        </button>
      </div>

      {/* Position Analysis */}
      <div style={{ marginBottom: "20px" }}>
        <h3>Position Analysis</h3>
        <div>
          <label style={{ display: "block", marginBottom: "5px" }}>
            <strong>FEN Position:</strong>
          </label>
          <input
            type="text"
            value={testFen}
            onChange={(e) => setTestFen(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontSize: "0.9em",
              marginBottom: "10px",
            }}
            placeholder="Enter FEN position"
          />
        </div>

        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <button
            onClick={handleAnalyzePosition}
            disabled={!liveState.isConnected || liveState.isAnalyzing}
            style={{
              padding: "8px 16px",
              backgroundColor:
                !liveState.isConnected || liveState.isAnalyzing
                  ? "#6c757d"
                  : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor:
                !liveState.isConnected || liveState.isAnalyzing
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {liveState.isAnalyzing ? "Analyzing..." : "Analyze Position"}
          </button>

          <button
            onClick={() =>
              setTestFen(
                "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
              )
            }
            style={{
              padding: "8px 16px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Load e4 Position
          </button>

          <button
            onClick={() =>
              setTestFen(
                "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
              )
            }
            style={{
              padding: "8px 16px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Reset to Start
          </button>
        </div>
      </div>

      {/* Analysis Results */}
      {liveState.currentResult && (
        <div
          style={{
            padding: "15px",
            backgroundColor: "#f8f9fa",
            border: "1px solid #dee2e6",
            borderRadius: "4px",
            marginBottom: "20px",
          }}
        >
          <h3>📊 Analysis Results</h3>
          <p>
            <strong>Position:</strong>{" "}
            {liveState.currentResult.fen.substring(0, 50)}...
          </p>
          <p>
            <strong>Analysis Time:</strong>{" "}
            {liveState.currentResult.analysisTime}ms
          </p>
          <p>
            <strong>Status:</strong>{" "}
            {liveState.currentResult.isComplete
              ? "✅ Complete"
              : "🔄 In Progress"}
          </p>

          <h4>Best Lines:</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {liveState.currentResult.lines.map((line: any, index: number) => (
              <div
                key={index}
                style={{
                  padding: "8px",
                  backgroundColor: "white",
                  border: "1px solid #ced4da",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "0.9em",
                }}
              >
                <strong>Line {line.multiPvIndex}:</strong>{" "}
                {formatEvaluation(line.evaluation)} - {line.bestMove}
                <br />
                <span style={{ color: "#666" }}>
                  PV: {line.pv.join(" ")} (depth {line.depth})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Debug Info */}
      <details style={{ marginTop: "20px" }}>
        <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
          🔍 Debug Information
        </summary>
        <pre
          style={{
            backgroundColor: "#f8f9fa",
            padding: "10px",
            borderRadius: "4px",
            fontSize: "0.8em",
            overflow: "auto",
          }}
        >
          {JSON.stringify(liveState, null, 2)}
        </pre>
      </details>
    </div>
  );
};

export default LiveAnalysisTest;
