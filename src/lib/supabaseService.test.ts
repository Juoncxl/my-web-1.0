import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSupabaseClientMock } = vi.hoisted(() => ({
  getSupabaseClientMock: vi.fn()
}));

vi.mock('./supabaseClient', () => ({
  getSupabaseClient: getSupabaseClientMock
}));

import { supabaseService } from './supabaseService';

function authenticatedClient(from: ReturnType<typeof vi.fn>) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
        error: null
      })
    },
    from
  };
}

beforeEach(() => {
  getSupabaseClientMock.mockReset();
});

describe('social persistence', () => {
  it('uses an idempotent database upsert for Bookmark state', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    getSupabaseClientMock.mockReturnValue(authenticatedClient(from));

    const result = await supabaseService.setBookmark('user-1', 'asset-1', true);

    expect(result).toEqual({ success: true, isBookmarked: true, error: null });
    expect(from).toHaveBeenCalledWith('bookmarks');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', asset_id: 'asset-1' }),
      { onConflict: 'user_id,asset_id', ignoreDuplicates: true }
    );
  });

  it('removes a Bookmark using both authenticated owner and asset keys', async () => {
    const deleteQuery: any = {};
    deleteQuery.delete = vi.fn(() => deleteQuery);
    deleteQuery.eq = vi.fn()
      .mockReturnValueOnce(deleteQuery)
      .mockResolvedValueOnce({ error: null });
    const from = vi.fn().mockReturnValue(deleteQuery);
    getSupabaseClientMock.mockReturnValue(authenticatedClient(from));

    const result = await supabaseService.setBookmark('user-1', 'asset-1', false);

    expect(result).toEqual({ success: true, isBookmarked: false, error: null });
    expect(deleteQuery.eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-1');
    expect(deleteQuery.eq).toHaveBeenNthCalledWith(2, 'asset_id', 'asset-1');
  });

  it('cannot create duplicate relational Likes for the same user and asset', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const countQuery: any = {
      select: vi.fn(() => countQuery),
      eq: vi.fn(() => countQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: { likes_count: 8 }, error: null })
    };
    const from = vi.fn((table: string) => table === 'asset_likes' ? { upsert } : countQuery);
    getSupabaseClientMock.mockReturnValue(authenticatedClient(from));

    const first = await supabaseService.setAssetLike('user-1', 'asset-1', true);
    const second = await supabaseService.setAssetLike('user-1', 'asset-1', true);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenLastCalledWith(
      { user_id: 'user-1', asset_id: 'asset-1' },
      { onConflict: 'user_id,asset_id', ignoreDuplicates: true }
    );
  });
});

describe('ownership-sensitive writes', () => {
  it('adds the authenticated owner ID to a soft-delete query', async () => {
    const query: any = {
      update: vi.fn(() => query),
      eq: vi.fn(() => query),
      is: vi.fn(() => query),
      select: vi.fn(() => query),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'asset-1' }, error: null })
    };
    const from = vi.fn().mockReturnValue(query);
    getSupabaseClientMock.mockReturnValue(authenticatedClient(from));

    const result = await supabaseService.softDeleteAsset('asset-1');

    expect(result.success).toBe(true);
    expect(query.eq).toHaveBeenCalledWith('id', 'asset-1');
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('rejects cloud writes when there is no authenticated session', async () => {
    const from = vi.fn();
    getSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null })
      },
      from
    });

    const result = await supabaseService.setBookmark('user-1', 'asset-1', true);

    expect(result.success).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it('does not report a permanent deletion as successful when no owned row exists', async () => {
    const query: any = {
      delete: vi.fn(() => query),
      eq: vi.fn(() => query),
      not: vi.fn(() => query),
      select: vi.fn(() => query),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
    };
    const from = vi.fn().mockReturnValue(query);
    getSupabaseClientMock.mockReturnValue(authenticatedClient(from));

    const result = await supabaseService.permanentDeleteAsset('missing-asset');

    expect(result.success).toBe(false);
    expect(result.error).toContain('ไม่พบผลงานของคุณ');
  });
});
