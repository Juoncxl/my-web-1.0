import { getCanonicalProfilePath } from './profileIdentity';

export type ProfileTab = 'profile' | 'works' | 'folders' | 'drafts' | 'saved' | 'recent' | 'trash';

const OWNER_TABS = new Set<ProfileTab>(['works', 'folders', 'drafts', 'saved', 'recent', 'trash']);

export interface CanonicalProfileRoute {
  slug: string;
  requestedTab: ProfileTab;
  previewPublic: boolean;
  folderId: string | null;
}

export function parseCanonicalProfileLocation(pathname: string, search = ''): CanonicalProfileRoute | null {
  const match = pathname.match(/^\/@([^/]+)\/?$/i);
  if (!match) return null;

  let slug = '';
  try {
    slug = decodeURIComponent(match[1]).trim();
  } catch {
    return null;
  }
  if (!slug) return null;

  const params = new URLSearchParams(search);
  const requested = params.get('tab') as ProfileTab | null;
  const folderId = params.get('folder')?.trim() || null;
  return {
    slug,
    requestedTab: requested && OWNER_TABS.has(requested) ? requested : 'profile',
    previewPublic: params.get('preview') === 'public',
    folderId
  };
}

/** Route classification only; authorization still comes from the authenticated session. */
export function isOwnerProfileRouteSlug(
  routeSlug: string,
  currentUser: { id: string; username?: string } | null | undefined
): boolean {
  if (!currentUser) return false;
  let normalizedRoute = routeSlug.trim();
  try { normalizedRoute = decodeURIComponent(normalizedRoute); } catch { /* compare the raw route below */ }
  normalizedRoute = normalizedRoute.trim().replace(/^@+/, '').toLowerCase();
  if (!normalizedRoute) return false;
  return normalizedRoute === currentUser.id.trim().toLowerCase()
    || normalizedRoute === (currentUser.username || '').trim().replace(/^@+/, '').toLowerCase();
}

export type ProfileWorksReadScope =
  | { type: 'owner'; userId: string }
  | { type: 'public'; creatorSlug: string };

export function resolveProfileWorksReadScope(
  routeSlug: string,
  currentUser: { id: string; username?: string } | null | undefined
): ProfileWorksReadScope {
  return currentUser && isOwnerProfileRouteSlug(routeSlug, currentUser)
    ? { type: 'owner', userId: currentUser.id }
    : { type: 'public', creatorSlug: routeSlug };
}

/** Do not discard an owner route before the auth session has resolved. */
export function shouldNormalizeOwnerProfileContext(
  route: Pick<CanonicalProfileRoute, 'requestedTab' | 'folderId'>,
  isPublicView: boolean,
  isAuthLoading: boolean
): boolean {
  if (isAuthLoading || !isPublicView) return false;
  return (route.requestedTab !== 'profile' && route.requestedTab !== 'works') || Boolean(route.folderId);
}

export function resolveProfileView(
  route: Pick<CanonicalProfileRoute, 'requestedTab' | 'previewPublic'>,
  isOwner: boolean
): { activeTab: ProfileTab; isPublicView: boolean } {
  const isPublicView = !isOwner || route.previewPublic;
  return {
    activeTab: isPublicView ? route.requestedTab === 'works' ? 'works' : 'profile' : route.requestedTab,
    isPublicView
  };
}

export function getLegacyProfileRedirect(
  pathname: string,
  search: string,
  currentUser?: { id: string; username?: string } | null
): string | null {
  const creatorMatch = pathname.match(/^\/creator\/([^/]+)\/?$/i);
  if (creatorMatch) return `/@${creatorMatch[1]}${search}`;

  if (!currentUser) return null;
  if (/^\/vault\/?$/i.test(pathname)) return getCanonicalProfilePath(currentUser, '?tab=works');
  if (/^\/creator-space\/?$/i.test(pathname)) return getCanonicalProfilePath(currentUser);
  return null;
}
