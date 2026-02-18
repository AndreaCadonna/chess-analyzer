import { EventEmitter } from "events";
import {
  StockfishService,
  StockfishConfig,
  PositionAnalysis,
  AnalysisOptions,
  AnalysisLine,
} from "./stockfishService";

export interface PoolConfig {
  poolSize: number;
  reservedForLive: number;
  threadsPerWorker: number;
  hashPerWorker: number;
  maxQueueSize: number;
  taskTimeoutMs: number;
}

type TaskPriority = "batch" | "live";

export interface AnalysisProgressInfo {
  fen: string;
  lines: Partial<AnalysisLine>[];
  depth: number;
}

interface PoolTask {
  id: number;
  fen: string;
  options: AnalysisOptions;
  priority: TaskPriority;
  resolve: (result: PositionAnalysis) => void;
  reject: (error: Error) => void;
  enqueuedAt: number;
  retryCount: number;
  maxRetries: number;
  onProgress?: (info: AnalysisProgressInfo) => void;
}

type WorkerStatus = "idle" | "busy" | "crashed" | "restarting";

interface WorkerState {
  id: number;
  engine: StockfishService;
  status: WorkerStatus;
  reserved: boolean;
  currentTask: PoolTask | null;
  completedTasks: number;
  failedTasks: number;
}

export interface PoolStats {
  totalWorkers: number;
  batchWorkers: number;
  reservedWorkers: number;
  idleWorkers: number;
  busyWorkers: number;
  crashedWorkers: number;
  queueLength: number;
  totalCompleted: number;
  totalFailed: number;
}

export class StockfishPool extends EventEmitter {
  private workers: WorkerState[] = [];
  private taskQueue: PoolTask[] = [];
  private config: PoolConfig;
  private isShuttingDown = false;
  private taskIdCounter = 0;

  constructor(config?: Partial<PoolConfig>) {
    super();
    this.config = {
      poolSize: parseInt(process.env.STOCKFISH_POOL_SIZE || "4"),
      reservedForLive: parseInt(process.env.STOCKFISH_RESERVED_LIVE || "1"),
      threadsPerWorker: parseInt(
        process.env.STOCKFISH_THREADS_PER_WORKER || "1"
      ),
      hashPerWorker: parseInt(process.env.STOCKFISH_HASH_PER_WORKER || "64"),
      maxQueueSize: parseInt(process.env.STOCKFISH_POOL_MAX_QUEUE || "200"),
      taskTimeoutMs: parseInt(
        process.env.STOCKFISH_TASK_TIMEOUT_MS || "30000"
      ),
      ...config,
    };

    // Ensure at least 1 batch worker
    if (this.config.poolSize <= this.config.reservedForLive) {
      this.config.poolSize = this.config.reservedForLive + 1;
    }

    console.log(
      `🏊 StockfishPool configured: ${this.config.poolSize} workers ` +
        `(${this.config.reservedForLive} reserved for live), ` +
        `${this.config.threadsPerWorker} threads/worker, ` +
        `${this.config.hashPerWorker}MB hash/worker`
    );
  }

  async initialize(): Promise<void> {
    console.log(`🚀 Initializing StockfishPool with ${this.config.poolSize} workers...`);

    const initPromises: Promise<void>[] = [];

    for (let i = 0; i < this.config.poolSize; i++) {
      const reserved = i < this.config.reservedForLive;
      initPromises.push(this.createWorker(i, reserved));
    }

    await Promise.all(initPromises);

    const readyCount = this.workers.filter(
      (w) => w.status === "idle"
    ).length;
    console.log(
      `✅ StockfishPool ready: ${readyCount}/${this.config.poolSize} workers initialized`
    );

    if (readyCount === 0) {
      throw new Error("Failed to initialize any Stockfish workers");
    }
  }

  private async createWorker(
    id: number,
    reserved: boolean
  ): Promise<void> {
    const engineConfig: StockfishConfig = {
      threads: this.config.threadsPerWorker,
      hash: this.config.hashPerWorker,
    };

    const engine = new StockfishService(engineConfig);

    const worker: WorkerState = {
      id,
      engine,
      status: "crashed", // will be set to idle on success
      reserved,
      currentTask: null,
      completedTasks: 0,
      failedTasks: 0,
    };

    // Store worker early so restartWorker can find it
    if (this.workers.length <= id) {
      this.workers.push(worker);
    } else {
      this.workers[id] = worker;
    }

    try {
      await engine.initialize();
      worker.status = "idle";

      engine.on("engine-failed", () => {
        console.error(`❌ Pool worker ${id} engine failed permanently`);
        this.handleWorkerCrash(id);
      });

      console.log(
        `  ✅ Worker ${id} ready (${reserved ? "reserved/live" : "batch"})`
      );
    } catch (error) {
      console.error(`  ❌ Worker ${id} failed to initialize:`, error);
      worker.status = "crashed";
    }
  }

  analyzePosition(
    fen: string,
    options: AnalysisOptions = {},
    priority: TaskPriority = "batch",
    onProgress?: (info: AnalysisProgressInfo) => void
  ): Promise<PositionAnalysis> {
    if (this.isShuttingDown) {
      return Promise.reject(new Error("Pool is shutting down"));
    }

    if (this.taskQueue.length >= this.config.maxQueueSize) {
      return Promise.reject(
        new Error(
          `Pool queue full (${this.config.maxQueueSize} tasks pending)`
        )
      );
    }

    return new Promise<PositionAnalysis>((resolve, reject) => {
      const task: PoolTask = {
        id: this.taskIdCounter++,
        fen,
        options,
        priority,
        resolve,
        reject,
        enqueuedAt: Date.now(),
        retryCount: 0,
        maxRetries: 2,
        onProgress,
      };

      this.taskQueue.push(task);
      this.dispatch();
    });
  }

  newGame(): void {
    for (const worker of this.workers) {
      if (!worker.reserved && worker.status === "idle") {
        try {
          worker.engine.newGame();
        } catch {
          // Ignore — worker might not be ready
        }
      }
    }
  }

  getStats(): PoolStats {
    const idle = this.workers.filter((w) => w.status === "idle").length;
    const busy = this.workers.filter((w) => w.status === "busy").length;
    const crashed = this.workers.filter(
      (w) => w.status === "crashed" || w.status === "restarting"
    ).length;
    const totalCompleted = this.workers.reduce(
      (s, w) => s + w.completedTasks,
      0
    );
    const totalFailed = this.workers.reduce(
      (s, w) => s + w.failedTasks,
      0
    );

    return {
      totalWorkers: this.workers.length,
      batchWorkers: this.workers.filter((w) => !w.reserved).length,
      reservedWorkers: this.workers.filter((w) => w.reserved).length,
      idleWorkers: idle,
      busyWorkers: busy,
      crashedWorkers: crashed,
      queueLength: this.taskQueue.length,
      totalCompleted,
      totalFailed,
    };
  }

  hasAvailableWorkers(): boolean {
    return this.workers.some(
      (w) => w.status === "idle" || w.status === "busy"
    );
  }

  hasBatchWorkers(): boolean {
    return this.workers.some(
      (w) => !w.reserved && (w.status === "idle" || w.status === "busy")
    );
  }

  async shutdown(): Promise<void> {
    console.log("🔥 Shutting down StockfishPool...");
    this.isShuttingDown = true;

    // Reject all pending tasks
    for (const task of this.taskQueue) {
      task.reject(new Error("Pool shutting down"));
    }
    this.taskQueue = [];

    // Shutdown all workers
    const shutdownPromises = this.workers.map(async (worker) => {
      try {
        if (worker.currentTask) {
          worker.currentTask.reject(new Error("Pool shutting down"));
          worker.currentTask = null;
        }
        await worker.engine.shutdown();
      } catch (error) {
        console.error(`Error shutting down worker ${worker.id}:`, error);
      }
    });

    await Promise.all(shutdownPromises);
    this.workers = [];
    console.log("✅ StockfishPool shut down");
  }

  // ── Internal dispatch ──

  private dispatch(): void {
    if (this.isShuttingDown || this.taskQueue.length === 0) return;

    // Try to assign tasks to idle workers
    // Process live-priority tasks first
    for (let i = 0; i < this.taskQueue.length; i++) {
      const task = this.taskQueue[i];
      const worker = this.getIdleWorker(task.priority);

      if (worker) {
        this.taskQueue.splice(i, 1);
        i--; // adjust index after removal
        this.executeTask(worker, task);
      }
    }
  }

  private getIdleWorker(priority: TaskPriority): WorkerState | null {
    if (priority === "live") {
      // Live tasks prefer reserved workers, but fall back to any idle worker
      return (
        this.workers.find(
          (w) => w.reserved && w.status === "idle"
        ) ||
        this.workers.find((w) => w.status === "idle") ||
        null
      );
    }
    // Batch tasks only use non-reserved workers
    return (
      this.workers.find(
        (w) => !w.reserved && w.status === "idle"
      ) || null
    );
  }

  private executeTask(worker: WorkerState, task: PoolTask): void {
    worker.status = "busy";
    worker.currentTask = task;

    // Forward intermediate analysis events if caller wants them
    const infoHandler = task.onProgress
      ? (info: AnalysisProgressInfo) => {
          task.onProgress!(info);
        }
      : null;

    if (infoHandler) {
      worker.engine.on("analysis-info", infoHandler);
    }

    // Wrap with timeout
    const timeoutHandle = setTimeout(() => {
      if (worker.currentTask === task) {
        console.warn(
          `⏰ Task ${task.id} timed out on worker ${worker.id}, stopping analysis`
        );
        try {
          worker.engine.stopAnalysis();
        } catch {
          // ignore
        }
      }
    }, this.config.taskTimeoutMs);

    worker.engine
      .analyzePosition(task.fen, task.options)
      .then((result) => {
        clearTimeout(timeoutHandle);
        worker.completedTasks++;
        task.resolve(result);
      })
      .catch((error: Error) => {
        clearTimeout(timeoutHandle);
        worker.failedTasks++;

        const isCrash =
          error.message.includes("closed unexpectedly") ||
          error.message.includes("not ready") ||
          error.message.includes("Engine shutting down");

        if (isCrash) {
          this.handleWorkerCrash(worker.id);
        }

        // Retry if possible
        if (task.retryCount < task.maxRetries) {
          task.retryCount++;
          console.warn(
            `🔄 Retrying task ${task.id} (attempt ${task.retryCount + 1}/${task.maxRetries + 1})`
          );
          this.taskQueue.unshift(task); // re-enqueue at front
        } else {
          task.reject(error);
        }
      })
      .finally(() => {
        // Clean up the info listener
        if (infoHandler) {
          worker.engine.removeListener("analysis-info", infoHandler);
        }
        if (worker.currentTask === task) {
          worker.currentTask = null;
          if (worker.status === "busy") {
            worker.status = "idle";
          }
        }
        this.dispatch();
      });
  }

  stopLiveTask(): void {
    for (const worker of this.workers) {
      if (worker.reserved && worker.status === "busy" && worker.currentTask) {
        console.log(`⏹️ Stopping live task ${worker.currentTask.id} on worker ${worker.id}`);
        worker.engine.stopAnalysis();
        break;
      }
    }
  }

  private handleWorkerCrash(workerId: number): void {
    const worker = this.workers[workerId];
    if (!worker || worker.status === "restarting") return;

    console.error(`💥 Worker ${workerId} crashed, scheduling restart`);
    worker.status = "crashed";

    this.emit("worker-crashed", { workerId });
    this.restartWorker(workerId);
  }

  private async restartWorker(workerId: number): Promise<void> {
    const worker = this.workers[workerId];
    if (!worker || this.isShuttingDown) return;

    worker.status = "restarting";

    try {
      // Clean up old engine
      try {
        await worker.engine.shutdown();
      } catch {
        // ignore cleanup errors
      }

      // Wait before restarting
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (this.isShuttingDown) return;

      const engineConfig: StockfishConfig = {
        threads: this.config.threadsPerWorker,
        hash: this.config.hashPerWorker,
      };

      const newEngine = new StockfishService(engineConfig);
      await newEngine.initialize();

      worker.engine = newEngine;
      worker.status = "idle";

      newEngine.on("engine-failed", () => {
        this.handleWorkerCrash(workerId);
      });

      console.log(`✅ Worker ${workerId} restarted successfully`);
      this.emit("worker-restored", { workerId });
      this.dispatch();
    } catch (error) {
      console.error(`❌ Worker ${workerId} restart failed:`, error);
      worker.status = "crashed";
    }
  }
}

// ── Singleton accessor ──

let poolInstance: StockfishPool | null = null;
let poolInitPromise: Promise<StockfishPool> | null = null;

export const getStockfishPool = async (): Promise<StockfishPool> => {
  if (poolInstance && poolInstance.hasAvailableWorkers()) {
    return poolInstance;
  }

  if (poolInitPromise) {
    return poolInitPromise;
  }

  poolInitPromise = (async () => {
    try {
      if (poolInstance) {
        try {
          await poolInstance.shutdown();
        } catch {
          // ignore cleanup errors
        }
      }

      poolInstance = new StockfishPool();
      await poolInstance.initialize();
      poolInitPromise = null;
      return poolInstance;
    } catch (error) {
      poolInstance = null;
      poolInitPromise = null;
      throw error;
    }
  })();

  return poolInitPromise;
};
