import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../../api/cxl/collab-progress';
import { createOwnerSessionToken } from '../../../src/server/cxlOwnerAuth';
import * as ownerDrive from '../../../src/server/cxlOwnerDrive';

const secret = 'session-secret-that-is-at-least-32-characters-long';
const sub = 'google-owner-subject-123456789';
const origin = 'https://cxl.example';

function response() {
  return { statusCode: 200, body: '', headers: {} as Record<string, unknown>,
    setHeader(name: string, value: unknown) { this.headers[name] = value; }, end(value = '') { this.body = value; } };
}

/** In-memory Drive: files by name in one folder. */
function fakeDrive(initial: Record<string, unknown> = {}) {
  const files: Record<string, { id: string; content: unknown }> = {};
  let next = 1;
  Object.entries(initial).forEach(([name, content]) => { files[name] = { id: `f${next++}`, content }; });
  const queried: string[] = [];
  const fetchMock = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (url.pathname === '/drive/v3/files') {
      const name = url.searchParams.get('q')!.match(/name = '([^']+)'/)![1];
      queried.push(name);
      return ok({ files: files[name] ? [{ id: files[name].id }] : [] });
    }
    const byId = (id: string) => Object.entries(files).find(([, file]) => file.id === id);
    if (url.pathname.startsWith('/drive/v3/files/')) {
      const found = byId(decodeURIComponent(url.pathname.split('/').pop()!));
      return ok(found ? found[1].content : {});
    }
    if (url.pathname.startsWith('/upload/drive/v3/files')) {
      const parts = String(init.body).split(/--cxl-[^\r\n]+/).map(part => part.split('\r\n\r\n')[1]?.trim()).filter(Boolean);
      const meta = JSON.parse(parts[0]); const content = JSON.parse(parts[1]);
      const existing = url.pathname.split('/').pop()!;
      const found = byId(existing);
      if (found) found[1].content = content; else files[meta.name] = { id: `f${next++}`, content };
      return ok({});
    }
    throw new Error(`unexpected ${input}`);
  });
  return { files, queried, fetchMock };
}

const session = () => `__Host-cxl_owner=${createOwnerSessionToken(sub, undefined, secret).token}; __Host-cxl_csrf=csrf`;
const get = (url: string) => ({ method: 'GET', url, headers: { cookie: session() } });
const post = (url: string, body: unknown, csrf = true) => ({ method: 'POST', url, body,
  headers: { cookie: session(), origin, ...(csrf ? { 'x-cxl-csrf': 'csrf' } : {}) } });

describe('owner files on the collab-progress function', () => {
  beforeEach(() => {
    vi.stubEnv('CXL_OWNER_SESSION_SECRET', secret);
    vi.stubEnv('CXL_OWNER_GOOGLE_SUB', sub);
    vi.stubEnv('CXL_OWNER_APP_ORIGIN', origin);
    vi.stubEnv('CXL_INCOMING_FOLDER_ID', 'folder');
    vi.stubEnv('GOOGLE_OIDC_CLIENT_ID', 'google-client-id');
    vi.stubEnv('GOOGLE_OIDC_CLIENT_SECRET', 'server-only-google-client-secret');
    vi.stubEnv('CXL_OWNER_OIDC_REDIRECT_URI', `${origin}/api/cxl/auth/callback`);
    vi.stubEnv('CXL_OWNER_USER_ID', 'legacy-owner');
    vi.stubEnv('CXL_OWNER_PUBLIC_CREATOR_ID', 'cxlc_0123456789abcdef0123456789abcdef');
    vi.spyOn(ownerDrive, 'loadSealedOwnerDriveCredential').mockResolvedValue({} as never);
    vi.spyOn(ownerDrive, 'ownerDriveAccessToken').mockResolvedValue('token');
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('reads ideas from their own file, never the progress file', async () => {
    const drive = fakeDrive({ 'cxl-collab-progress.json': { 'asset_a|2026-10-01|x': '2026-10-01T00:00:00.000Z' } });
    vi.stubGlobal('fetch', drive.fetchMock);
    const res = response();
    await handler(get('/api/cxl/collab-progress?store=ideas') as never, res as never);
    expect(JSON.parse(res.body)).toEqual({ ok: true, data: { version: 1, ideas: [] } });
    expect(drive.queried).toEqual(['cxl-owner-ideas.json']);
  });

  it('adds an idea with CSRF and refuses without it', async () => {
    const drive = fakeDrive();
    vi.stubGlobal('fetch', drive.fetchMock);
    const denied = response();
    await handler(post('/api/cxl/collab-progress?store=ideas', { op: 'add', text: 'ทหารเรือ' }, false) as never, denied as never);
    expect(denied.statusCode).toBe(403);
    const res = response();
    await handler(post('/api/cxl/collab-progress?store=ideas', { op: 'add', text: 'ทหารเรือ', createdAt: '2000-01-01T00:00:00.000Z' }) as never, res as never);
    const saved = JSON.parse(res.body).data.ideas[0];
    expect(saved.text).toBe('ทหารเรือ');
    expect(Date.parse(saved.createdAt)).toBeGreaterThan(Date.parse('2026-01-01'));
    expect((drive.files['cxl-owner-ideas.json'].content as { ideas: unknown[] }).ideas).toHaveLength(1);
  });

  it('answers 404 for an unknown idea and 400 for a malformed one', async () => {
    vi.stubGlobal('fetch', fakeDrive().fetchMock);
    const missing = response();
    await handler(post('/api/cxl/collab-progress?store=ideas', { op: 'edit', id: 'nope', text: 'x' }) as never, missing as never);
    expect(missing.statusCode).toBe(404);
    const bad = response();
    await handler(post('/api/cxl/collab-progress?store=ideas', { op: 'add', text: '   ' }) as never, bad as never);
    expect(bad.statusCode).toBe(400);
  });

  it('retries when another tab overwrote the file right after our write, so both ideas survive', async () => {
    const drive = fakeDrive({ 'cxl-owner-ideas.json': { version: 1, ideas: [] } });
    let raced = false;
    const racing = vi.fn(async (input: string, init: RequestInit = {}) => {
      const result = await drive.fetchMock(input, init);
      if (!raced && String(input).includes('/upload/drive/v3/files')) {
        raced = true; // another instance writes its own idea over ours
        drive.files['cxl-owner-ideas.json'].content = { version: 1, ideas: [{ id: 'other-tab', text: 'จากอีกแท็บ', status: 'waiting', workId: null, createdAt: '2026-10-02T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z', history: [] }] };
      }
      return result;
    });
    vi.stubGlobal('fetch', racing);
    const res = response();
    await handler(post('/api/cxl/collab-progress?store=ideas', { op: 'add', text: 'ของแท็บนี้' }) as never, res as never);
    const stored = (drive.files['cxl-owner-ideas.json'].content as { ideas: Array<{ text: string }> }).ideas.map(idea => idea.text);
    expect(stored).toEqual(expect.arrayContaining(['ของแท็บนี้', 'จากอีกแท็บ']));
  });

  it('refuses to write when the stored file cannot be read, instead of treating it as empty', async () => {
    const drive = fakeDrive({ 'cxl-owner-ideas.json': { version: 1, ideas: [] } });
    const broken = vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = new URL(input);
      if (url.pathname.startsWith('/drive/v3/files/') && url.searchParams.get('alt') === 'media') return new Response('{"version":1,"ideas":[{"id"', { status: 200 });
      return drive.fetchMock(input, init);
    });
    vi.stubGlobal('fetch', broken);
    const res = response();
    await handler(post('/api/cxl/collab-progress?store=ideas', { op: 'add', text: 'x' }) as never, res as never);
    expect(res.statusCode).toBe(502);
    expect(broken.mock.calls.some(call => String(call[0]).includes('/upload/drive/v3/files'))).toBe(false);
  });

  it('keeps Collab progress behaviour unchanged without a store', async () => {
    const drive = fakeDrive({ 'cxl-collab-progress.json': { 'asset_a|2026-10-01|x': '2026-10-01T00:00:00.000Z' } });
    vi.stubGlobal('fetch', drive.fetchMock);
    const res = response();
    await handler(get('/api/cxl/collab-progress') as never, res as never);
    expect(JSON.parse(res.body)).toEqual({ ok: true, data: { 'asset_a|2026-10-01|x': '2026-10-01T00:00:00.000Z' } });
    expect(drive.queried).toEqual(['cxl-collab-progress.json']);
  });
});
