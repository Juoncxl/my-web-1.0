// Scoped Work media is read through /api/cxl/media, which authorizes each image against
// Google Sheets. A page that asks for dozens of images at once can briefly exhaust the
// Sheets quota (HTTP 429, answered as 504), so a failed image is retried a few times
// with growing, jittered delays before it is given up on.
export const MEDIA_IMAGE_MAX_RETRIES = 3;
const RETRY_BASE_DELAYS_MS = [2_000, 6_000, 15_000];
const RETRY_JITTER_MS = 1_500;

/** Only association-checked Work media is retried; a legacy miss is a definitive 404. */
export function isRetryableMediaSrc(src: string): boolean {
  if (!src.startsWith('/api/cxl/media?')) return false;
  try { return new URL(src, 'https://cxl.invalid').searchParams.has('scope'); }
  catch { return false; }
}

/** A distinct URL per attempt, so neither the browser nor the CDN reuses the failure. */
export function mediaImageAttemptSrc(src: string, attempt: number): string {
  if (attempt <= 0 || !isRetryableMediaSrc(src)) return src;
  return `${src}&retry=${attempt}`;
}

export function mediaImageRetryDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = RETRY_BASE_DELAYS_MS[Math.min(Math.max(attempt, 1), RETRY_BASE_DELAYS_MS.length) - 1];
  return base + Math.floor(random() * RETRY_JITTER_MS);
}
