// backend/src/routes/liveAnalysis.ts
import { Router, Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { v4 as uuidv4 } from "uuid";
import { getLiveAnalysisService } from "../services/liveAnalysisService";
import type {
  LiveAnalysisOptions,
  LiveAnalysisEvent,
  LiveAnalysisEventType,
} from "../services/liveAnalysisService";

const router = Router();
const liveAnalysisService = getLiveAnalysisService();

// Track active SSE connections
const activeConnections = new Map<string, Response>();

// SSE Stream endpoint
router.get(
  "/stream/:sessionId",
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    console.log(`📡 SSE connection request for session: ${sessionId}`);

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    });

    // Send initial connection message
    const welcomeEvent = {
      type: "connection_established",
      sessionId,
      timestamp: new Date().toISOString(),
      data: {
        message: "Live analysis stream connected",
        sessionInfo: liveAnalysisService.getSessionInfo(),
      },
    };

    res.write(`data: ${JSON.stringify(welcomeEvent)}\n\n`);

    // Store the connection
    activeConnections.set(sessionId, res);

    // Set up event listener for this session
    const eventHandler = (event: LiveAnalysisEvent) => {
      // Only send events for this session
      if (event.sessionId === sessionId) {
        try {
          const eventData = `data: ${JSON.stringify(event)}\n\n`;
          res.write(eventData);
          console.log(`📤 SSE event sent to ${sessionId}: ${event.type}`);
        } catch (error) {
          console.error(`❌ Failed to send SSE event to ${sessionId}:`, error);
          // Connection is probably dead, clean it up
          cleanup();
        }
      }
    };

    // Register event listener
    liveAnalysisService.on("analysisEvent", eventHandler);

    // Cleanup function
    const cleanup = () => {
      console.log(`🧹 Cleaning up SSE connection for session: ${sessionId}`);
      activeConnections.delete(sessionId);
      liveAnalysisService.removeListener("analysisEvent", eventHandler);

      if (!res.destroyed) {
        res.end();
      }
    };

    // Handle client disconnect
    req.on("close", cleanup);
    req.on("aborted", cleanup);
    res.on("close", cleanup);

    // Send periodic heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (res.destroyed) {
        clearInterval(heartbeatInterval);
        return;
      }

      try {
        const heartbeat = {
          type: "heartbeat",
          sessionId,
          timestamp: new Date().toISOString(),
          data: { status: "alive" },
        };
        res.write(`data: ${JSON.stringify(heartbeat)}\n\n`);
      } catch (error) {
        console.error(`❌ Heartbeat failed for ${sessionId}:`, error);
        clearInterval(heartbeatInterval);
        cleanup();
      }
    }, 30000); // 30 second heartbeat

    console.log(`✅ SSE stream established for session: ${sessionId}`);
  })
);

// Create analysis session
router.post(
  "/session",
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = uuidv4();

    try {
      await liveAnalysisService.createSession(sessionId);

      res.json({
        success: true,
        data: {
          sessionId,
          message: "Live analysis session created",
          streamUrl: `/api/analysis/live/stream/${sessionId}`,
        },
      });

      console.log(`✅ Created live analysis session: ${sessionId}`);
    } catch (error) {
      console.error(`❌ Failed to create session:`, error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to create session",
      });
    }
  })
);

// Analyze position
router.post(
  "/analyze",
  asyncHandler(async (req: Request, res: Response) => {
    const { fen, depth, timeLimit, multiPV } = req.body;

    if (!fen) {
      res.status(400).json({
        success: false,
        message: "FEN position is required",
      });
      return;
    }

    // Validate FEN format (basic check)
    const fenParts = fen.split(" ");
    if (fenParts.length < 4) {
      res.status(400).json({
        success: false,
        message: "Invalid FEN format",
      });
      return;
    }

    const sessionInfo = liveAnalysisService.getSessionInfo();
    if (!sessionInfo) {
      res.status(400).json({
        success: false,
        message: "No active session. Create a session first.",
      });
      return;
    }

    try {
      const options: LiveAnalysisOptions = {};

      if (depth !== undefined) {
        if (typeof depth !== "number" || depth < 1 || depth > 50) {
          res.status(400).json({
            success: false,
            message: "Depth must be a number between 1 and 50",
          });
          return;
        }
        options.depth = depth;
      }

      if (timeLimit !== undefined) {
        if (
          typeof timeLimit !== "number" ||
          timeLimit < 1000 ||
          timeLimit > 60000
        ) {
          res.status(400).json({
            success: false,
            message: "Time limit must be between 1000ms and 60000ms",
          });
          return;
        }
        options.timeLimit = timeLimit;
      }

      if (multiPV !== undefined) {
        if (typeof multiPV !== "number" || multiPV < 1 || multiPV > 5) {
          res.status(400).json({
            success: false,
            message: "MultiPV must be between 1 and 5",
          });
          return;
        }
        options.multiPV = multiPV;
      }

      // Start analysis (results will be streamed via SSE)
      await liveAnalysisService.analyzePosition(fen, options);

      res.json({
        success: true,
        data: {
          message: "Analysis started",
          fen,
          options,
          sessionId: sessionInfo.sessionId,
        },
      });

      console.log(
        `🚀 Started position analysis for session: ${sessionInfo.sessionId}`
      );
    } catch (error) {
      console.error(`❌ Analysis request failed:`, error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Analysis failed",
      });
    }
  })
);

// Update analysis settings
router.put(
  "/settings",
  asyncHandler(async (req: Request, res: Response) => {
    const { depth, timeLimit, multiPV } = req.body;

    const sessionInfo = liveAnalysisService.getSessionInfo();
    if (!sessionInfo) {
      res.status(400).json({
        success: false,
        message: "No active session",
      });
      return;
    }

    try {
      const settings: Partial<LiveAnalysisOptions> = {};

      if (depth !== undefined) {
        if (typeof depth !== "number" || depth < 1 || depth > 50) {
          res.status(400).json({
            success: false,
            message: "Depth must be a number between 1 and 50",
          });
          return;
        }
        settings.depth = depth;
      }

      if (timeLimit !== undefined) {
        if (
          typeof timeLimit !== "number" ||
          timeLimit < 1000 ||
          timeLimit > 60000
        ) {
          res.status(400).json({
            success: false,
            message: "Time limit must be between 1000ms and 60000ms",
          });
          return;
        }
        settings.timeLimit = timeLimit;
      }

      if (multiPV !== undefined) {
        if (typeof multiPV !== "number" || multiPV < 1 || multiPV > 5) {
          res.status(400).json({
            success: false,
            message: "MultiPV must be between 1 and 5",
          });
          return;
        }
        settings.multiPV = multiPV;
      }

      liveAnalysisService.updateSettings(settings);

      res.json({
        success: true,
        data: {
          message: "Settings updated",
          newSettings: liveAnalysisService.getSessionInfo()?.settings,
        },
      });

      console.log(`⚙️ Updated settings for session: ${sessionInfo.sessionId}`);
    } catch (error) {
      console.error(`❌ Failed to update settings:`, error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to update settings",
      });
    }
  })
);

// Get session info
router.get(
  "/session/info",
  asyncHandler(async (req: Request, res: Response) => {
    const sessionInfo = liveAnalysisService.getSessionInfo();

    if (!sessionInfo) {
      res.status(404).json({
        success: false,
        message: "No active session",
      });
      return;
    }

    res.json({
      success: true,
      data: sessionInfo,
    });
  })
);

// Close session
router.delete(
  "/session",
  asyncHandler(async (req: Request, res: Response) => {
    const sessionInfo = liveAnalysisService.getSessionInfo();

    if (!sessionInfo) {
      res.status(404).json({
        success: false,
        message: "No active session to close",
      });
      return;
    }

    try {
      await liveAnalysisService.closeSession();

      // Close any active SSE connections
      for (const [sessionId, sseRes] of activeConnections.entries()) {
        try {
          if (!sseRes.destroyed) {
            sseRes.end();
          }
        } catch (error) {
          console.warn(
            `⚠️ Error closing SSE connection for ${sessionId}:`,
            error
          );
        }
      }
      activeConnections.clear();

      res.json({
        success: true,
        data: {
          message: "Session closed successfully",
          sessionId: sessionInfo.sessionId,
        },
      });

      console.log(`🔚 Closed live analysis session: ${sessionInfo.sessionId}`);
    } catch (error) {
      console.error(`❌ Failed to close session:`, error);
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to close session",
      });
    }
  })
);

// Health check for live analysis
router.get(
  "/health",
  asyncHandler(async (req: Request, res: Response) => {
    const sessionInfo = liveAnalysisService.getSessionInfo();
    const activeConnectionCount = activeConnections.size;

    res.json({
      success: true,
      data: {
        serviceStatus: "running",
        hasActiveSession: sessionInfo !== null,
        sessionInfo,
        activeConnections: activeConnectionCount,
        timestamp: new Date().toISOString(),
      },
    });
  })
);

export default router;
