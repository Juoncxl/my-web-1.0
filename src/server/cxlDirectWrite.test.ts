import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { cxlAssetFromRecord, DirectWriteError, directCreateWork, directSetTrash, directUpdateWork, writeFingerprint, type DirectWriteEnv } from './cxlDirectWrite';

const PRIVATE_HEADERS = ['id','title','category','status','visibility','is_public','deleted_at','folder_id','tags','updated_at','revision','file_id','has_collab_draft','media_count','cover_ref','create_request_id','user_id','created_at','summary_json','summary_version','search_version','search_chunk_count','search_index_token'];
const PUBLIC_HEADERS = ['id','title','category','status','updated_at','tags','short_description','file_id','active','cover_ref','summary_json'];
const OWNER = 'owner-1';
const WORK = 'asset_abc123';
const REQUEST = '11111111-2222-4333-8444-555555555555';

type Grid = unknown[][];

/** In-memory Google Sheets + Drive, routed by URL. */
function fakeGoogle() {
  const sheets: Record<string, Record<string, Grid>> = {
    priv: {
      '': [PRIVATE_HEADERS, [WORK, 'Old', 'prompts', 'finished', 'public', 'true', '', '', '[]', '2026-09-01', 3, 'rec3', 'false', 1, 'media:m1', '', OWNER, '2026-08-01', '{}', 1, 1, 1, 'tok-old']],
      OwnerSearchIndex: [['work_id','chunk_index','search_text','search_version','updated_at','index_token'], [WORK, 0, 'old', 1, '2026-09-01', 'tok-old'], ['asset_other', 0, 'x', 1, '', 't2']]
    },
    pub: {
      '': [PUBLIC_HEADERS, [WORK, 'Old', 'prompts', 'finished', '2026-09-01', '[]', '', 'pubfile3', 'true', 'media:m1', '{}']],
      WorkCreatorMap: [['schemaVersion','workId','publicCreatorId'], [1, WORK, 'cxlc_' + 'a'.repeat(32)]]
    }
  };
  const files: Record<string, { name: string; parent: string; content: unknown }> = {
    rec3: { name: `${WORK}__r3.json`, parent: 'privFolder', content: {
      revision: 3, row: { id: WORK, user_id: OWNER, title: 'Old', category: 'prompts', status: 'finished', visibility: 'public', is_public: true, created_at: '2026-08-01', preview_image: 'media:m1', preview_images: ['media:m1'] },
      mediaRecords: [{ id: 'm1', asset_id: WORK, purpose: 'gallery', is_cover: true, sort_order: 0, delivery: 'vercel_proxy', mime_type: 'image/png' }],
      cxlAsset: { id: WORK, userId: OWNER, title: 'Old', category: 'prompts', status: 'finished', visibility: 'public', isPublic: true, content: 'old body', previewImage: 'media:m1', previewImages: ['media:m1'], tags: [], versions: [{ version: 1 }], createdAt: '2026-08-01' }
    } },
    pubfile3: { name: `${WORK}__r3.json`, parent: 'pubFolder', content: {} }
  };
  let nextId = 1;
  const col = (letters: string) => letters.split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
  const parse = (range: string) => {
    const [sheet, a1] = range.includes('!') ? range.split('!') : ['', range];
    const rows = a1.match(/^(\d+):(\d+)$/);
    if (rows) return { sheet, r1: +rows[1], r2: +rows[2], c1: 0, c2: 999 };
    const m = a1.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d*))?$/)!;
    return { sheet, c1: col(m[1]), r1: +m[2], c2: m[3] ? col(m[3]) : col(m[1]), r2: m[4] ? +m[4] : m[3] ? 1e9 : +m[2] };
  };
  const fetchMock = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    const sheetMatch = url.pathname.match(/\/spreadsheets\/([^/:]+)(?:\/values\/([^:]+))?(?::(append|batchUpdate))?/);
    if (url.hostname === 'sheets.googleapis.com' && sheetMatch) {
      const book = sheets[decodeURIComponent(sheetMatch[1])];
      const op = decodeURIComponent(url.pathname).includes(':append') ? 'append' : sheetMatch[3];
      if (op === 'batchUpdate') {
        const { requests } = JSON.parse(String(init.body));
        requests.forEach((r: { deleteDimension: { range: { startIndex: number } } }) => book.OwnerSearchIndex.splice(r.deleteDimension.range.startIndex, 1));
        return ok({});
      }
      if (!sheetMatch[2]) return ok({ sheets: [{ properties: { sheetId: 0, title: 'Index' } }, { properties: { sheetId: 7, title: 'OwnerSearchIndex' } }] });
      const range = decodeURIComponent(sheetMatch[2]).replace(/:append$/, '');
      const { sheet, r1, r2, c1, c2 } = parse(range);
      const grid = book[sheet];
      if (op === 'append') { grid.push(...JSON.parse(String(init.body)).values); return ok({}); }
      if (init.method === 'PUT') {
        JSON.parse(String(init.body)).values.forEach((values: unknown[], i: number) => {
          const row = grid[r1 - 1 + i] = [...(grid[r1 - 1 + i] || [])];
          values.forEach((value, j) => { row[c1 + j] = value; });
        });
        return ok({});
      }
      const values = grid.slice(r1 - 1, Math.min(grid.length, r2)).map(row => row.slice(c1, c2 + 1));
      return ok({ values });
    }
    if (url.pathname.startsWith('/upload/drive/v3/files')) {
      const body = String(init.body), parts = body.split(/--cxl-[^\r\n]+/).map(part => part.split('\r\n\r\n')[1]?.trim()).filter(Boolean);
      const meta = JSON.parse(parts[0]), content = JSON.parse(parts[1]);
      const existing = url.pathname.split('/').pop()!;
      if (init.method === 'PATCH') { files[existing].content = content; return ok({ id: existing }); }
      const id = `new${nextId++}`; files[id] = { name: meta.name, parent: meta.parents[0], content }; return ok({ id });
    }
    if (url.pathname === '/drive/v3/files') {
      const q = url.searchParams.get('q')!, parent = q.match(/'([^']+)' in parents/)![1], name = q.match(/name = '([^']+)'/)![1];
      return ok({ files: Object.entries(files).filter(([, f]) => f.parent === parent && f.name === name).map(([id]) => ({ id })) });
    }
    const fileMatch = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (fileMatch) {
      const file = files[fileMatch[1]];
      return url.searchParams.get('alt') === 'media' ? ok(file.content) : ok({ parents: [file.parent] });
    }
    throw new Error(`Unexpected request ${input}`);
  });
  const env: DirectWriteEnv = { ownerToken: 'tok', privateSheetId: 'priv', publicSheetId: 'pub', publicCreatorId: 'cxlc_' + 'a'.repeat(32), ownerFolderIds: async () => ['folder_1'] };
  return { sheets, files, fetchMock, env };
}

afterEach(() => vi.unstubAllGlobals());

describe('direct Work update', () => {
  it('matches the Apps Script request fingerprint (base64 SHA-256 of the same JSON)', () => {
    const value = { id: WORK, updates: { title: 'T' }, expectedRevision: 3 };
    expect(writeFingerprint('update', value)).toBe(createHash('sha256').update(JSON.stringify({ operation: 'update', value })).digest('base64'));
  });

  it('writes the revision file, private index, search chunks and public projection for a text-only edit', async () => {
    const google = fakeGoogle();
    vi.stubGlobal('fetch', google.fetchMock);
    const result = await directUpdateWork([WORK, { title: 'New title', content: 'new body' }, { requestId: REQUEST, expectedRevision: 3 }], OWNER, google.env);
    expect(result.fallback).toBe(false);

    const saved = Object.values(google.files).find(file => file.name === `${WORK}__r4.json` && file.parent === 'privFolder')!.content as Record<string, any>;
    expect(saved.revision).toBe(4);
    expect(saved.row.title).toBe('New title');
    expect(saved.lastWriteRequestId).toBe(REQUEST);
    expect(saved.mediaRecords).toHaveLength(1);
    expect(cxlAssetFromRecord(saved).versions).toHaveLength(2);

    const indexRow = google.sheets.priv[''][1];
    expect(indexRow[PRIVATE_HEADERS.indexOf('revision')]).toBe(4);
    expect(indexRow[PRIVATE_HEADERS.indexOf('title')]).toBe('New title');
    const summary = JSON.parse(String(indexRow[PRIVATE_HEADERS.indexOf('summary_json')]));
    expect(summary).toMatchObject({ summaryVersion: 1, asset: { id: WORK, title: 'New title', revision: 4 } });
    const token = indexRow[PRIVATE_HEADERS.indexOf('search_index_token')];
    const chunks = google.sheets.priv.OwnerSearchIndex.filter(row => row[0] === WORK);
    expect(chunks).toHaveLength(1);
    expect(chunks[0][5]).toBe(token);
    expect(chunks[0][2]).toContain('new body');
    expect(google.sheets.priv.OwnerSearchIndex.some(row => row[0] === 'asset_other')).toBe(true);

    const publicRow = google.sheets.pub[''][1];
    expect(publicRow[PUBLIC_HEADERS.indexOf('title')]).toBe('New title');
    expect(publicRow[PUBLIC_HEADERS.indexOf('active')]).toBe('true');
    expect(JSON.parse(String(publicRow[PUBLIC_HEADERS.indexOf('summary_json')]))).toMatchObject({ summaryVersion: 2, asset: { id: WORK, title: 'New title', isPublic: true } });
  });

  it('falls back to Apps Script before writing when media or visibility change', async () => {
    const google = fakeGoogle();
    vi.stubGlobal('fetch', google.fetchMock);
    const options = { requestId: REQUEST, expectedRevision: 3 };
    await expect(directUpdateWork([WORK, { previewImages: [] }, options], OWNER, google.env)).resolves.toMatchObject({ fallback: true });
    await expect(directUpdateWork([WORK, { visibility: 'private' }, options], OWNER, google.env)).resolves.toMatchObject({ fallback: true, reason: 'visibility_or_trash_changed' });
    await expect(directUpdateWork([WORK, { title: 'x' }, { ...options, mediaIds: ['a'] }], OWNER, google.env)).resolves.toMatchObject({ fallback: true, reason: 'media_upload' });
    expect(Object.keys(google.files)).toEqual(['rec3', 'pubfile3']);
  });

  it('creates a private Work as Apps Script would: revision file, index row, search chunks, no public row', async () => {
    const google = fakeGoogle();
    vi.stubGlobal('fetch', google.fetchMock);
    const input = { title: 'ใหม่', category: 'prompts', status: 'draft', visibility: 'private', content: 'hello world', tags: ['a'], userId: OWNER };
    const result = await directCreateWork([input, { requestId: REQUEST }], OWNER, google.env);
    expect(result.fallback).toBe(false);
    const id = `asset_${REQUEST.replace(/-/g, '')}`;
    const saved = Object.values(google.files).find(file => file.name === `${id}__r1.json`)!;
    expect(saved.parent).toBe('privFolder');
    expect(saved.content).toMatchObject({ revision: 1, createRequestId: REQUEST, lastWriteOperation: 'create', lastWriteFingerprint: writeFingerprint('create', input), row: { id, user_id: OWNER, is_public: false } });
    const row = google.sheets.priv[''].find(values => values[0] === id)!;
    expect(row[PRIVATE_HEADERS.indexOf('create_request_id')]).toBe(REQUEST);
    expect(JSON.parse(String(row[PRIVATE_HEADERS.indexOf('summary_json')])).asset).toMatchObject({ id, title: 'ใหม่', visibility: 'private' });
    expect(google.sheets.priv.OwnerSearchIndex.some(values => values[0] === id && String(values[2]).includes('hello world'))).toBe(true);
    expect(google.sheets.pub[''].some(values => values[0] === id)).toBe(false);
  });

  it('creates a public Work with its creator mapping and public projection', async () => {
    const google = fakeGoogle();
    vi.stubGlobal('fetch', google.fetchMock);
    const input = { title: 'สาธารณะ', category: 'lore', status: 'finished', visibility: 'public', userId: OWNER };
    await expect(directCreateWork([input, { requestId: REQUEST }], OWNER, google.env)).resolves.toMatchObject({ fallback: false });
    const id = `asset_${REQUEST.replace(/-/g, '')}`;
    expect(google.sheets.pub.WorkCreatorMap.some(values => values[1] === id && values[2] === google.env.publicCreatorId)).toBe(true);
    const publicRow = google.sheets.pub[''].find(values => values[0] === id)!;
    expect(publicRow[PUBLIC_HEADERS.indexOf('active')]).toBe('true');
    expect(Object.values(google.files).some(file => file.name === `${id}__r1.json` && file.parent === 'pubFolder')).toBe(true);
  });

  it('falls back for creates with media and for a repeated create request', async () => {
    const google = fakeGoogle();
    vi.stubGlobal('fetch', google.fetchMock);
    await expect(directCreateWork([{ title: 'x', previewImage: 'media:abc', userId: OWNER }, { requestId: REQUEST }], OWNER, google.env)).resolves.toMatchObject({ fallback: true, reason: 'media_references' });
    const input = { title: 'x', category: 'lore', userId: OWNER, visibility: 'private' };
    await directCreateWork([input, { requestId: REQUEST }], OWNER, google.env);
    await expect(directCreateWork([input, { requestId: REQUEST }], OWNER, google.env)).resolves.toMatchObject({ fallback: true, reason: 'idempotent_retry' });
    await expect(directCreateWork([{ title: 'x', userId: OWNER }, { requestId: '22222222-2222-4333-8444-555555555555' }], OWNER, google.env)).rejects.toMatchObject({ code: 'INVALID_WORK' });
  });

  it('moves a public Work to Trash (deactivating its public row) and restores it', async () => {
    const google = fakeGoogle();
    vi.stubGlobal('fetch', google.fetchMock);
    await expect(directSetTrash('works.softDelete', WORK, OWNER, google.env)).resolves.toMatchObject({ fallback: false, data: { success: true } });
    let row = google.sheets.priv[''][1];
    expect(row[PRIVATE_HEADERS.indexOf('deleted_at')]).toBeTruthy();
    expect(row[PRIVATE_HEADERS.indexOf('revision')]).toBe(4);
    expect(google.sheets.pub[''][1][PUBLIC_HEADERS.indexOf('active')]).toBe('false');

    await expect(directSetTrash('works.restore', WORK, OWNER, google.env)).resolves.toMatchObject({ fallback: false });
    row = google.sheets.priv[''][1];
    expect(row[PRIVATE_HEADERS.indexOf('deleted_at')]).toBe('');
    expect(row[PRIVATE_HEADERS.indexOf('revision')]).toBe(5);
    expect(google.sheets.pub[''][1][PUBLIC_HEADERS.indexOf('active')]).toBe('true');
  });

  it('rejects a stale revision without writing', async () => {
    const google = fakeGoogle();
    vi.stubGlobal('fetch', google.fetchMock);
    await expect(directUpdateWork([WORK, { title: 'x' }, { requestId: REQUEST, expectedRevision: 2 }], OWNER, google.env))
      .rejects.toMatchObject({ code: 'REVISION_CONFLICT' } satisfies Partial<DirectWriteError>);
    expect(Object.keys(google.files)).toEqual(['rec3', 'pubfile3']);
  });
});
