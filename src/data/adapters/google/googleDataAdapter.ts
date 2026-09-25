import type { CxlDataService } from '../../cxlDataService';
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

type Operation = (...args: any[]) => any;
const remote = <T extends Operation>(action: string): T =>
  ((...args: Parameters<T>) => callGoogleBackend<Awaited<ReturnType<T>>>(action, args)) as T;

async function uploadGooglePrepared(prepared: Parameters<CxlDataService['media']['uploadPrepared']>[0]): Promise<Awaited<ReturnType<CxlDataService['media']['uploadPrepared']>>> {
  const pending = await Promise.all(prepared.pending.map(async item => {
    const bytes = new Uint8Array(await item.blob.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return { record: item.record, base64: btoa(binary) };
  }));
  return callGoogleBackend('media.uploadPrepared', [{ asset: prepared.asset, pending }]);
}

/** Inactive Google implementation of the current CXL data contract. */
export const googleDataAdapter = {
  works: {
    fetch: remote<CxlDataService['works']['fetch']>('works.fetch'),
    create: remote<CxlDataService['works']['create']>('works.create'),
    update: remote<CxlDataService['works']['update']>('works.update'),
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
    uploadPrepared: uploadGooglePrepared,
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
