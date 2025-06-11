import { prisma } from "../config/database";
import { ChessComService } from "./chesscomService";
import { PGNParser } from "../utils/pgnParser";
import { ChessComGame } from "../types/chesscom";

export interface ImportGameOptions {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  maxGames?: number;
}

export interface ImportProgress {
  current: number;
  total: number;
  percentage: number;
  status: "fetching" | "processing" | "complete" | "error";
  message: string;
}

export interface ImportResult {
  totalFetched: number;
  totalImported: number;
  totalSkipped: number;
  errors: string[];
  duration: number;
}

export class GameService {
  private chessComService: ChessComService;

  constructor() {
    this.chessComService = new ChessComService();
  }

  async importGamesForUser(
    options: ImportGameOptions,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const result: ImportResult = {
      totalFetched: 0,
      totalImported: 0,
      totalSkipped: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Get user and validate
      const user = await prisma.user.findUnique({
        where: { id: options.userId },
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Set default date range (last 3 months if not specified)
      const endDate = options.endDate || new Date();
      const startDate =
        options.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      onProgress?.({
        current: 0,
        total: 0,
        percentage: 0,
        status: "fetching",
        message: `Fetching games for ${user.chessComUsername}...`,
      });

      // Fetch games from Chess.com
      const chessComGames = await this.chessComService.getAllGamesInDateRange(
        user.chessComUsername,
        startDate,
        endDate,
        (current, total) => {
          onProgress?.({
            current,
            total,
            percentage: Math.round((current / total) * 50), // 50% for fetching
            status: "fetching",
            message: `Fetching month ${current} of ${total}...`,
          });
        }
      );

      result.totalFetched = chessComGames.length;

      if (chessComGames.length === 0) {
        onProgress?.({
          current: 1,
          total: 1,
          percentage: 100,
          status: "complete",
          message: "No games found in date range",
        });
        result.duration = Date.now() - startTime;
        return result;
      }

      // Limit games if specified
      const gamesToProcess = options.maxGames
        ? chessComGames.slice(0, options.maxGames)
        : chessComGames;

      onProgress?.({
        current: 0,
        total: gamesToProcess.length,
        percentage: 50,
        status: "processing",
        message: `Processing ${gamesToProcess.length} games...`,
      });

      // Process and import games
      for (let i = 0; i < gamesToProcess.length; i++) {
        const chessComGame = gamesToProcess[i];

        try {
          await this.importSingleGame(user.id, chessComGame);
          result.totalImported++;
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes("already exists")
          ) {
            result.totalSkipped++;
          } else {
            result.errors.push(
              `Game ${i + 1}: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
          }
        }

        // Update progress
        const progressPercentage =
          50 + Math.round(((i + 1) / gamesToProcess.length) * 50);
        onProgress?.({
          current: i + 1,
          total: gamesToProcess.length,
          percentage: progressPercentage,
          status: "processing",
          message: `Processed ${i + 1} of ${gamesToProcess.length} games`,
        });
      }

      onProgress?.({
        current: gamesToProcess.length,
        total: gamesToProcess.length,
        percentage: 100,
        status: "complete",
        message: `Import complete: ${result.totalImported} imported, ${result.totalSkipped} skipped`,
      });
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : "Unknown error"
      );
      onProgress?.({
        current: 0,
        total: 0,
        percentage: 0,
        status: "error",
        message: `Import failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  private async importSingleGame(
    userId: string,
    chessComGame: ChessComGame
  ): Promise<void> {
    // Extract Chess.com game ID from URL
    const gameId = this.extractGameId(chessComGame.url);

    // Check if game already exists
    const existingGame = await prisma.game.findUnique({
      where: { chessComGameId: gameId },
    });

    if (existingGame) {
      throw new Error(`Game ${gameId} already exists`);
    }

    // Parse PGN to validate and extract game info
    const gameInfo = PGNParser.extractGameInfo(chessComGame.pgn);

    // Convert Chess.com result to standard result
    const result = this.convertResult(
      chessComGame.white.result,
      chessComGame.black.result
    );

    // Create game record
    await prisma.game.create({
      data: {
        userId,
        chessComGameId: gameId,
        pgn: chessComGame.pgn,
        whitePlayer: chessComGame.white.username,
        blackPlayer: chessComGame.black.username,
        result,
        timeControl: chessComGame.time_control,
        whiteRating: chessComGame.white.rating,
        blackRating: chessComGame.black.rating,
        playedAt: new Date(chessComGame.end_time * 1000),
      },
    });
  }

  private extractGameId(gameUrl: string): string {
    // Extract game ID from Chess.com URL
    // URL format: https://www.chess.com/game/live/12345678901
    const match = gameUrl.match(/\/game\/[^\/]+\/(\d+)/);
    if (!match) {
      throw new Error(`Could not extract game ID from URL: ${gameUrl}`);
    }
    return match[1];
  }

  private convertResult(whiteResult: string, blackResult: string): string {
    if (whiteResult === "win") return "1-0";
    if (blackResult === "win") return "0-1";
    return "1/2-1/2"; // Draw or other result
  }

  async getUserGames(userId: string, limit = 20, offset = 0) {
    const games = await prisma.game.findMany({
      where: { userId },
      orderBy: { playedAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: { analysis: true },
        },
      },
    });

    const total = await prisma.game.count({
      where: { userId },
    });

    return {
      games: games.map((game) => ({
        ...game,
        analysisCount: game._count.analysis,
      })),
      total,
      hasMore: offset + limit < total,
    };
  }

  async getGame(gameId: string) {
    return await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        user: {
          select: {
            id: true,
            chessComUsername: true,
          },
        },
        analysis: {
          orderBy: { moveNumber: "asc" },
        },
      },
    });
  }

  async deleteGame(gameId: string): Promise<void> {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new Error("Game not found");
    }

    await prisma.game.delete({
      where: { id: gameId },
    });
  }
}
