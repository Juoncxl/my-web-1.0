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
    mimeType: string | null;
    constructor(name: string, bytes: ArrayLike<number>, mimeType: string | null = null) {
      this.id = `drive-file-${++nextFileId}`;
      this.name = name;
      this.bytes = Array.from(bytes, value => Number(value) & 255);
      this.mimeType = mimeType;
    }
    getId() { return this.id; }
    getSize() { return this.bytes.length; }
    getBlob() { return { getBytes: () => [...this.bytes], getContentType: () => this.mimeType }; }
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
    createFile(blob: { name?: string; getBytes: () => number[]; mimeType?: string }) {
      const file = new FakeFile(String(blob.name || ''), blob.getBytes(), blob.mimeType || null);
      this.files.push(file);
      return file;
    }
  }
  const folders = new Map<string, FakeFolder>([['canonical', new FakeFolder('canonical')], ['staging', new FakeFolder('staging')]]);
  const cacheValues = new Map<string, string>();
  const scriptCache = {
    get: (key: string) => cacheValues.get(key) || null,
    put: (key: string, value: string) => { cacheValues.set(key, String(value)); },
    remove: (key: string) => { cacheValues.delete(key); }
  };
  const context: Record<string, any> = {
    CacheService: { getScriptCache: () => scriptCache },
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
      getUuid: () => `cache-test-${Math.random()}`,
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
  return { context, folders, properties, cacheValues, scriptCache };
}

function attachedReadFixture(mimeType: string, bytes: Buffer, isPublic = false) {
  const { context, folders, properties, cacheValues, scriptCache } = makeWorkMediaBridge();
  const originalGetOwnerWork = context.getOwnerWork_;
  const file = folders.get('canonical')!.createFile({ name: 'attached-media', mimeType, getBytes: () => [...bytes] });
  file.setSharing('private');
  const icon = { type: 'image', value: `media:${MEDIA_ID}`, mediaId: MEDIA_ID };
  const asset = { id: WORK_ID, icon, previewImage: '', previewImages: [], contentBlocks: [] };
  const record = { row: { id: WORK_ID, user_id: OWNER_ID, category: 'prompts', visibility: isPublic ? 'public' : 'private',
    is_public: isPublic, deleted_at: '', updated_at: '2026-09-28T00:00:00.000Z', icon },
    cxlAsset: asset, mediaRecords: [{ id: MEDIA_ID, asset_id: WORK_ID, drive_file_id: file.getId(), delivery: 'vercel_proxy',
      purpose: 'icon', context_id: null, file_size: bytes.length, mime_type: mimeType, sha256: sha256(bytes) }] };
  const projection = { id: WORK_ID, updated_at: record.row.updated_at, cxlAsset: asset,
    mediaRecords: [{ id: MEDIA_ID, delivery: 'vercel_proxy', purpose: 'icon' }] };
  properties.set(`CXL_WORK_MEDIA_MANIFEST_${MEDIA_ID}`, JSON.stringify({ mediaId: MEDIA_ID, workId: WORK_ID,
    ownerUserId: OWNER_ID, drive_file_id: file.getId(), totalFileSize: bytes.length, mimeType, sha256: sha256(bytes),
    purpose: 'icon', contextId: null, totalChunks: Math.ceil(bytes.length / (2 * 1024 * 1024)),
    delivery: 'vercel_proxy', state: 'attached' }));
  context.getOwnerWork_ = () => record;
  context.sheet_ = () => ({});
  context.rowById_ = () => ({ active: 'true', updated_at: record.row.updated_at, file_id: 'public-projection' });
  context.parse_ = () => projection;
  const input = { workId: WORK_ID, mediaId: MEDIA_ID, ref: `media:${MEDIA_ID}`, chunkIndex: 0 };
  return { context, file, record, projection, properties, input, originalGetOwnerWork, cacheValues, scriptCache };
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
    context.mediaWorkOwnerSnapshotSeed_(originalRecord, OWNER_ID, context.mediaWorkOwnerSnapshotEpoch_(WORK_ID, true));
    expect(context.mediaWorkOwnerSnapshotRead_(WORK_ID, OWNER_ID)).not.toBeNull();
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
    context.putJsonRevision_ = () => {
      events.push('revision_write');
      expect(context.mediaWorkOwnerSnapshotRead_(WORK_ID, OWNER_ID)).toBeNull();
      return 'revision-4';
    };
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
    expect(context.mediaWorkOwnerSnapshotRead_(WORK_ID, OWNER_ID)).toBeNull();
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
    context.getOwnerWork_ = () => saved.record;
    expect(() => context.mediaWorkReadChunk_({ workId: WORK_ID, mediaId: MEDIA_ID, ref: `media:${MEDIA_ID}`, chunkIndex: 0 }, OWNER_ID, false))
      .toThrow(expect.objectContaining({ apiCode: 'MEDIA_READ_NOT_FOUND' }));
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

  it.each([
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00])],
    ['image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ['image/webp', Buffer.from('RIFF0000WEBP')],
    ['image/gif', Buffer.from('GIF89a')]
  ])('reads a small %s Owner file from its validated private DriveApp blob without Range fetch', (mimeType, bytes) => {
    const { context, file, input } = attachedReadFixture(mimeType, bytes);
    const blobRead = vi.spyOn(file, 'getBlob');
    const rangeFetch = vi.spyOn(context.UrlFetchApp, 'fetch');
    const oauth = vi.spyOn(context.ScriptApp, 'getOAuthToken');

    const result = context.mediaWorkReadChunk_(input, OWNER_ID, false);

    expect(result).toMatchObject({ mimeType, totalFileSize: bytes.length, totalChunks: 1, chunkIndex: 0,
      sha256: sha256(bytes), chunkSha256: sha256(bytes), base64: bytes.toString('base64') });
    expect(blobRead).toHaveBeenCalledOnce();
    expect(rangeFetch).not.toHaveBeenCalled();
    expect(oauth).not.toHaveBeenCalled();
  });

  it('seeds a server-side Owner authorization snapshot from a full Work detail fetch', () => {
    const { context, file, cacheValues } = attachedReadFixture('image/gif', Buffer.from('GIF89a'));
    const response = context.fetchCxlWorks_({ assetId: WORK_ID });
    const snapshot = JSON.parse([...cacheValues.entries()].find(([key]) => key.startsWith('CXL_WORK_MEDIA_OWNER_SNAPSHOT_'))![1]);
    expect(response.data).toHaveLength(1);
    expect(snapshot).toMatchObject({ schemaVersion: 1, workId: WORK_ID, ownerId: OWNER_ID, category: 'prompts',
      mediaRecords: { [MEDIA_ID]: { id: MEDIA_ID, delivery: 'vercel_proxy', drive_file_id: file.getId() } },
      placements: { [MEDIA_ID]: { id: MEDIA_ID, purpose: 'icon' } } });
    expect(JSON.stringify(response)).not.toContain(file.getId());
  });

  it('uses the seeded Owner snapshot and skips another Sheet/canonical Work read', () => {
    const { context, file, input } = attachedReadFixture('image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    context.fetchCxlWorks_({ assetId: WORK_ID });
    context.getOwnerWork_ = vi.fn(() => { throw new Error('canonical read should be skipped'); });
    const blobRead = vi.spyOn(file, 'getBlob');
    const response = context.doPost({ postData: { contents: JSON.stringify({ authorization: 'test-secret', ownerUserId: OWNER_ID,
      action: 'media.work.ownerChunk', args: [input], includeTiming: true }) } });
    const result = JSON.parse(response.text);
    expect(result.ok).toBe(true);
    expect(result.meta.timing.phases.owner_auth_cache).toEqual(expect.any(Number));
    expect(result.meta.timing.phases).not.toHaveProperty('work_lookup');
    expect(result.meta.timing.phases).not.toHaveProperty('canonical_work_read');
    expect(context.getOwnerWork_).not.toHaveBeenCalled();
    expect(blobRead).toHaveBeenCalledOnce();
    expect(response.text).not.toContain(file.getId());
    expect(response.text).not.toContain('CXL_WORK_MEDIA_OWNER_');
  });

  it('reuses one Owner snapshot across sequential chunks of the same media', () => {
    const bytes = Buffer.alloc(2 * 1024 * 1024 + 1);
    Buffer.from([0x89, 0x50, 0x4e, 0x47]).copy(bytes);
    const { context, input } = attachedReadFixture('image/png', bytes);
    const getOwnerWork = context.getOwnerWork_;
    const canonicalRead = vi.fn(getOwnerWork);
    context.getOwnerWork_ = canonicalRead;
    context.mediaWorkReadChunk_(input, OWNER_ID, false);
    context.mediaWorkReadChunk_({ ...input, chunkIndex: 1 }, OWNER_ID, false);
    expect(canonicalRead).toHaveBeenCalledOnce();
    expect(context.CacheService.getScriptCache().get(`CXL_WORK_MEDIA_OWNER_SNAPSHOT_${WORK_ID}`)).toContain('drive_file_id');
  });

  it('falls back to full canonical validation on cache miss, malformed snapshots, or expired snapshots', () => {
    for (const cacheState of ['miss', 'malformed', 'expired', 'inconsistent', 'unavailable']) {
      const { context, input, cacheValues } = attachedReadFixture('image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      if (cacheState !== 'miss') {
        context.fetchCxlWorks_({ assetId: WORK_ID });
        const key = `CXL_WORK_MEDIA_OWNER_SNAPSHOT_${WORK_ID}`;
        if (cacheState === 'malformed') cacheValues.set(key, '{broken');
        else if (cacheState === 'inconsistent') {
          const cached = JSON.parse(cacheValues.get(key)!);
          cached.workId = 'asset_another_work';
          cacheValues.set(key, JSON.stringify(cached));
        } else cacheValues.delete(key);
      }
      if (cacheState === 'unavailable') context.CacheService.getScriptCache = () => { throw new Error('cache offline'); };
      const getOwnerWork = context.getOwnerWork_;
      const canonicalRead = vi.fn(getOwnerWork);
      context.getOwnerWork_ = canonicalRead;
      expect(context.mediaWorkReadChunk_(input, OWNER_ID, false).totalChunks).toBe(1);
      expect(canonicalRead).toHaveBeenCalledOnce();
    }
  });

  it('reads the manifest fresh on a cache hit and rejects a newly retired media record', () => {
    const { context, input, properties } = attachedReadFixture('image/gif', Buffer.from('GIF89a'));
    context.fetchCxlWorks_({ assetId: WORK_ID });
    context.getOwnerWork_ = vi.fn(() => { throw new Error('cache hit expected'); });
    const key = `CXL_WORK_MEDIA_MANIFEST_${MEDIA_ID}`;
    properties.set(key, JSON.stringify({ ...JSON.parse(properties.get(key)!), state: 'retired' }));
    expect(() => context.mediaWorkReadChunk_(input, OWNER_ID, false))
      .toThrow(expect.objectContaining({ apiCode: 'MEDIA_READ_NOT_FOUND' }));
    expect(context.getOwnerWork_).not.toHaveBeenCalled();
  });

  it('does not let a detail read that started before an update reseed its stale snapshot afterward', () => {
    const { context, record, cacheValues } = attachedReadFixture('image/jpeg', Buffer.from([0xff, 0xd8, 0xff]));
    const oldEpoch = context.mediaWorkOwnerSnapshotEpoch_(WORK_ID, true);
    expect(context.mediaWorkOwnerSnapshotInvalidate_(WORK_ID)).toBe(true);
    expect(context.mediaWorkOwnerSnapshotSeed_(record, OWNER_ID, oldEpoch)).toBe(false);
    expect(cacheValues.has(`CXL_WORK_MEDIA_OWNER_SNAPSHOT_${WORK_ID}`)).toBe(false);
    expect(context.mediaWorkOwnerSnapshotRead_(WORK_ID, OWNER_ID)).toBeNull();
  });

  it('reads a small public file through the blob path only after current public projection authorization', () => {
    const bytes = Buffer.from('GIF87a');
    const { context, file, record, input } = attachedReadFixture('image/gif', bytes, true);
    const blobRead = vi.spyOn(file, 'getBlob');
    const rangeFetch = vi.spyOn(context.UrlFetchApp, 'fetch');

    expect(context.mediaWorkReadChunk_(input, OWNER_ID, true)).toMatchObject({ mimeType: 'image/gif', base64: bytes.toString('base64') });
    expect(blobRead).toHaveBeenCalledOnce();
    expect(rangeFetch).not.toHaveBeenCalled();

    record.row.visibility = 'private';
    record.row.is_public = false;
    expect(() => context.mediaWorkReadChunk_(input, OWNER_ID, true))
      .toThrow(expect.objectContaining({ apiCode: 'MEDIA_READ_NOT_PUBLIC' }));
    expect(blobRead).toHaveBeenCalledOnce();
  });

  it('uses the blob path at the exact 2 MiB single-chunk boundary', () => {
    const bytes = Buffer.alloc(2 * 1024 * 1024);
    const { context, file, input } = attachedReadFixture('image/png', bytes);
    const blobRead = vi.spyOn(file, 'getBlob');
    const rangeFetch = vi.spyOn(context.UrlFetchApp, 'fetch');
    expect(context.mediaWorkReadChunk_(input, OWNER_ID, false)).toMatchObject({ totalChunks: 1,
      totalFileSize: bytes.length, chunkSha256: sha256(bytes) });
    expect(blobRead).toHaveBeenCalledOnce();
    expect(rangeFetch).not.toHaveBeenCalled();
  });

  it('keeps Owner association and retired-manifest denial before any binary read', () => {
    const { context, file, record, properties, input } = attachedReadFixture('image/gif', Buffer.from('GIF89a'));
    const blobRead = vi.spyOn(file, 'getBlob');
    const rangeFetch = vi.spyOn(context.UrlFetchApp, 'fetch');

    (record.cxlAsset as { icon: { type: string; value: string; mediaId?: string } }).icon = { type: 'emoji', value: '✨' };
    expect(() => context.mediaWorkReadChunk_(input, OWNER_ID, false))
      .toThrow(expect.objectContaining({ apiCode: 'MEDIA_READ_NOT_FOUND' }));
    record.cxlAsset.icon = { type: 'image', value: `media:${MEDIA_ID}`, mediaId: MEDIA_ID };
    const key = `CXL_WORK_MEDIA_MANIFEST_${MEDIA_ID}`;
    properties.set(key, JSON.stringify({ ...JSON.parse(properties.get(key)!), state: 'retired' }));
    expect(() => context.mediaWorkReadChunk_(input, OWNER_ID, false))
      .toThrow(expect.objectContaining({ apiCode: 'MEDIA_READ_NOT_FOUND' }));
    expect(blobRead).not.toHaveBeenCalled();
    expect(rangeFetch).not.toHaveBeenCalled();
  });

  it('denies an Owner identity or media-record association mismatch before reading bytes', () => {
    const { context, file, record, input } = attachedReadFixture('image/gif', Buffer.from('GIF89a'));
    const blobRead = vi.spyOn(file, 'getBlob');
    expect(() => context.mediaWorkReadChunk_(input, 'different-owner', false))
      .toThrow(expect.objectContaining({ apiCode: 'MEDIA_READ_NOT_FOUND' }));
    record.mediaRecords[0].asset_id = 'asset_other';
    expect(() => context.mediaWorkReadChunk_(input, OWNER_ID, false))
      .toThrow(expect.objectContaining({ apiCode: 'MEDIA_READ_NOT_FOUND' }));
    expect(blobRead).not.toHaveBeenCalled();
  });

  it('fails safely when a single-chunk blob returns a different byte length, MIME, or bytes', () => {
    const bytes = Buffer.from('GIF89a');
    const { context, file, input } = attachedReadFixture('image/gif', bytes);
    const rangeFetch = vi.spyOn(context.UrlFetchApp, 'fetch');

    vi.spyOn(file, 'getBlob').mockReturnValueOnce({ getBytes: () => [...bytes, 0], getContentType: () => 'image/gif' });
    expect(() => context.mediaWorkReadChunk_(input, OWNER_ID, false))
      .toThrow(expect.objectContaining({ apiCode: 'MEDIA_READ_INVALID' }));
    file.mimeType = 'image/png';
    expect(() => context.mediaWorkReadChunk_(input, OWNER_ID, false))
      .toThrow(expect.objectContaining({ apiCode: 'MEDIA_READ_INVALID' }));
    file.mimeType = 'image/gif';
    vi.spyOn(file, 'getBlob').mockReturnValueOnce({ getBytes: () => [...Buffer.from('GIF87a')], getContentType: () => 'image/gif' });
    expect(() => context.mediaWorkReadChunk_(input, OWNER_ID, false))
      .toThrow(expect.objectContaining({ apiCode: 'MEDIA_READ_INVALID' }));
    vi.spyOn(file, 'getBlob').mockImplementationOnce(() => { throw new Error('private drive detail'); });
    expect(() => context.mediaWorkReadChunk_(input, OWNER_ID, false))
      .toThrow(expect.objectContaining({ apiCode: 'MEDIA_READ_FAILED' }));
    expect(rangeFetch).not.toHaveBeenCalled();
  });

  it('keeps multi-chunk and 10 MiB reads on the Drive Range path', () => {
    const bytes = Buffer.alloc(2 * 1024 * 1024 + 1);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
    const { context, file, record, properties, input } = attachedReadFixture('image/png', bytes);
    const blobRead = vi.spyOn(file, 'getBlob');
    const rangeFetch = vi.spyOn(context.UrlFetchApp, 'fetch');

    const first = context.mediaWorkReadChunk_(input, OWNER_ID, false);
    const last = context.mediaWorkReadChunk_({ ...input, chunkIndex: 1 }, OWNER_ID, false);
    expect(first).toMatchObject({ totalChunks: 2, totalFileSize: bytes.length, chunkIndex: 0 });
    expect(last).toMatchObject({ totalChunks: 2, chunkIndex: 1, base64: 'AA==' });
    expect(rangeFetch).toHaveBeenCalledTimes(2);
    expect(blobRead).not.toHaveBeenCalled();

    const maxBytes = 10 * 1024 * 1024;
    const key = `CXL_WORK_MEDIA_MANIFEST_${MEDIA_ID}`;
    properties.set(key, JSON.stringify({ ...JSON.parse(properties.get(key)!), totalFileSize: maxBytes, totalChunks: 5,
      sha256: 'a'.repeat(64) }));
    record.mediaRecords[0].file_size = maxBytes;
    record.mediaRecords[0].sha256 = 'a'.repeat(64);
    vi.spyOn(file, 'getSize').mockReturnValue(maxBytes);
    context.mediaWorkOwnerSnapshotInvalidate_(WORK_ID);
    context.mediaWorkOwnerSnapshotSeed_(record, OWNER_ID, context.mediaWorkOwnerSnapshotEpoch_(WORK_ID, true));
    rangeFetch.mockImplementationOnce(() => ({ getResponseCode: () => 206,
      getContent: () => Array(2 * 1024 * 1024).fill(0) }));
    const maxChunk = context.mediaWorkReadChunk_({ ...input, chunkIndex: 4 }, OWNER_ID, false);
    expect(maxChunk).toMatchObject({ totalFileSize: maxBytes, totalChunks: 5, chunkIndex: 4 });
    expect(rangeFetch).toHaveBeenCalledTimes(3);
    expect((rangeFetch.mock.calls[2][1] as { headers: { Range: string } }).headers.Range).toBe('bytes=8388608-10485759');
    expect(blobRead).not.toHaveBeenCalled();
  });

  it('emits only safe standard Work media timing fields when Preview requests includeTiming', () => {
    const bytes = Buffer.from('GIF89a');
    const { context, file, record, input, originalGetOwnerWork } = attachedReadFixture('image/gif', bytes);
    context.getOwnerWork_ = originalGetOwnerWork;
    context.config_ = () => ({ privateSheetId: 'private-index' });
    context.sheet_ = () => ({});
    context.rowById_ = () => ({ file_id: 'canonical-work' });
    context.parse_ = () => record;

    const response = context.doPost({ postData: { contents: JSON.stringify({ authorization: 'test-secret', ownerUserId: OWNER_ID,
      action: 'media.work.ownerChunk', args: [input], includeTiming: true }) } });
    const result = JSON.parse(response.text);
    expect(result.ok).toBe(true);
    expect(result.meta.timing.action).toBe('media.work.ownerChunk');
    expect(Object.keys(result.meta.timing.phases)).toEqual(expect.arrayContaining([
      'work_lookup', 'canonical_work_read', 'association_validation', 'file_metadata_validation',
      'binary_fetch', 'response_construction'
    ]));
    expect(result.meta.timing.totalMs).toEqual(expect.any(Number));
    expect(JSON.stringify(result.meta.timing)).not.toMatch(/drive-file|canonical-work|test-secret|owner-1|media:|GIF89a/);
    expect(file.getSharingAccess()).toBe('private');
  });

  it('includes public projection validation timing only after a public read succeeds', () => {
    const { context, input } = attachedReadFixture('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00]), true);
    const response = context.doPost({ postData: { contents: JSON.stringify({ authorization: 'test-secret', ownerUserId: OWNER_ID,
      action: 'media.work.publicChunk', args: [input], includeTiming: true }) } });
    const result = JSON.parse(response.text);
    expect(result.ok).toBe(true);
    expect(result.meta.timing.phases.public_projection_validation).toEqual(expect.any(Number));
    expect(result.meta.timing.phases.binary_fetch).toEqual(expect.any(Number));
    expect(JSON.stringify(result.meta.timing)).not.toMatch(/drive-file|test-secret|owner-1|media:/);
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
