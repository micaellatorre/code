// src/app/lib/http.ts
export type RetryOptions = {
    retries: number;
    baseDelayMs: number; // backoff base
    retryOn: (res: Response | null, err: unknown) => boolean;
  };
  
  export async function fetchWithTimeout(
    input: RequestInfo | URL,
    init: RequestInit & { timeoutMs?: number } = {}
  ) {
    const { timeoutMs = 15000, ...rest } = init;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...rest, signal: controller.signal });
    } finally {
      clearTimeout(id);
    }
  }
  
  export async function fetchWithRetry(
    input: RequestInfo | URL,
    init: RequestInit & { timeoutMs?: number } = {},
    opts: RetryOptions = {
      retries: 2,
      baseDelayMs: 500,
      retryOn: (res, err) => {
        if (err) return true; // timeouts, network
        if (!res) return true;
        // Retry 408/429/5xx
        if (res.status === 408 || res.status === 429) return true;
        if (res.status >= 500) return true;
        return false;
      }
    }
  ): Promise<Response> {
    let attempt = 0;
    let lastErr: unknown = null;
    while (attempt <= opts.retries) {
      try {
        const res = await fetchWithTimeout(input, init);
        if (!opts.retryOn(res, null)) return res;
        // si hay que reintentar por status
        if (attempt === opts.retries) return res;
      } catch (e) {
        lastErr = e;
        if (attempt === opts.retries) throw e;
      }
      // backoff exponencial con jitter
      const delay = opts.baseDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
      await new Promise(r => setTimeout(r, delay));
      attempt++;
    }
    // si cae aquí, relanzamos último error
    throw lastErr ?? new Error("fetchWithRetry: agotados reintentos");
  }
  