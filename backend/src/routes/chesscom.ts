import { Router, Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { ChessComService } from "../services/chesscomService";

const router = Router();
const chessComService = new ChessComService();

// Get player profile
router.get(
  "/player/:username",
  asyncHandler(async (req: Request, res: Response) => {
    const { username } = req.params;

    if (!username) {
      res.status(400).json({
        success: false,
        message: "Username is required",
      });
      return;
    }

    try {
      const player = await chessComService.getPlayer(username);

      res.json({
        success: true,
        data: player,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }
      throw error; // Let asyncHandler catch it
    }
  })
);

// Get player game archives
router.get(
  "/player/:username/archives",
  asyncHandler(async (req: Request, res: Response) => {
    const { username } = req.params;

    const archives = await chessComService.getPlayerGameArchives(username);

    res.json({
      success: true,
      data: archives,
      count: archives.length,
    });
  })
);

// Get games for specific month
router.get(
  "/player/:username/games/:year/:month",
  asyncHandler(async (req: Request, res: Response) => {
    const { username, year, month } = req.params;

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      res.status(400).json({
        success: false,
        message: "Invalid year or month",
      });
      return;
    }

    const games = await chessComService.getMonthlyGames(
      username,
      yearNum,
      monthNum
    );

    res.json({
      success: true,
      data: games,
      count: games.length,
    });
  })
);

export default router;
