import { Router, Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { UserService } from "../services/userService";

const router = Router();
const userService = new UserService();

// Create user
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { chessComUsername, email } = req.body;

    if (!chessComUsername) {
      res.status(400).json({
        success: false,
        message: "Chess.com username is required",
      });
      return;
    }

    try {
      const user = await userService.createUser({
        chessComUsername: chessComUsername.toLowerCase().trim(),
        email: email?.trim() || undefined,
      });

      res.status(201).json({
        success: true,
        data: user,
        message: "User created successfully",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }
      if (error instanceof Error && error.message.includes("already exists")) {
        res.status(409).json({
          success: false,
          message: error.message,
        });
        return;
      }
      throw error; // Let asyncHandler catch it
    }
  })
);

// Get all users
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const users = await userService.getAllUsers();

    res.json({
      success: true,
      data: users,
      count: users.length,
    });
  })
);

// Get specific user
router.get(
  "/:userId",
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

    res.json({
      success: true,
      data: user,
    });
  })
);

// Update user
router.put(
  "/:userId",
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const updateData = req.body;

    try {
      const user = await userService.updateUser(userId, updateData);

      res.json({
        success: true,
        data: user,
        message: "User updated successfully",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }
      if (error instanceof Error && error.message.includes("already exists")) {
        res.status(409).json({
          success: false,
          message: error.message,
        });
        return;
      }
      throw error; // Let asyncHandler catch it
    }
  })
);

// Delete user
router.delete(
  "/:userId",
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    try {
      await userService.deleteUser(userId);

      res.json({
        success: true,
        message: "User deleted successfully",
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

export default router;
