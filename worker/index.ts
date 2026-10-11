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

interface Env {
  ASSETS: { fetch(input: Request | URL | string, init?: RequestInit): Promise<Response> };
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
  }
};
