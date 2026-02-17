import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import path from "path";

export interface AnalysisOptions {
  depth?: number;
  timeLimit?: number;
  threads?: number;
  multiPV?: number; // Number of variations to analyze
}

export interface AnalysisLine {
  evaluation: number; // Centipawn evaluation
  mateIn?: number; // Mate in X moves (if applicable)
  bestMove: string;
  pv: string[]; // Principal variation as array of moves
  depth: number;
  multiPvIndex: number; // Which line this is (1 = best, 2 = second best, etc.)
  nodes: number;
  nps: number; // Nodes per second
}

export interface PositionAnalysis {
  fen: string;
  lines: AnalysisLine[]; // Multiple lines from MultiPV
  timeSpent: number;
  // Backwards compatibility - use best line
  get evaluation(): number;
  get bestMove(): string;
  get bestLine(): string[];
  get depth(): number;
  get pv(): string;
}

export interface MoveClassification {
  move: string;
  evaluation: number;
  classification: "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";
  centipawnLoss: number;
}

export interface EngineInfo {
  depth: number;
  evaluation?: number;
  mateIn?: number;
  nodes: number;
  nps: number;
  time: number;
  pv?: string;
  multiPv?: number;
}

export class StockfishService extends EventEmitter {
  private enginePath: string;
  private currentEngine: ChildProcess | null = null;
  private isReady: boolean = false;
  private isInitializing: boolean = false;
  private outputBuffer: string = "";
  private commandQueue: Array<{
    command: string;
    resolve: (result: any) => void;
    reject: (error: Error) => void;
    timeout?: NodeJS.Timeout;
  }> = [];
  private isProcessingQueue: boolean = false;
  private lastHeartbeat: number = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private restartAttempts: number = 0;
  private maxRestartAttempts: number = 3;

  // Analysis state
  private currentAnalysis: {
    fen: string;
    options: AnalysisOptions;
    resolve: (result: PositionAnalysis) => void;
    reject: (error: Error) => void;
    timeout?: NodeJS.Timeout;
    startTime: number;
    lines: Map<number, Partial<AnalysisLine>>; // Track multiple PV lines by multiPvIndex
  } | null = null;

  // Rate limiting for info updates
  private lastInfoEmit: number = 0;
  private minInfoEmitInterval: number = 200; // 5 updates per second

  constructor() {
    super();

    // Default engine path - will be configurable via environment
    this.enginePath =
      process.env.STOCKFISH_PATH || this.getDefaultStockfishPath();

    console.log(
      `🔥 Stockfish service initialized with path: ${this.enginePath}`
    );

    // Set up heartbeat monitoring
    this.setupHeartbeat();
  }

  private getDefaultStockfishPath(): string {
    // Default paths for different platforms
    if (process.platform === "win32") {
      return path.join(process.cwd(), "stockfish", "stockfish.exe");
    } else if (process.platform === "darwin") {
      return "/usr/local/bin/stockfish";
    } else {
      return "/usr/bin/stockfish";
    }
  }

  private setupHeartbeat(): void {
    // Check engine health every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      if (this.isReady && now - this.lastHeartbeat > 60000) {
        console.warn(
          "⚠️ Stockfish engine seems unresponsive, attempting restart"
        );
        this.restartEngine();
      }
    }, 30000);
  }

  async initialize(): Promise<void> {
    if (this.isInitializing) {
      // If already initializing, wait for completion
      return new Promise((resolve, reject) => {
        this.once("ready", resolve);
        this.once("init-error", reject);
      });
    }

    if (this.isReady) {
      return Promise.resolve();
    }

    this.isInitializing = true;

    return new Promise((resolve, reject) => {
      console.log(`🚀 Initializing Stockfish engine at: ${this.enginePath}`);

      try {
        this.startEngine();

        // Wait for UCI OK response
        const timeout = setTimeout(() => {
          this.isInitializing = false;
          const error = new Error("Stockfish initialization timeout");
          this.emit("init-error", error);
          reject(error);
        }, 15000); // Increased timeout

        this.once("ready", () => {
          clearTimeout(timeout);
          this.isInitializing = false;
          console.log("✅ Stockfish engine ready!");
          resolve();
        });

        this.once("init-error", (error) => {
          clearTimeout(timeout);
          this.isInitializing = false;
          reject(error);
        });
      } catch (error) {
        this.isInitializing = false;
        const initError = new Error(
          `Failed to initialize Stockfish: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        this.emit("init-error", initError);
        reject(initError);
      }
    });
  }

  private startEngine(): void {
    try {
      // Clean up existing engine
      if (this.currentEngine) {
        this.cleanupEngine();
      }

      this.currentEngine = spawn(this.enginePath, [], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      if (
        !this.currentEngine.stdout ||
        !this.currentEngine.stdin ||
        !this.currentEngine.stderr
      ) {
        throw new Error("Failed to create engine streams");
      }

      // Handle engine output
      this.currentEngine.stdout.on("data", (data: Buffer) => {
        this.handleEngineOutput(data.toString());
      });

      // Handle engine errors
      this.currentEngine.stderr.on("data", (data: Buffer) => {
        const errorOutput = data.toString();
        console.error("❌ Stockfish stderr:", errorOutput);
        // Some stderr output might not be critical, so don't fail immediately
      });

      // Handle engine close
      this.currentEngine.on("close", (code, signal) => {
        console.log(
          `🔥 Stockfish engine closed with code: ${code}, signal: ${signal}`
        );
        this.handleEngineClose(code, signal);
      });

      // Handle spawn errors
      this.currentEngine.on("error", (error) => {
        console.error("❌ Stockfish spawn error:", error);
        this.handleEngineError(error);
      });

      // Initialize UCI communication
      this.sendCommand("uci");
      this.lastHeartbeat = Date.now();
    } catch (error) {
      this.handleEngineError(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private handleEngineClose(code: number | null, signal: string | null): void {
    this.isReady = false;
    this.currentEngine = null;

    // Reject any pending analysis
    if (this.currentAnalysis) {
      this.currentAnalysis.reject(new Error("Engine closed unexpectedly"));
      this.currentAnalysis = null;
    }

    // Clear command queue
    this.clearCommandQueue("Engine closed");

    // Attempt restart if not intentional shutdown
    if (code !== 0 && this.restartAttempts < this.maxRestartAttempts) {
      this.restartEngine();
    } else if (this.restartAttempts >= this.maxRestartAttempts) {
      console.error("❌ Maximum restart attempts reached, engine unavailable");
      this.emit(
        "engine-failed",
        new Error("Engine failed after multiple restart attempts")
      );
    }
  }

  private handleEngineError(error: Error): void {
    console.error("❌ Engine error:", error);

    if (this.isInitializing) {
      this.emit("init-error", error);
    }

    // Attempt restart if possible
    if (this.restartAttempts < this.maxRestartAttempts) {
      this.restartEngine();
    }
  }

  private async restartEngine(): Promise<void> {
    this.restartAttempts++;
    console.log(
      `🔄 Attempting engine restart (${this.restartAttempts}/${this.maxRestartAttempts})`
    );

    try {
      // Wait a bit before restart
      await new Promise((resolve) => setTimeout(resolve, 2000));

      this.cleanupEngine();
      await this.initialize();

      // Reset restart counter on successful restart
      this.restartAttempts = 0;
      console.log("✅ Engine restart successful");
    } catch (error) {
      console.error("❌ Engine restart failed:", error);
    }
  }

  private cleanupEngine(): void {
    if (this.currentEngine) {
      this.currentEngine.removeAllListeners();

      if (!this.currentEngine.killed) {
        this.currentEngine.kill("SIGTERM");

        // Force kill after 5 seconds
        setTimeout(() => {
          if (this.currentEngine && !this.currentEngine.killed) {
            this.currentEngine.kill("SIGKILL");
          }
        }, 5000);
      }

      this.currentEngine = null;
    }

    this.isReady = false;
  }

  private clearCommandQueue(reason: string): void {
    while (this.commandQueue.length > 0) {
      const cmd = this.commandQueue.shift();
      if (cmd) {
        if (cmd.timeout) clearTimeout(cmd.timeout);
        cmd.reject(new Error(`Command failed: ${reason}`));
      }
    }
  }

  private handleEngineOutput(data: string): void {
    this.outputBuffer += data;
    const lines = this.outputBuffer.split("\n");

    // Keep incomplete last line in buffer
    this.outputBuffer = lines.pop() || "";

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        this.processEngineMessage(trimmedLine);
      }
    }

    // Update heartbeat
    this.lastHeartbeat = Date.now();
  }

  private processEngineMessage(message: string): void {
    console.log(`📨 Stockfish: ${message}`);

    if (message === "uciok") {
      this.configureEngine();
    } else if (message === "readyok") {
      this.isReady = true;
      this.emit("ready");
      this.processCommandQueue();
    } else if (message.startsWith("info")) {
      this.processAnalysisInfo(message);
    } else if (message.startsWith("bestmove")) {
      this.processBestMove(message);
    } else if (message.startsWith("option name")) {
      // Engine capability info - could be useful for configuration
      this.processOptionInfo(message);
    }
  }

  private configureEngine(): void {
    // Configure engine settings
    this.sendCommand("setoption name Threads value 2");
    this.sendCommand("setoption name Hash value 128");
    this.sendCommand("setoption name MultiPV value 1");
    this.sendCommand("isready");
  }

  private processOptionInfo(message: string): void {
    // Parse engine options for future configuration capabilities
    // Example: "option name Hash type spin default 16 min 1 max 33554432"
    console.log(`🔧 Engine option: ${message}`);
  }

  private processAnalysisInfo(message: string): void {
    if (!this.currentAnalysis) return;

    // Parse UCI info messages
    const parts = message.split(" ");
    const info: Partial<AnalysisLine> & { multiPv?: number } = {
      nodes: 0,
      nps: 0,
    };

    for (let i = 1; i < parts.length; i += 2) {
      const key = parts[i];
      const value = parts[i + 1];

      if (key && value) {
        switch (key) {
          case "depth":
            info.depth = parseInt(value);
            break;
          case "time":
            // We don't need to track time per line
            break;
          case "nodes":
            info.nodes = parseInt(value);
            break;
          case "nps":
            info.nps = parseInt(value);
            break;
          case "multipv":
            info.multiPv = parseInt(value);
            info.multiPvIndex = parseInt(value);
            break;
          case "score":
            i++; // Skip 'score'
            const scoreType = parts[i]; // 'cp' or 'mate'
            const scoreValue = parts[i + 1];
            if (scoreType === "cp") {
              info.evaluation = parseInt(scoreValue);
            } else if (scoreType === "mate") {
              info.mateIn = parseInt(scoreValue);
              // Convert mate to extreme centipawn value for comparison
              // Mate in N = sign * (10000 + 100 * (100 - N))
              const mateValue = parseInt(scoreValue);
              info.evaluation = mateValue > 0
                ? 10000 + 100 * (100 - mateValue)
                : -(10000 + 100 * (100 + mateValue));
            }
            break;
          case "pv":
            // Principal variation - rest of the line as array
            const pvMoves = parts.slice(i + 1);
            info.pv = pvMoves;
            if (pvMoves.length > 0) {
              info.bestMove = pvMoves[0];
            }
            i = parts.length; // Break out of loop
            break;
        }
      }
    }

    // Only process if we have essential data
    if (!info.depth || !info.multiPv || !info.pv || info.evaluation === undefined) {
      return;
    }

    const multiPvIndex = info.multiPv;

    // Get or create the line for this multiPV index
    const existingLine = this.currentAnalysis.lines.get(multiPvIndex) || {};

    // Merge new info with existing line (keep updating as depth increases)
    const updatedLine: Partial<AnalysisLine> = {
      ...existingLine,
      ...info,
      multiPvIndex,
    };

    this.currentAnalysis.lines.set(multiPvIndex, updatedLine);

    // Rate limiting: Only emit updates every 200ms (5 per second)
    const now = Date.now();
    if (now - this.lastInfoEmit >= this.minInfoEmitInterval) {
      // Emit progress with all current lines
      const allLines = Array.from(this.currentAnalysis.lines.values())
        .filter(line => line.depth && line.evaluation !== undefined)
        .sort((a, b) => (a.multiPvIndex || 0) - (b.multiPvIndex || 0));

      this.emit("analysis-info", {
        fen: this.currentAnalysis.fen,
        lines: allLines,
        depth: info.depth,
      });

      this.lastInfoEmit = now;
    }
  }

  private processBestMove(message: string): void {
    if (!this.currentAnalysis) return;

    // Example: "bestmove e2e4 ponder e7e5"
    const parts = message.split(" ");
    const bestMove = parts[1];
    const ponder = parts.length > 3 ? parts[3] : null;

    const timeSpent = Date.now() - this.currentAnalysis.startTime;

    if (bestMove === "(none)" || !bestMove) {
      this.currentAnalysis.reject(new Error("No legal moves in position"));
      this.currentAnalysis = null;
      return;
    }

    // Convert all collected lines to AnalysisLine format
    const lines: AnalysisLine[] = Array.from(this.currentAnalysis.lines.values())
      .filter(line =>
        line.depth !== undefined &&
        line.evaluation !== undefined &&
        line.bestMove !== undefined &&
        line.pv !== undefined
      )
      .map(line => ({
        evaluation: line.evaluation!,
        mateIn: line.mateIn,
        bestMove: line.bestMove!,
        pv: line.pv!,
        depth: line.depth!,
        multiPvIndex: line.multiPvIndex!,
        nodes: line.nodes || 0,
        nps: line.nps || 0,
      }))
      .sort((a, b) => a.multiPvIndex - b.multiPvIndex);

    if (lines.length === 0) {
      this.currentAnalysis.reject(new Error("No analysis lines collected"));
      this.currentAnalysis = null;
      return;
    }

    // Create analysis result with backwards compatibility getters
    const result: PositionAnalysis = {
      fen: this.currentAnalysis.fen,
      lines,
      timeSpent,
      // Backwards compatibility - return first (best) line properties
      get evaluation() { return this.lines[0]?.evaluation || 0; },
      get bestMove() { return this.lines[0]?.bestMove || ""; },
      get bestLine() { return this.lines[0]?.pv || []; },
      get depth() { return this.lines[0]?.depth || 0; },
      get pv() { return this.lines[0]?.pv.join(" ") || ""; },
    };

    // Clear timeout
    if (this.currentAnalysis.timeout) {
      clearTimeout(this.currentAnalysis.timeout);
    }

    // Resolve the analysis
    this.currentAnalysis.resolve(result);
    this.currentAnalysis = null;

    this.emit("bestmove", { bestMove, ponder, result });
  }

  private sendCommand(command: string): void {
    if (!this.currentEngine?.stdin) {
      throw new Error("Engine not initialized");
    }

    console.log(`📤 Sending to Stockfish: ${command}`);
    this.currentEngine.stdin.write(command + "\n");
  }

  private async processCommandQueue(): Promise<void> {
    if (this.isProcessingQueue || this.commandQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.commandQueue.length > 0 && this.isReady) {
      const cmd = this.commandQueue.shift();
      if (cmd) {
        try {
          this.sendCommand(cmd.command);
          // For simple commands, resolve immediately
          cmd.resolve(true);
        } catch (error) {
          cmd.reject(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }

    this.isProcessingQueue = false;
  }

  async analyzePosition(
    fen: string,
    options: AnalysisOptions = {}
  ): Promise<PositionAnalysis> {
    if (!this.isReady) {
      throw new Error("Stockfish engine not ready");
    }

    if (this.currentAnalysis) {
      throw new Error("Analysis already in progress");
    }

    // Validate FEN
    const fenParts = fen.split(" ");
    if (fenParts.length < 4) {
      throw new Error("Invalid FEN format");
    }

    const depth = options.depth || 15;
    const timeLimit = options.timeLimit || 10000; // 10 seconds default
    const multiPV = options.multiPV || 1; // Default to single line for backwards compatibility

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      // Set up timeout
      const timeout = setTimeout(() => {
        if (this.currentAnalysis) {
          this.currentAnalysis = null;
          reject(
            new Error(
              `Analysis timeout after ${timeLimit}ms for position: ${fen}`
            )
          );
        }
      }, timeLimit + 1000); // Extra buffer

      this.currentAnalysis = {
        fen,
        options,
        resolve,
        reject,
        timeout,
        startTime,
        lines: new Map(), // Initialize empty map for PV lines
      };

      try {
        // Configure MultiPV if requested
        if (multiPV > 1) {
          this.sendCommand(`setoption name MultiPV value ${multiPV}`);
        } else {
          this.sendCommand(`setoption name MultiPV value 1`);
        }

        this.sendCommand(`position fen ${fen}`);
        this.sendCommand(`go depth ${depth}`);
      } catch (error) {
        clearTimeout(timeout);
        this.currentAnalysis = null;
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  classifyMove(previousEval: number, currentEval: number, isWhiteMove: boolean): MoveClassification {
    // Calculate centipawn loss from the moving player's perspective.
    // Stockfish evaluations are always from White's perspective:
    //   positive = White is better, negative = Black is better
    let centipawnLoss: number;

    if (isWhiteMove) {
      // For White: if eval decreases, White's position worsened
      centipawnLoss = previousEval - currentEval;
    } else {
      // For Black: if eval increases (more positive), Black's position worsened
      centipawnLoss = currentEval - previousEval;
    }

    // Only consider actual losses; negative loss means the player improved
    centipawnLoss = Math.max(0, centipawnLoss);

    let classification: MoveClassification["classification"];

    if (centipawnLoss >= 300) {
      classification = "blunder";
    } else if (centipawnLoss >= 150) {
      classification = "mistake";
    } else if (centipawnLoss >= 50) {
      classification = "inaccuracy";
    } else if (centipawnLoss <= 10) {
      classification = "excellent";
    } else {
      classification = "good";
    }

    return {
      move: "", // Will be set by caller
      evaluation: currentEval,
      classification,
      centipawnLoss,
    };
  }

  /**
   * Send UCI 'stop' command to abort the current analysis.
   * If an analysis is in progress, it will resolve with whatever
   * partial results are available when bestmove arrives.
   */
  stopAnalysis(): void {
    if (!this.currentEngine?.stdin || !this.currentAnalysis) {
      return;
    }
    console.log(`⏹️ Stopping current analysis`);
    this.sendCommand("stop");
  }

  /**
   * Send UCI 'ucinewgame' to clear the engine's transposition table
   * and internal state. Call this once before analyzing a new game,
   * NOT before every position.
   */
  newGame(): void {
    if (!this.isReady) {
      throw new Error("Stockfish engine not ready");
    }
    this.sendCommand("ucinewgame");
  }

  async shutdown(): Promise<void> {
    console.log("🔥 Shutting down Stockfish service...");

    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Cancel any ongoing analysis
    if (this.currentAnalysis) {
      if (this.currentAnalysis.timeout) {
        clearTimeout(this.currentAnalysis.timeout);
      }
      this.currentAnalysis.reject(new Error("Engine shutting down"));
      this.currentAnalysis = null;
    }

    // Clear command queue
    this.clearCommandQueue("Engine shutting down");

    if (this.currentEngine) {
      this.sendCommand("quit");

      return new Promise((resolve) => {
        const shutdownTimeout = setTimeout(() => {
          this.cleanupEngine();
          resolve();
        }, 5000);

        this.currentEngine!.on("close", () => {
          clearTimeout(shutdownTimeout);
          this.currentEngine = null;
          this.isReady = false;
          console.log("🔥 Stockfish engine shut down gracefully");
          resolve();
        });
      });
    }
  }

  isEngineReady(): boolean {
    return (
      this.isReady && this.currentEngine !== null && !this.currentEngine.killed
    );
  }

  getEngineStats(): {
    isReady: boolean;
    restartAttempts: number;
    isAnalyzing: boolean;
    queueLength: number;
    lastHeartbeat: Date;
  } {
    return {
      isReady: this.isReady,
      restartAttempts: this.restartAttempts,
      isAnalyzing: this.currentAnalysis !== null,
      queueLength: this.commandQueue.length,
      lastHeartbeat: new Date(this.lastHeartbeat),
    };
  }
}

// Enhanced singleton instance with better error handling
let stockfishInstance: StockfishService | null = null;
let initializationPromise: Promise<StockfishService> | null = null;

export const getStockfishService = async (): Promise<StockfishService> => {
  // If we have a healthy instance, return it
  if (stockfishInstance && stockfishInstance.isEngineReady()) {
    return stockfishInstance;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start new initialization
  initializationPromise = (async () => {
    try {
      // Clean up old instance if exists
      if (stockfishInstance) {
        try {
          await stockfishInstance.shutdown();
        } catch (error) {
          console.warn("Warning during old instance cleanup:", error);
        }
      }

      // Create new instance
      stockfishInstance = new StockfishService();
      await stockfishInstance.initialize();

      // Set up error recovery
      stockfishInstance.on("engine-failed", () => {
        console.error("❌ Engine failed permanently, clearing singleton");
        stockfishInstance = null;
        initializationPromise = null;
      });

      return stockfishInstance;
    } catch (error) {
      stockfishInstance = null;
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
};
