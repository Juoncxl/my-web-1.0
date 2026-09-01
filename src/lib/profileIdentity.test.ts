import { describe, expect, it } from 'vitest';
import type { User } from '../types';
import {
  getCanonicalProfilePath,
  getCanonicalProfileSlug,
  isGenuineProfileNotFound,
  normalizeProfileUsername,
  resolveProfileBySlug
} from './profileIdentity';

function makeProfile(overrides: Partial<User> = {}): User {
  return {
    id: 'owner-uuid',
    email: 'owner@example.com',
    displayName: 'Display Name Is Not Identity',
    username: 'juoncxl',
    bio: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    provider: 'email',
    ...overrides
  };
}

describe('canonical Profile identity', () => {
  it('normalizes the public username independently from display name', () => {
    expect(normalizeProfileUsername('  @JuonCXL ')).toBe('juoncxl');
    expect(getCanonicalProfileSlug(makeProfile())).toBe('juoncxl');
  });

  it('uses the canonical username for every owner Profile path', () => {
    expect(getCanonicalProfilePath(makeProfile())).toBe('/@juoncxl');
    expect(getCanonicalProfilePath(makeProfile(), '?tab=works')).toBe('/@juoncxl?tab=works');
  });

  it('uses the immutable ID only when the Profile genuinely has no username', () => {
    expect(getCanonicalProfileSlug(makeProfile({ username: undefined }))).toBe('owner-uuid');
    expect(getCanonicalProfilePath(makeProfile({ username: undefined }))).toBe('/@owner-uuid');
  });

  it('resolves a visitor route by username without owner-session state', () => {
    const profile = makeProfile();

    expect(resolveProfileBySlug([profile], 'JUONCXL')).toBe(profile);
    expect(resolveProfileBySlug([profile], 'missing')).toBeNull();
  });

  it('does not treat an old username as an alias after the canonical username changes', () => {
    const profile = makeProfile({ username: 'newname' });

    expect(resolveProfileBySlug([profile], 'oldname')).toBeNull();
    expect(resolveProfileBySlug([profile], 'newname')).toBe(profile);
  });

  it('does not let an ID fallback replace an existing canonical username', () => {
    const profile = makeProfile({ id: 'generated-long-owner-id' });

    expect(getCanonicalProfileSlug(profile)).toBe('juoncxl');
    expect(getCanonicalProfilePath(profile)).not.toContain('generated-long-owner-id');
  });

  it('classifies not-found only when identity resolution genuinely found no Profile', () => {
    expect(isGenuineProfileNotFound({ data: null, reason: 'not-found' })).toBe(true);
    expect(isGenuineProfileNotFound({ data: null, reason: 'unavailable' })).toBe(false);
    expect(isGenuineProfileNotFound({ data: null, reason: 'error' })).toBe(false);
    expect(isGenuineProfileNotFound({ data: makeProfile(), reason: null })).toBe(false);
  });
});
