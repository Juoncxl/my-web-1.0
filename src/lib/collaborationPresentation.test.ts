import { describe, expect, it } from 'vitest';
import { getParticipantHouseTagCopy } from './collaborationPresentation';

describe('public collaboration participant copy', () => {
  it('copies only one normalized house tag for promotion', () => {
    expect(getParticipantHouseTagCopy(' ##zexox ')).toBe('#zexox');
  });

  it('returns an empty value when a participant did not share a house tag', () => {
    expect(getParticipantHouseTagCopy('   ')).toBe('');
    expect(getParticipantHouseTagCopy()).toBe('');
  });
});
