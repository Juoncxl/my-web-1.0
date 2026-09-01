import { describe, expect, it, vi } from 'vitest';
import type { User } from '../../types';

const serviceMocks = vi.hoisted(() => ({
  upsertProfile: vi.fn()
}));

vi.mock('../supabaseService', () => ({
  supabaseService: { upsertProfile: serviceMocks.upsertProfile }
}));

import { updateProfile } from './accountActions';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'owner-1',
    email: 'owner@example.com',
    displayName: 'Before',
    username: 'oldname',
    bio: 'Before bio',
    createdAt: '2026-01-01T00:00:00.000Z',
    provider: 'email',
    ...overrides
  };
}

describe('Profile account action', () => {
  it('returns the exact locally saved Profile payload for immediate UI state update', async () => {
    serviceMocks.upsertProfile.mockResolvedValueOnce({ success: true, error: null });
    const currentUser = makeUser();

    const result = await updateProfile(currentUser, {
      displayName: '  Juon CXL  ',
      username: '@JuonCXL',
      bio: '  Updated locally  ',
      avatarUrl: 'data:image/png;base64,avatar',
      coverUrl: 'data:image/png;base64,cover',
      socialLinks: [{ platform: 'website', label: 'Website', url: 'https://example.com', visible: true }]
    });

    expect(result.success).toBe(true);
    expect(result.user).toMatchObject({
      id: 'owner-1',
      displayName: 'Juon CXL',
      username: 'juoncxl',
      bio: 'Updated locally',
      avatarUrl: 'data:image/png;base64,avatar',
      coverUrl: 'data:image/png;base64,cover'
    });
    expect(serviceMocks.upsertProfile).toHaveBeenCalledWith(result.user);
    expect(currentUser).toMatchObject({ displayName: 'Before', username: 'oldname', bio: 'Before bio' });
  });

  it('does not expose an updated user when the local adapter rejects the save', async () => {
    serviceMocks.upsertProfile.mockResolvedValueOnce({ success: false, error: 'local storage unavailable' });

    const result = await updateProfile(makeUser(), { username: 'juoncxl' });

    expect(result).toEqual({ success: false, error: 'local storage unavailable' });
  });
});
