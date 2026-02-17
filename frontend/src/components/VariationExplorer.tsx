/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// frontend/src/components/VariationExplorer.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import type { Square } from "react-chessboard/dist/chessboard/types";
import { Chess } from "chess.js";
import type { Move } from "chess.js";
import {
  formatEvaluation,
} from "../services/analysisApi";
import ChessUtils from "../utils/chessUtils";
import { useLiveAnalysis } from "../hooks/useLiveAnalysis";

interface VariationMove {
  move: Move;
  fen: string;
  evaluation?: number;
  bestMove?: string;
  analysis?: {
    lines: Array<{
      evaluation: number;
      bestMove: string;
      pv: string[];
      depth: number;
      multiPvIndex: number;
    }>;
  };
}

interface VariationExplorerProps {
  initialFen: string;
  gameLine?: Array<{
    moveNumber: number;
    move: string;
    fen: string;
    evaluation?: number;
  }>;
  onReturnToGame: () => void;
}

export const VariationExplorer: React.FC<VariationExplorerProps> = ({
  initialFen,
  gameLine = [],
  onReturnToGame,
}) => {
  // Live analysis hook
  const [liveAnalysisState, liveAnalysisActions] = useLiveAnalysis();

  // Chess engine and position state
  const [chess] = useState(() => new Chess(initialFen));
  const [currentFen, setCurrentFen] = useState(initialFen);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(
    "white"
  );

  // Variation tracking
  const [variationMoves, setVariationMoves] = useState<VariationMove[]>([]);
  const [_branchPoint, setBranchPoint] = useState<{
    moveNumber: number;
    description: string;
  } | null>(null);

  // UI state
  const [showLegalMoves, setShowLegalMoves] = useState(false);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [analysisDepth, setAnalysisDepth] = useState(20);
  const [analysisTimeLimit, setAnalysisTimeLimit] = useState(15000);

  // Legal moves for current position
  const positionAnalysis = useMemo(() => {
    return ChessUtils.analyzePosition(currentFen);
  }, [currentFen]);

  // Highlight squares for legal moves
  const legalMoveSquares = useMemo(() => {
    if (!showLegalMoves) return {};

    const squares: Record<string, { backgroundColor: string }> = {};
    positionAnalysis.legalMoves.forEach((move) => {
      squares[move.to] = { backgroundColor: "rgba(0, 255, 0, 0.3)" };
    });
    return squares;
  }, [showLegalMoves, positionAnalysis.legalMoves]);

  // Get move arrows for best moves
  const moveArrows = useMemo(() => {
    const arrows: any[] = [];

    // Show current analysis best move
    if (liveAnalysisState.currentResult?.lines[0]?.bestMove) {
      try {
        const bestMove = liveAnalysisState.currentResult.lines[0].bestMove;
        if (bestMove.length >= 4) {
          const fromSquare = bestMove.substring(0, 2) as Square;
          const toSquare = bestMove.substring(2, 4) as Square;

          const isValidSquare = (square: string): square is Square => {
            return /^[a-h][1-8]$/.test(square);
          };

          if (isValidSquare(fromSquare) && isValidSquare(toSquare)) {
            arrows.push([fromSquare, toSquare, "rgba(0, 255, 0, 0.8)"]); // Green for best move
          }
        }
      } catch (error) {
        console.error("Error creating best move arrow:", error);
      }
    }

    // Show alternative moves with different colors
    if (liveAnalysisState.currentResult?.lines) {
      liveAnalysisState.currentResult.lines
        .slice(1, 3)
        .forEach((line, index) => {
          try {
            const move = line.bestMove;
            if (move.length >= 4) {
              const fromSquare = move.substring(0, 2) as Square;
              const toSquare = move.substring(2, 4) as Square;

              const isValidSquare = (square: string): square is Square => {
                return /^[a-h][1-8]$/.test(square);
              };

              if (isValidSquare(fromSquare) && isValidSquare(toSquare)) {
                const colors = [
                  "rgba(255, 165, 0, 0.6)",
                  "rgba(255, 0, 255, 0.6)",
                ]; // Orange, Magenta
                arrows.push([fromSquare, toSquare, colors[index]]);
              }
            }
          } catch (error) {
            console.error("Error creating alternative move arrow:", error);
          }
        });
    }

    return arrows;
  }, [liveAnalysisState.currentResult]);

  // Initialize live analysis session
  useEffect(() => {
    if (!liveAnalysisState.sessionId) {
      liveAnalysisActions.createSession().catch((error) => {
        console.error("Failed to create variation explorer session:", error);
      });
    }

    return () => {
      if (liveAnalysisState.sessionId) {
        liveAnalysisActions.closeSession().catch((error) => {
          console.error("Failed to close variation explorer session:", error);
        });
      }
    };
  }, []);

  // Auto-analyze current position
  useEffect(() => {
    if (
      autoAnalyze &&
      liveAnalysisState.isConnected &&
      !liveAnalysisState.isAnalyzing &&
      currentFen &&
      liveAnalysisState.lastAnalyzedFen !== currentFen
    ) {
      liveAnalysisActions
        .analyzePosition(currentFen, {
          depth: analysisDepth,
          timeLimit: analysisTimeLimit,
        })
        .catch((error) => {
          console.error("Auto-analysis failed:", error);
        });
    }
  }, [
    currentFen,
    autoAnalyze,
    liveAnalysisState.isConnected,
    liveAnalysisState.isAnalyzing,
    liveAnalysisState.lastAnalyzedFen,
    analysisDepth,
    analysisTimeLimit,
  ]);

  // Handle piece moves
  const onPieceDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square) => {
      try {
        // Try to make the move
        const move = chess.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q", // Auto-promote to queen for simplicity
        });

        if (move) {
          const newFen = chess.fen();

          // Store the move in variation history
          const variationMove: VariationMove = {
            move,
            fen: newFen,
          };

          setVariationMoves((prev) => [...prev, variationMove]);
          setCurrentFen(newFen);

          console.log(
            `🎯 Variation move played: ${move.san} -> ${newFen.substring(
              0,
              30
            )}...`
          );
          return true;
        }
      } catch (error) {
        console.error("Invalid move attempted:", error);
      }
      return false;
    },
    [chess]
  );

  // Handle square clicks (for move hints and piece selection)
  const onSquareClick = useCallback(
    (square: Square) => {
      if (showLegalMoves) {
        const movesToSquare = ChessUtils.getLegalMovesToSquare(
          currentFen,
          square
        );
        const movesFromSquare = ChessUtils.getLegalMovesFromSquare(
          currentFen,
          square
        );

        if (movesToSquare.length > 0) {
          console.log(
            `Legal moves to ${square}:`,
            movesToSquare.map((m) => m.san)
          );
        }
        if (movesFromSquare.length > 0) {
          console.log(
            `Legal moves from ${square}:`,
            movesFromSquare.map((m) => m.san)
          );
        }

        // Show piece and square info
        const piece = ChessUtils.getPieceOnSquare(currentFen, square);
        if (piece) {
          console.log(`Piece on ${square}:`, piece);
        }
      }
    },
    [showLegalMoves, currentFen]
  );

  // Reset to starting position
  const resetPosition = useCallback(() => {
    chess.load(initialFen);
    setCurrentFen(initialFen);
    setVariationMoves([]);
    setBranchPoint(null);
    console.log("🔄 Reset to starting position");
  }, [chess, initialFen]);

  // Undo last move
  const undoLastMove = useCallback(() => {
    if (variationMoves.length > 0) {
      chess.undo();
      const newFen = chess.fen();
      setCurrentFen(newFen);
      setVariationMoves((prev) => prev.slice(0, -1));
      console.log("↶ Undid last move");
    }
  }, [chess, variationMoves]);

  // Compare with game line
  const getGameLineComparison = useCallback(() => {
    if (gameLine.length === 0 || variationMoves.length === 0) return null;

    // Find the corresponding move in the game line
    const moveIndex = variationMoves.length;
    const gameMove = gameLine.find((m) => m.moveNumber === moveIndex);

    if (!gameMove) return null;

    const currentEvaluation =
      liveAnalysisState.currentResult?.lines[0]?.evaluation;
    const gameEvaluation = gameMove.evaluation;

    if (currentEvaluation !== undefined && gameEvaluation !== undefined) {
      const difference = currentEvaluation - gameEvaluation;
      return {
        gameMove: gameMove.move,
        gameEvaluation,
        currentEvaluation,
        difference,
        isBetter: difference > 0.1,
        isWorse: difference < -0.1,
      };
    }

    return null;
  }, [variationMoves, gameLine, liveAnalysisState.currentResult]);

  const gameComparison = getGameLineComparison();

  // Update analysis settings
  const updateAnalysisSettings = useCallback(
    async (newSettings: { depth?: number; timeLimit?: number }) => {
      if (newSettings.depth !== undefined) {
        setAnalysisDepth(newSettings.depth);
      }
      if (newSettings.timeLimit !== undefined) {
        setAnalysisTimeLimit(newSettings.timeLimit);
      }

      if (liveAnalysisState.isConnected) {
        try {
          await liveAnalysisActions.updateSettings({
            depth: newSettings.depth || analysisDepth,
            timeLimit: newSettings.timeLimit || analysisTimeLimit,
          });
        } catch (error) {
          console.error("Failed to update analysis settings:", error);
        }
      }
    },
    [
      liveAnalysisState.isConnected,
      liveAnalysisActions,
      analysisDepth,
      analysisTimeLimit,
    ]
  );

  // Manual analysis trigger
  const triggerAnalysis = useCallback(() => {
    if (liveAnalysisState.isConnected && !liveAnalysisState.isAnalyzing) {
      liveAnalysisActions
        .analyzePosition(currentFen, {
          depth: analysisDepth,
          timeLimit: analysisTimeLimit,
        })
        .catch((error) => {
          console.error("Manual analysis failed:", error);
        });
    }
  }, [
    liveAnalysisState.isConnected,
    liveAnalysisState.isAnalyzing,
    currentFen,
    analysisDepth,
    analysisTimeLimit,
  ]);

  return (
    <div className="variation-explorer">
      {/* Header */}
      <div className="explorer-header">
        <h2>🧪 Variation Explorer</h2>
        <div className="header-controls">
          <button onClick={onReturnToGame} className="return-button">
            ← Return to Game
          </button>
        </div>
      </div>

      {/* Connection Status */}
      <div className="connection-status">
        <div
          className={`status ${
            liveAnalysisState.isConnected ? "connected" : "disconnected"
          }`}
        >
          <span className="status-indicator">
            {liveAnalysisState.isConnected ? "🟢" : "🔴"}
          </span>
          <span className="status-text">
            {liveAnalysisState.isConnected
              ? liveAnalysisState.isAnalyzing
                ? "Analyzing..."
                : "Ready to explore"
              : "Disconnected - Reconnecting..."}
          </span>
        </div>
      </div>

      {/* Error Display */}
      {liveAnalysisState.error && (
        <div className="error-alert">
          <strong>Error:</strong> {liveAnalysisState.error}
          <button
            onClick={liveAnalysisActions.clearError}
            className="clear-error-btn"
          >
            Clear
          </button>
        </div>
      )}

      <div className="explorer-layout">
        {/* Chess Board Section */}
        <div className="board-section">
          <div className="board-container">
            <Chessboard
              position={currentFen}
              boardOrientation={boardOrientation}
              onPieceDrop={onPieceDrop}
              onSquareClick={onSquareClick}
              customArrows={moveArrows}
              customSquareStyles={legalMoveSquares}
              boardWidth={450}
              arePiecesDraggable={true}
              customBoardStyle={{
                borderRadius: "8px",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
              }}
            />
          </div>

          {/* Board Controls */}
          <div className="board-controls">
            <button onClick={resetPosition} className="control-btn reset">
              🔄 Reset
            </button>
            <button
              onClick={undoLastMove}
              disabled={variationMoves.length === 0}
              className="control-btn undo"
            >
              ↶ Undo
            </button>
            <button
              onClick={() =>
                setBoardOrientation(
                  boardOrientation === "white" ? "black" : "white"
                )
              }
              className="control-btn flip"
            >
              🔄 Flip Board
            </button>
          </div>

          {/* Board Options */}
          <div className="board-options">
            <label className="option">
              <input
                type="checkbox"
                checked={showLegalMoves}
                onChange={(e) => setShowLegalMoves(e.target.checked)}
              />
              Show Legal Moves
            </label>
            <label className="option">
              <input
                type="checkbox"
                checked={autoAnalyze}
                onChange={(e) => setAutoAnalyze(e.target.checked)}
              />
              Auto-analyze
            </label>
          </div>
        </div>

        {/* Analysis Panel */}
        <div className="analysis-panel">
          {/* Analysis Controls */}
          <div className="analysis-controls">
            <h3>🎛️ Analysis Settings</h3>

            <div className="controls-grid">
              <div className="control-group">
                <label>Depth: {analysisDepth}</label>
                <input
                  type="range"
                  min="15"
                  max="35"
                  value={analysisDepth}
                  onChange={(e) =>
                    updateAnalysisSettings({ depth: parseInt(e.target.value) })
                  }
                />
              </div>

              <div className="control-group">
                <label>Time: {analysisTimeLimit / 1000}s</label>
                <input
                  type="range"
                  min="10000"
                  max="60000"
                  step="5000"
                  value={analysisTimeLimit}
                  onChange={(e) =>
                    updateAnalysisSettings({
                      timeLimit: parseInt(e.target.value),
                    })
                  }
                />
              </div>

              <button
                onClick={triggerAnalysis}
                disabled={
                  !liveAnalysisState.isConnected ||
                  liveAnalysisState.isAnalyzing
                }
                className="analyze-btn"
              >
                {liveAnalysisState.isAnalyzing
                  ? "Analyzing..."
                  : "Analyze Position"}
              </button>
            </div>
          </div>

          {/* Current Analysis Results */}
          {liveAnalysisState.currentResult && (
            <div className="current-analysis">
              <h3>📊 Position Analysis</h3>
              <div className="analysis-lines">
                {liveAnalysisState.currentResult.lines.map((line, index) => (
                  <div
                    key={index}
                    className={`analysis-line line-${index + 1}`}
                  >
                    <div className="line-header">
                      <span className="line-number">#{line.multiPvIndex}</span>
                      <span className="evaluation">
                        {formatEvaluation(line.evaluation)}
                      </span>
                      <span className="best-move">{line.bestMove}</span>
                    </div>
                    <div className="principal-variation">
                      {line.pv.slice(0, 6).join(" ")}
                      {line.pv.length > 6 && " ..."}
                    </div>
                  </div>
                ))}
              </div>
              <div className="analysis-info">
                <span>
                  Analysis time: {liveAnalysisState.currentResult.analysisTime}
                  ms
                </span>
                <span>
                  Turn: {positionAnalysis.turn === "w" ? "White" : "Black"} to
                  move
                </span>
                {positionAnalysis.isCheck && (
                  <span style={{ color: "#dc3545" }}>⚠️ In Check</span>
                )}
              </div>
            </div>
          )}

          {/* Game Comparison */}
          {gameComparison && (
            <div className="game-comparison">
              <h3>⚖️ Comparison with Game</h3>
              <div className="comparison-grid">
                <div className="comparison-item">
                  <span className="label">Game move:</span>
                  <span className="value">{gameComparison.gameMove}</span>
                  <span className="evaluation">
                    {formatEvaluation(gameComparison.gameEvaluation)}
                  </span>
                </div>
                <div className="comparison-item">
                  <span className="label">Your line:</span>
                  <span className="value">
                    {variationMoves[variationMoves.length - 1]?.move.san ||
                      "N/A"}
                  </span>
                  <span className="evaluation">
                    {formatEvaluation(gameComparison.currentEvaluation)}
                  </span>
                </div>
                <div
                  className={`comparison-result ${
                    gameComparison.isBetter
                      ? "better"
                      : gameComparison.isWorse
                      ? "worse"
                      : "similar"
                  }`}
                >
                  <span className="difference">
                    {gameComparison.difference > 0 ? "+" : ""}
                    {gameComparison.difference.toFixed(2)}
                  </span>
                  <span className="verdict">
                    {gameComparison.isBetter
                      ? "✅ Better!"
                      : gameComparison.isWorse
                      ? "❌ Worse"
                      : "≈ Similar"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Variation History */}
          <div className="variation-history">
            <h3>📝 Variation History</h3>
            {variationMoves.length === 0 ? (
              <p className="no-moves">
                No moves played yet. Start exploring by moving pieces!
              </p>
            ) : (
              <div className="moves-list">
                {variationMoves.map((varMove, index) => (
                  <div key={index} className="variation-move">
                    <span className="move-number">{index + 1}.</span>
                    <span className="move-notation">{varMove.move.san}</span>
                    {varMove.evaluation && (
                      <span className="move-eval">
                        {formatEvaluation(varMove.evaluation)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Position Info */}
          <div className="position-info">
            <h3>ℹ️ Position Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Legal moves:</span>
                <span className="value">
                  {positionAnalysis.legalMoves.length}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Moves played:</span>
                <span className="value">{variationMoves.length}</span>
              </div>
              <div className="info-item">
                <span className="label">Turn:</span>
                <span className="value">
                  {positionAnalysis.turn === "w" ? "White" : "Black"}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Status:</span>
                <span className="value">
                  {positionAnalysis.isCheckmate
                    ? "Checkmate"
                    : positionAnalysis.isStalemate
                    ? "Stalemate"
                    : positionAnalysis.isCheck
                    ? "Check"
                    : positionAnalysis.isDraw
                    ? "Draw"
                    : "Normal"}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Castling:</span>
                <span className="value">
                  {positionAnalysis.castlingRights || "None available"}
                </span>
              </div>
              <div className="info-item">
                <span className="label">En passant:</span>
                <span className="value">
                  {positionAnalysis.enPassantSquare || "None"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .variation-explorer {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
        }

        .explorer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid #e9ecef;
        }

        .explorer-header h2 {
          margin: 0;
          color: #2c3e50;
        }

        .return-button {
          background: #6c757d;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          transition: background 0.2s;
        }

        .return-button:hover {
          background: #5a6268;
        }

        .connection-status {
          margin-bottom: 20px;
          padding: 10px;
          background: #f8f9fa;
          border-radius: 6px;
        }

        .status {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .status.connected {
          color: #28a745;
        }

        .status.disconnected {
          color: #dc3545;
        }

        .status-indicator {
          font-size: 1.2em;
        }

        .error-alert {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
          padding: 10px;
          border-radius: 6px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .clear-error-btn {
          background: transparent;
          border: 1px solid #721c24;
          color: #721c24;
          padding: 2px 8px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 0.8em;
        }

        .explorer-layout {
          display: grid;
          grid-template-columns: minmax(450px, 550px) 1fr;
          gap: 30px;
        }

        .board-section {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .board-container {
          display: flex;
          justify-content: center;
        }

        .board-controls {
          display: flex;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .control-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.2s;
        }

        .control-btn.reset {
          background: #ffc107;
          color: #212529;
        }

        .control-btn.reset:hover {
          background: #e0a800;
        }

        .control-btn.undo {
          background: #fd7e14;
          color: white;
        }

        .control-btn.undo:hover:not(:disabled) {
          background: #e0680f;
        }

        .control-btn.flip {
          background: #6c757d;
          color: white;
        }

        .control-btn.flip:hover {
          background: #5a6268;
        }

        .control-btn:disabled {
          background: #dee2e6;
          color: #6c757d;
          cursor: not-allowed;
        }

        .board-options {
          display: flex;
          justify-content: center;
          gap: 20px;
          flex-wrap: wrap;
        }

        .option {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 0.9em;
          color: #495057;
        }

        .option input {
          cursor: pointer;
        }

        .analysis-panel {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .analysis-controls {
          background: #fff3cd;
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #ffc107;
        }

        .analysis-controls h3 {
          margin: 0 0 15px 0;
          color: #856404;
        }

        .controls-grid {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          gap: 15px;
          align-items: end;
        }

        .control-group {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .control-group label {
          font-size: 0.9em;
          font-weight: bold;
          color: #495057;
        }

        .control-group input[type="range"] {
          width: 100%;
        }

        .analyze-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          white-space: nowrap;
        }

        .analyze-btn:hover:not(:disabled) {
          background: #0056b3;
        }

        .analyze-btn:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .current-analysis {
          background: white;
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .current-analysis h3 {
          margin: 0 0 15px 0;
          color: #2c3e50;
        }

        .analysis-lines {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 15px;
        }

        .analysis-line {
          padding: 10px;
          border-radius: 6px;
          border-left: 4px solid #dee2e6;
        }

        .analysis-line.line-1 {
          border-left-color: #28a745;
          background: rgba(40, 167, 69, 0.1);
        }

        .analysis-line.line-2 {
          border-left-color: #ffc107;
          background: rgba(255, 193, 7, 0.1);
        }

        .analysis-line.line-3 {
          border-left-color: #fd7e14;
          background: rgba(253, 126, 20, 0.1);
        }

        .line-header {
          display: flex;
          gap: 15px;
          align-items: center;
          margin-bottom: 5px;
        }

        .line-number {
          font-weight: bold;
          color: #6c757d;
          min-width: 25px;
        }

        .evaluation {
          font-family: monospace;
          font-weight: bold;
          min-width: 60px;
        }

        .best-move {
          font-weight: bold;
          color: #2c3e50;
        }

        .principal-variation {
          font-family: monospace;
          font-size: 0.9em;
          color: #6c757d;
          padding-left: 40px;
        }

        .analysis-info {
          display: flex;
          justify-content: space-between;
          font-size: 0.8em;
          color: #6c757d;
          border-top: 1px solid #dee2e6;
          padding-top: 10px;
        }

        .game-comparison {
          background: #e7f3ff;
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #007bff;
        }

        .game-comparison h3 {
          margin: 0 0 15px 0;
          color: #0056b3;
        }

        .comparison-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .comparison-item {
          display: grid;
          grid-template-columns: 100px 1fr auto;
          gap: 10px;
          align-items: center;
          padding: 8px;
          background: rgba(255, 255, 255, 0.5);
          border-radius: 4px;
        }

        .comparison-item .label {
          font-weight: bold;
          color: #495057;
          font-size: 0.9em;
        }

        .comparison-item .value {
          font-family: monospace;
          font-weight: bold;
        }

        .comparison-item .evaluation {
          font-family: monospace;
          font-size: 0.9em;
          background: #f8f9fa;
          padding: 2px 6px;
          border-radius: 3px;
        }

        .comparison-result {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          border-radius: 6px;
          font-weight: bold;
        }

        .comparison-result.better {
          background: rgba(40, 167, 69, 0.2);
          color: #155724;
        }

        .comparison-result.worse {
          background: rgba(220, 53, 69, 0.2);
          color: #721c24;
        }

        .comparison-result.similar {
          background: rgba(108, 117, 125, 0.2);
          color: #495057;
        }

        .difference {
          font-family: monospace;
          font-size: 1.1em;
        }

        .verdict {
          font-size: 0.9em;
        }

        .variation-history {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
        }

        .variation-history h3 {
          margin: 0 0 15px 0;
          color: #2c3e50;
        }

        .no-moves {
          color: #6c757d;
          font-style: italic;
          text-align: center;
          margin: 0;
        }

        .moves-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .variation-move {
          display: flex;
          align-items: center;
          gap: 5px;
          background: white;
          padding: 6px 10px;
          border-radius: 4px;
          border: 1px solid #dee2e6;
          font-family: monospace;
          font-size: 0.9em;
        }

        .move-number {
          color: #6c757d;
          font-weight: bold;
        }

        .move-notation {
          color: #2c3e50;
          font-weight: bold;
        }

        .move-eval {
          color: #495057;
          background: #e9ecef;
          padding: 1px 4px;
          border-radius: 2px;
          font-size: 0.8em;
        }

        .position-info {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
        }

        .position-info h3 {
          margin: 0 0 15px 0;
          color: #2c3e50;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px;
          background: white;
          border-radius: 4px;
          border: 1px solid #dee2e6;
        }

        .info-item .label {
          font-weight: bold;
          color: #495057;
          font-size: 0.9em;
        }

        .info-item .value {
          font-family: monospace;
          color: #2c3e50;
        }

        /* Responsive Design */
        @media (max-width: 1200px) {
          .explorer-layout {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .board-section {
            order: 1;
          }

          .analysis-panel {
            order: 2;
          }
        }

        @media (max-width: 768px) {
          .variation-explorer {
            padding: 10px;
          }

          .explorer-header {
            flex-direction: column;
            gap: 10px;
            text-align: center;
          }

          .controls-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .board-controls {
            flex-direction: column;
            align-items: center;
          }

          .board-options {
            flex-direction: column;
            align-items: center;
          }

          .comparison-item {
            grid-template-columns: 1fr;
            text-align: center;
            gap: 5px;
          }

          .info-grid {
            grid-template-columns: 1fr;
          }

          .line-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 5px;
          }

          .principal-variation {
            padding-left: 0;
          }
        }

        @media (max-width: 500px) {
          .moves-list {
            flex-direction: column;
          }

          .variation-move {
            justify-content: space-between;
          }

          .analysis-info {
            flex-direction: column;
            gap: 5px;
          }
        }
      `}</style>
    </div>
  );
};
