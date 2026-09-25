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
  it('supports owner, folder, category, text/tag search, trash, and limits', () => {
    expect(filterGoogleWorks([activeOwner, publicWork], { userId: 'owner', currentUserId: 'owner', folderId: null }, { currentUserId: 'owner' }).map(item => item.id)).toEqual(['owner-work']);
    expect(filterGoogleWorks([activeOwner, trash], { onlyDeleted: true }, { currentUserId: 'owner' }).map(item => item.id)).toEqual(['trash']);
    expect(filterGoogleWorks([activeOwner, publicWork], { publicOnly: true, search: 'searchable', category: 'all', limit: 1 }).map(item => item.id)).toEqual(['public-work']);
  });
  it('applies the database limit before client-side text search, matching Supabase order', () => {
    const newest = work('newest', { visibility: 'public', isPublic: true, content: 'nothing here', createdAt: '2026-04-01T00:00:00Z' });
    const olderMatch = work('older-match', { visibility: 'public', isPublic: true, createdAt: '2026-03-01T00:00:00Z', content: 'needle' });
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
});
