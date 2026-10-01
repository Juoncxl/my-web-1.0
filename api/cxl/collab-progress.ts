import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { directDriveGet } from './googleDirect.js';
import { cookieValue, getOwnerAuthConfig, OWNER_SESSION_COOKIE, verifyCsrfRequest, verifyOwnerSessionToken } from '../../src/server/cxlOwnerAuth.js';
import { loadSealedOwnerDriveCredential, ownerDriveAccessToken } from '../../src/server/cxlOwnerDrive.js';

type Request = IncomingMessage & { body?: unknown };
type Response = ServerResponse;
type Progress = Record<string, string>;

/**
 * Owner-only Collab Schedule ticks ("this milestone is done"). Kept in one small
 * file next to the Owner's Drive credential so Works and the public projection
 * are never touched; visitors never see this data.
 */
export const PROGRESS_FILE = 'cxl-collab-progress.json';
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const KEY_RE = /^asset_[A-Za-z0-9_-]{1,96}\|\d{4}-\d{2}-\d{2}\|[^\n]{0,200}$/;
const MAX_ENTRIES = 2000;
const TIMEOUT_MS = 10_000;

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

async function findProgressFile(token: string, folderId: string): Promise<string | null> {
  const query = `'${folderId.replace(/['\\]/g, '\\$&')}' in parents and name = '${PROGRESS_FILE}' and trashed = false`;
  const listed = await fetch(`${DRIVE_FILES}?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!listed.ok) throw new Error(`Progress lookup failed (HTTP ${listed.status})`);
  return ((await listed.json()) as { files?: { id?: string }[] }).files?.[0]?.id || null;
}

async function readProgress(token: string, fileId: string | null): Promise<Progress> {
  if (!fileId) return {};
  const response = await fetch(`${DRIVE_FILES}/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`Progress read failed (HTTP ${response.status})`);
  return sanitizeProgress(await response.json().catch(() => ({})));
}

async function writeProgress(token: string, folderId: string, fileId: string | null, progress: Progress): Promise<void> {
  const boundary = `cxl-${randomBytes(12).toString('hex')}`;
  const metadata = fileId ? {} : { name: PROGRESS_FILE, parents: [folderId], mimeType: 'application/json' };
  const body = [
    `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', JSON.stringify(metadata),
    `--${boundary}`, 'Content-Type: application/json', '', JSON.stringify(progress), `--${boundary}--`, ''
  ].join('\r\n');
  const saved = await fetch(fileId
    ? `${DRIVE_UPLOAD}/${encodeURIComponent(fileId)}?uploadType=multipart&supportsAllDrives=true`
    : `${DRIVE_UPLOAD}?uploadType=multipart&supportsAllDrives=true`, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!saved.ok) throw new Error(`Progress save failed (HTTP ${saved.status})`);
}

function parseBody(req: Request): { key?: unknown; done?: unknown } | null {
  const raw = req.body;
  if (raw && typeof raw === 'object') return raw as { key?: unknown; done?: unknown };
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
    const fileId = await findProgressFile(owner.token, owner.folderId);
    let progress = await readProgress(owner.token, fileId);
    if (change) {
      progress = applyProgressChange(progress, change.key, change.done);
      await writeProgress(owner.token, owner.folderId, fileId, progress);
    }
    return send(res, 200, { ok: true, data: progress });
  } catch (error) {
    return send(res, 502, { ok: false, error: (error instanceof Error ? error.message : 'Progress request failed').slice(0, 200) });
  }
}
