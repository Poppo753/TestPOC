const TRANSIENT_RPC_ERROR = /(timeout|timed out|429|rate.?limit|too many requests|network error|socket|econnreset|server error|temporarily unavailable)/i;

export interface RetryOptions {
  retries: number;
  delayMs: number;
}

/** Retries idempotent RPC reads only. Never wrap a transaction send with this helper. */
export async function withRpcRetry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === options.retries || !TRANSIENT_RPC_ERROR.test(message)) throw error;
      const delay = options.delayMs * (2 ** attempt);
      await new Promise<void>(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

