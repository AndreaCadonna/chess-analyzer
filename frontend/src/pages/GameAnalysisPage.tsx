/* eslint-disable @typescript-eslint/no-explicit-any */
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
      console.warn("Error creating move arrow:", error);
    }

    return [];
  }, [showBestMoveArrow, currentMoveAnalysis?.bestMove]);

  // Move navigation functions
  const goToStart = useCallback(() => {
    setCurrentMoveIndex(0);
  }, []);

  const goToPrevious = useCallback(() => {
    setCurrentMoveIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentMoveIndex((prev) => {
      if (!gameData) return prev;
      return Math.min(gameData.totalMoves, prev + 1);
    });
  }, [gameData]);

  const goToEnd = useCallback(() => {
    if (!gameData) return;
    setCurrentMoveIndex(gameData.totalMoves);
  }, [gameData]);

  const goToMove = useCallback((moveIndex: number) => {
    setCurrentMoveIndex(moveIndex);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;

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

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [goToPrevious, goToNext, goToStart, goToEnd]);

  // Set board orientation based on game
  useEffect(() => {
    if (game && gameData) {
      // Determine if user was playing white or black
      setBoardOrientation("white"); // Default to white for now
    }
  }, [game, gameData]);

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
              boardWidth={400}
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
              <button onClick={goToStart} disabled={currentMoveIndex === 0}>
                ⏪ Start
              </button>
              <button onClick={goToPrevious} disabled={currentMoveIndex === 0}>
                ⬅️ Previous
              </button>
              <button
                onClick={goToNext}
                disabled={!gameData || currentMoveIndex >= gameData.totalMoves}
              >
                Next ➡️
              </button>
              <button
                onClick={goToEnd}
                disabled={!gameData || currentMoveIndex >= gameData.totalMoves}
              >
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
