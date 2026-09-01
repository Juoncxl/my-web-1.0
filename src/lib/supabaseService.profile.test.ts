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

import { readMockProfile, resetCreatorSandbox, writeMockProfile } from './creatorPersistence';
import { supabaseService } from './supabaseService';

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
      avatarUrl: 'data:image/png;base64,avatar',
      coverUrl: 'data:image/png;base64,cover'
    });
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
});
