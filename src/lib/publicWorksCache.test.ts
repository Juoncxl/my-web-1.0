import { afterEach, describe, expect, it, vi } from 'vitest';
import { rebuildPublicSnapshotAndWarm, warmAfterPublicWorkMutation } from './publicWorksCache';

describe('public Works cache warming', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('warms once after a successful snapshot rebuild', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const result = await rebuildPublicSnapshotAndWarm(async () => ({ works: 3 }));

    expect(result).toEqual({ works: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/cxl/public-works', expect.objectContaining({
      method: 'GET', credentials: 'omit',
      headers: { Accept: 'application/json', Pragma: 'no-cache' }
    }));
  });

  it('does not warm after a failed snapshot rebuild', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(rebuildPublicSnapshotAndWarm(async () => { throw new Error('rebuild failed'); }))
      .rejects.toThrow('rebuild failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['public create', 'works.create', { visibility: 'public', isPublic: true }, undefined],
    ['public update', 'works.update', { visibility: 'public', isPublic: true }, { title: 'Updated' }],
    ['private to public', 'works.update', { visibility: 'public', isPublic: true }, { visibility: 'public', isPublic: true }],
    ['public to private', 'works.update', { visibility: 'private', isPublic: false }, { visibility: 'private', isPublic: false }]
  ] as const)('%s warms once after success', (_name, action, data, updates) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    warmAfterPublicWorkMutation(action, { data, error: null }, updates);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not warm after failed or private-only mutations', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    warmAfterPublicWorkMutation('works.create', { data: null, error: 'failed' });
    warmAfterPublicWorkMutation('works.update', {
      data: { visibility: 'private', isPublic: false }, error: null
    }, { title: 'Private edit' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps rebuild and mutation success when warming rejects', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network unavailable'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(rebuildPublicSnapshotAndWarm(async () => 'rebuilt')).resolves.toBe('rebuilt');
    expect(() => warmAfterPublicWorkMutation('works.create', {
      data: { visibility: 'public', isPublic: true }, error: null
    })).not.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

