import { describe, expect, it } from 'vitest';
import type { Asset, User } from '../types';
import {
  canCreateOwnedAsset,
  canForkAsset,
  isGuestUser,
  isLegacyGuestUserId,
  isOwnedActiveAsset,
  isPublicFeedAsset,
  isTrashAssetForUser
} from './accessPolicy';

const user: User = {
  id: 'user-1',
  displayName: 'Creator',
  createdAt: '2026-01-01T00:00:00.000Z'
};

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    userId: 'owner-1',
    authorName: 'Owner',
    title: 'Asset',
    icon: { type: 'emoji', value: '✨' },
    category: 'character',
    content: 'content',
    isPublic: true,
    visibility: 'public',
    status: 'finished',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides
  };
}

describe('visitor and legacy Guest policy', () => {
  it('uses one authoritative Guest state and blocks persisted creation', () => {
    expect(isGuestUser(null)).toBe(true);
    expect(isGuestUser(user)).toBe(false);
    expect(canCreateOwnedAsset(null)).toBe(false);
    expect(canCreateOwnedAsset(user)).toBe(true);
  });

  it('recognizes only legacy browser Guest IDs', () => {
    expect(isLegacyGuestUserId('guest_abc123')).toBe(true);
    expect(isLegacyGuestUserId('user-1')).toBe(false);
    expect(isLegacyGuestUserId(undefined)).toBe(false);
  });

  it('prevents a visitor from bypassing the account requirement through Fork', () => {
    expect(canForkAsset(null, makeAsset())).toBe(false);
    expect(canForkAsset(user, makeAsset())).toBe(true);
    expect(canForkAsset(user, makeAsset({ visibility: 'public', isPublic: false }))).toBe(false);
    expect(canForkAsset(user, makeAsset({ visibility: 'private', isPublic: true }))).toBe(false);
    expect(canForkAsset(user, makeAsset({ visibility: 'private', isPublic: false }))).toBe(false);
    expect(canForkAsset(user, makeAsset({ deletedAt: '2026-02-01T00:00:00.000Z' }))).toBe(false);
  });
});

describe('asset visibility filters', () => {
  it('keeps private, inconsistent, and deleted assets out of the public feed', () => {
    expect(isPublicFeedAsset(makeAsset())).toBe(true);
    expect(isPublicFeedAsset(makeAsset({ visibility: 'private', isPublic: false }))).toBe(false);
    expect(isPublicFeedAsset(makeAsset({ visibility: 'public', isPublic: false }))).toBe(false);
    expect(isPublicFeedAsset(makeAsset({ deletedAt: '2026-02-01T00:00:00.000Z' }))).toBe(false);
  });

  it('shows active and trashed assets only to their owner in the matching view', () => {
    const active = makeAsset({ userId: 'user-1' });
    const deleted = makeAsset({ userId: 'user-1', deletedAt: '2026-02-01T00:00:00.000Z' });

    expect(isOwnedActiveAsset(active, 'user-1')).toBe(true);
    expect(isOwnedActiveAsset(deleted, 'user-1')).toBe(false);
    expect(isTrashAssetForUser(deleted, 'user-1')).toBe(true);
    expect(isTrashAssetForUser(deleted, 'user-2')).toBe(false);
  });
});
