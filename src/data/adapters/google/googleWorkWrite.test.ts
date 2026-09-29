import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Asset } from '../../../types';
import { googleDataAdapter } from './googleDataAdapter';
import { toGoogleWorkUpdateRequest } from './googleWorkWrite';
import { callGoogleBackend } from './googleTransport';

vi.mock('./googleTransport', () => ({
  callGoogleBackend: vi.fn(async () => ({ data: { id: 'asset_work' }, error: null }))
}));

const hydratedAsset = {
  id: 'asset_work', userId: 'private-owner-key', revision: 7,
  publicCreatorId: 'cxlc_0123456789abcdef0123456789abcdef', qaStorageKey: 'qa-payload-key',
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z',
  authorName: 'Juon', title: 'Edited title', icon: { type: 'emoji', value: '✨' },
  category: 'character', shortDescription: 'Short description', contentTypeLabels: ['Character'],
  contentTypes: ['character'], presentationMetadata: { appPlatforms: ['CXL'] },
  publicCollaboration: null, collaborationAssetId: null, contentBlocks: [{ id: 'b1', type: 'Text', title: 'Body', body: 'Text' }],
  content: 'Updated content', uiCodeSnippet: 'console.log(1)', previewImage: 'media:icon-1', previewImages: ['media:gallery-1'],
  folderId: 'folder-1', isPublic: false, visibility: 'private', status: 'draft', tags: ['tag'],
  linkedAssetIds: [], deletedAt: null, likesCount: 2, forkCount: 1, forkedFromId: null, forkedFromAuthor: null,
  versions: [], media: [], collaboration: null
} as unknown as Asset;

const canonicalMediaAsset = {
  ...hydratedAsset,
  id: 'asset_media_work',
  icon: { type: 'image', value: 'media:google-icon', mediaId: 'google-icon', mimeType: 'image/gif' },
  previewImage: 'media:google-cover',
  previewImages: ['media:google-cover'],
  contentBlocks: [{ id: 'example-1', type: 'Image', title: 'Example', body: 'media:google-example', mediaId: 'google-example' }],
  media: [
    { id: 'google-icon', assetId: 'asset_media_work', purpose: 'icon', delivery: 'vercel_proxy', mimeType: 'image/gif', sortOrder: 0, isCover: false },
    { id: 'google-cover', assetId: 'asset_media_work', purpose: 'gallery', delivery: 'vercel_proxy', mimeType: 'image/png', sortOrder: 0, isCover: true },
    { id: 'google-example', assetId: 'asset_media_work', purpose: 'prompt_example', contextId: 'example-1', delivery: 'vercel_proxy', mimeType: 'image/jpeg', sortOrder: 0, isCover: false }
  ],
  isPublic: false,
  visibility: 'private'
} as unknown as Asset;

function expectGoogleMediaHydrated(asset: Asset | null) {
  expect(asset?.icon).toMatchObject({ type: 'image', value: expect.stringContaining('/api/cxl/media?scope=owner') });
  expect(asset?.previewImage).toContain('/api/cxl/media?scope=owner');
  expect(asset?.previewImages?.[0]).toContain('/api/cxl/media?scope=owner');
  expect(asset?.contentBlocks?.[0].body).toContain('/api/cxl/media?scope=owner');
}

describe('Google Work update write DTO', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('converts a full hydrated Asset to writable fields and keeps id/revision in their dedicated arguments', () => {
    const options = { requestId: '123e4567-e89b-42d3-a456-426614174000' };
    const [id, updates, writeOptions] = toGoogleWorkUpdateRequest(hydratedAsset.id, hydratedAsset, options);

    expect(id).toBe('asset_work');
    expect(writeOptions).toEqual({ ...options, expectedRevision: 7 });
    expect(updates).toMatchObject({
      title: 'Edited title', category: 'character', shortDescription: 'Short description',
      contentTypeLabels: ['Character'], contentTypes: ['character'], presentationMetadata: { appPlatforms: ['CXL'] },
      content: 'Updated content', contentBlocks: hydratedAsset.contentBlocks, uiCodeSnippet: 'console.log(1)',
      previewImage: 'media:icon-1', previewImages: ['media:gallery-1'], folderId: 'folder-1',
      isPublic: false, visibility: 'private', status: 'draft', tags: ['tag']
    });
    for (const key of ['id', 'userId', 'revision', 'publicCreatorId', 'qaStorageKey', 'createdAt', 'updatedAt']) {
      expect(updates).not.toHaveProperty(key);
    }
    expect(hydratedAsset).toMatchObject({ id: 'asset_work', userId: 'private-owner-key', revision: 7, qaStorageKey: 'qa-payload-key' });
  });

  it('uses the adapter DTO at the actual works.update transport boundary', async () => {
    const transport = vi.mocked(callGoogleBackend);
    transport.mockClear();
    await googleDataAdapter.works.update('asset_work', hydratedAsset, {
      requestId: '123e4567-e89b-42d3-a456-426614174000', expectedRevision: 8
    });

    expect(transport).toHaveBeenCalledWith('works.update', [
      'asset_work', expect.not.objectContaining({ id: expect.anything(), userId: expect.anything(), revision: expect.anything() }),
      { requestId: '123e4567-e89b-42d3-a456-426614174000', expectedRevision: 8 }
    ]);
    const [, args] = transport.mock.calls[0];
    expect(args[1]).toMatchObject({ title: 'Edited title', content: 'Updated content', folderId: 'folder-1' });
    expect(args[1]).not.toHaveProperty('publicCreatorId');
  });

  it('preserves media and private collaboration fields for the existing server-side deferred-mutation guards', () => {
    const media = [{ id: 'media-1', src: 'media:media-1' }];
    const collaboration = { name: 'Private draft', participants: [] };
    const [, updates] = toGoogleWorkUpdateRequest('asset_work', { media, collaboration } as unknown as Partial<Asset>, {
      requestId: '123e4567-e89b-42d3-a456-426614174000', expectedRevision: 1
    });

    expect(updates).toMatchObject({ media, collaboration });
  });

  it('leaves create payloads unchanged', async () => {
    const transport = vi.mocked(callGoogleBackend);
    transport.mockClear();
    const create = { title: 'New Work', userId: 'private-owner-key', category: 'character' } as any;
    const options = { requestId: '123e4567-e89b-42d3-a456-426614174000' };

    await googleDataAdapter.works.create(create, options);

    expect(transport).toHaveBeenCalledWith('works.create', [create, options]);
  });

  it('hydrates canonical media refs in a create response before returning it to client state', async () => {
    const transport = vi.mocked(callGoogleBackend);
    transport.mockClear();
    transport.mockResolvedValueOnce({ data: canonicalMediaAsset, error: null } as any);
    const requestId = '123e4567-e89b-42d3-a456-426614174000';

    const result = await googleDataAdapter.works.create(canonicalMediaAsset as any, { requestId });

    expectGoogleMediaHydrated(result.data);
    expect(transport).toHaveBeenCalledWith('works.create', [expect.objectContaining({
      icon: expect.objectContaining({ value: 'media:google-icon' }),
      previewImage: 'media:google-cover',
      contentBlocks: [expect.objectContaining({ body: 'media:google-example' })]
    }), { requestId }]);
  });

  it('hydrates canonical media refs in an update response before returning it to client state', async () => {
    const transport = vi.mocked(callGoogleBackend);
    transport.mockClear();
    transport.mockResolvedValueOnce({ data: canonicalMediaAsset, error: null } as any);

    const result = await googleDataAdapter.works.update('asset_media_work', canonicalMediaAsset, {
      requestId: '123e4567-e89b-42d3-a456-426614174000', expectedRevision: 8
    });

    expectGoogleMediaHydrated(result.data);
    expect(transport.mock.calls[0][0]).toBe('works.update');
    expect(transport.mock.calls[0][1][1]).toMatchObject({
      icon: expect.objectContaining({ value: 'media:google-icon' }),
      previewImage: 'media:google-cover',
      contentBlocks: [expect.objectContaining({ body: 'media:google-example' })]
    });
  });

  it('uploads local media with its independent mediaId before committing a create with the same requestId', async () => {
    const transport = vi.mocked(callGoogleBackend);
    transport.mockClear();
    transport.mockImplementation(async (action: string) => (action === 'media.upload.begin'
      ? { uploadId: '123e4567-e89b-42d3-a456-426614174099', finalized: false }
      : { data: { id: 'asset_created' }, error: null }) as any);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' }) })));
    const mediaId = '123e4567-e89b-42d3-a456-426614174010';
    const requestId = '123e4567-e89b-42d3-a456-426614174000';

    await googleDataAdapter.works.create({
      title: 'New Work', category: 'character',
      icon: { type: 'image', value: 'blob:icon', mediaId, mimeType: 'image/png' },
      workMediaDraft: [{ mediaId, source: 'blob:icon', purpose: 'icon', sortOrder: 0, isCover: false, mimeType: 'image/png' }]
    } as any, { requestId });

    expect(transport.mock.calls.map(([action]) => action)).toEqual([
      'media.upload.begin', 'media.upload.chunk', 'media.upload.finalize', 'works.create'
    ]);
    expect(transport.mock.calls[0][1][0]).toMatchObject({ mediaId, workId: `asset_${requestId.replace(/-/g, '')}` });
    expect(transport.mock.calls[0][1][0]).not.toMatchObject({ mediaId: requestId });
    expect(transport.mock.calls[3][1][1]).toEqual({ requestId, mediaIds: [mediaId] });
    expect(transport.mock.calls[3][1][0]).toMatchObject({ icon: { value: `media:${mediaId}` } });
  });
});
