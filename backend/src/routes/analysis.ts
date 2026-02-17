// backend/src/routes/analysis.ts
import { Router, Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { AnalysisService } from "../services/analysisService";
import { getStockfishService } from "../services/stockfishService";

const router = Router();
const analysisService = new AnalysisService();

// Helper function to safely check engine status
async function getEngineReadiness(): Promise<{
  isReady: boolean;
  error?: string;
  engineType?: string;
  version?: string;
}> {
  try {
    const stockfish = await getStockfishService();

    // Check if the service exists and has the required method
    if (!stockfish) {
      return {
        isReady: false,
        error: "Stockfish service not available",
      };
    }

    // Check if isEngineReady method exists and call it safely
    if (typeof stockfish.isEngineReady === "function") {
      const isReady = stockfish.isEngineReady();
      return {
        isReady,
        engineType: "Stockfish",
        version: "Latest",
        error: isReady ? undefined : "Engine not ready",
      };
    } else {
      // Method doesn't exist - this indicates a service initialization issue
      return {
        isReady: false,
        error: "Engine service not properly initialized",
      };
    }
  } catch (error) {
    console.error("Engine readiness check failed:", error);
    return {
      isReady: false,
      error: error instanceof Error ? error.message : "Unknown engine error",
    };
  }
}

// Start game analysis
router.post(
  "/games/:gameId/analyze",
  asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const { depth, skipOpeningMoves, maxPositions } = req.body;

    if (!gameId) {
      res.status(400).json({
        success: false,
        message: "Game ID is required",
      });
      return;
    }

    // Check engine status before starting analysis
    const engineStatus = await getEngineReadiness();
    if (!engineStatus.isReady) {
      res.status(503).json({
        success: false,
        message: `Cannot start analysis: ${
          engineStatus.error || "Engine not ready"
        }`,
        data: {
          engineReady: false,
          error: engineStatus.error,
        },
      });
      return;
    }

    // Check if already analyzing
    if (analysisService.isAnalyzing(gameId)) {
      res.status(409).json({
        success: false,
        message: "Game analysis already in progress",
      });
      return;
    }

    try {
      console.log(`🚀 Starting analysis for game ${gameId}`);

      // Store progress updates
      const progressUpdates: any[] = [];

      const result = await analysisService.analyzeGame(gameId, {
        depth: depth ? parseInt(depth) : undefined,
        skipOpeningMoves: skipOpeningMoves
          ? parseInt(skipOpeningMoves)
          : undefined,
        maxPositions: maxPositions ? parseInt(maxPositions) : undefined,
        onProgress: (progress) => {
          progressUpdates.push({
            ...progress,
            timestamp: new Date().toISOString(),
          });
        },
      });

      res.json({
        success: true,
        data: {
          analysis: result,
          progress: progressUpdates,
        },
        message: `Analysis completed: ${result.mistakes.blunders} blunders, ${result.mistakes.mistakes} mistakes found`,
      });
    } catch (error) {
      console.error("Analysis error:", error);

      // Check if error is engine-related and provide specific guidance
      let errorMessage =
        error instanceof Error ? error.message : "Analysis failed";
      let statusCode = 500;

      if (
        errorMessage.includes("Stockfish") ||
        errorMessage.includes("engine")
      ) {
        statusCode = 503;
        errorMessage = `Engine error: ${errorMessage}. Please check if Stockfish is properly installed and accessible.`;
      }

      res.status(statusCode).json({
        success: false,
        message: errorMessage,
      });
    }
  })
);

// Start game analysis with SSE streaming progress
router.post(
  "/games/:gameId/analyze/stream",
  asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const { depth, skipOpeningMoves, maxPositions } = req.body;

    if (!gameId) {
      res.status(400).json({
        success: false,
        message: "Game ID is required",
      });
      return;
    }

    // Check engine status before starting analysis
    const engineStatus = await getEngineReadiness();
    if (!engineStatus.isReady) {
      res.status(503).json({
        success: false,
        message: `Cannot start analysis: ${
          engineStatus.error || "Engine not ready"
        }`,
      });
      return;
    }

    // Check if already analyzing
    if (analysisService.isAnalyzing(gameId)) {
      res.status(409).json({
        success: false,
        message: "Game analysis already in progress",
      });
      return;
    }

    // All validation passed — switch to SSE mode
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    let clientDisconnected = false;
    req.on("close", () => {
      clientDisconnected = true;
    });

    // Heartbeat to prevent proxy timeouts
    const heartbeat = setInterval(() => {
      if (!clientDisconnected) {
        res.write(":heartbeat\n\n");
      }
    }, 15000);

    const writeEvent = (type: string, data: unknown) => {
      if (!clientDisconnected) {
        res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
      }
    };

    try {
      console.log(`🚀 Starting streamed analysis for game ${gameId}`);

      const result = await analysisService.analyzeGame(gameId, {
        depth: depth ? parseInt(depth) : undefined,
        skipOpeningMoves: skipOpeningMoves
          ? parseInt(skipOpeningMoves)
          : undefined,
        maxPositions: maxPositions ? parseInt(maxPositions) : undefined,
        onProgress: (progress) => {
          writeEvent("progress", {
            current: progress.current,
            total: progress.total,
            percentage: progress.percentage,
            status: progress.status,
            message: progress.message,
          });
        },
      });

      writeEvent("complete", { analysis: result });
    } catch (error) {
      console.error("Streamed analysis error:", error);
      writeEvent("error", {
        message: error instanceof Error ? error.message : "Analysis failed",
      });
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  })
);

// Get game analysis results
router.get(
  "/games/:gameId/analysis",
  asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;

    try {
      const analysis = await analysisService.getGameAnalysis(gameId);

      if (!analysis || analysis.analysisDetails.length === 0) {
        res.status(404).json({
          success: false,
          message: "No analysis found for this game",
        });
        return;
      }

      res.json({
        success: true,
        data: analysis,
        count: analysis.analysisDetails.length,
      });
    } catch (error) {
      console.error("Error fetching analysis:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch analysis",
      });
    }
  })
);

// Delete game analysis
router.delete(
  "/games/:gameId/analysis",
  asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;

    try {
      await analysisService.deleteGameAnalysis(gameId);

      res.json({
        success: true,
        message: "Analysis deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting analysis:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete analysis",
      });
    }
  })
);

// Check if game is being analyzed
router.get(
  "/games/:gameId/analysis/status",
  asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;

    try {
      const isAnalyzing = analysisService.isAnalyzing(gameId);
      const existingAnalysis = await analysisService.getGameAnalysis(gameId);

      res.json({
        success: true,
        data: {
          isAnalyzing,
          hasExistingAnalysis: existingAnalysis
            ? existingAnalysis.analysisDetails.length > 0
            : false,
          analysisCount: existingAnalysis
            ? existingAnalysis.analysisDetails.length
            : 0,
        },
      });
    } catch (error) {
      console.error("Error checking analysis status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to check analysis status",
      });
    }
  })
);

// Analyze specific position (for testing)
router.post(
  "/position/analyze",
  asyncHandler(async (req: Request, res: Response) => {
    const { fen, depth, timeLimit } = req.body;

    if (!fen) {
      res.status(400).json({
        success: false,
        message: "FEN position is required",
      });
      return;
    }

    // Validate FEN format (basic check)
    const fenParts = fen.split(" ");
    if (fenParts.length < 4) {
      res.status(400).json({
        success: false,
        message: "Invalid FEN format",
      });
      return;
    }

    // Check engine status
    const engineStatus = await getEngineReadiness();
    if (!engineStatus.isReady) {
      res.status(503).json({
        success: false,
        message: `Cannot analyze position: ${
          engineStatus.error || "Engine not ready"
        }`,
        data: {
          engineReady: false,
          error: engineStatus.error,
        },
      });
      return;
    }

    try {
      const stockfish = await getStockfishService();

      const analysis = await stockfish.analyzePosition(fen, {
        depth: depth ? parseInt(depth) : 15,
        timeLimit: timeLimit ? parseInt(timeLimit) : 5000,
      });

      res.json({
        success: true,
        data: analysis,
      });
    } catch (error) {
      console.error("Position analysis error:", error);

      let errorMessage =
        error instanceof Error ? error.message : "Position analysis failed";
      let statusCode = 500;

      if (errorMessage.includes("timeout")) {
        statusCode = 408;
        errorMessage =
          "Analysis timeout - position too complex or engine overloaded";
      } else if (
        errorMessage.includes("Stockfish") ||
        errorMessage.includes("engine")
      ) {
        statusCode = 503;
        errorMessage = `Engine error: ${errorMessage}`;
      }

      res.status(statusCode).json({
        success: false,
        message: errorMessage,
      });
    }
  })
);

// Get user analysis statistics
router.get(
  "/users/:userId/stats",
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: "User ID is required",
      });
      return;
    }

    try {
      const stats = await analysisService.getAnalysisStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Error fetching analysis stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch analysis statistics",
      });
    }
  })
);

// Get engine status - improved version
router.get(
  "/engine/status",
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const engineStatus = await getEngineReadiness();

      if (engineStatus.isReady) {
        res.json({
          success: true,
          data: {
            engineReady: true,
            engineType: engineStatus.engineType || "Stockfish",
            version: engineStatus.version || "Latest",
          },
        });
      } else {
        res.status(503).json({
          success: false,
          message: "Chess engine not available",
          data: {
            engineReady: false,
            error: engineStatus.error || "Unknown error",
            troubleshooting: {
              suggestions: [
                "Check if Stockfish is installed on the system",
                "Verify STOCKFISH_PATH environment variable",
                "Ensure the engine executable has proper permissions",
                "Check server logs for initialization errors",
              ],
            },
          },
        });
      }
    } catch (error) {
      console.error("Engine status error:", error);
      res.status(503).json({
        success: false,
        message: "Failed to check engine status",
        data: {
          engineReady: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  })
);

// Stop ongoing analysis for a game - improved implementation
router.post(
  "/games/:gameId/analysis/stop",
  asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;

    if (!gameId) {
      res.status(400).json({
        success: false,
        message: "Game ID is required",
      });
      return;
    }

    try {
      const wasAnalyzing = analysisService.isAnalyzing(gameId);

      if (!wasAnalyzing) {
        res.status(400).json({
          success: false,
          message: "No analysis in progress for this game",
        });
        return;
      }

      // For now, we can't actually stop mid-analysis, but we can provide better feedback
      res.status(501).json({
        success: false,
        message: "Analysis cancellation not yet implemented",
        data: {
          currentStatus: "analyzing",
          note: "Analysis will complete normally and can be deleted afterward",
          estimatedTimeRemaining:
            "varies based on analysis depth and game length",
        },
      });
    } catch (error) {
      console.error("Error stopping analysis:", error);
      res.status(500).json({
        success: false,
        message: "Failed to stop analysis",
      });
    }
  })
);

// Get analysis summary for multiple games
router.post(
  "/games/batch/summary",
  asyncHandler(async (req: Request, res: Response) => {
    const { gameIds } = req.body;

    if (!Array.isArray(gameIds) || gameIds.length === 0) {
      res.status(400).json({
        success: false,
        message: "gameIds array is required",
      });
      return;
    }

    if (gameIds.length > 50) {
      res.status(400).json({
        success: false,
        message: "Maximum 50 games per batch request",
      });
      return;
    }

    // Validate that all gameIds are strings
    const invalidIds = gameIds.filter(
      (id) => typeof id !== "string" || !id.trim()
    );
    if (invalidIds.length > 0) {
      res.status(400).json({
        success: false,
        message: "All game IDs must be non-empty strings",
      });
      return;
    }

    try {
      const summaries = await Promise.all(
        gameIds.map(async (gameId: string) => {
          try {
            const analysis = await analysisService.getGameAnalysis(gameId);
            if (!analysis || analysis.analysisDetails.length === 0) {
              return { gameId, hasAnalysis: false };
            }

            // Quick summary calculation using analysisDetails
            const details = analysis.analysisDetails;
            const mistakes = {
              blunders: details.filter((a) => a.mistakeSeverity === "blunder")
                .length,
              mistakes: details.filter((a) => a.mistakeSeverity === "mistake")
                .length,
              inaccuracies: details.filter(
                (a) => a.mistakeSeverity === "inaccuracy"
              ).length,
            };

            return {
              gameId,
              hasAnalysis: true,
              positionsAnalyzed: details.length,
              mistakes,
              averageDepth:
                details.length > 0
                  ? Math.round(
                      details.reduce(
                        (sum, a) => sum + (a.analysisDepth || 15),
                        0
                      ) / details.length
                    )
                  : 0,
              // Add accuracy information
              accuracy: {
                white: analysis.accuracy.white,
                black: analysis.accuracy.black,
                overall: analysis.accuracy.overall,
              },
            };
          } catch (error) {
            console.error(`Error loading analysis for game ${gameId}:`, error);
            return {
              gameId,
              hasAnalysis: false,
              error: error instanceof Error ? error.message : "Failed to load",
            };
          }
        })
      );

      // Calculate aggregate statistics
      const totalGames = summaries.length;
      const analyzedGames = summaries.filter((s) => s.hasAnalysis).length;
      const totalMistakes = summaries.reduce((sum, s) => {
        if (!s.hasAnalysis || !s.mistakes) return sum;
        return (
          sum +
          s.mistakes.blunders +
          s.mistakes.mistakes +
          s.mistakes.inaccuracies
        );
      }, 0);

      res.json({
        success: true,
        data: summaries,
        summary: {
          totalGames,
          analyzedGames,
          percentageAnalyzed:
            totalGames > 0 ? Math.round((analyzedGames / totalGames) * 100) : 0,
          totalMistakes,
          averageMistakesPerGame:
            analyzedGames > 0
              ? Math.round((totalMistakes / analyzedGames) * 100) / 100
              : 0,
        },
      });
    } catch (error) {
      console.error("Error getting batch summary:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get batch summary",
      });
    }
  })
);

// Get analysis leaderboard/rankings - placeholder with better structure
router.get(
  "/leaderboard/accuracy",
  asyncHandler(async (req: Request, res: Response) => {
    const { limit = "10" } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 10, 50);

    if (isNaN(limitNum) || limitNum < 1) {
      res.status(400).json({
        success: false,
        message: "Invalid limit parameter",
      });
      return;
    }

    try {
      // This would require a more complex query to calculate user accuracies
      // For now, return a structured placeholder that indicates what's needed
      res.status(501).json({
        success: false,
        message: "Leaderboard functionality not yet implemented",
        data: {
          placeholder: true,
          implementation_needed: {
            description:
              "This endpoint would show top players by analysis accuracy",
            required_queries: [
              "Aggregate analysis data by user",
              "Calculate average accuracy across all analyzed games",
              "Rank users by accuracy with minimum game requirements",
              "Include total games analyzed and mistake counts",
            ],
            expected_response_format: {
              rankings: [
                {
                  rank: 1,
                  userId: "string",
                  username: "string",
                  averageAccuracy: "number",
                  gamesAnalyzed: "number",
                  totalMistakes: "number",
                  avgMistakesPerGame: "number",
                },
              ],
            },
          },
        },
      });
    } catch (error) {
      console.error("Error getting leaderboard:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get leaderboard",
      });
    }
  })
);

// Get detailed move analysis for a specific move
router.get(
  "/games/:gameId/moves/:moveNumber",
  asyncHandler(async (req: Request, res: Response) => {
    const { gameId, moveNumber } = req.params;
    const moveNum = parseInt(moveNumber);

    if (!gameId) {
      res.status(400).json({
        success: false,
        message: "Game ID is required",
      });
      return;
    }

    if (isNaN(moveNum) || moveNum < 1) {
      res.status(400).json({
        success: false,
        message: "Invalid move number - must be a positive integer",
      });
      return;
    }

    try {
      const analysis = await analysisService.getGameAnalysis(gameId);

      if (!analysis) {
        res.status(404).json({
          success: false,
          message: "No analysis found for this game",
        });
        return;
      }

      const moveAnalysis = analysis.analysisDetails.find(
        (a) => a.moveNumber === moveNum
      );

      if (!moveAnalysis) {
        res.status(404).json({
          success: false,
          message: `Move ${moveNum} analysis not found`,
          data: {
            availableMoves: analysis.analysisDetails
              .map((a) => a.moveNumber)
              .sort((a, b) => a - b),
            totalAnalyzedMoves: analysis.analysisDetails.length,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: moveAnalysis,
      });
    } catch (error) {
      console.error("Error getting move analysis:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get move analysis",
      });
    }
  })
);

export default router;
