import { afterEach, describe, expect, it, vi } from 'vitest';
import { compareWorksRead } from './googleWorksShadow';
import { supabaseDataAdapter } from './adapters/supabase/supabaseDataAdapter';
import { googleDataAdapter } from './adapters/google/googleDataAdapter';
import type { Asset } from '../types';

const asset = { id: 'a1', title: 'Title', status: 'draft', visibility: 'private', folderId: 'f1',
  publicCollaboration: null, previewImage: 'media:m1', previewImages: ['media:m1'], icon: { type: 'emoji', value: '✨' },
  media: [{ id: 'm1', purpose: 'gallery', contextId: null, sortOrder: 0, isCover: true, storagePath: 'backend-specific-path' }],
  content: 'body', contentBlocks: [], presentationMetadata: { type: 'character' }, linkedAssetIds: [], versions: [], futureField: 'kept' } as unknown as Asset;

describe('Works read shadow comparison', () => {
  afterEach(() => vi.restoreAllMocks());

  it('compares read-only parity fields and normalizes backend-specific media paths', async () => {
    vi.spyOn(supabaseDataAdapter.works, 'fetch').mockResolvedValue({ data: [asset], error: null } as any);
    vi.spyOn(googleDataAdapter.works, 'fetch').mockResolvedValue({ data: [{ ...asset, media: [{ ...asset.media![0], storagePath: 'drive-file-id' }] }], error: null } as any);
    await expect(compareWorksRead()).resolves.toMatchObject({ supabaseCount: 1, googleCount: 1, equal: true, differences: [] });
  });

  it('reports ordering and content differences instead of ignoring them', async () => {
    vi.spyOn(supabaseDataAdapter.works, 'fetch').mockResolvedValue({ data: [asset], error: null } as any);
    vi.spyOn(googleDataAdapter.works, 'fetch').mockResolvedValue({ data: [{ ...asset, content: 'different' }], error: null } as any);
    const result = await compareWorksRead();
    expect(result.equal).toBe(false);
    expect(result.differences.some(item => item.field === 'content')).toBe(true);
  });
  it('reports unknown CXL fields instead of dropping them from comparison', async () => {
    vi.spyOn(supabaseDataAdapter.works, 'fetch').mockResolvedValue({ data: [asset], error: null } as any);
    const { futureField: _dropped, ...different } = asset as Asset & { futureField: string };
    vi.spyOn(googleDataAdapter.works, 'fetch').mockResolvedValue({ data: [different as Asset], error: null } as any);
    const result = await compareWorksRead();
    expect(result.differences.some(item => item.field === 'unknownFields')).toBe(true);
  });
});
