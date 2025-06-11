// frontend/src/types/api.ts
export interface User {
  id: string;
  chessComUsername: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  gameCount: number;
  lastImport: string | null;
}

export interface Game {
  id: string;
  userId: string;
  chessComGameId: string;
  pgn: string;
  whitePlayer: string;
  blackPlayer: string;
  result: string;
  timeControl: string;
  whiteRating: number | null;
  blackRating: number | null;
  playedAt: string;
  importedAt: string;
}

export interface ImportProgress {
  current: number;
  total: number;
  percentage: number;
  status: "fetching" | "processing" | "complete" | "error";
  message: string;
  timestamp: string;
}

export interface ImportResult {
  totalFetched: number;
  totalImported: number;
  totalSkipped: number;
  errors: string[];
  duration: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export interface CreateUserRequest {
  chessComUsername: string;
  email?: string;
}

export interface ImportGamesRequest {
  startDate?: string;
  endDate?: string;
  maxGames?: number;
}
