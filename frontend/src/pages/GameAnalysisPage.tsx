// frontend/src/pages/GameAnalysisPage.tsx
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
import "./GameAnalysisPage.css";

const GameAnalysisPage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();

  // ==================== STATE ====================
  // Game data
  const [game, setGame] = useState<Game | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);

  // Analysis state
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [hasExistingAnalysis, setHasExistingAnalysis] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Board state
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [showBestMoveArrow, setShowBestMoveArrow] = useState(true);
  const [boardWidth, setBoardWidth] = useState<number>(400);

  // Analysis options
  const [analysisOptions, setAnalysisOptions] = useState({
    depth: 15,
    skipOpeningMoves: 6,
    maxPositions: 30,
  });

  // ==================== COMPUTED VALUES ====================
  // Parse game moves and positions
  const gameData = useMemo(() => {
    if (!game?.pgn) return null;

    try {
      const chess = new Chess();
      chess.loadPgn(game.pgn);

      const moveHistory = chess.history({ verbose: true });
      const positions: string[] = ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"];

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

  // ==================== CUSTOM HOOKS ====================
  // Chess navigation
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

  // Keyboard shortcuts
  useKeyboardShortcuts({
    ArrowLeft: goToPrevious,
    ArrowRight: goToNext,
    Home: goToStart,
    End: goToEnd,
  });

  // ==================== DERIVED STATE ====================
  // Current position FEN
  const currentPosition = useMemo(() => {
    if (!gameData) return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    return gameData.positions[currentMoveIndex] || gameData.positions[0];
  }, [gameData, currentMoveIndex]);

  // Current move analysis
  const currentMoveAnalysis = useMemo(() => {
    if (!analysis?.analysisDetails || currentMoveIndex === 0) return null;
    return analysis.analysisDetails.find((detail) => detail.moveNumber === currentMoveIndex) || null;
  }, [analysis?.analysisDetails, currentMoveIndex]);

  // Move arrows for best moves
  const moveArrows = useMemo(() => {
    if (!showBestMoveArrow || !currentMoveAnalysis?.bestMove) return [];

    try {
      const move = currentMoveAnalysis.bestMove;
      if (move.length >= 4) {
        const fromSquare = move.substring(0, 2) as Square;
        const toSquare = move.substring(2, 4) as Square;

        const isValidSquare = (square: string): square is Square => /^[a-h][1-8]$/.test(square);

        if (isValidSquare(fromSquare) && isValidSquare(toSquare)) {
          return [[fromSquare, toSquare, "rgb(40, 167, 69)"]];
        }
      }
    } catch (error) {
      console.warn("Error creating move arrow:", error);
    }

    return [];
  }, [showBestMoveArrow, currentMoveAnalysis?.bestMove]);

  // ==================== EFFECTS ====================
  // Set board orientation based on game
  useEffect(() => {
    if (game && gameData) {
      setBoardOrientation("white"); // Default to white for now
    }
  }, [game, gameData]);

  // Calculate responsive board width
  useEffect(() => {
    const calculateBoardWidth = () => {
      const container = document.querySelector(".board-container");
      if (container) {
        const containerWidth = container.clientWidth;
        const calculatedWidth = Math.min(containerWidth - 40, 500);
        setBoardWidth(Math.max(calculatedWidth, 280));
      }
    };

    calculateBoardWidth();
    window.addEventListener("resize", calculateBoardWidth);
    return () => window.removeEventListener("resize", calculateBoardWidth);
  }, []);

  // Initial data load
  useEffect(() => {
    loadInitialData();
  }, [gameId]);

  // ==================== DATA LOADING ====================
  const loadInitialData = useCallback(async () => {
    if (!gameId) {
      setError("No game ID provided");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [gameData, engineData, statusData] = await Promise.all([
        getGame(gameId),
        getEngineStatus(),
        getAnalysisStatus(gameId),
      ]);

      setGame(gameData);
      setEngineStatus(engineData);
      setHasExistingAnalysis(statusData.hasExistingAnalysis);

      if (statusData.hasExistingAnalysis) {
        const existingAnalysis = await getGameAnalysis(gameId);
        const standardizedAnalysis = convertToGameAnalysis(existingAnalysis, gameId);
        setAnalysis(standardizedAnalysis);
        setAnalysisResult(calculateAnalysisResult(standardizedAnalysis));
      }
    } catch (err) {
      console.error("Error loading initial data:", err);
      setError(err instanceof Error ? err.message : "Failed to load game data");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  const updateAnalysisData = useCallback(async (newAnalysis: GameAnalysis) => {
    try {
      setAnalysis(newAnalysis);
      const result = calculateAnalysisResult(newAnalysis);
      setAnalysisResult(result);
      setHasExistingAnalysis(true);
    } catch (err) {
      console.error("Error updating analysis data:", err);
      setError("Failed to update analysis display");
    }
  }, []);

  // ==================== HANDLERS ====================
  const handleStartAnalysis = async () => {
    if (!gameId || !engineStatus?.engineReady) return;

    try {
      setAnalyzing(true);
      setError(null);
      setSuccess(null);
      setAnalysisProgress(null);

      const result = await startGameAnalysis(gameId, analysisOptions);
      const standardizedAnalysis = convertToGameAnalysis(result.analysis, gameId);
      await updateAnalysisData(standardizedAnalysis);

      const analysisResult = calculateAnalysisResult(standardizedAnalysis);
      setSuccess(
        `Analysis complete! Found ${analysisResult.mistakes.blunders} blunders and ${analysisResult.mistakes.mistakes} mistakes.`
      );
    } catch (err) {
      console.error("Analysis error:", err);
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteAnalysis = async () => {
    if (!gameId || !confirm("Are you sure you want to delete the analysis for this game?")) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      await deleteGameAnalysis(gameId);
      setSuccess("Analysis deleted successfully");

      setAnalysis(null);
      setAnalysisResult(null);
      setHasExistingAnalysis(false);
      goToStart();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete analysis");
    }
  };

  // ==================== RENDER HELPERS ====================
  const renderPageHeader = () => (
    <div className="page-header">
      <h1>Game Analysis</h1>
      <div className="game-info">
        <span className="players">
          {game?.whitePlayer} vs {game?.blackPlayer}
        </span>
        <span className="result">{game?.result}</span>
        <span className="date">{game && new Date(game.playedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );

  const renderEngineStatus = () => (
    <div className="engine-status">
      <h3>🔥 Engine Status</h3>
      {engineStatus ? (
        <div className={`status ${engineStatus.engineReady ? "ready" : "error"}`}>
          <span className="status-indicator">{engineStatus.engineReady ? "✅" : "❌"}</span>
          <span className="status-text">
            {engineStatus.engineReady ? "Stockfish ready for analysis" : "Engine not available"}
          </span>
        </div>
      ) : (
        <div className="status loading">
          <span className="status-indicator">⏳</span>
          <span className="status-text">Checking engine status...</span>
        </div>
      )}
    </div>
  );

  const renderMessages = () => (
    <>
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
    </>
  );

  const renderChessBoard = () => (
    <div className="board-panel">
      <div className="board-container">
        <Chessboard
          position={currentPosition}
          boardOrientation={boardOrientation}
          areArrowsAllowed={true}
          boardWidth={boardWidth}
          customBoardStyle={{
            borderRadius: "8px",
            boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
          }}
        />
      </div>

      <div className="board-controls">
        <button
          onClick={() => setBoardOrientation(boardOrientation === "white" ? "black" : "white")}
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
  );

  const renderMoveNavigation = () => (
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
  );

  const renderCurrentMoveAnalysis = () => {
    if (currentMoveIndex === 0) {
      return (
        <div className="current-move-analysis">
          <h3>Starting Position</h3>
          <p>Navigate through the game to see move-by-move analysis.</p>
        </div>
      );
    }

    if (!currentMoveAnalysis) {
      return (
        <div className="current-move-analysis">
          <h3>Move {currentMoveIndex}</h3>
          <p>No analysis available for this move.</p>
        </div>
      );
    }

    return (
      <div className="current-move-analysis">
        <h3>
          Move {currentMoveAnalysis.moveNumber}: {currentMoveAnalysis.playerMove}
          {currentMoveAnalysis.mistakeSeverity && (
            <span
              className={`mistake-badge ${currentMoveAnalysis.mistakeSeverity}`}
              style={{ color: getMistakeColor(currentMoveAnalysis.mistakeSeverity) }}
            >
              {getMistakeIcon(currentMoveAnalysis.mistakeSeverity)}{" "}
              {currentMoveAnalysis.mistakeSeverity}
            </span>
          )}
        </h3>

        <div className="evaluation-info">
          <p>
            <strong>Evaluation:</strong> {formatEvaluation(currentMoveAnalysis.evaluation)}
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
            <strong>Analysis Depth:</strong> {currentMoveAnalysis.analysisDepth || 15} ply
          </p>
        </div>
      </div>
    );
  };

  const renderAnalysisControls = () => {
    if (!hasExistingAnalysis) {
      return (
        <div className="analysis-controls">
          <div className="start-analysis">
            <h3>🎯 Start Analysis</h3>
            <div className="analysis-options">
              <div className="option-group">
                <label>Analysis Depth:</label>
                <select
                  value={analysisOptions.depth}
                  onChange={(e) =>
                    setAnalysisOptions({ ...analysisOptions, depth: parseInt(e.target.value) })
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
        </div>
      );
    }

    return (
      <div className="analysis-controls">
        <div className="existing-analysis">
          <h3>✅ Analysis Complete</h3>
          <button onClick={handleDeleteAnalysis} className="delete-analysis-btn">
            🗑️ Delete Analysis
          </button>
        </div>
      </div>
    );
  };

  const renderAnalysisProgress = () => {
    if (!analysisProgress) return null;

    return (
      <div className="analysis-progress">
        <h3>Analysis Progress</h3>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${analysisProgress.percentage}%` }} />
        </div>
        <p>{analysisProgress.message}</p>
      </div>
    );
  };

  const renderAnalysisSummary = () => {
    if (!analysisResult) return null;

    return (
      <div className="analysis-summary">
        <h3>📊 Analysis Summary</h3>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="label">Total Positions:</span>
            <span className="value">{analysisResult.totalPositions}</span>
          </div>
          <div className="summary-item">
            <span className="label">Average Depth:</span>
            <span className="value">{analysisResult.averageDepth.toFixed(1)} ply</span>
          </div>
          <div className="summary-item">
            <span className="label">White Accuracy:</span>
            <span className="value">{analysisResult.accuracy.white.toFixed(1)}%</span>
          </div>
          <div className="summary-item">
            <span className="label">Black Accuracy:</span>
            <span className="value">{analysisResult.accuracy.black.toFixed(1)}%</span>
          </div>
          <div className="summary-item">
            <span className="label">Blunders:</span>
            <span className="value error">{analysisResult.mistakes.blunders}</span>
          </div>
          <div className="summary-item">
            <span className="label">Mistakes:</span>
            <span className="value warning">{analysisResult.mistakes.mistakes}</span>
          </div>
          <div className="summary-item">
            <span className="label">Inaccuracies:</span>
            <span className="value info">{analysisResult.mistakes.inaccuracies}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderMovesList = () => {
    if (!gameData || !analysis) return null;

    return (
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
                className={`move-item ${currentMoveIndex === moveNumber ? "active" : ""} ${
                  moveAnalysis?.mistakeSeverity || ""
                }`}
                onClick={() => goToMove(moveNumber)}
              >
                <div className="move-number">{moveNumber}.</div>
                <div className="move-notation">{move.san}</div>
                {moveAnalysis && (
                  <div className="move-evaluation">
                    <span className="evaluation">{formatEvaluation(moveAnalysis.evaluation)}</span>
                    {moveAnalysis.mistakeSeverity && (
                      <span
                        className={`mistake-indicator ${moveAnalysis.mistakeSeverity}`}
                        style={{ color: getMistakeColor(moveAnalysis.mistakeSeverity) }}
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
    );
  };

  // ==================== LOADING & ERROR STATES ====================
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

  // ==================== MAIN RENDER ====================
  return (
    <div className="game-analysis-page">
      {renderPageHeader()}
      {renderEngineStatus()}
      {renderMessages()}

      <div className="main-content">
        {renderChessBoard()}

        <div className="analysis-panel">
          {renderMoveNavigation()}
          {renderCurrentMoveAnalysis()}
          {renderAnalysisControls()}
          {renderAnalysisProgress()}
          {renderAnalysisSummary()}
        </div>
      </div>

      {renderMovesList()}
    </div>
  );
};

export default GameAnalysisPage;
