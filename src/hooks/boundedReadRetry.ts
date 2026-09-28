export const BOOTSTRAP_READ_RETRY_DELAY_MS = 500;
export const BOOTSTRAP_READ_MAX_RETRIES = 1;

type RetryOptions<T> = {
  enabled: boolean;
  isCurrent: () => boolean;
  getError?: (value: T) => unknown;
  onRetry?: () => void;
  delayMs?: number;
};

function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') return error.status;
  return undefined;
}

export function isTransientReadFailure(error: unknown): boolean {
  const status = errorStatus(error);
  if (status !== undefined) return status === 502 || status === 503 || status === 504;
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) return true;
  const message = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
  return /(?:\b502\b|\b503\b|\b504\b|time.?out|timed out|network error|failed to fetch|fetch failed|load failed)/i.test(message);
}

const wait = (delayMs: number) => new Promise<void>(resolve => setTimeout(resolve, delayMs));

/** Runs at most one scope-guarded retry for an enabled initial Works read. */
export async function readWithBoundedRetry<T>(read: () => Promise<T>, options: RetryOptions<T>): Promise<T> {
  let retries = 0;
  while (true) {
    try {
      const value = await read();
      const failure = options.getError?.(value);
      if (!failure || !options.enabled || retries >= BOOTSTRAP_READ_MAX_RETRIES || !options.isCurrent() || !isTransientReadFailure(failure)) return value;
      retries += 1;
      options.onRetry?.();
      await wait(options.delayMs ?? BOOTSTRAP_READ_RETRY_DELAY_MS);
      if (!options.isCurrent()) return value;
    } catch (error) {
      if (!options.enabled || retries >= BOOTSTRAP_READ_MAX_RETRIES || !options.isCurrent() || !isTransientReadFailure(error)) throw error;
      retries += 1;
      options.onRetry?.();
      await wait(options.delayMs ?? BOOTSTRAP_READ_RETRY_DELAY_MS);
      if (!options.isCurrent()) throw error;
    }
  }
}
