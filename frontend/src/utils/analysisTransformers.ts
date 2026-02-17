// frontend/src/utils/analysisTransformers.ts

/**
 * Standardized GameAnalysis interface that matches backend
 */
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
    centipawnLoss?: number;
    winProbabilityLoss?: number;
    analysisDepth?: number;
    positionFen?: string;
    bestLine?: string;
  }>;
}

/**
 * Simplified AnalysisResult interface for display
 */
export interface AnalysisResult {
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

/**
 * Create an empty GameAnalysis structure
 */
export const createEmptyGameAnalysis = (gameId: string): GameAnalysis => {
  return {
    gameId,
    totalMoves: 0,
    analyzedMoves: 0,
    accuracy: { white: 0, black: 0, overall: 0 },
    mistakes: { blunders: 0, mistakes: 0, inaccuracies: 0 },
    analysisDetails: [],
  };
};

/**
 * Convert centipawn evaluation to win probability percentage (0-100).
 * Uses the Lichess sigmoid model.
 */
const cpToWinProbability = (cp: number): number => {
  return 100 / (1 + Math.exp(-0.00368208 * cp));
};

/**
 * Convert average Win-Change-Loss (WCL) to an accuracy percentage (0-100).
 * Uses the Lichess accuracy formula. WCL is on a 0-50 scale.
 */
const wclToAccuracy = (wcl: number): number => {
  if (wcl < 0) return 100;
  const accuracy = 103.1668 * Math.exp(-0.04354 * wcl) - 3.1669;
  return Math.max(0, Math.min(100, accuracy));
};

/**
 * Estimate centipawn loss from a severity classification for legacy data.
 */
const estimateCentipawnLossFromSeverity = (severity?: string): number => {
  switch (severity) {
    case "blunder": return 350;
    case "mistake": return 200;
    case "inaccuracy": return 75;
    case "good": return 25;
    case "excellent": return 5;
    default: return 25;
  }
};

/**
 * Estimate win-probability loss from centipawn loss and stored evaluation.
 * Used for legacy data that doesn't have winProbabilityLoss stored.
 */
const estimateWplFromCentipawnLoss = (cpLoss: number, storedEval: number, moveNumber: number): number => {
  const isWhiteMove = moveNumber % 2 === 1;
  const bestEvalMoverPerspective = isWhiteMove ? storedEval : -storedEval;
  const playerEvalMoverPerspective = bestEvalMoverPerspective - cpLoss;
  const wpl = cpToWinProbability(bestEvalMoverPerspective) - cpToWinProbability(playerEvalMoverPerspective);
  return Math.max(0, wpl);
};

/**
 * Convert any analysis data structure to standardized GameAnalysis format
 * Handles both new GameAnalysis structure and legacy array-based structure
 */
export const convertToGameAnalysis = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const details = analysisData.map((move: any) => {
      const cpLoss = move.centipawnLoss ?? estimateCentipawnLossFromSeverity(move.mistakeSeverity);
      const wpl = move.winProbabilityLoss ?? estimateWplFromCentipawnLoss(cpLoss, move.stockfishEvaluation, move.moveNumber);
      return {
        moveNumber: move.moveNumber,
        playerMove: move.playerMove,
        evaluation: move.stockfishEvaluation,
        bestMove: move.bestMove,
        mistakeSeverity: move.mistakeSeverity,
        centipawnLoss: cpLoss,
        winProbabilityLoss: wpl,
        analysisDepth: move.analysisDepth,
        positionFen: move.positionFen,
        bestLine: move.bestLine,
      };
    });

    // Calculate statistics from the array
    const totalMoves = details.length;
    const mistakes = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blunders: details.filter((m: any) => m.mistakeSeverity === "blunder")
        .length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mistakes: details.filter((m: any) => m.mistakeSeverity === "mistake")
        .length,
      inaccuracies: details.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m: any) => m.mistakeSeverity === "inaccuracy"
      ).length,
    };

    // Calculate accuracy using average Win-probability Change Loss (WCL)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whiteMoves = details.filter((m: any) => m.moveNumber % 2 === 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blackMoves = details.filter((m: any) => m.moveNumber % 2 === 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whiteWCL = whiteMoves.length > 0
      ? whiteMoves.reduce((sum: number, m: any) => sum + (m.winProbabilityLoss || 0), 0) / whiteMoves.length
      : 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blackWCL = blackMoves.length > 0
      ? blackMoves.reduce((sum: number, m: any) => sum + (m.winProbabilityLoss || 0), 0) / blackMoves.length
      : 0;
    const overallWCL = totalMoves > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? details.reduce((sum: number, m: any) => sum + (m.winProbabilityLoss || 0), 0) / totalMoves
      : 0;

    return {
      gameId,
      totalMoves,
      analyzedMoves: totalMoves,
      accuracy: {
        white: Math.round(wclToAccuracy(whiteWCL) * 100) / 100,
        black: Math.round(wclToAccuracy(blackWCL) * 100) / 100,
        overall: Math.round(wclToAccuracy(overallWCL) * 100) / 100,
      },
      mistakes,
      analysisDetails: details,
    };
  }

  // Unknown structure - return empty
  console.warn("Unknown analysis data structure:", analysisData);
  return createEmptyGameAnalysis(gameId);
};

/**
 * Calculate analysis result summary from GameAnalysis data
 */
export const calculateAnalysisResult = (
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
