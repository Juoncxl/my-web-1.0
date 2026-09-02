import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Asset, User } from '../types';
import { readCreatorSpaceSettings, readMockAssets, readMockBookmarks, readMockFolders, readMockLikes, readMockProfile, removeMockAsset, resetCreatorSandbox, setMockAssetLike, writeCreatorSpaceSettings, writeMockAsset, writeMockBookmarks, writeMockFolder, writeMockLikes, writeMockProfile } from './creatorPersistence';

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

  it('preserves the previous layout when a settings write fails', () => {
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
    expect(writeCreatorSpaceSettings('owner-1', { layout: 'free', freePlacements: [{ id: 'widget:note', kind: 'widget', refId: 'note', x: 2, y: 1, w: 4, h: 2 }] })).toBe(true);

    (globalThis as { window: Window }).window.localStorage.setItem = () => { throw new Error('quota exceeded'); };
    expect(writeCreatorSpaceSettings('owner-1', { layout: 'free', freePlacements: [{ id: 'widget:note', kind: 'widget', refId: 'note', x: 9, y: 9, w: 3, h: 3 }] })).toBe(false);
    expect(readCreatorSpaceSettings('owner-1')?.freePlacements?.[0]).toMatchObject({ x: 2, y: 1, w: 4, h: 2 });
  });

  it('persists Portfolio showcase limit and auto-height marker without data refresh events', () => {
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

    expect(writeCreatorSpaceSettings('owner-1', {
      layout: 'free',
      portfolioDisplayLimit: 6,
      freePlacements: [{ id: 'portfolio:portfolio', kind: 'portfolio', refId: 'portfolio', x: 1, y: 2, w: 9, h: 12, heightMode: 'auto' }]
    })).toBe(true);

    expect(readCreatorSpaceSettings('owner-1')).toMatchObject({
      portfolioDisplayLimit: 6,
      freePlacements: [expect.objectContaining({ w: 9, heightMode: 'auto' })]
    });
    expect(dispatched).toHaveLength(0);
  });

  it('round-trips image and GIF Work Icons after persistence module hydration', async () => {
    const sessionStorage = new Map<string, string>();
    (globalThis as { window: Window }).window = {
      localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => { storage.set(key, value); },
        removeItem: key => { storage.delete(key); },
        clear: () => storage.clear(),
        key: index => [...storage.keys()][index] ?? null,
        length: storage.size
      } as Storage,
      sessionStorage: {
        getItem: key => sessionStorage.get(key) ?? null,
        setItem: (key, value) => { sessionStorage.set(key, value); },
        removeItem: key => { sessionStorage.delete(key); },
        clear: () => sessionStorage.clear(),
        key: index => [...sessionStorage.keys()][index] ?? null,
        length: sessionStorage.size
      } as Storage,
      dispatchEvent: () => true
    } as unknown as Window;
    const base = {
      userId: 'owner-1', authorName: 'Owner', category: 'lore' as const, content: '',
      uiCodeSnippet: '', previewImage: '', previewImages: [], folderId: null,
      isPublic: false, visibility: 'private' as const, status: 'finished' as const, deletedAt: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), likesCount: 0, forkCount: 0,
      forkedFromId: null, forkedFromAuthor: null, linkedAssetIds: [], versions: [], tags: []
    };
    writeMockAsset({ ...base, id: 'image-work', title: 'Image', icon: { type: 'image', value: 'data:image/png;base64,image' } } as Asset);
    writeMockAsset({ ...base, id: 'gif-work', title: 'GIF', icon: { type: 'image', value: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=' } } as Asset);

    expect(readMockAssets().map(asset => asset.icon.value)).toEqual([
      'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
      'data:image/png;base64,image'
    ]);

    vi.resetModules();
    const freshPersistence = await import('./creatorPersistence');
    expect(freshPersistence.readMockAssets().map(asset => asset.icon.value)).toEqual([
      'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
      'data:image/png;base64,image'
    ]);
  });

  it('uses session storage when the local sandbox cannot persist a GIF icon', async () => {
    const sessionStorage = new Map<string, string>();
    (globalThis as { window: Window }).window = {
      localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: () => { throw new Error('quota exceeded'); },
        removeItem: key => { storage.delete(key); },
        clear: () => storage.clear(),
        key: index => [...storage.keys()][index] ?? null,
        length: storage.size
      } as Storage,
      sessionStorage: {
        getItem: key => sessionStorage.get(key) ?? null,
        setItem: (key, value) => { sessionStorage.set(key, value); },
        removeItem: key => { sessionStorage.delete(key); },
        clear: () => sessionStorage.clear(),
        key: index => [...sessionStorage.keys()][index] ?? null,
        length: sessionStorage.size
      } as Storage,
      dispatchEvent: () => true
    } as unknown as Window;
    const gif = { type: 'image' as const, value: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=' };
    expect(writeMockAsset({
      id: 'quota-gif', userId: 'owner-1', authorName: 'Owner', title: 'Quota GIF', icon: gif,
      category: 'lore', content: '', uiCodeSnippet: '', previewImage: '', previewImages: [], folderId: null,
      isPublic: false, visibility: 'private', status: 'finished', deletedAt: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), likesCount: 0, forkCount: 0,
      forkedFromId: null, forkedFromAuthor: null, linkedAssetIds: [], versions: [], tags: []
    } as Asset)).toBe(true);
    expect(readMockAssets()[0].icon).toEqual(gif);

    vi.resetModules();
    const freshPersistence = await import('./creatorPersistence');
    expect(freshPersistence.readMockAssets()[0].icon).toEqual(gif);
  });

  it('preserves Free Portfolio placement while switching through Locked layout', () => {
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
    const freePlacements = [{ id: 'portfolio:portfolio', kind: 'portfolio' as const, refId: 'portfolio', x: 2, y: 4, w: 8, h: 11, heightMode: 'auto' as const }];

    expect(writeCreatorSpaceSettings('owner-1', { layout: 'free', portfolioDisplayLimit: 9, freePlacements })).toBe(true);
    expect(writeCreatorSpaceSettings('owner-1', { layout: 'locked', lockedPreset: 'split', portfolioDisplayLimit: 9, freePlacements })).toBe(true);
    expect(readCreatorSpaceSettings('owner-1')).toMatchObject({ layout: 'locked', portfolioDisplayLimit: 9, freePlacements });
  });

  it('round-trips exact logical x/y/w and independent same-type Widget instances', () => {
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
    const freePlacements = [
      { id: 'widget:decoration-a', kind: 'widget' as const, refId: 'decoration-a', x: 0, y: 9, w: 1, h: 2 },
      { id: 'widget:decoration-b', kind: 'widget' as const, refId: 'decoration-b', x: 7, y: 3, w: 2, h: 2 },
      { id: 'portfolio:portfolio', kind: 'portfolio' as const, refId: 'portfolio', x: 2, y: 21, w: 10, h: 12, heightMode: 'auto' as const }
    ];
    const widgetInstances = [
      { id: 'decoration-a', widgetType: 'decoration', title: 'Narrow A', config: { text: 'A', opacity: 60 } },
      { id: 'decoration-b', widgetType: 'decoration', title: 'Narrow B', config: { text: 'B', opacity: 100 } }
    ];

    expect(writeCreatorSpaceSettings('owner-1', { layout: 'free', freePlacements, widgetInstances })).toBe(true);
    expect(readCreatorSpaceSettings('owner-1')).toMatchObject({ freePlacements, widgetInstances });
  });

  it('removes only Profile placement references while preserving Work, Folder and Widget instance data', () => {
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
    writeMockAsset({
      id: 'asset-keep', userId: 'owner-1', authorName: 'Owner', title: 'Keep Work', icon: { type: 'emoji', value: '🧪' },
      category: 'lore', content: '', uiCodeSnippet: '', previewImage: '', previewImages: [], folderId: null,
      isPublic: true, visibility: 'public', status: 'finished', deletedAt: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), likesCount: 0, forkCount: 0,
      forkedFromId: null, forkedFromAuthor: null, linkedAssetIds: [], versions: [], tags: []
    });
    writeMockFolder({ id: 'folder-keep', userId: 'owner-1', name: 'Keep Folder', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const widgetInstances = [{ id: 'note-a', widgetType: 'note', config: { text: 'keep configuration' } }];
    expect(writeCreatorSpaceSettings('owner-1', {
      layout: 'free',
      widgetInstances,
      freePlacements: [
        { id: 'work:asset-keep', kind: 'work', refId: 'asset-keep', x: 0, y: 0, w: 4, h: 5, heightMode: 'auto' },
        { id: 'folder:folder-keep', kind: 'folder', refId: 'folder-keep', x: 4, y: 0, w: 4, h: 3 },
        { id: 'widget:note-a', kind: 'widget', refId: 'note-a', x: 8, y: 0, w: 4, h: 2 }
      ]
    })).toBe(true);

    expect(writeCreatorSpaceSettings('owner-1', { layout: 'free', widgetInstances, freePlacements: [] })).toBe(true);
    expect(readCreatorSpaceSettings('owner-1')?.freePlacements).toEqual([]);
    expect(readCreatorSpaceSettings('owner-1')?.widgetInstances).toEqual(widgetInstances);
    expect(readMockAssets('owner-1').map(asset => asset.id)).toContain('asset-keep');
    expect(readMockFolders('owner-1').map(folder => folder.id)).toContain('folder-keep');
    expect(readMockAssets('owner-1')[0].visibility).toBe('public');
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

  it('derives the QA Like aggregate from idempotent user-to-Work relations and preserves it across rehydration', async () => {
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
    const now = new Date().toISOString();
    writeMockAsset({
      id: 'likeable-work', userId: 'owner-1', authorName: 'Owner', title: 'Likeable', icon: { type: 'emoji', value: '♥' },
      category: 'lore', content: '', uiCodeSnippet: '', previewImages: [], folderId: null,
      // Simulate a legacy aggregate retained before relational Likes existed.
      likesCount: 2, isPublic: true, visibility: 'public', status: 'finished', deletedAt: null,
      createdAt: now, updatedAt: now, forkCount: 0, forkedFromId: null, forkedFromAuthor: null, linkedAssetIds: [], versions: [], tags: []
    });

    expect(readMockAssets().find(asset => asset.id === 'likeable-work')?.likesCount).toBe(2);
    expect(setMockAssetLike('user-a', 'likeable-work', true)).toMatchObject({ success: true, isLiked: true, likesCount: 3 });
    expect(setMockAssetLike('user-a', 'likeable-work', true)).toMatchObject({ success: true, isLiked: true, likesCount: 3 });
    expect(setMockAssetLike('user-b', 'likeable-work', true)).toMatchObject({ success: true, isLiked: true, likesCount: 4 });
    expect(readMockAssets().find(asset => asset.id === 'likeable-work')?.likesCount).toBe(4);
    expect(setMockAssetLike('user-a', 'likeable-work', false)).toMatchObject({ success: true, isLiked: false, likesCount: 3 });
    expect(readMockLikes('user-a')).toEqual([]);
    expect(readMockLikes('user-b')).toEqual(['likeable-work']);
    writeMockBookmarks('user-a', ['likeable-work']);

    vi.resetModules();
    const freshPersistence = await import('./creatorPersistence');
    expect(freshPersistence.readMockLikes('user-b')).toEqual(['likeable-work']);
    expect(freshPersistence.readMockAssets().find(asset => asset.id === 'likeable-work')?.likesCount).toBe(3);
    expect(freshPersistence.readMockBookmarks('user-a')).toEqual(['likeable-work']);
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

  it('permanently removes a Work and cleans every local relationship that can reference it', () => {
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
    const now = new Date().toISOString();
    const deletedWork = {
      id: 'work-delete', userId: 'owner-1', authorName: 'Owner', title: 'Delete me',
      icon: { type: 'image', value: 'data:image/png;base64,deleted' }, category: 'lore', content: '',
      uiCodeSnippet: '', previewImages: [], folderId: 'folder-1', isPublic: true, visibility: 'public',
      status: 'finished', deletedAt: now, createdAt: now, updatedAt: now, likesCount: 0, forkCount: 0,
      forkedFromId: null, forkedFromAuthor: null, linkedAssetIds: [], versions: [], tags: []
    } as Asset;
    const linkedWork = { ...deletedWork, id: 'work-linked', folderId: null, deletedAt: null, linkedAssetIds: ['work-delete'] };
    writeMockAsset(deletedWork);
    writeMockAsset(linkedWork);
    writeMockBookmarks('owner-1', ['work-delete', 'work-linked']);
    writeMockBookmarks('owner-2', ['work-delete']);
    writeMockLikes('owner-1', ['work-delete']);
    writeMockLikes('owner-2', ['work-delete']);
    const placements = [
      { id: 'work:work-delete', kind: 'work' as const, refId: 'work-delete', x: 0, y: 0, w: 4, h: 4 },
      { id: 'widget:note', kind: 'widget' as const, refId: 'note', x: 4, y: 0, w: 4, h: 2 }
    ];
    expect(writeCreatorSpaceSettings('owner-1', { layout: 'free', freePlacements: placements })).toBe(true);
    expect(writeCreatorSpaceSettings('owner-2', { layout: 'free', freePlacements: [{ id: 'work:work-delete', kind: 'work', refId: 'work-delete', x: 0, y: 0, w: 4, h: 4 }] })).toBe(true);

    expect(removeMockAsset('work-delete', 'owner-1')).toBe(true);
    expect(readMockAssets().map(asset => asset.id)).toEqual(['work-linked']);
    expect(readMockAssets()[0].linkedAssetIds).toEqual([]);
    expect(readMockBookmarks('owner-1')).toEqual(['work-linked']);
    expect(readMockBookmarks('owner-2')).toEqual([]);
    expect(readMockLikes('owner-1')).toEqual([]);
    expect(readMockLikes('owner-2')).toEqual([]);
    expect(readCreatorSpaceSettings('owner-1')?.freePlacements).toEqual([placements[1]]);
    expect(readCreatorSpaceSettings('owner-2')?.freePlacements).toEqual([]);
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
