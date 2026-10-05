import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleMediaPoc } from '../../src/server/cxlMediaPoc.js';
import { handleGoogleWorkMediaRead, ownerSessionValid } from '../../src/server/cxlGoogleWorkMedia.js';
import { directOwnerReadsEnabled, directWorkMedia } from './googleDirect.js';
import { clientIp, PUBLIC_MEDIA_RATE_LIMIT, rateLimitRetryAfter } from '../../src/server/rateLimit.js';
import { RATE_LIMITED_MESSAGE } from '../../src/lib/publicApiErrors.js';
export { mediaPocLimits } from '../../src/server/cxlMediaPoc.js';

type Request = IncomingMessage & { body?: unknown; url?: string };
type Response = ServerResponse & {
  end: (data?: string | Buffer) => void;
  write: (chunk: Uint8Array) => boolean;
  once: (event: 'drain', listener: () => void) => Response;
  destroy: (error?: Error) => void;
};
const GAS_TIMEOUT_MS = 12_000;
const MAX_ICON_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
// Legacy references with no Drive file (still only in Supabase): remember the miss per
// instance so a page of them does not spend the Sheets read quota on every view.
const LEGACY_MISS_TTL_MS = 10 * 60_000;
const legacyMisses = new Map<string, number>();

function sendError(res: Response, status: number, error: string) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify({ ok: false, error }));
}

function publicGasEndpoint(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'script.google.com'
      && /^\/macros\/s\/[^/]+\/exec\/?$/.test(url.pathname) ? url : null;
  } catch { return null; }
}

function cacheHeaders(res: Response, etag?: string) {
  // Legacy refs point at fixed bytes (media id or content hash), so viewers may keep them for a day.
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=3600, stale-while-revalidate=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (etag) res.setHeader('ETag', etag);
}

async function publicIconHandler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendError(res, 405, 'Method not allowed');
  }

  let params: URLSearchParams;
  try { params = new URL(req.url || '/', 'https://cxl.invalid').searchParams; }
  catch { return sendError(res, 400, 'Invalid media request'); }

  const workId = params.get('workId') || '';
  const ref = params.get('ref') || '';
  const version = params.get('v') || '';
  if (!/^asset_[a-zA-Z0-9_-]{1,128}$/.test(workId)) return sendError(res, 400, 'Invalid Work ID');
  if (!(/^media:[A-Za-z0-9_-]{1,128}$/.test(ref) || /^cxl-media:[a-f0-9]{64}$/.test(ref))) {
    return sendError(res, 400, 'Invalid icon reference');
  }
  if (version && (version.length > 17 || !/^-?(?:0|[1-9]\d{0,15})$/.test(version))) return sendError(res, 400, 'Invalid media version');

  // Legacy media (migrated with a drive_file_id): read from Drive directly, falling
  // back to the Temporary Public Apps Script for anything not reachable that way.
  if (ref.startsWith('media:') && directOwnerReadsEnabled()) {
    const missKey = `${workId}|${ref}`;
    if ((legacyMisses.get(missKey) || 0) > Date.now()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', ownerSessionValid(req) ? 'private, max-age=600' : 'public, max-age=300, s-maxage=3600');
      return res.end(JSON.stringify({ ok: false, error: 'Media is unavailable' }));
    }
    try {
      // Public Works first; a signed-in Owner may also see legacy images of private Works.
      let direct = await directWorkMedia(workId, ref, 'public', false);
      let ownerOnly = false;
      if (!direct && ownerSessionValid(req)) { direct = await directWorkMedia(workId, ref, 'owner', false); ownerOnly = direct !== null; }
      console.info(JSON.stringify({ event: 'cxl_direct_media_read', scope: ownerOnly ? 'legacy-owner' : 'legacy', used: direct !== null }));
      if (direct) {
        const etag = `"${createHash('sha256').update(direct.bytes).digest('hex')}"`;
        cacheHeaders(res, etag);
        // Never let the CDN keep a private Work's image; the Owner's own browser may.
        if (ownerOnly) res.setHeader('Cache-Control', 'private, max-age=3600');
        res.setHeader('Content-Type', direct.mimeType);
        res.setHeader('Content-Length', String(direct.bytes.length));
        if (req.headers['if-none-match'] === etag) { res.statusCode = 304; return res.end(); }
        res.statusCode = 200;
        return res.end(direct.bytes);
      }
      // Definitive miss: no Drive file behind this reference (e.g. an image still only in
      // Supabase). Apps Script reads the same records, so skip it and let the CDN remember
      // the miss instead of re-trying dozens of images on every page view.
      legacyMisses.set(missKey, Date.now() + LEGACY_MISS_TTL_MS);
      if (legacyMisses.size > 2000) for (const [key, until] of legacyMisses) if (until <= Date.now()) legacyMisses.delete(key);
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', ownerSessionValid(req) ? 'private, max-age=600' : 'public, max-age=300, s-maxage=3600');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.end(JSON.stringify({ ok: false, error: 'Media is unavailable' }));
    } catch (error) {
      console.info(JSON.stringify({ event: 'cxl_direct_read_failed', action: 'media.legacy', reason: error instanceof Error ? error.message.slice(0, 120) : 'unknown' }));
    }
  }

  const endpoint = publicGasEndpoint(process.env.CXL_GAS_PUBLIC_URL);
  if (!endpoint) return sendError(res, 503, 'Public media is unavailable');
  endpoint.searchParams.set('cxlApi', 'media.icon');
  endpoint.searchParams.set('id', workId);
  endpoint.searchParams.set('ref', ref);

  try {
    const upstream = await fetch(endpoint.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(GAS_TIMEOUT_MS)
    });
    if (!upstream.ok) return sendError(res, 502, 'Public icon could not be loaded');

    let result: unknown;
    try { result = await upstream.json(); }
    catch { return sendError(res, 502, 'Public icon response was invalid'); }
    if (!result || typeof result !== 'object' || Array.isArray(result)
      || (result as { ok?: unknown }).ok !== true) {
      return sendError(res, 404, 'Public icon is unavailable');
    }
    const data = (result as { data?: unknown }).data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return sendError(res, 502, 'Public icon response was invalid');
    const mimeType = (data as { mimeType?: unknown }).mimeType;
    const base64 = (data as { base64?: unknown }).base64;
    if (typeof mimeType !== 'string' || !ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
      return sendError(res, 415, 'Unsupported icon image type');
    }
    if (typeof base64 !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
      return sendError(res, 502, 'Public icon response was invalid');
    }
    const bytes = Buffer.from(base64, 'base64');
    if (!bytes.length) return sendError(res, 404, 'Public icon is unavailable');
    if (bytes.length > MAX_ICON_BYTES) return sendError(res, 413, 'Icon image is too large');

    const etag = `"${createHash('sha256').update(bytes).digest('hex')}"`;
    cacheHeaders(res, etag);
    res.setHeader('Content-Type', mimeType.toLowerCase());
    res.setHeader('Content-Length', String(bytes.length));
    if (req.headers['if-none-match'] === etag) {
      res.statusCode = 304;
      return res.end();
    }
    res.statusCode = 200;
    return res.end(bytes);
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || /time.?out/i.test(error.message))) {
      return sendError(res, 504, 'Public icon request timed out');
    }
    return sendError(res, 502, 'Public icon is unavailable');
  }
}

export default async function handler(req: Request, res: Response) {
  let params: URLSearchParams;
  try { params = new URL(req.url || '/', 'https://cxl.invalid').searchParams; }
  catch { return sendError(res, 400, 'Invalid media request'); }

  const retryAfter = ownerSessionValid(req) ? 0 : rateLimitRetryAfter(`media:${clientIp(req)}`, PUBLIC_MEDIA_RATE_LIMIT);
  if (retryAfter) { res.setHeader('Retry-After', String(retryAfter)); return sendError(res, 429, RATE_LIMITED_MESSAGE); }

  if (params.has('poc')) {
    if (params.getAll('poc').length !== 1 || params.get('poc') !== '1') {
      return sendError(res, 404, 'Media proof-of-concept is unavailable');
    }
    return handleMediaPoc(req, res);
  }

  // Google Work media references opt into the private, association-checked
  // proxy with an explicit scope. Legacy media continues through its existing
  // public icon route unchanged.
  if (params.has('scope')) return handleGoogleWorkMediaRead(req, res);

  return publicIconHandler(req, res);
}
