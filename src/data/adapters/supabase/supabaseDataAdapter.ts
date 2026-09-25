import {
  createCollabDraftFromPublicSnapshot,
  createPublicCollaborationSnapshot
} from '../../../components/creator/creatorCollabModel';
import {
  readPersistedCreatorSpaceSettings,
  writePersistedCreatorSpaceSettings,
  removeAssetFromCreatorSpaceSettings
} from '../../../lib/creatorPersistence';
import { supabaseService } from '../../../lib/supabaseService';
import {
  assertNoInlineMedia,
  assertNoInlineWorkMedia,
  cleanupNewMedia,
  cloneAssetMediaForFork,
  collectReferencedMediaIds,
  dataUrlToBlob,
  getFreshMediaDownload,
  hydrateAssetMedia,
  isInlineMediaUrl,
  listAssetMediaForDeletion,
  mediaIdFromReference,
  mediaReference,
  prepareAssetMedia,
  removeAssetMediaObjects,
  uploadPreparedMedia
} from '../../../lib/workMedia';

/**
 * Current CXL persistence implementation. Keep backend-specific code here so
 * application consumers depend on CXL operations rather than Supabase.
 */
export const supabaseDataAdapter = {
  works: {
    fetch: supabaseService.fetchAssets.bind(supabaseService),
    create: supabaseService.createAsset.bind(supabaseService),
    update: supabaseService.updateAsset.bind(supabaseService),
    softDelete: supabaseService.softDeleteAsset.bind(supabaseService),
    restore: supabaseService.restoreAsset.bind(supabaseService),
    permanentDelete: supabaseService.permanentDeleteAsset.bind(supabaseService),
    emptyTrash: supabaseService.emptyTrash.bind(supabaseService),
    fork: supabaseService.forkAsset.bind(supabaseService),
    exportVault: supabaseService.exportVaultData.bind(supabaseService),
    importLegacyGuestData: supabaseService.importLegacyGuestData.bind(supabaseService),
    getLegacyGuestDataSummary: supabaseService.getLegacyGuestDataSummary.bind(supabaseService)
  },
  folders: {
    fetch: supabaseService.fetchFolders.bind(supabaseService),
    create: supabaseService.createFolder.bind(supabaseService),
    update: supabaseService.updateFolder.bind(supabaseService),
    delete: supabaseService.deleteFolder.bind(supabaseService)
  },
  collaborations: {
    fetchDrafts: supabaseService.fetchAssets.bind(supabaseService),
    createDraft: supabaseService.createAsset.bind(supabaseService),
    updateDraft: supabaseService.updateAsset.bind(supabaseService),
    fetchWorks: supabaseService.fetchAssets.bind(supabaseService),
    createWork: supabaseService.createAsset.bind(supabaseService),
    updateWork: supabaseService.updateAsset.bind(supabaseService),
    createPublicSnapshot: createPublicCollaborationSnapshot,
    createDraftFromPublicSnapshot: createCollabDraftFromPublicSnapshot
  },
  media: {
    prepare: prepareAssetMedia,
    uploadPrepared: uploadPreparedMedia,
    cleanupNew: cleanupNewMedia,
    listForDeletion: listAssetMediaForDeletion,
    removeObjects: removeAssetMediaObjects,
    hydrate: hydrateAssetMedia,
    cloneForFork: cloneAssetMediaForFork,
    getFreshDownload: getFreshMediaDownload,
    mediaReference,
    mediaIdFromReference,
    isInlineMediaUrl,
    dataUrlToBlob,
    assertNoInlineMedia,
    assertNoInlineWorkMedia,
    collectReferencedIds: collectReferencedMediaIds
  },
  profiles: {
    getSnapshot: supabaseService.getProfileSnapshot.bind(supabaseService),
    getCreatorSnapshot: supabaseService.getCreatorProfileSnapshot.bind(supabaseService),
    get: supabaseService.getProfile.bind(supabaseService),
    getCreator: supabaseService.getCreatorProfile.bind(supabaseService),
    getPublic: supabaseService.getPublicProfiles.bind(supabaseService),
    uploadImage: supabaseService.uploadProfileImage.bind(supabaseService),
    upsert: supabaseService.upsertProfile.bind(supabaseService)
  },
  settings: {
    readCreatorSpace: readPersistedCreatorSpaceSettings,
    writeCreatorSpace: writePersistedCreatorSpaceSettings,
    removeWorkFromCreatorSpace: removeAssetFromCreatorSpaceSettings
  },
  engagement: {
    fetchBookmarks: supabaseService.fetchBookmarks.bind(supabaseService),
    setBookmark: supabaseService.setBookmark.bind(supabaseService),
    fetchLikedWorkIds: supabaseService.fetchLikedAssetIds.bind(supabaseService),
    setWorkLike: supabaseService.setAssetLike.bind(supabaseService)
  },
  reports: {
    submit: supabaseService.submitReport.bind(supabaseService)
  }
};
