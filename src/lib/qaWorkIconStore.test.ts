import { afterEach, describe, expect, it } from 'vitest';
import type { Asset } from '../types';
import {
  dataUrlToQaWorkIconBlob,
  deleteQaWorkIcon,
  hydrateQaWorkIcons,
  isQaWorkIconKeyForAsset,
  saveQaWorkIcon
} from './qaWorkIconStore';

const ownerId = 'work-icon-store-test';
const gifDataUrl = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
let storedKey: string | undefined;

afterEach(async () => {
  if (storedKey) await deleteQaWorkIcon(storedKey);
  storedKey = undefined;
});

describe('QA Work Icon binary store', () => {
  it('moves a GIF data URL into binary storage and rehydrates a fresh runtime URL', async () => {
    const blob = dataUrlToQaWorkIconBlob(gifDataUrl);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.type).toBe('image/gif');

    const stored = await saveQaWorkIcon({ assetId: ownerId, blob: blob! });
    storedKey = stored.key;
    expect(isQaWorkIconKeyForAsset(stored.key, ownerId)).toBe(true);
    expect(stored.url).toMatch(/^blob:/);

    const asset = {
      id: ownerId, userId: 'owner', authorName: 'Owner', title: 'GIF',
      icon: { type: 'image', value: '', storageKey: stored.key }, category: 'lore', content: '',
      isPublic: false, visibility: 'private', status: 'finished', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
    } as Asset;
    const [hydrated] = await hydrateQaWorkIcons([asset]);

    expect(hydrated.icon).toMatchObject({ type: 'image', storageKey: stored.key, mimeType: 'image/gif' });
    expect(hydrated.icon.value).toMatch(/^blob:/);
  });

  it('leaves Emoji and regular image URLs untouched during hydration', async () => {
    const assets = [
      { id: 'emoji', icon: { type: 'emoji', value: '❤️‍🔥' } },
      { id: 'image', icon: { type: 'image', value: 'https://example.com/icon.png' } }
    ] as Asset[];
    const hydrated = await hydrateQaWorkIcons(assets);
    expect(hydrated).toEqual(assets);
  });
});
