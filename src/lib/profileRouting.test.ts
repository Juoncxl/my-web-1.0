import { describe, expect, it } from 'vitest';
import { getLegacyProfileRedirect, isOwnerProfileRouteSlug, parseCanonicalProfileLocation, resolveProfileView, resolveProfileWorksReadScope, shouldNormalizeOwnerProfileContext } from './profileRouting';

describe('canonical Profile routing', () => {
  it('keeps the configured Owner slug in Owner scope after session restoration without presentation enrichment', () => {
    const restoredOwner = { id: 'private-owner-key', username: 'juoncxl' };
    expect(isOwnerProfileRouteSlug('juoncxl', restoredOwner)).toBe(true);
    expect(isOwnerProfileRouteSlug('JUONCXL', restoredOwner)).toBe(true);
    expect(isOwnerProfileRouteSlug('juoncxl', null)).toBe(false);
    expect(isOwnerProfileRouteSlug('another-creator', restoredOwner)).toBe(false);
    expect(resolveProfileWorksReadScope('juoncxl', restoredOwner)).toEqual({ type: 'owner', userId: 'private-owner-key' });
    expect(resolveProfileWorksReadScope('another-creator', restoredOwner)).toEqual({ type: 'public', creatorSlug: 'another-creator' });
    expect(resolveProfileWorksReadScope('juoncxl', null)).toEqual({ type: 'public', creatorSlug: 'juoncxl' });
  });

  it('preserves Profile identity in public preview', () => {
    const route = parseCanonicalProfileLocation('/@juoncxl', '?preview=public');

    expect(route).toEqual({ slug: 'juoncxl', requestedTab: 'profile', previewPublic: true, folderId: null });
    expect(resolveProfileView(route!, true)).toEqual({ activeTab: 'profile', isPublicView: true });
  });

  it('falls back safely when a visitor requests an owner-only tab', () => {
    const route = parseCanonicalProfileLocation('/@juoncxl', '?tab=trash');

    expect(route?.slug).toBe('juoncxl');
    expect(resolveProfileView(route!, false)).toEqual({ activeTab: 'profile', isPublicView: true });
  });

  it('allows owner tabs only for the resolved owner view', () => {
    const route = parseCanonicalProfileLocation('/@juoncxl', '?tab=works');

    expect(resolveProfileView(route!, true)).toEqual({ activeTab: 'works', isPublicView: false });
  });

  it('allows the public Works library while keeping private owner tabs closed', () => {
    const worksRoute = parseCanonicalProfileLocation('/@juoncxl', '?tab=works');
    const trashRoute = parseCanonicalProfileLocation('/@juoncxl', '?tab=trash');

    expect(resolveProfileView(worksRoute!, false)).toEqual({ activeTab: 'works', isPublicView: true });
    expect(resolveProfileView(trashRoute!, false)).toEqual({ activeTab: 'profile', isPublicView: true });
  });

  it('treats only malformed or non-Profile paths as unresolved', () => {
    expect(parseCanonicalProfileLocation('/@%E0%A4%A')).toBeNull();
    expect(parseCanonicalProfileLocation('/vault')).toBeNull();
    expect(parseCanonicalProfileLocation('/@juoncxl', '?tab=unknown')).toEqual({
      slug: 'juoncxl', requestedTab: 'profile', previewPublic: false, folderId: null
    });
  });

  it('parses Folder Detail context from the canonical Profile query', () => {
    expect(parseCanonicalProfileLocation('/@juoncxl', '?tab=folders&folder=folder-qa')).toEqual({
      slug: 'juoncxl', requestedTab: 'folders', previewPublic: false, folderId: 'folder-qa'
    });
    expect(parseCanonicalProfileLocation('/@juoncxl', '?folder=%20')).toMatchObject({ folderId: null });
  });

  it('waits for auth hydration before stripping owner-only route context', () => {
    const draftRoute = { requestedTab: 'drafts' as const, folderId: null };
    const folderRoute = { requestedTab: 'profile' as const, folderId: 'folder-qa' };

    expect(shouldNormalizeOwnerProfileContext(draftRoute, true, true)).toBe(false);
    expect(shouldNormalizeOwnerProfileContext(draftRoute, true, false)).toBe(true);
    expect(shouldNormalizeOwnerProfileContext(folderRoute, true, false)).toBe(true);
    expect(shouldNormalizeOwnerProfileContext({ requestedTab: 'works', folderId: null }, true, false)).toBe(false);
  });
});

describe('legacy Profile redirects', () => {
  const owner = { id: 'owner-1', username: 'juoncxl' };

  it('redirects each legacy route once to its canonical destination', () => {
    expect(getLegacyProfileRedirect('/creator/juoncxl', '?preview=public', null)).toBe('/@juoncxl?preview=public');
    expect(getLegacyProfileRedirect('/vault', '', owner)).toBe('/@juoncxl?tab=works');
    expect(getLegacyProfileRedirect('/creator-space', '', owner)).toBe('/@juoncxl');
  });

  it('never redirects an already-canonical Profile route', () => {
    expect(getLegacyProfileRedirect('/@juoncxl', '?tab=works', owner)).toBeNull();
  });
});
