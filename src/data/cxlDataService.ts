import { supabaseDataAdapter } from './adapters/supabase/supabaseDataAdapter';
import { googleDataAdapter } from './adapters/google/googleDataAdapter';
import type { Asset } from '../types';

/** Structural contract derived from the CXL operations implemented by adapters. */
type BaseCxlDataService = typeof supabaseDataAdapter;
export type WorkCreateOptions = { requestId?: string; mediaIds?: string[] };
export type WorkUpdateOptions = { requestId?: string; expectedRevision?: number; mediaIds?: string[] };
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
export type OwnerAuthBackend = 'supabase' | 'vercel';

/**
 * Select only the explicitly supported Google read operations. All writes,
 * mutations and reads outside those selectors stay on Supabase. In Vercel
 * Owner auth mode unsupported Supabase-authenticated mutations fail explicitly.
 */
export function createCxlDataService(
  configuredWorksBackend: unknown,
  configuredPublicCreatorBackend?: unknown,
  configuredWorksWriteBackend?: unknown,
  configuredOwnerAuthBackend?: unknown
): CxlDataService {
  const worksBackend = String(configuredWorksBackend || '').trim().toLowerCase();
  const publicCreatorBackend = String(configuredPublicCreatorBackend || '').trim().toLowerCase();
  const worksWriteBackend = String(configuredWorksWriteBackend || '').trim().toLowerCase();
  const ownerAuthBackend = String(configuredOwnerAuthBackend || '').trim().toLowerCase() === 'vercel' ? 'vercel' : 'supabase';
  const unsupported = (operation: string) => async () => { throw new Error(`${operation} is deferred in Vercel Owner auth mode`); };
  const failedWrite = (operation: string) => async () => ({ success: false, error: `${operation} is deferred in Vercel Owner auth mode` });
  const deferredList = (operation: string) => async () => ({ data: [], error: `${operation} is deferred in Vercel Owner auth mode` });
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
    ? (asset, options) => options?.requestId ? googleDataAdapter.works.create(asset, options)
      : ownerAuthBackend === 'vercel' ? Promise.resolve({ data: null, error: 'A stable Google create request ID is required in Vercel Owner auth mode' }) : supabaseDataAdapter.works.create(asset)
    : ownerAuthBackend === 'vercel'
      ? (async () => ({ data: null, error: 'Work create requires the Google Works write Preview flag in Vercel Owner auth mode' })) as CxlDataService['works']['create']
      : supabaseDataAdapter.works.create;
  const updateWork: CxlDataService['works']['update'] = worksWriteBackend === 'google'
    ? (id, updates, options) => options?.requestId ? googleDataAdapter.works.update(id, updates, options)
      : ownerAuthBackend === 'vercel' ? Promise.resolve({ data: null, error: 'A stable Google update request ID and expected revision are required in Vercel Owner auth mode' }) : supabaseDataAdapter.works.update(id, updates)
    : ownerAuthBackend === 'vercel'
      ? (async () => ({ data: null, error: 'Work update requires the Google Works write Preview flag in Vercel Owner auth mode' })) as CxlDataService['works']['update']
      : supabaseDataAdapter.works.update;
  const folderFetch = ownerAuthBackend === 'vercel' || worksWriteBackend === 'google'
    ? googleDataAdapter.folders.fetch
    : supabaseDataAdapter.folders.fetch;
  const folders = folderFetch === supabaseDataAdapter.folders.fetch
    ? supabaseDataAdapter.folders
    : { ...supabaseDataAdapter.folders, fetch: folderFetch };

  const base = {
    ...supabaseDataAdapter,
    works: {
      ...supabaseDataAdapter.works,
      fetch: worksFetch,
      create: createWork,
      update: updateWork,
      ...(ownerAuthBackend === 'vercel' ? {
        softDelete: googleDataAdapter.works.softDelete,
        restore: googleDataAdapter.works.restore,
        permanentDelete: googleDataAdapter.works.permanentDelete,
        emptyTrash: failedWrite('Trash cleanup'),
        fork: failedWrite('Work fork')
      } : {})
    },
    folders: ownerAuthBackend === 'vercel' ? {
      ...folders,
      create: failedWrite('Folder create'), update: failedWrite('Folder update'), delete: failedWrite('Folder delete')
    } : folders,
    collaborations: ownerAuthBackend === 'vercel' ? {
      ...supabaseDataAdapter.collaborations,
      fetchDrafts: deferredList('Private collaboration reads'), fetchWorks: deferredList('Collaboration reads'),
      createDraft: unsupported('Collaboration draft create'), updateDraft: unsupported('Collaboration draft update'),
      createWork: unsupported('Collaboration Work create'), updateWork: unsupported('Collaboration Work update')
    } : supabaseDataAdapter.collaborations,
    media: ownerAuthBackend === 'vercel' ? {
      ...supabaseDataAdapter.media,
      uploadPrepared: unsupported('Media upload'), cleanupNew: unsupported('Media cleanup'),
      removeObjects: unsupported('Media delete'), cloneForFork: unsupported('Media clone'),
      hydrate: unsupported('Supabase media hydration'), getFreshDownload: unsupported('Supabase media download')
    } : supabaseDataAdapter.media,
    profiles: ownerAuthBackend === 'vercel' ? {
      ...supabaseDataAdapter.profiles, uploadImage: unsupported('Profile media upload'), upsert: failedWrite('Profile update')
    } : supabaseDataAdapter.profiles,
    settings: ownerAuthBackend === 'vercel' ? {
      ...supabaseDataAdapter.settings,
      writeCreatorSpace: failedWrite('Creator Space settings write'), removeWorkFromCreatorSpace: () => false
    } : supabaseDataAdapter.settings,
    engagement: ownerAuthBackend === 'vercel' ? {
      ...supabaseDataAdapter.engagement,
      fetchBookmarks: deferredList('Bookmark reads'), fetchLikedWorkIds: deferredList('Personalized engagement reads'),
      setBookmark: failedWrite('Bookmark updates'), setWorkLike: failedWrite('Like updates')
    } : supabaseDataAdapter.engagement,
    reports: ownerAuthBackend === 'vercel' ? { submit: failedWrite('Report submission') } : supabaseDataAdapter.reports
  };

  return {
    ...base,
    profiles: {
      ...base.profiles,
      getCreator,
      getPublic
    },
    settings: {
      ...base.settings,
      readCreatorSpace
    }
  };
}

const environment = (import.meta as any).env || {};
export const isGoogleWorksReadBackend = String(environment.VITE_CXL_WORKS_READ_BACKEND || '').trim().toLowerCase() === 'google';

/** Build-time rollout flag; missing/unknown values keep the Supabase default. */
export const cxlDataService: CxlDataService = createCxlDataService(
  environment.VITE_CXL_WORKS_READ_BACKEND,
  environment.VITE_CXL_PUBLIC_CREATOR_READ_BACKEND,
  environment.VITE_CXL_WORKS_WRITE_BACKEND,
  environment.VITE_CXL_OWNER_AUTH_BACKEND
);

export type { FetchAssetsOptions } from '../lib/supabaseService';
