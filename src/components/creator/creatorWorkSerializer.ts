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
export function serializeCreatorWorkDraft(draft: SerializableCreatorWorkDraft): CreatorWorkAssetFields {
  const isCollaboration = draft.workMode === 'collab';
  const title = isCollaboration ? draft.collaboration.name.trim() : draft.title.trim();
  const contentTypes = [...draft.contentTypes];
  const regularBlocks = draft.contentBlocks
    .filter(block => !isPublicCollabContentBlock(block))
    .map(block => ({ ...block }));

  return {
    title,
    icon: { ...draft.icon },
    category: isCollaboration ? 'collab' : contentTypesToCategory(contentTypes),
    shortDescription: draft.description.trim(),
    contentTypeLabels: contentTypes.map(type => CREATOR_CONTENT_TYPE_META.find(option => option.value === type)?.label || type),
    contentTypes,
    presentationMetadata: {
      contentTypes,
      appPlatforms: [...draft.appPlatforms],
      audienceRating: draft.audienceRating,
      contentWarnings: [...draft.contentWarnings],
      genres: [...draft.genres],
      imagePromptToolModel: draft.imagePromptToolModel.trim(),
      workStatus: draft.workStatus
    },
    collaboration: isCollaboration ? cloneCreatorCollaborationDraft(draft.collaboration) : null,
    publicCollaboration: isCollaboration ? createPublicCollaborationSnapshot(draft.collaboration) : null,
    collaborationAssetId: isCollaboration ? null : draft.collaborationAssetId,
    contentBlocks: regularBlocks,
    content: draft.content,
    uiCodeSnippet: draft.uiCodeSnippet,
    previewImage: draft.coverImage || '',
    previewImages: [...draft.previewImages],
    folderId: draft.folderId,
    isPublic: draft.visibility === 'public',
    visibility: draft.visibility,
    status: draft.status,
    tags: [...draft.tags]
  };
}

/** Public-safe export shape. Owner-only Collaboration draft data is deliberately excluded. */
export function createPublicAssetExport(asset: Asset): Asset {
  const { collaboration: _privateCollaboration, qaStorageKey: _qaStorageKey, ...publicAsset } = asset;
  return publicAsset as Asset;
}
