import type { IncomingMessage, ServerResponse } from 'node:http';
import { fetchPublicWorkDetail } from './google.js';
import { ownerSessionValid } from '../../src/server/cxlGoogleWorkMedia.js';
import { clientIp, PUBLIC_API_RATE_LIMIT, rateLimitRetryAfter } from '../../src/server/rateLimit.js';
import { publicErrorMessage, RATE_LIMITED_MESSAGE } from '../../src/lib/publicApiErrors.js';

type Request = IncomingMessage;
type Response = ServerResponse;

// Same CDN policy as the public Works list: a stalled Apps Script response falls
// back to the last good copy instead of reaching the visitor.
const PUBLIC_CACHE_CONTROL = 'public, max-age=0, s-maxage=30, stale-while-revalidate=86400, stale-if-error=604800';
const NOT_FOUND_CACHE_CONTROL = 'public, max-age=0, s-maxage=30';

function send(res: Response, status: number, body: unknown, cacheControl = 'no-store') {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed' });
  const retryAfter = ownerSessionValid(req) ? 0 : rateLimitRetryAfter(`api:${clientIp(req)}`, PUBLIC_API_RATE_LIMIT);
  if (retryAfter) { res.setHeader('Retry-After', String(retryAfter)); return send(res, 429, { ok: false, error: RATE_LIMITED_MESSAGE }); }
  const id = new URL(req.url || '/', 'http://localhost').searchParams.get('id') || '';
  if (!/^asset_[A-Za-z0-9_-]{1,96}$/.test(id)) return send(res, 400, { ok: false, error: 'Invalid public Work id' });
  const startedAt = Date.now();
  try {
    const works = await fetchPublicWorkDetail(id);
    if (process.env.VERCEL_ENV === 'preview') res.setHeader('Server-Timing', `total;dur=${(Date.now() - startedAt).toFixed(2)}`);
    return send(res, 200, { ok: true, data: { data: works, error: null } }, PUBLIC_CACHE_CONTROL);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google public Work read failed';
    const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
      ? error.status
      : error instanceof Error && (error.name === 'TimeoutError' || /time.?out/i.test(message)) ? 504 : 502;
    console.info(JSON.stringify({ event: 'cxl_public_work_failed', status, reason: message.slice(0, 120) }));
    return send(res, status, { ok: false, error: publicErrorMessage(status) }, status === 404 ? NOT_FOUND_CACHE_CONTROL : 'no-store');
  }
}
