import type { CxlDataService, FetchAssetsOptions } from '../../cxlDataService';
import {
  assertNoInlineMedia,
  assertNoInlineWorkMedia,
  collectReferencedMediaIds,
  dataUrlToBlob,
  isInlineMediaUrl,
  mediaIdFromReference,
  mediaReference,
  prepareAssetMedia
} from '../../../lib/workMedia';
import { callGoogleBackend } from './googleTransport';
import { filterGoogleWorks } from '../../googleWorksRead';
import { toGoogleWorkUpdateRequest } from './googleWorkWrite';
import { hydrateGoogleWorkMediaResult, prepareGoogleWorkMedia, uploadGoogleWorkMedia, type GoogleWorkAssetInput } from './googleWorkMedia';
import { warmAfterPublicWorkMutation, warmPublicWorkDetailCache, warmPublicWorksCache } from '../../../lib/publicWorksCache';

type Operation = (...args: any[]) => any;
type GoogleWorkWriteResult = Awaited<ReturnType<CxlDataService['works']['create']>>;
const remote = <T extends Operation>(action: string): T =>
  ((...args: Parameters<T>) => callGoogleBackend<Awaited<ReturnType<T>>>(action, args)) as T;

async function saveGoogleWork(action: 'works.create' | 'works.update', idOrAsset: string | GoogleWorkAssetInput, updateOrOptions?: Partial<GoogleWorkAssetInput> | { requestId?: string; expectedRevision?: number }, maybeOptions?: { requestId?: string; expectedRevision?: number }): Promise<GoogleWorkWriteResult> {
  try {
    const isUpdate = action === 'works.update';
    const rawAsset = (isUpdate ? updateOrOptions : idOrAsset) as GoogleWorkAssetInput;
    const options = (isUpdate ? maybeOptions : updateOrOptions) as { requestId?: string; expectedRevision?: number; mediaIds?: string[] } | undefined;
    const requestId = options?.requestId;
    const targetWorkId = isUpdate
      ? String(idOrAsset)
      : requestId && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId)
        ? `asset_${requestId.replace(/-/g, '').toLowerCase()}`
        : '';
    const prepared = await prepareGoogleWorkMedia(rawAsset);
    let mediaIds = options?.mediaIds || [];
    if (prepared.pending.length) {
      if (!requestId || !targetWorkId) throw new Error('A stable Work request ID is required before uploading media');
      mediaIds = await uploadGoogleWorkMedia(prepared.pending, { workId: targetWorkId });
    }
    if (isUpdate) {
      const [id, updates, writeOptions] = toGoogleWorkUpdateRequest(String(idOrAsset), prepared.asset, options);
      const result = await callGoogleBackend<GoogleWorkWriteResult>(action, [id, updates, { ...writeOptions, ...(mediaIds.length ? { mediaIds } : {}) }]);
      warmAfterPublicWorkMutation(action, result, updates);
      return hydrateGoogleWorkMediaResult(result);
    }
    const result = await callGoogleBackend<GoogleWorkWriteResult>(action, [prepared.asset, { ...options, ...(mediaIds.length ? { mediaIds } : {}) }]);
    warmAfterPublicWorkMutation(action, result);
    return hydrateGoogleWorkMediaResult(result);
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : `Google ${action} failed` };
  }
}

async function fetchPublicSnapshot(options: FetchAssetsOptions = {}) {
  // The signed-in Owner (whose CSRF cookie is readable) skips the CDN copy so a Work
  // they just made public appears immediately; guests keep the cached feed.
  const ownerSignedIn = typeof document !== 'undefined' && String(document.cookie || '').split(';').some(item => item.trim().startsWith('__Host-cxl_csrf='));
  const response = await fetch(ownerSignedIn ? '/api/cxl/public-works?fresh=1' : '/api/cxl/public-works', {
    method: 'GET',
    cache: ownerSignedIn ? 'no-store' : 'default',
    // Preview deployments are protected by Vercel Authentication. The page
    // can load while an `omit` request drops that same-origin auth cookie and
    // receives Vercel's 401 JSON instead of the public snapshot.
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  });
  const result = await response.json().catch(() => null) as {
    ok?: boolean;
    data?: { data?: unknown; error?: unknown };
    error?: unknown;
    message?: unknown;
  } | null;
  if (!response.ok || !result?.ok || !Array.isArray(result.data?.data)) {
    const rawError = result?.error;
    const error = typeof rawError === 'string'
      ? rawError
      : rawError && typeof rawError === 'object' && 'message' in rawError && typeof rawError.message === 'string'
        ? rawError.message
        : typeof result?.message === 'string'
          ? result.message
          : `Google public Works snapshot failed (${response.status})`;
    return { data: [], error };
  }
  const summaries = filterGoogleWorks(result.data.data as import('../../../types').Asset[], { ...options, publicOnly: true, detail: undefined });
  return hydrateGoogleWorkMediaResult({ data: summaries, error: null });
}

/** Guest detail reads use the CDN-cacheable GET route; owners keep the live POST read. */
async function fetchPublicWorkDetail(assetId: string) {
  const response = await fetch(`/api/cxl/public-work?${new URLSearchParams({ id: assetId })}`, {
    method: 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  });
  const result = await response.json().catch(() => null) as { ok?: boolean; data?: { data?: unknown }; error?: unknown } | null;
  if (!response.ok || !result?.ok || !Array.isArray(result.data?.data)) {
    return { data: [], error: typeof result?.error === 'string' ? result.error : `Google public Work detail failed (${response.status})` };
  }
  return hydrateGoogleWorkMediaResult({ data: result.data.data as import('../../../types').Asset[], error: null });
}

type GoogleWorkStatusAction = 'works.softDelete' | 'works.restore' | 'works.permanentDelete';
type GoogleWorkStatusResult = Awaited<ReturnType<CxlDataService['works']['softDelete']>>;

async function mutateGoogleWorkStatus(action: GoogleWorkStatusAction, id: string): Promise<GoogleWorkStatusResult> {
  try {
    const result = await callGoogleBackend<GoogleWorkStatusResult>(action, [id]);
    if (result.success) {
      warmPublicWorksCache();
      if (action === 'works.restore') warmPublicWorkDetailCache(id);
    }
    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : `Google ${action} failed` };
  }
}

/** Inactive Google implementation of the current CXL data contract. */
export const googleDataAdapter = {
  works: {
    fetch: (async (...args: Parameters<CxlDataService['works']['fetch']>) => {
      const options = (args[0] || {}) as FetchAssetsOptions;
      const isCacheablePublicList = options.publicOnly === true && !options.assetId && !options.creatorSlug
        && !options.userId && !options.currentUserId && !options.includeDeleted && !options.onlyDeleted
        && options.folderId === undefined && options.detail !== 'full';
      if (isCacheablePublicList) return fetchPublicSnapshot(options);
      // Only card opens state "no signed-in user" explicitly (currentUserId key present but empty);
      // direct /work links omit the key and may belong to the Owner, so they stay on the live read.
      const isGuestDetail = Boolean(options.assetId) && options.detail === 'full'
        && Object.prototype.hasOwnProperty.call(options, 'currentUserId') && !options.currentUserId?.trim()
        && !options.userId && !options.creatorSlug && !options.includeDeleted && !options.onlyDeleted && options.folderId === undefined;
      if (isGuestDetail) return fetchPublicWorkDetail(options.assetId!);
      const result = await callGoogleBackend<Awaited<ReturnType<CxlDataService['works']['fetch']>>>('works.fetch', args);
      return hydrateGoogleWorkMediaResult(result);
    }) as CxlDataService['works']['fetch'],
    create: ((asset, options) => saveGoogleWork('works.create', asset as GoogleWorkAssetInput, options)) as CxlDataService['works']['create'],
    update: ((id, updates, options) => saveGoogleWork('works.update', id, updates, options)) as CxlDataService['works']['update'],
    softDelete: ((id: string) => mutateGoogleWorkStatus('works.softDelete', id)) as CxlDataService['works']['softDelete'],
    restore: ((id: string) => mutateGoogleWorkStatus('works.restore', id)) as CxlDataService['works']['restore'],
    permanentDelete: ((id: string) => mutateGoogleWorkStatus('works.permanentDelete', id)) as CxlDataService['works']['permanentDelete'],
    emptyTrash: remote<CxlDataService['works']['emptyTrash']>('works.emptyTrash'),
    fork: remote<CxlDataService['works']['fork']>('works.fork'),
    exportVault: remote<CxlDataService['works']['exportVault']>('works.exportVault'),
    importLegacyGuestData: remote<CxlDataService['works']['importLegacyGuestData']>('works.importLegacyGuestData'),
    getLegacyGuestDataSummary: remote<CxlDataService['works']['getLegacyGuestDataSummary']>('works.getLegacyGuestDataSummary')
  },
  folders: {
    fetch: remote<CxlDataService['folders']['fetch']>('folders.fetch'),
    create: remote<CxlDataService['folders']['create']>('folders.create'),
    update: remote<CxlDataService['folders']['update']>('folders.update'),
    delete: remote<CxlDataService['folders']['delete']>('folders.delete')
  },
  collaborations: {
    fetchDrafts: remote<CxlDataService['collaborations']['fetchDrafts']>('collaborations.fetchDrafts'),
    createDraft: remote<CxlDataService['collaborations']['createDraft']>('collaborations.createDraft'),
    updateDraft: remote<CxlDataService['collaborations']['updateDraft']>('collaborations.updateDraft'),
    fetchWorks: remote<CxlDataService['collaborations']['fetchWorks']>('collaborations.fetchWorks'),
    createWork: remote<CxlDataService['collaborations']['createWork']>('collaborations.createWork'),
    updateWork: remote<CxlDataService['collaborations']['updateWork']>('collaborations.updateWork'),
    createPublicSnapshot: remote<CxlDataService['collaborations']['createPublicSnapshot']>('collaborations.createPublicSnapshot'),
    createDraftFromPublicSnapshot: remote<CxlDataService['collaborations']['createDraftFromPublicSnapshot']>('collaborations.createDraftFromPublicSnapshot')
  },
  media: {
    prepare: prepareAssetMedia,
    uploadPrepared: async () => { throw new Error('Google media uploads are available only through standard Work create/update'); },
    cleanupNew: remote<CxlDataService['media']['cleanupNew']>('media.cleanupNew'),
    listForDeletion: remote<CxlDataService['media']['listForDeletion']>('media.listForDeletion'),
    removeObjects: remote<CxlDataService['media']['removeObjects']>('media.removeObjects'),
    hydrate: remote<CxlDataService['media']['hydrate']>('media.hydrate'),
    cloneForFork: remote<CxlDataService['media']['cloneForFork']>('media.cloneForFork'),
    getFreshDownload: remote<CxlDataService['media']['getFreshDownload']>('media.getFreshDownload'),
    mediaReference,
    mediaIdFromReference,
    isInlineMediaUrl,
    dataUrlToBlob,
    assertNoInlineMedia,
    assertNoInlineWorkMedia,
    collectReferencedIds: collectReferencedMediaIds
  },
  profiles: {
    getSnapshot: remote<CxlDataService['profiles']['getSnapshot']>('profiles.getSnapshot'),
    getCreatorSnapshot: remote<CxlDataService['profiles']['getCreatorSnapshot']>('profiles.getCreatorSnapshot'),
    get: remote<CxlDataService['profiles']['get']>('profiles.get'),
    getCreator: remote<CxlDataService['profiles']['getCreator']>('profiles.getCreator'),
    getPublic: remote<CxlDataService['profiles']['getPublic']>('profiles.getPublic'),
    uploadImage: remote<CxlDataService['profiles']['uploadImage']>('profiles.uploadImage'),
    upsert: remote<CxlDataService['profiles']['upsert']>('profiles.upsert')
  },
  settings: {
    readCreatorSpace: remote<CxlDataService['settings']['readCreatorSpace']>('settings.readCreatorSpace'),
    writeCreatorSpace: remote<CxlDataService['settings']['writeCreatorSpace']>('settings.writeCreatorSpace'),
    removeWorkFromCreatorSpace: remote<CxlDataService['settings']['removeWorkFromCreatorSpace']>('settings.removeWorkFromCreatorSpace')
  },
  engagement: {
    fetchBookmarks: remote<CxlDataService['engagement']['fetchBookmarks']>('engagement.fetchBookmarks'),
    setBookmark: remote<CxlDataService['engagement']['setBookmark']>('engagement.setBookmark'),
    fetchLikedWorkIds: remote<CxlDataService['engagement']['fetchLikedWorkIds']>('engagement.fetchLikedWorkIds'),
    setWorkLike: remote<CxlDataService['engagement']['setWorkLike']>('engagement.setWorkLike')
  },
  reports: { submit: remote<CxlDataService['reports']['submit']>('reports.submit') }
} satisfies CxlDataService;

