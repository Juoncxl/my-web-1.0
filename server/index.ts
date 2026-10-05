/**
 * Standalone Node server for hosts other than Vercel (e.g. Render).
 *
 * Serves the built SPA from dist/ and runs the same /api/cxl/* handlers Vercel
 * runs as functions, with the headers and rewrites from vercel.json. The
 * handlers are unchanged; this file only adapts routing, body parsing and
 * static delivery.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import google from '../api/cxl/google';
import media from '../api/cxl/media';
import publicWork from '../api/cxl/public-work';
import publicWorks from '../api/cxl/public-works';
import share from '../api/cxl/share';
import collabProgress from '../api/cxl/collab-progress';
import authCallback from '../api/cxl/auth/callback';
import authLogin from '../api/cxl/auth/login';
import authLogout from '../api/cxl/auth/logout';
import authSession from '../api/cxl/auth/session';

type Handler = (req: any, res: any) => unknown;

const API_ROUTES: Record<string, Handler> = {
  '/api/cxl/google': google,
  '/api/cxl/media': media,
  '/api/cxl/public-work': publicWork,
  '/api/cxl/public-works': publicWorks,
  '/api/cxl/share': share,
  '/api/cxl/collab-progress': collabProgress,
  '/api/cxl/auth/callback': authCallback,
  '/api/cxl/auth/login': authLogin,
  '/api/cxl/auth/logout': authLogout,
  '/api/cxl/auth/session': authSession
};

const DIST = path.resolve(process.cwd(), 'dist');
// Media upload chunks are ~2 MiB of base64 inside JSON.
const MAX_BODY_BYTES = 8 * 1024 * 1024;

export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https:; font-src 'self' https: data:; img-src 'self' https: data: blob:; media-src 'self' https: blob:; connect-src 'self' https: wss: blob: data:; worker-src 'self' blob:; manifest-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains'
};

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2'
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.txt']);

const fileCache = new Map<string, { body: Buffer; gzip?: Buffer }>();

async function loadStatic(relativePath: string): Promise<{ body: Buffer; gzip?: Buffer } | null> {
  const filePath = path.resolve(DIST, '.' + relativePath);
  if (!filePath.startsWith(DIST + path.sep)) return null;
  const cached = fileCache.get(filePath);
  if (cached) return cached;
  try {
    if (!(await stat(filePath)).isFile()) return null;
    const body = await readFile(filePath);
    const entry = { body, gzip: COMPRESSIBLE.has(path.extname(filePath)) && body.length > 1024 ? gzipSync(body) : undefined };
    fileCache.set(filePath, entry);
    return entry;
  } catch {
    return null;
  }
}

async function sendStatic(req: IncomingMessage, res: ServerResponse, relativePath: string, status = 200): Promise<boolean> {
  const file = await loadStatic(relativePath);
  if (!file) return false;
  const ext = path.extname(relativePath);
  res.statusCode = status;
  res.setHeader('Content-Type', CONTENT_TYPES[ext] || 'application/octet-stream');
  // Built assets carry a content hash in their name, so they never change.
  res.setHeader('Cache-Control', relativePath.startsWith('/assets/')
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=0, must-revalidate');
  const acceptsGzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
  const body = file.gzip && acceptsGzip ? file.gzip : file.body;
  if (body === file.gzip) res.setHeader('Content-Encoding', 'gzip');
  res.setHeader('Vary', 'Accept-Encoding');
  res.setHeader('Content-Length', String(body.length));
  res.end(req.method === 'HEAD' ? undefined : body);
  return true;
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { reject(Object.assign(new Error('Body too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Mirrors Vercel's body helper: JSON becomes an object, anything else a string. */
async function attachBody(req: IncomingMessage & { body?: unknown }): Promise<void> {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const raw = await readBody(req);
  if (!raw.length) return;
  const text = raw.toString('utf8');
  if (/application\/json/i.test(String(req.headers['content-type'] || ''))) {
    try { req.body = JSON.parse(text); return; } catch { /* handlers report malformed JSON themselves */ }
  }
  req.body = text;
}

function sendText(res: ServerResponse, status: number, text: string) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(text);
}

async function route(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname;

  const handler = API_ROUTES[pathname.replace(/\/$/, '')];
  if (handler) {
    await attachBody(req);
    await handler(req, res);
    return;
  }
  if (pathname.startsWith('/api/')) return sendText(res, 404, 'Not found');

  // vercel.json rewrites
  const work = pathname.match(/^\/work\/([^/]+)\/?$/);
  if (work) {
    req.url = `/api/cxl/share?id=${work[1]}`;
    await share(req, res);
    return;
  }
  if (pathname === '/privacy') return void await sendStatic(req, res, '/privacy.html');

  if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'Method not allowed');
  let staticPath = pathname;
  try { staticPath = decodeURIComponent(pathname); } catch { /* fall through to the app shell */ }
  if (pathname !== '/' && await sendStatic(req, res, staticPath)) return;
  if (pathname.startsWith('/assets/')) return sendText(res, 404, 'Not found');
  // SPA fallback: the app shows its own 404 page for unknown paths.
  if (!await sendStatic(req, res, '/index.html')) sendText(res, 503, 'App is not built');
}

const port = Number(process.env.PORT) || 3000;
createServer((req, res) => {
  route(req, res).catch(error => {
    console.error(JSON.stringify({ event: 'cxl_server_error', reason: error instanceof Error ? error.message.slice(0, 200) : 'unknown' }));
    if (res.headersSent) { res.destroy(); return; }
    sendText(res, error && typeof error.status === 'number' ? error.status : 500, 'Server error');
  });
}).listen(port, () => console.info(JSON.stringify({ event: 'cxl_server_listening', port })));
