import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';

vi.mock('./persistenceMode', () => ({
  isMockPersistence: true,
  persistenceMode: 'mock',
  persistenceModeLabel: 'QA Sandbox · Local only'
}));

vi.mock('./supabaseClient', () => ({
  getSupabaseClient: () => null
}));

import { resetCreatorSandbox, writeMockProfile } from './creatorPersistence';
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
    expect(writeMockProfile(profile)).toBe(true);

    const result = await supabaseService.getCreatorProfile('JUONCXL');

    expect(result).toEqual({ data: profile, error: null, reason: null });
  });

  it('does not accept a canonical username update when QA storage cannot persist it', async () => {
    (globalThis as { window: Window }).window = {
      localStorage: {
        getItem: () => null,
        setItem: () => { throw new Error('quota exceeded'); }
      } as unknown as Storage,
      dispatchEvent: () => true
    } as unknown as Window;

    const result = await supabaseService.upsertProfile(makeProfile());

    expect(result.success).toBe(false);
    expect(result.error).toContain('QA Sandbox');
  });
});
