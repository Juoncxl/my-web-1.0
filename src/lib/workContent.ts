import type { Asset, WorkContentBlock } from '../types';

export interface WorkPresentationContent {
  shortDescription: string;
  contentBlocks: WorkContentBlock[];
  legacyContent: string;
  uiCode: string;
}

/** Keep modern structured Work fields independent while preserving legacy data fallback. */
export function resolveWorkPresentationContent(asset: Pick<Asset, 'shortDescription' | 'contentBlocks' | 'content' | 'uiCodeSnippet'>): WorkPresentationContent {
  const contentBlocks = (asset.contentBlocks || []).map(block => ({ ...block }));
  return {
    // Legacy `content` is main content, not an implicit short description.
    // Keeping the fallback out of this field prevents the same legacy body
    // from being rendered in both the summary and Main Content sections.
    shortDescription: asset.shortDescription ?? '',
    contentBlocks,
    legacyContent: asset.content || '',
    uiCode: contentBlocks.find(block => block.type === 'UI Code')?.body || asset.uiCodeSnippet || ''
  };
}
