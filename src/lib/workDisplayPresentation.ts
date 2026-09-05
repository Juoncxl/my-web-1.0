import type { Asset, PublicAssetCollaboration, WorkContentBlock } from '../types';
import {
  CREATOR_COLLAB_IDENTITY_BLOCK_ID,
  CREATOR_COLLAB_PUBLIC_BLOCK_PREFIX,
  createCollabDraftFromPublicContentBlocks,
  createPublicCollaborationSnapshot
} from '../components/creator/creatorCollabModel';

export interface CollaborationDisplayContext {
  name?: string;
  summary?: string;
  sharedTag?: string;
  platforms?: string[];
  collaboration?: PublicAssetCollaboration;
}

export interface WorkDisplayPresentation {
  title: string;
  summary: string;
  isCollaborationFocused: boolean;
  collaborationTitle: string;
  collaborationDetails: string;
  collaboration: PublicAssetCollaboration | null;
  publicCollaborationBlocks: WorkContentBlock[];
  hasNormalPublicContent: boolean;
}

export function isPublicCollaborationBlock(block: Pick<WorkContentBlock, 'id'>): boolean {
  return block.id === CREATOR_COLLAB_IDENTITY_BLOCK_ID || block.id.startsWith(CREATOR_COLLAB_PUBLIC_BLOCK_PREFIX);
}

function isPlaceholderTitle(title: string): boolean {
  const clean = title.trim();
  return !clean || clean === 'ยังไม่ได้ตั้งชื่อผลงาน';
}

/** Shared read-only selector for Card, Detail, and Composer Review. */
export function getWorkDisplayPresentation(asset: Asset, collaboration?: CollaborationDisplayContext): WorkDisplayPresentation {
  const blocks = asset.contentBlocks || [];
  const identityBlock = blocks.find(block => block.id === CREATOR_COLLAB_IDENTITY_BLOCK_ID);
  const publicCollaborationBlocks = blocks.filter(block => block.id.startsWith(CREATOR_COLLAB_PUBLIC_BLOCK_PREFIX));
  const hasNormalPublicContent = blocks.some(block => !isPublicCollaborationBlock(block) && block.type !== 'UI Code' && block.body.trim());
  // The Composer has two explicit Work modes. Category `collab` is therefore
  // the canonical discriminator for the Collaboration card, even when that
  // Work also contains normal content sections.
  const isCollaborationFocused = asset.category === 'collab';
  const restoredCollaboration = asset.category === 'collab' && blocks.length
    ? createPublicCollaborationSnapshot(createCollabDraftFromPublicContentBlocks(blocks))
    : null;
  // Public surfaces read only the explicit public snapshot. The optional context
  // remains as a legacy test seam but must already be public-safe.
  const collaborationData = asset.publicCollaboration || collaboration?.collaboration || restoredCollaboration;
  const collaborationTitle = collaborationData?.name?.trim() || collaboration?.name?.trim() || identityBlock?.title.trim() || '';
  const collaborationSummary = collaboration?.summary?.trim() || identityBlock?.body.trim() || '';

  return {
    title: isCollaborationFocused && collaborationTitle && isPlaceholderTitle(asset.title) ? collaborationTitle : asset.title,
    summary: isCollaborationFocused && collaborationSummary && !asset.shortDescription?.trim() ? collaborationSummary : asset.shortDescription?.trim() || '',
    isCollaborationFocused,
    collaborationTitle: collaborationTitle || (isCollaborationFocused ? asset.title : ''),
    collaborationDetails: collaborationSummary,
    collaboration: collaborationData,
    publicCollaborationBlocks,
    hasNormalPublicContent
  };
}
