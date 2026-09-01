import { afterEach, describe, expect, it } from 'vitest';
import {
  deleteQaProfileImage,
  getQaProfileImage,
  getQaProfileImageStorageLimits,
  hydrateQaProfileImages,
  profileImageKey,
  restoreQaProfileImage,
  saveQaProfileImage,
  validateQaProfileImage
} from './qaProfileImageStore';

const owners = ['image-test-avatar', 'image-test-cover', 'image-test-replace'];

afterEach(async () => {
  await Promise.all(owners.flatMap(owner => [
    deleteQaProfileImage({ ownerId: owner, kind: 'avatar' }),
    deleteQaProfileImage({ ownerId: owner, kind: 'cover' })
  ]));
});

function makeFile(bytes: number, type = 'image/png'): File {
  return new File([new Uint8Array(bytes)], 'qa-image.png', { type });
}

describe('QA Profile binary image store', () => {
  it('uses separate owner-scoped Avatar and Cover keys and stores binary data', async () => {
    const avatar = await saveQaProfileImage({ ownerId: owners[0], kind: 'avatar', blob: makeFile(3) });
    const cover = await saveQaProfileImage({ ownerId: owners[0], kind: 'cover', blob: makeFile(4) });

    expect(avatar.key).toBe(profileImageKey(owners[0], 'avatar'));
    expect(cover.key).toBe(profileImageKey(owners[0], 'cover'));
    expect(avatar.key).not.toBe(cover.key);
    expect(await getQaProfileImage({ ownerId: owners[0], kind: 'avatar' })).toBeInstanceOf(Blob);
    expect((await getQaProfileImage({ ownerId: owners[0], kind: 'cover' }))?.size).toBe(4);
    expect(await getQaProfileImage({ ownerId: 'other-owner', kind: 'avatar' })).toBeNull();
  });

  it('returns the previous Blob for atomic replacement and supports rollback', async () => {
    const first = makeFile(2);
    const second = makeFile(5);
    await saveQaProfileImage({ ownerId: owners[2], kind: 'avatar', blob: first });
    const replacement = await saveQaProfileImage({ ownerId: owners[2], kind: 'avatar', blob: second });

    expect(replacement.previousBlob?.size).toBe(2);
    expect((await getQaProfileImage({ ownerId: owners[2], kind: 'avatar' }))?.size).toBe(5);
    await restoreQaProfileImage({ ownerId: owners[2], kind: 'avatar', blob: replacement.previousBlob });
    expect((await getQaProfileImage({ ownerId: owners[2], kind: 'avatar' }))?.size).toBe(2);
  });

  it('deletes only the requested local image key', async () => {
    await saveQaProfileImage({ ownerId: owners[1], kind: 'avatar', blob: makeFile(2) });
    await saveQaProfileImage({ ownerId: owners[1], kind: 'cover', blob: makeFile(2) });
    await deleteQaProfileImage({ ownerId: owners[1], kind: 'avatar' });

    expect(await getQaProfileImage({ ownerId: owners[1], kind: 'avatar' })).toBeNull();
    expect(await getQaProfileImage({ ownerId: owners[1], kind: 'cover' })).toBeInstanceOf(Blob);
  });

  it('hydrates a persisted key into a fresh runtime object URL without changing identity', async () => {
    const saved = await saveQaProfileImage({ ownerId: owners[0], kind: 'avatar', blob: makeFile(6) });
    const profile = {
      id: owners[0], displayName: 'Juon', username: 'juoncxl', createdAt: '2026-01-01T00:00:00.000Z',
      avatarImageKey: saved.key
    };

    const hydrated = await hydrateQaProfileImages(profile);

    expect(hydrated.id).toBe(owners[0]);
    expect(hydrated.username).toBe('juoncxl');
    expect(hydrated.avatarImageKey).toBe(saved.key);
    expect(hydrated.avatarUrl).toMatch(/^blob:/);
  });

  it('drops a stale image key without changing the Profile identity or safe fallback URL', async () => {
    const profile = {
      id: owners[1], displayName: 'Juon', username: 'juoncxl', createdAt: '2026-01-01T00:00:00.000Z',
      avatarImageKey: profileImageKey(owners[1], 'avatar'),
      avatarUrl: 'https://example.com/fallback.png'
    };

    const hydrated = await hydrateQaProfileImages(profile);

    expect(hydrated.id).toBe(owners[1]);
    expect(hydrated.username).toBe('juoncxl');
    expect(hydrated.avatarImageKey).toBeUndefined();
    expect(hydrated.avatarUrl).toBe('https://example.com/fallback.png');
  });

  it('keeps the advertised supported types and 5 MB limit', () => {
    const limits = getQaProfileImageStorageLimits();
    expect(limits.maxBytes).toBe(5 * 1024 * 1024);
    expect(validateQaProfileImage({ size: 3_300_000, type: 'image/png' })).toBeNull();
    expect(validateQaProfileImage({ size: limits.maxBytes, type: 'image/gif' })).toBeNull();
    expect(validateQaProfileImage({ size: limits.maxBytes + 1, type: 'image/png' })).toContain('5MB');
    expect(validateQaProfileImage({ size: 100, type: 'image/svg+xml' })).toContain('รองรับเฉพาะ');
  });
});
