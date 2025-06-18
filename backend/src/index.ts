// backend/src/index.ts - Simplified version to fix connection issues
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
import analysisRoutes from "./routes/analysis";
import liveAnalysisRoutes from "./routes/liveAnalysis";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Basic CORS - very permissive for development
app.use(cors());

// Simplified helmet configuration
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Connect to database
connectDatabase();

// Routes
app.use("/api/health", healthRoutes);
app.use("/api/users", userRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/chesscom", chesscomRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/analysis/live", liveAnalysisRoutes);

// Basic route for testing
app.get("/", (req, res) => {
  res.json({
    message: "Chess Analysis Backend API",
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      users: "/api/users",
      games: "/api/games",
      chesscom: "/api/chesscom", 
      analysis: "/api/analysis",
      liveAnalysis: "/api/analysis/live"
    }
  });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Graceful shutdown
const shutdown = async () => {
  console.log('🔥 Shutting down gracefully...');
  
  try {
    const { getLiveAnalysisService } = await import('./services/liveAnalysisService');
    const liveAnalysisService = getLiveAnalysisService();
    await liveAnalysisService.shutdown();
    console.log('✅ Live analysis service shut down');
  } catch (error) {
    console.error('❌ Error shutting down live analysis service:', error);
  }
  
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown();
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔥 Stockfish path: ${process.env.STOCKFISH_PATH || 'default'}`);
  console.log(`📡 Live analysis available at: http://localhost:${PORT}/api/analysis/live`);
  console.log(`🌐 Frontend should connect to: http://localhost:${PORT}`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

export default app;