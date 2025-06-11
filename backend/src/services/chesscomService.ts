import { HttpClient } from "./httpClient";
import {
  ChessComPlayer,
  ChessComGame,
  ChessComMonthlyGames,
  ChessComArchives,
} from "../types/chesscom";

export class ChessComService {
  private httpClient: HttpClient;
  private lastRequestTime: number = 0;
  private minRequestInterval: number;

  constructor() {
    this.httpClient = new HttpClient(
      process.env.CHESS_COM_API_BASE_URL || "https://api.chess.com/pub"
    );
    this.minRequestInterval = parseInt(
      process.env.CHESS_COM_RATE_LIMIT_MS || "1000"
    );
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  async getPlayer(username: string): Promise<ChessComPlayer> {
    await this.rateLimit();

    try {
      return await this.httpClient.get<ChessComPlayer>(`/player/${username}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        throw new Error(`Player '${username}' not found on Chess.com`);
      }
      throw new Error(
        `Failed to fetch player data: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getPlayerGameArchives(username: string): Promise<string[]> {
    await this.rateLimit();

    try {
      const archives = await this.httpClient.get<ChessComArchives>(
        `/player/${username}/games/archives`
      );
      return archives.archives;
    } catch (error) {
      throw new Error(
        `Failed to fetch game archives: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getMonthlyGames(
    username: string,
    year: number,
    month: number
  ): Promise<ChessComGame[]> {
    await this.rateLimit();

    const monthPadded = month.toString().padStart(2, "0");

    try {
      const data = await this.httpClient.get<ChessComMonthlyGames>(
        `/player/${username}/games/${year}/${monthPadded}`
      );
      return data.games || [];
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        // No games for this month - that's ok
        return [];
      }
      throw new Error(
        `Failed to fetch monthly games: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getAllGamesInDateRange(
    username: string,
    startDate: Date,
    endDate: Date,
    onProgress?: (current: number, total: number) => void
  ): Promise<ChessComGame[]> {
    const allGames: ChessComGame[] = [];
    const monthsToFetch: Array<{ year: number; month: number }> = [];

    // Generate list of months to fetch
    const current = new Date(startDate);
    while (current <= endDate) {
      monthsToFetch.push({
        year: current.getFullYear(),
        month: current.getMonth() + 1,
      });
      current.setMonth(current.getMonth() + 1);
    }

    // Fetch games for each month
    for (let i = 0; i < monthsToFetch.length; i++) {
      const { year, month } = monthsToFetch[i];

      try {
        const monthlyGames = await this.getMonthlyGames(username, year, month);

        // Filter games by date range
        const filteredGames = monthlyGames.filter((game) => {
          const gameDate = new Date(game.end_time * 1000);
          return gameDate >= startDate && gameDate <= endDate;
        });

        allGames.push(...filteredGames);

        if (onProgress) {
          onProgress(i + 1, monthsToFetch.length);
        }
      } catch (error) {
        console.warn(`Failed to fetch games for ${year}-${month}:`, error);
        // Continue with other months
      }
    }

    return allGames;
  }
}
