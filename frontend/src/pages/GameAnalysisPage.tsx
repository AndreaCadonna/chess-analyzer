// frontend/src/pages/GameAnalysisPage.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import type { Square } from "react-chessboard/dist/chessboard/types";
import { Chess } from "chess.js";
import { getGame } from "../services/api";
import {
  getEngineStatus,
  getGameAnalysis,
  getAnalysisStatus,
  deleteGameAnalysis,
  startGameAnalysisStream,
} from "../services/analysisApi";
import type { StreamProgress } from "../services/analysisApi";
import type { Game } from "../types/api";
import type { EngineStatus } from "../services/analysisApi";
import {
  convertToGameAnalysis,
  calculateAnalysisResult,
  type GameAnalysis,
  type AnalysisResult,
} from "../utils";
import { useChessNavigation, useKeyboardShortcuts } from "../hooks";
import BoardSection from "../components/analysis/BoardSection/BoardSection";
import MoveList from "../components/analysis/MoveList/MoveList";
import CurrentMoveInfo from "../components/analysis/CurrentMoveInfo/CurrentMoveInfo";
import AnalysisSummary from "../components/analysis/AnalysisSummary/AnalysisSummary";
import AnalysisActions from "../components/analysis/AnalysisActions/AnalysisActions";
import EvaluationBar from "../components/analysis/EvaluationBar/EvaluationBar";
import Alert from "../components/ui/Alert";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import ProgressBar from "../components/ui/ProgressBar/ProgressBar";
import "./GameAnalysisPage.css";

const GameAnalysisPage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();

  // Game data
  const [game, setGame] = useState<Game | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);

  // Analysis state
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [hasExistingAnalysis, setHasExistingAnalysis] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Streaming progress
  const [analysisProgress, setAnalysisProgress] = useState<StreamProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Board state
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [showBestMoveArrow, setShowBestMoveArrow] = useState(true);
  const [autoAnalyze, setAutoAnalyze] = useState(false);

  // Analysis options
  const [analysisOptions, setAnalysisOptions] = useState({
    depth: 15,
  });

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
      return { moves: moveHistory, positions, totalMoves: moveHistory.length };
    } catch (err) {
      console.error("Error parsing PGN:", err);
      return null;
    }
  }, [game?.pgn]);

  // Chess navigation
  const {
    currentMoveIndex, goToStart, goToPrevious, goToNext, goToEnd, goToMove,
  } = useChessNavigation({ totalMoves: gameData?.totalMoves || 0 });

  useKeyboardShortcuts({
    ArrowLeft: goToPrevious,
    ArrowRight: goToNext,
    Home: goToStart,
    End: goToEnd,
  });

  // Current position FEN
  const currentPosition = useMemo(() => {
    if (!gameData) return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    return gameData.positions[currentMoveIndex] || gameData.positions[0];
  }, [gameData, currentMoveIndex]);

  // Current move analysis (severity, centipawn loss — describes the move itself)
  const currentMoveAnalysis = useMemo(() => {
    if (!analysis?.analysisDetails || currentMoveIndex === 0) return null;
    return analysis.analysisDetails.find((d) => d.moveNumber === currentMoveIndex) || null;
  }, [analysis?.analysisDetails, currentMoveIndex]);

  // Eval of the position currently displayed on the board.
  // The board shows position AFTER move N. That position is evaluated
  // as part of moveNumber=N+1's analysis (position BEFORE move N+1 = AFTER move N).
  const currentPositionAnalysis = useMemo(() => {
    if (!analysis?.analysisDetails) return null;
    return analysis.analysisDetails.find(
      (d) => d.moveNumber === currentMoveIndex + 1
    ) || null;
  }, [analysis?.analysisDetails, currentMoveIndex]);

  // Current move notation
  const currentMoveNotation = useMemo(() => {
    if (!gameData || currentMoveIndex === 0) return undefined;
    return gameData.moves[currentMoveIndex - 1]?.san;
  }, [gameData, currentMoveIndex]);

  // Move arrows for best moves (use position analysis so arrow matches displayed board)
  const moveArrows = useMemo(() => {
    if (!showBestMoveArrow || !currentPositionAnalysis?.bestMove) return [];
    try {
      const move = currentPositionAnalysis.bestMove;
      if (move.length >= 4) {
        const from = move.substring(0, 2) as Square;
        const to = move.substring(2, 4) as Square;
        const isValid = (s: string): s is Square => /^[a-h][1-8]$/.test(s);
        if (isValid(from) && isValid(to)) return [[from, to, "rgb(40, 167, 69)"]];
      }
    } catch (err) {
      console.warn("Error creating move arrow:", err);
    }
    return [];
  }, [showBestMoveArrow, currentPositionAnalysis?.bestMove]);

  useEffect(() => {
    if (game && gameData) setBoardOrientation("white");
  }, [game, gameData]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadInitialData(); }, [gameId]);

  const loadInitialData = useCallback(async () => {
    if (!gameId) { setError("No game ID provided"); setLoading(false); return; }
    try {
      setLoading(true);
      setError(null);
      const [gameData, engineData, statusData] = await Promise.all([
        getGame(gameId), getEngineStatus(), getAnalysisStatus(gameId),
      ]);
      setGame(gameData);
      setEngineStatus(engineData);
      setHasExistingAnalysis(statusData.hasExistingAnalysis);
      if (statusData.hasExistingAnalysis) {
        const existing = await getGameAnalysis(gameId);
        const standardized = convertToGameAnalysis(existing, gameId);
        setAnalysis(standardized);
        setAnalysisResult(calculateAnalysisResult(standardized));
      }
    } catch (err) {
      console.error("Error loading initial data:", err);
      setError(err instanceof Error ? err.message : "Failed to load game data");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  const handleStartAnalysis = () => {
    if (!gameId || !engineStatus?.engineReady) return;

    setAnalyzing(true);
    setError(null);
    setSuccess(null);
    setAnalysisProgress(null);

    const controller = startGameAnalysisStream(gameId, analysisOptions, {
      onProgress: (progress) => {
        setAnalysisProgress(progress);
      },
      onComplete: (result) => {
        const standardized = convertToGameAnalysis(result, gameId);
        setAnalysis(standardized);
        const calcResult = calculateAnalysisResult(standardized);
        setAnalysisResult(calcResult);
        setHasExistingAnalysis(true);
        setSuccess(
          `Analysis complete! Found ${calcResult.mistakes.blunders} blunders and ${calcResult.mistakes.mistakes} mistakes.`
        );
        setAnalyzing(false);
        setAnalysisProgress(null);
        abortControllerRef.current = null;
      },
      onError: (message) => {
        setError(message);
        setAnalyzing(false);
        setAnalysisProgress(null);
        abortControllerRef.current = null;
      },
    });

    abortControllerRef.current = controller;
  };

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleDeleteAnalysis = async () => {
    if (!gameId || !confirm("Are you sure you want to delete the analysis for this game?")) return;
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

  // Loading states
  if (loading) {
    return (
      <div className="game-analysis-page">
        <LoadingSpinner message="Loading game analysis..." centered />
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="game-analysis-page">
        <Alert variant="error" title="Error">{error}</Alert>
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
      {/* Page Header */}
      <div className="page-header">
        <h1>Game Analysis</h1>
        <div className="game-info">
          <span className="players">{game.whitePlayer} vs {game.blackPlayer}</span>
          <span className="result">{game.result}</span>
          <span className="date">{new Date(game.playedAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Engine Status */}
      <div className="engine-status">
        <div className={`status ${engineStatus?.engineReady ? "ready" : "error"}`}>
          <span className="status-indicator">{engineStatus?.engineReady ? "✅" : engineStatus ? "❌" : "⏳"}</span>
          <span className="status-text">
            {engineStatus?.engineReady ? "Stockfish ready" : engineStatus ? "Engine not available" : "Checking engine..."}
          </span>
        </div>
      </div>

      {/* Messages */}
      {error && <Alert variant="error" dismissible onDismiss={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onDismiss={() => setSuccess(null)}>{success}</Alert>}

      <div className="analysis-layout">
        {/* Evaluation bar + Board with navigation */}
        <div className="board-with-eval">
          <EvaluationBar evaluation={currentPositionAnalysis?.evaluation ?? null} />
          <BoardSection
          position={currentPosition}
          orientation={boardOrientation}
          moveArrows={moveArrows}
          currentMoveIndex={currentMoveIndex}
          totalMoves={gameData?.totalMoves || 0}
          onGoToStart={goToStart}
          onGoToPrevious={goToPrevious}
          onGoToNext={goToNext}
          onGoToEnd={goToEnd}
          onFlipBoard={() => setBoardOrientation(boardOrientation === "white" ? "black" : "white")}
          showBestMoveArrow={showBestMoveArrow}
          onToggleBestMoveArrow={setShowBestMoveArrow}
          autoAnalyzeEnabled={autoAnalyze}
          onToggleAutoAnalyze={setAutoAnalyze}
        />
        </div>

        {/* Move list alongside board */}
        {gameData && (
          <div className="move-list-panel">
            <MoveList
              moves={gameData.moves}
              analysisDetails={analysis?.analysisDetails}
              currentMoveIndex={currentMoveIndex}
              totalMoves={gameData.totalMoves}
              onMoveClick={goToMove}
              compact
            />
          </div>
        )}

        <div className="analysis-panel">
          {/* Current move info */}
          <CurrentMoveInfo
            currentMoveIndex={currentMoveIndex}
            moveNotation={currentMoveNotation}
            cachedAnalysis={currentMoveAnalysis || undefined}
            isAnalyzing={analyzing}
          />

          {/* Analysis controls: start form or post-analysis actions */}
          {!hasExistingAnalysis ? (
            <div className="analysis-controls">
              <div className="start-analysis">
                <h3>Start Analysis</h3>
                <div className="analysis-options">
                  <div className="option-group">
                    <label>Analysis Depth:</label>
                    <select
                      value={analysisOptions.depth}
                      onChange={(e) => setAnalysisOptions({ ...analysisOptions, depth: parseInt(e.target.value) })}
                    >
                      <option value={10}>10 ply (Fast)</option>
                      <option value={15}>15 ply (Balanced)</option>
                      <option value={20}>20 ply (Deep)</option>
                      <option value={25}>25 ply (Maximum)</option>
                    </select>
                  </div>
                </div>
                {analyzing && analysisProgress ? (
                  <div className="analysis-progress">
                    <ProgressBar
                      value={analysisProgress.current}
                      max={analysisProgress.total}
                      variant="bar"
                      animated
                      striped
                      showPercentage
                      showProgress
                      label={analysisProgress.message}
                    />
                  </div>
                ) : (
                  <button onClick={handleStartAnalysis} disabled={analyzing || !engineStatus?.engineReady} className="start-analysis-btn">
                    {analyzing ? "Starting..." : "Start Analysis"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <AnalysisActions
              hasAnalysis={hasExistingAnalysis}
              isAnalyzing={analyzing}
              onStartNewAnalysis={handleStartAnalysis}
              onDeleteAnalysis={handleDeleteAnalysis}
              analysisProgress={analysisProgress}
            />
          )}

          {/* Analysis summary */}
          {analysisResult && <AnalysisSummary analysisResult={analysisResult} />}
        </div>
      </div>

    </div>
  );
};

export default GameAnalysisPage;
