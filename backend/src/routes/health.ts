import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req: Request, res: Response) => {
  console.log('🔍 NEW Health check called!');
  try {
    // Test database connection with a simple query
    await prisma.$queryRaw`SELECT 1`;
    
    // Count tables to verify schema exists
    const userCount = await prisma.user.count();
    const gameCount = await prisma.game.count();
    const analysisCount = await prisma.analysis.count();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        api: 'running',
        database: 'connected',
        docker: 'running'
      },
      database: {
        tables: ['users', 'games', 'analysis'],
        counts: {
          users: userCount,
          games: gameCount,
          analysis: analysisCount
        }
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        api: 'running',
        database: 'disconnected',
        docker: 'unknown'
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;