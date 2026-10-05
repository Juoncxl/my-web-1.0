import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Asset } from '../types';
import { prepareGoogleWorkMedia } from '../data/adapters/google/googleWorkMedia';
import { mediaReferenceMap, rejectUnsupportedWorkMedia } from '../server/cxlDirectWrite';
import { buildOptimizedWorkUpdate, optimizeWorkImages, planWorkImageOptimization } from './optimizeWorkImages';

const WORK = 'asset_0123456789abcdef0123456789abcdef';
const ID = {
  icon: '11111111-1111-4111-8111-111111111111',
  big: '22222222-2222-4222-8222-222222222222',
  small: '33333333-3333-4333-8333-333333333333',
  content: '44444444-4444-4444-8444-444444444444',
  gif: '55555555-5555-4555-8555-555555555555',
  newIcon: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  newBig: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  newContent: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
};
const url = (id: string) => `/api/cxl/media?scope=owner&workId=${WORK}&ref=media%3A${id}&v=1700000000000`;
const record = (id: string, purpose: 'icon' | 'gallery' | 'prompt_example', mimeType: string, fileSize: number) =>
  ({ id, assetId: WORK, storagePath: `google-work-media/${id}`, purpose, mimeType, fileSize, sortOrder: 0, isCover: false, delivery: 'vercel_proxy' as const });

function work(overrides: Partial<Asset> = {}): Asset {
  return {
    id: WORK, title: 'Work', category: 'character', content: '', userId: 'owner', authorName: 'Juon',
    icon: { type: 'image', value: url(ID.icon), mediaId: ID.icon },
    previewImages: [url(ID.big), url(ID.small), url(ID.gif)],
    previewImage: url(ID.big),
    contentBlocks: [
      { id: 'block-text', type: 'Text', title: 'Text', body: 'hello' },
      { id: 'block-image', type: 'Image', title: 'Image', body: url(ID.content), mediaId: ID.content }
    ],
    media: [
      record(ID.icon, 'icon', 'image/png', 900_000),
      record(ID.big, 'gallery', 'image/png', 2_500_000),
      record(ID.small, 'gallery', 'image/jpeg', 120_000),
      record(ID.content, 'prompt_example', 'image/jpeg', 1_200_000),
      record(ID.gif, 'gallery', 'image/gif', 2_000_000)
    ],
    isPublic: false, visibility: 'private', status: 'finished', tags: [], createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z', revision: 4, ...overrides
  } as Asset;
}

afterEach(() => vi.unstubAllGlobals());

describe('planWorkImageOptimization', () => {
  it('picks large stored PNG/JPEG/WebP images and skips small ones and GIFs', () => {
    expect(planWorkImageOptimization(work()).map(target => [target.kind, target.url])).toEqual([
      ['icon', url(ID.icon)], ['gallery', url(ID.big)], ['content', url(ID.content)]
    ]);
  });

  it('includes the own images of Collaboration Works and skips trashed Works', () => {
    expect(planWorkImageOptimization(work({ category: 'collab' } as Partial<Asset>))).toHaveLength(3);
    expect(planWorkImageOptimization(work({ deletedAt: '2026-01-02T00:00:00Z' }))).toEqual([]);
  });
});

describe('buildOptimizedWorkUpdate', () => {
  it('produces an update the Google save path turns into the new media refs', async () => {
    const replaced = new Map([
      [url(ID.icon), { newMediaId: ID.newIcon, source: 'blob:icon' }],
      [url(ID.big), { newMediaId: ID.newBig, source: 'blob:big' }],
      [url(ID.content), { newMediaId: ID.newContent, source: 'blob:content' }]
    ]);
    const { updates, mediaIds } = buildOptimizedWorkUpdate(work(), replaced);
    expect(mediaIds.sort()).toEqual([ID.newBig, ID.newContent, ID.newIcon].sort());

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }) })));
    const prepared = await prepareGoogleWorkMedia(updates);
    // purpose / sortOrder / isCover must match the server's placement map exactly.
    expect(prepared.pending.map(item => [item.mediaId, item.purpose, item.sortOrder, item.isCover, item.contextId ?? null]).sort()).toEqual([
      [ID.newBig, 'gallery', 0, true, null], [ID.newContent, 'prompt_example', 1, false, 'block-image'], [ID.newIcon, 'icon', 0, false, null]
    ].sort());
    expect(prepared.asset.icon).toMatchObject({ type: 'image', value: `media:${ID.newIcon}`, mediaId: ID.newIcon });
    expect(prepared.asset.previewImages).toEqual([`media:${ID.newBig}`, `media:${ID.small}`, `media:${ID.gif}`]);
    expect(prepared.asset.previewImage).toBe(`media:${ID.newBig}`);
    expect(prepared.asset.contentBlocks?.[0]).toEqual(work().contentBlocks?.[0]);
    expect(prepared.asset.contentBlocks?.[1]).toMatchObject({ body: `media:${ID.newContent}`, mediaId: ID.newContent });
    // The server's own checks accept the merged Work and see every upload where it was declared.
    const stored = { ...work(), icon: { type: 'image', value: `media:${ID.icon}`, mediaId: ID.icon },
      previewImages: [ID.big, ID.small, ID.gif].map(id => `media:${id}`), previewImage: `media:${ID.big}`,
      contentBlocks: [work().contentBlocks![0], { ...work().contentBlocks![1], body: `media:${ID.content}` }] };
    const merged = { ...stored, ...JSON.parse(JSON.stringify(prepared.asset)) };
    expect(() => rejectUnsupportedWorkMedia(merged, stored, mediaIds)).not.toThrow();
    const placements = mediaReferenceMap(merged);
    for (const item of prepared.pending) {
      expect(placements[item.mediaId].references.some(ref => ref.purpose === item.purpose && Number(ref.sortOrder) === item.sortOrder
        && Boolean(ref.isCover) === item.isCover && String(ref.contextId || '') === String(item.contextId || ''))).toBe(true);
    }
    // Only image fields travel; title, content and the rest of the Work are untouched.
    expect(Object.keys(JSON.parse(JSON.stringify(prepared.asset))).sort()).toEqual(['contentBlocks', 'icon', 'previewImage', 'previewImages']);
  });

  it('sends nothing for images that were not replaced', () => {
    const { updates, mediaIds } = buildOptimizedWorkUpdate(work(), new Map());
    expect(mediaIds).toEqual([]);
    expect(Object.keys(updates)).toEqual(['workMediaDraft']);
  });
});

describe('optimizeWorkImages', () => {
  const bigPng = () => new Blob([new Uint8Array(2_000_000)], { type: 'image/png' });

  it('uploads only images that shrink enough and saves with the current revision', async () => {
    const updateWork = vi.fn(async () => ({ error: null }));
    let next = 0;
    const result = await optimizeWorkImages(WORK, {
      fetchFullWork: async () => work(),
      updateWork,
      download: async source => source === url(ID.content) ? new Blob([new Uint8Array(400_000)], { type: 'image/jpeg' }) : bigPng(),
      // The content image barely shrinks, so it is kept as is.
      shrink: async blob => new Blob([new Uint8Array(blob.size > 1_000_000 ? 200_000 : 390_000)], { type: 'image/webp' }),
      newId: () => [ID.newIcon, ID.newBig, '99999999-9999-4999-8999-999999999999'][next++],
      toObjectUrl: () => `blob:${next}`,
      revokeObjectUrl: () => undefined
    });
    expect(result).toMatchObject({ optimized: 2, bytesBefore: 4_000_000, bytesAfter: 400_000 });
    expect(updateWork).toHaveBeenCalledTimes(1);
    const [, updates, options] = updateWork.mock.calls[0] as unknown as [string, Partial<Asset>, { expectedRevision: number }];
    expect(options.expectedRevision).toBe(4);
    expect(updates.contentBlocks).toBeUndefined();
    expect(updates.previewImages?.[0]).toMatch(/^blob:/);
  });

  it('does not save when nothing shrinks, and reports save failures', async () => {
    const untouched = vi.fn(async () => ({ error: null }));
    expect(await optimizeWorkImages(WORK, { fetchFullWork: async () => work(), updateWork: untouched, download: async () => bigPng(),
      shrink: async blob => blob, toObjectUrl: () => 'blob:x', revokeObjectUrl: () => undefined })).toMatchObject({ optimized: 0 });
    expect(untouched).not.toHaveBeenCalled();

    const failed = await optimizeWorkImages(WORK, { fetchFullWork: async () => work(), updateWork: async () => ({ error: 'Work revision is stale' }),
      download: async () => bigPng(), shrink: async () => new Blob([new Uint8Array(10)], { type: 'image/webp' }),
      newId: () => '99999999-9999-4999-8999-999999999999', toObjectUrl: () => 'blob:x', revokeObjectUrl: () => undefined });
    expect(failed).toMatchObject({ optimized: 0, error: 'Work revision is stale' });
  });

  it('skips an image that can no longer be downloaded instead of failing the Work', async () => {
    const updateWork = vi.fn(async () => ({ error: null }));
    let next = 0;
    const result = await optimizeWorkImages(WORK, {
      fetchFullWork: async () => work(),
      updateWork,
      download: async source => { if (source === url(ID.icon)) throw new Error('โหลดรูปไม่สำเร็จ (404)'); return bigPng(); },
      shrink: async () => new Blob([new Uint8Array(10)], { type: 'image/webp' }),
      newId: () => ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', '99999999-9999-4999-8999-999999999999'][next++],
      toObjectUrl: () => `blob:${next}`, revokeObjectUrl: () => undefined
    });
    expect(result).toMatchObject({ optimized: 2, skipped: 1 });
    expect(result.error).toBeUndefined();
    expect((updateWork.mock.calls[0] as unknown as [string, Partial<Asset>])[1].icon).toBeUndefined();
  });
});
