import { prisma } from "../config/database";
import { ChessComService } from "./chesscomService";

export interface CreateUserData {
  chessComUsername: string;
  email?: string;
}

export interface UserWithStats {
  id: string;
  chessComUsername: string;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;
  gameCount: number;
  lastImport: Date | null;
}

export class UserService {
  private chessComService: ChessComService;

  constructor() {
    this.chessComService = new ChessComService();
  }

  async createUser(userData: CreateUserData): Promise<UserWithStats> {
    // Verify Chess.com username exists
    try {
      await this.chessComService.getPlayer(userData.chessComUsername);
    } catch (error) {
      throw new Error(
        `Chess.com user '${userData.chessComUsername}' not found`
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { chessComUsername: userData.chessComUsername },
    });

    if (existingUser) {
      throw new Error(
        `User with Chess.com username '${userData.chessComUsername}' already exists`
      );
    }

    // Create user
    const user = await prisma.user.create({
      data: userData,
      include: {
        _count: {
          select: { games: true },
        },
      },
    });

    return {
      id: user.id,
      chessComUsername: user.chessComUsername,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      gameCount: user._count.games,
      lastImport: null,
    };
  }

  async getUser(userId: string): Promise<UserWithStats | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: { games: true },
        },
        games: {
          orderBy: { importedAt: "desc" },
          take: 1,
          select: { importedAt: true },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      chessComUsername: user.chessComUsername,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      gameCount: user._count.games,
      lastImport: user.games[0]?.importedAt || null,
    };
  }

  async getAllUsers(): Promise<UserWithStats[]> {
    const users = await prisma.user.findMany({
      include: {
        _count: {
          select: { games: true },
        },
        games: {
          orderBy: { importedAt: "desc" },
          take: 1,
          select: { importedAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return users.map((user) => ({
      id: user.id,
      chessComUsername: user.chessComUsername,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      gameCount: user._count.games,
      lastImport: user.games[0]?.importedAt || null,
    }));
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Delete user (cascades to games and analysis)
    await prisma.user.delete({
      where: { id: userId },
    });
  }

  async updateUser(
    userId: string,
    updateData: Partial<CreateUserData>
  ): Promise<UserWithStats> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // If updating Chess.com username, verify it exists
    if (
      updateData.chessComUsername &&
      updateData.chessComUsername !== user.chessComUsername
    ) {
      try {
        await this.chessComService.getPlayer(updateData.chessComUsername);
      } catch (error) {
        throw new Error(
          `Chess.com user '${updateData.chessComUsername}' not found`
        );
      }

      // Check if new username is already taken
      const existingUser = await prisma.user.findUnique({
        where: { chessComUsername: updateData.chessComUsername },
      });

      if (existingUser) {
        throw new Error(
          `User with Chess.com username '${updateData.chessComUsername}' already exists`
        );
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        _count: {
          select: { games: true },
        },
        games: {
          orderBy: { importedAt: "desc" },
          take: 1,
          select: { importedAt: true },
        },
      },
    });

    return {
      id: updatedUser.id,
      chessComUsername: updatedUser.chessComUsername,
      email: updatedUser.email,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
      gameCount: updatedUser._count.games,
      lastImport: updatedUser.games[0]?.importedAt || null,
    };
  }
}
