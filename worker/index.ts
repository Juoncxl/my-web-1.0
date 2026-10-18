/**
 * Cloudflare Workers entry: the same /api/cxl/* handlers Vercel and Render run.
 *
 * Static files (the built SPA in dist/) are served by Workers Static Assets and never
 * reach this code, except the paths wrangler.jsonc routes here first: /api/*,
 * /work/* (rewritten to the share handler so link previews see the Work's own tags)
 * and /@slug profiles.
 * Headers for static files come from public/_headers.
 */
import { API_ROUTES } from '../server/apiRoutes';
import { SECURITY_HEADERS } from '../server/securityHeaders';
import { setShareShellLoader } from '../api/cxl/share';
import { runNodeHandler } from './nodeAdapter';
import { setMediaObjectCache, type MediaObjectCache } from '../src/server/mediaObjectCache';
import { setMediaBucket, type MediaBucket } from '../src/server/cxlR2Media';
import { setSourceDb, type D1Like } from '../src/server/cxlSourceStore';
import { setWorkDb } from '../src/server/cxlWorkStore';
import { retryWorkStoreMirrors } from '../api/cxl/google';

interface R2Bucket {
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null>;
  put(key: string, value: ArrayBuffer | Uint8Array | string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
  list(options: { prefix?: string; cursor?: string; limit?: number }): Promise<{ objects: { key: string; uploaded: Date }[]; truncated: boolean; cursor?: string }>;
}

function r2WorkMediaBucket(bucket: R2Bucket): MediaBucket {
  return {
    async get(key) {
      const object = await bucket.get(key);
      return object ? { bytes: Buffer.from(await object.arrayBuffer()), contentType: object.httpMetadata?.contentType || '' } : null;
    },
    async put(key, value, contentType) {
      await bucket.put(key, value, { httpMetadata: { contentType } });
    },
    async delete(keys) {
      if (keys.length) await bucket.delete(keys);
    },
    async list(prefix, cursor) {
      const page = await bucket.list({ prefix, cursor, limit: 1000 });
      return { keys: page.objects.map(object => ({ key: object.key, uploaded: object.uploaded.getTime() })), cursor: page.truncated ? page.cursor : undefined };
    }
  };
}

interface Env {
  ASSETS: { fetch(input: Request | URL | string, init?: RequestInit): Promise<Response> };
  // R2 copy of Drive images (wrangler.jsonc r2_buckets); absent means Drive only.
  MEDIA_BUCKET?: R2Bucket;
  // D1 copies of the Sheets/Drive sources the API reads (wrangler.jsonc d1_databases).
  DATA_DB?: D1Like;
}

function r2MediaCache(bucket: R2Bucket): MediaObjectCache {
  return {
    async get(key) {
      const object = await bucket.get(key);
      if (!object) return null;
      return { bytes: Buffer.from(await object.arrayBuffer()), mimeType: object.httpMetadata?.contentType || '' };
    },
    async put(key, bytes, mimeType) {
      await bucket.put(key, bytes, { httpMetadata: { contentType: mimeType } });
    }
  };
}

function bindStores(env: Env): void {
  setSourceDb(env.DATA_DB || null);
  setWorkDb(env.DATA_DB || null);
}

function withSecurityHeaders(response: Response): Response {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) secured.headers.set(name, value);
  return secured;
}

const text = (status: number, body: string) => new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const handler = API_ROUTES[url.pathname.replace(/\/$/, '')];
  if (handler) return runNodeHandler(handler, request, url);
  if (url.pathname.startsWith('/api/')) return text(404, 'Not found');

  // vercel.json rewrite: /work/:id -> /api/cxl/share?id=:id
  const work = url.pathname.match(/^\/work\/([^/]+)\/?$/);
  if (work) {
    const shareUrl = new URL(`/api/cxl/share?id=${work[1]}`, url);
    return runNodeHandler(API_ROUTES['/api/cxl/share'], request, shareUrl);
  }
  // Static Assets would redirect /@slug to /%40slug; serve the app shell as is.
  if (url.pathname.startsWith('/@')) return env.ASSETS.fetch(new URL('/', url));
  // Anything else routed here (e.g. /work/:id/edit) is the app itself.
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    setMediaObjectCache(env.MEDIA_BUCKET ? r2MediaCache(env.MEDIA_BUCKET) : null);
    setMediaBucket(env.MEDIA_BUCKET ? r2WorkMediaBucket(env.MEDIA_BUCKET) : null);
    bindStores(env);
    setShareShellLoader(async () => {
      const response = await env.ASSETS.fetch(new URL('/', request.url));
      if (!response.ok) throw new Error(`Shell HTTP ${response.status}`);
      return response.text();
    });
    try {
      return withSecurityHeaders(await route(request, env));
    } catch (error) {
      console.error(JSON.stringify({ event: 'cxl_worker_error', reason: error instanceof Error ? error.message.slice(0, 200) : 'unknown' }));
      return withSecurityHeaders(text(500, 'Server error'));
    }
  },

  /** Hourly cron (wrangler.jsonc triggers): catch up Sheets/Drive backups that fell behind D1. */
  async scheduled(_controller: unknown, env: Env): Promise<void> {
    setMediaBucket(env.MEDIA_BUCKET ? r2WorkMediaBucket(env.MEDIA_BUCKET) : null);
    bindStores(env);
    try {
      await retryWorkStoreMirrors(3);
    } catch (error) {
      console.error(JSON.stringify({ event: 'cxl_scheduled_failed', reason: error instanceof Error ? error.message.slice(0, 200) : 'unknown' }));
    }
  }
};
