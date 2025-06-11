import { Router, Request, Response } from "express";
import { prisma } from "../config/database";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      api: "running",
      database: "unknown",
      redis: "unknown",
    },
  };

  // Test database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = "connected";
  } catch (error) {
    health.services.database = "disconnected";
    health.status = "degraded";
  }

  // Test Redis connection (we'll add this later)
  health.services.redis = "not implemented";

  const statusCode = health.status === "healthy" ? 200 : 503;
  res.status(statusCode).json(health);
});

export default router;
