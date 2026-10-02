import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { directDriveGet } from './googleDirect.js';
import { cookieValue, getOwnerAuthConfig, OWNER_SESSION_COOKIE, verifyCsrfRequest, verifyOwnerSessionToken } from '../../src/server/cxlOwnerAuth.js';
import { loadSealedOwnerDriveCredential, ownerDriveAccessToken } from '../../src/server/cxlOwnerDrive.js';
import { findOwnerFile, readOwnerJson, writeOwnerJson } from '../../src/server/cxlOwnerFiles.js';
import { applyIdeaOp, IdeaError, parseIdeaOp, sanitizeIdeaFile } from '../../src/server/cxlIdeas.js';

type Request = IncomingMessage & { body?: unknown };
type Response = ServerResponse;
type Progress = Record<string, string>;

/**
 * Owner-only Collab Schedule ticks ("this milestone is done") and, with ?store=ideas, the idea inbox.
 * Each is one small file next to the Owner's Drive credential so Works and the public projection
 * are never touched; visitors never see this data. (One function for both: Vercel Hobby allows 12.)
 */
export const PROGRESS_FILE = 'cxl-collab-progress.json';
export const IDEAS_FILE = 'cxl-owner-ideas.json';
const KEY_RE = /^asset_[A-Za-z0-9_-]{1,96}\|\d{4}-\d{2}-\d{2}\|[^\n]{0,200}$/;
const MAX_ENTRIES = 2000;

function send(res: Response, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

export function sanitizeProgress(value: unknown): Progress {
  const out: Progress = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [key, doneAt] of Object.entries(value as Record<string, unknown>).slice(0, MAX_ENTRIES)) {
    if (KEY_RE.test(key) && typeof doneAt === 'string' && !Number.isNaN(Date.parse(doneAt))) out[key] = doneAt;
  }
  return out;
}

export function applyProgressChange(progress: Progress, key: string, done: boolean, now = new Date()): Progress {
  const next = { ...progress };
  if (done) next[key] = next[key] || now.toISOString();
  else delete next[key];
  return next;
}

async function ownerToken(): Promise<{ token: string; folderId: string } | null> {
  const config = getOwnerAuthConfig();
  const folderId = process.env.CXL_INCOMING_FOLDER_ID?.trim();
  if (!config || !folderId) return null;
  const sealed = await loadSealedOwnerDriveCredential(folderId, directDriveGet);
  return sealed ? { token: await ownerDriveAccessToken(sealed, config), folderId } : null;
}

function parseBody(req: Request): Record<string, unknown> | null {
  const raw = req.body;
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
  return null;
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET' && req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });
  if (!verifyOwnerSessionToken(cookieValue(req.headers.cookie, OWNER_SESSION_COOKIE))) {
    return send(res, 401, { ok: false, error: 'Owner authentication required' });
  }
  if (req.method === 'POST' && !verifyCsrfRequest(req.headers.origin, process.env.CXL_OWNER_APP_ORIGIN?.trim() || '', req.headers.cookie, req.headers['x-cxl-csrf'] as string | undefined)) {
    return send(res, 403, { ok: false, error: 'Request origin could not be verified' });
  }
  if (new URL(req.url || '/', 'https://cxl.invalid').searchParams.get('store') === 'ideas') return handleIdeas(req, res);
  let change: { key: string; done: boolean } | null = null;
  if (req.method === 'POST') {
    const body = parseBody(req);
    if (!body || typeof body.key !== 'string' || !KEY_RE.test(body.key) || typeof body.done !== 'boolean') {
      return send(res, 400, { ok: false, error: 'Invalid progress change' });
    }
    change = { key: body.key, done: body.done };
  }
  try {
    const owner = await ownerToken();
    if (!owner) return send(res, 503, { ok: false, error: 'Connect Google Drive first' });
    const fileId = await findOwnerFile(owner.token, owner.folderId, PROGRESS_FILE);
    let progress = sanitizeProgress(await readOwnerJson(owner.token, fileId));
    if (change) {
      progress = applyProgressChange(progress, change.key, change.done);
      await writeOwnerJson(owner.token, owner.folderId, fileId, PROGRESS_FILE, progress);
    }
    return send(res, 200, { ok: true, data: progress });
  } catch (error) {
    return send(res, 502, { ok: false, error: (error instanceof Error ? error.message : 'Progress request failed').slice(0, 200) });
  }
}

/** Idea inbox: every write re-reads the file first, so ideas jotted from two tabs both survive. */
async function handleIdeas(req: Request, res: Response) {
  const op = req.method === 'POST' ? parseIdeaOp(parseBody(req)) : null;
  if (req.method === 'POST' && !op) return send(res, 400, { ok: false, error: 'Invalid idea change' });
  try {
    const owner = await ownerToken();
    if (!owner) return send(res, 503, { ok: false, error: 'Connect Google Drive first' });
    const fileId = await findOwnerFile(owner.token, owner.folderId, IDEAS_FILE);
    let ideas = sanitizeIdeaFile(await readOwnerJson(owner.token, fileId));
    if (op) {
      ideas = applyIdeaOp(ideas, op, new Date(), randomUUID);
      await writeOwnerJson(owner.token, owner.folderId, fileId, IDEAS_FILE, ideas);
    }
    return send(res, 200, { ok: true, data: ideas });
  } catch (error) {
    if (error instanceof IdeaError) return send(res, error.status, { ok: false, error: error.message });
    return send(res, 502, { ok: false, error: (error instanceof Error ? error.message : 'Idea request failed').slice(0, 200) });
  }
}
