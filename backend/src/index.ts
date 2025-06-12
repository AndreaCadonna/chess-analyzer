// backend/src/index.ts - Updated with analysis routes
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

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
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

// Error handling
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔥 Stockfish path: ${process.env.STOCKFISH_PATH || 'default'}`);
});

export default app;