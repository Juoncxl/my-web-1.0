import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { cxlAssetFromRecord, DirectWriteError, directCreateWork, directPermanentDelete, directSetTrash, directUpdateWork, writeFingerprint, type DirectWriteEnv } from './cxlDirectWrite';
import { cleanupWorkMedia, directMediaBegin, directMediaChunk, directMediaFinalize } from './cxlDirectMedia';
import { sniffCreatorMediaType } from '../components/creator/creatorMediaModel';

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
  type FakeFile = { name: string; parent: string; content?: unknown; bytes?: Buffer; mimeType?: string; props?: Record<string, string>; perms?: { id: string; type: string; role?: string }[]; trashed?: boolean; createdTime?: string };
  const sessions: Record<string, { meta: Record<string, any>; total: number; received: Buffer; fileId?: string }> = {};
  const files: Record<string, FakeFile> = {
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
      const tabs = Object.keys(book).map((title, index) => ({ properties: { sheetId: index, title: title || 'Index', index } }));
      if (op === 'batchUpdate') {
        const { requests } = JSON.parse(String(init.body));
        requests.forEach((r: { deleteDimension: { range: { sheetId: number; startIndex: number } } }) => {
          const title = Object.keys(book)[r.deleteDimension.range.sheetId];
          book[title].splice(r.deleteDimension.range.startIndex, 1);
        });
        return ok({});
      }
      if (!sheetMatch[2]) return ok({ sheets: tabs });
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
    const headers = new Headers(init.headers);
    const describe = (id: string) => {
      const f = files[id];
      return { id, name: f.name, parents: [f.parent], size: String(f.bytes?.length ?? 0), mimeType: f.mimeType || 'application/json',
        sha256Checksum: f.bytes ? createHash('sha256').update(f.bytes).digest('hex') : undefined, createdTime: f.createdTime || '2026-10-01T00:00:00.000Z', appProperties: f.props };
    };
    // Resumable upload sessions (media bytes).
    if (url.hostname === 'upload.test') {
      const session = sessions[url.pathname.split('/').pop()!];
      const range = headers.get('content-range') || '';
      const status = () => session.received.length >= session.total
        ? new Response(JSON.stringify(describe(session.fileId!)), { status: 200 })
        : new Response(null, { status: 308, headers: session.received.length ? { Range: `bytes=0-${session.received.length - 1}` } : {} });
      if (range.startsWith('bytes */')) return status();
      const [, start] = range.match(/^bytes (\d+)-/)!;
      if (Number(start) !== session.received.length) return new Response(null, { status: 400 });
      session.received = Buffer.concat([session.received, Buffer.from(init.body as Uint8Array)]);
      if (session.received.length >= session.total) {
        const id = `media${nextId++}`;
        files[id] = { name: session.meta.name, parent: session.meta.parents[0], bytes: session.received, mimeType: session.meta.mimeType, props: { ...session.meta.appProperties }, perms: [] };
        session.fileId = id;
      }
      return status();
    }
    if (url.pathname.startsWith('/upload/drive/v3/files')) {
      if (url.searchParams.get('uploadType') === 'resumable') {
        const sid = `s${nextId++}`;
        sessions[sid] = { meta: JSON.parse(String(init.body)), total: Number(headers.get('x-upload-content-length')), received: Buffer.alloc(0) };
        return new Response('{}', { status: 200, headers: { Location: `https://upload.test/session/${sid}` } });
      }
      const body = String(init.body), parts = body.split(/--cxl-[^\r\n]+/).map(part => part.split('\r\n\r\n')[1]?.trim()).filter(Boolean);
      const meta = JSON.parse(parts[0]), content = JSON.parse(parts[1]);
      const existing = url.pathname.split('/').pop()!;
      if (init.method === 'PATCH') { files[existing].content = content; return ok({ id: existing }); }
      const id = `new${nextId++}`; files[id] = { name: meta.name, parent: meta.parents[0], content }; return ok({ id });
    }
    if (url.pathname === '/drive/v3/files') {
      const q = url.searchParams.get('q')!;
      const prop = q.match(/appProperties has \{ key='([^']+)' and value='([^']+)' \}/);
      const parent = q.match(/'([^']+)' in parents/)?.[1], name = q.match(/name = '([^']+)'/)?.[1], contains = q.match(/name contains '([^']+)'/)?.[1];
      const matches = Object.keys(files).filter(id => {
        const f = files[id];
        if (f.trashed) return false;
        if (prop) return f.props?.[prop[1]] === prop[2];
        if (q.includes("name contains 'cxl-work-media-session-'")) return f.name.startsWith('cxl-work-media-session-');
        if (q.includes("name contains 'cxl-work-media-'")) return /^cxl-work-media-[a-f0-9-]{36}\./.test(f.name);
        if (contains) return f.parent === parent && f.name.includes(contains);
        return f.parent === parent && f.name === name;
      });
      return ok({ files: matches.map(describe) });
    }
    const permMatch = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)\/permissions(?:\/([^/]+))?$/);
    if (permMatch) {
      const file = files[permMatch[1]]; file.perms = file.perms || [];
      if (init.method === 'POST') { file.perms.push({ id: `p${nextId++}`, ...JSON.parse(String(init.body)) }); return ok({}); }
      if (init.method === 'DELETE') { file.perms = file.perms.filter(p => p.id !== permMatch[2]); return new Response(null, { status: 204 }); }
      return ok({ permissions: file.perms });
    }
    const fileMatch = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (fileMatch) {
      const file = files[fileMatch[1]];
      if (init.method === 'DELETE') { delete files[fileMatch[1]]; return new Response(null, { status: 204 }); }
      if (init.method === 'PATCH') {
        const patch = JSON.parse(String(init.body));
        if (patch.trashed) file.trashed = true;
        file.props = { ...file.props, ...patch.appProperties };
        return ok({ id: fileMatch[1] });
      }
      if (url.searchParams.get('alt') === 'media') {
        if (file.bytes) {
          const range = headers.get('range')?.match(/bytes=(\d+)-(\d+)/);
          return range ? new Response(file.bytes.subarray(Number(range[1]), Number(range[2]) + 1), { status: 206 }) : new Response(file.bytes, { status: 200 });
        }
        return ok(file.content);
      }
      return ok({ parents: [file.parent] });
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

  it('leaves trash changes to softDelete/restore and rejects inline or unknown media, without writing', async () => {
    const google = fakeGoogle();
    vi.stubGlobal('fetch', google.fetchMock);
    const options = { requestId: REQUEST, expectedRevision: 3 };
    await expect(directUpdateWork([WORK, { deletedAt: '2026-10-01T00:00:00.000Z' }, options], OWNER, google.env)).resolves.toMatchObject({ fallback: true, reason: 'trash_changed' });
    await expect(directUpdateWork([WORK, { previewImage: 'data:image/png;base64,AAAA' }, options], OWNER, google.env)).rejects.toMatchObject({ code: 'UNSUPPORTED_MEDIA_MUTATION' });
    await expect(directUpdateWork([WORK, { title: 'x' }, { ...options, mediaIds: ['33333333-3333-4333-8333-333333333333'] }], OWNER, google.env)).rejects.toMatchObject({ code: 'UNSUPPORTED_MEDIA_MUTATION' });
    expect(Object.keys(google.files)).toEqual(['rec3', 'pubfile3']);
  });

  it('answers a retried update that already committed without writing again', async () => {
    const google = fakeGoogle();
    vi.stubGlobal('fetch', google.fetchMock);
    const args = [WORK, { title: 'Once' }, { requestId: REQUEST, expectedRevision: 3 }];
    await directUpdateWork(args, OWNER, google.env);
    const filesAfterFirst = Object.keys(google.files).length;
    // The retry still names the old revision, like a browser retrying a lost response.
    (google.sheets.priv[''][1] as unknown[])[PRIVATE_HEADERS.indexOf('file_id')] = Object.entries(google.files).find(([, file]) => file.name === `${WORK}__r4.json` && file.parent === 'privFolder')![0];
    await expect(directUpdateWork(args, OWNER, google.env)).resolves.toMatchObject({ fallback: false, data: { data: { title: 'Once', revision: 4 } } });
    expect(google.sheets.priv[''][1][PRIVATE_HEADERS.indexOf('revision')]).toBe(4);
    expect(Object.keys(google.files).length).toBeGreaterThanOrEqual(filesAfterFirst);
    await expect(directUpdateWork([WORK, { title: 'Different' }, { requestId: REQUEST, expectedRevision: 3 }], OWNER, google.env)).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
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

  it('rejects creates referencing media that was never uploaded and answers a repeated create request', async () => {
    const google = fakeGoogle();
    vi.stubGlobal('fetch', google.fetchMock);
    await expect(directCreateWork([{ title: 'x', category: 'lore', previewImage: 'media:abc', userId: OWNER }, { requestId: REQUEST }], OWNER, google.env)).rejects.toMatchObject({ code: 'UNSUPPORTED_MEDIA_MUTATION' });
    const input = { title: 'x', category: 'lore', userId: OWNER, visibility: 'private' };
    await directCreateWork([input, { requestId: REQUEST }], OWNER, google.env);
    const rows = google.sheets.priv[''].length;
    await expect(directCreateWork([input, { requestId: REQUEST }], OWNER, google.env)).resolves.toMatchObject({ fallback: false, data: { data: { id: `asset_${REQUEST.replace(/-/g, '')}` } } });
    expect(google.sheets.priv[''].length).toBe(rows);
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

  it('uploads an image, attaches it to a Work, then retires it when removed', async () => {
    const google = fakeGoogle();
    vi.stubGlobal('fetch', google.fetchMock);
    google.files.seed = { name: 'cxl-work-media-00000000-0000-4000-8000-000000000000.png', parent: 'mediaFolder', bytes: Buffer.from('x'), mimeType: 'image/png', props: {} };
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 7)]);
    const mediaId = '33333333-3333-4333-8333-333333333333', uploadId = '44444444-4444-4444-8444-444444444444';
    const sha256 = createHash('sha256').update(png).digest('hex');
    const begin = { uploadId, mediaId, workId: WORK, totalFileSize: png.length, rawChunkSize: 2 * 1024 * 1024, totalChunks: 1, mimeType: 'image/png', sha256, purpose: 'gallery', contextId: null, sortOrder: 1, isCover: false };
    await expect(directMediaBegin(begin, OWNER, google.env)).resolves.toMatchObject({ finalized: false });
    await expect(directMediaChunk({ uploadId, chunkIndex: 0, base64: png.toString('base64'), sha256 }, OWNER, google.env)).resolves.toMatchObject({ stored: true });
    await expect(directMediaChunk({ uploadId, chunkIndex: 0, base64: png.toString('base64'), sha256 }, OWNER, google.env)).resolves.toMatchObject({ idempotent: true });
    await expect(directMediaFinalize({ uploadId, mediaId }, OWNER, google.env)).resolves.toMatchObject({ finalized: true, mediaId });
    const media = Object.values(google.files).find(file => file.props?.cxlMediaId === mediaId)!;
    expect(media).toMatchObject({ name: `cxl-work-media-${mediaId}.png`, parent: 'mediaFolder', props: { cxlState: 'finalized' } });
    expect(Object.values(google.files).some(file => file.name.includes('session'))).toBe(false);
    await expect(directMediaBegin(begin, OWNER, google.env)).resolves.toMatchObject({ finalized: true });

    const attached = await directUpdateWork([WORK, { previewImages: ['media:m1', `media:${mediaId}`] }, { requestId: REQUEST, expectedRevision: 3, mediaIds: [mediaId] }], OWNER, google.env);
    expect(attached.fallback).toBe(false);
    const r4 = Object.values(google.files).find(file => file.name === `${WORK}__r4.json` && file.parent === 'privFolder')!.content as Record<string, any>;
    expect(r4.mediaRecords.find((m: { id: string }) => m.id === mediaId)).toMatchObject({ delivery: 'vercel_proxy', purpose: 'gallery', sort_order: 1, is_cover: false, sharing_access: 'private' });
    expect(media.props?.cxlState).toBe('attached');

    await directUpdateWork([WORK, { previewImages: ['media:m1'] }, { requestId: '55555555-5555-4555-8555-555555555555', expectedRevision: 4 }], OWNER, google.env);
    const r5 = Object.values(google.files).find(file => file.name === `${WORK}__r5.json` && file.parent === 'privFolder')!.content as Record<string, any>;
    expect(r5.mediaRecords.some((m: { id: string }) => m.id === mediaId)).toBe(false);
    expect(media.props?.cxlState).toBe('retired');
  });

  it('rejects attaching an upload that does not match its placement, and removing legacy media', async () => {
    const google = fakeGoogle();
    vi.stubGlobal('fetch', google.fetchMock);
    await expect(directUpdateWork([WORK, { previewImages: ['media:m1', 'media:33333333-3333-4333-8333-333333333333'] }, { requestId: REQUEST, expectedRevision: 3, mediaIds: ['33333333-3333-4333-8333-333333333333'] }], OWNER, google.env))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_MEDIA_MUTATION' });
    const record = (google.files.rec3.content as Record<string, any>);
    record.mediaRecords.push({ id: 'legacy', purpose: 'gallery', drive_file_id: 'legacyFile', sharing_access: 'public' });
    record.cxlAsset.previewImages = ['media:m1', 'media:legacy'];
    await expect(directUpdateWork([WORK, { previewImages: ['media:m1'] }, { requestId: REQUEST, expectedRevision: 3 }], OWNER, google.env))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_MEDIA_MUTATION' });
  });

  it('turns a public Work private: legacy images lose their public link and the public row is deactivated', async () => {
    const google = fakeGoogle();
    vi.stubGlobal('fetch', google.fetchMock);
    const record = (google.files.rec3.content as Record<string, any>);
    record.mediaRecords.push({ id: 'legacy', purpose: 'gallery', drive_file_id: 'legacyFile', storage_path: 'old/path', sharing_access: 'public' });
    record.row.preview_images = ['media:m1', 'media:legacy'];
    record.cxlAsset.previewImages = ['media:m1', 'media:legacy'];
    google.files.legacyFile = { name: 'legacy.png', parent: 'old', bytes: Buffer.from('x'), perms: [{ id: 'anyone1', type: 'anyone', role: 'reader' }] };
    await expect(directUpdateWork([WORK, { visibility: 'private', isPublic: false }, { requestId: REQUEST, expectedRevision: 3 }], OWNER, google.env)).resolves.toMatchObject({ fallback: false });
    expect(google.files.legacyFile.perms).toEqual([]);
    expect(google.sheets.pub[''][1][PUBLIC_HEADERS.indexOf('active')]).toBe('false');
    expect(google.sheets.priv[''][1][PRIVATE_HEADERS.indexOf('is_public')]).toBe('false');
  });

  it('permanently deletes a trashed Work: index and search rows, public row, creator map, revision files and its uploads', async () => {
    const google = fakeGoogle();
    vi.stubGlobal('fetch', google.fetchMock);
    const record = google.files.rec3.content as Record<string, any>;
    record.mediaRecords.push({ id: 'up1', asset_id: WORK, purpose: 'gallery', delivery: 'vercel_proxy', drive_file_id: 'upFile' });
    record.mediaRecords.push({ id: 'legacy', purpose: 'gallery', drive_file_id: 'legacyFile' });
    google.files.upFile = { name: 'cxl-work-media-up1.png', parent: 'mediaFolder', bytes: Buffer.from('x') };
    google.files.legacyFile = { name: 'legacy.png', parent: 'old', bytes: Buffer.from('x') };
    await expect(directPermanentDelete(WORK, OWNER, google.env)).rejects.toMatchObject({ code: 'WORK_NOT_IN_TRASH' });

    await directSetTrash('works.softDelete', WORK, OWNER, google.env);
    await expect(directPermanentDelete(WORK, OWNER, google.env)).resolves.toMatchObject({ data: { success: true, alreadyMissing: false } });
    expect(google.sheets.priv[''].some(row => row[0] === WORK)).toBe(false);
    expect(google.sheets.priv.OwnerSearchIndex.some(row => row[0] === WORK)).toBe(false);
    expect(google.sheets.priv.OwnerSearchIndex.some(row => row[0] === 'asset_other')).toBe(true);
    expect(google.sheets.pub[''][1][PUBLIC_HEADERS.indexOf('active')]).toBe('false');
    expect(google.sheets.pub.WorkCreatorMap.some(row => row[1] === WORK)).toBe(false);
    expect(Object.values(google.files).filter(file => file.name.startsWith(`${WORK}__r`)).every(file => file.trashed)).toBe(true);
    expect(google.files.upFile.trashed).toBe(true);
    expect(google.files.legacyFile.trashed).toBeFalsy();
    await expect(directPermanentDelete(WORK, OWNER, google.env)).resolves.toMatchObject({ data: { alreadyMissing: true } });
  });

  it('trashes retired, never-attached and abandoned uploads after 24 hours only', async () => {
    const google = fakeGoogle();
    vi.stubGlobal('fetch', google.fetchMock);
    const now = Date.parse('2026-10-03T00:00:00.000Z');
    google.files.oldRetired = { name: 'cxl-work-media-a.png', parent: 'm', props: { cxlState: 'retired', cxlRetiredAt: '2026-10-01T00:00:00.000Z' } };
    google.files.newRetired = { name: 'cxl-work-media-b.png', parent: 'm', props: { cxlState: 'retired', cxlRetiredAt: '2026-10-02T12:00:00.000Z' } };
    google.files.orphan = { name: 'cxl-work-media-c.png', parent: 'm', props: { cxlState: 'finalized', cxlFinalizedAt: '2026-10-01T00:00:00.000Z' } };
    google.files.attached = { name: 'cxl-work-media-d.png', parent: 'm', props: { cxlState: 'attached', cxlFinalizedAt: '2026-09-01T00:00:00.000Z' } };
    await expect(cleanupWorkMedia(google.env, now)).resolves.toEqual({ trashed: 2 });
    expect([google.files.oldRetired.trashed, google.files.newRetired.trashed, google.files.orphan.trashed, google.files.attached.trashed]).toEqual([true, undefined, true, undefined]);
  });

  it('recognises images by their bytes, including GIFs a browser reports without a type', () => {
    expect(sniffCreatorMediaType(new TextEncoder().encode('GIF89a......'))).toBe('image/gif');
    expect(sniffCreatorMediaType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(sniffCreatorMediaType(new TextEncoder().encode('RIFF....WEBP'))).toBe('image/webp');
    expect(sniffCreatorMediaType(new TextEncoder().encode('<svg>'))).toBe('');
  });

  it('rejects a stale revision without writing', async () => {
    const google = fakeGoogle();
    vi.stubGlobal('fetch', google.fetchMock);
    await expect(directUpdateWork([WORK, { title: 'x' }, { requestId: REQUEST, expectedRevision: 2 }], OWNER, google.env))
      .rejects.toMatchObject({ code: 'REVISION_CONFLICT' } satisfies Partial<DirectWriteError>);
    expect(Object.keys(google.files)).toEqual(['rec3', 'pubfile3']);
  });
});
