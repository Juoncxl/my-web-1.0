import type { NodeHandler } from '../server/apiRoutes';

/**
 * Runs a Vercel-style Node handler (IncomingMessage/ServerResponse) inside a Worker.
 *
 * The /api/cxl/* handlers only use a small part of those objects: method, url, headers
 * and the parsed body on the request; statusCode, setHeader, write, end and destroy on
 * the response. This provides exactly that, buffering the body into one Response.
 */

// Media upload chunks are ~2 MiB of base64 inside JSON (same limit as server/index.ts).
export const MAX_BODY_BYTES = 8 * 1024 * 1024;

export interface NodeLikeRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  socket: { remoteAddress?: string };
}

class BodyTooLargeError extends Error {}

/** Mirrors Vercel's body helper: JSON becomes an object, anything else a string. */
async function readBody(request: Request): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'HEAD' || !request.body) return undefined;
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) throw new BodyTooLargeError();
  const raw = new Uint8Array(await request.arrayBuffer());
  if (raw.byteLength > MAX_BODY_BYTES) throw new BodyTooLargeError();
  if (!raw.byteLength) return undefined;
  const text = new TextDecoder().decode(raw);
  if (/application\/json/i.test(request.headers.get('content-type') || '')) {
    try { return JSON.parse(text); } catch { /* handlers report malformed JSON themselves */ }
  }
  return text;
}

export async function toNodeRequest(request: Request, url: URL = new URL(request.url)): Promise<NodeLikeRequest> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, name) => { headers[name.toLowerCase()] = value; });
  headers.host = url.host;
  // Cloudflare sets cf-connecting-ip itself; never trust a client-sent x-real-ip / x-forwarded-for.
  const ip = request.headers.get('cf-connecting-ip') || '';
  delete headers['x-forwarded-for'];
  if (ip) headers['x-real-ip'] = ip; else delete headers['x-real-ip'];
  headers['x-forwarded-proto'] = url.protocol.replace(':', '');
  delete headers['x-forwarded-host'];
  return { method: request.method, url: url.pathname + url.search, headers, body: await readBody(request), socket: { remoteAddress: ip || undefined } };
}

type HeaderValue = string | number | string[];

export class NodeLikeResponse {
  statusCode = 200;
  headersSent = false;
  writableEnded = false;
  private readonly headers = new Map<string, { name: string; value: HeaderValue }>();
  private readonly chunks: Uint8Array[] = [];
  private settle!: { resolve: () => void; reject: (error: unknown) => void };
  readonly finished = new Promise<void>((resolve, reject) => { this.settle = { resolve, reject }; });

  setHeader(name: string, value: HeaderValue): this { this.headers.set(name.toLowerCase(), { name, value }); return this; }
  getHeader(name: string): HeaderValue | undefined { return this.headers.get(name.toLowerCase())?.value; }
  removeHeader(name: string): void { this.headers.delete(name.toLowerCase()); }
  hasHeader(name: string): boolean { return this.headers.has(name.toLowerCase()); }

  write(chunk: unknown): boolean {
    if (this.writableEnded) throw new Error('write after end');
    this.headersSent = true;
    this.chunks.push(toBytes(chunk));
    // Everything is buffered, so there is never back-pressure to wait for.
    return true;
  }

  end(chunk?: unknown): this {
    if (this.writableEnded) return this;
    if (chunk !== undefined && chunk !== null && typeof chunk !== 'function') this.chunks.push(toBytes(chunk));
    this.headersSent = true;
    this.writableEnded = true;
    this.settle.resolve();
    return this;
  }

  destroy(error?: unknown): this {
    if (!this.writableEnded) { this.writableEnded = true; this.settle.reject(error || new Error('Response destroyed')); }
    return this;
  }

  // Handlers wait for 'drain' only when write() returns false, which never happens here.
  once(): this { return this; }
  on(): this { return this; }
  off(): this { return this; }

  toResponse(method: string): Response {
    const headers = new Headers();
    for (const { name, value } of this.headers.values()) {
      if (name.toLowerCase() === 'content-length') continue; // the runtime sets it from the body
      if (Array.isArray(value)) value.forEach(item => headers.append(name, item));
      else headers.set(name, String(value));
    }
    const noBody = method === 'HEAD' || this.statusCode === 204 || this.statusCode === 304 || (this.statusCode >= 300 && this.statusCode < 400 && !this.chunks.length);
    return new Response(noBody ? null : concat(this.chunks), { status: this.statusCode, headers });
  }
}

function toBytes(chunk: unknown): Uint8Array {
  if (chunk instanceof Uint8Array) return chunk;
  if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk);
  return new TextEncoder().encode(String(chunk));
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength; }
  return out;
}

export async function runNodeHandler(handler: NodeHandler, request: Request, url?: URL): Promise<Response> {
  let req: NodeLikeRequest;
  try {
    req = await toNodeRequest(request, url);
  } catch (error) {
    if (error instanceof BodyTooLargeError) return new Response('Request body too large', { status: 413, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    throw error;
  }
  const res = new NodeLikeResponse();
  await handler(req, res);
  if (!res.writableEnded) throw new Error('Handler returned without finishing the response');
  try {
    await res.finished;
  } catch {
    // A stream that failed after it started (res.destroy) has no valid body to send.
    return new Response('Server error', { status: 502, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  return res.toResponse(req.method);
}
