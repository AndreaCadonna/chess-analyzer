// backend/src/routes/analysis.ts
import { Router, Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { AnalysisService } from "../services/analysisService";
import { getStockfishService } from "../services/stockfishService";

const router = Router();
const analysisService = new AnalysisService();

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
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Analysis failed",
      });
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

    try {
      const stockfish = await getStockfishService();

      const analysis = await stockfish.analyzePosition(
        fen,
        { depth: depth ? parseInt(depth) : 15 }
      );

      res.json({
        success: true,
        data: analysis,
      });
    } catch (error) {
      console.error("Position analysis error:", error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Position analysis failed",
      });
    }
  })
);

// Get user analysis statistics
router.get(
  "/users/:userId/stats",
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

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

// Get engine status
router.get(
  "/engine/status",
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const stockfish = await getStockfishService();

      // Check if stockfish has the method
      let isReady = false;
      if (typeof stockfish.isEngineReady === "function") {
        isReady = stockfish.isEngineReady();
      } else {
        // Fallback - if we can get the service, assume it's ready
        isReady = true;
      }

      res.json({
        success: true,
        data: {
          engineReady: isReady,
          engineType: "Stockfish",
          version: "Latest",
        },
      });
    } catch (error) {
      console.error("Engine status error:", error);
      res.status(503).json({
        success: false,
        message: "Chess engine not available",
        data: {
          engineReady: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  })
);

// Stop ongoing analysis for a game
router.post(
  "/games/:gameId/analysis/stop",
  asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;

    try {
      const wasAnalyzing = analysisService.isAnalyzing(gameId);

      if (!wasAnalyzing) {
        res.status(400).json({
          success: false,
          message: "No analysis in progress for this game",
        });
        return;
      }

      // Note: This would require additional implementation in AnalysisService
      // to support canceling ongoing analysis
      res.status(501).json({
        success: false,
        message: "Analysis cancellation not yet implemented",
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
            };
          } catch (error) {
            return { gameId, hasAnalysis: false, error: "Failed to load" };
          }
        })
      );

      res.json({
        success: true,
        data: summaries,
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

// Get analysis leaderboard/rankings
router.get(
  "/leaderboard/accuracy",
  asyncHandler(async (req: Request, res: Response) => {
    const { limit = "10" } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 10, 50);

    try {
      // This would require a more complex query to calculate user accuracies
      // For now, return a placeholder
      res.status(501).json({
        success: false,
        message: "Leaderboard functionality not yet implemented",
        data: {
          placeholder: true,
          suggestion: "This would show top players by analysis accuracy",
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

    if (isNaN(moveNum) || moveNum < 1) {
      res.status(400).json({
        success: false,
        message: "Invalid move number",
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
          message: "Move analysis not found",
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
