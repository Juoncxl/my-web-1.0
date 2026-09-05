import { describe, expect, it } from 'vitest';
import { resolvePersistenceMode } from './persistenceMode';

describe('resolvePersistenceMode', () => {
  it('uses Supabase for a deployed build when its public client config exists', () => {
    expect(resolvePersistenceMode({
      MODE: 'production',
      PROD: true,
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'public-anon-key'
    })).toBe('supabase');
  });

  it('keeps localhost in the mock sandbox by default', () => {
    expect(resolvePersistenceMode({
      MODE: 'development',
      DEV: true,
      PROD: false,
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'public-anon-key'
    })).toBe('mock');
  });

  it('honors an explicit mock deployment', () => {
    expect(resolvePersistenceMode({
      MODE: 'production',
      PROD: true,
      VITE_PERSISTENCE_MODE: 'mock',
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'public-anon-key'
    })).toBe('mock');
  });

  it('does not enable cloud persistence without both Supabase values', () => {
    expect(resolvePersistenceMode({ MODE: 'production', PROD: true })).toBe('mock');
  });
});
