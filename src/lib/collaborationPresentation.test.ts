import { describe, expect, it } from 'vitest';
import { getParticipantContentCopy, getParticipantTagCopy } from './collaborationPresentation';

describe('public collaboration participant copy', () => {
  it('copies only the normalized house tag', () => {
    expect(getParticipantTagCopy(' ##zexox ')).toBe('#zexox');
    expect(getParticipantTagCopy()).toBe('');
  });

  it('copies only trimmed participant notes', () => {
    expect(getParticipantContentCopy('  ชื่อวิซซู่, 22Y\nข้อมูลตัวละคร  ')).toBe('ชื่อวิซซู่, 22Y\nข้อมูลตัวละคร');
    expect(getParticipantContentCopy('   ')).toBe('');
  });
});
