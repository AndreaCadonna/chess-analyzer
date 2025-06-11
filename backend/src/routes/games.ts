import { Router, Request, Response, NextFunction } from "express";

const router = Router();

// Placeholder for game routes - will implement in next step
router.get("/", async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Games API - Coming in Step 3!",
    data: [],
  });
});

export default router;
