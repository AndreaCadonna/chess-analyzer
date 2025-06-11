interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  timeout?: number;
}

export class HttpClient {
  private baseURL: string;
  private defaultTimeout: number;

  constructor(baseURL: string, timeout = 10000) {
    this.baseURL = baseURL;
    this.defaultTimeout = timeout;
  }

  async get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout || this.defaultTimeout
    );

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "ChessAnalyzer/1.0",
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}
