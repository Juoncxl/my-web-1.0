import type { User } from '../types';

export type ProfileIdentity = Pick<User, 'id' | 'username'>;
export type ProfileLookupReason = 'not-found' | 'unavailable' | 'error' | null;

export interface ProfileLookupResult<TProfile = User> {
  data: TProfile | null;
  error: string | null;
  reason: ProfileLookupReason;
}

export function normalizeProfileUsername(value?: string | null): string | undefined {
  const normalized = value?.trim().replace(/^@+/, '').toLowerCase();
  return normalized || undefined;
}

export function getProfileUsernameValidationError(value?: string | null): string | null {
  const normalized = normalizeProfileUsername(value);
  if (!normalized) return null;
  return /^[a-z0-9][a-z0-9_.-]{2,31}$/.test(normalized)
    ? null
    : 'ชื่อผู้ใช้ต้องมี 3–32 ตัวอักษร และใช้ a-z, 0-9, จุด, ขีดกลาง หรือขีดล่าง';
}

export function getCanonicalProfileSlug(profile: ProfileIdentity): string {
  return normalizeProfileUsername(profile.username) || profile.id;
}

export function getCanonicalProfilePath(profile: ProfileIdentity, search = ''): string {
  const suffix = search && !search.startsWith('?') ? `?${search}` : search;
  return `/@${encodeURIComponent(getCanonicalProfileSlug(profile))}${suffix}`;
}

export function resolveProfileBySlug(profiles: User[], rawSlug: string): User | null {
  const slug = normalizeProfileUsername(rawSlug);
  if (!slug) return null;

  const usernameMatch = profiles.find(profile => normalizeProfileUsername(profile.username) === slug);
  if (usernameMatch) return usernameMatch;

  return profiles.find(profile => profile.id === rawSlug.trim()) || null;
}

export function isGenuineProfileNotFound(result: Pick<ProfileLookupResult, 'data' | 'reason'>): boolean {
  return result.data === null && result.reason === 'not-found';
}
