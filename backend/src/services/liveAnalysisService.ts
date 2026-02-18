// backend/src/services/liveAnalysisService.ts
import { EventEmitter } from "events";
import { getStockfishPool } from "./stockfishPool";

export interface LiveAnalysisOptions {
  depth?: number;
  timeLimit?: number;
  multiPV?: number;
}

export interface LiveAnalysisResult {
  fen: string;
  lines: Array<{
    evaluation: number;
    bestMove: string;
    pv: string[];
    depth: number;
    multiPvIndex: number;
  }>;
  analysisTime: number;
  isComplete: boolean;
}

export interface AnalysisProgress {
  fen: string;
  depth: number;
  progress: number; // 0-100
  currentLine?: {
    evaluation: number;
    bestMove: string;
    pv: string[];
    multiPvIndex: number;
  };
}

export enum LiveAnalysisEventType {
  ANALYSIS_STARTED = "analysis_started",
  ANALYSIS_PROGRESS = "analysis_progress",
  ANALYSIS_COMPLETE = "analysis_complete",
  ANALYSIS_ERROR = "analysis_error",
  ENGINE_STATUS = "engine_status",
  SESSION_CLOSED = "session_closed",
}

export interface LiveAnalysisEvent {
  type: LiveAnalysisEventType;
  sessionId: string;
  timestamp: string;
  data: any;
}

export class LiveAnalysisService extends EventEmitter {
  private currentSession: {
    sessionId: string;
    isAnalyzing: boolean;
    currentPosition?: string;
    settings: LiveAnalysisOptions;
    lastActivity: number;
  } | null = null;

  private defaultSettings: Required<LiveAnalysisOptions> = {
    depth: 18,
    timeLimit: 10000, // 10 seconds
    multiPV: 3,
  };

  private sessionTimeout = 30 * 60 * 1000; // 30 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.setupCleanup();
  }

  private setupCleanup(): void {
    // Clean up inactive sessions every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 5 * 60 * 1000);
  }

  private cleanupInactiveSessions(): void {
    if (this.currentSession) {
      const timeSinceActivity = Date.now() - this.currentSession.lastActivity;
      if (timeSinceActivity > this.sessionTimeout) {
        console.log(
          `🧹 Cleaning up inactive session: ${this.currentSession.sessionId}`
        );
        this.closeSession();
      }
    }
  }

  async createSession(sessionId: string): Promise<void> {
    console.log(`🚀 Creating live analysis session: ${sessionId}`);

    // Close existing session if any
    if (this.currentSession) {
      console.log(
        `🔄 Closing existing session: ${this.currentSession.sessionId}`
      );
      await this.closeSession();
    }

    // Verify engine pool is available
    try {
      const pool = await getStockfishPool();
      if (!pool.hasAvailableWorkers()) {
        throw new Error("Stockfish pool has no available workers");
      }
    } catch (error) {
      const errorEvent: LiveAnalysisEvent = {
        type: LiveAnalysisEventType.ANALYSIS_ERROR,
        sessionId,
        timestamp: new Date().toISOString(),
        data: {
          error: "Engine initialization failed",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      };
      this.emit("analysisEvent", errorEvent);
      throw error;
    }

    // Create new session
    this.currentSession = {
      sessionId,
      isAnalyzing: false,
      settings: { ...this.defaultSettings },
      lastActivity: Date.now(),
    };

    // Emit session created event
    const statusEvent: LiveAnalysisEvent = {
      type: LiveAnalysisEventType.ENGINE_STATUS,
      sessionId,
      timestamp: new Date().toISOString(),
      data: {
        status: "session_created",
        settings: this.currentSession.settings,
      },
    };
    this.emit("analysisEvent", statusEvent);

    console.log(`✅ Live analysis session created: ${sessionId}`);
  }

  async analyzePosition(
    fen: string,
    options: LiveAnalysisOptions = {}
  ): Promise<void> {
    if (!this.currentSession) {
      throw new Error("No active session. Create a session first.");
    }

    // Update last activity
    this.currentSession.lastActivity = Date.now();

    // Merge options with session settings
    const analysisOptions: Required<LiveAnalysisOptions> = {
      ...this.defaultSettings,
      ...this.currentSession.settings,
      ...options,
    };

    console.log(
      `🔍 Starting position analysis for session: ${this.currentSession.sessionId}`
    );
    console.log(`📍 FEN: ${fen.substring(0, 50)}...`);
    console.log(`⚙️ Options:`, analysisOptions);

    // Validate FEN
    const fenParts = fen.split(" ");
    if (fenParts.length < 4) {
      const errorEvent: LiveAnalysisEvent = {
        type: LiveAnalysisEventType.ANALYSIS_ERROR,
        sessionId: this.currentSession.sessionId,
        timestamp: new Date().toISOString(),
        data: {
          error: "Invalid FEN format",
          fen,
        },
      };
      this.emit("analysisEvent", errorEvent);
      return;
    }

    // Stop any current analysis
    if (this.currentSession.isAnalyzing) {
      console.log(`⏹️ Stopping current analysis to start new one`);
      // Note: We can't actually stop Stockfish mid-analysis yet,
      // but we can ignore the results when they come in
    }

    this.currentSession.isAnalyzing = true;
    this.currentSession.currentPosition = fen;

    // Emit analysis started event
    const startEvent: LiveAnalysisEvent = {
      type: LiveAnalysisEventType.ANALYSIS_STARTED,
      sessionId: this.currentSession.sessionId,
      timestamp: new Date().toISOString(),
      data: {
        fen,
        options: analysisOptions,
      },
    };
    this.emit("analysisEvent", startEvent);

    try {
      // Get pool and analyze with live priority (uses reserved worker)
      const pool = await getStockfishPool();

      const startTime = Date.now();

      const result = await pool.analyzePosition(fen, {
        depth: analysisOptions.depth,
        timeLimit: analysisOptions.timeLimit,
        multiPV: analysisOptions.multiPV,
      }, "live");

      const analysisTime = Date.now() - startTime;

      // Check if this analysis is still relevant (session might have changed)
      if (!this.currentSession || this.currentSession.currentPosition !== fen) {
        console.log(`🚫 Analysis result ignored - session changed`);
        return;
      }

      const analysisResult: LiveAnalysisResult = {
        fen,
        lines: result.lines.map(line => ({
          evaluation: line.evaluation,
          bestMove: line.bestMove,
          pv: line.pv,
          depth: line.depth,
          multiPvIndex: line.multiPvIndex,
        })),
        analysisTime,
        isComplete: true,
      };

      // Emit analysis complete event
      const completeEvent: LiveAnalysisEvent = {
        type: LiveAnalysisEventType.ANALYSIS_COMPLETE,
        sessionId: this.currentSession.sessionId,
        timestamp: new Date().toISOString(),
        data: analysisResult,
      };
      this.emit("analysisEvent", completeEvent);

      console.log(
        `✅ Analysis complete for ${fen.substring(
          0,
          20
        )}... in ${analysisTime}ms`
      );
    } catch (error) {
      console.error(`❌ Analysis failed:`, error);

      const errorEvent: LiveAnalysisEvent = {
        type: LiveAnalysisEventType.ANALYSIS_ERROR,
        sessionId: this.currentSession.sessionId,
        timestamp: new Date().toISOString(),
        data: {
          error: "Analysis failed",
          message: error instanceof Error ? error.message : "Unknown error",
          fen,
        },
      };
      this.emit("analysisEvent", errorEvent);
    } finally {
      if (this.currentSession) {
        this.currentSession.isAnalyzing = false;
      }
    }
  }

  updateSettings(settings: Partial<LiveAnalysisOptions>): void {
    if (!this.currentSession) {
      throw new Error("No active session");
    }

    this.currentSession.settings = {
      ...this.currentSession.settings,
      ...settings,
    };

    this.currentSession.lastActivity = Date.now();

    console.log(`⚙️ Updated analysis settings:`, this.currentSession.settings);

    // Emit settings update event
    const settingsEvent: LiveAnalysisEvent = {
      type: LiveAnalysisEventType.ENGINE_STATUS,
      sessionId: this.currentSession.sessionId,
      timestamp: new Date().toISOString(),
      data: {
        status: "settings_updated",
        settings: this.currentSession.settings,
      },
    };
    this.emit("analysisEvent", settingsEvent);
  }

  async closeSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const sessionId = this.currentSession.sessionId;
    console.log(`🔚 Closing live analysis session: ${sessionId}`);

    // Emit session closed event
    const closeEvent: LiveAnalysisEvent = {
      type: LiveAnalysisEventType.SESSION_CLOSED,
      sessionId,
      timestamp: new Date().toISOString(),
      data: {
        reason: "manual_close",
      },
    };
    this.emit("analysisEvent", closeEvent);

    this.currentSession = null;
    console.log(`✅ Session closed: ${sessionId}`);
  }

  getSessionInfo() {
    if (!this.currentSession) {
      return null;
    }

    return {
      sessionId: this.currentSession.sessionId,
      isAnalyzing: this.currentSession.isAnalyzing,
      currentPosition: this.currentSession.currentPosition,
      settings: this.currentSession.settings,
      lastActivity: new Date(this.currentSession.lastActivity).toISOString(),
    };
  }

  async shutdown(): Promise<void> {
    console.log(`🔥 Shutting down live analysis service`);

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    await this.closeSession();
    this.removeAllListeners();

    console.log(`✅ Live analysis service shut down`);
  }
}

// Singleton instance
let liveAnalysisInstance: LiveAnalysisService | null = null;

export const getLiveAnalysisService = (): LiveAnalysisService => {
  if (!liveAnalysisInstance) {
    liveAnalysisInstance = new LiveAnalysisService();
  }
  return liveAnalysisInstance;
};
