import { Request, Response, NextFunction } from "express";
import { UserService } from "../services/userService";

const userService = new UserService();

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chessComUsername, email } = req.body;

    if (!chessComUsername) {
      return res.status(400).json({
        success: false,
        message: "Chess.com username is required",
      });
    }

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
    next(error);
  }
};

export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    const user = await userService.getUser(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const users = await userService.getAllUsers();

    res.json({
      success: true,
      data: users,
      count: users.length,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    const user = await userService.updateUser(userId, updateData);

    res.json({
      success: true,
      data: user,
      message: "User updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    await userService.deleteUser(userId);

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
