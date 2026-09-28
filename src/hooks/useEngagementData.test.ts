import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  vercelOwner: true,
  effects: [] as Array<() => void>,
  setters: [] as Array<ReturnType<typeof vi.fn>>,
  fetchBookmarks: vi.fn(), fetchLikedWorkIds: vi.fn(), setBookmark: vi.fn(), setWorkLike: vi.fn()
}));

vi.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void) => { harness.effects.push(effect); },
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => {
    const setter = vi.fn();
    harness.setters.push(setter);
    return [initial, setter];
  }
}));

vi.mock('../data/cxlDataService', () => ({ cxlDataService: { engagement: {
  fetchBookmarks: harness.fetchBookmarks,
  fetchLikedWorkIds: harness.fetchLikedWorkIds,
  setBookmark: harness.setBookmark,
  setWorkLike: harness.setWorkLike
} } }));

vi.mock('../lib/auth/ownerAuthBackend', () => ({ get isVercelOwnerAuth() { return harness.vercelOwner; } }));

import { useEngagementData } from './useEngagementData';

function boot(userId: string | undefined, reportError = vi.fn()) {
  const hook = useEngagementData(userId, reportError);
  for (const effect of harness.effects) effect();
  return { hook, reportError };
}

describe('engagement reads in Vercel Owner auth mode', () => {
  beforeEach(() => {
    harness.effects.length = 0;
    harness.setters.length = 0;
    harness.vercelOwner = true;
    harness.fetchBookmarks.mockReset().mockResolvedValue({ data: [], error: null });
    harness.fetchLikedWorkIds.mockReset().mockResolvedValue({ data: [], error: null });
    harness.setBookmark.mockReset().mockResolvedValue({ success: true, isBookmarked: true });
    harness.setWorkLike.mockReset().mockResolvedValue({ success: true, isLiked: true, likesCount: 1 });
  });

  it('skips unsupported automatic reads on Owner boot without reporting a global error', () => {
    const { reportError, hook } = boot('owner-1');
    expect(hook.bookmarkedAssetIds).toEqual([]);
    expect(hook.likedAssetIds).toEqual([]);
    expect(harness.fetchBookmarks).not.toHaveBeenCalled();
    expect(harness.fetchLikedWorkIds).not.toHaveBeenCalled();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('keeps anonymous boot quiet and does not fetch engagement', () => {
    const { reportError } = boot(undefined);
    expect(harness.fetchBookmarks).not.toHaveBeenCalled();
    expect(harness.fetchLikedWorkIds).not.toHaveBeenCalled();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('does not mutate empty state when an unsupported toggle is attempted', async () => {
    const { hook, reportError } = boot('owner-1');
    await expect(hook.toggleBookmark('work-1')).resolves.toMatchObject({ success: false });
    await expect(hook.toggleLike('work-1')).resolves.toMatchObject({ success: false });
    expect(harness.setBookmark).not.toHaveBeenCalled();
    expect(harness.setWorkLike).not.toHaveBeenCalled();
    expect(harness.setters.every(setter => !setter.mock.calls.length)).toBe(true);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('still reports genuine failures when engagement reads are supported', async () => {
    harness.vercelOwner = false;
    harness.fetchBookmarks.mockResolvedValue({ data: [], error: 'bookmark backend failed' });
    harness.fetchLikedWorkIds.mockResolvedValue({ data: [], error: 'like backend failed' });
    const { reportError } = boot('user-1');
    await Promise.resolve();
    await Promise.resolve();
    expect(reportError).toHaveBeenCalledWith('bookmark backend failed');
    expect(reportError).toHaveBeenCalledWith('like backend failed');
  });
});

