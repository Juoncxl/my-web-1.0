import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS } from '../server/securityHeaders';
import { API_ROUTES } from '../server/apiRoutes';
import { MAX_BODY_BYTES, runNodeHandler, toNodeRequest } from './nodeAdapter';
import worker from './index';

const SHELL = '<!doctype html><html><head><title>CXL Studio</title><meta name="description" content="x" /></head><body><script type="module" src="/assets/index-abc.js"></script></body></html>';

function assets() {
  const seen: string[] = [];
  return {
    seen,
    env: { ASSETS: { fetch: async (input: Request | URL | string) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      seen.push(url.pathname);
      return new Response(url.pathname === '/' ? SHELL : 'asset', { status: 200, headers: { 'Content-Type': 'text/html' } });
    } } }
  };
}

describe('Node handler adapter', () => {
  it('passes method, path, lower-case headers and a parsed JSON body; the client IP comes only from Cloudflare', async () => {
    const req = await toNodeRequest(new Request('https://cxl.example/api/cxl/google?x=1', {
      method: 'POST', body: JSON.stringify({ action: 'a' }),
      headers: { 'Content-Type': 'application/json', 'X-CXL-CSRF': 't', 'X-Forwarded-For': '6.6.6.6', 'X-Real-IP': '6.6.6.6', 'CF-Connecting-IP': '1.2.3.4' }
    }));
    expect(req).toMatchObject({ method: 'POST', url: '/api/cxl/google?x=1', body: { action: 'a' }, socket: { remoteAddress: '1.2.3.4' } });
    expect(req.headers).toMatchObject({ 'x-cxl-csrf': 't', 'x-real-ip': '1.2.3.4', host: 'cxl.example', 'x-forwarded-proto': 'https' });
    expect(req.headers['x-forwarded-for']).toBeUndefined();
  });

  it('keeps a non-JSON body as text and leaves GET without a body', async () => {
    expect((await toNodeRequest(new Request('https://cxl.example/a', { method: 'POST', body: 'plain' }))).body).toBe('plain');
    expect((await toNodeRequest(new Request('https://cxl.example/a'))).body).toBeUndefined();
  });

  it('turns status, headers (repeated Set-Cookie included) and written chunks into a Response', async () => {
    const response = await runNodeHandler(async (_req, res) => {
      res.statusCode = 201;
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Set-Cookie', ['a=1; Path=/', 'b=2; Path=/']);
      res.setHeader('Content-Length', '999');
      res.write('hello ');
      res.end(new Uint8Array([119, 111, 114, 108, 100]));
    }, new Request('https://cxl.example/x'));
    expect(response.status).toBe(201);
    expect(response.headers.getSetCookie()).toEqual(['a=1; Path=/', 'b=2; Path=/']);
    expect(await response.text()).toBe('hello world');
  });

  it('sends no body for HEAD and redirects', async () => {
    const head = await runNodeHandler((_req, res) => res.end('x'), new Request('https://cxl.example/x', { method: 'HEAD' }));
    expect(await head.text()).toBe('');
    const redirect = await runNodeHandler((_req, res) => { res.statusCode = 302; res.setHeader('Location', '/'); res.end(); }, new Request('https://cxl.example/x'));
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get('location')).toBe('/');
  });

  it('answers 502 when a stream fails after it started, and 413 for oversized bodies', async () => {
    const broken = await runNodeHandler((_req, res) => { res.write('partial'); res.destroy(new Error('boom')); }, new Request('https://cxl.example/x'));
    expect(broken.status).toBe(502);
    const big = await runNodeHandler(() => undefined, new Request('https://cxl.example/x', { method: 'POST', body: new Uint8Array(MAX_BODY_BYTES + 1) }));
    expect(big.status).toBe(413);
  });
});

describe('Cloudflare Worker routing', () => {
  it('routes every API handler the Render server serves', () => {
    expect(Object.keys(API_ROUTES).sort()).toEqual(['/api/cxl/auth/callback', '/api/cxl/auth/login', '/api/cxl/auth/logout', '/api/cxl/auth/session',
      '/api/cxl/collab-progress', '/api/cxl/google', '/api/cxl/media', '/api/cxl/public-work', '/api/cxl/public-works', '/api/cxl/share']);
  });

  it('runs API handlers, with the security headers', async () => {
    const { env } = assets();
    const response = await worker.fetch(new Request('https://cxl.example/api/cxl/auth/session'), env);
    expect(response.status).toBe(404); // owner auth is not configured in tests
    expect(await response.json()).toMatchObject({ ok: false });
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(response.headers.get(name)).toBe(value);
  });

  it('answers unknown API paths with 404 instead of the app', async () => {
    const { env, seen } = assets();
    expect((await worker.fetch(new Request('https://cxl.example/api/nope'), env)).status).toBe(404);
    expect(seen).toEqual([]);
  });

  it('serves /work/:id through the share handler using the built shell from static assets', async () => {
    const { env } = assets();
    const response = await worker.fetch(new Request('https://cxl.example/work/asset_abc'), env);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('<meta property="og:url" content="https://cxl.example/work/asset_abc" />');
    expect(html).toContain('/assets/index-abc.js');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
  });

  it('hands other paths routed to the Worker (e.g. /work/:id/edit) to static assets', async () => {
    const { env, seen } = assets();
    const response = await worker.fetch(new Request('https://cxl.example/work/asset_abc/edit'), env);
    expect(await response.text()).toBe('asset');
    expect(seen).toEqual(['/work/asset_abc/edit']);
  });
});

describe('static asset headers', () => {
  it('public/_headers applies the same security headers to every static file', () => {
    const file = readFileSync('public/_headers', 'utf8');
    const all = file.split(/\n(?=\/)/).find(block => block.startsWith('/*\n'))!;
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(all).toContain(`  ${name}: ${value}\n`);
    expect(file).toMatch(/\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/);
  });

  it('wrangler.jsonc sends API and share routes to the Worker before static assets', () => {
    const config = readFileSync('wrangler.jsonc', 'utf8');
    expect(config).toContain('"run_worker_first": ["/api/*", "/work/*"]');
    expect(config).toContain('"nodejs_compat"');
  });
});
