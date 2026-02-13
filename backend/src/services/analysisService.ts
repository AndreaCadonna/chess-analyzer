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

export interface AnalysisDetail {
  moveNumber: number;
  playerMove: string;
  evaluation: number;
  bestMove: string;
  mistakeSeverity?: string;
  centipawnLoss?: number;
  analysisDepth?: number;
  positionFen?: string;
  bestLine?: string;
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
  analysisDetails: AnalysisDetail[];
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
      skipMoves = 0,
      skipOpeningMoves = 0,
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

      // Clear engine state once for the entire game analysis
      stockfish.newGame();

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
      const analysisResults: AnalysisDetail[] = [];

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
          const isWhiteMove = moveIndex % 2 === 1;

          // Analyze position with MultiPV=3 to get top 3 engine moves
          // This is MORE ACCURATE and FASTER (only 1 analysis instead of 2!)
          const analysis = await this.analyzePositionWithRetry(
            stockfish,
            currentFen,
            depth,
            3, // max retries
            3  // MultiPV - get top 3 moves
          );

          console.log(
            `✅ Stockfish analysis complete: ${analysis.lines.length} lines, best=${analysis.bestMove} (${analysis.evaluation})`
          );

          // Get the player's actual move in UCI format for comparison
          const playerMoveUci = move.from + move.to + (move.promotion || "");

          // Find which line (if any) the player's move matches
          const playerMoveLine = analysis.lines.find(line =>
            line.bestMove === playerMoveUci || line.pv[0] === playerMoveUci
          );

          // Calculate centipawn loss from player's perspective
          const bestEval = analysis.lines[0].evaluation;
          const playerEval = playerMoveLine?.evaluation;

          let centipawnLoss = 0;
          let mistakeSeverity = "good";

          if (playerEval !== undefined) {
            // Player's move was in top 3 engine moves
            // Calculate loss from player's perspective
            if (isWhiteMove) {
              // For White: lower eval = worse position
              centipawnLoss = bestEval - playerEval;
            } else {
              // For Black: higher eval (more positive) = worse position
              centipawnLoss = playerEval - bestEval;
            }

            // Clamp to 0 minimum (can't have negative loss)
            centipawnLoss = Math.max(0, centipawnLoss);

            mistakeSeverity = this.classifyMoveByLoss(centipawnLoss);

            console.log(
              `🎯 Move found in engine lines (line ${playerMoveLine.multiPvIndex}): loss=${centipawnLoss}cp, severity=${mistakeSeverity}`
            );
          } else {
            // Player's move was NOT in top 3 - need to analyze it separately
            console.log(
              `⚠️ Player move ${move.san} not in top 3, analyzing separately...`
            );

            // Apply the move and analyze the resulting position
            chess.move(move.san);
            const afterMoveAnalysis = await this.analyzePositionWithRetry(
              stockfish,
              chess.fen(),
              depth,
              2 // fewer retries
            );

            // Calculate loss from perspective
            if (isWhiteMove) {
              centipawnLoss = bestEval - afterMoveAnalysis.evaluation;
            } else {
              centipawnLoss = afterMoveAnalysis.evaluation - bestEval;
            }

            centipawnLoss = Math.max(0, centipawnLoss);
            mistakeSeverity = this.classifyMoveByLoss(centipawnLoss);

            console.log(
              `📊 After-move analysis: eval=${afterMoveAnalysis.evaluation}, loss=${centipawnLoss}cp, severity=${mistakeSeverity}`
            );
          }

          // If we haven't applied the move yet (because it was in top 3), apply it now
          if (playerEval !== undefined) {
            chess.move(move.san);
          }

          // Store analysis in database
          await prisma.analysis.create({
            data: {
              gameId,
              positionFen: currentFen,
              moveNumber: moveIndex,
              playerMove: move.san,
              stockfishEvaluation: bestEval,
              bestMove: analysis.bestMove,
              bestLine: analysis.bestLine.join(" "),
              analysisDepth: depth,
              mistakeSeverity,
              timeSpentMs: analysis.timeSpent,
            },
          });

          // Add to results
          analysisResults.push({
            moveNumber: moveIndex,
            playerMove: move.san,
            evaluation: bestEval,
            bestMove: analysis.bestMove,
            mistakeSeverity,
            centipawnLoss,
            analysisDepth: depth,
            positionFen: currentFen,
            bestLine: analysis.bestLine.join(" "),
          });

          console.log(
            `✅ Move ${moveIndex} analyzed: ${move.san} (best: ${analysis.bestMove}, loss: ${centipawnLoss}cp, severity: ${mistakeSeverity})`
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
    maxRetries: number = 3,
    multiPV: number = 1
  ): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `🔄 Analysis attempt ${attempt}/${maxRetries} for position: ${
            fen.split(" ")[0]
          } (MultiPV=${multiPV})`
        );

        const result = await stockfish.analyzePosition(fen, { depth, multiPV });

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

        if (!result.lines || result.lines.length === 0) {
          throw new Error("Analysis returned no lines");
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
    return {
      gameId,
      totalMoves: 0,
      analyzedMoves: 0,
      accuracy: { white: 0, black: 0, overall: 0 },
      mistakes: { blunders: 0, mistakes: 0, inaccuracies: 0 },
      analysisDetails: [],
    };
  }

  private classifyMoveByLoss(centipawnLoss: number): string {
    if (centipawnLoss >= 300) return "blunder";
    if (centipawnLoss >= 150) return "mistake";
    if (centipawnLoss >= 50) return "inaccuracy";
    if (centipawnLoss <= 10) return "excellent";
    return "good";
  }

  /**
   * Convert Average Centipawn Loss (ACPL) to an accuracy percentage (0-100).
   * Uses a formula modeled after Lichess's accuracy calculation.
   */
  private acplToAccuracy(acpl: number): number {
    if (acpl < 0) return 100;
    // Formula: 103.1668 * exp(-0.04354 * ACPL) - 3.1669
    // Produces ~100% at ACPL=0, ~50% at ACPL=16, ~0% at ACPL≥80
    const accuracy = 103.1668 * Math.exp(-0.04354 * acpl) - 3.1669;
    return Math.max(0, Math.min(100, accuracy));
  }

  private calculateGameStatistics(
    gameId: string,
    analysisResults: AnalysisDetail[]
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

    // Calculate accuracy based on Average Centipawn Loss (ACPL)
    const whiteMoves = analysisResults.filter((r) => r.moveNumber % 2 === 1);
    const blackMoves = analysisResults.filter((r) => r.moveNumber % 2 === 0);

    const whiteACPL = whiteMoves.length > 0
      ? whiteMoves.reduce((sum, r) => sum + (r.centipawnLoss || 0), 0) / whiteMoves.length
      : 0;
    const blackACPL = blackMoves.length > 0
      ? blackMoves.reduce((sum, r) => sum + (r.centipawnLoss || 0), 0) / blackMoves.length
      : 0;
    const overallACPL = totalMoves > 0
      ? analysisResults.reduce((sum, r) => sum + (r.centipawnLoss || 0), 0) / totalMoves
      : 0;

    const whiteAccuracy = this.acplToAccuracy(whiteACPL);
    const blackAccuracy = this.acplToAccuracy(blackACPL);
    const overallAccuracy = this.acplToAccuracy(overallACPL);

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
      analysisDetails: analysisResults,
    };
  }

  /**
   * Estimate centipawn loss from a severity classification.
   * Used for backwards compatibility with analysis data that doesn't
   * have centipawnLoss stored explicitly.
   */
  private estimateCentipawnLossFromSeverity(severity?: string): number {
    switch (severity) {
      case "blunder": return 350;
      case "mistake": return 200;
      case "inaccuracy": return 75;
      case "good": return 25;
      case "excellent": return 5;
      default: return 25;
    }
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

      const analysisResults: AnalysisDetail[] = analysisData.map((a) => ({
        moveNumber: a.moveNumber,
        playerMove: a.playerMove,
        evaluation: a.stockfishEvaluation,
        bestMove: a.bestMove,
        mistakeSeverity: a.mistakeSeverity || undefined,
        centipawnLoss: this.estimateCentipawnLossFromSeverity(a.mistakeSeverity || undefined),
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
