/* eslint-disable @typescript-eslint/no-explicit-any */
// frontend/src/pages/GameAnalysisPage.tsx - Enhanced with Chess Board
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

// Standardized GameAnalysis interface that matches backend exactly
interface GameAnalysis {
  gameId: string;
  totalMoves: number;
  analyzedMoves: number;
  accuracy: {
    white: number;
    black: number;
    overall: number;
  };
  mistakes: {
    blunders: number;
    mistakes: number;
    inaccuracies: number;
  };
  analysisDetails: Array<{
    moveNumber: number;
    playerMove: string;
    evaluation: number;
    bestMove: string;
    mistakeSeverity?: string;
    analysisDepth?: number;
    positionFen?: string;
    bestLine?: string;
  }>;
}

// Simplified AnalysisResult interface for display
interface AnalysisResult {
  gameId: string;
  totalPositions: number;
  analyzedPositions: number;
  analysisTime: number;
  averageDepth: number;
  mistakes: {
    blunders: number;
    mistakes: number;
    inaccuracies: number;
  };
  accuracy: {
    white: number;
    black: number;
  };
}

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
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(0);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(
    "white"
  );
  const [showBestMoveArrow, setShowBestMoveArrow] = useState(true);

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
      console.error("Error creating move arrows:", error);
    }

    return [];
  }, [showBestMoveArrow, currentMoveAnalysis?.bestMove]);

  // Get last move highlight
  const lastMoveSquares = useMemo(() => {
    if (currentMoveIndex === 0 || !gameData?.moves[currentMoveIndex - 1])
      return {};

    const lastMove = gameData.moves[currentMoveIndex - 1];
    return {
      [lastMove.from]: { backgroundColor: "rgba(255, 255, 0, 0.4)" },
      [lastMove.to]: { backgroundColor: "rgba(255, 255, 0, 0.4)" },
    };
  }, [currentMoveIndex, gameData?.moves]);

  // Navigation functions
  const goToMove = useCallback(
    (moveIndex: number) => {
      if (!gameData) return;
      const clampedIndex = Math.max(
        0,
        Math.min(moveIndex, gameData.totalMoves)
      );
      setCurrentMoveIndex(clampedIndex);
    },
    [gameData]
  );

  const goToStart = useCallback(() => goToMove(0), [goToMove]);
  const goToEnd = useCallback(() => {
    if (gameData) goToMove(gameData.totalMoves);
  }, [goToMove, gameData]);

  const goToPrevious = useCallback(
    () => goToMove(currentMoveIndex - 1),
    [goToMove, currentMoveIndex]
  );
  const goToNext = useCallback(
    () => goToMove(currentMoveIndex + 1),
    [goToMove, currentMoveIndex]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          goToPrevious();
          break;
        case "ArrowRight":
          event.preventDefault();
          goToNext();
          break;
        case "Home":
          event.preventDefault();
          goToStart();
          break;
        case "End":
          event.preventDefault();
          goToEnd();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [goToPrevious, goToNext, goToStart, goToEnd]);

  // Set board orientation based on game
  useEffect(() => {
    if (game && gameData) {
      // Determine if user was playing white or black
      // You might need to adjust this logic based on how you determine the user
      setBoardOrientation("white"); // Default to white for now
    }
  }, [game, gameData]);

  const loadGameAndStatus = useCallback(async () => {
    if (!gameId) {
      setError("No game ID provided");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log("Loading game and analysis status for gameId:", gameId);

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
      console.error("Error loading game and status:", err);
      setError(err instanceof Error ? err.message : "Failed to load game data");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    loadGameAndStatus();
  }, [loadGameAndStatus]);

  // Convert any analysis data structure to standardized GameAnalysis format
  const convertToGameAnalysis = (
    analysisData: any,
    gameId: string
  ): GameAnalysis => {
    if (!analysisData) {
      return createEmptyGameAnalysis(gameId);
    }

    // If it's already the correct GameAnalysis structure
    if (
      analysisData.gameId &&
      analysisData.analysisDetails &&
      Array.isArray(analysisData.analysisDetails)
    ) {
      return analysisData as GameAnalysis;
    }

    // If it's an array of Analysis objects (old structure), convert it
    if (Array.isArray(analysisData)) {
      const details = analysisData.map((move: any) => ({
        moveNumber: move.moveNumber,
        playerMove: move.playerMove,
        evaluation: move.stockfishEvaluation,
        bestMove: move.bestMove,
        mistakeSeverity: move.mistakeSeverity,
        analysisDepth: move.analysisDepth,
        positionFen: move.positionFen,
        bestLine: move.bestLine,
      }));

      // Calculate statistics from the array
      const totalMoves = details.length;
      const mistakes = {
        blunders: details.filter((m: any) => m.mistakeSeverity === "blunder")
          .length,
        mistakes: details.filter((m: any) => m.mistakeSeverity === "mistake")
          .length,
        inaccuracies: details.filter(
          (m: any) => m.mistakeSeverity === "inaccuracy"
        ).length,
      };

      // Calculate accuracy for white and black
      const whiteMoves = details.filter((m: any) => m.moveNumber % 2 === 1);
      const blackMoves = details.filter((m: any) => m.moveNumber % 2 === 0);

      const whiteGoodMoves = whiteMoves.filter(
        (m: any) =>
          m.mistakeSeverity === "good" || m.mistakeSeverity === "excellent"
      ).length;
      const blackGoodMoves = blackMoves.filter(
        (m: any) =>
          m.mistakeSeverity === "good" || m.mistakeSeverity === "excellent"
      ).length;

      const whiteAccuracy =
        whiteMoves.length > 0 ? (whiteGoodMoves / whiteMoves.length) * 100 : 0;
      const blackAccuracy =
        blackMoves.length > 0 ? (blackGoodMoves / blackMoves.length) * 100 : 0;
      const overallAccuracy =
        totalMoves > 0
          ? ((whiteGoodMoves + blackGoodMoves) / totalMoves) * 100
          : 0;

      return {
        gameId,
        totalMoves,
        analyzedMoves: totalMoves,
        accuracy: {
          white: Math.round(whiteAccuracy * 100) / 100,
          black: Math.round(blackAccuracy * 100) / 100,
          overall: Math.round(overallAccuracy * 100) / 100,
        },
        mistakes,
        analysisDetails: details,
      };
    }

    // Unknown structure - return empty
    console.warn("Unknown analysis data structure:", analysisData);
    return createEmptyGameAnalysis(gameId);
  };

  const createEmptyGameAnalysis = (gameId: string): GameAnalysis => {
    return {
      gameId,
      totalMoves: 0,
      analyzedMoves: 0,
      accuracy: { white: 0, black: 0, overall: 0 },
      mistakes: { blunders: 0, mistakes: 0, inaccuracies: 0 },
      analysisDetails: [],
    };
  };

  const calculateAnalysisResult = (
    analysisData: GameAnalysis
  ): AnalysisResult => {
    const details = analysisData.analysisDetails;

    return {
      gameId: analysisData.gameId,
      totalPositions: analysisData.totalMoves,
      analyzedPositions: analysisData.analyzedMoves,
      analysisTime: 0, // Not available in current structure
      averageDepth:
        details.length > 0
          ? details.reduce((sum, move) => sum + (move.analysisDepth || 15), 0) /
            details.length
          : 15,
      mistakes: analysisData.mistakes,
      accuracy: {
        white: analysisData.accuracy.white,
        black: analysisData.accuracy.black,
      },
    };
  };

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
      setAnalysis(standardizedAnalysis);

      const analysisResult = calculateAnalysisResult(standardizedAnalysis);
      setAnalysisResult(analysisResult);

      setSuccess(
        `Analysis complete! Found ${analysisResult.mistakes.blunders} blunders and ${analysisResult.mistakes.mistakes} mistakes.`
      );

      // Reload analysis data to ensure consistency
      await loadGameAndStatus();
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

      // Reset state
      setAnalysis(null);
      setAnalysisResult(null);
      setHasExistingAnalysis(false);
      setCurrentMoveIndex(0);
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
                ? `${engineStatus.engineType} Ready`
                : `Engine Error: ${engineStatus.error || "Not available"}`}
            </span>
          </div>
        ) : (
          <div className="status loading">Checking engine status...</div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div className="alert success">
          <strong>Success:</strong> {success}
        </div>
      )}

      {/* Main Content */}
      {hasExistingAnalysis && gameData ? (
        <div className="analysis-view">
          {/* Chess Board and Navigation */}
          <div className="board-section">
            <div className="board-container">
              <Chessboard
                position={currentPosition}
                boardOrientation={boardOrientation}
                customArrows={moveArrows as any}
                customSquareStyles={lastMoveSquares}
                boardWidth={400}
                arePiecesDraggable={false}
                customBoardStyle={{
                  borderRadius: "4px",
                  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
                }}
              />
            </div>

            {/* Board Controls */}
            <div className="board-controls">
              <button
                onClick={goToStart}
                disabled={currentMoveIndex === 0}
                className="nav-button"
                title="Go to start (Home)"
              >
                ⏮
              </button>
              <button
                onClick={goToPrevious}
                disabled={currentMoveIndex === 0}
                className="nav-button"
                title="Previous move (←)"
              >
                ◀
              </button>
              <span className="move-counter">
                {currentMoveIndex} / {gameData.totalMoves}
              </span>
              <button
                onClick={goToNext}
                disabled={currentMoveIndex >= gameData.totalMoves}
                className="nav-button"
                title="Next move (→)"
              >
                ▶
              </button>
              <button
                onClick={goToEnd}
                disabled={currentMoveIndex >= gameData.totalMoves}
                className="nav-button"
                title="Go to end (End)"
              >
                ⏭
              </button>
            </div>

            {/* Board Options */}
            <div className="board-options">
              <button
                onClick={() =>
                  setBoardOrientation(
                    boardOrientation === "white" ? "black" : "white"
                  )
                }
                className="option-button"
              >
                🔄 Flip Board
              </button>
              <label className="option-checkbox">
                <input
                  type="checkbox"
                  checked={showBestMoveArrow}
                  onChange={(e) => setShowBestMoveArrow(e.target.checked)}
                />
                Show Best Move
              </label>
            </div>

            {/* Current Move Info */}
            {currentMoveIndex > 0 && gameData.moves[currentMoveIndex - 1] && (
              <div className="current-move-info">
                <h4>
                  Move {currentMoveIndex}:{" "}
                  {gameData.moves[currentMoveIndex - 1].san}
                </h4>
                {currentMoveAnalysis && (
                  <div className="move-analysis-summary">
                    <div className="evaluation">
                      Evaluation:{" "}
                      <strong>
                        {formatEvaluation(currentMoveAnalysis.evaluation)}
                      </strong>
                    </div>
                    <div className="best-move">
                      Best: <strong>{currentMoveAnalysis.bestMove}</strong>
                    </div>
                    {currentMoveAnalysis.mistakeSeverity && (
                      <div
                        className="mistake-badge"
                        style={{
                          backgroundColor: getMistakeColor(
                            currentMoveAnalysis.mistakeSeverity
                          ),
                        }}
                      >
                        {getMistakeIcon(currentMoveAnalysis.mistakeSeverity)}{" "}
                        {currentMoveAnalysis.mistakeSeverity}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Analysis Panel */}
          <div className="analysis-panel">
            {/* Analysis Summary */}
            {analysisResult && (
              <div className="analysis-summary">
                <h3>Analysis Summary</h3>
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="summary-label">Positions Analyzed:</span>
                    <span className="summary-value">
                      {analysisResult.analyzedPositions}
                    </span>
                  </div>
                  <div className="summary-item blunders">
                    <span className="summary-label">💥 Blunders:</span>
                    <span className="summary-value">
                      {analysisResult.mistakes.blunders}
                    </span>
                  </div>
                  <div className="summary-item mistakes">
                    <span className="summary-label">❌ Mistakes:</span>
                    <span className="summary-value">
                      {analysisResult.mistakes.mistakes}
                    </span>
                  </div>
                  <div className="summary-item inaccuracies">
                    <span className="summary-label">⚠️ Inaccuracies:</span>
                    <span className="summary-value">
                      {analysisResult.mistakes.inaccuracies}
                    </span>
                  </div>
                  <div className="summary-item accuracy-white">
                    <span className="summary-label">White Accuracy:</span>
                    <span className="summary-value">
                      {analysisResult.accuracy.white}%
                    </span>
                  </div>
                  <div className="summary-item accuracy-black">
                    <span className="summary-label">Black Accuracy:</span>
                    <span className="summary-value">
                      {analysisResult.accuracy.black}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Move List */}
            <div className="move-list-section">
              <h3>Move List</h3>
              <div className="move-list">
                <div
                  className={`move-item ${
                    currentMoveIndex === 0 ? "current" : ""
                  }`}
                  onClick={() => goToMove(0)}
                >
                  <span className="move-number">Start</span>
                  <span className="move-notation">Starting Position</span>
                </div>

                {gameData.moves.map((move, index) => {
                  const moveNumber = index + 1;
                  const moveAnalysis = analysis?.analysisDetails.find(
                    (d) => d.moveNumber === moveNumber
                  );
                  const isCurrent = currentMoveIndex === moveNumber;

                  return (
                    <div
                      key={moveNumber}
                      className={`move-item ${isCurrent ? "current" : ""} ${
                        moveAnalysis?.mistakeSeverity || ""
                      }`}
                      onClick={() => goToMove(moveNumber)}
                    >
                      <span className="move-number">{moveNumber}.</span>
                      <span className="move-notation">{move.san}</span>
                      {moveAnalysis && (
                        <>
                          <span className="move-evaluation">
                            {formatEvaluation(moveAnalysis.evaluation)}
                          </span>
                          {moveAnalysis.mistakeSeverity && (
                            <span
                              className="mistake-indicator"
                              style={{
                                color: getMistakeColor(
                                  moveAnalysis.mistakeSeverity
                                ),
                              }}
                            >
                              {getMistakeIcon(moveAnalysis.mistakeSeverity)}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="analysis-actions">
              <button
                onClick={() => {
                  setHasExistingAnalysis(false);
                  setAnalysis(null);
                  setAnalysisResult(null);
                }}
                className="re-analyze-button"
              >
                Configure New Analysis
              </button>
              <button
                onClick={handleDeleteAnalysis}
                className="delete-analysis-button"
              >
                Delete Analysis
              </button>
            </div>
          </div>
        </div>
      ) : (
        // No analysis yet - show analysis form (existing code)
        <div className="analysis-section">
          <div className="section-header">
            <h2>Chess Engine Analysis</h2>
          </div>

          <div className="no-analysis">
            <h3>No Analysis Available</h3>
            <p>
              Analyze this game with Stockfish to find mistakes, blunders, and
              improvements.
            </p>

            <div className="analysis-options">
              <h4>Analysis Options</h4>

              <div className="options-grid">
                <div className="option">
                  <label htmlFor="depth">Analysis Depth:</label>
                  <select
                    id="depth"
                    value={analysisOptions.depth}
                    onChange={(e) =>
                      setAnalysisOptions({
                        ...analysisOptions,
                        depth: parseInt(e.target.value),
                      })
                    }
                    disabled={analyzing}
                  >
                    <option value={10}>10 - Fast</option>
                    <option value={15}>15 - Balanced</option>
                    <option value={20}>20 - Deep</option>
                    <option value={25}>25 - Very Deep</option>
                  </select>
                </div>

                <div className="option">
                  <label htmlFor="skipMoves">Skip Opening Moves:</label>
                  <select
                    id="skipMoves"
                    value={analysisOptions.skipOpeningMoves}
                    onChange={(e) =>
                      setAnalysisOptions({
                        ...analysisOptions,
                        skipOpeningMoves: parseInt(e.target.value),
                      })
                    }
                    disabled={analyzing}
                  >
                    <option value={4}>4 moves</option>
                    <option value={6}>6 moves</option>
                    <option value={8}>8 moves</option>
                    <option value={10}>10 moves</option>
                  </select>
                </div>

                <div className="option">
                  <label htmlFor="maxPositions">Max Positions:</label>
                  <select
                    id="maxPositions"
                    value={analysisOptions.maxPositions}
                    onChange={(e) =>
                      setAnalysisOptions({
                        ...analysisOptions,
                        maxPositions: parseInt(e.target.value),
                      })
                    }
                    disabled={analyzing}
                  >
                    <option value={20}>20 - Quick</option>
                    <option value={30}>30 - Standard</option>
                    <option value={50}>50 - Thorough</option>
                    <option value={100}>100 - Complete</option>
                  </select>
                </div>
              </div>

              <div className="analysis-actions">
                <button
                  onClick={handleStartAnalysis}
                  disabled={analyzing || !engineStatus?.engineReady}
                  className="start-analysis-button"
                >
                  {analyzing ? "Analyzing..." : "Start Analysis"}
                </button>
              </div>
            </div>

            {/* Analysis Progress */}
            {analyzing && analysisProgress && (
              <div className="analysis-progress">
                <h4>Analysis Progress</h4>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${analysisProgress.percentage}%` }}
                  />
                </div>
                <div className="progress-text">
                  {analysisProgress.message} ({analysisProgress.percentage}%)
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .game-analysis-page {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
        }

        .page-header {
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e9ecef;
        }

        .page-header h1 {
          margin: 0 0 10px 0;
          color: #2c3e50;
        }

        .game-info {
          display: flex;
          gap: 20px;
          align-items: center;
          flex-wrap: wrap;
        }

        .players {
          font-weight: bold;
          font-size: 1.1em;
          color: #2c3e50;
        }

        .result {
          background: #e9ecef;
          padding: 4px 12px;
          border-radius: 20px;
          font-weight: bold;
        }

        .date {
          color: #6c757d;
          font-size: 0.9em;
        }

        .engine-status {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .engine-status h3 {
          margin: 0 0 10px 0;
          color: #2c3e50;
        }

        .status {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .status.ready {
          color: #28a745;
        }

        .status.error {
          color: #dc3545;
        }

        .status.loading {
          color: #6c757d;
        }

        .status-indicator {
          font-size: 1.2em;
        }

        .alert {
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .alert.error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .alert.success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        /* Analysis View Layout */
        .analysis-view {
          display: grid;
          grid-template-columns: minmax(400px, 500px) 1fr;
          gap: 30px;
          margin-top: 20px;
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
          align-items: center;
          gap: 10px;
        }

        .nav-button {
          background: #007bff;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1.2em;
          transition: background 0.2s;
        }

        .nav-button:hover:not(:disabled) {
          background: #0056b3;
        }

        .nav-button:disabled {
          background: #6c757d;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .move-counter {
          background: #f8f9fa;
          padding: 8px 12px;
          border-radius: 4px;
          font-weight: bold;
          color: #495057;
          min-width: 80px;
          text-align: center;
        }

        .board-options {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 15px;
          flex-wrap: wrap;
        }

        .option-button {
          background: #6c757d;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9em;
        }

        .option-button:hover {
          background: #5a6268;
        }

        .option-checkbox {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.9em;
          color: #495057;
          cursor: pointer;
        }

        .option-checkbox input {
          cursor: pointer;
        }

        .current-move-info {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #007bff;
        }

        .current-move-info h4 {
          margin: 0 0 10px 0;
          color: #2c3e50;
        }

        .move-analysis-summary {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .evaluation,
        .best-move {
          font-size: 0.9em;
          color: #495057;
        }

        .mistake-badge {
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 0.8em;
          font-weight: bold;
          text-transform: uppercase;
          display: inline-block;
          max-width: fit-content;
        }

        /* Analysis Panel */
        .analysis-panel {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .analysis-summary {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
        }

        .analysis-summary h3 {
          margin: 0 0 15px 0;
          color: #2c3e50;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 10px;
          background: white;
          border-radius: 6px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .summary-item.blunders {
          border-left: 4px solid #dc3545;
        }

        .summary-item.mistakes {
          border-left: 4px solid #fd7e14;
        }

        .summary-item.inaccuracies {
          border-left: 4px solid #ffc107;
        }

        .summary-item.accuracy-white,
        .summary-item.accuracy-black {
          border-left: 4px solid #28a745;
        }

        .summary-label {
          font-size: 0.8em;
          color: #6c757d;
          margin-bottom: 4px;
          text-align: center;
        }

        .summary-value {
          font-weight: bold;
          color: #2c3e50;
          font-size: 1.1em;
        }

        /* Move List */
        .move-list-section {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .move-list-section h3 {
          margin: 0;
          padding: 15px 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          color: #2c3e50;
        }

        .move-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .move-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 20px;
          cursor: pointer;
          transition: background-color 0.2s;
          border-bottom: 1px solid #f8f9fa;
        }

        .move-item:hover {
          background-color: #f8f9fa;
        }

        .move-item.current {
          background-color: #e3f2fd;
          border-left: 4px solid #2196f3;
        }

        .move-item.blunder {
          border-left: 4px solid #dc3545;
        }

        .move-item.mistake {
          border-left: 4px solid #fd7e14;
        }

        .move-item.inaccuracy {
          border-left: 4px solid #ffc107;
        }

        .move-item.excellent {
          border-left: 4px solid #28a745;
        }

        .move-number {
          font-weight: bold;
          color: #6c757d;
          min-width: 35px;
          font-size: 0.9em;
        }

        .move-notation {
          font-weight: bold;
          color: #2c3e50;
          min-width: 60px;
        }

        .move-evaluation {
          font-family: 'Courier New', monospace;
          font-size: 0.8em;
          background: #e9ecef;
          padding: 2px 6px;
          border-radius: 3px;
          color: #495057;
        }

        .mistake-indicator {
          font-size: 1em;
          margin-left: auto;
        }

        /* Analysis Actions */
        .analysis-actions {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .re-analyze-button,
        .delete-analysis-button {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9em;
          transition: background 0.2s;
        }

        .re-analyze-button {
          background: #6c757d;
          color: white;
        }

        .re-analyze-button:hover {
          background: #5a6268;
        }

        .delete-analysis-button {
          background: #dc3545;
          color: white;
        }

        .delete-analysis-button:hover {
          background: #c82333;
        }

        /* Original Analysis Section (for no analysis state) */
        .analysis-section {
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .section-header h2 {
          margin: 0;
          color: #2c3e50;
        }

        .no-analysis {
          text-align: center;
          padding: 40px 20px;
        }

        .no-analysis h3 {
          color: #2c3e50;
          margin-bottom: 10px;
        }

        .no-analysis p {
          color: #6c757d;
          margin-bottom: 30px;
        }

        .analysis-options {
          max-width: 600px;
          margin: 0 auto;
          text-align: left;
        }

        .analysis-options h4 {
          margin-bottom: 20px;
          color: #2c3e50;
        }

        .options-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .option {
          display: flex;
          flex-direction: column;
        }

        .option label {
          margin-bottom: 5px;
          font-weight: 500;
          color: #495057;
        }

        .option select {
          padding: 8px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 1em;
        }

        .option select:disabled {
          background: #e9ecef;
          color: #6c757d;
        }

        .start-analysis-button {
          background: #007bff;
          color: white;
          border: none;
          padding: 12px 30px;
          border-radius: 8px;
          font-size: 1.1em;
          cursor: pointer;
          transition: background 0.2s;
        }

        .start-analysis-button:hover:not(:disabled) {
          background: #0056b3;
        }

        .start-analysis-button:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .analysis-progress {
          margin-top: 30px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .analysis-progress h4 {
          margin: 0 0 15px 0;
          color: #2c3e50;
        }

        .progress-bar {
          width: 100%;
          height: 20px;
          background: #e9ecef;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 10px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #007bff, #0056b3);
          transition: width 0.3s ease;
        }

        .progress-text {
          text-align: center;
          color: #495057;
          font-weight: 500;
        }

        .loading,
        .error {
          text-align: center;
          padding: 40px;
        }

        .error h2 {
          color: #dc3545;
          margin-bottom: 10px;
        }

        /* Responsive Design */
        @media (max-width: 1200px) {
          .analysis-view {
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
          .game-analysis-page {
            padding: 10px;
          }

          .board-controls {
            flex-wrap: wrap;
            gap: 8px;
          }

          .nav-button {
            padding: 6px 10px;
            font-size: 1em;
          }

          .board-options {
            flex-direction: column;
            gap: 10px;
          }

          .summary-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .options-grid {
            grid-template-columns: 1fr;
          }

          .analysis-actions {
            flex-direction: column;
          }
        }

        @media (max-width: 500px) {
          .move-item {
            padding: 6px 15px;
            font-size: 0.9em;
          }

          .move-number {
            min-width: 30px;
          }

          .move-notation {
            min-width: 50px;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default GameAnalysisPage;
