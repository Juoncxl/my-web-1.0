import { describe, expect, it } from 'vitest';
import { getParticipantPromotionCopy } from './collaborationPresentation';

describe('public collaboration participant copy', () => {
  it('copies the normalized house tag and public note body without adding a Note heading', () => {
    expect(getParticipantPromotionCopy(' ##zexox ', '  ชื่อวิซซู่, 22Y\nข้อมูลตัวละคร  ')).toBe('#zexox\n\nชื่อวิซซู่, 22Y\nข้อมูลตัวละคร');
  });

  it('still allows either useful field and returns empty only when both are absent', () => {
    expect(getParticipantPromotionCopy('', 'ข้อมูลตัวละคร')).toBe('ข้อมูลตัวละคร');
    expect(getParticipantPromotionCopy('#zexox', '')).toBe('#zexox');
    expect(getParticipantPromotionCopy('   ', '   ')).toBe('');
    expect(getParticipantPromotionCopy()).toBe('');
  });
});
