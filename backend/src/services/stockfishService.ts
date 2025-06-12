import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import path from "path";

export interface AnalysisOptions {
  depth?: number;
  timeLimit?: number;
  threads?: number;
}

export interface PositionAnalysis {
  fen: string;
  evaluation: number; // Centipawn evaluation
  bestMove: string;
  bestLine: string[];
  depth: number;
  timeSpent: number;
  pv: string; // Principal variation
}

export interface MoveClassification {
  move: string;
  evaluation: number;
  classification: "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";
  centipawnLoss: number;
}

export class StockfishService extends EventEmitter {
  private enginePath: string;
  private currentEngine: ChildProcess | null = null;
  private isReady: boolean = false;
  private outputBuffer: string = "";
  private analysisQueue: Array<{
    fen: string;
    options: AnalysisOptions;
    resolve: (result: PositionAnalysis) => void;
    reject: (error: Error) => void;
  }> = [];
  private isAnalyzing: boolean = false;

  constructor() {
    super();

    // Default engine path - will be configurable via environment
    this.enginePath =
      process.env.STOCKFISH_PATH || this.getDefaultStockfishPath();

    console.log(
      `🔥 Stockfish service initialized with path: ${this.enginePath}`
    );
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

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`🚀 Initializing Stockfish engine at: ${this.enginePath}`);

      try {
        this.currentEngine = spawn(this.enginePath);

        if (!this.currentEngine.stdout || !this.currentEngine.stdin) {
          throw new Error("Failed to create engine streams");
        }

        // Handle engine output
        this.currentEngine.stdout.on("data", (data: Buffer) => {
          this.handleEngineOutput(data.toString());
        });

        // Handle engine errors
        this.currentEngine.stderr?.on("data", (data: Buffer) => {
          console.error("❌ Stockfish stderr:", data.toString());
        });

        // Handle engine close
        this.currentEngine.on("close", (code) => {
          console.log(`🔥 Stockfish engine closed with code: ${code}`);
          this.isReady = false;
          this.currentEngine = null;
        });

        // Handle spawn errors
        this.currentEngine.on("error", (error) => {
          console.error("❌ Stockfish spawn error:", error);
          reject(new Error(`Failed to start Stockfish: ${error.message}`));
        });

        // Initialize UCI communication
        this.sendCommand("uci");

        // Wait for UCI OK response
        const timeout = setTimeout(() => {
          reject(new Error("Stockfish initialization timeout"));
        }, 10000);

        this.once("ready", () => {
          clearTimeout(timeout);
          console.log("✅ Stockfish engine ready!");
          resolve();
        });
      } catch (error) {
        reject(
          new Error(
            `Failed to initialize Stockfish: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          )
        );
      }
    });
  }

  private handleEngineOutput(data: string): void {
    this.outputBuffer += data;
    const lines = this.outputBuffer.split("\n");

    // Keep incomplete last line in buffer
    this.outputBuffer = lines.pop() || "";

    for (const line of lines) {
      this.processEngineMessage(line.trim());
    }
  }

  private processEngineMessage(message: string): void {
    console.log(`📨 Stockfish: ${message}`);

    if (message === "uciok") {
      this.configureEngine();
    } else if (message === "readyok") {
      this.isReady = true;
      this.emit("ready");
    } else if (message.startsWith("info")) {
      this.processAnalysisInfo(message);
    } else if (message.startsWith("bestmove")) {
      this.processBestMove(message);
    }
  }

  private configureEngine(): void {
    // Configure engine settings
    this.sendCommand("setoption name Threads value 2");
    this.sendCommand("setoption name Hash value 128");
    this.sendCommand("isready");
  }

  private processAnalysisInfo(message: string): void {
    // Parse UCI info messages
    // Example: info depth 15 seldepth 22 multipv 1 score cp 25 nodes 1234567 nps 987654 time 1250 pv e2e4 e7e5
    const parts = message.split(" ");
    const info: any = {};

    for (let i = 1; i < parts.length; i += 2) {
      const key = parts[i];
      const value = parts[i + 1];

      if (key && value) {
        if (
          key === "depth" ||
          key === "seldepth" ||
          key === "time" ||
          key === "nodes" ||
          key === "nps"
        ) {
          info[key] = parseInt(value);
        } else if (key === "score") {
          i++; // Skip 'score'
          const scoreType = parts[i]; // 'cp' or 'mate'
          const scoreValue = parts[i + 1];
          if (scoreType === "cp") {
            info.evaluation = parseInt(scoreValue);
          } else if (scoreType === "mate") {
            info.mateIn = parseInt(scoreValue);
          }
        } else if (key === "pv") {
          // Principal variation - rest of the line
          info.pv = parts.slice(i + 1).join(" ");
          break;
        }
      }
    }

    this.emit("analysis-info", info);
  }

  private processBestMove(message: string): void {
    // Example: bestmove e2e4 ponder e7e5
    const parts = message.split(" ");
    const bestMove = parts[1];
    const ponder = parts.length > 3 ? parts[3] : null;

    this.emit("bestmove", { bestMove, ponder });
  }

  private sendCommand(command: string): void {
    if (!this.currentEngine?.stdin) {
      throw new Error("Engine not initialized");
    }

    console.log(`📤 Sending to Stockfish: ${command}`);
    this.currentEngine.stdin.write(command + "\n");
  }

  async analyzePosition(
    fen: string,
    options: AnalysisOptions = {}
  ): Promise<PositionAnalysis> {
    if (!this.isReady) {
      throw new Error("Stockfish engine not ready");
    }

    return new Promise((resolve, reject) => {
      this.analysisQueue.push({ fen, options, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isAnalyzing || this.analysisQueue.length === 0) {
      return;
    }

    this.isAnalyzing = true;
    const { fen, options, resolve, reject } = this.analysisQueue.shift()!;

    try {
      const result = await this.performAnalysis(fen, options);
      resolve(result);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isAnalyzing = false;
      // Process next item in queue
      if (this.analysisQueue.length > 0) {
        setImmediate(() => this.processQueue());
      }
    }
  }

  private async performAnalysis(
    fen: string,
    options: AnalysisOptions
  ): Promise<PositionAnalysis> {
    const startTime = Date.now();
    const depth = options.depth || 15;
    const timeLimit = options.timeLimit || 5000; // 5 seconds default

    return new Promise((resolve, reject) => {
      let analysisInfo: any = {};

      const timeout = setTimeout(() => {
        reject(new Error(`Analysis timeout for position: ${fen}`));
      }, timeLimit + 2000);

      const onAnalysisInfo = (info: any) => {
        if (info.depth >= depth) {
          analysisInfo = info;
        }
      };

      const onBestMove = (result: { bestMove: string; ponder?: string }) => {
        clearTimeout(timeout);
        this.removeListener("analysis-info", onAnalysisInfo);
        this.removeListener("bestmove", onBestMove);

        const timeSpent = Date.now() - startTime;

        const analysis: PositionAnalysis = {
          fen,
          evaluation: analysisInfo.evaluation || 0,
          bestMove: result.bestMove,
          bestLine: analysisInfo.pv
            ? analysisInfo.pv.split(" ")
            : [result.bestMove],
          depth: analysisInfo.depth || depth,
          timeSpent,
          pv: analysisInfo.pv || result.bestMove,
        };

        resolve(analysis);
      };

      this.on("analysis-info", onAnalysisInfo);
      this.on("bestmove", onBestMove);

      // Send analysis commands
      this.sendCommand(`position fen ${fen}`);
      this.sendCommand(`go depth ${depth}`);
    });
  }

  classifyMove(previousEval: number, currentEval: number): MoveClassification {
    const centipawnLoss = Math.abs(currentEval - previousEval);

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

  async shutdown(): Promise<void> {
    if (this.currentEngine) {
      this.sendCommand("quit");

      return new Promise((resolve) => {
        this.currentEngine!.on("close", () => {
          this.currentEngine = null;
          this.isReady = false;
          console.log("🔥 Stockfish engine shut down");
          resolve();
        });
      });
    }
  }

  isEngineReady(): boolean {
    return this.isReady;
  }
}

// Singleton instance
let stockfishInstance: StockfishService | null = null;

export const getStockfishService = async (): Promise<StockfishService> => {
  if (!stockfishInstance) {
    stockfishInstance = new StockfishService();
    await stockfishInstance.initialize();
  }
  return stockfishInstance;
};
