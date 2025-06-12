/* eslint-disable @typescript-eslint/no-explicit-any */
// frontend/src/pages/GameAnalysisPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
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

  // Simplified: Only use GameAnalysis structure
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

      {/* Analysis Section */}
      <div className="analysis-section">
        <div className="section-header">
          <h2>Chess Engine Analysis</h2>
          {hasExistingAnalysis && (
            <button
              onClick={handleDeleteAnalysis}
              className="delete-analysis-button"
            >
              Delete Analysis
            </button>
          )}
        </div>

        {!hasExistingAnalysis ? (
          // No analysis yet - show analysis form
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
        ) : (
          // Analysis exists - show results
          <div className="analysis-results">
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

                  <div className="summary-item">
                    <span className="summary-label">Average Depth:</span>
                    <span className="summary-value">
                      {Math.round(analysisResult.averageDepth)}
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

            {/* Analysis Details */}
            <div className="analysis-details">
              <h3>Move-by-Move Analysis</h3>

              {!analysis || analysis.analysisDetails.length === 0 ? (
                <div className="no-moves">No analysis data available</div>
              ) : (
                <div className="moves-list">
                  {analysis.analysisDetails.map((move) => (
                    <div
                      key={`${move.moveNumber}-${move.playerMove}`}
                      className={`move-item ${
                        move.mistakeSeverity || "normal"
                      }`}
                    >
                      <div className="move-header">
                        <span className="move-number">{move.moveNumber}.</span>
                        <span className="move-notation">{move.playerMove}</span>
                        <span className="move-evaluation">
                          {formatEvaluation(move.evaluation)}
                        </span>
                        {move.mistakeSeverity && (
                          <span
                            className="mistake-badge"
                            style={{
                              backgroundColor: getMistakeColor(
                                move.mistakeSeverity
                              ),
                            }}
                          >
                            {getMistakeIcon(move.mistakeSeverity)}{" "}
                            {move.mistakeSeverity}
                          </span>
                        )}
                      </div>

                      <div className="move-details">
                        <div className="detail-item">
                          <span className="detail-label">Best Move:</span>
                          <span className="detail-value">{move.bestMove}</span>
                        </div>

                        {move.bestLine && (
                          <div className="detail-item">
                            <span className="detail-label">Best Line:</span>
                            <span className="detail-value best-line">
                              {move.bestLine}
                            </span>
                          </div>
                        )}

                        <div className="detail-item">
                          <span className="detail-label">Depth:</span>
                          <span className="detail-value">
                            {move.analysisDepth || 15}
                          </span>
                        </div>

                        {move.positionFen && (
                          <div className="detail-item">
                            <span className="detail-label">Position:</span>
                            <span className="detail-value position-fen">
                              {move.positionFen.split(" ")[0]}...
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Re-analyze Button */}
            <div className="re-analyze">
              <h4>Want to analyze again with different settings?</h4>
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
            </div>
          </div>
        )}
      </div>

      <style>
        {`
        .game-analysis-page {
          max-width: 1200px;
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

        .delete-analysis-button {
          background: #dc3545;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9em;
        }

        .delete-analysis-button:hover {
          background: #c82333;
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

        .analysis-actions {
          text-align: center;
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

        .analysis-summary {
          margin-bottom: 30px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .analysis-summary h3 {
          margin: 0 0 20px 0;
          color: #2c3e50;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
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
          font-weight: 500;
          color: #495057;
        }

        .summary-value {
          font-weight: bold;
          color: #2c3e50;
          font-size: 1.1em;
        }

        .analysis-details h3 {
          margin: 0 0 20px 0;
          color: #2c3e50;
        }

        .no-moves {
          text-align: center;
          padding: 40px;
          color: #6c757d;
        }

        .moves-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .move-item {
          padding: 15px;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          transition: box-shadow 0.2s;
        }

        .move-item:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

        .move-header {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }

        .move-number {
          font-weight: bold;
          color: #6c757d;
          min-width: 30px;
        }

        .move-notation {
          font-weight: bold;
          font-size: 1.1em;
          color: #2c3e50;
        }

        .move-evaluation {
          font-family: 'Courier New', monospace;
          font-weight: bold;
          background: #e9ecef;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .mistake-badge {
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.8em;
          font-weight: bold;
          text-transform: uppercase;
        }

        .move-details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 10px;
        }

        .detail-item {
          display: flex;
          gap: 10px;
        }

        .detail-label {
          font-weight: 500;
          color: #6c757d;
          min-width: 80px;
        }

        .detail-value {
          color: #2c3e50;
        }

        .best-line {
          font-family: 'Courier New', monospace;
          font-size: 0.9em;
        }

        .re-analyze {
          margin-top: 30px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
          text-align: center;
        }

        .re-analyze h4 {
          margin: 0 0 15px 0;
          color: #2c3e50;
        }

        .re-analyze-button {
          background: #6c757d;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
        }

        .re-analyze-button:hover {
          background: #5a6268;
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

        @media (max-width: 768px) {
          .game-analysis-page {
            padding: 10px;
          }

          .options-grid,
          .summary-grid {
            grid-template-columns: 1fr;
          }

          .move-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }

          .move-details {
            grid-template-columns: 1fr;
          }
        }
      `}
      </style>
    </div>
  );
};
export default GameAnalysisPage;
