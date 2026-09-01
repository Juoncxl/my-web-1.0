import { afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';
import { readMockProfile, resetCreatorSandbox, writeCreatorSpaceSettings, writeMockAsset, writeMockProfile } from './creatorPersistence';

describe('creator persistence event boundaries', () => {
  const storage = new Map<string, string>();
  const dispatched: Event[] = [];

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    storage.clear();
    dispatched.length = 0;
    resetCreatorSandbox();
  });

  it('does not refresh profile/data listeners when saving local layout settings', () => {
    (globalThis as { window: Window }).window = {
      localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => { storage.set(key, value); },
        removeItem: key => { storage.delete(key); },
        clear: () => storage.clear(),
        key: index => [...storage.keys()][index] ?? null,
        length: storage.size
      } as Storage,
      dispatchEvent: event => { dispatched.push(event); return true; }
    } as unknown as Window;

    writeCreatorSpaceSettings('owner-1', { layout: 'locked', lockedPreset: 'left' });

    expect(dispatched).toHaveLength(0);
  });

  it('still notifies data listeners for asset writes', () => {
    (globalThis as { window: Window }).window = {
      localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => { storage.set(key, value); },
        removeItem: key => { storage.delete(key); },
        clear: () => storage.clear(),
        key: index => [...storage.keys()][index] ?? null,
        length: storage.size
      } as Storage,
      dispatchEvent: event => { dispatched.push(event); return true; }
    } as unknown as Window;

    writeMockAsset({
      id: 'asset-1', userId: 'owner-1', authorName: 'Owner', title: 'Test', icon: { type: 'emoji', value: '🧪' },
      category: 'lore', content: '', uiCodeSnippet: '', previewImage: '', previewImages: [],
      folderId: null, isPublic: true, visibility: 'public', status: 'finished', deletedAt: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), likesCount: 0,
      forkCount: 0, forkedFromId: null, forkedFromAuthor: null, linkedAssetIds: [], versions: [], tags: []
    });

    expect(dispatched).toHaveLength(1);
  });

  it('persists canonical Profile identity across state rehydration', () => {
    (globalThis as { window: Window }).window = {
      localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => { storage.set(key, value); },
        removeItem: key => { storage.delete(key); },
        clear: () => storage.clear(),
        key: index => [...storage.keys()][index] ?? null,
        length: storage.size
      } as Storage,
      dispatchEvent: event => { dispatched.push(event); return true; }
    } as unknown as Window;
    const profile = { id: 'owner-1', displayName: 'Owner', username: 'juoncxl' } as User;

    expect(writeMockProfile(profile)).toEqual({ success: true, storage: 'localStorage', error: null });
    expect(readMockProfile('owner-1', null)?.username).toBe('juoncxl');
  });

  it('does not report a Profile update as accepted when local persistence fails', () => {
    (globalThis as { window: Window }).window = {
      localStorage: {
        getItem: () => null,
        setItem: () => { throw new Error('quota exceeded'); }
      } as unknown as Storage,
      dispatchEvent: event => { dispatched.push(event); return true; }
    } as unknown as Window;

    expect(writeMockProfile({ id: 'owner-1', displayName: 'Owner', username: 'juoncxl' } as User).success).toBe(false);
    expect(readMockProfile('owner-1', null)).toBeNull();
    expect(dispatched).toHaveLength(0);
  });

  it('uses same-tab session storage when localStorage quota blocks a QA Profile save', () => {
    const sessionStorage = new Map<string, string>();
    (globalThis as { window: Window }).window = {
      localStorage: {
        getItem: () => null,
        setItem: () => { throw new DOMException('quota exceeded', 'QuotaExceededError'); }
      } as unknown as Storage,
      sessionStorage: {
        getItem: key => sessionStorage.get(key) ?? null,
        setItem: (key, value) => { sessionStorage.set(key, value); },
        removeItem: key => { sessionStorage.delete(key); }
      } as unknown as Storage,
      dispatchEvent: event => { dispatched.push(event); return true; }
    } as unknown as Window;
    const profile = { id: 'owner-1', displayName: 'Owner', username: 'juoncxl' } as User;

    expect(writeMockProfile(profile)).toEqual({ success: true, storage: 'sessionStorage', error: null });
    expect(readMockProfile('owner-1', null)?.username).toBe('juoncxl');
    expect(dispatched).toHaveLength(1);
  });

  it('does not turn an accepted Profile save into a failure when notification throws', () => {
    (globalThis as { window: Window }).window = {
      localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => { storage.set(key, value); }
      } as unknown as Storage,
      dispatchEvent: () => { throw new Error('listener unavailable'); }
    } as unknown as Window;

    expect(writeMockProfile({ id: 'owner-1', displayName: 'Owner', username: 'juoncxl' } as User)).toEqual({
      success: true,
      storage: 'localStorage',
      error: null
    });
    expect(readMockProfile('owner-1', null)?.username).toBe('juoncxl');
  });

  it('preserves the previous Profile when every local persistence target fails', () => {
    (globalThis as { window: Window }).window = {
      localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => { storage.set(key, value); },
        removeItem: key => { storage.delete(key); }
      } as unknown as Storage,
      dispatchEvent: () => true
    } as unknown as Window;
    expect(writeMockProfile({ id: 'owner-1', displayName: 'Before', username: 'oldname' } as User).success).toBe(true);

    (globalThis as { window: Window }).window = {
      localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: () => { throw new DOMException('quota exceeded', 'QuotaExceededError'); }
      } as unknown as Storage,
      sessionStorage: {
        getItem: () => null,
        setItem: () => { throw new Error('session storage unavailable'); }
      } as unknown as Storage,
      dispatchEvent: () => true
    } as unknown as Window;

    const result = writeMockProfile({ id: 'owner-1', displayName: 'After', username: 'juoncxl' } as User);

    expect(result.success).toBe(false);
    expect(readMockProfile('owner-1', null)).toMatchObject({ displayName: 'Before', username: 'oldname' });
  });

  it('rehydrates the canonical username from the same-tab session fallback', async () => {
    const sessionState = new Map<string, string>();
    (globalThis as { window: Window }).window = {
      localStorage: {
        getItem: () => null,
        setItem: () => { throw new DOMException('quota exceeded', 'QuotaExceededError'); }
      } as unknown as Storage,
      sessionStorage: {
        getItem: key => sessionState.get(key) ?? null,
        setItem: (key, value) => { sessionState.set(key, value); },
        removeItem: key => { sessionState.delete(key); }
      } as unknown as Storage,
      dispatchEvent: () => true
    } as unknown as Window;
    expect(writeMockProfile({ id: 'owner-1', displayName: 'Owner', username: 'juoncxl' } as User).success).toBe(true);

    vi.resetModules();
    const freshPersistence = await import('./creatorPersistence');

    expect(freshPersistence.readMockProfile('owner-1', null)?.username).toBe('juoncxl');
  });
});
