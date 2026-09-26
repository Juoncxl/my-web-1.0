import { describe, expect, it } from 'vitest';
import {
  buildCandidates,
  sanitizeCreatorSettings,
  SOCIAL_LINKS_SOURCE_STATUS
} from './cxl-public-creator-foundation.mjs';

const profiles = [
  {
    id: 'private-profile-a', username: 'creator-a', display_name: 'Creator A', bio: 'Public bio',
    avatar_url: 'data:image/png;base64,AAAA', cover_url: 'https://cdn.example/cover.png', updated_at: '2026-09-25T00:00:00Z'
  },
  { id: 'private-profile-no-slug', username: null, display_name: 'Unaddressable', avatar_url: null }
];

const works = [
  { id: 'work-public', user_id: 'private-profile-a', is_public: 'true', visibility: 'public', deleted_at: '' },
  { id: 'work-private', user_id: 'private-profile-a', is_public: 'false', visibility: 'private', deleted_at: '' }
];

const settingsRows = [{
  profile_id: 'private-profile-a',
  settings: {
    layout: 'free',
    widgets: ['note', 'folder', 'not-a-widget'],
    freePlacements: [
      { id: 'folder-placement', kind: 'folder', refId: 'private-folder-id', x: 0, y: 0, w: 2, h: 2 },
      { id: 'portfolio-placement', kind: 'portfolio', refId: 'portfolio', x: 0, y: 0, w: 12, h: 4 }
    ],
    widgetConfigs: {
      note: { text: 'Visible note', internalUserId: 'private-profile-a', unknownSecret: 'drop me', imageUrl: 'data:image/png;base64,BBBB' },
      links: { links: [{ label: 'Unsafe', url: 'javascript:alert(1)' }, { label: 'Safe', url: 'https://example.com/profile' }] }
    },
    folderPublicIds: ['private-folder-id'],
    ownerId: 'private-profile-a'
  }
}];

describe('offline public creator foundation', () => {
  it('cuts unknown/internal/folder/media settings and keeps only safe public settings', () => {
    const sanitized = sanitizeCreatorSettings(settingsRows[0].settings, { publicWorkIds: new Set(['work-public']) });
    expect(sanitized).toMatchObject({ settingsVersion: 1, layout: 'free', widgets: ['note', 'folder'] });
    expect(sanitized.widgetConfigs.note).toEqual({ text: 'Visible note' });
    expect(sanitized.widgetConfigs.links.links).toEqual([{ label: 'Safe', url: 'https://example.com/profile' }]);
    expect(sanitized.freePlacements).toEqual([{ id: 'portfolio:portfolio', kind: 'portfolio', refId: 'portfolio', x: 0, y: 0, w: 12, h: 4 }]);
    expect(JSON.stringify(sanitized)).not.toContain('private-profile-a');
    expect(JSON.stringify(sanitized)).not.toContain('private-folder-id');
    expect(JSON.stringify(sanitized)).not.toContain('data:image');
    expect(JSON.stringify(sanitized)).not.toContain('unknownSecret');
  });

  it('uses null for absent settings so renderer defaults remain applicable', () => {
    expect(sanitizeCreatorSettings(null)).toBeNull();
    expect(sanitizeCreatorSettings(undefined)).toBeNull();
  });

  it('preserves a persisted publicCreatorId and maps only public Works', () => {
    const first = buildCandidates({ profiles, settingsRows, works, privateMapping: [] });
    expect(first.public.publicCreatorIndex).toHaveLength(1);
    expect(first.public.publicWorkMap).toEqual([
      { schemaVersion: 1, workId: 'work-public', publicCreatorId: first.public.publicCreatorIndex[0].publicCreatorId }
    ]);
    expect(first.privateMapping.entries).toHaveLength(1);

    const rerun = buildCandidates({ profiles, settingsRows, works, privateMapping: first.privateMapping.entries });
    expect(rerun.public.publicCreatorIndex[0].publicCreatorId).toBe(first.public.publicCreatorIndex[0].publicCreatorId);
    expect(rerun.newMappings).toHaveLength(0);
    expect(first.public.publicCreatorIndex[0]).toMatchObject({ avatarRef: null, visibleSocialLinksJson: null, schemaVersion: 1 });
    expect(first.report.skippedNonAddressableProfiles).toBe(1);
    expect(first.report.socialLinksSourceStatus).toBe(SOCIAL_LINKS_SOURCE_STATUS);

    const serialized = JSON.stringify(first.public);
    expect(serialized).not.toContain('private-profile-a');
    expect(serialized).not.toContain('private-profile-no-slug');
  });

  it('rejects duplicate or malformed persisted public IDs', () => {
    expect(() => buildCandidates({ profiles, settingsRows, works, privateMapping: [
      { internalProfileId: 'private-profile-a', publicCreatorId: 'not-a-public-id' }
    ] })).toThrow('Private mapping contains an invalid entry');
  });
});
