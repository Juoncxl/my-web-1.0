import { describe, expect, it } from 'vitest';
import { resolveWorkCreator } from './workPresentation';

describe('work creator presentation', () => {
  it('prefers the matching current Profile over a stale Work snapshot', () => {
    const result = resolveWorkCreator({ userId: 'owner-1', authorName: 'Old Name', authorAvatar: 'old-avatar' }, {
      id: 'owner-1', displayName: 'Juon', username: 'juoncxl', avatarUrl: 'current-avatar', createdAt: ''
    });
    expect(result).toEqual({ displayName: 'Juon', username: 'juoncxl', avatarUrl: 'current-avatar' });
  });

  it('falls back to legacy snapshot when the current Profile is unavailable', () => {
    expect(resolveWorkCreator({ userId: 'owner-1', authorName: 'Legacy', authorAvatar: 'legacy-avatar' })).toEqual({ displayName: 'Legacy', avatarUrl: 'legacy-avatar' });
  });

  it('uses an opaque public creator ID when a public Work has no internal user ID', () => {
    expect(resolveWorkCreator({
      publicCreatorId: 'cxlc_0123456789abcdef0123456789abcdef',
      authorName: 'Snapshot Name',
      authorAvatar: 'snapshot-avatar'
    }, {
      id: 'cxlc_0123456789abcdef0123456789abcdef', displayName: 'Google Creator', username: 'juoncxl', avatarUrl: 'public-avatar', createdAt: ''
    })).toEqual({ displayName: 'Google Creator', username: 'juoncxl', avatarUrl: 'public-avatar' });
  });

  it('keeps the owner profile match on internal userId when both identity keys exist', () => {
    expect(resolveWorkCreator({
      userId: 'owner-1',
      publicCreatorId: 'cxlc_0123456789abcdef0123456789abcdef',
      authorName: 'Snapshot Name',
      authorAvatar: 'snapshot-avatar'
    }, {
      id: 'owner-1', displayName: 'Owner Profile', username: 'juoncxl', avatarUrl: 'owner-avatar', createdAt: ''
    })).toEqual({ displayName: 'Owner Profile', username: 'juoncxl', avatarUrl: 'owner-avatar' });
  });
});
