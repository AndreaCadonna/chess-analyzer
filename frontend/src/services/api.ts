// frontend/src/services/api.ts - Enhanced version
import axios from "axios";

import type { User } from "../types/api";
import type { Game } from "../types/api";
import type { ApiResponse } from "../types/api";
import type { CreateUserRequest } from "../types/api";
import type { ImportGamesRequest } from "../types/api";
import type { ImportResult } from "../types/api";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 seconds for imports
});

// Health check
export const healthCheck = async () => {
  const response = await api.get("/health");
  return response.data;
};

// ===== USER MANAGEMENT =====

export const createUser = async (
  userData: CreateUserRequest
): Promise<User> => {
  const response = await api.post<ApiResponse<User>>("/users", userData);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || "Failed to create user");
  }
  return response.data.data;
};

export const getUser = async (userId: string): Promise<User> => {
  const response = await api.get<ApiResponse<User>>(`/users/${userId}`);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || "User not found");
  }
  return response.data.data;
};

export const getAllUsers = async (): Promise<User[]> => {
  const response = await api.get<ApiResponse<User[]>>("/users");
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || "Failed to fetch users");
  }
  return response.data.data;
};

export const updateUser = async (
  userId: string,
  userData: Partial<CreateUserRequest>
): Promise<User> => {
  const response = await api.put<ApiResponse<User>>(
    `/users/${userId}`,
    userData
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || "Failed to update user");
  }
  return response.data.data;
};

export const deleteUser = async (userId: string): Promise<void> => {
  const response = await api.delete<ApiResponse<void>>(`/users/${userId}`);
  if (!response.data.success) {
    throw new Error(response.data.message || "Failed to delete user");
  }
};

// ===== CHESS.COM INTEGRATION =====

export const validateChessComUsername = async (
  username: string
): Promise<boolean> => {
  try {
    const response = await api.get(`/chesscom/player/${username}`);
    return response.data.success;
  } catch {
    return false;
  }
};

export const getChessComPlayerProfile = async (username: string) => {
  const response = await api.get(`/chesscom/player/${username}`);
  if (!response.data.success) {
    throw new Error(response.data.message || "Player not found");
  }
  return response.data.data;
};

// ===== GAME MANAGEMENT =====

export const getUserGames = async (
  userId: string,
  limit = 20,
  offset = 0
): Promise<{
  games: Game[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}> => {
  const response = await api.get<ApiResponse<Game[]>>(
    `/games/user/${userId}?limit=${limit}&offset=${offset}`
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || "Failed to fetch games");
  }
  return {
    games: response.data.data,
    pagination: response.data.pagination!,
  };
};

export const getGame = async (gameId: string): Promise<Game> => {
  const response = await api.get<ApiResponse<Game>>(`/games/${gameId}`);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || "Game not found");
  }
  return response.data.data;
};

export const deleteGame = async (gameId: string): Promise<void> => {
  const response = await api.delete<ApiResponse<void>>(`/games/${gameId}`);
  if (!response.data.success) {
    throw new Error(response.data.message || "Failed to delete game");
  }
};

// ===== GAME IMPORT =====

export const importUserGames = async (
  userId: string,
  options: ImportGamesRequest = {}
): Promise<{ importResult: ImportResult; progress: unknown[] }> => {
  const response = await api.post<
    ApiResponse<{ importResult: ImportResult; progress: unknown[] }>
  >(`/games/user/${userId}/import`, options);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.message || "Import failed");
  }
  return response.data.data;
};

export const getImportHistory = async (userId: string) => {
  const response = await api.get(`/games/user/${userId}/import/history`);
  if (!response.data.success) {
    throw new Error(response.data.message || "Failed to fetch import history");
  }
  return response.data.data;
};

// ===== ERROR HANDLING =====

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    if (error.code === "ECONNABORTED") {
      throw new Error("Request timeout - operation took too long");
    }
    if (error.code === "ERR_NETWORK") {
      throw new Error("Network error - please check your connection");
    }
    throw error;
  }
);
