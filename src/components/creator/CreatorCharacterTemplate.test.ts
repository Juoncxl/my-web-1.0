import { describe, expect, it } from 'vitest';
import { CHARACTER_PROFILE_TEMPLATE, withCharacterTemplate } from './CreatorContentCanvas';

describe('character profile template', () => {
  it('fills an empty profile and never overwrites existing text', () => {
    expect(withCharacterTemplate('')).toBe(CHARACTER_PROFILE_TEMPLATE);
    expect(withCharacterTemplate('ชื่อ: คลาวิส\n')).toBe(`ชื่อ: คลาวิส\n\n${CHARACTER_PROFILE_TEMPLATE}`);
    expect(CHARACTER_PROFILE_TEMPLATE.split('\n')).toContain('ความสัมพันธ์กับ {{user}}:');
  });
});
