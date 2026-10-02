import type { IncomingMessage } from 'node:http';

/**
 * Best-effort per-IP rate limit for public (signed-out) API routes.
 *
 * State lives in this function instance's memory, so the limit is per instance,
 * not global: it stops one client hammering an instance (and the Google Sheets
 * quota behind it) but is not a hard guarantee. CDN-cached responses never reach
 * this code, so normal browsing does not count against it.
 */
export interface RateLimitRule { limit: number; windowMs: number }

export const PUBLIC_API_RATE_LIMIT: RateLimitRule = { limit: 120, windowMs: 60_000 };
export const PUBLIC_MEDIA_RATE_LIMIT: RateLimitRule = { limit: 400, windowMs: 60_000 };

const MAX_TRACKED_CLIENTS = 5000;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function clientIp(req: IncomingMessage): string {
  const header = (name: string) => {
    const value = req.headers[name];
    return (Array.isArray(value) ? value[0] : value || '').split(',')[0].trim();
  };
  return header('x-real-ip') || header('x-forwarded-for') || req.socket?.remoteAddress || 'unknown';
}

/** Counts one request; returns the seconds to wait when over the limit, else 0. */
export function rateLimitRetryAfter(key: string, rule: RateLimitRule, now = Date.now()): number {
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_TRACKED_CLIENTS) {
      for (const [oldKey, old] of buckets) if (old.resetAt <= now) buckets.delete(oldKey);
      if (buckets.size >= MAX_TRACKED_CLIENTS) buckets.clear();
    }
    bucket = { count: 0, resetAt: now + rule.windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count > rule.limit ? Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) : 0;
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}
