import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(join(process.cwd(), 'apps-script', 'api-only-owner', 'Code.gs'), 'utf8');
const OWNER_ID = 'owner-1';
const WORK_ID = 'asset_1234567890abcdef1234567890abcdef';
const MEDIA_ID = '123e4567-e89b-42d3-a456-426614174001';
const UPLOAD_ID = '123e4567-e89b-42d3-a456-426614174002';
const RETRY_UPLOAD_ID = '123e4567-e89b-42d3-a456-426614174003';

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function makeWorkMediaBridge() {
  const properties = new Map<string, string>([
    ['CXL_API_SHARED_SECRET', 'test-secret'], ['CXL_OWNER_USER_ID', OWNER_ID],
    ['CXL_WORK_MEDIA_FOLDER_ID', 'canonical'], ['CXL_WORK_MEDIA_STAGING_FOLDER_ID', 'staging'],
    ['PUBLIC_SHEET_ID', 'public-index']
  ]);
  let nextFileId = 0;
  class FakeFile {
    id: string;
    name: string;
    bytes: number[];
    sharing = 'anyone';
    trashed = false;
    constructor(name: string, bytes: ArrayLike<number>) {
      this.id = `drive-file-${++nextFileId}`;
      this.name = name;
      this.bytes = Array.from(bytes, value => Number(value) & 255);
    }
    getId() { return this.id; }
    getSize() { return this.bytes.length; }
    getBlob() { return { getBytes: () => [...this.bytes] }; }
    getSharingAccess() { return this.sharing; }
    setSharing(access: string) { this.sharing = access; }
    setTrashed(value: boolean) { this.trashed = value; }
  }
  class FakeFolder {
    files: FakeFile[] = [];
    constructor(public id: string) {}
    getId() { return this.id; }
    getSharingAccess() { return 'private'; }
    getFilesByName(name: string) {
      const matches = this.files.filter(file => file.name === name && !file.trashed);
      let index = 0;
      return { hasNext: () => index < matches.length, next: () => matches[index++] };
    }
    createFile(blob: { name?: string; getBytes: () => number[] }) {
      const file = new FakeFile(String(blob.name || ''), blob.getBytes());
      this.files.push(file);
      return file;
    }
  }
  const folders = new Map<string, FakeFolder>([['canonical', new FakeFolder('canonical')], ['staging', new FakeFolder('staging')]]);
  const context: Record<string, any> = {
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (key: string) => properties.get(key) || null,
      setProperty: (key: string, value: string) => { properties.set(key, String(value)); },
      deleteProperty: (key: string) => { properties.delete(key); },
      getProperties: () => Object.fromEntries(properties)
    }) },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: (text: string) => ({ text, setMimeType() { return this; } }) },
    LockService: { getScriptLock: () => ({ waitLock: () => undefined, releaseLock: () => undefined }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeDigest: (_algorithm: string, value: ArrayLike<number>) => Array.from(createHash('sha256').update(Buffer.from(Array.from(value, item => Number(item) & 255))).digest()),
      base64Decode: (value: string) => Array.from(Buffer.from(value, 'base64')),
      base64Encode: (value: ArrayLike<number>) => Buffer.from(Array.from(value, item => Number(item) & 255)).toString('base64'),
      newBlob: (value: ArrayLike<number>, mimeType: string, name: string) => ({ getBytes: () => Array.from(value, item => Number(item) & 255), mimeType, name })
    },
    ScriptApp: { getOAuthToken: () => 'test-access-token' },
    UrlFetchApp: { fetch: (url: string, options: { headers?: Record<string, string> }) => {
      const fileId = decodeURIComponent(url.split('/files/')[1]?.split('?')[0] || '');
      const file = Array.from(folders.values()).flatMap(folder => folder.files).find(item => item.id === fileId);
      if (!file) throw new Error('missing file');
      const range = options.headers?.Range?.match(/^bytes=(\d+)-(\d+)$/);
      if (!range) throw new Error('missing range');
      const bytes = file.bytes.slice(Number(range[1]), Number(range[2]) + 1);
      return { getResponseCode: () => 206, getContent: () => bytes };
    } },
    DriveApp: {
      Access: { PRIVATE: 'private', ANYONE_WITH_LINK: 'anyone' }, Permission: { VIEW: 'view' },
      getFolderById: (id: string) => { const folder = folders.get(String(id)); if (!folder) throw new Error('missing folder'); return folder; },
      getFileById: (id: string) => {
        for (const folder of folders.values()) {
          const file = folder.files.find(item => item.id === String(id) && !item.trashed);
          if (file) return file;
        }
        throw new Error('missing file');
      }
    }
  };
  runInNewContext(source, context);
  return { context, folders, properties };
}

describe('API-only Owner standard Work media foundation', () => {
  it('reuses a stable media identity, uploads exact chunks, and finalizes a private pending file', () => {
    const { context, folders, properties } = makeWorkMediaBridge();
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const metadata = {
      uploadId: UPLOAD_ID, mediaId: MEDIA_ID, workId: WORK_ID, totalFileSize: bytes.length,
      rawChunkSize: 2 * 1024 * 1024, totalChunks: 1, mimeType: 'image/png', sha256: sha256(bytes),
      purpose: 'icon', contextId: null, sortOrder: 0, isCover: false
    };

    const begin = context.mediaWorkBegin_(metadata, OWNER_ID);
    const retry = context.mediaWorkBegin_({ ...metadata, uploadId: RETRY_UPLOAD_ID }, OWNER_ID);
    const chunk = context.mediaWorkChunk_({ uploadId: UPLOAD_ID, chunkIndex: 0,
      base64: Buffer.from(bytes).toString('base64'), sha256: sha256(bytes) });
    const finalized = context.mediaWorkFinalize_({ uploadId: UPLOAD_ID });

    expect(begin).toMatchObject({ uploadId: UPLOAD_ID, mediaId: MEDIA_ID, finalized: false });
    expect(retry).toMatchObject({ uploadId: UPLOAD_ID, mediaId: MEDIA_ID, finalized: false });
    expect(chunk).toMatchObject({ stored: true, chunkIndex: 0 });
    expect(finalized).toMatchObject({ uploadId: UPLOAD_ID, mediaId: MEDIA_ID, finalized: true });
    const manifest = JSON.parse(properties.get(`CXL_WORK_MEDIA_MANIFEST_${MEDIA_ID}`)!);
    expect(manifest).toMatchObject({ ownerUserId: OWNER_ID, workId: WORK_ID, state: 'finalized', delivery: 'vercel_proxy', sharing_access: 'private',
      rawChunkSize: 2 * 1024 * 1024, orphanExpiresAt: expect.any(Number) });
    expect(manifest.drive_file_id).toBeTruthy();
    expect(JSON.stringify([begin, retry, chunk, finalized])).not.toContain(manifest.drive_file_id);
    const canonical = folders.get('canonical')!.files[0];
    expect(canonical.getSharingAccess()).toBe('private');
    expect(folders.get('staging')!.files.every(file => file.trashed)).toBe(true);
    expect(context.mediaWorkBegin_({ ...metadata, uploadId: RETRY_UPLOAD_ID }, OWNER_ID)).toMatchObject({ uploadId: UPLOAD_ID, finalized: true });
  });

  it('attaches only matching finalized media and keeps proxy media private for public Works', () => {
    const { context, folders, properties } = makeWorkMediaBridge();
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const file = folders.get('canonical')!.createFile({ name: 'canonical.png', getBytes: () => [...bytes] });
    file.setSharing('private');
    properties.set(`CXL_WORK_MEDIA_MANIFEST_${MEDIA_ID}`, JSON.stringify({ uploadId: UPLOAD_ID, mediaId: MEDIA_ID,
      workId: WORK_ID, ownerUserId: OWNER_ID, drive_file_id: file.getId(), totalFileSize: bytes.length, mimeType: 'image/png',
      sha256: sha256(bytes), purpose: 'icon', contextId: null, sortOrder: 0, isCover: false, delivery: 'vercel_proxy', state: 'finalized', createdAt: '2026-09-28T00:00:00.000Z' }));
    const asset = { id: WORK_ID, icon: { type: 'image', value: `media:${MEDIA_ID}`, mediaId: MEDIA_ID }, previewImages: [], contentBlocks: [] };
    const record = { row: { id: WORK_ID, visibility: 'public', icon: asset.icon, preview_image: '', preview_images: [] }, mediaRecords: [] as any[] };

    const manifests = context.mediaWorkAttach_(record, asset, [MEDIA_ID], WORK_ID, OWNER_ID);
    context.shareRecordMedia_(record, true);
    const projection = context.projection_(record);

    expect(manifests).toHaveLength(1);
    expect(record.mediaRecords[0]).toMatchObject({ id: MEDIA_ID, delivery: 'vercel_proxy', sharing_access: 'private', purpose: 'icon' });
    expect(file.getSharingAccess()).toBe('private');
    expect(projection.mediaRecords[0]).toMatchObject({ id: MEDIA_ID, delivery: 'vercel_proxy', drive_file_id: null, drive_url: null, storage_path: null });
    expect(JSON.stringify(projection)).not.toContain(file.getId());
  });

  it('allows server-derived replace/remove while rejecting new refs outside supported placements', () => {
    const { context } = makeWorkMediaBridge();
    const old = { icon: { type: 'image', value: `media:${MEDIA_ID}` }, previewImages: [], contentBlocks: [],
      media: [{ id: MEDIA_ID, delivery: 'vercel_proxy' }] };
    expect(() => context.rejectUnsupportedWorkMedia_({ icon: { type: 'emoji', value: '✨' }, previewImages: [], contentBlocks: [], media: [] }, old, []))
      .not.toThrow();
    expect(() => context.rejectUnsupportedWorkMedia_({ icon: { type: 'image', value: 'media:123e4567-e89b-42d3-a456-426614174009' }, previewImages: [], contentBlocks: [], media: [] }, old,
      ['123e4567-e89b-42d3-a456-426614174009']))
      .not.toThrow();
    expect(() => context.rejectUnsupportedWorkMedia_({ content: `media:${MEDIA_ID}`, icon: { type: 'emoji', value: '✨' }, previewImages: [], contentBlocks: [], media: [] }, null, [MEDIA_ID]))
      .toThrow(expect.objectContaining({ apiCode: 'UNSUPPORTED_MEDIA_MUTATION' }));
    expect(() => context.mediaWorkReferenceMap_({ icon: { type: 'image', value: `media:${MEDIA_ID}`, mediaId: '123e4567-e89b-42d3-a456-426614174009' } }))
      .toThrow(expect.objectContaining({ apiCode: 'UNSUPPORTED_MEDIA_MUTATION' }));
    expect(context.mediaWorkReferenceMap_({ previewImage: `media:${MEDIA_ID}`, previewImages: [] })[MEDIA_ID]).toMatchObject({ purpose: 'gallery', sortOrder: 0, isCover: true });
  });

  it('retires the old manifest only after the new canonical Work index commit', () => {
    const { context, folders, properties } = makeWorkMediaBridge();
    const previousAsset = { id: WORK_ID, userId: OWNER_ID, title: 'Before', category: 'prompts', status: 'finished',
      visibility: 'private', isPublic: false, icon: { type: 'image', value: `media:${MEDIA_ID}`, mediaId: MEDIA_ID },
      previewImage: '', previewImages: [], contentBlocks: [], content: '', tags: [], media: [] };
    const file = folders.get('canonical')!.createFile({ name: `cxl-work-media-${MEDIA_ID}.png`, getBytes: () => [1, 2, 3] });
    file.setSharing('private');
    const mediaRecord = { id: MEDIA_ID, asset_id: WORK_ID, drive_file_id: file.getId(), delivery: 'vercel_proxy',
      purpose: 'icon', context_id: null, file_size: 3, mime_type: 'image/png', sharing_access: 'private' };
    properties.set(`CXL_WORK_MEDIA_MANIFEST_${MEDIA_ID}`, JSON.stringify({ uploadId: UPLOAD_ID, mediaId: MEDIA_ID,
      workId: WORK_ID, ownerUserId: OWNER_ID, drive_file_id: file.getId(), totalFileSize: 3, mimeType: 'image/png',
      sha256: 'a'.repeat(64), purpose: 'icon', contextId: null, sortOrder: 0, isCover: false, totalChunks: 1,
      delivery: 'vercel_proxy', state: 'attached', sharing_access: 'private' }));
    const currentRecord = { revision: 3, row: { id: WORK_ID, user_id: OWNER_ID, title: 'Before', category: 'prompts', status: 'finished',
      visibility: 'private', is_public: false, deleted_at: '', folder_id: '', tags: [], icon: previousAsset.icon,
      preview_image: '', preview_images: [], content_blocks: [], versions: [] }, cxlAsset: previousAsset, mediaRecords: [mediaRecord] };
    const originalRecord = structuredClone(currentRecord);
    const indexRow = { _sheetRow: 2, id: WORK_ID, revision: 3, file_id: 'revision-3' };
    const events: string[] = [];
    context.config_ = () => ({ privateSheetId: 'private-index', privateId: 'canonical' });
    context.sheet_ = () => ({});
    context.rowAtSheetNumber_ = () => indexRow;
    context.ensurePrivateHeaders_ = () => undefined;
    context.ownerSearchArtifacts_ = () => ({ version: 1, chunks: [], token: 'search-token', updatedAt: '2026-09-28T00:00:00.000Z' });
    context.ownerSearchSheet_ = () => ({});
    context.appendOwnerSearchChunks_ = () => undefined;
    context.privateMeta_ = () => ({ id: WORK_ID });
    context.shareRecordMedia_ = () => undefined;
    context.putJsonRevision_ = () => { events.push('revision_write'); return 'revision-4'; };
    context.setPrivateIndexRow_ = () => { events.push('private_index'); throw new Error('index write failed'); };
    const markRetired = context.mediaWorkMarkRetired_;
    context.mediaWorkMarkRetired_ = (...args: unknown[]) => { events.push('retire'); return markRetired(...args); };
    const nextAsset = { ...previousAsset, icon: { type: 'emoji', value: '✨' } };
    const input = { id: WORK_ID, ownerUserId: OWNER_ID, revision: 3, writeRequestId: 'request-1', writeOperation: 'update',
      writeFingerprint: 'fingerprint', title: 'After', category: 'prompts', status: 'finished', visibility: 'private', tags: [],
      cxlAsset: nextAsset, mediaIds: [] };
    const options = { idempotent: true, deferPublicSync: true, privateSheet: {}, preloadedIndexRow: indexRow, preloadedRecord: structuredClone(originalRecord) };

    expect(() => context.saveOwnerWork_(input, options)).toThrow('index write failed');
    expect(events).toEqual(['revision_write', 'private_index']);
    expect(JSON.parse(properties.get(`CXL_WORK_MEDIA_MANIFEST_${MEDIA_ID}`)!).state).toBe('attached');
    expect(file.getSharingAccess()).toBe('private');

    context.setPrivateIndexRow_ = () => { events.push('private_index'); };
    options.preloadedRecord = structuredClone(originalRecord);
    events.length = 0;
    const saved = context.saveOwnerWork_(input, options);

    expect(events).toEqual(['revision_write', 'private_index', 'retire']);
    expect(saved.record.mediaRecords).toEqual([]);
    expect(JSON.parse(properties.get(`CXL_WORK_MEDIA_MANIFEST_${MEDIA_ID}`)!)).toMatchObject({ state: 'retired', retiredFromRevision: 4 });
    expect(file.trashed).toBe(false);
    expect(file.getSharingAccess()).toBe('private');
  });

  it('keeps a shared media identity attached while any canonical reference remains', () => {
    const { context } = makeWorkMediaBridge();
    const shared = `media:${MEDIA_ID}`;
    const previous = { icon: { type: 'image', value: shared }, previewImages: [shared], previewImage: shared,
      contentBlocks: [{ id: 'image-1', type: 'Image', body: shared }], media: [] };
    const next = { icon: { type: 'emoji', value: '✨' }, previewImages: [shared], previewImage: shared,
      contentBlocks: [], media: [] };
    expect(context.mediaWorkReferencedIds_(next)).toEqual({ [MEDIA_ID]: true });
    expect(Object.keys(context.mediaWorkReferenceMap_(previous))).toEqual([MEDIA_ID]);
    expect(context.mediaWorkReferenceMap_(previous)[MEDIA_ID].references).toHaveLength(3);
    expect(() => context.rejectUnsupportedWorkMedia_(next, previous, [])).not.toThrow();
  });

  it('includes public content-block media associations while redacting Drive identifiers', () => {
    const { context } = makeWorkMediaBridge();
    const blockMediaId = '123e4567-e89b-42d3-a456-426614174004';
    const projection = context.projection_({ row: {
      id: WORK_ID, category: 'prompts', title: 'Public Work', visibility: 'public', status: 'finished',
      content_blocks: [{ id: 'creator-image-example-0', type: 'Image', body: `media:${blockMediaId}`, mediaId: blockMediaId }],
      icon: { type: 'emoji', value: '✨' }, preview_image: '', preview_images: [], tags: []
    }, mediaRecords: [{ id: blockMediaId, asset_id: WORK_ID, purpose: 'prompt_example', storage_path: `google-work-media/${blockMediaId}`,
      drive_file_id: 'private-drive-id', drive_url: 'private-drive-url', delivery: 'vercel_proxy', mime_type: 'image/png', file_size: 68, sort_order: 0, is_cover: false }] });

    expect(projection.mediaRecords).toMatchObject([{ id: blockMediaId, purpose: 'prompt_example', delivery: 'vercel_proxy', storage_path: null, drive_file_id: null, drive_url: null }]);
    expect(JSON.stringify(projection)).not.toMatch(/private-drive-id|private-drive-url/);
  });

  it('reads an attached private Work chunk only through the Work reference and private Drive file', () => {
    const { context, folders, properties } = makeWorkMediaBridge();
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const file = folders.get('canonical')!.createFile({ name: 'read.png', getBytes: () => [...bytes] });
    file.setSharing('private');
    const icon = { type: 'image', value: `media:${MEDIA_ID}`, mediaId: MEDIA_ID };
    const media = { id: MEDIA_ID, asset_id: WORK_ID, drive_file_id: file.getId(), delivery: 'vercel_proxy',
      purpose: 'icon', context_id: null, file_size: bytes.length };
    const asset = { id: WORK_ID, icon, previewImage: '', previewImages: [], contentBlocks: [] };
    const record = { row: { id: WORK_ID, user_id: OWNER_ID, visibility: 'private', is_public: false,
      deleted_at: '', updated_at: '2026-09-28T00:00:00.000Z', icon, preview_image: '', preview_images: [], content_blocks: [] },
      cxlAsset: asset, mediaRecords: [media] };
    properties.set(`CXL_WORK_MEDIA_MANIFEST_${MEDIA_ID}`, JSON.stringify({ mediaId: MEDIA_ID, workId: WORK_ID,
      ownerUserId: OWNER_ID, drive_file_id: file.getId(), totalFileSize: bytes.length, mimeType: 'image/png', sha256: sha256(bytes),
      purpose: 'icon', contextId: null, sortOrder: 0, isCover: false, totalChunks: 1, delivery: 'vercel_proxy', state: 'attached' }));
    context.getOwnerWork_ = () => record;

    const result = context.mediaWorkReadChunk_({ workId: WORK_ID, mediaId: MEDIA_ID, ref: `media:${MEDIA_ID}`, chunkIndex: 0 }, OWNER_ID, false);
    expect(result).toMatchObject({ workId: WORK_ID, mediaId: MEDIA_ID, mimeType: 'image/png', totalChunks: 1, chunkIndex: 0,
      base64: Buffer.from(bytes).toString('base64') });
    expect(JSON.stringify(result)).not.toContain(file.getId());
    expect(file.getSharingAccess()).toBe('private');
    const privateSummary = JSON.parse(context.privateSummaryJson_(record)).asset;
    expect(privateSummary.media).toMatchObject([{ id: MEDIA_ID, purpose: 'icon', delivery: 'vercel_proxy' }]);
    expect(JSON.stringify(privateSummary)).not.toContain(file.getId());

    record.cxlAsset = { ...asset, icon: { type: 'emoji', value: '✨', mediaId: '' } };
    expect(() => context.mediaWorkReadChunk_({ workId: WORK_ID, mediaId: MEDIA_ID, ref: `media:${MEDIA_ID}`, chunkIndex: 0 }, OWNER_ID, false))
      .toThrow(expect.objectContaining({ apiCode: 'MEDIA_READ_NOT_FOUND' }));
    expect(file.getSharingAccess()).toBe('private');
  });

  it('requires the current public projection to contain the same Work media association', () => {
    const { context, folders, properties } = makeWorkMediaBridge();
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const file = folders.get('canonical')!.createFile({ name: 'public-read.png', getBytes: () => [...bytes] });
    file.setSharing('private');
    const icon = { type: 'image', value: `media:${MEDIA_ID}`, mediaId: MEDIA_ID };
    const media = { id: MEDIA_ID, asset_id: WORK_ID, drive_file_id: file.getId(), delivery: 'vercel_proxy',
      purpose: 'icon', context_id: null, file_size: bytes.length };
    const asset = { id: WORK_ID, icon, previewImage: '', previewImages: [], contentBlocks: [] };
    const record = { row: { id: WORK_ID, user_id: OWNER_ID, visibility: 'public', is_public: true,
      deleted_at: '', updated_at: '2026-09-28T00:00:00.000Z', icon, preview_image: '', preview_images: [], content_blocks: [] },
      cxlAsset: asset, mediaRecords: [media] };
    const projection = { id: WORK_ID, updated_at: record.row.updated_at, cxlAsset: asset,
      mediaRecords: [{ id: MEDIA_ID, delivery: 'vercel_proxy', purpose: 'icon' }] };
    properties.set(`CXL_WORK_MEDIA_MANIFEST_${MEDIA_ID}`, JSON.stringify({ mediaId: MEDIA_ID, workId: WORK_ID,
      ownerUserId: OWNER_ID, drive_file_id: file.getId(), totalFileSize: bytes.length, mimeType: 'image/png', sha256: sha256(bytes),
      purpose: 'icon', contextId: null, sortOrder: 0, isCover: false, totalChunks: 1, delivery: 'vercel_proxy', state: 'attached' }));
    context.getOwnerWork_ = () => record;
    context.sheet_ = () => ({});
    context.rowById_ = () => ({ active: 'true', updated_at: record.row.updated_at, file_id: 'public-projection' });
    context.parse_ = () => projection;

    const result = context.mediaWorkReadChunk_({ workId: WORK_ID, mediaId: MEDIA_ID, ref: `media:${MEDIA_ID}`, chunkIndex: 0 }, OWNER_ID, true);
    expect(result).toMatchObject({ workId: WORK_ID, mediaId: MEDIA_ID, totalChunks: 1 });
    const publicSummary = context.publicSummaryEnvelope_(projection).asset;
    expect(publicSummary.media).toMatchObject([{ id: MEDIA_ID, delivery: 'vercel_proxy' }]);
    expect(JSON.stringify(publicSummary)).not.toContain(file.getId());

    context.rowById_ = () => ({ active: 'false', updated_at: record.row.updated_at, file_id: 'public-projection' });
    expect(() => context.mediaWorkReadChunk_({ workId: WORK_ID, mediaId: MEDIA_ID, ref: `media:${MEDIA_ID}`, chunkIndex: 0 }, OWNER_ID, true))
      .toThrow(expect.objectContaining({ apiCode: 'MEDIA_READ_NOT_PUBLIC' }));

    context.rowById_ = () => ({ active: 'true', updated_at: record.row.updated_at, file_id: 'public-projection' });
    context.parse_ = () => ({ ...projection, cxlAsset: { ...asset, icon: { type: 'emoji', value: '✨' } } });
    expect(() => context.mediaWorkReadChunk_({ workId: WORK_ID, mediaId: MEDIA_ID, ref: `media:${MEDIA_ID}`, chunkIndex: 0 }, OWNER_ID, true))
      .toThrow(expect.objectContaining({ apiCode: 'MEDIA_READ_NOT_PUBLIC' }));
  });

  it('cleans only expired Work-media orphans and leaves POC and unrelated Drive files alone', () => {
    const { context, folders, properties } = makeWorkMediaBridge();
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const orphan = folders.get('canonical')!.createFile({ name: `cxl-work-media-${MEDIA_ID}.png`, getBytes: () => [...bytes] });
    orphan.setSharing('private');
    const poc = folders.get('canonical')!.createFile({ name: 'poc-file.png', getBytes: () => [...bytes] });
    poc.setSharing('private');
    const unrelated = folders.get('canonical')!.createFile({ name: 'unrelated.png', getBytes: () => [...bytes] });
    unrelated.setSharing('private');
    properties.set(`CXL_WORK_MEDIA_MANIFEST_${MEDIA_ID}`, JSON.stringify({ uploadId: UPLOAD_ID, mediaId: MEDIA_ID,
      workId: WORK_ID, ownerUserId: OWNER_ID, drive_file_id: orphan.getId(), totalFileSize: bytes.length, mimeType: 'image/png',
      sha256: sha256(bytes), purpose: 'icon', contextId: null, sortOrder: 0, isCover: false, totalChunks: 1,
      delivery: 'vercel_proxy', state: 'finalized', sharing_access: 'private', createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      orphanExpiresAt: Date.now() - 1 }));
    properties.set('CXL_MEDIA_POC_MEDIA_fixture', JSON.stringify({ drive_file_id: poc.getId(), isPublic: false }));
    context.config_ = () => ({ privateSheetId: 'private-index' });
    context.sheet_ = () => ({});
    context.rowById_ = () => null;

    const result = context.mediaWorkCleanup_(OWNER_ID);

    expect(result).toMatchObject({ processed: 1, deletedMedia: 1 });
    expect(orphan.trashed).toBe(true);
    expect(orphan.getSharingAccess()).toBe('private');
    expect(poc.trashed).toBe(false);
    expect(unrelated.trashed).toBe(false);
    expect(JSON.parse(properties.get(`CXL_WORK_MEDIA_MANIFEST_${MEDIA_ID}`)!).state).toBe('deleted');
    expect(JSON.stringify(result)).not.toMatch(new RegExp(`${MEDIA_ID}|${orphan.getId()}`));
  });

  it('limits cleanup to five property records per invocation and skips active uploads', () => {
    const { context, folders, properties } = makeWorkMediaBridge();
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const ids = Array.from({ length: 6 }, (_, index) => `123e4567-e89b-42d3-a456-42661417400${index + 1}`);
    const files = ids.map(mediaId => {
      const file = folders.get('canonical')!.createFile({ name: `cxl-work-media-${mediaId}.png`, getBytes: () => [...bytes] });
      file.setSharing('private');
      properties.set(`CXL_WORK_MEDIA_MANIFEST_${mediaId}`, JSON.stringify({ uploadId: UPLOAD_ID, mediaId,
        workId: WORK_ID, ownerUserId: OWNER_ID, drive_file_id: file.getId(), totalFileSize: bytes.length, mimeType: 'image/png',
        sha256: sha256(bytes), purpose: 'icon', contextId: null, sortOrder: 0, isCover: false, totalChunks: 1,
        delivery: 'vercel_proxy', state: 'finalized', sharing_access: 'private', createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        orphanExpiresAt: Date.now() - 1 }));
      return file;
    });
    const activeUploadId = '123e4567-e89b-42d3-a456-426614174099';
    const activeMediaId = '123e4567-e89b-42d3-a456-426614174098';
    const staged = folders.get('staging')!.createFile({ name: `cxl-work-media-chunk-${activeUploadId}-00.bin`, getBytes: () => [...bytes] });
    staged.setSharing('private');
    properties.set(`CXL_WORK_MEDIA_UPLOAD_SESSION_${activeUploadId}`, JSON.stringify({ uploadId: activeUploadId, mediaId: activeMediaId,
      workId: WORK_ID, ownerUserId: OWNER_ID, status: 'uploading', expiresAt: Date.now() + 60000,
      totalChunks: 1, mimeType: 'image/png', totalFileSize: bytes.length, sha256: sha256(bytes) }));
    context.config_ = () => ({ privateSheetId: 'private-index' });
    context.sheet_ = () => ({});
    context.rowById_ = () => null;

    const first = context.mediaWorkCleanup_(OWNER_ID);

    expect(first.processed).toBe(5);
    expect(first.deletedMedia).toBe(5);
    expect(files.filter(file => !file.trashed)).toHaveLength(1);
    expect(staged.trashed).toBe(false);
    const second = context.mediaWorkCleanup_(OWNER_ID);
    expect(second.processed).toBeLessThanOrEqual(5);
    expect(files.every(file => file.trashed)).toBe(true);
  });

  it('marks removed attached media retired first and keeps its Drive file private until TTL cleanup', () => {
    const { context, folders, properties } = makeWorkMediaBridge();
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const file = folders.get('canonical')!.createFile({ name: `cxl-work-media-${MEDIA_ID}.png`, getBytes: () => [...bytes] });
    file.setSharing('private');
    properties.set(`CXL_WORK_MEDIA_MANIFEST_${MEDIA_ID}`, JSON.stringify({ uploadId: UPLOAD_ID, mediaId: MEDIA_ID,
      workId: WORK_ID, ownerUserId: OWNER_ID, drive_file_id: file.getId(), totalFileSize: bytes.length, mimeType: 'image/png',
      sha256: sha256(bytes), purpose: 'icon', contextId: null, sortOrder: 0, isCover: false, totalChunks: 1,
      delivery: 'vercel_proxy', state: 'attached', sharing_access: 'private' }));
    const currentRecord = { revision: 4, row: { id: WORK_ID, user_id: OWNER_ID, category: 'prompts' },
      cxlAsset: { id: WORK_ID, icon: { type: 'emoji', value: '✨' }, previewImages: [], contentBlocks: [] }, mediaRecords: [] };
    context.config_ = () => ({ privateSheetId: 'private-index' });
    context.sheet_ = () => ({});
    context.rowById_ = () => ({ file_id: 'current-work' });
    context.parse_ = () => currentRecord;

    const retired = context.mediaWorkCleanup_(OWNER_ID);
    expect(retired).toMatchObject({ retiredMedia: 1, deletedMedia: 0 });
    const manifest = JSON.parse(properties.get(`CXL_WORK_MEDIA_MANIFEST_${MEDIA_ID}`)!);
    expect(manifest.state).toBe('retired');
    expect(manifest.retireAfter).toBeGreaterThan(Date.now());
    expect(file.trashed).toBe(false);
    expect(file.getSharingAccess()).toBe('private');

    manifest.retireAfter = Date.now() - 1;
    properties.set(`CXL_WORK_MEDIA_MANIFEST_${MEDIA_ID}`, JSON.stringify(manifest));
    const deleted = context.mediaWorkCleanup_(OWNER_ID);
    expect(deleted.deletedMedia).toBe(1);
    expect(file.trashed).toBe(true);
  });
});
