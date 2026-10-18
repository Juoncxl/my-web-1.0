import { generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const OWNER = 'a7254db7-f89d-4fce-92af-c339846771cc';
const PUBLIC_WORK = 'asset_public_1';
const PRIVATE_WORK = 'asset_private_1';
const MEDIA = '657da13b-c3f3-4367-bc2f-c6ec3ed8579b';

function record(id: string, visibility: 'public' | 'private') {
  const now = '2026-10-18T10:00:00.000Z';
  const asset = { id, userId: OWNER, title: `Title ${id}`, category: 'lore', status: 'finished', visibility, isPublic: visibility === 'public', tags: ['t'],
    icon: { type: 'emoji', value: '✨' }, content: 'body text', contentBlocks: [], previewImage: `media:${MEDIA}`, previewImages: [`media:${MEDIA}`],
    createdAt: now, updatedAt: now, deletedAt: null, versions: [], media: [] };
  return { schemaVersion: 1, revision: 2, cxlAsset: asset, collaborationDraft: null,
    row: { id, user_id: OWNER, title: asset.title, category: 'lore', status: 'finished', visibility, is_public: visibility === 'public', deleted_at: null, tags: ['t'],
      icon: asset.icon, content: 'body text', content_blocks: [], preview_image: `media:${MEDIA}`, preview_images: [`media:${MEDIA}`], created_at: now, updated_at: now },
    mediaRecords: [{ id: MEDIA, asset_id: id, purpose: 'gallery', mime_type: 'image/jpeg', delivery: 'vercel_proxy', drive_file_id: `r2:media/${MEDIA}`, sort_order: 0, is_cover: true }] };
}

describe('reads with D1 as the source of truth', () => {
  beforeEach(async () => {
    vi.resetModules();
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    vi.stubEnv('CXL_GOOGLE_SA_EMAIL', 'reader@example.iam.gserviceaccount.com');
    vi.stubEnv('CXL_GOOGLE_SA_PRIVATE_KEY', privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
    vi.stubEnv('CXL_PRIVATE_SHEET_ID', 'privateSheet');
    vi.stubEnv('CXL_PUBLIC_SHEET_ID', 'publicSheet');
    vi.stubEnv('CXL_OWNER_PUBLIC_CREATOR_ID', 'cxlc_' + 'a'.repeat(32));
    vi.stubEnv('CXL_D1_PRIMARY', 'on');
    // Google must not be called at all.
    vi.stubGlobal('fetch', vi.fn(async (input: string) => { throw new Error(`Unexpected Google call ${input}`); }));
    const { setWorkDb, importRecord, setWorkStoreMeta } = await import('../../../src/server/cxlWorkStore');
    const { d1CommitFields } = await import('../../../src/server/cxlDirectWrite');
    const { sqliteD1 } = await import('../../../src/server/testing/sqliteD1');
    setWorkDb(sqliteD1());
    for (const [id, visibility] of [[PUBLIC_WORK, 'public'], [PRIVATE_WORK, 'private']] as const) {
      const value = record(id, visibility);
      await importRecord({ id, record: value, ...d1CommitFields(value) });
    }
    await setWorkStoreMeta('imported_at', '2026-10-18T10:00:00Z');
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('lists the Owner Works and reads a full Work from D1', async () => {
    const { directOwnerWorksFetch } = await import('../../../api/cxl/googleDirect');
    const list = await directOwnerWorksFetch({});
    expect(list?.map(work => work.id).sort()).toEqual([PRIVATE_WORK, PUBLIC_WORK]);
    const [full] = (await directOwnerWorksFetch({ assetId: PRIVATE_WORK, detail: 'full' }))!;
    expect(full).toMatchObject({ id: PRIVATE_WORK, title: `Title ${PRIVATE_WORK}`, revision: 2, content: 'body text' });
  });

  it('serves the public list and detail from D1, with the public creator and only public Works', async () => {
    const { directPublicWorksList, directPublicWorkDetail } = await import('../../../api/cxl/googleDirect');
    const works = await directPublicWorksList();
    expect(works.map(work => work.id)).toEqual([PUBLIC_WORK]);
    expect(works[0]).toMatchObject({ isPublic: true, publicCreatorId: 'cxlc_' + 'a'.repeat(32) });
    expect(await directPublicWorkDetail(PUBLIC_WORK)).toMatchObject({ id: PUBLIC_WORK, content: 'body text' });
    expect(await directPublicWorkDetail(PRIVATE_WORK)).toBeNull();
  });

  it('authorizes a public image from the D1 record and reads it from R2', async () => {
    const { setMediaBucket } = await import('../../../src/server/cxlR2Media');
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 0xff, 0xd9]);
    setMediaBucket({ get: async key => key === `media/${MEDIA}` ? { bytes: jpeg, contentType: 'image/jpeg' } : null, put: async () => {}, delete: async () => {}, list: async () => ({ keys: [] }) });
    const { directWorkMedia } = await import('../../../api/cxl/googleDirect');
    expect((await directWorkMedia(PUBLIC_WORK, `media:${MEDIA}`, 'public', true))?.bytes.equals(jpeg)).toBe(true);
    expect(await directWorkMedia(PRIVATE_WORK, `media:${MEDIA}`, 'public', true)).toBeNull();
    expect((await directWorkMedia(PRIVATE_WORK, `media:${MEDIA}`, 'owner', true))?.bytes.equals(jpeg)).toBe(true);
  });
});
