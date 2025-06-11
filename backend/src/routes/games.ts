// backend/src/routes/games.ts
import { Router, Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { GameService } from "../services/gameService";
import { UserService } from "../services/userService";

const router = Router();
const gameService = new GameService();
const userService = new UserService();

// Get user's games with pagination and filtering
router.get(
  "/user/:userId",
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { limit = "20", offset = "0", search } = req.query;

    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);

    if (isNaN(limitNum) || isNaN(offsetNum) || limitNum > 100) {
      res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
      return;
    }

    try {
      const games = await gameService.getUserGames(userId, limitNum, offsetNum);
      const totalGames = await gameService.getUserGameCount(userId);

      res.json({
        success: true,
        data: games,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          total: totalGames,
          hasMore: offsetNum + limitNum < totalGames,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }
      throw error;
    }
  })
);

// Start game import for a user
router.post(
  "/user/:userId/import",
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { startDate, endDate, maxGames } = req.body;

    // Validate user exists
    const user = await userService.getUser(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Validate dates if provided
    let parsedStartDate: Date | undefined;
    let parsedEndDate: Date | undefined;

    if (startDate) {
      parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) {
        res.status(400).json({
          success: false,
          message: "Invalid start date format",
        });
        return;
      }
    }

    if (endDate) {
      parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        res.status(400).json({
          success: false,
          message: "Invalid end date format",
        });
        return;
      }
    }

    // Validate maxGames if provided
    if (maxGames && (isNaN(maxGames) || maxGames < 1 || maxGames > 1000)) {
      res.status(400).json({
        success: false,
        message: "maxGames must be between 1 and 1000",
      });
      return;
    }

    try {
      // Store progress updates to send via response
      const progressUpdates: any[] = [];

      const result = await gameService.importGamesForUser(
        {
          userId,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
          maxGames: maxGames ? parseInt(maxGames) : undefined,
        },
        (progress) => {
          progressUpdates.push({
            ...progress,
            timestamp: new Date().toISOString(),
          });
        }
      );

      res.json({
        success: true,
        data: {
          importResult: result,
          progress: progressUpdates,
        },
        message: `Import completed: ${result.totalImported} games imported, ${result.totalSkipped} skipped`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Import failed",
      });
    }
  })
);

// Get import status/history for a user
router.get(
  "/user/:userId/import/history",
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    const user = await userService.getUser(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Get recent imports summary
    const recentGames = await gameService.getUserGames(userId, 10, 0);
    const totalGames = await gameService.getUserGameCount(userId);
    const lastImport =
      recentGames.games.length > 0 ? recentGames.games[0].importedAt : null;

    res.json({
      success: true,
      data: {
        totalGames,
        lastImport,
        recentGames: recentGames.games.slice(0, 5), // Just show 5 most recent
        user: {
          id: user.id,
          chessComUsername: user.chessComUsername,
          gameCount: user.gameCount,
        },
      },
    });
  })
);

// Get specific game details
router.get(
  "/:gameId",
  asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;

    try {
      const game = await gameService.getGameById(gameId);

      if (!game) {
        res.status(404).json({
          success: false,
          message: "Game not found",
        });
        return;
      }

      res.json({
        success: true,
        data: game,
      });
    } catch (error) {
      throw error;
    }
  })
);

// Delete a specific game
router.delete(
  "/:gameId",
  asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;

    try {
      await gameService.deleteGame(gameId);

      res.json({
        success: true,
        message: "Game deleted successfully",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }
      throw error;
    }
  })
);

export default router;
