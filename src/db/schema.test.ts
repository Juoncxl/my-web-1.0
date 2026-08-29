import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../../supabase/migrations/20260828140320_phase_1_stabilize_security.sql', import.meta.url),
  'utf8'
);
const legacyReference = readFileSync(new URL('../lib/constants.ts', import.meta.url), 'utf8');

describe('Phase 1 database security contract', () => {
  it('does not contain the critical ownership bypass', () => {
    expect(schema).not.toMatch(/auth\.uid\(\)::text\s*=\s*user_id\s+or\s+true/i);
    expect(migration).not.toMatch(/auth\.uid\(\)::text\s*=\s*user_id\s+or\s+true/i);
    expect(legacyReference).not.toMatch(/auth\.uid\(\)::text\s*=\s*user_id\s+or\s+true/i);
    expect(legacyReference).not.toMatch(/reports[^`]*for\s+select[^`]*using[^`]*or\s+true/i);
  });

  it('enforces one Like per user and asset at database level', () => {
    expect(schema).toMatch(/asset_likes_pkey\s+PRIMARY KEY\s*\(user_id,\s*asset_id\)/i);
    expect(migration).toMatch(/asset_likes_pkey\s+primary key\s*\(user_id,\s*asset_id\)/i);
  });

  it('keeps report reading locked and report insertion tied to auth.uid()', () => {
    expect(migration).toMatch(/reports_authenticated_insert[\s\S]*reporter_id\s*=\s*\(select auth\.uid\(\)\)::text/i);
    expect(migration).not.toMatch(/create policy\s+\w+\s+on\s+public\.reports\s+for\s+select/i);
  });

  it('creates a Fork before incrementing its source counter inside one RPC', () => {
    const functionBody = migration.match(/create or replace function public\.fork_asset[\s\S]*?end\s*\$\$;/i)?.[0] || '';
    expect(functionBody).toContain('insert into public.assets');
    expect(functionBody.indexOf('insert into public.assets')).toBeLessThan(functionBody.indexOf('set fork_count = fork_count + 1'));
  });
});
