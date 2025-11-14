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

    // Calculate accuracy for white and black
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whiteMoves = details.filter((m: any) => m.moveNumber % 2 === 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blackMoves = details.filter((m: any) => m.moveNumber % 2 === 0);

    const whiteGoodMoves = whiteMoves.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m: any) =>
        m.mistakeSeverity === "good" || m.mistakeSeverity === "excellent"
    ).length;
    const blackGoodMoves = blackMoves.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
