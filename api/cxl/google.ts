import { createClient } from '@supabase/supabase-js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Asset } from '../../src/types';
import type { FetchAssetsOptions } from '../../src/lib/supabaseService';
import { filterGoogleWorks } from '../../src/data/googleWorksRead.js';

type Request = IncomingMessage & { body?: unknown };
type Response = ServerResponse & { json?: (body: unknown) => void };
const ALLOWED_OPTIONS = new Set(['userId','currentUserId','creatorSlug','assetId','category','folderId','search','includeDeleted','onlyDeleted','publicOnly','limit','detail']);
const PUBLIC_ACTIONS = new Set(['profiles.getCreator','profiles.getPublic','settings.readCreatorSpace']);
const GAS_TIMEOUT_MS = 30_000;

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
function publicGasUrl(action: string, params: Record<string, string>): URL | null {
  const endpoint = gasEndpoint(process.env.CXL_GAS_PUBLIC_URL);
  if (!endpoint) return null;
  const url = new URL(endpoint);
  url.searchParams.set('cxlApi', action);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}
async function publicGasData(url: URL): Promise<unknown> {
  const raw = await gasJson(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } });
  if (!record(raw) || raw.ok !== true) throw new Error(record(raw) && typeof raw.error === 'string' ? raw.error : 'Google public API response is malformed');
  return raw.data;
}
function validPublicActionArgs(action: string, args: unknown[]): boolean {
  if (action === 'profiles.getCreator') return args.length === 1 && typeof args[0] === 'string' && args[0].length <= 128;
  if (action === 'profiles.getPublic') return args.length === 1 && Array.isArray(args[0]) && args[0].length <= 100
    && args[0].every(id => typeof id === 'string' && /^cxlc_[a-f0-9]{32}$/i.test(id));
  if (action === 'settings.readCreatorSpace') return args.length === 1 && typeof args[0] === 'string'
    && /^cxlc_[a-f0-9]{32}$/i.test(args[0]);
  return false;
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
  if (!record(body) || typeof body.action !== 'string' || !Array.isArray(body.args))
    return send(res, 400, { ok: false, error: 'Invalid public read request' });
  const action = body.action;
  if (!PUBLIC_ACTIONS.has(action) && action !== 'works.fetch')
    return send(res, 400, { ok: false, error: 'Only supported public reads are available through this endpoint' });
  if (PUBLIC_ACTIONS.has(action)) {
    if (!validPublicActionArgs(action, body.args)) return send(res, 400, { ok: false, error: `Invalid ${action} request` });
    try {
      const params: Record<string, string> = {};
      if (action === 'profiles.getCreator') params.slug = String(body.args[0]).trim().replace(/^@+/, '').toLowerCase();
      if (action === 'profiles.getPublic') params.ids = JSON.stringify([...new Set(body.args[0] as string[])]);
      if (action === 'settings.readCreatorSpace') params.publicCreatorId = String(body.args[0]);
      const url = publicGasUrl(action, params);
      if (!url) return send(res, 503, { ok: false, error: 'Google public API is not configured on the server' });
      return send(res, 200, { ok: true, data: await publicGasData(url) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google public read failed';
      const status = (error instanceof Error && error.name === 'TimeoutError') || /time.?out/i.test(message) ? 504 : 502;
      return send(res, status, { ok: false, error: message.slice(0, 300) });
    }
  }
  if (body.args.length > 1) return send(res, 400, { ok: false, error: 'Invalid works.fetch request' });
  const optionsValue = body.args[0] === undefined ? {} : body.args[0];
  if (!validOptions(optionsValue)) return send(res, 400, { ok: false, error: 'Invalid works.fetch options' });
  const options = optionsValue as FetchAssetsOptions;
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const ownerUserId = process.env.CXL_OWNER_USER_ID?.trim() || '';
  const hasOwnerAuthConfig = Boolean(ownerUserId && process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_ANON_KEY?.trim());
  if (bearer && !hasOwnerAuthConfig) {
    return send(res, 503, { ok: false, error: 'Owner authentication is not configured on the server' });
  }
  const ownerId = bearer ? await verifyOwner(bearer) : null;
  if (bearer && !ownerId) return send(res, 401, { ok: false, error: 'Valid owner authentication required' });
  const requestsOwnerScope = Boolean(options.onlyDeleted || options.includeDeleted
    || options.currentUserId?.trim()
    || (options.userId?.trim() && (!ownerUserId || options.userId === ownerUserId)));
  if (requestsOwnerScope && !ownerId) {
    return send(res, 401, { ok: false, error: options.onlyDeleted || options.includeDeleted
      ? 'Owner authentication required for private/trash reads'
      : 'Owner authentication required for private Works' });
  }
  if (ownerId && options.currentUserId && options.currentUserId !== ownerId) return send(res, 403, { ok: false, error: 'Current user does not match the authenticated owner' });
  let publicCreatorSlug: string | null = null;
  if (options.creatorSlug) {
    let decoded = '';
    try { decoded = decodeURIComponent(options.creatorSlug).trim(); } catch { return send(res, 400, { ok: false, error: 'Invalid creator slug' }); }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decoded)) {
      const slug = decoded.replace(/^@+/, '').toLowerCase();
      if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(slug) || options.userId || options.currentUserId
        || options.includeDeleted || options.onlyDeleted || options.folderId !== undefined) {
        return send(res, 400, { ok: false, error: 'Invalid public creator Works request' });
      }
      publicCreatorSlug = slug;
    } else {
      if (decoded !== ownerUserId) return send(res, 501, { ok: false, error: 'Public creator lookup requires the Profiles read capability' });
      if (!ownerId) return send(res, 401, { ok: false, error: 'Owner authentication required for owner profile Works' });
    }
  }
  if (options.userId && options.userId !== ownerUserId) {
    return send(res, 501, { ok: false, error: 'Public creator filtering requires the Profiles read capability' });
  }
  const ownerScope = Boolean(!publicCreatorSlug && ownerId && (!options.userId || options.userId === ownerId) && !options.publicOnly);

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
      if (publicCreatorSlug) {
        const url = publicGasUrl('works.creator', { slug: publicCreatorSlug });
        if (!url) return send(res, 503, { ok: false, error: 'Google public API is not configured on the server' });
        raw = await publicGasData(url);
      } else {
        const url = publicGasUrl(options.assetId ? 'works.detail' : 'works.list', options.assetId ? { id: options.assetId } : {});
        if (!url) return send(res, 503, { ok: false, error: 'Google public API is not configured on the server' });
        raw = await publicGasData(url);
        raw = options.assetId ? [raw] : raw;
      }
    }
    const works = validateAssetList(raw);
    const scopedOptions = { ...options, publicOnly: publicCreatorSlug ? true : options.publicOnly,
      currentUserId: ownerScope ? ownerId || undefined : undefined };
    const filtered = filterGoogleWorks(works, scopedOptions, { currentUserId: ownerScope ? ownerId || undefined : undefined });
    return send(res, 200, { ok: true, data: { data: filtered, error: null } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google Works read failed';
    const status = (error instanceof Error && error.name === 'TimeoutError') || /time.?out/i.test(message) ? 504 : 502;
    return send(res, status, { ok: false, error: message.slice(0, 300) });
  }
}
