import { Chess } from "chess.js";
import { prisma } from "../config/database";
import {
  getStockfishService,
  AnalysisOptions,
  MoveClassification,
} from "./stockfishService";

export interface GameAnalysisProgress {
  gameId: string;
  currentMove: number;
  totalMoves: number;
  percentage: number;
  status: "analyzing" | "complete" | "error";
  message: string;
}

export interface GameAnalysisResult {
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

export interface AnalysisJobOptions {
  depth?: number;
  skipOpeningMoves?: number;
  maxPositions?: number;
  onProgress?: (progress: GameAnalysisProgress) => void;
}

export class AnalysisService {
  private activeJobs = new Map<string, boolean>();

  async analyzeGame(
    gameId: string,
    options: AnalysisJobOptions = {}
  ): Promise<GameAnalysisResult> {
    if (this.activeJobs.get(gameId)) {
      throw new Error("Game analysis already in progress");
    }

    this.activeJobs.set(gameId, true);

    try {
      console.log(`🔬 Starting analysis for game: ${gameId}`);

      // Get game data
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { user: true },
      });

      if (!game) {
        throw new Error("Game not found");
      }

      // Check if already analyzed
      const existingAnalysis = await prisma.analysis.findFirst({
        where: { gameId },
      });

      if (existingAnalysis) {
        console.log(
          `⚠️ Game ${gameId} already has analysis. Deleting existing analysis...`
        );
        await prisma.analysis.deleteMany({
          where: { gameId },
        });
      }

      const startTime = Date.now();
      const stockfish = await getStockfishService();

      // Parse the game
      const chess = new Chess();
      chess.loadPgn(game.pgn);

      const history = chess.history({ verbose: true });
      const skipMoves = options.skipOpeningMoves || 6; // Skip first 6 moves (opening theory)
      const maxPositions = options.maxPositions || 50; // Limit positions to analyze

      // Filter positions to analyze
      const positionsToAnalyze = history.slice(
        skipMoves,
        skipMoves + maxPositions
      );

      console.log(
        `📊 Analyzing ${positionsToAnalyze.length} positions (skipped first ${skipMoves} moves)`
      );

      // Track analysis data
      const analysisData: Array<{
        moveNumber: number;
        fen: string;
        move: string;
        evaluation: number;
        bestMove: string;
        bestLine: string;
        depth: number;
        timeSpent: number;
        classification: string;
        centipawnLoss: number;
      }> = [];

      let previousEvaluation = 0; // Starting position evaluation

      // Analyze each position
      for (let i = 0; i < positionsToAnalyze.length; i++) {
        const move = positionsToAnalyze[i];
        const moveNumber = skipMoves + i + 1;

        // Report progress
        const progress: GameAnalysisProgress = {
          gameId,
          currentMove: i + 1,
          totalMoves: positionsToAnalyze.length,
          percentage: Math.round(((i + 1) / positionsToAnalyze.length) * 100),
          status: "analyzing",
          message: `Analyzing move ${moveNumber}: ${move.san}`,
        };

        options.onProgress?.(progress);
        console.log(`🔍 ${progress.message} (${progress.percentage}%)`);

        try {
          // Get position after the move
          const tempChess = new Chess();
          tempChess.loadPgn(game.pgn);

          // Play moves up to current position
          const movesToPlay = history.slice(0, skipMoves + i + 1);
          for (const moveToPlay of movesToPlay) {
            tempChess.move(moveToPlay.san);
          }

          const currentFen = tempChess.fen();

          // Analyze position
          const analysis = await stockfish.analyzePosition(currentFen, {
            depth: options.depth || 15,
            timeLimit: 3000, // 3 seconds per position
          });

          // Classify the move
          const classification = stockfish.classifyMove(
            previousEvaluation,
            analysis.evaluation
          );

          // Store analysis data
          analysisData.push({
            moveNumber,
            fen: currentFen,
            move: move.san,
            evaluation: analysis.evaluation,
            bestMove: analysis.bestMove,
            bestLine: analysis.bestLine.join(" "),
            depth: analysis.depth,
            timeSpent: analysis.timeSpent,
            classification: classification.classification,
            centipawnLoss: classification.centipawnLoss,
          });

          previousEvaluation = analysis.evaluation;
        } catch (error) {
          console.error(`❌ Error analyzing move ${moveNumber}:`, error);

          // Store error analysis
          analysisData.push({
            moveNumber,
            fen: "",
            move: move.san,
            evaluation: previousEvaluation,
            bestMove: "error",
            bestLine: "Analysis failed",
            depth: 0,
            timeSpent: 0,
            classification: "good", // Default to avoid counting as mistake
            centipawnLoss: 0,
          });
        }

        // Small delay to prevent overwhelming the engine
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Save analysis to database
      console.log(
        `💾 Saving ${analysisData.length} analysis records to database`
      );

      const analysisRecords = analysisData.map((data) => ({
        gameId,
        positionFen: data.fen,
        moveNumber: data.moveNumber,
        playerMove: data.move,
        stockfishEvaluation: data.evaluation,
        bestMove: data.bestMove,
        bestLine: data.bestLine,
        analysisDepth: data.depth,
        mistakeSeverity: data.classification,
        timeSpentMs: data.timeSpent,
      }));

      await prisma.analysis.createMany({
        data: analysisRecords,
      });

      // Calculate final statistics
      const analysisTime = Date.now() - startTime;
      const result = this.calculateGameStatistics(
        gameId,
        analysisData,
        analysisTime
      );

      // Final progress update
      options.onProgress?.({
        gameId,
        currentMove: positionsToAnalyze.length,
        totalMoves: positionsToAnalyze.length,
        percentage: 100,
        status: "complete",
        message: `Analysis complete! Found ${result.mistakes.blunders} blunders, ${result.mistakes.mistakes} mistakes`,
      });

      console.log(`✅ Game analysis complete for ${gameId}:`, result);

      return result;
    } catch (error) {
      console.error(`❌ Game analysis failed for ${gameId}:`, error);

      options.onProgress?.({
        gameId,
        currentMove: 0,
        totalMoves: 0,
        percentage: 0,
        status: "error",
        message: `Analysis failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });

      throw error;
    } finally {
      this.activeJobs.delete(gameId);
    }
  }

  private calculateGameStatistics(
    gameId: string,
    analysisData: Array<{
      classification: string;
      centipawnLoss: number;
      moveNumber: number;
    }>,
    analysisTime: number
  ): GameAnalysisResult {
    const totalPositions = analysisData.length;
    const analyzedPositions = analysisData.filter(
      (d) => d.classification !== "error"
    ).length;

    // Count mistakes by type
    let blunders = 0;
    let mistakes = 0;
    let inaccuracies = 0;

    for (const data of analysisData) {
      switch (data.classification) {
        case "blunder":
          blunders++;
          break;
        case "mistake":
          mistakes++;
          break;
        case "inaccuracy":
          inaccuracies++;
          break;
      }
    }

    // Calculate accuracy by color (simplified)
    // White plays on odd move numbers, Black on even
    const whiteMoves = analysisData.filter((d) => d.moveNumber % 2 === 1);
    const blackMoves = analysisData.filter((d) => d.moveNumber % 2 === 0);

    const calculateAccuracy = (moves: typeof analysisData) => {
      if (moves.length === 0) return 100;

      const totalCentipawnLoss = moves.reduce(
        (sum, move) => sum + move.centipawnLoss,
        0
      );
      const averageLoss = totalCentipawnLoss / moves.length;

      // Convert centipawn loss to accuracy percentage (simplified formula)
      // Perfect play = 100%, higher loss = lower accuracy
      return Math.max(0, Math.min(100, 100 - averageLoss / 10));
    };

    return {
      gameId,
      totalPositions,
      analyzedPositions,
      analysisTime,
      averageDepth: 15, // Fixed for now
      mistakes: {
        blunders,
        mistakes,
        inaccuracies,
      },
      accuracy: {
        white: Math.round(calculateAccuracy(whiteMoves) * 100) / 100,
        black: Math.round(calculateAccuracy(blackMoves) * 100) / 100,
      },
    };
  }

  async getGameAnalysis(gameId: string) {
    return await prisma.analysis.findMany({
      where: { gameId },
      orderBy: { moveNumber: "asc" },
      include: {
        game: {
          select: {
            whitePlayer: true,
            blackPlayer: true,
            result: true,
            pgn: true,
          },
        },
      },
    });
  }

  async deleteGameAnalysis(gameId: string): Promise<void> {
    await prisma.analysis.deleteMany({
      where: { gameId },
    });
  }

  isAnalyzing(gameId: string): boolean {
    return this.activeJobs.get(gameId) || false;
  }

  async getAnalysisStats(userId: string) {
    // Get analysis statistics for all user's games
    const games = await prisma.game.findMany({
      where: { userId },
      include: {
        analysis: {
          select: {
            mistakeSeverity: true,
            stockfishEvaluation: true,
          },
        },
      },
    });

    let totalAnalyzedGames = 0;
    let totalBlunders = 0;
    let totalMistakes = 0;
    let totalInaccuracies = 0;
    let totalPositions = 0;

    for (const game of games) {
      if (game.analysis.length > 0) {
        totalAnalyzedGames++;
        totalPositions += game.analysis.length;

        for (const analysis of game.analysis) {
          switch (analysis.mistakeSeverity) {
            case "blunder":
              totalBlunders++;
              break;
            case "mistake":
              totalMistakes++;
              break;
            case "inaccuracy":
              totalInaccuracies++;
              break;
          }
        }
      }
    }

    return {
      totalGames: games.length,
      analyzedGames: totalAnalyzedGames,
      totalPositions,
      mistakes: {
        blunders: totalBlunders,
        mistakes: totalMistakes,
        inaccuracies: totalInaccuracies,
      },
      averageMistakesPerGame:
        totalAnalyzedGames > 0
          ? Math.round(
              ((totalBlunders + totalMistakes + totalInaccuracies) /
                totalAnalyzedGames) *
                100
            ) / 100
          : 0,
    };
  }
}
