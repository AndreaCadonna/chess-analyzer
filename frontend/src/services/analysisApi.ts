import { api } from "./api";

export interface Analysis {
  id: string;
  gameId: string;
  positionFen: string;
  moveNumber: number;
  playerMove: string;
  stockfishEvaluation: number;
  bestMove: string;
  bestLine: string | null;
  analysisDepth: number;
  mistakeSeverity: string | null;
  timeSpentMs: number | null;
  createdAt: string;
}

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

export interface AnalysisProgress {
  gameId: string;
  currentMove: number;
  totalMoves: number;
  percentage: number;
  status: 'analyzing' | 'complete' | 'error';
  message: string;
  timestamp: string;
}

export interface EngineStatus {
  engineReady: boolean;
  engineType: string;
  version: string;
  error?: string;
}

export interface PositionAnalysis {
  fen: string;
  evaluation: number;
  bestMove: string;
  bestLine: string[];
  depth: number;
  timeSpent: number;
  pv: string;
}

export interface AnalysisStats {
  totalGames: number;
  analyzedGames: number;
  totalPositions: number;
  mistakes: {
    blunders: number;
    mistakes: number;
    inaccuracies: number;
  };
  averageMistakesPerGame: number;
}

// ===== GAME ANALYSIS =====

export const startGameAnalysis = async (
  gameId: string,
  options: {
    depth?: number;
    skipOpeningMoves?: number;
    maxPositions?: number;
  } = {}
): Promise<{ analysis: AnalysisResult; progress: AnalysisProgress[] }> => {
  const response = await api.post(`/analysis/games/${gameId}/analyze`, options);
  if (!response.data.success) {
    throw new Error(response.data.message || "Analysis failed");
  }
  return response.data.data;
};

export const getGameAnalysis = async (gameId: string): Promise<Analysis[]> => {
  const response = await api.get(`/analysis/games/${gameId}/analysis`);
  if (!response.data.success) {
    throw new Error(response.data.message || "Failed to fetch analysis");
  }
  return response.data.data;
};

export const deleteGameAnalysis = async (gameId: string): Promise<void> => {
  const response = await api.delete(`/analysis/games/${gameId}/analysis`);
  if (!response.data.success) {
    throw new Error(response.data.message || "Failed to delete analysis");
  }
};

export const getAnalysisStatus = async (gameId: string): Promise<{
  isAnalyzing: boolean;
  hasExistingAnalysis: boolean;
  analysisCount: number;
}> => {
  const response = await api.get(`/analysis/games/${gameId}/analysis/status`);
  if (!response.data.success) {
    throw new Error(response.data.message || "Failed to check analysis status");
  }
  return response.data.data;
};

// ===== POSITION ANALYSIS =====

export const analyzePosition = async (
  fen: string,
  options: {
    depth?: number;
    timeLimit?: number;
  } = {}
): Promise<PositionAnalysis> => {
  const response = await api.post("/analysis/position/analyze", {
    fen,
    ...options,
  });
  if (!response.data.success) {
    throw new Error(response.data.message || "Position analysis failed");
  }
  return response.data.data;
};

// ===== ENGINE STATUS =====

export const getEngineStatus = async (): Promise<EngineStatus> => {
  const response = await api.get("/analysis/engine/status");
  if (!response.data.success) {
    throw new Error(response.data.message || "Failed to get engine status");
  }
  return response.data.data;
};

// ===== USER STATISTICS =====

export const getUserAnalysisStats = async (userId: string): Promise<AnalysisStats> => {
  const response = await api.get(`/analysis/users/${userId}/stats`);
  if (!response.data.success) {
    throw new Error(response.data.message || "Failed to fetch analysis stats");
  }
  return response.data.data;
};

// ===== UTILITY FUNCTIONS =====

export const formatEvaluation = (evaluation: number): string => {
  if (Math.abs(evaluation) >= 1000) {
    const mateIn = Math.ceil(evaluation > 0 ? evaluation / 1000 : -evaluation / 1000);
    return evaluation > 0 ? `+M${mateIn}` : `-M${mateIn}`;
  }
  
  const pawns = evaluation / 100;
  return pawns > 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
};

export const getMistakeColor = (severity: string | null): string => {
  switch (severity) {
    case 'blunder':
      return '#dc3545'; // Red
    case 'mistake':
      return '#fd7e14'; // Orange
    case 'inaccuracy':
      return '#ffc107'; // Yellow
    case 'excellent':
      return '#28a745'; // Green
    case 'good':
      return '#20c997'; // Teal
    default:
      return '#6c757d'; // Gray
  }
};

export const getMistakeIcon = (severity: string | null): string => {
  switch (severity) {
    case 'blunder':
      return '💥';
    case 'mistake':
      return '❌';
    case 'inaccuracy':
      return '⚠️';
    case 'excellent':
      return '✨';
    case 'good':
      return '✓';
    default:
      return '•';
  }
};