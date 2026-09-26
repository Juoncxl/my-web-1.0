import { describe, expect, it } from 'vitest';
import { filterGoogleWorks } from './googleWorksRead';
import type { Asset } from '../types';

const work = (id: string, overrides: Partial<Asset> = {}) => ({
  id, userId: 'owner', authorName: 'Owner', title: id, icon: { type: 'emoji', value: '✨' }, category: 'character',
  content: 'needle body', contentBlocks: [], uiCodeSnippet: '', previewImage: '', previewImages: [], isPublic: false,
  visibility: 'private', status: 'draft', tags: [], folderId: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '',
  deletedAt: null, likesCount: 0, forkCount: 0, linkedAssetIds: [], versions: [], ...overrides
} as Asset);

describe('Google Works fetch semantics', () => {
  const activeOwner = work('owner-work');
  const publicWork = work('public-work', { userId: 'creator', visibility: 'public', isPublic: true, tags: ['searchable'], createdAt: '2026-02-01T00:00:00Z' });
  const trash = work('trash', { deletedAt: '2026-03-01T00:00:00Z' });

  it('keeps anonymous reads public-only and sorts newest first', () => {
    expect(filterGoogleWorks([activeOwner, publicWork], {}).map(item => item.id)).toEqual(['public-work']);
  });
  it('supports owner, folder, category, summary-field/tag search, trash, and limits', () => {
    expect(filterGoogleWorks([activeOwner, publicWork], { userId: 'owner', currentUserId: 'owner', folderId: null }, { currentUserId: 'owner' }).map(item => item.id)).toEqual(['owner-work']);
    expect(filterGoogleWorks([activeOwner, trash], { onlyDeleted: true }, { currentUserId: 'owner' }).map(item => item.id)).toEqual(['trash']);
    expect(filterGoogleWorks([activeOwner, publicWork], { publicOnly: true, search: 'searchable', category: 'all', limit: 1 }).map(item => item.id)).toEqual(['public-work']);
  });
  it('searches public summary fields only and never searches full content, blocks, or UI code', () => {
    const summaryWork = work('summary-work', { visibility: 'public', isPublic: true, title: 'A title', authorName: 'Creator',
      shortDescription: 'Short summary phrase', tags: ['tag-summary'], category: 'app_data',
      contentTypeLabels: ['Prompt type'], contentTypes: ['image_prompt'], presentationMetadata: { appPlatforms: ['Public platform'] } as any,
      publicCollaboration: { name: 'Public collaboration', sharedTag: 'shared-tag', platforms: ['Collab platform'],
        sharedInformation: [], deadlines: [{ label: 'Deadline label', date: '2026-10-01' }], participants: [], visibilityPolicy: {} } as any,
      content: 'private-to-summary-body', contentBlocks: [{ id: 'b1', type: 'Text', title: 'block-only-token', body: 'block-only-token' }],
      uiCodeSnippet: 'ui-code-only-token' });
    for (const query of ['title', 'summary phrase', 'creator', 'tag-summary', 'app_data', 'prompt type', 'image_prompt',
      'public platform', 'public collaboration', 'shared-tag', 'collab platform', 'deadline label']) {
      expect(filterGoogleWorks([summaryWork], { publicOnly: true, search: query }).map(item => item.id), query).toEqual(['summary-work']);
    }
    for (const query of ['private-to-summary-body', 'block-only-token', 'ui-code-only-token']) {
      expect(filterGoogleWorks([summaryWork], { publicOnly: true, search: query }).map(item => item.id), query).toEqual([]);
    }
  });
  it('keeps owner full-content search behavior unchanged', () => {
    expect(filterGoogleWorks([activeOwner], { userId: 'owner', currentUserId: 'owner', search: 'needle' }, { currentUserId: 'owner' }).map(item => item.id)).toEqual(['owner-work']);
  });
  it('applies the database limit before public summary-field search, matching Supabase order', () => {
    const newest = work('newest', { visibility: 'public', isPublic: true, content: 'nothing here', createdAt: '2026-04-01T00:00:00Z' });
    const olderMatch = work('older-match', { visibility: 'public', isPublic: true, createdAt: '2026-03-01T00:00:00Z', shortDescription: 'needle' });
    expect(filterGoogleWorks([olderMatch, newest], { publicOnly: true, limit: 1, search: 'needle' })).toEqual([]);
  });
  it('returns the summary projection without full-detail content', () => {
    const summary = filterGoogleWorks([publicWork], { publicOnly: true, detail: 'summary' })[0];
    expect(summary.content).toBe('');
    expect(summary.icon).toEqual({ type: 'emoji', value: '✨' });
    expect(summary.authorAvatar).toBeUndefined();
    expect(summary.contentBlocks).toEqual([]);
    expect(summary.versions).toEqual([]);
  });
  it('preserves legacy content-type values used by AssetCard, retaining its existing label precedence', () => {
    const legacy = work('legacy-types', { visibility: 'public', isPublic: true,
      contentTypeLabels: ['🎨 Image prompt'], contentTypes: ['image_prompt'], contentBlocks: [] });
    const summary = filterGoogleWorks([legacy], { publicOnly: true, detail: 'summary' })[0];
    expect(summary.contentTypeLabels).toEqual(['🎨 Image prompt']);
    expect(summary.contentTypes).toEqual(['image_prompt']);
    // AssetCard renders contentTypeLabels first, then uses contentTypes and its
    // established default mapping only when labels are absent.
    expect(summary.contentTypeLabels?.join(' · ') || summary.contentTypes?.join(' · ')).toBe('🎨 Image prompt');
  });
  it('preserves the icon rendered by AssetCard when it is text or a resolvable media reference', () => {
    const emoji = work('emoji', { visibility: 'public', isPublic: true, icon: { type: 'emoji', value: '🌙' } });
    const resolvedImage = work('resolved-image', { visibility: 'public', isPublic: true,
      icon: { type: 'image', value: 'media:icon-1', mediaId: 'icon-1' },
      media: [{ id: 'icon-1', assetId: 'resolved-image', storagePath: 'icon-1', purpose: 'icon', mimeType: 'image/png', fileSize: 12,
        isCover: false, sortOrder: 0, signedUrl: 'https://media.example/icon-1' }] });
    const unresolvedStableRef = work('stable-ref', { visibility: 'public', isPublic: true,
      icon: { type: 'image', value: 'media:icon-2', mediaId: 'icon-2' },
      media: [{ id: 'icon-2', assetId: 'stable-ref', storagePath: 'icon-2', purpose: 'icon', mimeType: 'image/png', fileSize: 12,
        isCover: false, sortOrder: 0 }] });
    const inlineImage = work('inline-image', { visibility: 'public', isPublic: true,
      icon: { type: 'image', value: 'data:image/png;base64,AA==' } });

    const summaries = filterGoogleWorks([emoji, resolvedImage, unresolvedStableRef, inlineImage], { publicOnly: true, detail: 'summary' });
    expect(summaries.find(item => item.id === 'emoji')?.icon).toEqual({ type: 'emoji', value: '🌙' });
    // AssetCard uses icon.value directly for its <img src>; preserve the resolved URL.
    expect(summaries.find(item => item.id === 'resolved-image')?.icon.value).toBe('https://media.example/icon-1');
    expect(summaries.find(item => item.id === 'resolved-image')?.icon.mediaId).toBe('icon-1');
    const stableRefIcon = summaries.find(item => item.id === 'stable-ref')?.icon;
    expect(stableRefIcon?.value).toBe('/api/cxl/media?workId=stable-ref&ref=media%3Aicon-2');
    expect(stableRefIcon?.mediaId).toBe('icon-2');
    const hashIcon = filterGoogleWorks([work('hash-ref', { visibility: 'public', isPublic: true,
      icon: { type: 'image', value: `cxl-media:${'a'.repeat(64)}` } })], { publicOnly: true, detail: 'summary' })[0].icon;
    expect(hashIcon.value).toBe(`/api/cxl/media?workId=hash-ref&ref=cxl-media%3A${'a'.repeat(64)}`);
    expect(summaries.find(item => item.id === 'inline-image')?.icon).toEqual({ type: 'emoji', value: '✨' });
    expect(JSON.stringify(summaries)).not.toContain('base64,AA==');
  });
  it('uses Unix milliseconds for valid updatedAt cache versions and omits invalid dates', () => {
    const valid = work('valid-date', { visibility: 'public', isPublic: true,
      updatedAt: '2026-01-01T00:00:00.000Z', icon: { type: 'image', value: 'media:icon-1' } });
    const invalid = work('invalid-date', { visibility: 'public', isPublic: true,
      updatedAt: 'not-a-date', icon: { type: 'image', value: 'media:icon-2' } });
    const summaries = filterGoogleWorks([valid, invalid], { publicOnly: true, detail: 'summary' });
    expect(summaries.find(item => item.id === 'valid-date')?.icon.value)
      .toBe('/api/cxl/media?workId=valid-date&ref=media%3Aicon-1&v=1767225600000');
    expect(summaries.find(item => item.id === 'invalid-date')?.icon.value)
      .toBe('/api/cxl/media?workId=invalid-date&ref=media%3Aicon-2');
  });
});
