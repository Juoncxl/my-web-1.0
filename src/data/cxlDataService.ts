import { supabaseDataAdapter } from './adapters/supabase/supabaseDataAdapter';
import { googleDataAdapter } from './adapters/google/googleDataAdapter';

/** Structural contract derived from the CXL operations implemented by adapters. */
export type CxlDataService = typeof supabaseDataAdapter;

export type WorksReadBackend = 'supabase' | 'google';
export type PublicCreatorReadBackend = 'supabase' | 'google';

/**
 * Select only the explicitly supported Google read operations. All writes,
 * mutations, and reads outside those selectors stay on Supabase.
 */
export function createCxlDataService(
  configuredWorksBackend: unknown,
  configuredPublicCreatorBackend?: unknown
): CxlDataService {
  const worksBackend = String(configuredWorksBackend || '').trim().toLowerCase();
  const publicCreatorBackend = String(configuredPublicCreatorBackend || '').trim().toLowerCase();
  const worksFetch = worksBackend === 'google'
    ? googleDataAdapter.works.fetch
    : supabaseDataAdapter.works.fetch;
  const getCreator = publicCreatorBackend === 'google'
    ? googleDataAdapter.profiles.getCreator
    : supabaseDataAdapter.profiles.getCreator;
  const getPublic = publicCreatorBackend === 'google'
    ? googleDataAdapter.profiles.getPublic
    : supabaseDataAdapter.profiles.getPublic;
  const readCreatorSpace = publicCreatorBackend === 'google'
    ? googleDataAdapter.settings.readCreatorSpace
    : supabaseDataAdapter.settings.readCreatorSpace;

  return {
    ...supabaseDataAdapter,
    works: {
      ...supabaseDataAdapter.works,
      fetch: worksFetch
    },
    profiles: {
      ...supabaseDataAdapter.profiles,
      getCreator,
      getPublic
    },
    settings: {
      ...supabaseDataAdapter.settings,
      readCreatorSpace
    }
  };
}

const environment = (import.meta as any).env || {};

/** Build-time rollout flag; missing/unknown values keep the Supabase default. */
export const cxlDataService: CxlDataService = createCxlDataService(
  environment.VITE_CXL_WORKS_READ_BACKEND,
  environment.VITE_CXL_PUBLIC_CREATOR_READ_BACKEND
);

export type { FetchAssetsOptions } from '../lib/supabaseService';
