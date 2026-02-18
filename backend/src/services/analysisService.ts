import { Chess, Move } from "chess.js";
import { prisma } from "../config/database";
import { AnalysisLine, PositionAnalysis } from "./stockfishService";
import { getStockfishPool, StockfishPool } from "./stockfishPool";

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
  winProbabilityLoss?: number;
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

      // Initialize Stockfish pool
      console.log(`🚀 Initializing Stockfish pool...`);
      const pool = await getStockfishPool();

      if (!pool.hasAvailableWorkers()) {
        throw new Error("Stockfish pool has no available workers");
      }

      const poolStats = pool.getStats();
      console.log(
        `✅ Stockfish pool ready - ${poolStats.batchWorkers} batch workers available`
      );

      // Clear engine state on all batch workers for this game
      pool.newGame();

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

      // ── PHASE 1: Pre-compute all FENs (fast, sequential) ──
      chess.reset();

      interface PositionInfo {
        moveIndex: number;
        move: Move;
        fenBefore: string;
        fenAfter: string;
        isWhiteMove: boolean;
      }

      const positions: PositionInfo[] = [];

      for (let i = 0; i < moveHistory.length; i++) {
        const fenBefore = chess.fen();
        const move = moveHistory[i];

        try {
          chess.move(move.san);
        } catch (error) {
          console.error(`❌ Failed to replay move ${i + 1}: ${move.san}`, error);
          break;
        }

        const fenAfter = chess.fen();

        if (i >= actualSkipMoves) {
          positions.push({
            moveIndex: i + 1,
            move,
            fenBefore,
            fenAfter,
            isWhiteMove: (i + 1) % 2 === 1,
          });
        }
      }

      const finalPositions = maxPositions
        ? positions.slice(0, maxPositions)
        : positions;

      const totalToAnalyze = finalPositions.length;
      console.log(
        `Analyzing ${totalToAnalyze} positions in parallel (skipped first ${actualSkipMoves} moves)`
      );

      // ── PHASE 2: Parallel analysis with bounded concurrency ──
      const results = new Map<number, AnalysisDetail>();
      let completedCount = 0;

      const analyzeOneMove = async (pos: PositionInfo): Promise<void> => {
        try {
          // First analysis: pre-move position with MultiPV=3
          const analysis = await this.analyzePositionWithRetry(
            pool,
            pos.fenBefore,
            depth,
            3, // max retries
            3  // MultiPV - get top 3 moves
          );

          // Get the player's actual move in UCI format for comparison
          const playerMoveUci =
            pos.move.from + pos.move.to + (pos.move.promotion || "");

          // Find which line (if any) the player's move matches
          const playerMoveLine = analysis.lines.find(
            (line: AnalysisLine) =>
              line.bestMove === playerMoveUci || line.pv[0] === playerMoveUci
          );

          const bestEval = analysis.lines[0].evaluation;
          const playerEval = playerMoveLine?.evaluation;

          let centipawnLoss = 0;
          let mistakeSeverity = "good";
          let winProbabilityLoss = 0;

          if (playerEval !== undefined) {
            // Player's move was in top 3 engine moves
            centipawnLoss = Math.max(0, bestEval - playerEval);
            winProbabilityLoss = Math.max(
              0,
              AnalysisService.cpToWinProbability(bestEval) -
                AnalysisService.cpToWinProbability(playerEval)
            );
            mistakeSeverity = this.classifyMoveByLoss(centipawnLoss);
          } else {
            // Player's move NOT in top 3 — analyze the resulting position
            const afterMoveAnalysis = await this.analyzePositionWithRetry(
              pool,
              pos.fenAfter,
              depth,
              2 // fewer retries
            );

            centipawnLoss = Math.max(
              0,
              bestEval + afterMoveAnalysis.evaluation
            );
            const playerEvalFromMove = -afterMoveAnalysis.evaluation;
            winProbabilityLoss = Math.max(
              0,
              AnalysisService.cpToWinProbability(bestEval) -
                AnalysisService.cpToWinProbability(playerEvalFromMove)
            );
            mistakeSeverity = this.classifyMoveByLoss(centipawnLoss);
          }

          results.set(pos.moveIndex, {
            moveNumber: pos.moveIndex,
            playerMove: pos.move.san,
            evaluation: pos.isWhiteMove ? bestEval : -bestEval,
            bestMove: analysis.bestMove,
            mistakeSeverity,
            centipawnLoss,
            winProbabilityLoss,
            analysisDepth: depth,
            positionFen: pos.fenBefore,
            bestLine: analysis.bestLine.join(" "),
          });

          completedCount++;

          const percentage = Math.round(
            (completedCount / totalToAnalyze) * 100
          );
          onProgress?.({
            current: completedCount,
            total: totalToAnalyze,
            percentage,
            status: "analyzing",
            message: `Analyzed ${completedCount} of ${totalToAnalyze} moves (move ${pos.moveIndex}: ${pos.move.san})`,
          });

          console.log(
            `✅ Move ${pos.moveIndex} analyzed: ${pos.move.san} (best: ${analysis.bestMove}, loss: ${centipawnLoss}cp, severity: ${mistakeSeverity})`
          );
        } catch (error) {
          console.error(
            `❌ Error analyzing move ${pos.moveIndex}:`,
            error
          );
          // Skip failed moves — don't block the rest
          completedCount++;
        }
      };

      // Run with bounded concurrency matching batch workers available
      const concurrency = poolStats.batchWorkers;
      await AnalysisService.runWithConcurrency(
        finalPositions.map((pos) => () => analyzeOneMove(pos)),
        concurrency
      );

      // ── PHASE 3: Persist results and compute statistics ──
      const sortedResults = finalPositions
        .map((pos) => results.get(pos.moveIndex))
        .filter((r): r is AnalysisDetail => r !== undefined);

      // Bulk insert all analysis records
      if (sortedResults.length > 0) {
        await prisma.analysis.createMany({
          data: sortedResults.map((r) => ({
            gameId,
            positionFen: r.positionFen!,
            moveNumber: r.moveNumber,
            playerMove: r.playerMove,
            stockfishEvaluation: r.evaluation,
            bestMove: r.bestMove,
            bestLine: r.bestLine || null,
            analysisDepth: depth,
            mistakeSeverity: r.mistakeSeverity || null,
            centipawnLoss: r.centipawnLoss ?? null,
            winProbabilityLoss: r.winProbabilityLoss ?? null,
            timeSpentMs: null,
          })),
        });
      }

      // Calculate final statistics
      const gameAnalysis = this.calculateGameStatistics(
        gameId,
        sortedResults
      );

      onProgress?.({
        current: totalToAnalyze,
        total: totalToAnalyze,
        percentage: 100,
        status: "complete",
        message: `Analysis complete! Analyzed ${sortedResults.length} moves`,
      });

      console.log(
        `🎉 Game analysis complete! Analyzed ${sortedResults.length} moves`
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

  /**
   * Run async task factories with bounded concurrency.
   * At most `concurrency` tasks execute simultaneously.
   */
  private static async runWithConcurrency(
    taskFactories: Array<() => Promise<void>>,
    concurrency: number
  ): Promise<void> {
    const executing = new Set<Promise<void>>();

    for (const factory of taskFactories) {
      const p = factory().then(() => {
        executing.delete(p);
      });
      executing.add(p);

      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
  }

  private async analyzePositionWithRetry(
    engine: { analyzePosition: (fen: string, options: { depth?: number; multiPV?: number }) => Promise<PositionAnalysis> },
    fen: string,
    depth: number,
    maxRetries: number = 3,
    multiPV: number = 1
  ): Promise<PositionAnalysis> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await engine.analyzePosition(fen, { depth, multiPV });

        if (!result) {
          throw new Error("Analysis returned null result");
        }

        if (!result.bestMove) {
          throw new Error("Analysis returned no best move");
        }

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
          const waitTime = Math.pow(2, attempt) * 500;
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
   * Convert centipawn evaluation to win probability percentage (0-100).
   * Uses the Lichess sigmoid model: 100 / (1 + exp(-0.00368208 * cp))
   * At cp=0 → 50%, cp=100 → ~59%, cp=-100 → ~41%
   */
  static cpToWinProbability(cp: number): number {
    return 100 / (1 + Math.exp(-0.00368208 * cp));
  }

  /**
   * Convert average Win-Change-Loss (WCL) to an accuracy percentage (0-100).
   * Uses the Lichess accuracy formula. WCL is on a 0-50 scale (win probability points lost).
   * Produces ~100% at WCL=0, ~80% at WCL=5, ~50% at WCL=16, ~0% at WCL≥80
   */
  static wclToAccuracy(wcl: number): number {
    if (wcl < 0) return 100;
    const accuracy = 103.1668 * Math.exp(-0.04354 * wcl) - 3.1669;
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

    // Calculate accuracy based on average Win-probability Change Loss (WCL)
    const whiteMoves = analysisResults.filter((r) => r.moveNumber % 2 === 1);
    const blackMoves = analysisResults.filter((r) => r.moveNumber % 2 === 0);

    const whiteWCL = whiteMoves.length > 0
      ? whiteMoves.reduce((sum, r) => sum + (r.winProbabilityLoss || 0), 0) / whiteMoves.length
      : 0;
    const blackWCL = blackMoves.length > 0
      ? blackMoves.reduce((sum, r) => sum + (r.winProbabilityLoss || 0), 0) / blackMoves.length
      : 0;
    const overallWCL = totalMoves > 0
      ? analysisResults.reduce((sum, r) => sum + (r.winProbabilityLoss || 0), 0) / totalMoves
      : 0;

    const whiteAccuracy = AnalysisService.wclToAccuracy(whiteWCL);
    const blackAccuracy = AnalysisService.wclToAccuracy(blackWCL);
    const overallAccuracy = AnalysisService.wclToAccuracy(overallWCL);

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

  /**
   * Estimate win-probability loss from centipawn loss and stored evaluation.
   * Used for legacy data that doesn't have winProbabilityLoss stored.
   * stockfishEvaluation is stored as white-perspective, so we reconstruct
   * the mover's perspective based on move number (odd = white, even = black).
   */
  private estimateWplFromCentipawnLoss(cpLoss: number, storedEval: number, moveNumber: number): number {
    const isWhiteMove = moveNumber % 2 === 1;
    // storedEval is white-perspective. Convert to mover's perspective.
    // For the best eval (before the move), we approximate:
    // bestEval (mover perspective) ≈ |storedEval| + cpLoss/2 (rough approximation)
    // But a better approach: storedEval = bestEval from white's perspective
    // For white moves: bestEval (mover) = storedEval
    // For black moves: bestEval (mover) = -storedEval
    const bestEvalMoverPerspective = isWhiteMove ? storedEval : -storedEval;
    // playerEval = bestEval - cpLoss (from mover's perspective)
    const playerEvalMoverPerspective = bestEvalMoverPerspective - cpLoss;
    const wpl = AnalysisService.cpToWinProbability(bestEvalMoverPerspective) - AnalysisService.cpToWinProbability(playerEvalMoverPerspective);
    return Math.max(0, wpl);
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

      const analysisResults: AnalysisDetail[] = analysisData.map((a) => {
        // Use stored centipawnLoss or estimate from severity for legacy data
        const cpLoss = (a as any).centipawnLoss ?? this.estimateCentipawnLossFromSeverity(a.mistakeSeverity || undefined);

        // Use stored winProbabilityLoss or estimate from centipawn loss + eval
        let wpl = (a as any).winProbabilityLoss as number | null;
        if (wpl == null) {
          wpl = this.estimateWplFromCentipawnLoss(cpLoss, a.stockfishEvaluation, a.moveNumber);
        }

        return {
          moveNumber: a.moveNumber,
          playerMove: a.playerMove,
          evaluation: a.stockfishEvaluation,
          bestMove: a.bestMove,
          mistakeSeverity: a.mistakeSeverity || undefined,
          centipawnLoss: cpLoss,
          winProbabilityLoss: wpl,
          analysisDepth: a.analysisDepth,
          positionFen: a.positionFen,
          bestLine: a.bestLine || undefined,
        };
      });

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
