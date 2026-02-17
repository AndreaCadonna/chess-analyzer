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

// ===== STREAMING ANALYSIS =====

export interface StreamProgress {
  current: number;
  total: number;
  percentage: number;
  status: string;
  message: string;
}

export interface StreamCallbacks {
  onProgress: (progress: StreamProgress) => void;
  onComplete: (analysis: any) => void;
  onError: (message: string) => void;
}

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";

export const startGameAnalysisStream = (
  gameId: string,
  options: {
    depth?: number;
  },
  callbacks: StreamCallbacks
): AbortController => {
  const controller = new AbortController();

  const run = async () => {
    let response: Response;
    try {
      response = await fetch(
        `${API_BASE_URL}/analysis/games/${gameId}/analyze/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options),
          signal: controller.signal,
        }
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        callbacks.onError(
          err instanceof Error ? err.message : "Network error"
        );
      }
      return;
    }

    // Non-SSE response means a validation error (JSON)
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      try {
        const json = await response.json();
        callbacks.onError(json.message || `Server error (${response.status})`);
      } catch {
        callbacks.onError(`Server error (${response.status})`);
      }
      return;
    }

    // Read the SSE stream
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep incomplete last line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            switch (event.type) {
              case "progress":
                callbacks.onProgress(event.data);
                break;
              case "complete":
                callbacks.onComplete(event.data.analysis);
                break;
              case "error":
                callbacks.onError(event.data.message);
                break;
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        callbacks.onError(
          err instanceof Error ? err.message : "Stream interrupted"
        );
      }
    }
  };

  run();
  return controller;
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