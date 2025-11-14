// frontend/src/pages/GameAnalysisPage.tsx - Fixed version without full page refresh
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Chessboard } from "react-chessboard";
import type { Square } from "react-chessboard/dist/chessboard/types";
import { Chess } from "chess.js";
import { getGame } from "../services/api";
import {
  getEngineStatus,
  startGameAnalysis,
  getGameAnalysis,
  getAnalysisStatus,
  deleteGameAnalysis,
  formatEvaluation,
  getMistakeColor,
  getMistakeIcon,
} from "../services/analysisApi";
import type { Game } from "../types/api";
import type { AnalysisProgress, EngineStatus } from "../services/analysisApi";
import {
  convertToGameAnalysis,
  calculateAnalysisResult,
  type GameAnalysis,
  type AnalysisResult,
} from "../utils";
import { useChessNavigation, useKeyboardShortcuts } from "../hooks";

const GameAnalysisPage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();

  const [game, setGame] = useState<Game | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);

  // Analysis state
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );

  // UI state
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Chess board state
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(
    "white"
  );
  const [showBestMoveArrow, setShowBestMoveArrow] = useState(true);
  const [boardWidth, setBoardWidth] = useState<number>(400);

  // Analysis options
  const [analysisOptions, setAnalysisOptions] = useState({
    depth: 15,
    skipOpeningMoves: 6,
    maxPositions: 30,
  });

  // Analysis progress
  const [analysisProgress, setAnalysisProgress] =
    useState<AnalysisProgress | null>(null);

  // Analysis status
  const [hasExistingAnalysis, setHasExistingAnalysis] = useState(false);

  // Parse game moves and positions
  const gameData = useMemo(() => {
    if (!game?.pgn) return null;

    try {
      const chess = new Chess();
      chess.loadPgn(game.pgn);

      // Get move history
      const moveHistory = chess.history({ verbose: true });

      // Calculate positions for each move
      const positions: string[] = [
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      ]; // Starting position

      const chessTemp = new Chess();
      moveHistory.forEach((move) => {
        chessTemp.move(move);
        positions.push(chessTemp.fen());
      });

      return {
        moves: moveHistory,
        positions,
        totalMoves: moveHistory.length,
      };
    } catch (error) {
      console.error("Error parsing PGN:", error);
      return null;
    }
  }, [game?.pgn]);

  // Chess navigation hook
  const {
    currentMoveIndex,
    goToStart,
    goToPrevious,
    goToNext,
    goToEnd,
    goToMove,
    isAtStart,
    isAtEnd,
  } = useChessNavigation({
    totalMoves: gameData?.totalMoves || 0,
  });

  // Get current position FEN
  const currentPosition = useMemo(() => {
    if (!gameData)
      return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    return gameData.positions[currentMoveIndex] || gameData.positions[0];
  }, [gameData, currentMoveIndex]);

  // Get current move analysis
  const currentMoveAnalysis = useMemo(() => {
    if (!analysis?.analysisDetails || currentMoveIndex === 0) return null;

    // Find analysis for current move (analysis is 1-indexed, our array is 0-indexed)
    return (
      analysis.analysisDetails.find(
        (detail) => detail.moveNumber === currentMoveIndex
      ) || null
    );
  }, [analysis?.analysisDetails, currentMoveIndex]);

  // Get move arrows for best moves
  const moveArrows = useMemo(() => {
    if (!showBestMoveArrow || !currentMoveAnalysis?.bestMove) return [];

    try {
      const move = currentMoveAnalysis.bestMove;
      if (move.length >= 4) {
        const fromSquare = move.substring(0, 2) as Square;
        const toSquare = move.substring(2, 4) as Square;

        // Validate square format (a1-h8)
        const isValidSquare = (square: string): square is Square => {
          return /^[a-h][1-8]$/.test(square);
        };

        if (isValidSquare(fromSquare) && isValidSquare(toSquare)) {
          return [[fromSquare, toSquare, "rgb(40, 167, 69)"]];
        }
      }
    } catch (error) {
      console.warn("Error creating move arrow:", error);
    }

    return [];
  }, [showBestMoveArrow, currentMoveAnalysis?.bestMove]);

  // Keyboard navigation
  useKeyboardShortcuts({
    ArrowLeft: goToPrevious,
    ArrowRight: goToNext,
    Home: goToStart,
    End: goToEnd,
  });

  // Set board orientation based on game
  useEffect(() => {
    if (game && gameData) {
      // Determine if user was playing white or black
      setBoardOrientation("white"); // Default to white for now
    }
  }, [game, gameData]);

  // Calculate responsive board width
  useEffect(() => {
    const calculateBoardWidth = () => {
      const container = document.querySelector('.board-container');
      if (container) {
        const containerWidth = container.clientWidth;
        // Leave some padding
        const calculatedWidth = Math.min(containerWidth - 40, 500);
        setBoardWidth(Math.max(calculatedWidth, 280)); // Minimum 280px
      }
    };

    calculateBoardWidth();
    window.addEventListener('resize', calculateBoardWidth);
    return () => window.removeEventListener('resize', calculateBoardWidth);
  }, []);

  // ✅ FIXED: Separate initial loading from updates
  const loadInitialData = useCallback(async () => {
    if (!gameId) {
      setError("No game ID provided");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log("Loading initial data for gameId:", gameId);

      // Load game data, engine status, and analysis status in parallel
      const [gameData, engineData, statusData] = await Promise.all([
        getGame(gameId),
        getEngineStatus(),
        getAnalysisStatus(gameId),
      ]);

      console.log("Game data:", gameData);
      console.log("Engine status:", engineData);
      console.log("Analysis status:", statusData);

      setGame(gameData);
      setEngineStatus(engineData);
      setHasExistingAnalysis(statusData.hasExistingAnalysis);

      // If analysis exists, load it
      if (statusData.hasExistingAnalysis) {
        console.log("Loading existing analysis...");
        const existingAnalysis = await getGameAnalysis(gameId);

        // Convert to standardized GameAnalysis format
        const standardizedAnalysis = convertToGameAnalysis(
          existingAnalysis,
          gameId
        );
        setAnalysis(standardizedAnalysis);

        // Calculate analysis result from standardized data
        const result = calculateAnalysisResult(standardizedAnalysis);
        setAnalysisResult(result);
      }
    } catch (err) {
      console.error("Error loading initial data:", err);
      setError(err instanceof Error ? err.message : "Failed to load game data");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  // ✅ FIXED: New function to update only analysis data (no full reload)
  const updateAnalysisData = useCallback(async (newAnalysis: GameAnalysis) => {
    try {
      console.log("Updating analysis data:", newAnalysis);

      // Update analysis state immediately (optimistic update)
      setAnalysis(newAnalysis);
      const result = calculateAnalysisResult(newAnalysis);
      setAnalysisResult(result);

      // Update analysis status flag
      setHasExistingAnalysis(true);

      console.log("Analysis data updated successfully");
    } catch (err) {
      console.error("Error updating analysis data:", err);
      // If something goes wrong, we can still fallback to reload
      setError("Failed to update analysis display");
    }
  }, []);

  // Initial load only
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // ✅ FIXED: Remove unnecessary reload after analysis
  const handleStartAnalysis = async () => {
    if (!gameId || !engineStatus?.engineReady) return;

    try {
      setAnalyzing(true);
      setError(null);
      setSuccess(null);
      setAnalysisProgress(null);

      console.log("Starting analysis with options:", analysisOptions);

      const result = await startGameAnalysis(gameId, analysisOptions);

      console.log("Analysis completed:", result);

      // Convert the analysis result to our standardized format
      const standardizedAnalysis = convertToGameAnalysis(
        result.analysis,
        gameId
      );

      // ✅ FIXED: Use the new update function instead of full reload
      await updateAnalysisData(standardizedAnalysis);

      const analysisResult = calculateAnalysisResult(standardizedAnalysis);

      setSuccess(
        `Analysis complete! Found ${analysisResult.mistakes.blunders} blunders and ${analysisResult.mistakes.mistakes} mistakes.`
      );

      // ✅ REMOVED: No more full page reload
      // await loadGameAndStatus(); // <-- This was causing the problem!
    } catch (err) {
      console.error("Analysis error:", err);
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteAnalysis = async () => {
    if (
      !gameId ||
      !confirm("Are you sure you want to delete the analysis for this game?")
    ) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      await deleteGameAnalysis(gameId);
      setSuccess("Analysis deleted successfully");

      // Reset analysis state only (no full reload)
      setAnalysis(null);
      setAnalysisResult(null);
      setHasExistingAnalysis(false);
      goToStart();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete analysis"
      );
    }
  };

  if (loading) {
    return (
      <div className="game-analysis-page">
        <div className="loading">Loading game analysis...</div>
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="game-analysis-page">
        <div className="error">
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="game-analysis-page">
        <div className="error">Game not found</div>
      </div>
    );
  }

  return (
    <div className="game-analysis-page">
      {/* Header */}
      <div className="page-header">
        <h1>Game Analysis</h1>
        <div className="game-info">
          <span className="players">
            {game.whitePlayer} vs {game.blackPlayer}
          </span>
          <span className="result">{game.result}</span>
          <span className="date">
            {new Date(game.playedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Engine Status */}
      <div className="engine-status">
        <h3>🔥 Engine Status</h3>
        {engineStatus ? (
          <div
            className={`status ${engineStatus.engineReady ? "ready" : "error"}`}
          >
            <span className="status-indicator">
              {engineStatus.engineReady ? "✅" : "❌"}
            </span>
            <span className="status-text">
              {engineStatus.engineReady
                ? "Stockfish ready for analysis"
                : "Engine not available"}
            </span>
          </div>
        ) : (
          <div className="status loading">
            <span className="status-indicator">⏳</span>
            <span className="status-text">Checking engine status...</span>
          </div>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="error-message">
          <span className="error-icon">❌</span>
          {error}
        </div>
      )}

      {success && (
        <div className="success-message">
          <span className="success-icon">✅</span>
          {success}
        </div>
      )}

      {/* Main Content */}
      <div className="main-content">
        {/* Left Panel - Chess Board */}
        <div className="board-panel">
          <div className="board-container">
            <Chessboard
              position={currentPosition}
              boardOrientation={boardOrientation}
              areArrowsAllowed={true}
              // customArrows={moveArrows}
              boardWidth={boardWidth}
              customBoardStyle={{
                borderRadius: "8px",
                boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
              }}
            />
          </div>

          {/* Board Controls */}
          <div className="board-controls">
            <button
              onClick={() =>
                setBoardOrientation(
                  boardOrientation === "white" ? "black" : "white"
                )
              }
            >
              Flip Board
            </button>
            <label>
              <input
                type="checkbox"
                checked={showBestMoveArrow}
                onChange={(e) => setShowBestMoveArrow(e.target.checked)}
              />
              Show Best Move
            </label>
          </div>
        </div>

        {/* Right Panel - Analysis */}
        <div className="analysis-panel">
          {/* Move Navigation */}
          <div className="move-navigation">
            <div className="nav-buttons">
              <button onClick={goToStart} disabled={isAtStart}>
                ⏪ Start
              </button>
              <button onClick={goToPrevious} disabled={isAtStart}>
                ⬅️ Previous
              </button>
              <button onClick={goToNext} disabled={isAtEnd}>
                Next ➡️
              </button>
              <button onClick={goToEnd} disabled={isAtEnd}>
                End ⏩
              </button>
            </div>

            <div className="move-info">
              Move {currentMoveIndex} of {gameData?.totalMoves || 0}
            </div>
          </div>

          {/* Current Move Analysis */}
          {currentMoveAnalysis ? (
            <div className="current-move-analysis">
              <h3>
                Move {currentMoveAnalysis.moveNumber}:{" "}
                {currentMoveAnalysis.playerMove}
                {currentMoveAnalysis.mistakeSeverity && (
                  <span
                    className={`mistake-badge ${currentMoveAnalysis.mistakeSeverity}`}
                    style={{
                      color: getMistakeColor(
                        currentMoveAnalysis.mistakeSeverity
                      ),
                    }}
                  >
                    {getMistakeIcon(currentMoveAnalysis.mistakeSeverity)}{" "}
                    {currentMoveAnalysis.mistakeSeverity}
                  </span>
                )}
              </h3>

              <div className="evaluation-info">
                <p>
                  <strong>Evaluation:</strong>{" "}
                  {formatEvaluation(currentMoveAnalysis.evaluation)}
                </p>
                <p>
                  <strong>Best Move:</strong> {currentMoveAnalysis.bestMove}
                </p>
                {currentMoveAnalysis.bestLine && (
                  <p>
                    <strong>Best Line:</strong> {currentMoveAnalysis.bestLine}
                  </p>
                )}
                <p>
                  <strong>Analysis Depth:</strong>{" "}
                  {currentMoveAnalysis.analysisDepth || 15} ply
                </p>
              </div>
            </div>
          ) : currentMoveIndex === 0 ? (
            <div className="current-move-analysis">
              <h3>Starting Position</h3>
              <p>Navigate through the game to see move-by-move analysis.</p>
            </div>
          ) : (
            <div className="current-move-analysis">
              <h3>Move {currentMoveIndex}</h3>
              <p>No analysis available for this move.</p>
            </div>
          )}

          {/* Analysis Controls */}
          <div className="analysis-controls">
            {!hasExistingAnalysis ? (
              <div className="start-analysis">
                <h3>🎯 Start Analysis</h3>
                <div className="analysis-options">
                  <div className="option-group">
                    <label>Analysis Depth:</label>
                    <select
                      value={analysisOptions.depth}
                      onChange={(e) =>
                        setAnalysisOptions({
                          ...analysisOptions,
                          depth: parseInt(e.target.value),
                        })
                      }
                    >
                      <option value={10}>10 ply (Fast)</option>
                      <option value={15}>15 ply (Balanced)</option>
                      <option value={20}>20 ply (Deep)</option>
                      <option value={25}>25 ply (Maximum)</option>
                    </select>
                  </div>

                  <div className="option-group">
                    <label>Skip Opening Moves:</label>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={analysisOptions.skipOpeningMoves}
                      onChange={(e) =>
                        setAnalysisOptions({
                          ...analysisOptions,
                          skipOpeningMoves: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>

                  <div className="option-group">
                    <label>Max Positions:</label>
                    <input
                      type="number"
                      min="10"
                      max="100"
                      value={analysisOptions.maxPositions}
                      onChange={(e) =>
                        setAnalysisOptions({
                          ...analysisOptions,
                          maxPositions: parseInt(e.target.value) || 30,
                        })
                      }
                    />
                  </div>
                </div>

                <button
                  onClick={handleStartAnalysis}
                  disabled={analyzing || !engineStatus?.engineReady}
                  className="start-analysis-btn"
                >
                  {analyzing ? "🔄 Analyzing..." : "🚀 Start Analysis"}
                </button>
              </div>
            ) : (
              <div className="existing-analysis">
                <h3>✅ Analysis Complete</h3>
                <button
                  onClick={handleDeleteAnalysis}
                  className="delete-analysis-btn"
                >
                  🗑️ Delete Analysis
                </button>
              </div>
            )}
          </div>

          {/* Analysis Progress */}
          {analysisProgress && (
            <div className="analysis-progress">
              <h3>Analysis Progress</h3>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${analysisProgress.percentage}%` }}
                ></div>
              </div>
              <p>{analysisProgress.message}</p>
            </div>
          )}

          {/* Analysis Summary */}
          {analysisResult && (
            <div className="analysis-summary">
              <h3>📊 Analysis Summary</h3>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="label">Total Positions:</span>
                  <span className="value">{analysisResult.totalPositions}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Average Depth:</span>
                  <span className="value">
                    {analysisResult.averageDepth.toFixed(1)} ply
                  </span>
                </div>
                <div className="summary-item">
                  <span className="label">White Accuracy:</span>
                  <span className="value">
                    {analysisResult.accuracy.white.toFixed(1)}%
                  </span>
                </div>
                <div className="summary-item">
                  <span className="label">Black Accuracy:</span>
                  <span className="value">
                    {analysisResult.accuracy.black.toFixed(1)}%
                  </span>
                </div>
                <div className="summary-item">
                  <span className="label">Blunders:</span>
                  <span className="value error">
                    {analysisResult.mistakes.blunders}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="label">Mistakes:</span>
                  <span className="value warning">
                    {analysisResult.mistakes.mistakes}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="label">Inaccuracies:</span>
                  <span className="value info">
                    {analysisResult.mistakes.inaccuracies}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Move List */}
      {gameData && analysis && (
        <div className="moves-list">
          <h3>📋 Move Analysis</h3>
          <div className="moves-grid">
            {gameData.moves.map((move, index) => {
              const moveNumber = index + 1;
              const moveAnalysis = analysis.analysisDetails.find(
                (detail) => detail.moveNumber === moveNumber
              );

              return (
                <div
                  key={index}
                  className={`move-item ${
                    currentMoveIndex === moveNumber ? "active" : ""
                  } ${moveAnalysis?.mistakeSeverity || ""}`}
                  onClick={() => goToMove(moveNumber)}
                >
                  <div className="move-number">{moveNumber}.</div>
                  <div className="move-notation">{move.san}</div>
                  {moveAnalysis && (
                    <div className="move-evaluation">
                      <span className="evaluation">
                        {formatEvaluation(moveAnalysis.evaluation)}
                      </span>
                      {moveAnalysis.mistakeSeverity && (
                        <span
                          className={`mistake-indicator ${moveAnalysis.mistakeSeverity}`}
                          style={{
                            color: getMistakeColor(
                              moveAnalysis.mistakeSeverity
                            ),
                          }}
                        >
                          {getMistakeIcon(moveAnalysis.mistakeSeverity)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default GameAnalysisPage;
