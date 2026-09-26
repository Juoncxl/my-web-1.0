import { supabaseDataAdapter } from './adapters/supabase/supabaseDataAdapter';
import { googleDataAdapter } from './adapters/google/googleDataAdapter';
import type { Asset } from '../types';

/** Structural contract derived from the CXL operations implemented by adapters. */
type BaseCxlDataService = typeof supabaseDataAdapter;
export type WorkCreateOptions = { requestId?: string };
export type WorkUpdateOptions = { requestId?: string; expectedRevision?: number };
export type CxlDataService = Omit<BaseCxlDataService, 'works' | 'folders'> & {
  works: Omit<BaseCxlDataService['works'], 'create' | 'update'> & {
    create: (asset: Parameters<BaseCxlDataService['works']['create']>[0], options?: WorkCreateOptions) => ReturnType<BaseCxlDataService['works']['create']>;
    update: (id: string, updates: Partial<Asset>, options?: WorkUpdateOptions) => ReturnType<BaseCxlDataService['works']['update']>;
  };
  folders: Omit<BaseCxlDataService['folders'], 'fetch'> & {
    fetch: (userId: string) => ReturnType<BaseCxlDataService['folders']['fetch']>;
  };
};

export type WorksReadBackend = 'supabase' | 'google';
export type PublicCreatorReadBackend = 'supabase' | 'google';
export type WorksWriteBackend = 'supabase' | 'google';

/**
 * Select only the explicitly supported Google read operations. All writes,
 * mutations, and reads outside those selectors stay on Supabase.
 */
export function createCxlDataService(
  configuredWorksBackend: unknown,
  configuredPublicCreatorBackend?: unknown,
  configuredWorksWriteBackend?: unknown
): CxlDataService {
  const worksBackend = String(configuredWorksBackend || '').trim().toLowerCase();
  const publicCreatorBackend = String(configuredPublicCreatorBackend || '').trim().toLowerCase();
  const worksWriteBackend = String(configuredWorksWriteBackend || '').trim().toLowerCase();
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
  const createWork: CxlDataService['works']['create'] = worksWriteBackend === 'google'
    ? (asset, options) => options?.requestId ? googleDataAdapter.works.create(asset, options) : supabaseDataAdapter.works.create(asset)
    : supabaseDataAdapter.works.create;
  const updateWork: CxlDataService['works']['update'] = worksWriteBackend === 'google'
    ? (id, updates, options) => options?.requestId ? googleDataAdapter.works.update(id, updates, options) : supabaseDataAdapter.works.update(id, updates)
    : supabaseDataAdapter.works.update;
  const folders = worksWriteBackend === 'google'
    ? { ...supabaseDataAdapter.folders, fetch: googleDataAdapter.folders.fetch }
    : supabaseDataAdapter.folders;

  return {
    ...supabaseDataAdapter,
    works: {
      ...supabaseDataAdapter.works,
      fetch: worksFetch,
      create: createWork,
      update: updateWork
    },
    folders,
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
  environment.VITE_CXL_PUBLIC_CREATOR_READ_BACKEND,
  environment.VITE_CXL_WORKS_WRITE_BACKEND
);

export type { FetchAssetsOptions } from '../lib/supabaseService';
