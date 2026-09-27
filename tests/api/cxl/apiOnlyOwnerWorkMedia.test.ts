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
    ['CXL_WORK_MEDIA_FOLDER_ID', 'canonical'], ['CXL_WORK_MEDIA_STAGING_FOLDER_ID', 'staging']
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
    expect(manifest).toMatchObject({ ownerUserId: OWNER_ID, workId: WORK_ID, state: 'finalized', delivery: 'vercel_proxy', sharing_access: 'private' });
    expect(manifest.drive_file_id).toBeTruthy();
    expect(JSON.stringify([begin, retry, chunk, finalized])).not.toContain(manifest.drive_file_id);
    const canonical = folders.get('canonical')!.files[0];
    expect(canonical.getSharingAccess()).toBe('private');
    expect(folders.get('staging')!.files.every(file => file.trashed)).toBe(true);
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

  it('rejects media identity removal/replacement and media refs outside supported placements', () => {
    const { context } = makeWorkMediaBridge();
    const old = { icon: { type: 'image', value: `media:${MEDIA_ID}` }, previewImages: [], contentBlocks: [], media: [] };
    expect(() => context.rejectUnsupportedWorkMedia_({ icon: { type: 'emoji', value: '✨' }, previewImages: [], contentBlocks: [], media: [] }, old, []))
      .toThrow(expect.objectContaining({ apiCode: 'UNSUPPORTED_MEDIA_MUTATION' }));
    expect(() => context.rejectUnsupportedWorkMedia_({ content: `media:${MEDIA_ID}`, icon: { type: 'emoji', value: '✨' }, previewImages: [], contentBlocks: [], media: [] }, null, [MEDIA_ID]))
      .toThrow(expect.objectContaining({ apiCode: 'UNSUPPORTED_MEDIA_MUTATION' }));
    expect(() => context.mediaWorkReferenceMap_({ icon: { type: 'image', value: `media:${MEDIA_ID}`, mediaId: '123e4567-e89b-42d3-a456-426614174009' } }))
      .toThrow(expect.objectContaining({ apiCode: 'UNSUPPORTED_MEDIA_MUTATION' }));
    expect(context.mediaWorkReferenceMap_({ previewImage: `media:${MEDIA_ID}`, previewImages: [] })[MEDIA_ID]).toMatchObject({ purpose: 'gallery', sortOrder: 0, isCover: true });
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
});
