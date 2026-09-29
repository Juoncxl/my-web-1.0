import { describe, expect, it } from 'vitest';
import { getPublicCreatorProfileLookupKey } from './usePublicCreatorProfiles';

describe('public creator profile read lifecycle', () => {
  it('keeps the batch lookup key stable when Works change but creator identities do not', () => {
    const before = [
      { id: 'work-1', publicCreatorId: 'cxlc_0123456789abcdef0123456789abcdef', title: 'Old title' },
      { id: 'work-2', publicCreatorId: 'cxlc_0123456789abcdef0123456789abcdef', title: 'Another Work' }
    ];
    const after = [
      { ...before[0], title: 'Edited title', updatedAt: '2026-09-27T10:00:00Z' },
      { ...before[1], shortDescription: 'Changed description' }
    ];

    expect(getPublicCreatorProfileLookupKey(after)).toBe(getPublicCreatorProfileLookupKey(before));
  });

  it('changes the batch lookup key when a Work creator identity changes', () => {
    const before = [{ id: 'work-1', publicCreatorId: 'cxlc_0123456789abcdef0123456789abcdef' }];
    const after = [{ id: 'work-1', publicCreatorId: 'cxlc_fedcba9876543210fedcba9876543210' }];

    expect(getPublicCreatorProfileLookupKey(after)).not.toBe(getPublicCreatorProfileLookupKey(before));
  });
});
