import { Chess } from "chess.js";
import { prisma } from "../config/database";
import { getStockfishService } from "./stockfishService";

export interface AnalysisOptions {
  depth?: number;
  skipMoves?: number;
  skipOpeningMoves?: number;
  maxPositions?: number;
  onProgress?: (progress: AnalysisProgress) => void;
}

export interface AnalysisProgress {
  current: number;
  total: number;
  percentage: number;
  status: "analyzing" | "complete" | "error";
  message: string;
}

export interface GameAnalysis {
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
  // Add array methods that routes expect
  length: number;
  filter: (predicate: (item: any) => boolean) => any[];
  find: (predicate: (item: any) => boolean) => any;
  reduce: (callback: (sum: any, item: any) => any, initial: any) => any;
}

export class AnalysisService {
  private analyzingGames: Set<string> = new Set();

  constructor() {
    // Remove stockfish initialization from constructor to avoid circular dependencies
  }

  isAnalyzing(gameId: string): boolean {
    return this.analyzingGames.has(gameId);
  }

  async analyzeGame(
    gameId: string,
    options: AnalysisOptions = {}
  ): Promise<GameAnalysis> {
    const {
      depth = 15,
      skipMoves = 6,
      skipOpeningMoves = 6,
      maxPositions,
      onProgress,
    } = options;

    // Mark game as being analyzed
    this.analyzingGames.add(gameId);

    try {
      // Get game from database
      const game = await prisma.game.findUnique({
        where: { id: gameId },
      });

      if (!game) {
        throw new Error("Game not found");
      }

      console.log(`🎯 Starting analysis for game ${gameId}`);
      console.log(`📖 PGN Preview: ${game.pgn.substring(0, 200)}...`);

      // Initialize Stockfish service
      console.log(`🚀 Initializing Stockfish engine...`);
      const stockfish = await getStockfishService();

      // Verify engine is ready
      if (!stockfish.isEngineReady()) {
        throw new Error("Stockfish engine is not ready");
      }

      console.log(`✅ Stockfish engine ready - proceeding with analysis`);

      // Initialize chess engine and load the game
      const chess = new Chess();

      try {
        chess.loadPgn(game.pgn);
      } catch (error) {
        throw new Error(
          `Invalid PGN: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }

      // Get the move history
      const moveHistory = chess.history({ verbose: true });
      console.log(`📝 Game has ${moveHistory.length} moves total`);

      const actualSkipMoves = Math.max(skipMoves || 0, skipOpeningMoves || 0);

      if (moveHistory.length <= actualSkipMoves) {
        console.log(
          `⚠️ Game too short (${moveHistory.length} moves), skipping analysis`
        );
        return this.createEmptyAnalysis(gameId);
      }

      // Filter moves to analyze (skip opening moves)
      const movesToAnalyze = moveHistory.slice(actualSkipMoves);
      const finalMovesToAnalyze = maxPositions
        ? movesToAnalyze.slice(0, maxPositions)
        : movesToAnalyze;

      console.log(
        `Analyzing ${finalMovesToAnalyze.length} positions (skipped first ${actualSkipMoves} moves)`
      );

      // Reset the chess position and replay moves step by step
      chess.reset();
      const analysisResults: Array<{
        moveNumber: number;
        playerMove: string;
        evaluation: number;
        bestMove: string;
        mistakeSeverity?: string;
        analysisDepth?: number;
        positionFen?: string;
        bestLine?: string;
      }> = [];

      // Replay the game move by move and analyze each position
      for (let i = 0; i < moveHistory.length; i++) {
        const moveIndex = i + 1; // Move numbers start at 1
        const move = moveHistory[i];

        // Only analyze moves after the skip threshold
        if (i < actualSkipMoves) {
          // Still need to apply the move to maintain proper position
          try {
            chess.move(move.san);
          } catch (error) {
            console.error(
              `❌ Failed to apply move ${moveIndex}: ${move.san}`,
              error
            );
            continue;
          }
          continue;
        }

        const analysisIndex = i - actualSkipMoves;

        // Update progress
        const progress = Math.round(
          ((analysisIndex + 1) / finalMovesToAnalyze.length) * 100
        );
        onProgress?.({
          current: analysisIndex + 1,
          total: finalMovesToAnalyze.length,
          percentage: progress,
          status: "analyzing",
          message: `Analyzing move ${moveIndex}: ${move.san} (${progress}%)`,
        });

        console.log(
          `🔍 Analyzing move ${moveIndex}: ${move.san} (${progress}%)`
        );

        try {
          // Get current position FEN BEFORE the move was played
          const currentFen = chess.fen();

          // REAL STOCKFISH ANALYSIS - No more mock data!
          console.log(
            `🔍 Analyzing position with Stockfish: ${
              currentFen.split(" ")[0]
            }...`
          );

          const analysis = await this.analyzePositionWithRetry(
            stockfish,
            currentFen,
            depth,
            3 // max retries
          );

          console.log(
            `✅ Stockfish analysis complete: eval=${analysis.evaluation}, best=${analysis.bestMove}`
          );

          // Get the evaluation AFTER the player's move for comparison
          chess.move(move.san);
          const afterMoveEval = await this.analyzePositionWithRetry(
            stockfish,
            chess.fen(),
            depth,
            2 // fewer retries for comparison analysis
          );

          // Classify the move based on evaluation difference
          const mistakeSeverity = this.classifyMove(
            analysis.evaluation,
            afterMoveEval.evaluation
          );

          // Store analysis in database
          await prisma.analysis.create({
            data: {
              gameId,
              positionFen: currentFen,
              moveNumber: moveIndex,
              playerMove: move.san,
              stockfishEvaluation: analysis.evaluation,
              bestMove: analysis.bestMove,
              bestLine: Array.isArray(analysis.bestLine)
                ? analysis.bestLine.join(" ")
                : analysis.bestLine,
              analysisDepth: depth,
              mistakeSeverity,
              timeSpentMs: analysis.timeSpent,
            },
          });

          // Add to results
          analysisResults.push({
            moveNumber: moveIndex,
            playerMove: move.san,
            evaluation: analysis.evaluation,
            bestMove: analysis.bestMove,
            mistakeSeverity,
            analysisDepth: depth,
            positionFen: currentFen,
            bestLine: Array.isArray(analysis.bestLine)
              ? analysis.bestLine.join(" ")
              : analysis.bestLine,
          });

          console.log(
            `✅ Move ${moveIndex} analyzed: ${move.san} (eval: ${analysis.evaluation}, best: ${analysis.bestMove}, severity: ${mistakeSeverity})`
          );
        } catch (error) {
          console.error(`❌ Error analyzing move ${moveIndex}:`, error);

          // Still apply the move to maintain position and continue
          try {
            chess.move(move.san);
          } catch (moveError) {
            console.error(
              `❌ Failed to apply move after analysis error: ${move.san}`,
              moveError
            );
            break; // If we can't apply the move, we can't continue
          }

          // Continue with next move instead of stopping entire analysis
          continue;
        }
      }

      // Calculate final statistics
      const gameAnalysis = this.calculateGameStatistics(
        gameId,
        analysisResults
      );

      onProgress?.({
        current: finalMovesToAnalyze.length,
        total: finalMovesToAnalyze.length,
        percentage: 100,
        status: "complete",
        message: `Analysis complete! Analyzed ${analysisResults.length} moves`,
      });

      console.log(
        `🎉 Game analysis complete! Analyzed ${analysisResults.length} moves`
      );
      return gameAnalysis;
    } catch (error) {
      console.error("Analysis failed:", error);
      onProgress?.({
        current: 0,
        total: 0,
        percentage: 0,
        status: "error",
        message: `Analysis failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
      throw error;
    } finally {
      // Remove game from analyzing set
      this.analyzingGames.delete(gameId);
    }
  }

  private async analyzePositionWithRetry(
    stockfish: any,
    fen: string,
    depth: number,
    maxRetries: number = 3
  ): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `🔄 Analysis attempt ${attempt}/${maxRetries} for position: ${
            fen.split(" ")[0]
          }`
        );

        const result = await stockfish.analyzePosition(fen, { depth });

        if (!result) {
          throw new Error("Analysis returned null result");
        }

        if (!result.bestMove) {
          throw new Error("Analysis returned no best move");
        }

        // Validate the result has required properties
        if (typeof result.evaluation !== "number") {
          throw new Error("Analysis returned invalid evaluation");
        }

        return result;
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error("Unknown analysis error");
        console.warn(
          `⚠️ Analysis attempt ${attempt} failed: ${lastError.message}`
        );

        if (attempt < maxRetries) {
          // Wait before retry - exponential backoff
          const waitTime = Math.pow(2, attempt) * 500; // 500ms, 1s, 2s
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    throw lastError || new Error(`Analysis failed after ${maxRetries} retries`);
  }

  private createEmptyAnalysis(gameId: string): GameAnalysis {
    const emptyDetails: any[] = [];
    return {
      gameId,
      totalMoves: 0,
      analyzedMoves: 0,
      accuracy: { white: 0, black: 0, overall: 0 },
      mistakes: { blunders: 0, mistakes: 0, inaccuracies: 0 },
      analysisDetails: emptyDetails,
      // Add array-like properties
      length: 0,
      filter: (predicate: (item: any) => boolean) =>
        emptyDetails.filter(predicate),
      find: (predicate: (item: any) => boolean) => emptyDetails.find(predicate),
      reduce: (callback: (sum: any, item: any) => any, initial: any) =>
        emptyDetails.reduce(callback, initial),
    };
  }

  private classifyMove(beforeEval: number, afterEval: number): string {
    // Convert evaluations to centipawns for comparison
    const beforeCp = beforeEval * 100;
    const afterCp = afterEval * 100;

    // Calculate centipawn loss (from the perspective of the player who just moved)
    // If it's white's move, a positive evaluation is good for white
    // After white moves, we want to see how much the evaluation changed
    const centipawnLoss = Math.abs(beforeCp - afterCp);

    if (centipawnLoss >= 300) return "blunder";
    if (centipawnLoss >= 150) return "mistake";
    if (centipawnLoss >= 50) return "inaccuracy";
    if (centipawnLoss <= 10) return "excellent";
    return "good";
  }

  private calculateGameStatistics(
    gameId: string,
    analysisResults: Array<{
      moveNumber: number;
      playerMove: string;
      evaluation: number;
      bestMove: string;
      mistakeSeverity?: string;
      analysisDepth?: number;
      positionFen?: string;
      bestLine?: string;
    }>
  ): GameAnalysis {
    const totalMoves = analysisResults.length;

    // Count mistakes by type
    const mistakes = {
      blunders: analysisResults.filter((r) => r.mistakeSeverity === "blunder")
        .length,
      mistakes: analysisResults.filter((r) => r.mistakeSeverity === "mistake")
        .length,
      inaccuracies: analysisResults.filter(
        (r) => r.mistakeSeverity === "inaccuracy"
      ).length,
    };

    // Calculate accuracy (percentage of good moves)
    const goodMoves = analysisResults.filter(
      (r) => r.mistakeSeverity === "good" || r.mistakeSeverity === "excellent"
    ).length;
    const overallAccuracy = totalMoves > 0 ? (goodMoves / totalMoves) * 100 : 0;

    // Separate white and black moves for individual accuracy
    const whiteMoves = analysisResults.filter((r) => r.moveNumber % 2 === 1);
    const blackMoves = analysisResults.filter((r) => r.moveNumber % 2 === 0);

    const whiteGoodMoves = whiteMoves.filter(
      (r) => r.mistakeSeverity === "good" || r.mistakeSeverity === "excellent"
    ).length;
    const blackGoodMoves = blackMoves.filter(
      (r) => r.mistakeSeverity === "good" || r.mistakeSeverity === "excellent"
    ).length;

    const whiteAccuracy =
      whiteMoves.length > 0 ? (whiteGoodMoves / whiteMoves.length) * 100 : 0;
    const blackAccuracy =
      blackMoves.length > 0 ? (blackGoodMoves / blackMoves.length) * 100 : 0;

    // Create array-like methods for the analysisDetails
    const details = analysisResults;

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
      // Add array-like properties
      length: details.length,
      filter: (predicate: (item: any) => boolean) => details.filter(predicate),
      find: (predicate: (item: any) => boolean) => details.find(predicate),
      reduce: (callback: (sum: any, item: any) => any, initial: any) =>
        details.reduce(callback, initial),
    };
  }

  async getGameAnalysis(gameId: string): Promise<GameAnalysis | null> {
    try {
      const analysisData = await prisma.analysis.findMany({
        where: { gameId },
        orderBy: { moveNumber: "asc" },
      });

      if (analysisData.length === 0) {
        return null;
      }

      const analysisResults = analysisData.map((a) => ({
        moveNumber: a.moveNumber,
        playerMove: a.playerMove,
        evaluation: a.stockfishEvaluation,
        bestMove: a.bestMove,
        mistakeSeverity: a.mistakeSeverity || undefined,
        analysisDepth: a.analysisDepth,
        positionFen: a.positionFen,
        bestLine: a.bestLine || undefined,
      }));

      return this.calculateGameStatistics(gameId, analysisResults);
    } catch (error) {
      console.error("Failed to get game analysis:", error);
      return null;
    }
  }

  async deleteGameAnalysis(gameId: string): Promise<void> {
    try {
      await prisma.analysis.deleteMany({
        where: { gameId },
      });
    } catch (error) {
      console.error("Failed to delete game analysis:", error);
      throw error;
    }
  }

  async getAnalysisStatus(gameId: string): Promise<{
    hasAnalysis: boolean;
    analyzedMoves: number;
    lastAnalyzed?: Date;
  }> {
    try {
      const analysisCount = await prisma.analysis.count({
        where: { gameId },
      });

      const latestAnalysis = await prisma.analysis.findFirst({
        where: { gameId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      return {
        hasAnalysis: analysisCount > 0,
        analyzedMoves: analysisCount,
        lastAnalyzed: latestAnalysis?.createdAt,
      };
    } catch (error) {
      console.error("Failed to get analysis status:", error);
      return {
        hasAnalysis: false,
        analyzedMoves: 0,
      };
    }
  }

  // Add the method that routes expect (getAnalysisStats -> getAnalysisStatus)
  async getAnalysisStats(gameId: string) {
    return this.getAnalysisStatus(gameId);
  }
}
