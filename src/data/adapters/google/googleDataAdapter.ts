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
      return hydrateGoogleWorkMediaResult(result);
    }
    const result = await callGoogleBackend<GoogleWorkWriteResult>(action, [prepared.asset, { ...options, ...(mediaIds.length ? { mediaIds } : {}) }]);
    return hydrateGoogleWorkMediaResult(result);
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : `Google ${action} failed` };
  }
}

async function fetchPublicSnapshot(options: FetchAssetsOptions = {}) {
  const response = await fetch('/api/cxl/public-works', {
    method: 'GET',
    credentials: 'omit',
    headers: { Accept: 'application/json' }
  });
  const result = await response.json().catch(() => null) as { ok?: boolean; data?: { data?: unknown; error?: string }; error?: string } | null;
  if (!response.ok || !result?.ok || !Array.isArray(result.data?.data)) {
    return { data: [], error: result?.error || 'Google public Works snapshot failed' };
  }
  const summaries = filterGoogleWorks(result.data.data as import('../../../types').Asset[], { ...options, publicOnly: true, detail: undefined });
  return hydrateGoogleWorkMediaResult({ data: summaries, error: null });
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
      const result = await callGoogleBackend<Awaited<ReturnType<CxlDataService['works']['fetch']>>>('works.fetch', args);
      return hydrateGoogleWorkMediaResult(result);
    }) as CxlDataService['works']['fetch'],
    create: ((asset, options) => saveGoogleWork('works.create', asset as GoogleWorkAssetInput, options)) as CxlDataService['works']['create'],
    update: ((id, updates, options) => saveGoogleWork('works.update', id, updates, options)) as CxlDataService['works']['update'],
    softDelete: remote<CxlDataService['works']['softDelete']>('works.softDelete'),
    restore: remote<CxlDataService['works']['restore']>('works.restore'),
    permanentDelete: remote<CxlDataService['works']['permanentDelete']>('works.permanentDelete'),
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

