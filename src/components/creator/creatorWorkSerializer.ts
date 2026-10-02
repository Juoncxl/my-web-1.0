import type {
  Asset,
  AssetAudienceRating,
  AssetContentType,
  AssetCreatorWorkStatus,
  AssetIcon,
  AssetStatus,
  AssetVisibility,
  WorkContentBlock
} from '../../types';
import { CREATOR_CONTENT_TYPE_META } from './creatorContentModel';
import type { CreatorMediaDraft } from './creatorMediaModel';
import type { StandardWorkMediaDraft } from '../../lib/workMedia';
import { mediaReference } from '../../lib/workMedia';
import {
  cloneCreatorCollaborationDraft,
  createPublicCollaborationSnapshot,
  isPublicCollabContentBlock,
  type CreatorCollaborationDraft
} from './creatorCollabModel';

export interface SerializableCreatorWorkDraft {
  title: string;
  contentTypes: AssetContentType[];
  workMode: 'standard' | 'collab';
  description: string;
  visibility: AssetVisibility;
  status: AssetStatus;
  workStatus: AssetCreatorWorkStatus;
  folderId: string | null;
  icon: AssetIcon;
  content: string;
  contentBlocks: WorkContentBlock[];
  uiCodeSnippet: string;
  previewImages: string[];
  coverImage: string;
  tags: string[];
  appPlatforms: string[];
  audienceRating: AssetAudienceRating;
  contentWarnings: string[];
  genres: string[];
  imagePromptToolModel: string;
  collaboration: CreatorCollaborationDraft;
  collaborationAssetId: string | null;
  mediaDraft?: CreatorMediaDraft;
}

function isLocalMediaSource(value: string): boolean {
  return /^data:image\//i.test(value) || /^blob:/i.test(value);
}

function canonicalProxyMediaSource(value: string, mediaId?: string): string {
  if (isLocalMediaSource(value) || value.startsWith('media:')) return value;
  if (!mediaId) return value;
  try {
    const url = new URL(value, 'https://cxl.invalid');
    const params = url.searchParams;
    return url.pathname === '/api/cxl/media'
      && ['owner', 'public'].includes(params.get('scope') || '')
      && params.get('ref') === mediaReference(mediaId)
      ? mediaReference(mediaId) : value;
  } catch { return value; }
}

export type CreatorWorkAssetFields = Pick<Asset,
  | 'title'
  | 'icon'
  | 'category'
  | 'shortDescription'
  | 'contentTypeLabels'
  | 'contentTypes'
  | 'presentationMetadata'
  | 'collaboration'
  | 'publicCollaboration'
  | 'collaborationAssetId'
  | 'contentBlocks'
  | 'content'
  | 'uiCodeSnippet'
  | 'previewImage'
  | 'previewImages'
  | 'folderId'
  | 'isPublic'
  | 'visibility'
  | 'status'
  | 'tags'
>;

function contentTypesToCategory(values: AssetContentType[]): Asset['category'] {
  const first = values[0] || 'bot_prompt';
  if (first === 'character') return 'character';
  if (first === 'lore') return 'lore';
  if (first === 'ui_code') return 'ui_code';
  return 'prompts';
}

/** The single serializer used by Composer Review, local persistence, and Supabase persistence. */
export function serializeCreatorWorkDraft(draft: SerializableCreatorWorkDraft): CreatorWorkAssetFields & { workMediaDraft: StandardWorkMediaDraft[] } {
  const isCollaboration = draft.workMode === 'collab';
  const title = isCollaboration ? draft.collaboration.name.trim() : draft.title.trim();
  const contentTypes = [...draft.contentTypes];
  const regularBlocks = draft.contentBlocks
    .filter(block => !isPublicCollabContentBlock(block))
    .map(block => block.type === 'Image'
      ? { ...block, body: canonicalProxyMediaSource(block.body, block.mediaId) }
      : { ...block });
  const canonicalGallerySource = (source: string) => {
    const item = draft.mediaDraft?.items.find(candidate => candidate.src === source);
    return canonicalProxyMediaSource(source, item?.mediaId);
  };
  const coverItem = draft.mediaDraft?.items.find(item => item.src === draft.coverImage);
  const workMediaDraft: StandardWorkMediaDraft[] = [];
  const canonicalCollaboration = isCollaboration ? cloneCreatorCollaborationDraft(draft.collaboration) : null;
  // A Collab keeps its apps in one place: the Collab's own list.
  if (canonicalCollaboration) {
    const seen = new Set<string>();
    canonicalCollaboration.platforms = [...canonicalCollaboration.platforms, ...draft.appPlatforms].filter(platform => {
      const key = platform.trim().toLocaleLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  if (draft.icon.type === 'image' && isLocalMediaSource(draft.icon.value) && draft.icon.mediaId) {
    workMediaDraft.push({ mediaId: draft.icon.mediaId, source: draft.icon.value, purpose: 'icon', sortOrder: 0, isCover: false, mimeType: draft.icon.mimeType });
  }
  if (isCollaboration && canonicalCollaboration) {
    canonicalCollaboration.participants.forEach(participant => {
      participant.referenceImages = participant.referenceImages.map((image, sortOrder) => {
        const mediaId = image.mediaId || (isLocalMediaSource(image.src) ? crypto.randomUUID() : undefined);
        if (isLocalMediaSource(image.src)) {
          if (!mediaId) throw new Error('เบราว์เซอร์ไม่สามารถสร้าง media identity ได้');
          workMediaDraft.push({
            mediaId,
            source: image.src,
            purpose: 'collab_reference',
            contextId: participant.id,
            sortOrder,
            isCover: false,
            mimeType: image.mimeType
          });
        }
        return {
          ...image,
          mediaId: mediaId || undefined,
          src: canonicalProxyMediaSource(image.src, mediaId),
          localBlobKey: undefined
        };
      });
    });
  }
  draft.mediaDraft?.items.forEach((item, sortOrder) => {
    if (isLocalMediaSource(item.src) && item.mediaId) {
      workMediaDraft.push({
        mediaId: item.mediaId, source: item.src, purpose: 'gallery', sortOrder,
        isCover: item.id === draft.mediaDraft.coverId, mimeType: item.mimeType
      });
    }
  });
  regularBlocks.forEach((block, sortOrder) => {
    if (block.type === 'Image' && isLocalMediaSource(block.body) && block.mediaId) {
      workMediaDraft.push({ mediaId: block.mediaId, source: block.body, purpose: 'prompt_example', contextId: block.id, sortOrder, isCover: false });
    }
  });

  return {
    title,
    icon: draft.icon.type === 'image'
      ? { ...draft.icon, value: canonicalProxyMediaSource(draft.icon.value, draft.icon.mediaId) }
      : { ...draft.icon },
    category: isCollaboration ? 'collab' : contentTypesToCategory(contentTypes),
    shortDescription: draft.description.trim(),
    contentTypeLabels: contentTypes.map(type => CREATOR_CONTENT_TYPE_META.find(option => option.value === type)?.label || type),
    contentTypes,
    presentationMetadata: {
      contentTypes,
      appPlatforms: isCollaboration ? [] : [...draft.appPlatforms],
      audienceRating: draft.audienceRating,
      contentWarnings: [...draft.contentWarnings],
      genres: [...draft.genres],
      imagePromptToolModel: draft.imagePromptToolModel.trim(),
      workStatus: draft.workStatus
    },
    collaboration: canonicalCollaboration,
    publicCollaboration: canonicalCollaboration ? createPublicCollaborationSnapshot(canonicalCollaboration) : null,
    collaborationAssetId: isCollaboration ? null : draft.collaborationAssetId,
    contentBlocks: regularBlocks,
    content: draft.content,
    uiCodeSnippet: draft.uiCodeSnippet,
    previewImage: draft.coverImage ? canonicalProxyMediaSource(draft.coverImage, coverItem?.mediaId) : '',
    previewImages: draft.previewImages.map(canonicalGallerySource),
    folderId: draft.folderId,
    isPublic: draft.visibility === 'public',
    visibility: draft.visibility,
    status: draft.status,
    tags: [...draft.tags],
    workMediaDraft
  };
}

/** Public-safe export shape. Owner-only Collaboration draft data is deliberately excluded. */
export function createPublicAssetExport(asset: Asset): Asset {
  const { collaboration: _privateCollaboration, qaStorageKey: _qaStorageKey, ...publicAsset } = asset;
  return publicAsset as Asset;
}
