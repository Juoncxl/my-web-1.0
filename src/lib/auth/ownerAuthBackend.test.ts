import { describe, expect, it } from 'vitest';
import { selectOwnerAuthBackend } from './ownerAuthBackend';

describe('Owner auth backend selection', () => {
  it.each([undefined, '', 'unexpected', 'SUPABASE'])('defaults %s to Supabase', value => {
    expect(selectOwnerAuthBackend(value)).toBe('supabase');
  });
  it('selects Vercel only for the explicit vercel value', () => {
    expect(selectOwnerAuthBackend('vercel')).toBe('vercel');
  });
});
