import { describe, expect, it, vi } from 'vitest';
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

describe('Google Work update write DTO', () => {
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
});
