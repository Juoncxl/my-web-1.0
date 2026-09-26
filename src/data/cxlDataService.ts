import { supabaseDataAdapter } from './adapters/supabase/supabaseDataAdapter';
import { googleDataAdapter } from './adapters/google/googleDataAdapter';

/** Structural contract derived from the CXL operations implemented by adapters. */
export type CxlDataService = typeof supabaseDataAdapter;

export type WorksReadBackend = 'supabase' | 'google';

/**
 * Select only the Works read operation. Every write and every other service
 * stays on Supabase, including when Google Works Read is enabled.
 */
export function createCxlDataService(configuredBackend: unknown): CxlDataService {
  const backend = String(configuredBackend || '').trim().toLowerCase();
  const worksFetch = backend === 'google'
    ? googleDataAdapter.works.fetch
    : supabaseDataAdapter.works.fetch;

  return {
    ...supabaseDataAdapter,
    works: {
      ...supabaseDataAdapter.works,
      fetch: worksFetch
    }
  };
}

const environment = (import.meta as any).env || {};

/** Build-time rollout flag; missing/unknown values keep the Supabase default. */
export const cxlDataService: CxlDataService = createCxlDataService(
  environment.VITE_CXL_WORKS_READ_BACKEND
);

export type { FetchAssetsOptions } from '../lib/supabaseService';
