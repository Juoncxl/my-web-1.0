import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fetchPublicWorksSnapshot } from './google.js';

type Request = IncomingMessage;
type Response = ServerResponse & { json?: (body: unknown) => void };

const PUBLIC_CACHE_CONTROL = 'public, max-age=0, s-maxage=30, stale-while-revalidate=120';
const SAFE_GAS_TIMING_PHASES = new Set(['snapshot_manifest_read', 'snapshot_chunks_read', 'snapshot_parse', 'total']);

function send(res: Response, status: number, body: unknown, cacheControl = 'no-store') {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

function previewTiming(res: Response, timing: Awaited<ReturnType<typeof fetchPublicWorksSnapshot>>['timing'], totalElapsedMs: number) {
  if (process.env.VERCEL_ENV !== 'preview') return;
  const metrics = [
    `vercel_handler_start_to_gas;dur=${timing.handlerStartToGasMs.toFixed(2)}`,
    `gas_total;dur=${timing.gasElapsedMs.toFixed(2)}`,
    `response_validation;dur=${timing.responseValidationMs.toFixed(2)}`
  ];
  const gasTiming = timing.gas;
  if (gasTiming && typeof gasTiming === 'object' && 'phases' in gasTiming
    && gasTiming.phases && typeof gasTiming.phases === 'object') {
    for (const [phase, duration] of Object.entries(gasTiming.phases)) {
      if (SAFE_GAS_TIMING_PHASES.has(phase) && typeof duration === 'number' && Number.isFinite(duration) && duration >= 0) {
        metrics.push(`${phase};dur=${duration.toFixed(2)}`);
      }
    }
  }
  metrics.push(`total;dur=${totalElapsedMs.toFixed(2)}`);
  res.setHeader('Server-Timing', metrics.join(', '));
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed' });
  const startedAt = Date.now();
  try {
    const { works, timing } = await fetchPublicWorksSnapshot();
    const etag = `"${createHash('sha256').update(JSON.stringify(works)).digest('base64url')}"`;
    res.setHeader('Cache-Control', PUBLIC_CACHE_CONTROL);
    res.setHeader('ETag', etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    previewTiming(res, timing, Date.now() - startedAt);
    const ifNoneMatch = req.headers['if-none-match'];
    const validators = Array.isArray(ifNoneMatch) ? ifNoneMatch : (ifNoneMatch || '').split(',').map(value => value.trim());
    if (validators.includes(etag) || validators.includes('*')) {
      res.statusCode = 304;
      return res.end();
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: true, data: { data: works, error: null } }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google public Works read failed';
    const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
      ? error.status
      : error instanceof Error && (error.name === 'TimeoutError' || /time.?out/i.test(message)) ? 504 : 502;
    res.setHeader('Server-Timing', `total;dur=${(Date.now() - startedAt).toFixed(2)}`);
    return send(res, status, { ok: false, error: message.slice(0, 300) });
  }
}

