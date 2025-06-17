// backend/src/index.ts - Updated with live analysis routes
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { connectDatabase } from "./config/database";

// Import routes
import healthRoutes from "./routes/health";
import userRoutes from "./routes/users";
import gameRoutes from "./routes/games";
import chesscomRoutes from "./routes/chesscom";
import analysisRoutes from "./routes/analysis"; // 🆕 Analysis routes
import liveAnalysisRoutes from "./routes/liveAnalysis"; // 🆕 Live Analysis routes

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
  // Allow SSE connections
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "'unsafe-inline'"], // Allow SSE connections
    },
  },
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to database
connectDatabase();

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/users", userRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/chesscom", chesscomRoutes);
app.use("/api/analysis", analysisRoutes); // 🆕 Add analysis routes
app.use("/api/analysis/live", liveAnalysisRoutes); // 🆕 Add live analysis routes

// Error handling
app.use(notFound);
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔥 SIGTERM received, shutting down gracefully');
  
  // Close live analysis service
  try {
    const { getLiveAnalysisService } = await import('./services/liveAnalysisService');
    const liveAnalysisService = getLiveAnalysisService();
    await liveAnalysisService.shutdown();
    console.log('✅ Live analysis service shut down');
  } catch (error) {
    console.error('❌ Error shutting down live analysis service:', error);
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔥 SIGINT received, shutting down gracefully');
  
  // Close live analysis service
  try {
    const { getLiveAnalysisService } = await import('./services/liveAnalysisService');
    const liveAnalysisService = getLiveAnalysisService();
    await liveAnalysisService.shutdown();
    console.log('✅ Live analysis service shut down');
  } catch (error) {
    console.error('❌ Error shutting down live analysis service:', error);
  }
  
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔥 Stockfish path: ${process.env.STOCKFISH_PATH || 'default'}`);
  console.log(`📡 Live analysis SSE endpoint: /api/analysis/live/stream/:sessionId`);
});

export default app;