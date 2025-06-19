/* eslint-disable @typescript-eslint/no-explicit-any */
// frontend/src/pages/GameAnalysisPage.tsx - Refactored with UI Components
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Chess } from "chess.js";
import { getGame } from "../services/api";
import {
  getEngineStatus,
  startGameAnalysis,
  getGameAnalysis,
  getAnalysisStatus,
  deleteGameAnalysis,
} from "../services/analysisApi";
import { VariationExplorer } from "../components/VariationExplorer";
import type { Game } from "../types/api";
import type { AnalysisProgress, EngineStatus } from "../services/analysisApi";
import { useLiveAnalysis } from "../hook/useLiveAnalysis";

// Import UI Components
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import Modal from "../components/ui/Modal";
import ProgressBar from "../components/ui/ProgressBar";

// Import Analysis Components

import EngineStatusPanel from "../components/analysis/EngineStatusPanel/EngineStatusPanel";
import LiveAnalysisControls from "../components/analysis/LiveAnalysisControls/LiveAnalysisControls";
import AnalysisSummary from "../components/analysis/AnalysisSummary/AnalysisSummary";
import MoveList from "../components/analysis/MoveList/MoveList";
import CurrentMoveInfo from "../components/analysis/CurrentMoveInfo/CurrentMoveInfo";
import AnalysisActions from "../components/analysis/AnalysisActions/AnalysisActions";
import BoardSection from "../components/analysis/BoardSection/BoardSection";

import "./GameAnalysisPage.css";

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

// Analysis Mode constants
const AnalysisMode = {
  GAME_ANALYSIS: "game",
  VARIATION_EXPLORER: "explorer",
} as const;

type AnalysisMode = (typeof AnalysisMode)[keyof typeof AnalysisMode];

const GameAnalysisPage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();

  const [game, setGame] = useState<Game | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);

  // Analysis state
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );

  // Live analysis integration
  const [liveAnalysisState, liveAnalysisActions] = useLiveAnalysis();
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(
    AnalysisMode.GAME_ANALYSIS
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
  const [autoAnalyzeEnabled, setAutoAnalyzeEnabled] = useState(true);

  // Analysis options
  const [analysisOptions, setAnalysisOptions] = useState({
    depth: 15,
    skipOpeningMoves: 6,
    maxPositions: 30,
  });

  // Modal states
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

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

    return (
      analysis.analysisDetails.find(
        (detail) => detail.moveNumber === currentMoveIndex
      ) || null
    );
  }, [analysis?.analysisDetails, currentMoveIndex]);

  // Auto-analyze current position when it changes
  useEffect(() => {
    if (
      autoAnalyzeEnabled &&
      analysisMode === AnalysisMode.GAME_ANALYSIS &&
      liveAnalysisState.isConnected &&
      !liveAnalysisState.isAnalyzing &&
      currentPosition &&
      liveAnalysisState.lastAnalyzedFen !== currentPosition
    ) {
      console.log(
        `🔄 Auto-analyzing new position: ${currentPosition.substring(0, 30)}...`
      );
      liveAnalysisActions
        .analyzePosition(currentPosition, {
          depth: liveAnalysisState.settings.depth,
          timeLimit: liveAnalysisState.settings.timeLimit,
        })
        .catch((error: Error) => {
          console.error("Auto-analysis failed:", error);
        });
    }
  }, [
    currentPosition,
    autoAnalyzeEnabled,
    analysisMode,
    liveAnalysisState.isConnected,
    liveAnalysisState.isAnalyzing,
    liveAnalysisState.lastAnalyzedFen,
    liveAnalysisActions,
    liveAnalysisState.settings,
  ]);

  // Initialize live analysis session when component mounts
  useEffect(() => {
    if (!liveAnalysisState.sessionId) {
      console.log("🚀 Initializing live analysis session");
      liveAnalysisActions.createSession().catch((error: Error) => {
        console.error("Failed to create live analysis session:", error);
      });
    }

    // Cleanup on unmount
    return () => {
      if (liveAnalysisState.sessionId) {
        liveAnalysisActions.closeSession().catch((error: Error) => {
          console.error("Failed to close live analysis session:", error);
        });
      }
    };
  }, []);

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
    if (!gameId) return;
    loadGameAndStatus();
  }, [gameId, loadGameAndStatus]);

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
    if (!gameId) return;

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

  // Handle live analysis settings update
  const handleLiveAnalysisUpdate = async (
    newSettings: Partial<typeof liveAnalysisState.settings>
  ) => {
    if (liveAnalysisState.isConnected) {
      try {
        await liveAnalysisActions.updateSettings(newSettings);
      } catch (error) {
        console.error("Failed to update live analysis settings:", error);
      }
    }
  };

  // Handle manual analysis trigger
  const handleAnalyzeNow = async () => {
    if (liveAnalysisState.isConnected) {
      try {
        await liveAnalysisActions.analyzePosition(currentPosition, {
          depth: liveAnalysisState.settings.depth,
          timeLimit: liveAnalysisState.settings.timeLimit,
        });
      } catch (error) {
        console.error("Manual analysis failed:", error);
      }
    }
  };

  // Toggle between analysis modes
  const handleModeSwitch = (newMode: AnalysisMode) => {
    setAnalysisMode(newMode);

    if (newMode === AnalysisMode.VARIATION_EXPLORER) {
      console.log("🧪 Switching to variation explorer mode");
    } else {
      console.log("📊 Switching to game analysis mode");
    }
  };

  // Get current position for variation explorer
  const getCurrentPositionForExploration = useCallback(() => {
    return currentPosition;
  }, [currentPosition]);

  // Prepare game line data for variation explorer
  const gameLineForExplorer = useMemo(() => {
    if (!analysis?.analysisDetails || !gameData?.moves) return [];

    return analysis.analysisDetails.map((detail) => ({
      moveNumber: detail.moveNumber,
      move: gameData.moves[detail.moveNumber - 1]?.san || "",
      fen: detail.positionFen || "",
      evaluation: detail.evaluation,
    }));
  }, [analysis?.analysisDetails, gameData?.moves]);

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
        <Alert variant="error" title="Error">
          {error}
        </Alert>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="game-analysis-page">
        <Alert variant="error">Game not found</Alert>
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

      {/* Analysis Mode Selector */}
      <div className="analysis-mode-selector">
        <Button
          variant={
            analysisMode === AnalysisMode.GAME_ANALYSIS ? "primary" : "outline"
          }
          onClick={() => handleModeSwitch(AnalysisMode.GAME_ANALYSIS)}
        >
          📊 Game Analysis
        </Button>
        <Button
          variant={
            analysisMode === AnalysisMode.VARIATION_EXPLORER
              ? "primary"
              : "outline"
          }
          onClick={() => handleModeSwitch(AnalysisMode.VARIATION_EXPLORER)}
          disabled={!hasExistingAnalysis}
        >
          🧪 Variation Explorer
        </Button>
      </div>

      {/* Engine Status */}
      <EngineStatusPanel
        engineStatus={engineStatus}
        liveAnalysisState={liveAnalysisState}
      />

      {/* Alerts */}
      {error && (
        <Alert variant="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" dismissible onDismiss={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {liveAnalysisState.error && (
        <Alert
          variant="warning"
          dismissible
          onDismiss={liveAnalysisActions.clearError}
        >
          <strong>Live Analysis Error:</strong> {liveAnalysisState.error}
        </Alert>
      )}

      {/* Main Content */}
      {analysisMode === AnalysisMode.VARIATION_EXPLORER ? (
        // Variation Explorer Mode
        <VariationExplorer
          initialFen={getCurrentPositionForExploration()}
          gameLine={gameLineForExplorer}
          onReturnToGame={() => handleModeSwitch(AnalysisMode.GAME_ANALYSIS)}
        />
      ) : hasExistingAnalysis && gameData ? (
        <div className="analysis-view">
          {/* Chess Board and Navigation */}
          <div className="board-column">
            <BoardSection
              position={currentPosition}
              orientation={boardOrientation}
              currentMoveIndex={currentMoveIndex}
              totalMoves={gameData.totalMoves}
              onGoToStart={goToStart}
              onGoToPrevious={goToPrevious}
              onGoToNext={goToNext}
              onGoToEnd={goToEnd}
              onFlipBoard={() =>
                setBoardOrientation(
                  boardOrientation === "white" ? "black" : "white"
                )
              }
              showBestMoveArrow={showBestMoveArrow}
              onToggleBestMoveArrow={setShowBestMoveArrow}
              autoAnalyzeEnabled={autoAnalyzeEnabled}
              onToggleAutoAnalyze={setAutoAnalyzeEnabled}
              boardWidth={450}
            />

            <CurrentMoveInfo
              currentMoveIndex={currentMoveIndex}
              moveNotation={
                currentMoveIndex > 0 && gameData.moves[currentMoveIndex - 1]
                  ? gameData.moves[currentMoveIndex - 1].san
                  : undefined
              }
              cachedAnalysis={currentMoveAnalysis || undefined}
              liveAnalysisResult={liveAnalysisState.currentResult || undefined}
              isAnalyzing={liveAnalysisState.isAnalyzing}
            />
          </div>

          {/* Analysis Panel */}
          <div className="analysis-column">
            <LiveAnalysisControls
              settings={liveAnalysisState.settings}
              isConnected={liveAnalysisState.isConnected}
              isAnalyzing={liveAnalysisState.isAnalyzing}
              onUpdateSettings={handleLiveAnalysisUpdate}
              onAnalyzeNow={handleAnalyzeNow}
            />

            {analysisResult && (
              <AnalysisSummary analysisResult={analysisResult} />
            )}

            <MoveList
              moves={gameData.moves}
              analysisDetails={analysis?.analysisDetails || []}
              currentMoveIndex={currentMoveIndex}
              totalMoves={gameData.totalMoves}
              onMoveClick={goToMove}
            />

            <AnalysisActions
              hasAnalysis={!!analysis}
              isAnalyzing={analyzing}
              onStartNewAnalysis={() => setShowAnalysisModal(true)}
              onDeleteAnalysis={handleDeleteAnalysis}
              onOpenVariationExplorer={() =>
                handleModeSwitch(AnalysisMode.VARIATION_EXPLORER)
              }
              variationExplorerAvailable={hasExistingAnalysis}
            />
          </div>
        </div>
      ) : (
        // No analysis yet - show analysis form
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
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleStartAnalysis}
                  disabled={analyzing || !engineStatus?.engineReady}
                  loading={analyzing}
                >
                  Start Analysis
                </Button>
              </div>
            </div>

            {/* Analysis Progress */}
            {analyzing && analysisProgress && (
              <div className="analysis-progress">
                <h4>Analysis Progress</h4>
                <ProgressBar
                  value={analysisProgress.percentage}
                  label={analysisProgress.message}
                  showPercentage
                  animated
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Analysis Confirmation Modal */}
      <Modal
        isOpen={showAnalysisModal}
        onClose={() => setShowAnalysisModal(false)}
        title="Start New Analysis"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowAnalysisModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setShowAnalysisModal(false);
                setHasExistingAnalysis(false);
                setAnalysis(null);
                setAnalysisResult(null);
              }}
            >
              Continue
            </Button>
          </>
        }
      >
        <Alert variant="info" hideIcon>
          This will start a new analysis. You can configure the analysis options
          on the next screen.
        </Alert>
      </Modal>

      
    </div>
  );
};

export default GameAnalysisPage;
