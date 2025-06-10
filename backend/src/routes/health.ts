import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    // Basic health check without database for now
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        api: 'running',
        database: 'not connected (Step 1 - DB setup in next step)'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        api: 'running',
        database: 'error'
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;