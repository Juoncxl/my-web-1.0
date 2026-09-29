import { afterEach, describe, expect, it, vi } from 'vitest';
import { hydrateGoogleWorkMedia, prepareGoogleWorkMedia, uploadGoogleWorkMedia, GOOGLE_WORK_MEDIA_CHUNK_BYTES } from './googleWorkMedia';

vi.mock('../../../lib/supabaseClient', () => ({
  getSupabaseClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } })
}));

const IDS = {
  icon: '123e4567-e89b-42d3-a456-426614174001',
  gallery: '123e4567-e89b-42d3-a456-426614174002',
  block: '123e4567-e89b-42d3-a456-426614174003'
};

describe('Google standard Work media upload foundation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('replaces local icon, gallery and content image sources with canonical refs', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' })
    }));
    vi.stubGlobal('fetch', fetchMock);
    const prepared = await prepareGoogleWorkMedia({
      title: 'Work', category: 'prompts',
      icon: { type: 'image', value: 'data:image/png;base64,AQIDBA==', mediaId: IDS.icon, mimeType: 'image/png' },
      previewImage: 'blob:gallery', previewImages: ['blob:gallery'],
      content: 'Example blob:block',
      contentBlocks: [{ id: 'block-1', type: 'Image', title: 'Example', body: 'blob:block', mediaId: IDS.block }],
      authorAvatar: 'data:image/png;base64,AA==',
      workMediaDraft: [
        { mediaId: IDS.icon, source: 'data:image/png;base64,AQIDBA==', purpose: 'icon', sortOrder: 0, isCover: false, mimeType: 'image/png' },
        { mediaId: IDS.gallery, source: 'blob:gallery', purpose: 'gallery', sortOrder: 0, isCover: true, mimeType: 'image/png' },
        { mediaId: IDS.block, source: 'blob:block', purpose: 'prompt_example', contextId: 'block-1', sortOrder: 0, isCover: false, mimeType: 'image/png' }
      ]
    });

    expect(prepared.pending.map(item => item.mediaId)).toEqual([IDS.icon, IDS.gallery, IDS.block]);
    expect(prepared.asset.icon).toMatchObject({ type: 'image', value: `media:${IDS.icon}`, mediaId: IDS.icon });
    expect(prepared.asset.previewImage).toBe(`media:${IDS.gallery}`);
    expect(prepared.asset.previewImages).toEqual([`media:${IDS.gallery}`]);
    expect(prepared.asset.contentBlocks?.[0]).toMatchObject({ body: `media:${IDS.block}`, mediaId: IDS.block });
    expect(prepared.asset.content).toBe(`Example media:${IDS.block}`);
    expect(prepared.asset.authorAvatar).toBeUndefined();
    expect(prepared.asset).not.toHaveProperty('workMediaDraft');
  });

  it('does not clear fields that are absent from a partial Work update', async () => {
    const prepared = await prepareGoogleWorkMedia({ title: 'Only title changed' });
    expect(prepared.asset).toEqual({ title: 'Only title changed' });
    expect(prepared.pending).toEqual([]);
  });

  it('preserves remote image URLs that do not have a canonical media identity', async () => {
    const remote = 'https://images.example.test/legacy.png';
    const prepared = await prepareGoogleWorkMedia({
      category: 'prompts', contentBlocks: [{ id: 'remote-example', type: 'Image', title: 'Remote example', body: remote }]
    });
    expect(prepared.asset.contentBlocks?.[0].body).toBe(remote);
    expect(prepared.pending).toEqual([]);
  });

  it('hydrates standard Work proxy media for reloads and maps hydrated sources back to canonical refs', async () => {
    const workId = 'asset_1234567890abcdef1234567890abcdef';
    const asset = {
      id: workId, userId: 'owner', title: 'Hydrated Work', authorName: 'Owner',
      icon: { type: 'image' as const, value: `media:${IDS.icon}`, mediaId: IDS.icon },
      category: 'prompts' as const, content: `Example media:${IDS.block}`,
      contentBlocks: [{ id: 'block-1', type: 'Image' as const, title: 'Example', body: `media:${IDS.block}`, mediaId: IDS.block }],
      previewImage: `media:${IDS.gallery}`, previewImages: [`media:${IDS.gallery}`], media: [
        { id: IDS.icon, assetId: workId, storagePath: `google-work-media/${IDS.icon}`, purpose: 'icon' as const,
          mimeType: 'image/png', fileSize: 8, sortOrder: 0, isCover: false, delivery: 'vercel_proxy' as const },
        { id: IDS.gallery, assetId: workId, storagePath: `google-work-media/${IDS.gallery}`, purpose: 'gallery' as const,
          mimeType: 'image/webp', fileSize: 8, sortOrder: 0, isCover: true, delivery: 'vercel_proxy' as const },
        { id: IDS.block, assetId: workId, storagePath: `google-work-media/${IDS.block}`, purpose: 'prompt_example' as const,
          contextId: 'block-1', mimeType: 'image/png', fileSize: 8, sortOrder: 0, isCover: false, delivery: 'vercel_proxy' as const }
      ],
      isPublic: false, visibility: 'private' as const, status: 'draft' as const, createdAt: '', updatedAt: '', tags: []
    };
    const hydrated = hydrateGoogleWorkMedia(asset);
    const iconUrl = hydrated.icon.type === 'image' ? hydrated.icon.value : '';
    const galleryUrl = hydrated.previewImages?.[0] || '';
    const blockUrl = hydrated.contentBlocks?.[0]?.body || '';
    expect(iconUrl).toContain('scope=owner');
    expect(iconUrl).toContain(`ref=media%3A${IDS.icon}`);
    expect(galleryUrl).toContain(`ref=media%3A${IDS.gallery}`);
    expect(hydrated.previewImage).toBe(galleryUrl);
    expect(blockUrl).toContain(`ref=media%3A${IDS.block}`);
    expect(asset.icon.value).toBe(`media:${IDS.icon}`);
    expect(asset.previewImage).toBe(`media:${IDS.gallery}`);

    const prepared = await prepareGoogleWorkMedia(hydrated);
    expect(prepared.asset.icon).toMatchObject({ value: `media:${IDS.icon}`, mediaId: IDS.icon });
    expect(prepared.asset.previewImages).toEqual([`media:${IDS.gallery}`]);
    expect(prepared.asset.previewImage).toBe(`media:${IDS.gallery}`);
    expect(prepared.asset.contentBlocks?.[0]).toMatchObject({ body: `media:${IDS.block}`, mediaId: IDS.block });
    expect(prepared.asset.content).toBe(`Example media:${IDS.block}`);
    expect(prepared.pending).toEqual([]);
  });

  it('serves non-proxy legacy media records through the unscoped legacy media route', () => {
    const workId = 'asset_1234567890abcdef1234567890abcdef';
    const asset = {
      id: workId, userId: 'owner', title: 'Legacy', authorName: 'Owner',
      icon: { type: 'image' as const, value: 'media:legacy-id', mediaId: 'legacy-id' },
      category: 'prompts' as const, content: '', contentBlocks: [], previewImage: 'media:legacy-id',
      previewImages: ['media:legacy-id'], media: [{ id: 'legacy-id', assetId: workId, storagePath: 'legacy/path',
        purpose: 'gallery' as const, mimeType: 'image/png', fileSize: 8, sortOrder: 0, isCover: true }],
      isPublic: true, visibility: 'public' as const, status: 'finished' as const, createdAt: '', updatedAt: '', tags: []
    };
    // Migrated media is read from Drive by the legacy route: no `scope`, never the Google Work proxy.
    const legacyUrl = `/api/cxl/media?workId=${workId}&ref=media%3Alegacy-id`;
    for (const input of [asset, { ...asset, category: 'collab' as const }]) {
      const hydrated = hydrateGoogleWorkMedia(input as typeof asset);
      expect(hydrated.previewImage).toBe(legacyUrl);
      expect(hydrated.previewImages).toEqual([legacyUrl]);
      expect(hydrated.icon.type === 'image' && hydrated.icon.value).toBe(legacyUrl);
      expect(hydrated.media).toEqual(asset.media);
    }
  });

  it('hydrates one Google media identity at every standard Work placement that references it', () => {
    const workId = 'asset_1234567890abcdef1234567890abcdef';
    const shared = IDS.icon;
    const asset = {
      id: workId, userId: 'owner', title: 'Shared media', authorName: 'Owner',
      icon: { type: 'image' as const, value: `media:${shared}`, mediaId: shared },
      category: 'prompts' as const, content: '',
      contentBlocks: [{ id: 'block-shared', type: 'Image' as const, title: 'Shared', body: `media:${shared}`, mediaId: shared }],
      previewImage: `media:${shared}`, previewImages: [`media:${shared}`],
      media: [{ id: shared, assetId: workId, storagePath: `google-work-media/${shared}`, purpose: 'icon' as const,
        mimeType: 'image/png', fileSize: 8, sortOrder: 0, isCover: false, delivery: 'vercel_proxy' as const }],
      isPublic: true, visibility: 'public' as const, status: 'finished' as const, createdAt: '', updatedAt: '', tags: []
    };

    const hydrated = hydrateGoogleWorkMedia(asset);

    expect(hydrated.icon.type === 'image' && hydrated.icon.value).toContain(`ref=media%3A${shared}`);
    expect(hydrated.previewImage).toBe(hydrated.previewImages?.[0]);
    expect(hydrated.contentBlocks?.[0].body).toContain(`ref=media%3A${shared}`);
  });

  it('does not prepare Collaboration media for the standard Work upload route', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const prepared = await prepareGoogleWorkMedia({
      category: 'collab', icon: { type: 'image', value: 'blob:collab', mediaId: IDS.icon },
      workMediaDraft: [{ mediaId: IDS.icon, source: 'blob:collab', purpose: 'icon', sortOrder: 0, isCover: false }]
    });
    expect(prepared.pending).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uploads chunks and files sequentially at the proven 2 MiB size', async () => {
    const calls: Array<{ action: string; args: unknown[] }> = [];
    let activeRequests = 0;
    let maxActiveRequests = 0;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, request: RequestInit) => {
      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      try {
        await Promise.resolve();
        const body = JSON.parse(String(request.body)) as { action: string; args: unknown[] };
        calls.push(body);
        const data = body.action === 'media.upload.begin'
          ? { uploadId: '123e4567-e89b-42d3-a456-426614174099', finalized: false }
          : { stored: true };
        return { ok: true, status: 200, json: async () => ({ ok: true, data }) } as Response;
      } finally {
        activeRequests -= 1;
      }
    }));

    const mediaId = '123e4567-e89b-42d3-a456-426614174010';
    const mediaIds = await uploadGoogleWorkMedia([{
      mediaId, source: 'blob:large', purpose: 'gallery', sortOrder: 0, isCover: true,
      blob: new Blob([new Uint8Array(GOOGLE_WORK_MEDIA_CHUNK_BYTES + 5)], { type: 'image/png' }),
      mimeType: 'image/png', fileSize: GOOGLE_WORK_MEDIA_CHUNK_BYTES + 5
    }], { workId: 'asset_1234567890abcdef1234567890abcdef' });

    expect(mediaIds).toEqual([mediaId]);
    expect(calls.map(item => item.action)).toEqual([
      'media.upload.begin', 'media.upload.chunk', 'media.upload.chunk', 'media.upload.finalize'
    ]);
    expect(maxActiveRequests).toBe(1);
    const firstChunk = calls[1].args[0] as { base64: string; chunkIndex: number };
    const lastChunk = calls[2].args[0] as { base64: string; chunkIndex: number };
    expect(firstChunk.chunkIndex).toBe(0);
    expect(firstChunk.base64.length).toBe(4 * Math.ceil(GOOGLE_WORK_MEDIA_CHUNK_BYTES / 3));
    expect(lastChunk).toMatchObject({ chunkIndex: 1, base64: 'AAAAAAA=' });
  });
});
