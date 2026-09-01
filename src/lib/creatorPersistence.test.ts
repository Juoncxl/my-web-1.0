import { afterEach, describe, expect, it } from 'vitest';
import { resetCreatorSandbox, writeCreatorSpaceSettings, writeMockAsset } from './creatorPersistence';

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

    expect(dispatched).toHaveLength(2);
  });
});
