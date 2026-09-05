import type { Asset, AssetIcon, User, WorkContentBlock } from '../../types';
import { CREATOR_CONTENT_TYPE_META, getSelectedContentTypes, type CreatorContentCanvasDraft, type CreatorContentType } from './creatorContentModel';

export type CreatorReviewMode = 'card' | 'detail';

export interface CreatorReviewDraftInput {
  title: string;
  category: Asset['category'];
  contentTypes: CreatorContentType[];
  workMode: 'standard' | 'collab';
  description: string;
  visibility: Asset['visibility'];
  status: Asset['status'];
  folderId: string | null;
  icon: AssetIcon;
  media: { src: string }[];
  coverImage: string;
  tags: string[];
  contentCanvas: CreatorContentCanvasDraft;
}

const PREVIEW_ASSET_ID = 'creator-composer-preview';

function nonEmpty(value: string): string {
  return value.trim();
}

function addTextBlock(blocks: WorkContentBlock[], id: string, title: string, body: string, type: WorkContentBlock['type'] = 'Text') {
  const cleanBody = nonEmpty(body);
  if (cleanBody) blocks.push({ id, type, title, body: cleanBody });
}

export function createCreatorContentBlocks(contentTypes: CreatorContentType[], canvas: CreatorContentCanvasDraft): WorkContentBlock[] {
  const selected = getSelectedContentTypes(contentTypes);
  const contentBlocks: WorkContentBlock[] = [];

  if (selected.includes('character')) addTextBlock(contentBlocks, 'creator-character', 'ข้อมูลตัวละคร', canvas.character);
  if (selected.includes('lore')) addTextBlock(contentBlocks, 'creator-story', 'เนื้อเรื่องและโลกทัศน์', canvas.story);
  if (selected.includes('image_prompt')) {
    addTextBlock(contentBlocks, 'creator-image-prompt', 'คำสั่งเจนรูป', canvas.imagePrompt.prompt, 'Prompt');
    addTextBlock(contentBlocks, 'creator-image-tool-model', 'เครื่องมือ / โมเดลที่ใช้', canvas.imagePrompt.toolModel, 'Note');
    canvas.imagePrompt.exampleImages.forEach((src, index) => {
      if (src) contentBlocks.push({ id: `creator-image-example-${index}`, type: 'Image', title: `รูปตัวอย่าง ${index + 1}`, body: src });
    });
  }
  if (selected.includes('ui_code')) addTextBlock(contentBlocks, 'creator-ui-code', 'โค้ดหน้า UI', canvas.uiCode, 'UI Code');
  if (selected.includes('bot_prompt')) {
    canvas.botPrompt.customFields.forEach(field => addTextBlock(contentBlocks, `creator-bot-${field.id}`, field.title || 'ช่องข้อมูล', field.value));
  }
  return contentBlocks;
}

/**
 * Adapts only the in-memory Composer draft to the existing Asset presentation
 * contract. The adapter is never persisted and keeps selected canvas sections
 * separate from Image Prompt example media.
 */
export function createCreatorReviewAsset(draft: CreatorReviewDraftInput, creatorProfile?: User | null): Asset {
  const canvas = draft.contentCanvas;
  const contentBlocks = createCreatorContentBlocks(draft.contentTypes, canvas);

  const creatorId = creatorProfile?.id || 'creator-preview-user';
  const media = draft.media.map(item => item.src).filter(Boolean);
  const cover = draft.coverImage || '';
  const cardMedia = cover ? [cover, ...media.filter(src => src !== cover)] : media;
  const content = contentBlocks.filter(block => block.type !== 'UI Code').map(block => `${block.title}\n${block.body}`).join('\n\n');
  const now = new Date().toISOString();

  return {
    id: PREVIEW_ASSET_ID,
    userId: creatorId,
    authorName: creatorProfile?.displayName || 'คุณ',
    authorAvatar: creatorProfile?.avatarUrl,
    title: draft.title.trim() || 'ยังไม่ได้ตั้งชื่อผลงาน',
    icon: draft.icon,
    category: draft.workMode === 'collab' ? 'collab' : draft.category,
    contentTypes: [...draft.contentTypes],
    contentTypeLabels: draft.contentTypes.map(type => CREATOR_CONTENT_TYPE_META.find(option => option.value === type)?.label || type),
    shortDescription: draft.description.trim(),
    contentBlocks,
    content,
    uiCodeSnippet: canvas.uiCode,
    previewImage: cover,
    previewImages: cardMedia,
    folderId: draft.folderId,
    isPublic: draft.visibility === 'public',
    visibility: draft.visibility,
    status: draft.status,
    tags: [...draft.tags],
    createdAt: now,
    updatedAt: now,
    likesCount: 0,
    forkCount: 0,
    linkedAssetIds: [],
    versions: []
  };
}

export function getCreatorReviewMissingNotices(draft: Pick<CreatorReviewDraftInput, 'title' | 'coverImage'> & { collaborationTitle?: string }): string[] {
  const notices: string[] = [];
  if (!draft.title.trim() && !draft.collaborationTitle?.trim()) notices.push('ยังไม่ได้ตั้งชื่อผลงาน');
  if (!draft.coverImage) notices.push('ยังไม่ได้เลือกภาพปก');
  return notices;
}
