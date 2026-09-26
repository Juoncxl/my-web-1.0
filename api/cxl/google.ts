import { createClient } from '@supabase/supabase-js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Asset } from '../../src/types';
import type { FetchAssetsOptions } from '../../src/lib/supabaseService';
import { filterGoogleWorks } from '../../src/data/googleWorksRead.js';

type Request = IncomingMessage & { body?: unknown };
type Response = ServerResponse & { json?: (body: unknown) => void };
const ALLOWED_OPTIONS = new Set(['userId','currentUserId','creatorSlug','assetId','category','folderId','search','includeDeleted','onlyDeleted','publicOnly','limit','detail']);
const GAS_TIMEOUT_MS = 12_000;

function send(res: Response, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
function record(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function validOptions(value: unknown): value is FetchAssetsOptions {
  return record(value) && Object.keys(value).every(key => ALLOWED_OPTIONS.has(key))
    && ['userId','currentUserId','creatorSlug','assetId','category','search'].every(key => value[key] === undefined || (typeof value[key] === 'string' && value[key].length <= 256))
    && (value.detail === undefined || value.detail === 'summary' || value.detail === 'full')
    && (value.folderId === undefined || value.folderId === null || typeof value.folderId === 'string')
    && (value.limit === undefined || (typeof value.limit === 'number' && Number.isFinite(value.limit)))
    && ['includeDeleted','onlyDeleted','publicOnly'].every(key => value[key] === undefined || typeof value[key] === 'boolean');
}
function gasEndpoint(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname === 'script.google.com' && /^\/macros\/s\/[^/]+\/exec\/?$/.test(url.pathname) ? url : null;
  } catch { return null; }
}
function parseBody(req: Request): unknown {
  if (record(req.body)) return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return null;
}
async function verifyOwner(accessToken: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const ownerId = process.env.CXL_OWNER_USER_ID;
  if (!url || !anonKey || !ownerId || !accessToken) return null;
  try {
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await client.auth.getUser(accessToken);
    return !error && data.user?.id === ownerId ? data.user.id : null;
  } catch { return null; }
}
async function gasJson(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, redirect: 'follow', signal: AbortSignal.timeout(GAS_TIMEOUT_MS) });
  const text = await response.text();
  if (!response.ok) throw new Error(`Google Apps Script responded with HTTP ${response.status}`);
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('Google Apps Script returned malformed JSON'); }
  return parsed;
}
function validateAssetList(value: unknown): Asset[] {
  if (!Array.isArray(value) || value.some(item => !record(item)
    || typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.category !== 'string'
    || typeof item.status !== 'string' || typeof item.visibility !== 'string' || typeof item.isPublic !== 'boolean'
    || !Array.isArray(item.tags) || item.tags.some(tag => typeof tag !== 'string') || typeof item.content !== 'string' || !Array.isArray(item.previewImages)
    || !Array.isArray(item.contentBlocks) || !Array.isArray(item.media))) {
    throw new Error('Google Works response does not match the CXL Asset list shape');
  }
  return value as Asset[];
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });
  let body: unknown;
  try { body = parseBody(req); } catch { return send(res, 400, { ok: false, error: 'Malformed JSON request' }); }
  if (!record(body) || body.action !== 'works.fetch' || !Array.isArray(body.args) || body.args.length > 1) {
    return send(res, 400, { ok: false, error: 'Only works.fetch is available through this endpoint' });
  }
  const optionsValue = body.args[0] === undefined ? {} : body.args[0];
  if (!validOptions(optionsValue)) return send(res, 400, { ok: false, error: 'Invalid works.fetch options' });
  const options = optionsValue as FetchAssetsOptions;
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const ownerId = bearer ? await verifyOwner(bearer) : null;
  if ((options.onlyDeleted || (options.includeDeleted && options.userId === process.env.CXL_OWNER_USER_ID)) && !ownerId) {
    return send(res, 401, { ok: false, error: 'Owner authentication required for private/trash reads' });
  }
  if (options.userId && options.userId === process.env.CXL_OWNER_USER_ID && !ownerId) {
    return send(res, 401, { ok: false, error: 'Owner authentication required for private Works' });
  }
  if (options.currentUserId === process.env.CXL_OWNER_USER_ID && !ownerId) return send(res, 401, { ok: false, error: 'Owner authentication required for private Works' });
  if (ownerId && options.currentUserId && options.currentUserId !== ownerId) return send(res, 403, { ok: false, error: 'Current user does not match the authenticated owner' });
  if (options.onlyDeleted && !ownerId) return send(res, 401, { ok: false, error: 'Owner authentication required for trash reads' });
  if (options.creatorSlug) {
    let decoded = '';
    try { decoded = decodeURIComponent(options.creatorSlug).trim(); } catch { return send(res, 400, { ok: false, error: 'Invalid creator slug' }); }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decoded)) {
      return send(res, 501, { ok: false, error: 'Creator slug lookup requires the Profiles read capability' });
    }
    if (decoded !== process.env.CXL_OWNER_USER_ID) return send(res, 501, { ok: false, error: 'Public creator lookup requires the Profiles read capability' });
    if (!ownerId) return send(res, 401, { ok: false, error: 'Owner authentication required for owner profile Works' });
  }
  if (options.userId && options.userId !== process.env.CXL_OWNER_USER_ID) {
    return send(res, 501, { ok: false, error: 'Public creator filtering requires the Profiles read capability' });
  }
  const ownerScope = Boolean(ownerId && (!options.userId || options.userId === ownerId) && !options.publicOnly);

  try {
    let raw: unknown;
    if (ownerScope) {
      const endpoint = gasEndpoint(process.env.CXL_GAS_OWNER_URL);
      const secret = process.env.CXL_API_SHARED_SECRET;
      if (!endpoint || !secret) return send(res, 503, { ok: false, error: 'Google owner API is not configured on the server' });
      raw = await gasJson(endpoint.toString(), { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorization: secret, action: 'works.fetch', args: [{ ...options, currentUserId: ownerId }] }) });
      if (!record(raw) || raw.ok !== true || !record(raw.data) || !Array.isArray(raw.data.data)) {
        throw new Error(record(raw) && typeof raw.error === 'string' ? raw.error : 'Google owner API response is malformed');
      }
      raw = raw.data.data;
    } else {
      const endpoint = gasEndpoint(process.env.CXL_GAS_PUBLIC_URL);
      if (!endpoint) return send(res, 503, { ok: false, error: 'Google public API is not configured on the server' });
      const url = new URL(endpoint);
      url.searchParams.set('cxlApi', options.assetId ? 'works.detail' : 'works.list');
      if (options.assetId) url.searchParams.set('id', options.assetId);
      raw = await gasJson(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } });
      if (!record(raw) || raw.ok !== true) throw new Error(record(raw) && typeof raw.error === 'string' ? raw.error : 'Google public API response is malformed');
      raw = options.assetId ? [raw.data] : raw.data;
    }
    const works = validateAssetList(raw);
    const scopedOptions = { ...options, currentUserId: ownerScope ? ownerId || undefined : undefined };
    const filtered = filterGoogleWorks(works, scopedOptions, { currentUserId: ownerScope ? ownerId || undefined : undefined });
    return send(res, 200, { ok: true, data: { data: filtered, error: null } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google Works read failed';
    const status = (error instanceof Error && error.name === 'TimeoutError') || /time.?out/i.test(message) ? 504 : 502;
    return send(res, status, { ok: false, error: message.slice(0, 300) });
  }
}
