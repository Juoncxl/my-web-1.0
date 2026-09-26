import { describe, expect, it } from 'vitest';
import { collectPublicCreatorKeys, resolvePublicCreatorKey } from './publicCreatorIdentity';

describe('public creator identity resolution', () => {
  it('uses publicCreatorId when a Google Work has no userId', () => {
    expect(resolvePublicCreatorKey({ publicCreatorId: ' cxlc_0123456789abcdef0123456789abcdef ' })).toBe('cxlc_0123456789abcdef0123456789abcdef');
  });

  it('falls back to the legacy Supabase userId when no public ID exists', () => {
    expect(resolvePublicCreatorKey({ userId: ' legacy-user-id ' })).toBe('legacy-user-id');
  });

  it('prefers the public opaque key when both identities are present', () => {
    const keys = collectPublicCreatorKeys([{
      publicCreatorId: 'cxlc_0123456789abcdef0123456789abcdef',
      userId: 'internal-user-id'
    }]);
    expect(keys).toEqual(['cxlc_0123456789abcdef0123456789abcdef']);
    expect(keys).not.toContain('internal-user-id');
  });

  it('deduplicates and safely skips missing creator identities for profile batches', () => {
    expect(collectPublicCreatorKeys([
      { publicCreatorId: 'cxlc_0123456789abcdef0123456789abcdef' },
      { publicCreatorId: 'cxlc_0123456789abcdef0123456789abcdef', userId: 'legacy-user-id' },
      { userId: 'legacy-user-id' },
      { publicCreatorId: '   ', userId: undefined },
      {}
    ])).toEqual(['cxlc_0123456789abcdef0123456789abcdef', 'legacy-user-id']);
  });
});
