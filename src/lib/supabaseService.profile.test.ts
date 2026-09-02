import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';

const supabaseClientMocks = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(() => null)
}));

vi.mock('./persistenceMode', () => ({
  isMockPersistence: true,
  persistenceMode: 'mock',
  persistenceModeLabel: 'QA Sandbox · Local only'
}));

vi.mock('./supabaseClient', () => ({
  getSupabaseClient: supabaseClientMocks.getSupabaseClient
}));

import type { Asset, Folder } from '../types';
import {
  cacheMockProfileSnapshot,
  readMockProfile,
  resetCreatorSandbox,
  writeMockAsset,
  writeMockFolder,
  writeMockProfile
} from './creatorPersistence';
import { supabaseService } from './supabaseService';
import { deleteQaProfileImage } from './qaProfileImageStore';

function makeProfile(overrides: Partial<User> = {}): User {
  return {
    id: 'owner-uuid',
    email: 'owner@example.com',
    displayName: 'Owner',
    username: 'juoncxl',
    bio: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    provider: 'email',
    ...overrides
  };
}

describe('Profile identity service in the QA persistence boundary', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    supabaseClientMocks.getSupabaseClient.mockClear();
    (globalThis as { window: Window }).window = {
      localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => { storage.set(key, value); },
        removeItem: key => { storage.delete(key); },
        clear: () => storage.clear(),
        key: index => [...storage.keys()][index] ?? null,
        length: storage.size
      } as Storage,
      dispatchEvent: () => true
    } as unknown as Window;
    resetCreatorSandbox();
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    storage.clear();
    resetCreatorSandbox();
  });

  it('resolves a visitor route by canonical username without owner-session input', async () => {
    const profile = makeProfile();
    expect(writeMockProfile(profile).success).toBe(true);

    const result = await supabaseService.getCreatorProfile('JUONCXL');

    expect(result).toEqual({ data: profile, error: null, reason: null });
  });

  it('does not accept a canonical username update when QA storage cannot persist it', async () => {
    (globalThis as { window: Window }).window = {
      localStorage: {
        getItem: () => null,
        setItem: () => { throw new Error('quota exceeded'); }
      } as unknown as Storage,
      sessionStorage: {
        getItem: () => null,
        setItem: () => { throw new Error('session storage unavailable'); }
      } as unknown as Storage,
      dispatchEvent: () => true
    } as unknown as Window;

    const result = await supabaseService.upsertProfile(makeProfile());

    expect(result.success).toBe(false);
    expect(result.error).toContain('พื้นที่จัดเก็บ');
    expect(supabaseClientMocks.getSupabaseClient).not.toHaveBeenCalled();
  });

  it('saves a complete QA Profile through the local adapter without constructing a Supabase client', async () => {
    const result = await supabaseService.upsertProfile(makeProfile({
      displayName: 'Juon CXL',
      bio: 'Local creator bio',
      avatarUrl: 'data:image/png;base64,avatar',
      coverUrl: 'data:image/png;base64,cover',
      socialLinks: [{ platform: 'website', label: 'Website', url: 'https://example.com', visible: true }]
    }));

    expect(result).toEqual({ success: true, error: null });
    expect(supabaseClientMocks.getSupabaseClient).not.toHaveBeenCalled();
    expect(readMockProfile('owner-uuid', null)).toMatchObject({
      displayName: 'Juon CXL',
      username: 'juoncxl',
      bio: 'Local creator bio',
      avatarUrl: undefined,
      coverUrl: undefined
    });
    expect([...storage.values()].some(value => value.includes('base64,avatar') || value.includes('base64,cover'))).toBe(false);
  });

  it('stores a valid QA image through the local adapter without calling Supabase', async () => {
    const file = new File([new Uint8Array(3_300_000)], 'avatar.png', { type: 'image/png' });
    const result = await supabaseService.uploadProfileImage('owner-uuid', file, 'avatar');

    expect(result.error).toBeNull();
    expect(result.imageKey).toBe('owner-uuid:avatar');
    expect(result.data).toMatch(/^blob:/);
    expect(supabaseClientMocks.getSupabaseClient).not.toHaveBeenCalled();
    await deleteQaProfileImage({ ownerId: 'owner-uuid', kind: 'avatar' });
  });

  it('persists only the QA image key while retaining canonical Profile identity', async () => {
    const result = await supabaseService.upsertProfile(makeProfile({
      username: 'JuonCXL',
      avatarUrl: 'blob:owner-avatar',
      avatarImageKey: 'owner-uuid:avatar'
    }));

    expect(result).toEqual({ success: true, error: null });
    expect(readMockProfile('owner-uuid', null)).toMatchObject({
      username: 'juoncxl',
      avatarImageKey: 'owner-uuid:avatar',
      avatarUrl: undefined
    });
    expect([...storage.values()].some(value => value.includes('blob:owner-avatar'))).toBe(false);
  });

  it('returns an immediate Profile snapshot only for the matching owner ID', () => {
    const profile = makeProfile({ displayName: 'Juon', avatarUrl: 'data:image/png;base64,avatar' });
    expect(writeMockProfile(profile).success).toBe(true);

    expect(supabaseService.getProfileSnapshot('owner-uuid')).toEqual(profile);
    expect(supabaseService.getProfileSnapshot('different-owner')).toBeNull();
    expect(supabaseClientMocks.getSupabaseClient).not.toHaveBeenCalled();
  });

  it('resolves an existing QA Profile without waiting for or constructing Supabase', async () => {
    const profile = makeProfile({ displayName: 'Juon', username: 'juoncxl' });
    expect(writeMockProfile(profile).success).toBe(true);

    const result = await supabaseService.getProfile('owner-uuid');

    expect(result).toEqual(profile);
    expect(supabaseClientMocks.getSupabaseClient).not.toHaveBeenCalled();
  });

  it('keeps the first verified Profile snapshot without overwriting an explicit QA Profile', () => {
    const verified = makeProfile({ displayName: 'Juon', username: 'juoncxl' });
    expect(cacheMockProfileSnapshot(verified)).toBe(true);
    expect(cacheMockProfileSnapshot(makeProfile({ displayName: 'Stale remote value' }))).toBe(false);
    expect(readMockProfile('owner-uuid', null)).toEqual(verified);

    expect(writeMockProfile(makeProfile({ displayName: 'Explicit local edit', username: 'local-owner' })).success).toBe(true);
    expect(cacheMockProfileSnapshot(verified)).toBe(false);
    expect(readMockProfile('owner-uuid', null)).toMatchObject({ displayName: 'Explicit local edit', username: 'local-owner' });
  });

  it('reads QA Works and Folders strictly from local storage without constructing Supabase', async () => {
    const now = '2026-01-01T00:00:00.000Z';
    const asset: Asset = {
      id: 'asset-1', userId: 'owner-uuid', authorName: 'Juon', title: 'Local work',
      icon: { type: 'emoji', value: '🧪' }, category: 'lore', content: '', uiCodeSnippet: '',
      previewImage: '', previewImages: [], folderId: null, isPublic: false, visibility: 'private',
      status: 'finished', deletedAt: null, createdAt: now, updatedAt: now, likesCount: 0,
      forkCount: 0, forkedFromId: null, forkedFromAuthor: null, linkedAssetIds: [], versions: [], tags: []
    };
    const folder: Folder = {
      id: 'folder-1', userId: 'owner-uuid', name: 'Local folder', icon: '📁', color: 'purple',
      createdAt: now, updatedAt: now
    };
    writeMockAsset(asset);
    writeMockFolder(folder);
    supabaseClientMocks.getSupabaseClient.mockClear();

    await expect(supabaseService.fetchAssets({ currentUserId: 'owner-uuid', includeDeleted: true }))
      .resolves.toEqual({ data: [asset], error: null });
    await expect(supabaseService.fetchFolders('owner-uuid'))
      .resolves.toEqual({ data: [folder], error: null });
    expect(supabaseClientMocks.getSupabaseClient).not.toHaveBeenCalled();
  });

  it('persists a GIF Work Icon outside localStorage and rehydrates it through the Edit Work save path', async () => {
    const now = '2026-01-01T00:00:00.000Z';
    const work: Asset = {
      id: 'gif-work', userId: 'owner-uuid', authorName: 'Juon', title: 'GIF work',
      icon: { type: 'emoji', value: '✨' }, category: 'lore', content: '', uiCodeSnippet: '',
      previewImage: '', previewImages: [], folderId: null, isPublic: false, visibility: 'private',
      status: 'finished', deletedAt: null, createdAt: now, updatedAt: now, likesCount: 0,
      forkCount: 0, forkedFromId: null, forkedFromAuthor: null, linkedAssetIds: [], versions: [], tags: []
    };
    writeMockAsset(work);
    supabaseClientMocks.getSupabaseClient.mockReturnValue({
      auth: { getSession: async () => ({ data: { session: { user: { id: 'owner-uuid' } } } }) }
    });
    const gifDataUrl = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

    const saved = await supabaseService.updateAsset(work.id, {
      icon: { type: 'image', value: gifDataUrl, mimeType: 'image/gif' }
    });

    expect(saved.error).toBeNull();
    expect(saved.data?.icon).toMatchObject({ type: 'image', storageKey: expect.stringMatching(/^work-icon:/), mimeType: 'image/gif' });
    expect(saved.data?.icon.value).toMatch(/^blob:/);
    expect([...storage.values()].some(value => value.includes(gifDataUrl))).toBe(false);

    const reloaded = await supabaseService.fetchAssets({ currentUserId: 'owner-uuid', includeDeleted: true });
    expect(reloaded.error).toBeNull();
    expect(reloaded.data[0].icon).toMatchObject({
      type: 'image', storageKey: saved.data?.icon.storageKey, mimeType: 'image/gif'
    });
    expect(reloaded.data[0].icon.value).toMatch(/^blob:/);
  });

  it('resolves zero local Works as a completed empty result without a cloud fallback', async () => {
    await expect(supabaseService.fetchAssets({ currentUserId: 'owner-uuid', includeDeleted: true }))
      .resolves.toEqual({ data: [], error: null });
    expect(supabaseClientMocks.getSupabaseClient).not.toHaveBeenCalled();
  });
});
