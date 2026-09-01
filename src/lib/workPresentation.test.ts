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
});
