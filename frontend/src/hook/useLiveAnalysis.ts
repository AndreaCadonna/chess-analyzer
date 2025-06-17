// frontend/src/hooks/useLiveAnalysis.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../services/api";

export interface LiveAnalysisLine {
  evaluation: number;
  bestMove: string;
  pv: string[];
  depth: number;
  multiPvIndex: number;
}

export interface LiveAnalysisResult {
  fen: string;
  lines: LiveAnalysisLine[];
  analysisTime: number;
  isComplete: boolean;
}

export interface LiveAnalysisSettings {
  depth: number;
  timeLimit: number;
  multiPV: number;
}

export interface LiveAnalysisState {
  // Connection state
  isConnected: boolean;
  sessionId: string | null;

  // Analysis state
  isAnalyzing: boolean;
  currentResult: LiveAnalysisResult | null;
  lastAnalyzedFen: string | null;

  // Settings
  settings: LiveAnalysisSettings;

  // Error handling
  error: string | null;
  connectionError: string | null;
}

export interface LiveAnalysisActions {
  createSession: () => Promise<void>;
  closeSession: () => Promise<void>;
  analyzePosition: (
    fen: string,
    options?: Partial<LiveAnalysisSettings>
  ) => Promise<void>;
  updateSettings: (settings: Partial<LiveAnalysisSettings>) => Promise<void>;
  clearError: () => void;
}

const DEFAULT_SETTINGS: LiveAnalysisSettings = {
  depth: 18,
  timeLimit: 10000,
  multiPV: 3,
};

export const useLiveAnalysis = (): [LiveAnalysisState, LiveAnalysisActions] => {
  const [state, setState] = useState<LiveAnalysisState>({
    isConnected: false,
    sessionId: null,
    isAnalyzing: false,
    currentResult: null,
    lastAnalyzedFen: null,
    settings: DEFAULT_SETTINGS,
    error: null,
    connectionError: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Cleanup function
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      console.log("🔌 Closing SSE connection");
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    reconnectAttempts.current = 0;
  }, []);

  // Connect to SSE stream
  const connectToStream = useCallback(
    (sessionId: string) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const streamUrl = `${api.defaults.baseURL}/analysis/live/stream/${sessionId}`;
      console.log(`📡 Connecting to SSE stream: ${streamUrl}`);

      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log("✅ SSE connection opened");
        reconnectAttempts.current = 0;
        setState((prev) => ({
          ...prev,
          isConnected: true,
          connectionError: null,
        }));
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📨 SSE event received:", data);

          switch (data.type) {
            case "connection_established":
              console.log("🤝 SSE connection established");
              break;

            case "analysis_started":
              setState((prev) => ({
                ...prev,
                isAnalyzing: true,
                error: null,
              }));
              break;

            case "analysis_complete":
              setState((prev) => ({
                ...prev,
                isAnalyzing: false,
                currentResult: data.data,
                lastAnalyzedFen: data.data.fen,
                error: null,
              }));
              break;

            case "analysis_error":
              setState((prev) => ({
                ...prev,
                isAnalyzing: false,
                error: data.data.message || "Analysis failed",
              }));
              break;

            case "engine_status":
              if (data.data.status === "settings_updated") {
                setState((prev) => ({
                  ...prev,
                  settings: data.data.settings,
                }));
              }
              break;

            case "session_closed":
              setState((prev) => ({
                ...prev,
                isConnected: false,
                sessionId: null,
                isAnalyzing: false,
              }));
              break;

            case "heartbeat":
              // Just keep connection alive, no state changes needed
              break;

            default:
              console.log("🤷 Unknown SSE event type:", data.type);
          }
        } catch (error) {
          console.error("❌ Error parsing SSE event:", error);
        }
      };

      eventSource.onerror = (error) => {
        console.error("❌ SSE connection error:", error);

        setState((prev) => ({
          ...prev,
          isConnected: false,
          connectionError: "Connection lost",
        }));

        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttempts.current),
            10000
          ); // Exponential backoff

          console.log(
            `🔄 Attempting reconnection in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            if (state.sessionId) {
              connectToStream(state.sessionId);
            }
          }, delay);
        } else {
          console.error("❌ Max reconnection attempts reached");
          setState((prev) => ({
            ...prev,
            connectionError: "Connection failed after multiple attempts",
          }));
        }
      };
    },
    [state.sessionId]
  );

  // Create analysis session
  const createSession = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, error: null, connectionError: null }));

      console.log("🚀 Creating live analysis session");
      const response = await api.post("/analysis/live/session");

      if (!response.data.success) {
        throw new Error(response.data.message || "Failed to create session");
      }

      const { sessionId } = response.data.data;
      console.log(`✅ Session created: ${sessionId}`);

      setState((prev) => ({
        ...prev,
        sessionId,
      }));

      // Connect to SSE stream
      connectToStream(sessionId);
    } catch (error) {
      console.error("❌ Failed to create session:", error);
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error ? error.message : "Failed to create session",
      }));
    }
  }, [connectToStream]);

  // Close analysis session
  const closeSession = useCallback(async () => {
    try {
      if (state.sessionId) {
        console.log(`🔚 Closing session: ${state.sessionId}`);
        await api.delete("/analysis/live/session");
      }
    } catch (error) {
      console.error("❌ Error closing session:", error);
    } finally {
      cleanup();
      setState((prev) => ({
        ...prev,
        isConnected: false,
        sessionId: null,
        isAnalyzing: false,
        currentResult: null,
        lastAnalyzedFen: null,
      }));
    }
  }, [state.sessionId, cleanup]);

  // Analyze position
  const analyzePosition = useCallback(
    async (fen: string, options: Partial<LiveAnalysisSettings> = {}) => {
      if (!state.sessionId) {
        throw new Error("No active session. Create a session first.");
      }

      try {
        setState((prev) => ({ ...prev, error: null }));

        console.log(`🔍 Analyzing position: ${fen.substring(0, 50)}...`);

        const requestData = {
          fen,
          ...options,
        };

        const response = await api.post("/analysis/live/analyze", requestData);

        if (!response.data.success) {
          throw new Error(response.data.message || "Analysis failed");
        }

        console.log("✅ Analysis request sent");
        // Results will come via SSE
      } catch (error) {
        console.error("❌ Failed to start analysis:", error);
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Analysis failed",
        }));
      }
    },
    [state.sessionId]
  );

  // Update settings
  const updateSettings = useCallback(
    async (newSettings: Partial<LiveAnalysisSettings>) => {
      if (!state.sessionId) {
        throw new Error("No active session");
      }

      try {
        setState((prev) => ({ ...prev, error: null }));

        console.log("⚙️ Updating analysis settings:", newSettings);

        const response = await api.put("/analysis/live/settings", newSettings);

        if (!response.data.success) {
          throw new Error(response.data.message || "Failed to update settings");
        }

        console.log("✅ Settings updated");
        // Settings update will come via SSE
      } catch (error) {
        console.error("❌ Failed to update settings:", error);
        setState((prev) => ({
          ...prev,
          error:
            error instanceof Error
              ? error.message
              : "Failed to update settings",
        }));
      }
    },
    [state.sessionId]
  );

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
      connectionError: null,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const actions: LiveAnalysisActions = {
    createSession,
    closeSession,
    analyzePosition,
    updateSettings,
    clearError,
  };

  return [state, actions];
};
